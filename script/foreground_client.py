#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import os
import subprocess
from datetime import datetime

import requests
from dotenv import load_dotenv
from rich.console import Console
from rich.traceback import install as install_rich_traceback

# =====================
# 配置和 Rich
# =====================
install_rich_traceback(show_locals=True)
console = Console()
load_dotenv(".env.local")  # 加载 .env.local 文件中的配置

CHECK_INTERVAL = 2  # 每 2 秒检测前台应用
FORCE_UPLOAD_INTERVAL = 10  # 每 10 秒强制上传一次

# 从 .env.local 文件读取配置
INGEST_URL = os.environ.get("INGEST_URL")
API_TOKEN = os.environ.get("API_TOKEN")
machine_id = os.environ.get("machine_id")

# 如果没有配置 INGEST_URL 或 API_TOKEN，抛出错误
if not INGEST_URL:
    raise RuntimeError("请在 .env 文件中设置 INGEST_URL")
if not API_TOKEN:
    raise RuntimeError("请在 .env 文件中设置 API_TOKEN")
if not machine_id:
    raise RuntimeError("请在 .env 文件中设置 machine_id")


# =====================
# 检查 ADB 是否存在且有设备
# =====================
def check_adb():
    try:
        subprocess.check_output(["adb", "version"], stderr=subprocess.DEVNULL)
    except Exception:
        raise RuntimeError("未找到 adb，请确保 adb 已安装并在 PATH 中")

    try:
        output = subprocess.check_output(["adb", "devices"], text=True)
        devices = [line for line in output.splitlines() if line.endswith("\tdevice")]
        if not devices:
            raise RuntimeError("没有可用设备，请连接至少一台 Android 设备")
    except Exception:
        raise RuntimeError("检测设备失败，请确保设备已通过 USB 或 TCP 连接并允许调试")


check_adb()


# =====================
# 获取前台应用
# =====================
async def get_foreground_app() -> tuple[str, str]:
    try:
        output = subprocess.check_output(
            "adb shell dumpsys window | grep mCurrentFocusedWindow",
            shell=True,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        pkg = output.split()[-1] if output else None
    except Exception:
        pkg = None

    if not pkg:
        return "未知应用 - 无法获取包名", "unknown"

    try:
        pm_output = subprocess.check_output(
            ["adb", "shell", "pm", "path", pkg],
            text=True,
            stderr=subprocess.DEVNULL,
        ).splitlines()
        apk_path = None
        for line in pm_output:
            line = line.strip()
            if line.endswith(".apk"):
                apk_path = (
                    line[len("package:") :] if line.startswith("package:") else line
                )
                break
        if not apk_path:
            return f"未知应用 - {pkg}", pkg
    except Exception:
        return f"未知应用 - {pkg}", pkg

    try:
        aapt2_output = subprocess.check_output(
            ["aapt2", "dump", "badging", apk_path],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        app_name = None
        for line in aapt2_output.splitlines():
            if line.startswith("application-label-zh-CN:"):
                app_name = line.split(":", 1)[1].strip().strip("'\"")
                break
        if not app_name:
            for line in aapt2_output.splitlines():
                if line.startswith("application-label-zh:"):
                    app_name = line.split(":", 1)[1].strip().strip("'\"")
                    break
        if not app_name:
            for line in aapt2_output.splitlines():
                if line.startswith("application-label:"):
                    app_name = line.split(":", 1)[1].strip().strip("'\"")
                    break
        return f"{app_name.strip('()') if app_name else '未知应用'} - {pkg}", pkg
    except Exception:
        return f"未知应用 - {pkg}", pkg


# =====================
# 上传状态
# =====================
async def upload_status(payload: dict):
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }
    try:
        res = requests.post(INGEST_URL, json=payload, headers=headers, timeout=5)
        now_str = datetime.now().strftime("%H:%M:%S")
        if res.status_code == 200:
            console.print(f"[{now_str}] 上传成功: {payload['app_name']}", style="green")
        else:
            console.print(
                f"[{now_str}] 上传失败: {res.status_code} {res.text}", style="red"
            )
    except Exception as e:
        console.print(
            f"[{datetime.now().strftime('%H:%M:%S')}] 上传异常: {e}", style="red"
        )


# =====================
# 主循环
# =====================
async def main():
    last_app_name = ""
    last_upload_time = 0

    console.print(
        f"状态上传客户端启动，每 {CHECK_INTERVAL}s 检测，{FORCE_UPLOAD_INTERVAL}s 强制上传一次",
        style="cyan",
    )
    console.print(f"使用 INGEST_URL={INGEST_URL}", style="cyan")

    while True:
        app_label_name, app_package_name = await get_foreground_app()
        now_ts = int(datetime.now().timestamp())
        payload = {
            "machine": machine_id,  # 添加 machine_id
            "window_title": app_label_name,  # 使用应用标签作为 window_title
            "app_name": app_label_name,  # 使用应用标签作为 app_name
            "event_time": datetime.now().isoformat(),  # 使用 ISO8601 格式的时间
        }

        should_upload = (
            app_label_name != last_app_name
            or now_ts - last_upload_time >= FORCE_UPLOAD_INTERVAL
        )

        if app_label_name != last_app_name:
            console.print(
                f"[{datetime.now().strftime('%H:%M:%S')}] 前台窗口变化: {last_app_name} → {app_label_name}",
                style="yellow",
            )

        if should_upload:
            await upload_status(payload)
            last_app_name = app_label_name
            last_upload_time = now_ts

        await asyncio.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())

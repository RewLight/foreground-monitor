#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import subprocess
from datetime import datetime

import websockets

WS_PORT = 8765
CHECK_INTERVAL = 1  # 秒


async def get_foreground_app() -> str:
    """获取当前前台应用名称（优先中文-CN），失败则返回包名或提示未知应用"""
    try:
        # 获取当前前台包名
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
        return "未知应用 - 无法获取包名"

    # 获取 APK 路径，取第一个 .apk 文件
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
            return f"未知应用 - {pkg}"
    except Exception:
        return f"未知应用 - {pkg}"

    # 使用 aapt2 获取应用名称
    try:
        aapt2_output = subprocess.check_output(
            ["aapt2", "dump", "badging", apk_path],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        app_name = None

        # 优先 zh-CN
        for line in aapt2_output.splitlines():
            if line.startswith("application-label-zh-CN:"):
                app_name = line.split(":", 1)[1].strip().strip("'\"")
                break

        # fallback zh
        if not app_name:
            for line in aapt2_output.splitlines():
                if line.startswith("application-label-zh:"):
                    app_name = line.split(":", 1)[1].strip().strip("'\"")
                    break

        # fallback 默认标签
        if not app_name:
            for line in aapt2_output.splitlines():
                if line.startswith("application-label:"):
                    app_name = line.split(":", 1)[1].strip().strip("'\"")
                    break

        # 去掉包名前后括号
        return f"{app_name.strip('()') if app_name else '未知应用'} - {pkg}"
    except Exception:
        return f"未知应用 - {pkg}"


async def foreground_app_server(websocket):
    """WebSocket 处理函数：实时推送前台应用名称"""
    last_app = None
    try:
        while True:
            app_name = await get_foreground_app()
            if app_name != last_app:
                await websocket.send(app_name)
                last_app = app_name
            await asyncio.sleep(CHECK_INTERVAL)
    except websockets.exceptions.ConnectionClosed:
        pass


async def main():
    """启动 WebSocket 服务器"""
    async with websockets.serve(foreground_app_server, "0.0.0.0", WS_PORT):
        print(
            f"[{datetime.now().strftime('%H:%M:%S')}] WebSocket 前台应用服务器已启动，端口 {WS_PORT}"
        )
        await asyncio.Future()  # 保持运行


if __name__ == "__main__":
    asyncio.run(main())

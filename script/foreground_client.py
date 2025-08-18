#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

import requests
from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, TextColumn
from rich.traceback import install as install_rich_traceback

install_rich_traceback(show_locals=True)
console = Console()
load_dotenv(".env.local")

# 配置
CHECK_INTERVAL = 2
FORCE_UPLOAD_INTERVAL = 10

INGEST_URL = os.environ.get("INGEST_URL")
API_TOKEN = os.environ.get("API_TOKEN")
machine_id = os.environ.get("machine_id")

if not INGEST_URL or not API_TOKEN or not machine_id:
    raise RuntimeError("请在 .env.local 中设置 INGEST_URL、API_TOKEN、machine_id")


# ========== ADB 检查 ==========
def check_adb() -> None:
    """检查 adb 是否可用并且至少有一个设备在线；否则抛错终止程序"""
    try:
        subprocess.check_output(["adb", "version"], stderr=subprocess.DEVNULL)
    except Exception:
        raise RuntimeError("未找到 adb，请确保 adb 已安装并在 PATH 中")

    try:
        output = subprocess.check_output(["adb", "devices"], text=True)
        # 过滤掉首行和空行，查找以 '\tdevice' 结尾的行
        devices = [
            line
            for line in output.splitlines()
            if line.strip() and line.endswith("\tdevice")
        ]
        if not devices:
            raise RuntimeError("没有可用设备，请连接至少一台 Android 设备并允许调试")
    except Exception:
        raise RuntimeError("检测设备失败；请确保设备通过 USB 或 TCP 连接并允许调试")


# ========== MediaSession dataclass & 解析 ==========
@dataclass
class MediaSession:
    package: str
    state: Optional[str]
    title: Optional[str]
    author: Optional[str]


# 媒体优先级（先按这个列表选择）
MEDIA_PRIORITY = [
    "tv.danmaku.bilibilihd",
    "tv.danmaku.bilibili",
    "com.netease.cloudmusic",
    "com.tencent.qqmusic",
    "com.kugou.android",
]


def parse_media_sessions() -> List[MediaSession]:
    """解析 `adb shell dumpsys media_session` 输出，严格按 ownerPid 分块，提取 package/state/metadata.description"""
    try:
        output = subprocess.check_output(
            ["adb", "shell", "dumpsys", "media_session"], text=True
        )
    except Exception:
        return []

    sessions: List[MediaSession] = []
    # 按 ownerPid 开头拆分每个 session 块
    blocks = re.split(r"(?=ownerPid=\d+)", output)
    for block in blocks:
        if "active=true" not in block:
            continue

        # package
        pkg_match = re.search(r"package=([\w\.]+)", block)
        if not pkg_match:
            continue
        pkg = pkg_match.group(1)

        # state（PlaybackState {... state=PLAYING(3) ...}）
        state_match = re.search(r"state=PlaybackState\s*{state=(\w+)\(", block)
        state = state_match.group(1) if state_match else None

        # metadata.description 格式通常 "{title}, {author}, null"
        desc_match = re.search(
            r"metadata:.*?description=(.*?)(, null|\n|$)", block, re.DOTALL
        )
        if desc_match:
            desc = desc_match.group(1).strip().strip('"“”')
            if not desc or desc.lower() == "null":
                title = author = None
            else:
                parts = [p.strip() for p in desc.split(",")]
                title = parts[0] if len(parts) > 0 else None
                author = parts[1] if len(parts) > 1 else None
        else:
            title = author = None

        sessions.append(
            MediaSession(package=pkg, state=state, title=title, author=author)
        )

    return sessions


def select_active_media(sessions: List[MediaSession]) -> Optional[MediaSession]:
    """按 MEDIA_PRIORITY 顺序选择第一个满足 PLAYING 且 title/author 都非空的 session"""
    for pkg in MEDIA_PRIORITY:
        for s in sessions:
            if s.package == pkg and s.state == "PLAYING" and s.title and s.author:
                return s
    return None


def format_media_title(session: MediaSession) -> str:
    """生成要上报的媒体描述字符串"""
    t = session.title or ""
    a = session.author or ""
    if session.package == "tv.danmaku.bilibilihd":
        return f"📺哔哩哔哩HD - {t}"
    if session.package == "tv.danmaku.bilibili":
        return f"📺哔哩哔哩 - {t}"
    if session.package == "com.netease.cloudmusic":
        return f"🎶网易云音乐 - {t} {a}".strip()
    if session.package == "com.tencent.qqmusic":
        return f"🎵QQ音乐 - {t} {a}".strip()
    if session.package == "com.kugou.android":
        return f"🎵酷狗音乐 - {t} {a}".strip()
    return f"🎵{session.package} - {t}".strip()


# ========== 前台应用名称获取与缓存 ==========
app_name_cache: dict = {}


async def get_foreground_app() -> tuple[str, str]:
    """
    返回 (应用名称 - 包名, 包名)
    优先使用缓存；若无缓存则通过 pm path + aapt2 dump badging 获取应用名（优先 zh-CN -> zh -> label）
    若均失败，fallback 包名最后一段
    """
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

    if pkg in app_name_cache:
        return f"{app_name_cache[pkg]} - {pkg}", pkg

    # 获取 apk 路径
    apk_path = None
    try:
        pm_output = subprocess.check_output(
            ["adb", "shell", "pm", "path", pkg], text=True, stderr=subprocess.DEVNULL
        )
        for line in pm_output.splitlines():
            line = line.strip()
            if line.startswith("package:"):
                apk_path = line.split("package:", 1)[1]
                break
    except Exception:
        apk_path = None

    app_name = None
    if apk_path:
        try:
            aapt2_output = subprocess.check_output(
                ["aapt2", "dump", "badging", apk_path],
                text=True,
                stderr=subprocess.DEVNULL,
            )
            # 优先 zh-CN -> zh -> application-label
            for prefix in (
                "application-label-zh-CN:",
                "application-label-zh:",
                "application-label:",
            ):
                for ln in aapt2_output.splitlines():
                    if ln.startswith(prefix):
                        app_name = ln.split(":", 1)[1].strip().strip("'\"")
                        break
                if app_name:
                    break
        except Exception:
            app_name = None

    if not app_name:
        app_name = pkg.split(".")[-1]

    app_name_cache[pkg] = app_name
    return f"{app_name} - {pkg}", pkg


# ========== 上传逻辑与计数器 ==========
counters = {"checked": 0, "success": 0, "failed": 0}


async def upload_status(payload: dict, progress: Progress) -> None:
    """同步 requests.post 放在 async 函数内；失败/成功更新 counters 并用 progress.log 记录"""
    try:
        res = requests.post(
            INGEST_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {API_TOKEN}",
                "Content-Type": "application/json",
            },
            timeout=5,
        )
        if res.status_code == 200:
            counters["success"] += 1
            progress.log(f"[green]上传成功: {payload['app_name']}[/green]")
        else:
            counters["failed"] += 1
            progress.log(f"[red]上传失败: {res.status_code} {res.text}[/red]")
    except Exception as e:
        counters["failed"] += 1
        progress.log(f"[red]上传异常: {e}[/red]")


# ========== 主循环 ==========
async def main() -> None:
    last_name = ""
    last_upload_time = 0

    console.print(
        f"状态上传客户端启动，每 {CHECK_INTERVAL}s 检测，{FORCE_UPLOAD_INTERVAL}s 强制上传一次，machine_id={machine_id}",
        style="cyan",
    )

    # Progress: 左侧统计，空白 spacer，右侧时间（右对齐）
    with Progress(
        TextColumn("[cyan]检测次数: {task.fields[checked]}"),
        TextColumn(" | [green]成功上传: {task.fields[success]}"),
        TextColumn(" | [red]失败上传: {task.fields[failed]}"),
        transient=False,
    ) as progress:
        task_id = progress.add_task("status", checked=0, success=0, failed=0)

        while True:
            counters["checked"] += 1

            sessions = parse_media_sessions()
            active_media = select_active_media(sessions)

            if active_media:
                # 仅当 title 和 author 都存在时才上报媒体（select_active_media 已保证）
                app_label_name = format_media_title(active_media)
                app_package_name = active_media.package
            else:
                app_label_name, app_package_name = await get_foreground_app()

            payload = {
                "machine": machine_id,
                "window_title": app_label_name,
                "app_name": app_label_name,
            }
            now_ts = int(datetime.now().timestamp())

            should_upload = (app_label_name != last_name) or (
                now_ts - last_upload_time >= FORCE_UPLOAD_INTERVAL
            )

            if app_label_name != last_name:
                progress.log(
                    f"[yellow]前台窗口变化: {last_name} → {app_label_name}[/yellow]"
                )

            if should_upload:
                await upload_status(payload, progress)
                last_name = app_label_name
                last_upload_time = now_ts

            # 更新进度显示（包括右侧时间）
            progress.update(
                task_id,
                checked=counters["checked"],
                success=counters["success"],
                failed=counters["failed"],
            )

            await asyncio.sleep(CHECK_INTERVAL)


# ========== 启动入口（包括 ADB 检查与 Ctrl+C 捕获） ==========
if __name__ == "__main__":
    try:
        check_adb()
    except Exception as e:
        console.print(f"[red]ADB 检查失败: {e}[/red]")
        raise SystemExit(1)

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[yellow]检测终止，程序已退出[/yellow]")

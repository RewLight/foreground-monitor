#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# =====================
# 加载 .env 配置
# =====================
load_dotenv()

API_TOKEN = os.environ.get("API_TOKEN", "ADISSATISFACTIONTOTHEWORLD")
PORT = int(os.environ.get("PORT", 8000))

# =====================
# 状态存储
# =====================
last_status = None

# =====================
# Flask 实例
# =====================
app = Flask(__name__)
CORS(app)


# =====================
# 辅助函数
# =====================
def verify_token(req):
    auth = req.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return False
    token = auth.split(" ", 1)[1]
    return token == API_TOKEN


# =====================
# 上传状态接口
# =====================
@app.route("/api/ingest", methods=["POST"])
def ingest_status():
    global last_status
    if not verify_token(request):
        return "Invalid or missing token", 403
    try:
        data = request.json
        if (
            not data
            or "appLabelName" not in data
            or "appPackageName" not in data
            or "lastUpdateTimestamp" not in data
        ):
            return "Invalid payload", 400
        last_status = data
        print(
            f"[{datetime.now().strftime('%H:%M:%S')}] 上传成功: {data['appLabelName']}"
        )
        return jsonify({"detail": "状态已保存"}), 200
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 上传失败: {e}")
        return str(e), 500


# =====================
# 查询最后状态接口
# =====================
@app.route("/api/status", methods=["GET"])
def get_status():
    if not last_status:
        return jsonify({"detail": "暂无状态"}), 404
    return jsonify(last_status)


# =====================
# 启动
# =====================
if __name__ == "__main__":
    print(f"Flask 服务器启动，端口 {PORT}")
    app.run(host="0.0.0.0", port=PORT)

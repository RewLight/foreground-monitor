// =============================
// AutoX.js 状态上传客户端
// =============================

// ====== 配置管理 ======
var CONFIG_FILE = files.join(files.getSdcardPath(), "autoxjs_status_config.json");

// 默认配置
var DEFAULT_ENV = {
    INGEST_URL: "Example##https://why.so.serious/api/ingest",
    API_TOKEN: "Example##A_Dissatisfaction_To_The_World",
    MACHINE_ID: "Example##leijun_yu7csn"
}

// 加载配置
function loadConfig() {
    try {
        if (files.exists(CONFIG_FILE)) {
            var content = files.read(CONFIG_FILE);
            return JSON.parse(content);
        }
    } catch (e) {
        console.error("加载配置失败:", e);
    }
    return DEFAULT_ENV;
}

// 保存配置
function saveConfig(config) {
    try {
        files.write(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.error("保存配置失败:", e);
        return false;
    }
}

// 验证配置
function validateConfig(config) {
    // 检查是否为空
    if (!config.INGEST_URL || !config.API_TOKEN || !config.MACHINE_ID) {
        return { valid: false, message: "请填写完整的配置信息" };
    }
    
    // 检查是否包含示例值
    if (config.INGEST_URL.startsWith("Example##") || 
        config.API_TOKEN.startsWith("Example##") || 
        config.MACHINE_ID.startsWith("Example##")) {
        return { 
            valid: false, 
            message: "配置错误：请替换所有以 'Example##' 开头的示例值为实际配置" 
        };
    }
    
    return { valid: true };
}

// 显示配置对话框
function showConfigDialog(currentConfig) {
    var newConfig = null;
    var dialog = dialogs.build({
        title: "配置设置",
        positive: "保存",
        negative: "保留当前配置",
        neutral: "退出",
        autoDismiss: false,
        customView: 
            <vertical padding="16">
                <text text="上传地址 (INGEST_URL):" textColor="#666666" textSize="14sp"/>
                <input id="url" text={currentConfig.INGEST_URL} singleLine="true" marginBottom="8"/>
                
                <text text="API Token:" textColor="#666666" textSize="14sp"/>
                <input id="token" text={currentConfig.API_TOKEN} singleLine="true" marginBottom="8"/>
                
                <text text="设备ID (MACHINE_ID):" textColor="#666666" textSize="14sp"/>
                <input id="machine" text={currentConfig.MACHINE_ID} singleLine="true"/>
                
                <text text="注意：不要使用以 'Example##' 开头的示例值" textColor="#ff0000" textSize="12sp" marginTop="8"/>
            </vertical>
    }).on("positive", function(dialog) {
        newConfig = {
            INGEST_URL: dialog.getCustomView().url.text(),
            API_TOKEN: dialog.getCustomView().token.text(),
            MACHINE_ID: dialog.getCustomView().machine.text()
        };
        
        // 验证配置
        var validation = validateConfig(newConfig);
        if (!validation.valid) {
            toast(validation.message);
            return;
        }
        
        if (saveConfig(newConfig)) {
            toast("配置已保存");
            dialog.dismiss();
        } else {
            toast("保存配置失败");
        }
    }).on("negative", function(dialog) {
        newConfig = currentConfig;
        dialog.dismiss();
    }).on("neutral", function(dialog) {
        dialog.dismiss();
        exit();
    }).show();
    
    // 等待对话框关闭
    while (dialog.isShowing()) {
        sleep(100);
    }
    
    return newConfig;
}

// 初始化配置
function initializeConfig() {
    var config = loadConfig();
    
    // 验证当前配置
    var validation = validateConfig(config);
    
    // 显示当前配置状态
    var configStatus = validation.valid ? "✅ 配置有效" : "❌ " + validation.message;
    
    // 询问是否修改配置
    var shouldModify = dialogs.confirm(
        "配置管理", 
        "当前配置状态: " + configStatus + "\n\n" +
        "设备ID: " + config.MACHINE_ID + "\n" +
        "上传地址: " + config.INGEST_URL + "\n" +
        "API Token: " + (config.API_TOKEN ? "***" + config.API_TOKEN.slice(-6) : "未设置") + "\n" +
        "是否要修改配置？"
    );
    
    if (shouldModify || !validation.valid) {
        config = showConfigDialog(config);
        if (!config) {
            // 用户选择退出
            return null;
        }
        
        // 再次验证配置
        validation = validateConfig(config);
        if (!validation.valid) {
            dialogs.alert("配置错误", validation.message + "\n\n脚本将退出。");
            return null;
        }
    }
    
    return config;
}

// 初始化环境变量
var ENV = initializeConfig();

// 如果配置无效或用户取消，退出脚本
if (!ENV) {
    toast("配置未完成，脚本退出");
    exit();
}

// ====== 版本与配置 ======
var VERSION_INFO = {
    LOCAL_VERSION: "1.2.0",
    REMOTE_VERSION_URL: "https://raw.githubusercontent.com/RewLight/foreground-monitor/refs/heads/autoxjs/VERSION",
    UPDATE_PAGE_URL: "https://github.com/RewLight/foreground-monitor/tree/autoxjs",
    DO_CHECK_UPDATE: true
};

var CONFIG = {
    CHECK_INTERVAL: 2000, // 每次检测间隔(ms)
    FORCE_UPLOAD_INTERVAL: 10000, // 强制上传时间(ms)，即使未变化
    MEDIA_PRIORITY: [
        "tv.danmaku.bilibilihd",
        "tv.danmaku.bilibili",
        "com.netease.cloudmusic",
        "com.tencent.qqmusic",
        "com.kugou.android"
    ]
};

var SHIZUKU_ALIVE = false;
try {
    SHIZUKU_ALIVE = !!shizuku && typeof shizuku === "function";
} catch (e) {
    SHIZUKU_ALIVE = false;
}

var counters = { checked: 0, success: 0, failed: 0 };
var lastState = { appName: "", lastUploadTime: 0 };
var appNameCache = {};

// ====== 工具函数 ======

function MediaSession(packageName, state, title, author) {
    this.package = packageName;
    this.state = state;
    this.title = title;
    this.author = author;
    this.hasActiveAndPlaying = false;
}

function compareSemver(a, b) {
    if (!a) a = "0.0.0";
    if (!b) b = "0.0.0";
    var as = a.replace(/^v/i, "").split(".");
    var bs = b.replace(/^v/i, "").split(".");
    var len = Math.max(as.length, bs.length);
    for (var i = 0; i < len; i++) {
        var ai = parseInt(as[i] || 0), bi = parseInt(bs[i] || 0);
        if (ai < bi) return -1;
        if (ai > bi) return 1;
    }
    return 0;
}

function fetchRemoteVersion() {
    try {
        var res = http.get(VERSION_INFO.REMOTE_VERSION_URL);
        if (res && res.statusCode === 200 && res.body) {
            return res.body.string().split(/\r?\n/)[0].trim();
        }
    } catch (e) {}
    return null;
}

function checkForUpdates() {
    if (!VERSION_INFO.DO_CHECK_UPDATE) return;
    try {
        var remote = fetchRemoteVersion();
        if (!remote) return;
        if (compareSemver(VERSION_INFO.LOCAL_VERSION, remote) < 0) {
            var msg = "发现新版本：" + remote + "（当前：" + VERSION_INFO.LOCAL_VERSION + "）";
            toast(msg); console.log(msg);
            if (dialogs && dialogs.confirm) {
                if (dialogs.confirm("检测到更新", msg + "\n是否打开网页？")) {
                    app.openUrl(VERSION_INFO.UPDATE_PAGE_URL);
                }
            }
        }
    } catch (e) {}
}

function checkShizukuStatus() {
    try {
        return !!shizuku && typeof shizuku === "function" && shizuku.isAlive();
    } catch (e) {
        return false;
    }
}

function enableAccessibilityViaShizuku() {
    shizuku.openAccessibility();
    sleep(5000);
}

// ====== 媒体检测 ======

/**
 * 解析 dumpsys media_session 输出
 * - 按 ownerPid 分块
 * - 提取 package、state、title、author
 * - 标记 hasActiveAndPlaying
 */
function parseMediaSessions() {
    if (!SHIZUKU_ALIVE) return [];
    try {
        var output = shizuku("dumpsys media_session");
        if (!output) return [];
        var blocks = String(output).split(/(?=ownerPid=\d+)/);
        var sessions = [];

        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i];
            if (block.indexOf("active=true") === -1) continue;

            var pkgMatch = block.match(/package=([\w\.]+)/);
            if (!pkgMatch) continue;
            var pkg = pkgMatch[1];

            var stateMatch = block.match(/state=PlaybackState\s*\{state=(\w+)/);
            var state = stateMatch ? stateMatch[1] : null;

            var descMatch = block.match(/metadata:[\s\S]*?description=(.*?)(, null|\n|$)/);
            var title = null, author = null;
            if (descMatch) {
                var desc = descMatch[1].trim().replace(/^["']|["']$/g, "");
                if (desc && desc.toLowerCase() !== "null") {
                    var parts = desc.split(",").map(function (p) { return p.trim(); });
                    title = parts[0] || null;
                    author = parts[1] || null;
                    if (title && title.toLowerCase() === "null") title = null;
                    if (author && author.toLowerCase() === "null") author = null;
                }
            }

            var session = new MediaSession(pkg, state, title, author);
            if (block.indexOf("state=PLAYING") !== -1) {
                session.hasActiveAndPlaying = true;
            }

            sessions.push(session);
        }

        return sessions;
    } catch (e) {
        return [];
    }
}

/**
 * 选择第一个满足 active=true 且 state=PLAYING 的媒体包
 */
function selectActiveMedia(sessions) {
    for (var i = 0; i < CONFIG.MEDIA_PRIORITY.length; i++) {
        var pkg = CONFIG.MEDIA_PRIORITY[i];
        for (var j = 0; j < sessions.length; j++) {
            var s = sessions[j];
            if (s.package === pkg && s.hasActiveAndPlaying) {
                return s;
            }
        }
    }
    return null;
}

function formatMediaTitle(session) {
    var t = session.title || "", a = session.author || "";
    if (session.package === "tv.danmaku.bilibilihd") return "📺哔哩哔哩HD - " + t;
    if (session.package === "tv.danmaku.bilibili") return "📺哔哩哔哩 - " + t;
    if (session.package === "com.netease.cloudmusic") return ("🎶网易云音乐 - " + t + " " + a).trim();
    if (session.package === "com.tencent.qqmusic") return ("🎵QQ音乐 - " + t + " " + a).trim();
    if (session.package === "com.kugou.android") return ("🎵酷狗音乐 - " + t + " " + a).trim();
    return ("🎵" + session.package + " - " + t).trim();
}

// ====== 前台应用处理 ======

function getForegroundApp() {
    var pkg = "unknown";
    try { pkg = currentPackage(); } catch (e) {}
    if (pkg in appNameCache) return { label: appNameCache[pkg] + " - " + pkg, package: pkg };

    try {
        var name = app.getAppName(pkg) || pkg.split(".").pop();
        appNameCache[pkg] = name;
        return { label: name + " - " + pkg, package: pkg };
    } catch (e) {
        var fallback = pkg.split(".").pop();
        appNameCache[pkg] = fallback;
        return { label: fallback + " - " + pkg, package: pkg };
    }
}

function uploadStatus(payload) {
    try {
        var res = http.postJson(ENV.INGEST_URL, payload, {
            headers: {
                Authorization: "Bearer " + ENV.API_TOKEN,
                "Content-Type": "application/json"
            },
            timeout: 5000
        });
        if (res && res.statusCode === 200) {
            counters.success++;
            console.log("[✓] 上传成功:", payload.app_name);
        } else {
            counters.failed++;
            var msg = res && res.body ? res.body.string() : "";
            console.warn("[×] 上传失败:", res.statusCode, msg);
        }
    } catch (e) {
        counters.failed++;
        console.error("[×] 上传异常:", e);
    }
}

// ====== 初始化 & 主循环 ======

function initialize() {
    // 最终验证配置
    var validation = validateConfig(ENV);
    if (!validation.valid) {
        throw new Error(validation.message);
    }

    checkForUpdates();

    if (SHIZUKU_ALIVE && auto.service == null) {
        console.log("Shizuku 可用，尝试授权...");
        enableAccessibilityViaShizuku();
    }

    if (auto.service == null) {
        throw new Error("无障碍服务未授予，无法运行脚本");
    }

    console.log("✅ 状态监听器启动完成");
    console.log("📋 当前配置:");
    console.log("  - 设备ID:", ENV.MACHINE_ID);
    console.log("  - 上传地址:", ENV.INGEST_URL);
    console.log("  - API Token:", "***" + ENV.API_TOKEN.slice(-6));
}

function main() {
    while (true) {
        try {
            counters.checked++;
            SHIZUKU_ALIVE = checkShizukuStatus();

            var sessions = parseMediaSessions();
            var activeMedia = selectActiveMedia(sessions);

            var appLabel, appPkg;
            if (activeMedia) {
                appLabel = formatMediaTitle(activeMedia);
                appPkg = activeMedia.package;
            } else {
                var fg = getForegroundApp();
                appLabel = fg.label;
                appPkg = fg.package;
            }

            var now = Date.now();
            var shouldUpload = appLabel !== lastState.appName || (now - lastState.lastUploadTime >= CONFIG.FORCE_UPLOAD_INTERVAL);
            if (shouldUpload) {
                uploadStatus({
                    machine: ENV.MACHINE_ID,
                    window_title: appLabel,
                    app_name: appLabel
                });
                lastState.appName = appLabel;
                lastState.lastUploadTime = now;
            }

        } catch (e) {
            console.error("主循环异常:", e);
        }
        sleep(CONFIG.CHECK_INTERVAL);
    }
}

// ====== 启动入口 ======

try {
    initialize();
    main();
} catch (e) {
    toast("启动失败: " + e.message);
    console.error("❌ 启动失败:", e);
    exit();
}

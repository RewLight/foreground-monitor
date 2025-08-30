// =============================
// AutoX.js 状态上传客户端（合并：隐私模式 + Release Notes）
// =============================

// ====== 配置管理 ======
var CONFIG_FILE = files.join(files.getSdcardPath(), "autoxjs_status_config.json");
var DEFAULT_ENV = {
    INGEST_URL: "Example##https://why.so.serious/api/ingest",
    API_TOKEN: "Example##A_Dissatisfaction_To_The_World",
    MACHINE_ID: "Example##leijun_yu7csn"
};
function loadConfig() {
    try {
        if (files.exists(CONFIG_FILE)) {
            var content = files.read(CONFIG_FILE);
            return JSON.parse(content);
        }
    } catch (e) { console.error("加载配置失败:", e); }
    return DEFAULT_ENV;
}
function saveConfig(config) {
    try {
        files.write(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (e) { console.error("保存配置失败:", e); return false; }
}
function validateConfig(config) {
    if (!config.INGEST_URL || !config.API_TOKEN || !config.MACHINE_ID) {
        return { valid: false, message: "请填写完整的配置信息" };
    }
    if (config.INGEST_URL.startsWith("Example##") ||
        config.API_TOKEN.startsWith("Example##") ||
        config.MACHINE_ID.startsWith("Example##")) {
        return { valid: false, message: "配置错误：请替换所有以 'Example##' 开头的示例值为实际配置" };
    }
    return { valid: true };
}
function showConfigDialog(currentConfig) {
    var newConfig = null;
    var dialog = dialogs.build({
        title: "配置设置",
        positive: "保存并启动",
        negative: "退出",
        neutral: "使用当前配置",
        autoDismiss: false,
        customView: <vertical padding="16">
            <text text="上传地址 (INGEST_URL):" textColor="#666666" textSize="14sp"/>
            <input id="url" text={currentConfig.INGEST_URL} singleLine="true" marginBottom="8"/>
            <text text="API Token:" textColor="#666666" textSize="14sp"/>
            <input id="token" text={currentConfig.API_TOKEN} singleLine="true" marginBottom="8"/>
            <text text="设备ID (MACHINE_ID):" textColor="#666666" textSize="14sp"/>
            <input id="machine" text={currentConfig.MACHINE_ID} singleLine="true"/>
            <text text="注意：不要使用以 'Example##' 开头的示例值" textColor="#ff0000" textSize="12sp" marginTop="8"/>
        </vertical>
    }).on("positive", function(dlg) {
        newConfig = {
            INGEST_URL: dlg.getCustomView().url.text(),
            API_TOKEN: dlg.getCustomView().token.text(),
            MACHINE_ID: dlg.getCustomView().machine.text()
        };
        var validation = validateConfig(newConfig);
        if (!validation.valid) { toast(validation.message); return; }
        if (saveConfig(newConfig)) { toast("配置已保存"); dlg.dismiss(); }
        else { toast("保存配置失败"); }
    }).on("negative", function(dlg) { newConfig = null; dlg.dismiss(); })
      .on("neutral",  function(dlg) { newConfig = currentConfig; dlg.dismiss(); })
      .show();
    while (dialog.isShowing()) sleep(100);
    return newConfig;
}
function initializeConfig() {
    var config = loadConfig();
    var validation = validateConfig(config);
    var configStatus = validation.valid ? "✅ 配置有效" : "❌ " + validation.message;
    var shouldModify = dialogs.confirm(
        "配置管理",
        "当前配置状态: " + configStatus + "\n" +
        "设备ID: " + config.MACHINE_ID + "\n" +
        "上传地址: " + config.INGEST_URL + "\n" +
        "API Token: " + (config.API_TOKEN ? "***" + config.API_TOKEN.slice(-6) : "未设置") +
        "\n是否要修改配置？"
    );
    if (shouldModify || !validation.valid) {
        config = showConfigDialog(config);
        if (!config) return null;
        validation = validateConfig(config);
        if (!validation.valid) { dialogs.alert("配置错误", validation.message + "脚本将退出。"); return null; }
    }
    return config;
}
var ENV = initializeConfig();
if (!ENV) { toast("配置未完成，脚本退出"); exit(); }

// ====== 版本与配置 ======
var VERSION_INFO = {
    LOCAL_VERSION: "1.6.0",
    REMOTE_VERSION_URL: "https://raw.githubusercontent.com/RewLight/foreground-monitor/refs/heads/autoxjs/VERSION",
    UPDATE_PAGE_URL: "https://github.com/RewLight/foreground-monitor/releases",
    // === 新增：GitHub API（latest release，用于获取发布说明） ===
    RELEASE_API_URL: "https://api.github.com/repos/RewLight/foreground-monitor/releases/latest"
};
var CONFIG = {
    CHECK_INTERVAL: 7000,
    FORCE_UPLOAD_INTERVAL: 15000,
    MANUAL_MODE_DURATION: 5 * 60 * 1000,
    MEDIA_PRIORITY: [
        "tv.danmaku.bilibilihd",
        "tv.danmaku.bilibili",
        "com.netease.cloudmusic",
        "com.tencent.qqmusic",
        "com.kugou.android"
    ],
    UPDATE_CHECK_INTERVAL: 24 * 60 * 60 * 1000
};
var lastUpdateCheckTime = 0;
var SHIZUKU_ALIVE = false;
var lastShizukuAlive = null;
try { SHIZUKU_ALIVE = !!shizuku && typeof shizuku === "function"; } catch(e){ SHIZUKU_ALIVE=false; }
var counters = { checked:0, success:0, failed:0 };
var lastState = { appName:"", lastUploadTime:0 };
var appNameCache = {};

// ====== 手动模式状态管理 ======
var manualMode = { active:false, text:"", startTime:0, endTime:0 };

// ====== 新增：隐私模式（不落盘，运行期可切换） ======
var privacyMode = { active:false }; // 开启后统一上报占位内容

// ====== 通知/广播 ======
var NOTIFICATION_ID = 1001;
var INPUT_NOTIFICATION_ID = 1002;
var notificationManager = null;
var startTime = new Date().getTime();
var PACKAGE_NAME = "com.rewlight.fmc.android";
var EXIT_ACTION = PACKAGE_NAME + ".EXIT_ACTION";
var MANUAL_UPDATE_ACTION = PACKAGE_NAME + ".MANUAL_UPDATE_ACTION";
var INPUT_SUBMIT_ACTION = PACKAGE_NAME + ".INPUT_SUBMIT_ACTION";
// === 新增：隐私模式广播 ===
var PRIVACY_TOGGLE_ACTION = PACKAGE_NAME + ".PRIVACY_TOGGLE_ACTION";

var exitReceiver=null, manualUpdateReceiver=null, inputReceiver=null, modeReceiver=null;
var TOGGLE_MODE_ACTION = PACKAGE_NAME + ".TOGGLE_MODE_ACTION";
var NOOP_ACTION = PACKAGE_NAME + ".NOOP_ACTION";
var manualPromptOpen = false;
var inputNotificationVisible = false;

// ====== 更新通知（保留） + 扩展 notes ======
function handleNewVersionAvailable(message, notes) {
    console.error("[更新] " + message + " - 脚本将退出。");
    cancelNotification();
    unregisterBroadcastReceivers();
    showUpdateNotification(message, notes);
    exit();
}
function showUpdateNotification(message, notes) {
    try {
        createNotificationChannel();
        var builder = device.sdkInt >= 26
            ? new android.app.Notification.Builder(context, "status_monitor")
            : new android.app.Notification.Builder(context);

        var openUrlIntent = new android.content.Intent(android.content.Intent.ACTION_VIEW);
        openUrlIntent.setData(android.net.Uri.parse(VERSION_INFO.UPDATE_PAGE_URL));
        var flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
        if (device.sdkInt >= 31) flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        var openUrlPendingIntent = android.app.PendingIntent.getActivity(context, 999, openUrlIntent, flags);

        builder.setContentTitle("FMCv1 • 有新版本")
               .setContentText(message)
               .setSmallIcon(android.R.drawable.stat_sys_download)
               .setAutoCancel(true)
               .setContentIntent(openUrlPendingIntent)
               .setOngoing(false);

        // 大文本显示发布说明（截断）
        var big = message;
        if (notes && notes.trim()) {
            var s = notes.trim();
            if (s.length > 1200) s = s.slice(0,1200) + "...";
            big = message + "\n\n" + s + "\n\n点击此通知前往更新页面。";
        }
        if (device.sdkInt >= 24) builder.setStyle(new android.app.Notification.BigTextStyle().bigText(big));

        var n = builder.build();
        if (!notificationManager) notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        notificationManager.notify(1003, n);
        console.log("已发送更新通知");
    } catch (e) { console.error("发送更新通知失败:", e); }
}
function createNotificationChannel() {
    if (device.sdkInt >= 26) {
        try {
            var manager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            var ch1 = new android.app.NotificationChannel("status_monitor", "状态监控", android.app.NotificationManager.IMPORTANCE_LOW);
            ch1.setDescription("显示状态监控运行信息"); ch1.enableLights(false); ch1.enableVibration(false); ch1.setSound(null,null);
            manager.createNotificationChannel(ch1);

            var ch2 = new android.app.NotificationChannel("input_channel", "输入通知", android.app.NotificationManager.IMPORTANCE_HIGH);
            ch2.setDescription("用于手动输入的通知"); ch2.enableLights(false); ch2.enableVibration(false); ch2.setSound(null,null);
            manager.createNotificationChannel(ch2);
        } catch(e){ console.error("创建通知渠道失败:", e); }
    }
}

// ====== 注册/注销广播 ======
function registerBroadcastReceivers() {
    try {
        exitReceiver = new android.content.BroadcastReceiver({
            onReceive: function(context, intent) {
                if (intent.getAction() === EXIT_ACTION) {
                    toast("停止状态监控");
                    threads.start(function(){ sleep(100); exit(); });
                }
            }
        });
        manualUpdateReceiver = new android.content.BroadcastReceiver({
            onReceive: function(context, intent) {
                if (intent.getAction() === MANUAL_UPDATE_ACTION) showInputNotification();
            }
        });
        inputReceiver = new android.content.BroadcastReceiver({
            onReceive: function(context, intent) {
                try {
                    if (intent.getAction() === INPUT_SUBMIT_ACTION) {
                        var bundle = android.app.RemoteInput.getResultsFromIntent(intent);
                        var inputText = null;
                        if (bundle) {
                            inputText = bundle.getCharSequence("input_text");
                            if (inputText) inputText = inputText.toString();
                        }
                        if (inputText && inputText.trim()) {
                            activateManualMode(inputText.trim());
                            cancelInputNotification();
                            toast("手动模式已激活: " + inputText);
                        } else {
                            toast("输入内容为空"); cancelInputNotification();
                        }
                    } else if (intent.getAction() === "cancel_input") {
                        cancelInputNotification(); toast("已取消手动输入");
                    }
                } catch (e) { console.error("处理输入广播时出错:", e); toast("处理输入时出错: " + e.message); cancelInputNotification(); }
            }
        });

        var exitFilter   = new android.content.IntentFilter(EXIT_ACTION);
        var manualFilter = new android.content.IntentFilter(MANUAL_UPDATE_ACTION);
        var inputFilter  = new android.content.IntentFilter(INPUT_SUBMIT_ACTION);
        var cancelFilter = new android.content.IntentFilter("cancel_input");

        if (device.sdkInt >= 31) {
            context.registerReceiver(exitReceiver,   exitFilter,   android.content.Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(manualUpdateReceiver, manualFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(inputReceiver,  inputFilter,  android.content.Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(inputReceiver,  cancelFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(exitReceiver,   exitFilter);
            context.registerReceiver(manualUpdateReceiver, manualFilter);
            context.registerReceiver(inputReceiver,  inputFilter);
            context.registerReceiver(inputReceiver,  cancelFilter);
        }

        // 手动/NOOP + === 新增：隐私模式切换 ===
        modeReceiver = new android.content.BroadcastReceiver({
            onReceive: function(ctx, intent) {
                var act = intent.getAction();
                if (act === TOGGLE_MODE_ACTION) {
                    manualMode.active = false; manualMode.text = "";
                    toast("已切回自动更新"); updateNotification();
                } else if (act === NOOP_ACTION) {
                    toast("手动更新进行中，请先在输入通知中 提交/取消");
                } else if (act === PRIVACY_TOGGLE_ACTION) {
                    privacyMode.active = !privacyMode.active;
                    toast(privacyMode.active ? "隐私模式已开启" : "隐私模式已关闭");
                    updateNotification();
                }
            }
        });
        var modeFilter = new android.content.IntentFilter();
        modeFilter.addAction(TOGGLE_MODE_ACTION);
        modeFilter.addAction(NOOP_ACTION);
        modeFilter.addAction(PRIVACY_TOGGLE_ACTION);
        if (device.sdkInt >= 31) context.registerReceiver(modeReceiver, modeFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
        else context.registerReceiver(modeReceiver, modeFilter);
    } catch (e) { console.error("注册广播接收器失败:", e); }
}
function unregisterBroadcastReceivers() {
    try {
        if (exitReceiver) { context.unregisterReceiver(exitReceiver); exitReceiver=null; }
        if (manualUpdateReceiver) { context.unregisterReceiver(manualUpdateReceiver); manualUpdateReceiver=null; }
        if (inputReceiver) { context.unregisterReceiver(inputReceiver); inputReceiver=null; }
        if (modeReceiver) { context.unregisterReceiver(modeReceiver); modeReceiver=null; }
    } catch (e) { console.error("注销广播接收器失败:", e); }
}

// ====== 手动模式 ======
function activateManualMode(text) {
    var now = Date.now();
    manualMode.active = true; manualMode.text = text;
    manualMode.startTime = now; manualMode.endTime = now + CONFIG.MANUAL_MODE_DURATION;
    console.log("手动模式激活:", text, "持续到:", new Date(manualMode.endTime).toLocaleString());
}
function checkManualMode() {
    if (manualMode.active && Date.now() > manualMode.endTime) {
        manualMode.active = false; manualMode.text = "";
        console.log("手动模式已结束"); toast("手动模式已结束，恢复自动检测");
    }
}

// ====== 输入通知 ======
function showInputNotification() {
    manualPromptOpen = true;
    try {
        createNotificationChannel();
        var builder = device.sdkInt >= 26
            ? new android.app.Notification.Builder(context, "input_channel")
            : new android.app.Notification.Builder(context);

        var remoteInput = new android.app.RemoteInput.Builder("input_text").setLabel("输入要上传的内容").build();
        var submitIntent = new android.content.Intent(INPUT_SUBMIT_ACTION);
        submitIntent.setPackage(context.getPackageName());
        var flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT; if (device.sdkInt >= 31) flags |= android.app.PendingIntent.FLAG_MUTABLE;
        var submitPI = android.app.PendingIntent.getBroadcast(context, 2, submitIntent, flags);

        var action = new android.app.Notification.Action.Builder(android.R.drawable.ic_menu_edit, "提交", submitPI)
            .addRemoteInput(remoteInput).build();

        var cancelIntent = new android.content.Intent("cancel_input"); cancelIntent.setPackage(context.getPackageName());
        var cancelPI = android.app.PendingIntent.getBroadcast(context, 3, cancelIntent, flags);
        var cancelAction = new android.app.Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel, "取消", cancelPI).build();

        builder.setContentTitle("手动更新模式")
               .setContentText("请输入要上传的内容（5分钟内有效）")
               .setSmallIcon(android.R.drawable.ic_menu_edit)
               .addAction(action).addAction(cancelAction)
               .setAutoCancel(false).setOngoing(true)
               .setPriority(android.app.Notification.PRIORITY_HIGH);

        var n = builder.build();
        if (!notificationManager) notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        notificationManager.notify(INPUT_NOTIFICATION_ID, n);
        updateNotification();
    } catch (e) {
        console.error("显示输入通知失败:", e);
        threads.start(function(){
            try {
                var input = dialogs.rawInput("手动更新", "请输入要上传的内容：");
                if (input && input.trim()) { activateManualMode(input.trim()); toast("手动模式已激活: " + input); }
            } catch (err) { console.error("对话框降级处理失败:", err); toast("无法显示输入界面"); }
        });
    }
}
function cancelInputNotification() {
    try {
        if (notificationManager) notificationManager.cancel(INPUT_NOTIFICATION_ID);
        manualPromptOpen = false;
        updateNotification();
    } catch (e) { console.error("取消输入通知失败:", e); }
}

// ====== Shizuku 通知（保留） ======
function notifyShizukuChanged(enabled) {
    try {
        createNotificationChannel();
        var builder = device.sdkInt >= 26
            ? new android.app.Notification.Builder(context, "status_monitor")
            : new android.app.Notification.Builder(context);
        builder.setContentTitle("FMCv1 · Shizuku 状态变化")
               .setContentText(enabled ? "Shizuku 可用，已启用相关能力" : "Shizuku 不可用，已停用相关能力")
               .setSmallIcon(android.R.drawable.ic_dialog_info)
               .setAutoCancel(true).setOngoing(false)
               .setPriority(android.app.Notification.PRIORITY_LOW);
        if (!notificationManager) notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        notificationManager.notify(10101 + (enabled ? 1 : 0), builder.build());
    } catch (e) { console.error("发送 Shizuku 状态通知失败:", e); }
}

// ====== 顶部常驻通知（加入隐私按钮与状态） ======
function showNotification(title, content) {
    try {
        createNotificationChannel();
        var builder = device.sdkInt >= 26
            ? new android.app.Notification.Builder(context, "status_monitor")
            : new android.app.Notification.Builder(context);

        var launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) {
            launchIntent = new android.content.Intent(); launchIntent.setPackage(context.getPackageName()); launchIntent.setFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        }
        var flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT; if (device.sdkInt >= 31) flags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        var pendingIntent = android.app.PendingIntent.getActivity(context, 0, launchIntent, flags);

        builder.setContentTitle(title).setContentText(content).setSmallIcon(android.R.drawable.ic_menu_info_details)
               .setOngoing(true).setContentIntent(pendingIntent).setAutoCancel(false);

        if (device.sdkInt >= 16) {
            try {
                // 手动按钮（动态）
                var manualLabel, manualPI;
                var flagsDyn = flags;
                if (manualPromptOpen) {
                    manualLabel = "⏳手动更新（进行中）";
                    var noopIntent = new android.content.Intent(NOOP_ACTION); noopIntent.setPackage(context.getPackageName());
                    manualPI = android.app.PendingIntent.getBroadcast(context, 11, noopIntent, flagsDyn);
                } else if (manualMode.active) {
                    manualLabel = "🤖回到自动更新";
                    var toggleIntent = new android.content.Intent(TOGGLE_MODE_ACTION); toggleIntent.setPackage(context.getPackageName());
                    manualPI = android.app.PendingIntent.getBroadcast(context, 12, toggleIntent, flagsDyn);
                } else {
                    manualLabel = "🛠️进入手动更新";
                    var manualIntent = new android.content.Intent(MANUAL_UPDATE_ACTION); manualIntent.setPackage(context.getPackageName());
                    manualPI = android.app.PendingIntent.getBroadcast(context, 1, manualIntent, flagsDyn);
                }
                builder.addAction(android.R.drawable.ic_menu_edit, manualLabel, manualPI);

                // === 新增：隐私模式按钮 ===
                var privacyLabel = privacyMode.active ? "🙈关闭隐私" : "🙈开启隐私";
                var pIntent = new android.content.Intent(PRIVACY_TOGGLE_ACTION); pIntent.setPackage(context.getPackageName());
                var pPI = android.app.PendingIntent.getBroadcast(context, 21, pIntent, flagsDyn);
                builder.addAction(android.R.drawable.ic_lock_lock, privacyLabel, pPI);

                // 退出按钮
                if (exitReceiver != null) {
                    var exitIntent = new android.content.Intent(EXIT_ACTION); exitIntent.setPackage(context.getPackageName());
                    var exitPI = android.app.PendingIntent.getBroadcast(context, 2, exitIntent, flagsDyn);
                    builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "退出", exitPI);
                }
            } catch (e) { console.error("添加通知按钮失败:", e); }
            builder.setPriority(android.app.Notification.PRIORITY_LOW);
        }
        if (device.sdkInt >= 24) builder.setStyle(new android.app.Notification.BigTextStyle().bigText(content));

        var n = builder.build();
        if (!notificationManager) notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        notificationManager.notify(NOTIFICATION_ID, n);
    } catch (e) { console.error("显示通知失败:", e); }
}
function updateNotification() {
    var runTime = Math.floor((new Date().getTime() - startTime) / 1000);
    var hours = Math.floor(runTime / 3600);
    var minutes = Math.floor((runTime % 3600) / 60);
    var seconds = runTime % 60;
    var timeStr = hours>0 ? (hours+"小时"+minutes+"分钟") : (minutes>0 ? (minutes+"分钟"+seconds+"秒") : (seconds+"秒"));
    var modeStatus = manualMode.active ? (" | 手动模式: " + Math.max(0, Math.ceil((manualMode.endTime - Date.now())/1000)) + "秒") : "";
    var privacyStatus = privacyMode.active ? " | 隐私: ON" : " | 隐私: OFF";
    var content = "运行时间: " + timeStr + " | 检测: " + counters.checked + "次 | 成功: " + counters.success + "次" + modeStatus + privacyStatus + " | Shizuku: " + (SHIZUKU_ALIVE ? "可用" : "不可用");
    showNotification("FMCv1 运行中", content);
}
function cancelNotification() {
    try {
        if (notificationManager) {
            notificationManager.cancel(NOTIFICATION_ID);
            notificationManager.cancel(INPUT_NOTIFICATION_ID);
            notificationManager.cancel(1003);
        }
    } catch (e) { console.error("取消通知失败:", e); }
}

// ====== 工具函数 ======
function MediaSession(packageName, state, title, author) {
    this.package = packageName; this.state = state; this.title = title; this.author = author; this.hasActiveAndPlaying = false;
}
function compareSemver(a,b){ a=a||"0.0.0"; b=b||"0.0.0"; var as=a.replace(/^v/i,"").split("."), bs=b.replace(/^v/i,"").split("."), len=Math.max(as.length,bs.length);
    for (var i=0;i<len;i++){ var ai=parseInt(as[i]||0), bi=parseInt(bs[i]||0); if (ai<bi) return -1; if (ai>bi) return 1; } return 0; }
function fetchRemoteVersion() {
    try { var res = http.get(VERSION_INFO.REMOTE_VERSION_URL);
        if (res && res.statusCode === 200 && res.body) return res.body.string().split(/\r?\n/)[0].trim();
    } catch (e) {}
    return null;
}
// === 新增：抓取 GitHub 最新发布说明 ===
function fetchLatestReleaseNotes() {
    try {
        var res = http.get(VERSION_INFO.RELEASE_API_URL, { headers: { "User-Agent": "FMCv1/AutoX" }, timeout: 5000 });
        if (res && res.statusCode === 200 && res.body) {
            var j = res.body.json();
            return { tag: j.tag_name || "", notes: (j.body || "").toString() };
        }
    } catch(e){ console.warn("获取 release notes 失败:", e); }
    return { tag:"", notes:"" };
}

// ====== 媒体检测（保留） ======
function parseMediaSessions(){ /* 原实现不变 */ 
    if (!SHIZUKU_ALIVE) return [];
    try {
        var output = shizuku("dumpsys media_session"); if (!output) return [];
        var blocks = String(output).split(/(?=ownerPid=\d+)/), sessions=[];
        for (var i=0;i<blocks.length;i++){
            var block=blocks[i]; if (block.indexOf("active=true")===-1) continue;
            var pkgMatch=block.match(/package=([\w\.]+)/); if (!pkgMatch) continue; var pkg=pkgMatch[1];
            var stateMatch=block.match(/state=PlaybackState\s*\{state=(\w+)/); var state=stateMatch?stateMatch[1]:null;
            var descMatch=block.match(/metadata:[\s\S]*?description=(.*?)(, null|\n|$)/);
            var title=null, author=null;
            if (descMatch){ var desc=descMatch[1].trim().replace(/^["']|["']$/g,""); if (desc && desc.toLowerCase()!=="null"){
                var parts=desc.split(",").map(function(p){return p.trim();});
                title=parts[0]||null; author=parts[1]||null; if (title && title.toLowerCase()==="null") title=null; if (author && author.toLowerCase()==="null") author=null;
            }}
            var session=new MediaSession(pkg,state,title,author);
            if (block.indexOf("state=PLAYING")!==-1) session.hasActiveAndPlaying=true;
            sessions.push(session);
        }
        return sessions;
    } catch(e){ return []; }
}
function selectActiveMedia(sessions){
    for (var i=0;i<CONFIG.MEDIA_PRIORITY.length;i++){
        var pkg=CONFIG.MEDIA_PRIORITY[i];
        for (var j=0;j<sessions.length;j++){ var s=sessions[j]; if (s.package===pkg && s.hasActiveAndPlaying) return s; }
    } return null;
}
function formatMediaTitle(session){
    var t=session.title||"", a=session.author||"";
    if (session.package==="tv.danmaku.bilibilihd") return "📺哔哩哔哩HD - " + t;
    if (session.package==="tv.danmaku.bilibili")   return "📺哔哩哔哩 - " + t;
    if (session.package==="com.netease.cloudmusic") return ("🎶网易云音乐 - " + t + " " + a).trim();
    if (session.package==="com.tencent.qqmusic")    return ("🎵QQ音乐 - " + t + " " + a).trim();
    if (session.package==="com.kugou.android")      return ("🎵酷狗音乐 - " + t + " " + a).trim();
    return ("🎵" + session.package + " - " + t).trim();
}

// ====== 前台应用 ======
function getForegroundApp() {
    var pkg="unknown"; try { pkg=currentPackage(); } catch(e){}
    if (pkg in appNameCache) return { label: appNameCache[pkg]+" - "+pkg, package:pkg };
    try {
        var name = app.getAppName(pkg) || pkg.split(".").pop();
        appNameCache[pkg]=name; return { label: name+" - "+pkg, package:pkg };
    } catch(e){
        var fallback=pkg.split(".").pop(); appNameCache[pkg]=fallback; return { label:fallback+" - "+pkg, package:pkg };
    }
}

// ====== 上传 ======
function uploadStatus(payload) {
    try {
        payload.os = "Android";
        payload.version = VERSION_INFO.LOCAL_VERSION;
        var res = http.postJson(ENV.INGEST_URL, payload, {
            headers: { Authorization: "Bearer " + ENV.API_TOKEN, "Content-Type": "application/json" },
            timeout: 5000
        });
        if (res && res.statusCode === 200) {
            counters.success++; console.log("[✓] 上传成功:", payload.app_name);
        } else if (res && res.statusCode === 426) {
            var msg = "服务器要求升级客户端。";
            if (res.body) {
                try { var bodyJson = res.body.json(); if (bodyJson && bodyJson.message) msg = bodyJson.message; }
                catch(e){ msg = res.body.string() || msg; }
            }
            // 获取 notes 并一起提示
            var info = fetchLatestReleaseNotes();
            handleNewVersionAvailable("服务器响应 426: " + msg, info.notes);
        } else {
            counters.failed++; var msg2 = res && res.body ? res.body.string() : "";
            console.warn("[×] 上传失败:", res && res.statusCode, msg2);
        }
    } catch(e) { counters.failed++; console.error("[×] 上传异常:", e); }
}

// ====== 更新检查 ======
function fetchRemoteVersion() {
    try {
        var res = http.get(VERSION_INFO.REMOTE_VERSION_URL);
        if (res && res.statusCode === 200 && res.body) return res.body.string().split(/\r?\n/)[0].trim();
    } catch(e){}
    return null;
}
function checkForUpdates() {
    try {
        var remote = fetchRemoteVersion();
        if (!remote) { console.log("无法获取远程版本信息"); return; }
        if (compareSemver(VERSION_INFO.LOCAL_VERSION, remote) < 0) {
            var msg = "发现新版本：" + remote + "（当前：" + VERSION_INFO.LOCAL_VERSION + "）";
            console.log("[更新] " + msg);
            var info = fetchLatestReleaseNotes();
            handleNewVersionAvailable(msg, info.notes);
        } else {
            console.log("当前已是最新版本 (" + VERSION_INFO.LOCAL_VERSION + ")");
        }
    } catch(e){ console.error("检查更新过程中出错:", e); }
}

// ====== 初始化 & 主循环 ======
function checkShizukuStatus(){ try { return !!shizuku && typeof shizuku === "function" && shizuku.isAlive(); } catch(e){ return false; } }
function enableAccessibilityViaShizuku(){ shizuku.openAccessibility(); sleep(4000); }

function initialize() {
    var validation = validateConfig(ENV);
    if (!validation.valid) throw new Error(validation.message);

    // 启动时检查版本（带 notes）
    try {
        var remote = fetchRemoteVersion();
        if (remote && compareSemver(VERSION_INFO.LOCAL_VERSION, remote) < 0) {
            var msg = "发现新版本：" + remote + "（当前：" + VERSION_INFO.LOCAL_VERSION + "）";
            var info = fetchLatestReleaseNotes();
            var shortNotes = info.notes && info.notes.trim() ? ("\n\n更新内容：\n" + (info.notes.length>1200?info.notes.slice(0,1200)+"...":info.notes)) : "";
            var go = dialogs.confirm("发现新版本", msg + shortNotes + "\n\n是否前往更新页面？");
            if (go) app.openUrl(VERSION_INFO.UPDATE_PAGE_URL);
            cancelNotification(); unregisterBroadcastReceivers(); exit();
        } else if(remote) { console.log("启动时检查：当前已是最新版本 ("+VERSION_INFO.LOCAL_VERSION+")"); }
        else { console.log("启动时检查：无法获取远程版本信息"); }
    } catch(e){ console.warn("启动时版本检查失败:", e); }

    if (SHIZUKU_ALIVE && auto.service == null) { console.log("Shizuku 可用，尝试授权..."); try{ enableAccessibilityViaShizuku(); }catch(e){} }
    if (auto.service == null) throw new Error("无障碍服务未授予，无法运行脚本");

    registerBroadcastReceivers();
    showNotification("FMCv1 运行中", "正在启动...");
    console.log("✅ 状态监听器启动完成");
    console.log("🔋 当前配置:"); console.log("  - 设备ID:", ENV.MACHINE_ID);
    console.log("  - 上传地址:", ENV.INGEST_URL); console.log("  - API Token:", "***" + ENV.API_TOKEN.slice(-6));
    console.log("  - 客户端版本:", VERSION_INFO.LOCAL_VERSION);
}

function main() {
    var notificationUpdateCounter = 0;
    while (true) {
        try {
            counters.checked++;
            SHIZUKU_ALIVE = checkShizukuStatus();
            if (lastShizukuAlive === null) lastShizukuAlive = SHIZUKU_ALIVE;
            else if (lastShizukuAlive !== SHIZUKU_ALIVE) {
                if (SHIZUKU_ALIVE) { try { enableAccessibilityViaShizuku(); } catch(e){} notifyShizukuChanged(true); }
                else { notifyShizukuChanged(false); }
                lastShizukuAlive = SHIZUKUK_ALIVE; // 小拼写修正：若有报错请改为 SHIZUKU_ALIVE
                updateNotification();
            }

            checkManualMode();

            var appLabel, appPkg;
            if (privacyMode.active) {
                // 隐私优先：统一占位
                appLabel = "🙈 隐私模式";
                appPkg = "private_mode";
            } else if (manualMode.active) {
                appLabel = "📝手动: " + manualMode.text;
                appPkg = "manual_input";
            } else {
                var sessions = parseMediaSessions();
                var activeMedia = selectActiveMedia(sessions);
                if (activeMedia) { appLabel = formatMediaTitle(activeMedia); appPkg = activeMedia.package; }
                else { var fg = getForegroundApp(); appLabel = fg.label; appPkg = fg.package; }
            }

            var now = Date.now();
            var shouldUpload = appLabel !== lastState.appName || (now - lastState.lastUploadTime >= CONFIG.FORCE_UPLOAD_INTERVAL);
            if (shouldUpload) {
                if (privacyMode.active) {
                    uploadStatus({ machine: ENV.MACHINE_ID, window_title: "TA现在不想给你看QAQ", app_name: "private mode" });
                } else {
                    uploadStatus({ machine: ENV.MACHINE_ID, window_title: appLabel, app_name: appLabel });
                }
                lastState.appName = appLabel; lastState.lastUploadTime = now;
            }

            if (now - lastUpdateCheckTime >= CONFIG.UPDATE_CHECK_INTERVAL) {
                console.log("开始检查更新...");
                threads.start(function(){ checkForUpdates(); });
                lastUpdateCheckTime = now;
            }

            notificationUpdateCounter++;
            if (notificationUpdateCounter >= 5) { updateNotification(); notificationUpdateCounter = 0; }
        } catch (e) { console.error("主循环异常:", e); }
        sleep(CONFIG.CHECK_INTERVAL);
    }
}

// ====== 退出处理 ======
events.on("exit", function() {
    console.log("脚本退出，清理资源...");
    cancelNotification();
    unregisterBroadcastReceivers();
});

// ====== 启动入口 ======
try { initialize(); main(); }
catch (e) {
    toast("启动失败: " + e.message);
    console.error("❌ 启动失败:", e);
    cancelNotification(); exit();
}

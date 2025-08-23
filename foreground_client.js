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
        return {
            valid: false,
            message: "请填写完整的配置信息"
        };
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

    return {
        valid: true
    };
}

// 显示配置对话框
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
        newConfig = null;
        dialog.dismiss();
    }).on("neutral", function(dialog) {
        newConfig = currentConfig;
        dialog.dismiss();
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
        "API Token: " + (config.API_TOKEN ? "***" + config.API_TOKEN.slice(-6) : "未设置") + "\n\n" +
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
    LOCAL_VERSION: "1.4.0",
    REMOTE_VERSION_URL: "https://raw.githubusercontent.com/RewLight/foreground-monitor/refs/heads/autoxjs/VERSION",
    UPDATE_PAGE_URL: "https://github.com/RewLight/foreground-monitor/tree/autoxjs",
    DO_CHECK_UPDATE: true
};

var CONFIG = {
    CHECK_INTERVAL: 7000, // 每次检测间隔(ms)
    FORCE_UPLOAD_INTERVAL: 15000, // 强制上传时间(ms)，即使未变化
    MANUAL_MODE_DURATION: 5 * 60 * 1000, // 手动模式持续时间(5分钟)
    MEDIA_PRIORITY: [
        "tv.danmaku.bilibilihd",
        "tv.danmaku.bilibili",
        "com.netease.cloudmusic",
        "com.tencent.qqmusic",
        "com.kugou.android"
    ]
};

var SHIZUKU_ALIVE = false;
var lastShizukuAlive = null;
try {
    SHIZUKU_ALIVE = !!shizuku && typeof shizuku === "function";
} catch (e) {
    SHIZUKU_ALIVE = false;
}

var counters = {
    checked: 0,
    success: 0,
    failed: 0
};
var lastState = {
    appName: "",
    lastUploadTime: 0
};
var appNameCache = {};

// ====== 手动模式状态管理 ======
var manualMode = {
    active: false,
    text: "",
    startTime: 0,
    endTime: 0
};

// ====== 通知管理 ======
var NOTIFICATION_ID = 1001;
var INPUT_NOTIFICATION_ID = 1002;
var notificationManager = null;
var startTime = new Date().getTime();

// 添加广播接收器相关常量 - 使用完整包名
var PACKAGE_NAME = "com.rewlight.fmc.android"; // 应用包名
var EXIT_ACTION = PACKAGE_NAME + ".EXIT_ACTION";
var MANUAL_UPDATE_ACTION = PACKAGE_NAME + ".MANUAL_UPDATE_ACTION";
var INPUT_SUBMIT_ACTION = PACKAGE_NAME + ".INPUT_SUBMIT_ACTION";
var exitReceiver = null;
var manualUpdateReceiver = null;
var inputReceiver = null;
// —— 新增：运行时标志 & 广播 —— 
var TOGGLE_MODE_ACTION = PACKAGE_NAME + ".TOGGLE_MODE_ACTION"; // 手动<->自动
var NOOP_ACTION = PACKAGE_NAME + ".NOOP_ACTION"; // 禁用按钮占位
var manualPromptOpen = false; // 是否正在显示手动更新输入通知
var modeReceiver = null; // 模式切换/NOOP 接收器

function createNotificationChannel() {
    if (device.sdkInt >= 26) {
        try {
            var channelId = "status_monitor";
            var channelName = "状态监控";
            var importance = android.app.NotificationManager.IMPORTANCE_LOW;

            var channel = new android.app.NotificationChannel(channelId, channelName, importance);
            channel.setDescription("显示状态监控运行信息");
            channel.enableLights(false);
            channel.enableVibration(false);
            channel.setSound(null, null);

            var manager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
            manager.createNotificationChannel(channel);

            // 创建输入通知渠道
            var inputChannelId = "input_channel";
            var inputChannelName = "输入通知";
            var inputImportance = android.app.NotificationManager.IMPORTANCE_HIGH;

            var inputChannel = new android.app.NotificationChannel(inputChannelId, inputChannelName, inputImportance);
            inputChannel.setDescription("用于手动输入的通知");
            inputChannel.enableLights(false);
            inputChannel.enableVibration(false);
            inputChannel.setSound(null, null);

            manager.createNotificationChannel(inputChannel);
        } catch (e) {
            console.error("创建通知渠道失败:", e);
        }
    }
}

// 注册所有广播接收器
function registerBroadcastReceivers() {
    try {
        // 退出接收器
        exitReceiver = new android.content.BroadcastReceiver({
            onReceive: function(context, intent) {
                if (intent.getAction() === EXIT_ACTION) {
                    toast("停止状态监控");
                    threads.start(function() {
                        sleep(100);
                        exit();
                    });
                }
            }
        });

        // 手动更新接收器
        manualUpdateReceiver = new android.content.BroadcastReceiver({
            onReceive: function(context, intent) {
                if (intent.getAction() === MANUAL_UPDATE_ACTION) {
                    showInputNotification();
                }
            }
        });

        // 输入提交接收器
        inputReceiver = new android.content.BroadcastReceiver({
            onReceive: function(context, intent) {
                try {
                    console.log("收到广播:", intent.getAction());

                    if (intent.getAction() === INPUT_SUBMIT_ACTION) {
                        // 从 RemoteInput 获取输入文本
                        var bundle = android.app.RemoteInput.getResultsFromIntent(intent);
                        var inputText = null;

                        if (bundle) {
                            inputText = bundle.getCharSequence("input_text");
                            if (inputText) {
                                inputText = inputText.toString();
                            }
                        }

                        console.log("提取的输入文本:", inputText);

                        if (inputText && inputText.trim()) {
                            activateManualMode(inputText.trim());
                            cancelInputNotification();
                            toast("手动模式已激活: " + inputText);
                        } else {
                            toast("输入内容为空");
                            cancelInputNotification();
                        }
                    } else if (intent.getAction() === "cancel_input") {
                        cancelInputNotification();
                        toast("已取消手动输入");
                    }
                } catch (e) {
                    console.error("处理输入广播时出错:", e);
                    toast("处理输入时出错: " + e.message);
                    cancelInputNotification();
                }
            }
        });

        var exitFilter = new android.content.IntentFilter(EXIT_ACTION);
        var manualFilter = new android.content.IntentFilter(MANUAL_UPDATE_ACTION);
        var inputFilter = new android.content.IntentFilter(INPUT_SUBMIT_ACTION);
        var cancelFilter = new android.content.IntentFilter("cancel_input");

        // Android 12+ 需要明确指定 RECEIVER_NOT_EXPORTED 标志
        if (device.sdkInt >= 31) {
            context.registerReceiver(exitReceiver, exitFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(manualUpdateReceiver, manualFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(inputReceiver, inputFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
            context.registerReceiver(inputReceiver, cancelFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(exitReceiver, exitFilter);
            context.registerReceiver(manualUpdateReceiver, manualFilter);
            context.registerReceiver(inputReceiver, inputFilter);
            context.registerReceiver(inputReceiver, cancelFilter);
        }

        // 模式切换/NOOP 接收器
        modeReceiver = new android.content.BroadcastReceiver({
            onReceive: function(ctx, intent) {
                var act = intent.getAction();
                if (act === TOGGLE_MODE_ACTION) {
                    manualMode.active = false;
                    manualMode.text = "";
                    toast("已切回自动更新");
                    updateNotification();
                } else if (act === NOOP_ACTION) {
                    toast("手动更新进行中，请先在输入通知中 提交/取消");
                }
            }
        });

        var modeFilter = new android.content.IntentFilter();
        modeFilter.addAction(TOGGLE_MODE_ACTION);
        modeFilter.addAction(NOOP_ACTION);
        if (device.sdkInt >= 31) {
            context.registerReceiver(modeReceiver, modeFilter, android.content.Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(modeReceiver, modeFilter);
        }
    } catch (e) {
        console.error("注册广播接收器失败:", e);
    }
}

// 注销广播接收器
function unregisterBroadcastReceivers() {
    try {
        if (exitReceiver) {
            context.unregisterReceiver(exitReceiver);
            exitReceiver = null;
        }
        if (manualUpdateReceiver) {
            context.unregisterReceiver(manualUpdateReceiver);
            manualUpdateReceiver = null;
        }
        if (inputReceiver) {
            context.unregisterReceiver(inputReceiver);
            inputReceiver = null;
        }
        if (modeReceiver) {
            context.unregisterReceiver(modeReceiver);
            modeReceiver = null;
        }
    } catch (e) {
        console.error("注销广播接收器失败:", e);
    }
}

// 激活手动模式
function activateManualMode(text) {
    var now = Date.now();
    manualMode.active = true;
    manualMode.text = text;
    manualMode.startTime = now;
    manualMode.endTime = now + CONFIG.MANUAL_MODE_DURATION;

    console.log("手动模式激活:", text, "持续到:", new Date(manualMode.endTime).toLocaleString());
}

// 检查手动模式是否仍然有效
function checkManualMode() {
    if (manualMode.active && Date.now() > manualMode.endTime) {
        manualMode.active = false;
        manualMode.text = "";
        console.log("手动模式已结束");
        toast("手动模式已结束，恢复自动检测");
    }
}

// 显示输入通知
function showInputNotification() {
    manualPromptOpen = true;
    try {
        // 先隐藏原始通知
        //if (notificationManager) {
        //    notificationManager.cancel(NOTIFICATION_ID);
        //}

        createNotificationChannel();

        var builder;
        if (device.sdkInt >= 26) {
            builder = new android.app.Notification.Builder(context, "input_channel");
        } else {
            builder = new android.app.Notification.Builder(context);
        }

        // 创建远程输入
        var remoteInput = new android.app.RemoteInput.Builder("input_text")
            .setLabel("输入要上传的内容")
            .build();

        // 创建提交意图
        var submitIntent = new android.content.Intent(INPUT_SUBMIT_ACTION);
        submitIntent.setPackage(context.getPackageName());

        var pendingIntentFlags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
        if (device.sdkInt >= 31) {
            pendingIntentFlags |= android.app.PendingIntent.FLAG_MUTABLE;
        }

        var submitPendingIntent = android.app.PendingIntent.getBroadcast(
            context,
            2,
            submitIntent,
            pendingIntentFlags
        );

        // 创建带输入框的操作
        var action = new android.app.Notification.Action.Builder(
            android.R.drawable.ic_menu_edit,
            "提交",
            submitPendingIntent
        ).addRemoteInput(remoteInput).build();

        // 添加取消按钮
        var cancelIntent = new android.content.Intent();
        cancelIntent.setAction("cancel_input");
        cancelIntent.setPackage(context.getPackageName());

        var cancelPendingIntent = android.app.PendingIntent.getBroadcast(
            context,
            3,
            cancelIntent,
            pendingIntentFlags
        );

        var cancelAction = new android.app.Notification.Action.Builder(
            android.R.drawable.ic_menu_close_clear_cancel,
            "取消",
            cancelPendingIntent
        ).build();

        builder.setContentTitle("手动更新模式")
            .setContentText("请输入要上传的内容（5分钟内有效）")
            .setSmallIcon(android.R.drawable.ic_menu_edit)
            .addAction(action)
            .addAction(cancelAction)
            .setAutoCancel(false)
            .setOngoing(true)
            .setPriority(android.app.Notification.PRIORITY_HIGH);

        var notification = builder.build();

        if (!notificationManager) {
            notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        }

        notificationManager.notify(INPUT_NOTIFICATION_ID, notification);

        updateNotification();

    } catch (e) {
        console.error("显示输入通知失败:", e);
        // 降级处理：使用对话框
        threads.start(function() {
            try {
                var input = dialogs.rawInput("手动更新", "请输入要上传的内容：");
                if (input && input.trim()) {
                    activateManualMode(input.trim());
                    toast("手动模式已激活: " + input);
                }
            } catch (dialogError) {
                console.error("对话框降级处理失败:", dialogError);
                toast("无法显示输入界面");
            }
        });
    }
}

// 取消输入通知
function cancelInputNotification() {
    try {
        if (notificationManager) {
            notificationManager.cancel(INPUT_NOTIFICATION_ID);
        }
        manualPromptOpen = false;
        // 恢复显示原始通知
        updateNotification();
    } catch (e) {
        console.error("取消输入通知失败:", e);
    }
}

function notifyShizukuChanged(enabled) {
    try {
        createNotificationChannel();
        var builder;
        if (device.sdkInt >= 26) {
            builder = new android.app.Notification.Builder(context, "status_monitor");
        } else {
            builder = new android.app.Notification.Builder(context);
        }
        builder.setContentTitle("FMCv1 · Shizuku 状态变化")
            .setContentText(enabled ? "Shizuku 可用，已启用相关能力" : "Shizuku 不可用，已停用相关能力")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setOngoing(false)
            .setPriority(android.app.Notification.PRIORITY_LOW);

        if (!notificationManager) {
            notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        }
        notificationManager.notify(10101 + (enabled ? 1 : 0), builder.build());
    } catch (e) {
        console.error("发送 Shizuku 状态通知失败:", e);
    }
}

function showNotification(title, content) {
    try {
        createNotificationChannel();

        var builder;
        if (device.sdkInt >= 26) {
            builder = new android.app.Notification.Builder(context, "status_monitor");
        } else {
            builder = new android.app.Notification.Builder(context);
        }

        // 创建点击通知时的意图 - 打开主应用
        var launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) {
            launchIntent = new android.content.Intent();
            launchIntent.setPackage(context.getPackageName());
            launchIntent.setFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        var pendingIntentFlags = android.app.PendingIntent.FLAG_UPDATE_CURRENT;
        if (device.sdkInt >= 31) {
            pendingIntentFlags |= android.app.PendingIntent.FLAG_IMMUTABLE;
        }

        var pendingIntent = android.app.PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            pendingIntentFlags
        );

        builder.setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setOngoing(true) // 设置为常驻通知
            .setContentIntent(pendingIntent)
            .setAutoCancel(false);

        // 添加手动更新按钮（动态：禁用/手动/自动切换）
        if (device.sdkInt >= 16) {
            try {
                var manualLabel, manualPending;
                var pendingIntentFlagsDyn = pendingIntentFlags;

                if (manualPromptOpen) {
                    manualLabel = "⏳手动更新（进行中）";
                    var noopIntent = new android.content.Intent(NOOP_ACTION);
                    noopIntent.setPackage(context.getPackageName());
                    manualPending = android.app.PendingIntent.getBroadcast(
                        context, 11, noopIntent, pendingIntentFlagsDyn
                    );
                } else if (manualMode.active) {
                    manualLabel = "🤖回到自动更新";
                    var toggleIntent = new android.content.Intent(TOGGLE_MODE_ACTION);
                    toggleIntent.setPackage(context.getPackageName());
                    manualPending = android.app.PendingIntent.getBroadcast(
                        context, 12, toggleIntent, pendingIntentFlagsDyn
                    );
                } else {
                    manualLabel = "🛠️进入手动更新";
                    var manualIntent = new android.content.Intent(MANUAL_UPDATE_ACTION);
                    manualIntent.setPackage(context.getPackageName());
                    manualPending = android.app.PendingIntent.getBroadcast(
                        context, 1, manualIntent, pendingIntentFlagsDyn
                    );
                }

                builder.addAction(
                    android.R.drawable.ic_menu_edit,
                    manualLabel,
                    manualPending
                );

                // 只有在广播接收器注册成功的情况下才添加退出按钮
                if (exitReceiver != null) {
                    var exitIntent = new android.content.Intent(EXIT_ACTION);
                    exitIntent.setPackage(context.getPackageName());

                    var exitPendingIntent = android.app.PendingIntent.getBroadcast(
                        context,
                        2,
                        exitIntent,
                        pendingIntentFlagsDyn
                    );

                    builder.addAction(
                        android.R.drawable.ic_menu_close_clear_cancel,
                        "退出",
                        exitPendingIntent
                    );
                }
            } catch (e) {
                console.error("添加通知按钮失败:", e);
            }

            builder.setPriority(android.app.Notification.PRIORITY_LOW);
        }

        // 对于 Android 7.0+ 使用更现代的样式
        if (device.sdkInt >= 24) {
            builder.setStyle(new android.app.Notification.BigTextStyle()
                .bigText(content));
        }

        var notification = builder.build();

        if (!notificationManager) {
            notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        }

        notificationManager.notify(NOTIFICATION_ID, notification);
    } catch (e) {
        console.error("显示通知失败:", e);
    }
}

function updateNotification() {
    var runTime = Math.floor((new Date().getTime() - startTime) / 1000);
    var hours = Math.floor(runTime / 3600);
    var minutes = Math.floor((runTime % 3600) / 60);
    var seconds = runTime % 60;

    var timeStr = "";
    if (hours > 0) {
        timeStr = hours + "小时" + minutes + "分钟";
    } else if (minutes > 0) {
        timeStr = minutes + "分钟" + seconds + "秒";
    } else {
        timeStr = seconds + "秒";
    }

    var modeStatus = "";
    if (manualMode.active) {
        var remainingTime = Math.ceil((manualMode.endTime - Date.now()) / 1000);
        modeStatus = " | 手动模式: " + Math.max(0, remainingTime) + "秒";
    }

    var content = "运行时间: " + timeStr + " | " +
        "检测: " + counters.checked + "次 | " +
        "成功: " + counters.success + "次" + modeStatus + " | Shizuku: " + (SHIZUKU_ALIVE ? "可用" : "不可用");

    showNotification("FMCv1 运行中", content);
}

function cancelNotification() {
    try {
        if (notificationManager) {
            notificationManager.cancel(NOTIFICATION_ID);
            notificationManager.cancel(INPUT_NOTIFICATION_ID);
        }
    } catch (e) {
        console.error("取消通知失败:", e);
    }
}

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
        var ai = parseInt(as[i] || 0),
            bi = parseInt(bs[i] || 0);
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
            toast(msg);
            console.log(msg);
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
    sleep(4000);
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
            var title = null,
                author = null;
            if (descMatch) {
                var desc = descMatch[1].trim().replace(/^["']|["']$/g, "");
                if (desc && desc.toLowerCase() !== "null") {
                    var parts = desc.split(",").map(function(p) {
                        return p.trim();
                    });
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
    var t = session.title || "",
        a = session.author || "";
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
    try {
        pkg = currentPackage();
    } catch (e) {}
    if (pkg in appNameCache) return {
        label: appNameCache[pkg] + " - " + pkg,
        package: pkg
    };

    try {
        var name = app.getAppName(pkg) || pkg.split(".").pop();
        appNameCache[pkg] = name;
        return {
            label: name + " - " + pkg,
            package: pkg
        };
    } catch (e) {
        var fallback = pkg.split(".").pop();
        appNameCache[pkg] = fallback;
        return {
            label: fallback + " - " + pkg,
            package: pkg
        };
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

    // 注册广播接收器
    registerBroadcastReceivers();

    // 显示初始通知
    showNotification("FMCv1 运行中", "正在启动...");

    console.log("✅ 状态监听器启动完成");
    console.log("🔋 当前配置:");
    console.log("  - 设备ID:", ENV.MACHINE_ID);
    console.log("  - 上传地址:", ENV.INGEST_URL);
    console.log("  - API Token:", "***" + ENV.API_TOKEN.slice(-6));
}

function main() {
    var notificationUpdateCounter = 0;

    while (true) {
        try {
            counters.checked++;
            SHIZUKU_ALIVE = checkShizukuStatus();

            // —— Shizuku 可用性边沿检测（双向）——
            if (lastShizukuAlive === null) {
                lastShizukuAlive = SHIZUKU_ALIVE;
            } else if (lastShizukuAlive !== SHIZUKU_ALIVE) {
                if (SHIZUKU_ALIVE) {
                    try {
                        enableAccessibilityViaShizuku();
                    } catch (e) {}
                    notifyShizukuChanged(true);
                } else {
                    notifyShizukuChanged(false);
                }
                lastShizukuAlive = SHIZUKU_ALIVE;
                updateNotification();
            }

            // 检查手动模式状态
            checkManualMode();

            var appLabel, appPkg;

            // 如果手动模式激活，使用手动输入的文本
            if (manualMode.active) {
                appLabel = "📝手动: " + manualMode.text;
                appPkg = "manual_input";
            } else {
                // 正常检测逻辑
                var sessions = parseMediaSessions();
                var activeMedia = selectActiveMedia(sessions);

                if (activeMedia) {
                    appLabel = formatMediaTitle(activeMedia);
                    appPkg = activeMedia.package;
                } else {
                    var fg = getForegroundApp();
                    appLabel = fg.label;
                    appPkg = fg.package;
                }
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

            notificationUpdateCounter++;
            if (notificationUpdateCounter >= 5) {
                updateNotification();
                notificationUpdateCounter = 0;
            }

        } catch (e) {
            console.error("主循环异常:", e);
        }
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

try {
    initialize();
    main();
} catch (e) {
    toast("启动失败: " + e.message);
    console.error("❌ 启动失败:", e);
    cancelNotification();
    exit();
}

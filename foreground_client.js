"auto";

// ====== 配置 ======
let CHECK_INTERVAL = 7000; // 检测间隔 ms
let FORCE_UPLOAD_INTERVAL = 15000; // 强制上传间隔 ms

let INGEST_URL = "https://example.com/api/current-status"; // 替换为你的接口
let API_TOKEN = "your_api_token";
let machine_id = "my-autox-device";

// ====== 状态与缓存 ======
let counters = { checked: 0, success: 0, failed: 0 };
let lastName = "";
let lastUploadTime = 0;
let appNameCache = {};

// ====== 获取前台应用 ======
function getForegroundApp() {
  let pkg = "unknown";
  try {
    pkg = currentPackage();
  } catch (e) {
    console.warn("获取前台包名失败:", e);
  }

  let appName = appNameCache[pkg];
  if (!appName) {
    try {
      appName = app.getAppName(pkg) || pkg.split(".").pop();
    } catch (e) {
      appName = pkg.split(".").pop();
    }
    appNameCache[pkg] = appName;
  }

  return {
    label: `${appName} - ${pkg}`,
    package: pkg,
  };
}

// ====== 上传逻辑 ======
function uploadStatus(payload) {
  try {
    let res = http.postJson(INGEST_URL, payload, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });

    if (res && res.statusCode === 200) {
      counters.success += 1;
      console.log("上传成功:", payload.app_name);
    } else {
      counters.failed += 1;
      let body = res && res.body ? res.body.string() : "<no response>";
      console.warn("上传失败:", res ? res.statusCode : "<no response>", body);
    }
  } catch (e) {
    counters.failed += 1;
    console.error("上传异常:", e);
  }
}

// ====== 主循环 ======
console.log("启动前台应用监控（无媒体检测）");

while (true) {
  try {
    counters.checked += 1;

    let fgApp = getForegroundApp();
    let appLabelName = fgApp.label;
    let appPackageName = fgApp.package;

    let nowTs = Date.now();
    let shouldUpload =
      appLabelName !== lastName ||
      nowTs - lastUploadTime >= FORCE_UPLOAD_INTERVAL;

    if (appLabelName !== lastName) {
      console.log(`前台窗口变化: ${lastName} → ${appLabelName}`);
    }

    if (shouldUpload) {
      let payload = {
        machine: machine_id,
        window_title: appLabelName,
        app_name: appLabelName,
        app_package: appPackageName,
        timestamp: Math.floor(Date.now() / 1000),
      };
      uploadStatus(payload);
      lastName = appLabelName;
      lastUploadTime = nowTs;
    }

    console.log(
      `检测 #${counters.checked} 成功:${counters.success} 失败:${counters.failed}`,
    );
  } catch (e) {
    console.warn("主循环错误:", e);
  }

  sleep(CHECK_INTERVAL);
}

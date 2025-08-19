// Foreground Monitor (autox.js version)

// !!!!
// 如果你要上报媒体状态，记得打开 shizuku 权限。
// 给了 shizuku 权限就不用手动打开无障碍了哦。
// !!!!

// ====== 配置 ======
let SHIZUKU_ALIVE = false;
try { SHIZUKU_ALIVE = !!shizuku && typeof shizuku === "function"; } catch (e) { SHIZUKU_ALIVE = false; }
let CHECK_INTERVAL = 7000; // 检测间隔 ms
let FORCE_UPLOAD_INTERVAL = 15000; // 强制上传间隔 ms

// !!! 必要修改的配置从这里开始 ...
let INGEST_URL = "Example##https://somehow.example.com/api/ingest"; // 替换为你的接口
let API_TOKEN = "Example##A_Dissatisfaction_To_The_World";
let MACHINE_ID = "Example##leijun_su7csn";
// !!! ... 在这里结束！

// 更新检测相关配置
let DO_CHECK_UPDATE = true; // 是否在脚本启动时检测远端版本（不想检测可以更改）
let LOCAL_VERSION = "1.1.0"; // 别动
let REMOTE_VERSION_URL = "https://raw.githubusercontent.com/RewLight/foreground-monitor/refs/heads/autoxjs/VERSION";
let UPDATE_PAGE_URL = "https://github.com/RewLight/foreground-monitor/tree/autoxjs";

// ====== 状态与缓存 ======
let counters = { checked: 0, success: 0, failed: 0 };
let lastName = "";
let lastUploadTime = 0;
let appNameCache = {};
let lastMediaState = ""; // 保存上次 getMediaState() 的字符串，避免重复上报
let lastMediaAppName = ""; // 当 media 存在时记录其来源应用名（用于上传 app 字段）
let lastShizukuAlive = SHIZUKU_ALIVE; // 用于检测 shizuku 状态变化

// ====== 辅助：比较语义版本号（返回 -1/0/1） ======
function compareSemver(a, b) {
  if (!a) a = "0.0.0";
  if (!b) b = "0.0.0";
  // 去掉可能的前缀 v
  a = String(a).trim().replace(/^v/i, "");
  b = String(b).trim().replace(/^v/i, "");
  let as = a.split(".").map(x => parseInt(x, 10) || 0);
  let bs = b.split(".").map(x => parseInt(x, 10) || 0);
  let len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    let ai = as[i] || 0;
    let bi = bs[i] || 0;
    if (ai < bi) return -1;
    if (ai > bi) return 1;
  }
  return 0;
}

// ====== 启动时检测远端版本（按 DO_CHECK_UPDATE） ======
function fetchRemoteVersion() {
  try {
    let res = http.get(REMOTE_VERSION_URL);
    if (res && res.statusCode === 200 && res.body) {
      let text = res.body.string().trim();
      // 只取第一行（可能包含换行）
      let firstLine = text.split(/\r?\n/)[0].trim();
      return firstLine || null;
    }
  } catch (e) {
    console.warn("检查远端版本失败:", e);
  }
  return null;
}

function promptUpdateIfNeeded() {
  if (!DO_CHECK_UPDATE) {
    console.log("跳过版本检查。");
    return;
  }
  try {
    console.log("正在检查远端版本号...");
    let remote = fetchRemoteVersion();
    if (!remote) {
      console.log("无法获取远端版本或远端版本为空，跳过。");
      return;
    }
    console.log("远端版本:", remote, "本地版本:", LOCAL_VERSION);
    let cmp = compareSemver(LOCAL_VERSION, remote);
    if (cmp < 0) {
      // 远端更新
      let message = `发现新版本：${remote}（当前：${LOCAL_VERSION}）。是否前往 GitHub 更新？`;
      console.log(message);
      try { toast(message); } catch (e) {}
      // 如果有 dialogs.confirm 可用，弹出确认，确认后尝试打开更新页面
      try {
        if (typeof dialogs !== "undefined" && typeof dialogs.confirm === "function") {
          let ok = dialogs.confirm("检测到更新", message);
          if (ok) {
            try {
              if (typeof app !== "undefined" && typeof app.openUrl === "function") {
                app.openUrl(UPDATE_PAGE_URL);
              } else {
                // 尝试使用常规方式打开
                try {
                  let intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(UPDATE_PAGE_URL));
                  context.startActivity(intent);
                } catch (e) {
                  console.log("无法用 intent 打开链接，尝试复制到剪贴板。");
                  try { setClip(UPDATE_PAGE_URL); toast("更新地址已复制到剪贴板"); } catch (ee) {}
                }
              }
            } catch (e) {
              console.warn("打开更新页面失败:", e);
            }
          }
          return;
        }
      } catch (e) {
        // ignore dialogs error
      }
      // fallback：只 log 并尝试用 app.openUrl 打开（非交互式）
      try {
        if (typeof app !== "undefined" && typeof app.openUrl === "function") {
          app.openUrl(UPDATE_PAGE_URL);
        } else {
          console.log("请前往更新页面：", UPDATE_PAGE_URL);
          try { setClip(UPDATE_PAGE_URL); toast("更新地址已复制到剪贴板"); } catch (ee) {}
        }
      } catch (e) {
        console.log("请前往更新页面：", UPDATE_PAGE_URL);
      }
    } else {
      console.log("已是最新版本（或本地版本 >= 远端版本）。");
    }
  } catch (e) {
    console.warn("版本检查出错:", e);
  }
}

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

// ====== 解析单个 session 块，返回对象 ======
function parseSessionBlock(block) {
  let obj = {
    raw: block,
    package: null,
    active: null,
    state_name: null,
    state_num: null,
    position_ms: null,
    description: null
  };

  // package=xxx
  let m = block.match(/package\s*=\s*([^\s,]+)/i);
  if (!m) m = block.match(/\bpkg=([^\s,]+)/i);
  if (m) obj.package = m[1].trim();

  // active=true/false
  m = block.match(/\bactive\s*=\s*(true|false)/i);
  if (m) obj.active = m[1].toLowerCase() === "true";

  // PlaybackState {state=PLAYING(3), position=0, ...}
  m = block.match(/PlaybackState\s*\{([^}]*)\}/i);
  let stateBlock = m ? m[1] : null;
  if (stateBlock) {
    let mm = stateBlock.match(/state\s*=\s*([A-Z_]+)\(?(\d+)?\)?/i);
    if (mm) {
      obj.state_name = String(mm[1]).toLowerCase();
      if (mm[2]) obj.state_num = parseInt(mm[2], 10);
    } else {
      mm = stateBlock.match(/state\s*[:=]\s*(\d+)/i);
      if (mm) obj.state_num = parseInt(mm[1], 10);
    }
    mm = stateBlock.match(/position\s*[:=]\s*(\d+)/i);
    if (mm) obj.position_ms = parseInt(mm[1], 10);
  } else {
    // fallback
    m = block.match(/\bstate\s*[:=]\s*([A-Z_]+)\(?(\d+)?\)?/i);
    if (m) {
      obj.state_name = String(m[1]).toLowerCase();
      if (m[2]) obj.state_num = parseInt(m[2], 10);
    } else {
      m = block.match(/\bstate\s*[:=]\s*(\d+)/i);
      if (m) obj.state_num = parseInt(m[1], 10);
    }
    m = block.match(/\bposition\s*[:=]\s*(\d+)/i);
    if (m) obj.position_ms = parseInt(m[1], 10);
  }

  // metadata description
  m = block.match(/metadata[:\s][\s\S]*?description\s*=\s*([^\n\r]*)/i);
  if (!m) m = block.match(/description\s*=\s*([^\n\r]+)/i);
  if (m) {
    let desc = m[1].trim();
    // 清理尾部的逗号/括号残留
    desc = desc.replace(/[\)\]\s]+$/, "").trim();
    obj.description = desc;
  }

  // 若只有 state_num，根据常见数字映射名字
  if (!obj.state_name && typeof obj.state_num === "number") {
    switch (obj.state_num) {
      case 0: obj.state_name = "none"; break;
      case 1: obj.state_name = "stopped"; break;
      case 2: obj.state_name = "paused"; break;
      case 3: obj.state_name = "playing"; break;
      case 6: obj.state_name = "buffering"; break;
      default: obj.state_name = "state_" + obj.state_num;
    }
  }

  return obj;
}

// ====== 从 dumpsys 输出中解析所有 sessions 并选择正在播放的那些 ======
function parseMediaSessions(output) {
  if (!output) return [];

  // 分割成若干块，按 "MediaSession" 单独分割（保留块内容）
  let parts = output.split(/\n(?=\s*MediaSession\s)/);
  if (parts.length === 1) {
    // 退化：全体当成一个块
    parts = [output];
  }

  let sessions = [];
  for (let p of parts) {
    if (!/MediaSession/i.test(p)) {
      if (!/PlaybackState/i.test(p) && !/metadata/i.test(p)) continue;
    }
    let s = parseSessionBlock(p);
    sessions.push(s);
  }

  // 只保留 state_name === 'playing'（或 state_num === 3）
  let playing = sessions.filter(s => {
    if (!s) return false;
    if (s.state_name && String(s.state_name).toLowerCase() === "playing") return true;
    if (typeof s.state_num === "number" && s.state_num === 3) return true;
    return false;
  });

  return playing; // 可能为空数组
}

// ====== 将 description 解析为 title 与 artist（尽量保持 title 中的逗号） ======
function parseTitleAndArtistFromDescription(desc) {
  if (!desc) return { title: "", artist: "" };

  // 先去掉末尾的 " , null" 或纯数字标记
  let cleaned = desc.replace(/\bnull\b/gi, "").trim();
  cleaned = cleaned.replace(/,+\s*$/, "").trim();

  // 如果包含 "/" 并且 "/" 两侧都不是空（常见 artist/code），尝试用 "/" 分割（优先取第一个和第二个）
  if (cleaned.includes("/")) {
    let seg = cleaned.split("/").map(s => s.trim()).filter(Boolean);
    if (seg.length >= 2) {
      let title = seg[0];
      let artist = seg[1];
      return { title: title, artist: artist };
    }
  }

  // 否则按逗号分割，但保留标题中可能的逗号：把最后一个有效部分作为 artist，前面的合并为 title
  let parts = cleaned.split(",").map(s => s.trim()).filter(p => p && p.toLowerCase() !== "null");
  if (parts.length >= 2) {
    let artist = parts[parts.length - 1];
    let title = parts.slice(0, parts.length - 1).join(",").trim();
    return { title: title, artist: artist };
  }

  // 如果没有逗号但存在 " - " 或 " — " 之类分隔符，尝试分割
  let dashSplit = cleaned.split(/\s+[-—–]\s+/);
  if (dashSplit.length >= 2) {
    return { title: dashSplit[0].trim(), artist: dashSplit[1].trim() };
  }

  // 最后退回全部作为 title
  return { title: cleaned, artist: "" };
}

// ====== getMediaState：返回期望字符串或 null（并设置 lastMediaAppName） ======
function getMediaState() {
  lastMediaAppName = "";
  // 注意：函数内部依赖 SHIZUKU_ALIVE 值，但主循环会在调用前确保 shizuku 可用
  if (!SHIZUKU_ALIVE) return null;

  try {
    let out = shizuku("dumpsys media_session");
    if (!out) return null;

    let playingSessions = parseMediaSessions(String(out));
    if (!playingSessions || playingSessions.length === 0) return null;

    // 如果有多个正在播放的 session，优先选取 active=true 的；否则选第一个
    let chosen = null;
    let activeOnes = playingSessions.filter(s => s.active === true);
    if (activeOnes.length > 0) chosen = activeOnes[0];
    else chosen = playingSessions[0];

    if (!chosen) return null;

    // 从 package 得到应用名称（友好名）
    let mediaAppName = chosen.package || "unknown";
    try {
      let friendly = app.getAppName(chosen.package);
      if (friendly) mediaAppName = friendly;
    } catch (e) {
      mediaAppName = mediaAppName || (chosen.package ? chosen.package.split(".").pop() : "unknown");
    }
    lastMediaAppName = mediaAppName;

    // 从 description 中解析 title 与 artist
    let desc = chosen.description || "";
    let parsed = parseTitleAndArtistFromDescription(desc);
    let title = parsed.title || "";
    let artist = parsed.artist || "";

    // 组装字符串：🎶{媒体来源应用名称} - {标题} {作者}
    let result = `🎶${mediaAppName} - ${title}${artist ? " " + artist : ""}`.trim();
    return result.length > 1 ? result : null;
  } catch (e) {
    console.warn("getMediaState 异常:", e);
    return null;
  }
}

// ====== 上传逻辑（符合 /api/ingest 文档：只上传 machine / window_title / app） ======
function uploadStatus(payload) {
  try {
    let res = http.postJson(INGEST_URL, payload, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      timeout: 7000,
    });

    if (res && (res.statusCode === 200 || (res.body && /"ok"\s*:\s*true/.test(res.body.string())))) {
      counters.success += 1;
      console.log("上传成功:", payload.window_title || payload.app);
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

// ====== 启动前检查 ======
if (
  INGEST_URL.startsWith("Example##") ||
  API_TOKEN.startsWith("Example##") ||
  MACHINE_ID.startsWith("Example##")
) {
  console.error("运行时错误：检测到错误的配置：请重新设定。");
  exit();
}

// 在主循环前做一次更新检查（如果配置允许）
try { promptUpdateIfNeeded(); } catch (e) { console.warn("提示更新时出错:", e); }

if (SHIZUKU_ALIVE) {
  console.log("Shizuku 可用。");
  if (auto.service == null) {
    console.log("未打开无障碍权限。通过 Shizuku 打开中…");
    try { shizuku.openAccessibility(); sleep(5000); } catch (e) {}
  }
} else {
  console.warn("Shizuku 不可用。媒体检测将被禁用。");
}

if (auto.service == null) {
  console.error("未授予无障碍权限。");
  exit();
}

console.info("启动前台应用监控（含媒体检测）");

// ====== 主循环 ======
while (true) {
  try {
    counters.checked += 1;

    // 动态刷新 shizuku 状态（如果 shizuku 状态变化则记录日志）
    let currentShizuku = false;
    try { currentShizuku = !!shizuku && typeof shizuku === "function" && !!shizuku.isAlive && shizuku.isAlive(); } catch (e) { currentShizuku = false; }
    if (currentShizuku !== lastShizukuAlive) {
      lastShizukuAlive = currentShizuku;
      if (currentShizuku) console.log("Shizuku 状态变为: 可用（将启用媒体检测）");
      else console.log("Shizuku 状态变为: 不可用（已禁用媒体检测）");
    }
    // 更新全局标志以供 getMediaState 使用
    SHIZUKU_ALIVE = currentShizuku;

    // 前台应用检测（保留，但可能不会上报）
    let fgApp = getForegroundApp();
    let appLabelName = fgApp.label;
    let appPackageName = fgApp.package;

    // 媒体状态检测 —— 仅当 SHIZUKU_ALIVE 为 true 时才调用 getMediaState()
    let mediaStateStr = null;
    if (SHIZUKU_ALIVE) {
      mediaStateStr = getMediaState(); // string like: 🎶Name - Title Artist  OR null
    } else {
      // 确保不调用 shizuku，当不可用时不改变 lastMediaState（避免断开时误报）
      mediaStateStr = null;
    }

    let nowTs = Date.now();
    // 决定是否上报：有媒体且字符串不同，或无媒体但前台变化，或超时强制上传
    let shouldUpload = false;
    if (mediaStateStr) {
      shouldUpload = mediaStateStr !== lastMediaState || (nowTs - lastUploadTime >= FORCE_UPLOAD_INTERVAL);
    } else {
      shouldUpload = appLabelName !== lastName || (nowTs - lastUploadTime >= FORCE_UPLOAD_INTERVAL);
    }

    if (appLabelName !== lastName) {
      console.log(`前台窗口变化: ${lastName} → ${appLabelName}`);
    }
    if ((mediaStateStr && mediaStateStr !== lastMediaState)) {
      console.log(`媒体状态变化: ${lastMediaState} → ${mediaStateStr}`);
    }

    if (shouldUpload) {
      let payload = { machine: MACHINE_ID };

      if (mediaStateStr && SHIZUKU_ALIVE) {
        // 优先上报媒体状态，并且不上传前台应用
        payload.window_title = mediaStateStr;
        payload.app = lastMediaAppName || mediaStateStr;
      } else {
        // 无媒体或 shizuku 不可用时上报前台应用信息
        payload.window_title = appLabelName;
        payload.app = appLabelName;
      }

      uploadStatus(payload);

      // 更新缓存
      lastName = appLabelName;
      lastMediaState = mediaStateStr || "";
      lastMediaAppName = (mediaStateStr && SHIZUKU_ALIVE) ? lastMediaAppName : "";
      lastUploadTime = nowTs;
    }
  } catch (e) {
    console.warn("主循环错误:", e);
  }

  sleep(CHECK_INTERVAL);
}

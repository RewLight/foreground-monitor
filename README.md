# foreground-monitor client (Autox.js version)

> AI 太好用了你们知道吗

## 安装

1. 在[这个页面](https://github.com/RewLight/foreground-monitor/blob/autoxjs/foreground_client.js)下载 foreground_client.js
2. 安装 AutoX.js ([release](https://github.com/aiselp/AutoX/releases/))
3. 给予 AutoX.js 权限  
   你可以选择两种授权方式：  
   - 通过 Shizuku 授权 （**推荐**，有额外的媒体监测功能）
     1. 在 [RikkaApps/Shizuku](https://github.com/RikkaApps/Shizuku/releases) 下载 Shizuku 并安装
     2. 激活 Shizuku （[文档](https://shizuku.rikka.app/zh-hans/guide/setup/)）
     3. 在 AutoX.js 的侧边栏中，打开 `Shizuku 权限` 的开关
     4. 无需手动打开无障碍权限，脚本将在首次运行时自动授予无障碍权限
   - 仅适用无障碍权限（**不推荐**，功能缺失）
     1. 在 AutoX.js 的侧边栏中打开 `无障碍权限` 的开关
5. 将 foreground_client.js 导入 AutoX.js
6. 点击进入编辑页面，修改 `INGEST_URL`, `API_TOKEN`, `MACHINE_ID` 的值
7. **保存**并运行
8. 在你觉得能看效果的地方看看效果
9. !! **务必给 AutoX.js 设置忽略电量优化等**（请自行查找相关操作）

## 参考
[BlueYeeeee/SpyYourDesktop](https://github.com/BlueYeeeee/SpyYourDesktop)

↑ API 接口跟这个对齐的

## 许可证
并非许可


<h6> 还有一个配置特麻烦但是我自己在用的分支 wless-adb 多了个媒体上报的功能 有兴趣可以看一下 ;)</h6>

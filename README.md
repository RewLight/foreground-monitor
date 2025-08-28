> [!NOTE]
> 该项目的各部分处于独立分支上。请自行参阅。

# <ins>F</ins>oreground-<ins>M</ins>onitor <ins>C</ins>lient v1 (AutoX.js version)

> AI 太好用了你们知道吗

<!--
## 特性

当前，FMCv1 支持以下特性：
> [!CAUTION]
> TODO
-->

## 安装

1. 在[这个页面](https://github.com/RewLight/foreground-monitor/releases)下载 FMCv1 并安装
2. 给予 FMCv1 权限  
   你可以选择两种授权方式：  
   - 通过 Shizuku 授权 （**推荐**，有额外的媒体监测功能）
     1. 在 [RikkaApps/Shizuku](https://github.com/RikkaApps/Shizuku/releases) 下载 Shizuku 并安装
     2. 激活 Shizuku （[文档](https://shizuku.rikka.app/zh-hans/guide/setup/)）
     3. 在 Shizuku 的授权应用管理中勾选 FMCv1
     4. 无需手动打开无障碍权限，脚本将在首次运行时自动授予无障碍权限
   - 仅使用无障碍权限（**不推荐**，功能缺失）
     - 在系统设置中授予 FMCv1 无障碍权限
5. 启动 FMCv1，继续授予 `后台弹出弹窗` 和 `读取全部文件` 权限
6. 在配置管理对话框中点击 `确定` 以修改配置
7. 修改 `INGEST_URL`, `API_TOKEN`, `MACHINE_ID`；点击 `保存`
8. 点击应用顶部的重启按钮，在配置管理对话框中点击 `取消` 以开始运行
9. 在你觉得能看效果的地方看看效果
10. !! **务必给 FMCv1 设置忽略电量优化等**（请自行查找相关操作）

## 参考
服务器配置和 API 接口，请参阅：[BlueYeeeee/SpyYourDesktop: API.md](https://github.com/BlueYeeeee/SpyYourDesktop/blob/main/Web(new)/API.md)

## 许可证
并非许可。 All Rights Reserved (at least for now).

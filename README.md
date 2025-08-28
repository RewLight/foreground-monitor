> [!NOTE]
> 该项目的各部分处于独立分支上。请自行参阅。

# Foreground-Monitor Server-side

> AI 太好用了你们知道吗

本项目是使用 Cloudflare Workers 和 KV 对 [BlueYeeeee/SpyYourDesktop](https://github.com/BlueYeeeee/SpyYourDesktop/tree/main/Web(new)) 的无服务器实现。

## 部署

1. 克隆本分支：
   ```bash
   $ git clone https://github.com/RewLight/foreground-monitor -b server
   ```
2. 安装 wrangler 并登录 Cloudflare:
   ```bash
   $ #Use your node.js packages manager (npm, yarn or something else).
   $ npm install -g @wrangler/latest
   $ wrangler login
   ```
3. 进入目录，进行 Cloudflare KV 的配置：
   1. 建立 KV Namespace:
      ```bash
	  $ wrangler kv namespace create "DESKTOP_KV"
	  ```
   2. 根据 API.md 文档写入配置文件（[参考](#参考)）：
       ```bash
       $ wrangler kv key put "config:group-map" "<group-map.json content here>" --binding=DESKTOP_KV --remote
       $ wrangler kv key put "config:name-keys" "<name-keys.json content here>" --binding=DESKTOP_KV --remote
       ```
5. 部署 Cloudflare Worker:
   ```bash
   $ npm run deploy
   ```
6. 请自行验证是否部署成功。对于上报客户端，请查阅 [BlueYeeeee/SpyYourDesktop: README.md](https://github.com/BlueYeeeee/SpyYourDesktop?tab=readme-ov-file#windows%E4%BE%A7%E8%A7%86%E5%A5%B8%E6%95%99%E7%A8%8Bnew).

## 参考
服务器配置和API 接口，请参阅：[BlueYeeeee/SpyYourDesktop: API.md](https://github.com/BlueYeeeee/SpyYourDesktop/blob/main/Web(new)/API.md)

## 许可证
并非许可。 All Rights Reserved (at least for now).


# 内网穿透与 Vercel 模型接入

## 当前结构

Vercel 只托管 React 静态前端，BioCLIP v1.7 仍在本地电脑的 `127.0.0.1:8011` 运行。Cloudflare Tunnel 把本地 HTTP 服务映射为 HTTPS 地址，浏览器再从 Vercel 页面访问该地址。

```text
用户浏览器 -> Vercel 前端 -> Cloudflare Tunnel -> 本地 FastAPI -> BioCLIP v1.7
```

当前使用 Quick Tunnel，适合课程演示和短期测试。隧道进程退出或电脑关机后服务即不可用；重新启动得到的新地址也需要重新写入 Vercel 环境变量。

## Vercel 环境变量

生产环境需要配置：

```text
VITE_VISION_API_URL=https://<tunnel-host>/v1/identify
VITE_MODEL_HEALTH_URL=https://<tunnel-host>/health
VITE_MODEL_TIMEOUT_MS=180000
```

修改后必须重新部署，Vite 才会把新地址编译进前端产物。

## 启动与检查

1. 启动 `model_service/启动BioCLIP服务.bat`，访问 `http://127.0.0.1:8011/health`。
2. 启动 Cloudflare Tunnel，将目标设为 `http://127.0.0.1:8011`。
3. 访问隧道的 `/health`，确认 `modelReady` 为 `true`、`catalogSize` 与正式名录一致。
4. 检查 FastAPI 的 `PLANT_APP_ORIGINS` 包含正式前端域名。
5. 更新 Vercel 环境变量并重新部署。

## 一键恢复

双击 `model_service/一键开启公网识别.bat`，脚本会自动完成：

1. 检查并按需启动本地 BioCLIP。
2. 停止指向 8011 的旧临时隧道。
3. 使用 HTTP/2 创建新的 Quick Tunnel 并验证公网健康状态。
4. 更新 Vercel 的模型地址并重新部署正式网站。
5. 将当前域名、进程 ID 和启动时间写入 `tmp/public-access/current.json`。

只建立隧道、不更新 Vercel 时可运行：

```powershell
powershell -ExecutionPolicy Bypass -File model_service/start_public_access.ps1 -SkipDeploy
```

双击 `model_service/关闭公网识别.bat` 只关闭公网隧道，默认保留本地 BioCLIP。需要同时关闭模型时运行：

```powershell
powershell -ExecutionPolicy Bypass -File model_service/stop_public_access.ps1 -IncludeModel
```

Quick Tunnel 没有固定有效期和可用性保证。它通常会在进程结束、电脑休眠、网络切换或 Cloudflare 回收连接后失效；旧随机域名不能再次使用。一键脚本每次都会生成新域名，因此必须完成 Vercel 重新部署后再使用线上网站。

## 安全与长期部署

跨域许可不是身份认证。Quick Tunnel 地址一旦泄露，其他客户端仍可直接调用接口，因此不要在此服务中暴露原图路径、密钥或个人信息。长期使用应改为命名隧道或云端推理服务，并增加访问令牌、请求大小限制、频率限制、日志脱敏和服务监控。

## 本轮数据版本

- 正式植物：289 种。
- `猪殃秧`、`猪殃殃草`作为别称连接到 `HBFC-290 拉拉藤（Galium spurium）`。
- 原 `HBFC-289 苔草（未定种）`的样本迁移到 `HBFC-268 细叶苔草`，不再保留重复正式记录。


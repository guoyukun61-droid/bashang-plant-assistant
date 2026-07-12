# GitHub 与 Vercel 部署说明

## 当前地址

- GitHub：<https://github.com/guoyukun61-droid/bashang-plant-assistant>
- Vercel：<https://bashangplantassistant.vercel.app>
- Vercel 项目：`guo-yukuns-projects/bashang_plant_assistant`

GitHub 的 `main` 分支已经与 Vercel 项目连接。推送新的前端提交后，Vercel 会自动创建生产部署。

## 更新线上平台

```powershell
git status
npm test
npm run validate:data
npm run build
git add src public package.json package-lock.json
git commit -m "说明本次修改"
git push
```

不要直接执行 `git add -A`，除非已经确认工作区中没有模型权重、原始工作簿、缓存或个人配置。

## Vercel 本地部署命令

```powershell
vercel whoami
vercel --prod --yes
vercel inspect https://bashangplantassistant.vercel.app
```

`.vercelignore` 会排除已经构建的 `dist`、Python 模型服务、测试和本地配置，避免重复上传。Vercel 在云端重新执行 `npm run build`。

## 本地文件与公开仓库边界

以下内容被 `.gitignore` 排除：

- `.env.local`；
- `model_service/bioclip.local.bat`；
- `model_service/cache`；
- `models` 与 BioCLIP 权重；
- 原始工作簿、审计截图、日志和构建目录。

本地模型路径应写入：

```text
model_service/bioclip.local.bat
```

公开仓库只保留 `bioclip.local.bat.example`。

## 为什么线上页面不能直接连接本机 BioCLIP

浏览器访问 Vercel 时，`127.0.0.1` 表示访问者自己的电脑，不是部署模型的电脑。因此线上平台默认不配置模型 URL，图片检查、样本补录和本地知识库仍然可用，但 BioCLIP 按钮不会假装已经就绪。

若以后需要联网识别，应将 FastAPI 模型服务部署到具备足够内存或 GPU 的服务器，通过 HTTPS 域名提供接口，并配置：

```dotenv
VITE_VISION_API_URL=https://model.example.com/v1/identify
VITE_MODEL_HEALTH_URL=https://model.example.com/health
```

同时在模型服务中设置准确的 `PLANT_APP_ORIGINS`，只允许正式平台域名访问。公开服务还需要身份认证、图片大小限制、频率限制、日志脱敏和隐私告知。

## 故障排查

| 现象 | 检查 |
| --- | --- |
| Vercel 构建失败 | 在本机先运行 `npm run build` |
| JSON 读取失败 | 检查 `public/data` 是否进入 Git |
| 图片 404 | 检查 JSON 路径与 `public` 下文件名大小写 |
| 推送后未部署 | 检查 Vercel 项目的 Git Repository 连接 |
| 线上模型未就绪 | 这是默认状态，需要可公网访问的 HTTPS 模型服务 |
| 上传量异常增大 | 检查 `.vercelignore` 是否排除了 `dist` 和模型目录 |

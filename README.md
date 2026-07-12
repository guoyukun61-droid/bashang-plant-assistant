# 坝上植物实习小助手 V2.1

本项目是本地运行的 React + Vite 植物地理学实习平台，包含特征图谱、290 条植物知识库、结构化语义候选识别、图片样本补录、实习教学文档和可配置模型服务网关。

- 在线平台：[bashangplantassistant.vercel.app](https://bashangplantassistant.vercel.app)
- GitHub：[guoyukun61-droid/bashang-plant-assistant](https://github.com/guoyukun61-droid/bashang-plant-assistant)

## 运行

```powershell
cd bashang_plant_assistant
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:5173/`。页面使用 `HashRouter`，可直接访问 `/#/atlas/whole`、`/#/library/HBFC-071`、`/#/assistant`、`/#/vision` 和 `/#/teaching`。

## 数据更新

权威元数据源不进入仓库。通过环境变量指定工作簿目录和增量包：

```powershell
$env:BASHANG_SOURCE_ROOT="D:\data\植物标注群导入"
$env:BASHANG_ADDITIONAL_PACKAGE="D:\data\植物平台导入包.zip"
```

重新导入与校验：

```powershell
npm run import:data
npm run validate:data
npm test
npm run build
```

导入每日实习样本包：

```powershell
$env:BASHANG_DAILY_PACKAGE="D:\data\植物平台导入包_YYYYMMDD.zip"
npm run import:daily
```

每日导入器只挂接正式名录中可确认的名称；名录外名称进入待复核池。重复执行同一文件不会重复添加图片。

导入器只写入 `public/data` 与派生资产。原始工作簿、群聊图片和已有的 785 张 iPlant 参考图不会被修改。19 个原有图片空缺使用带作者、许可和原始链接的 GBIF 社区参考图补齐，目前 290 种植物均有本地可加载图片。群聊派生图会剥离 EXIF，未匹配图片只进入待复核池。

## 原型边界

当前语义候选由本地结构化字段和反向索引生成。未配置模型服务时，图片识别页只进行本地图像检查，不显示虚假物种候选。

教学文档包含 8 组易混淆物种辨析和 4 讲实习方法，内容由《植物特征总结》与 B 组植物地理实习汇报结构化整理。名录外名称只记录为待核对，不自动扩充正式知识库。

## 文档

- [模型接入与部署指南](docs/模型接入与部署指南.md)
- [平台使用手册](docs/平台使用手册.md)
- [BioCLIP 模型使用与配置教学](docs/BioCLIP模型使用与配置教学.md)
- [GitHub 与 Vercel 部署说明](docs/GitHub与Vercel部署说明.md)

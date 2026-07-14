# iPlant 数据增强与导出说明

## 这份数据包含什么

- `plants.json`：平台运行时使用的 290 条正式植物记录。
- `iplantEnrichment.json`：iPlant 抓取状态、字段覆盖、来源链接、抓取时间和冲突清单。
- `河北丰宁坝上植物知识库_iPlant详情增强_20260714.xlsx`：便于老师和同学查看、筛选、批注的 Excel 版本。
- `featureIndex.json`：语义识别使用的反向特征索引。
- `glossary.json` 与 `captureChecklist.json`：术语和拍摄规范。

## 数据合并原则

1. 老师标注和实习名录是本地权威层。
2. iPlant 公开资料只自动补充本地空字段。
3. 科、属等字段不一致时，不自动覆盖，统一列入“字段冲突与复核”。
4. 每条增强记录保留 `sourceUrl`、`fetchedAt`、`contentHash`，便于追溯更新。
5. 包内不含群聊身份、消息编号、精确 GPS、EXIF 或网页原始缓存。

## 查看与使用

直接打开 Excel，优先查看以下工作表：

- `植物知识库`：一行一种植物，适合检索与汇报。
- `iPlant抓取详情`：形态、器官、生境、分布等详情字段。
- `字段冲突与复核`：需要老师确认的分类差异。
- `数据说明`：来源和处理边界。

在平台中，进入植物名录详情页，展开“查看 iPlant 详情字段”即可查看本次补充内容，并可通过“iPlant 物种资料”跳转核对原页面。

## 重新抓取

在开发环境中执行：

```powershell
npm install
npm run enrich:iplant
npm run validate:data
npm run build
```

抓取缓存位于 `tmp/iplant-cache`。默认会复用成功缓存；若确需重新访问全部页面，可运行：

```powershell
python scripts/enrich_from_iplant.py --refresh
```

请保持限速，不要并发轰击网站，也不要绕过登录或访问控制。

## 导出包校验

压缩包旁的校验信息文件记录 SHA256。迁移后可用 PowerShell 核验：

```powershell
Get-FileHash -Algorithm SHA256 "坝上植物知识库_iPlant增强导出包_20260714.zip"
```

若哈希一致，说明传输过程中未发生文件损坏。

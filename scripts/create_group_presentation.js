import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PptxGenJS = require("pptxgenjs");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "B组 · 坝上植物实习小助手";
pptx.company = "植物地理学实习课程小组";
pptx.subject = "坝上植物实习小助手平台架构与小程序扩展方案";
pptx.title = "坝上植物实习小助手 Plant Geography Agent";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "STZhongsong",
  bodyFontFace: "Microsoft YaHei",
  lang: "zh-CN",
};

const W = 13.333;
const H = 7.5;
const C = {
  forest: "0B2A21",
  forest2: "153D31",
  moss: "52715F",
  ivory: "F5F1E7",
  paper: "FBF9F3",
  ink: "17332B",
  muted: "6E7D76",
  orange: "EEA23A",
  blue: "7896A8",
  red: "B44F4A",
  white: "FFFFFF",
  line: "D7D9CF",
};

const project = path.resolve(__dirname, "..");
const img = (name) => path.join(project, "public", "local-samples", "display", name);
const photos = [img("S0057.webp"), img("S0003.webp"), img("S0014.webp"), img("S0071.webp")];
const output = process.argv[2] || path.join(project, "坝上植物实习小助手_小组作业汇报架构.pptx");

function addPhoto(slide, imagePath, x, y, w, h, transparency = 0) {
  slide.addImage({ path: imagePath, x, y, w, h, sizing: { type: "cover", w, h }, transparency });
}

function addFooter(slide, page, dark = false) {
  slide.addText("坝上植物实习小助手 · Plant Geography Agent", {
    x: 0.55, y: 7.15, w: 5.5, h: 0.18, margin: 0,
    fontFace: "Microsoft YaHei", fontSize: 8.5, color: dark ? "B7C9C1" : "7B877F",
  });
  slide.addText(String(page).padStart(2, "0"), {
    x: 12.15, y: 7.12, w: 0.58, h: 0.22, margin: 0,
    fontFace: "Georgia", fontSize: 9, bold: true, align: "right", color: dark ? C.orange : C.ink,
  });
}

function addTitle(slide, kicker, title, page, dark = false) {
  slide.addText(kicker.toUpperCase(), {
    x: 0.72, y: 0.48, w: 4.8, h: 0.24, margin: 0,
    fontFace: "Georgia", fontSize: 10.5, bold: true, charSpacing: 1.4, color: C.orange,
  });
  slide.addText(title, {
    x: 0.72, y: 0.78, w: 11.9, h: 0.62, margin: 0,
    fontFace: "STZhongsong", fontSize: 28, bold: false, color: dark ? C.ivory : C.ink,
  });
  addFooter(slide, page, dark);
}

function addStat(slide, x, y, value, label, color = C.orange, dark = false) {
  slide.addText(value, {
    x, y, w: 1.55, h: 0.62, margin: 0,
    fontFace: "Georgia", fontSize: 29, bold: true, color,
  });
  slide.addText(label, {
    x, y: y + 0.62, w: 1.9, h: 0.38, margin: 0,
    fontFace: "Microsoft YaHei", fontSize: 10.5, color: dark ? "C3D0CA" : C.muted,
  });
}

function addPill(slide, text, x, y, w, active = false) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.38, rectRadius: 0.05,
    fill: { color: active ? C.orange : C.paper, transparency: active ? 0 : 4 },
    line: { color: active ? C.orange : "BEC8C0", width: 0.8 },
  });
  slide.addText(text, {
    x, y: y + 0.02, w, h: 0.27, margin: 0, align: "center",
    fontFace: "Microsoft YaHei", fontSize: 9.5, bold: active, color: active ? C.forest : C.ink,
  });
}

function addModule(slide, index, title, body, x, y, w, color) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h: 1.22,
    fill: { color: C.paper }, line: { color: "D5DBD5", width: 0.9 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: 0.11, h: 1.22, fill: { color }, line: { color },
  });
  slide.addText(index, {
    x: x + 0.24, y: y + 0.16, w: 0.45, h: 0.25, margin: 0,
    fontFace: "Georgia", fontSize: 11, bold: true, color,
  });
  slide.addText(title, {
    x: x + 0.76, y: y + 0.13, w: w - 1.02, h: 0.32, margin: 0,
    fontFace: "Microsoft YaHei", fontSize: 15, bold: true, color: C.ink,
  });
  slide.addText(body, {
    x: x + 0.76, y: y + 0.52, w: w - 1.02, h: 0.5, margin: 0,
    fontFace: "Microsoft YaHei", fontSize: 10.2, breakLine: false, color: C.muted,
    valign: "top", fit: "shrink",
  });
}

// 01 封面
{
  const s = pptx.addSlide();
  s.background = { color: C.forest };
  addPhoto(s, photos[0], 7.62, 0, 5.713, 7.5, 0);
  s.addShape(pptx.ShapeType.rect, { x: 7.62, y: 0, w: 5.713, h: 7.5, fill: { color: C.forest, transparency: 44 }, line: { transparency: 100 } });
  s.addText("PLANT GEOGRAPHY AGENT", {
    x: 0.75, y: 0.78, w: 5.8, h: 0.3, margin: 0,
    fontFace: "Georgia", fontSize: 12, bold: true, charSpacing: 2.2, color: C.orange,
  });
  s.addText("坝上植物实习\n小助手", {
    x: 0.75, y: 1.25, w: 6.7, h: 1.85, margin: 0,
    fontFace: "STZhongsong", fontSize: 45, color: C.ivory, breakLine: false,
  });
  s.addText("从纸质名录到可复核的植物识别与实习学习平台", {
    x: 0.8, y: 3.35, w: 6.15, h: 0.5, margin: 0,
    fontFace: "Microsoft YaHei", fontSize: 17, color: "CFDCD5",
  });
  s.addText("小组作业汇报架构 · Web 原型已运行 · 后续接入实习小程序", {
    x: 0.8, y: 4.12, w: 6.35, h: 0.35, margin: 0,
    fontFace: "Microsoft YaHei", fontSize: 11, color: "91ADA0",
  });
  addPill(s, "290 种植物", 0.8, 5.25, 1.45, true);
  addPill(s, "1104 张图像", 2.42, 5.25, 1.55, false);
  addPill(s, "BioCLIP v1.7", 4.14, 5.25, 1.62, false);
  s.addText("汇报人：B组    课程：植物地理学实习", {
    x: 0.8, y: 6.55, w: 5.8, h: 0.3, margin: 0,
    fontFace: "Microsoft YaHei", fontSize: 10.5, color: "B7C9C1",
  });
  s.addNotes("开场控制在20秒。先说明这不是单纯的植物识别器，而是把名录、教学、识别和样本复核串起来的实习平台。强调当前Web原型已经运行，小程序是下一阶段入口。 ");
}

// 02 痛点
{
  const s = pptx.addSlide();
  s.background = { color: C.ivory };
  addTitle(s, "01 / FIELD PROBLEM", "实习现场的问题，不只是不认识植物", 2);
  const items = [
    ["01", "术语难记", "包茎、轮生叶、头状花序等知识分散，现场难以快速回忆。"],
    ["02", "名录难查", "纸质名录与照片分离，别名、科属和相似种需要反复翻找。"],
    ["03", "识别证据不足", "单张照片常缺少叶序、茎、果实和生境，结果难以复核。"],
    ["04", "样本无法沉淀", "后续同学拍摄的新样本缺少统一格式，难以回流到课程知识库。"],
  ];
  items.forEach((it, i) => addModule(s, it[0], it[1], it[2], 0.75 + (i % 2) * 6.15, 1.78 + Math.floor(i / 2) * 1.62, 5.68, i === 3 ? C.red : (i === 2 ? C.blue : C.orange)));
  s.addShape(pptx.ShapeType.rect, { x: 0.75, y: 5.35, w: 11.83, h: 0.92, fill: { color: C.forest }, line: { color: C.forest } });
  s.addText("核心判断", { x: 1.02, y: 5.62, w: 1.15, h: 0.27, margin: 0, fontSize: 12, bold: true, color: C.orange });
  s.addText("平台的价值不是替代老师，而是把观察证据组织好，让识别过程可解释、可复核、可继续积累。", { x: 2.25, y: 5.52, w: 9.85, h: 0.36, margin: 0, fontSize: 15, color: C.ivory });
  s.addNotes("这一页不要逐字读。把四个痛点归纳为两句话：知识分散、证据不完整；识别结束后资料也没有进入可复用的课程资产。 ");
}

// 03 总体方案
{
  const s = pptx.addSlide();
  s.background = { color: C.paper };
  addTitle(s, "02 / SOLUTION MAP", "一个平台，形成完整的实习学习闭环", 3);
  const names = ["特征图谱", "植物名录", "联合识别", "样本补录", "教学文档"];
  const desc = ["器官观察方法", "数字植物志", "语义 + 图像", "待复核样本池", "易混淆物种"];
  names.forEach((n, i) => {
    const x = 0.67 + i * 2.5;
    s.addShape(pptx.ShapeType.ellipse, { x, y: 2.05, w: 1.4, h: 1.4, fill: { color: i === 2 ? C.orange : C.forest2 }, line: { color: i === 2 ? C.orange : C.forest2 } });
    s.addText(String(i + 1).padStart(2, "0"), { x, y: 2.27, w: 1.4, h: 0.3, margin: 0, align: "center", fontFace: "Georgia", fontSize: 13, bold: true, color: i === 2 ? C.forest : C.orange });
    s.addText(n, { x: x - 0.28, y: 2.67, w: 1.96, h: 0.3, margin: 0, align: "center", fontSize: 14, bold: true, color: i === 2 ? C.forest : C.ivory });
    s.addText(desc[i], { x: x - 0.34, y: 3.62, w: 2.08, h: 0.3, margin: 0, align: "center", fontSize: 10.5, color: C.muted });
    if (i < 4) s.addShape(pptx.ShapeType.line, { x: x + 1.5, y: 2.75, w: 0.82, h: 0, line: { color: "A8B6AE", width: 1.5, dash: "dash" } });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 1.15, y: 4.6, w: 11.03, h: 1.02, fill: { color: "E7EADF" }, line: { color: "C7D0C8" }, rectRadius: 0.05 });
  s.addText("观察", { x: 1.48, y: 4.93, w: 1.0, h: 0.25, margin: 0, align: "center", fontSize: 13, bold: true, color: C.ink });
  s.addText("→", { x: 2.55, y: 4.86, w: 0.5, h: 0.3, margin: 0, align: "center", fontSize: 18, color: C.orange });
  s.addText("检索与识别", { x: 3.12, y: 4.93, w: 1.45, h: 0.25, margin: 0, align: "center", fontSize: 13, bold: true, color: C.ink });
  s.addText("→", { x: 4.74, y: 4.86, w: 0.5, h: 0.3, margin: 0, align: "center", fontSize: 18, color: C.orange });
  s.addText("教师复核", { x: 5.34, y: 4.93, w: 1.25, h: 0.25, margin: 0, align: "center", fontSize: 13, bold: true, color: C.ink });
  s.addText("→", { x: 6.75, y: 4.86, w: 0.5, h: 0.3, margin: 0, align: "center", fontSize: 18, color: C.orange });
  s.addText("进入知识库", { x: 7.35, y: 4.93, w: 1.48, h: 0.25, margin: 0, align: "center", fontSize: 13, bold: true, color: C.ink });
  s.addText("→", { x: 9.0, y: 4.86, w: 0.5, h: 0.3, margin: 0, align: "center", fontSize: 18, color: C.orange });
  s.addText("服务下一届实习", { x: 9.56, y: 4.93, w: 1.88, h: 0.25, margin: 0, align: "center", fontSize: 13, bold: true, color: C.ink });
  s.addNotes("五个模块只讲名称和作用，重点指向下方闭环：观察、识别、复核、入库、服务下一届。 ");
}

// 04 技术架构
{
  const s = pptx.addSlide();
  s.background = { color: C.ivory };
  addTitle(s, "03 / SYSTEM ARCHITECTURE", "平台架构：界面、知识、智能与部署四层解耦", 4);
  const rows = [
    ["交互层", "Web 平台（React + Vite）", "未来实习小程序", C.orange],
    ["业务层", "图谱 · 名录 · 联合识别", "补录 · 教学 · 复核", C.blue],
    ["智能层", "结构化语义检索", "BioCLIP v1.7 约束识别", C.red],
    ["数据层", "290 种植物知识库", "图像、术语、反向索引", C.moss],
  ];
  rows.forEach((r, i) => {
    const y = 1.58 + i * 1.12;
    s.addShape(pptx.ShapeType.rect, { x: 0.8, y, w: 1.35, h: 0.82, fill: { color: r[3] }, line: { color: r[3] } });
    s.addText(r[0], { x: 0.8, y: y + 0.27, w: 1.35, h: 0.26, margin: 0, align: "center", fontSize: 14, bold: true, color: C.white });
    [r[1], r[2]].forEach((text, j) => {
      s.addShape(pptx.ShapeType.rect, { x: 2.32 + j * 4.85, y, w: 4.5, h: 0.82, fill: { color: C.paper }, line: { color: "C9D0CA", width: 0.9 } });
      s.addText(text, { x: 2.56 + j * 4.85, y: y + 0.25, w: 4.02, h: 0.28, margin: 0, align: "center", fontSize: 13.5, bold: true, color: C.ink });
    });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 2.32, y: 6.12, w: 9.35, h: 0.62, fill: { color: C.forest }, line: { color: C.forest }, rectRadius: 0.04 });
  s.addText("部署：Vercel 静态前端 + 本机/校内服务器模型服务 + 可替换 API", { x: 2.58, y: 6.32, w: 8.85, h: 0.23, margin: 0, align: "center", fontSize: 12, color: C.ivory });
  s.addNotes("解释解耦价值：小程序不需要重写知识库和模型，只增加一个交互入口；未来替换模型，也不必重做名录页面。 ");
}

// 05 数据基础
{
  const s = pptx.addSlide();
  s.background = { color: C.forest };
  addTitle(s, "04 / KNOWLEDGE BASE", "知识库是平台的核心资产", 5, true);
  addStat(s, 0.82, 1.75, "290", "正式植物记录", C.orange, true);
  addStat(s, 3.06, 1.75, "62", "结构化特征字段", C.blue, true);
  addStat(s, 5.27, 1.75, "284", "特征反向索引", C.orange, true);
  addStat(s, 7.56, 1.75, "804", "iPlant 参考图", C.blue, true);
  addStat(s, 9.82, 1.75, "300", "实习样本图", C.orange, true);
  s.addText("Excel 与群聊样本", { x: 0.88, y: 4.05, w: 1.65, h: 0.28, margin: 0, fontSize: 12, bold: true, color: C.ivory, align: "center" });
  s.addText("清洗与校订", { x: 3.18, y: 4.05, w: 1.5, h: 0.28, margin: 0, fontSize: 12, bold: true, color: C.ivory, align: "center" });
  s.addText("结构化 JSON", { x: 5.42, y: 4.05, w: 1.55, h: 0.28, margin: 0, fontSize: 12, bold: true, color: C.ivory, align: "center" });
  s.addText("检索与识别", { x: 7.75, y: 4.05, w: 1.5, h: 0.28, margin: 0, fontSize: 12, bold: true, color: C.ivory, align: "center" });
  s.addText("教师复核回流", { x: 10.02, y: 4.05, w: 1.6, h: 0.28, margin: 0, fontSize: 12, bold: true, color: C.ivory, align: "center" });
  [1.53, 3.77, 6.04, 8.34, 10.72].forEach((x, i) => {
    s.addShape(pptx.ShapeType.ellipse, { x, y: 4.55, w: 0.46, h: 0.46, fill: { color: i % 2 ? C.blue : C.orange }, line: { color: i % 2 ? C.blue : C.orange } });
    if (i < 4) s.addShape(pptx.ShapeType.line, { x: x + 0.46, y: 4.78, w: 1.78, h: 0, line: { color: "718D81", width: 2 } });
  });
  s.addText("数据治理：保留原值与接受值 · 图片去除 EXIF · 不公开群聊身份与精确 GPS · 待复核样本不自动进入正式名录", {
    x: 0.88, y: 5.55, w: 11.55, h: 0.55, margin: 0,
    fontSize: 12.5, color: "C8D6CF", align: "center", fit: "shrink",
  });
  s.addNotes("这一页是成果硬证据。强调数据不是爬完就结束，而是有清洗、校订、隐私和复核边界。 ");
}

// 06 用户体验
{
  const s = pptx.addSlide();
  s.background = { color: C.paper };
  addTitle(s, "05 / FIELD EXPERIENCE", "从观察方法到植物详情，学习路径连续", 6);
  addPhoto(s, photos[0], 0.72, 1.58, 4.1, 4.75);
  s.addShape(pptx.ShapeType.rect, { x: 0.72, y: 4.82, w: 4.1, h: 1.51, fill: { color: C.forest, transparency: 15 }, line: { transparency: 100 } });
  s.addText("特征图谱", { x: 1.02, y: 5.18, w: 2.1, h: 0.4, margin: 0, fontSize: 22, color: C.ivory, bold: true });
  s.addText("通过整株、茎、叶、花、果实热点学习观察顺序", { x: 1.02, y: 5.68, w: 3.42, h: 0.42, margin: 0, fontSize: 11, color: "CFDDD6" });
  addModule(s, "01", "植物名录", "按中文名、别名、拉丁名、科属、生境与器官特征检索。", 5.25, 1.58, 7.25, C.orange);
  addModule(s, "02", "沉浸式详情", "简介、分步辨认、结构化特征、本地样本和 iPlant 链接集中展示。", 5.25, 3.08, 7.25, C.blue);
  addModule(s, "03", "教学文档", "把课程材料整理为易混淆物种比较与野外观察任务。", 5.25, 4.58, 7.25, C.moss);
  s.addNotes("这一页讲用户旅程，不讲前端技术。图谱负责教会观察，名录负责查证，教学文档负责建立易混淆物种的比较框架。 ");
}

// 07 联合识别
{
  const s = pptx.addSlide();
  s.background = { color: C.ivory };
  addTitle(s, "06 / MULTIMODAL IDENTIFICATION", "联合识别：文字、图片或两者同时输入", 7);
  const modes = [
    ["文字输入", "“湿地、禾本科、叶线形”", "结构化知识库检索", C.blue],
    ["图片输入", "全株 + 花 + 叶等多器官照片", "BioCLIP 闭集候选", C.orange],
    ["联合输入", "照片 + 生境 + 生活型 + 特殊结构", "语义约束候选排序", C.red],
  ];
  modes.forEach((m, i) => {
    const x = 0.75 + i * 4.2;
    s.addShape(pptx.ShapeType.rect, { x, y: 1.68, w: 3.72, h: 3.82, fill: { color: C.paper }, line: { color: "CAD1CB", width: 0.9 } });
    s.addShape(pptx.ShapeType.ellipse, { x: x + 1.37, y: 2.02, w: 0.98, h: 0.98, fill: { color: m[3] }, line: { color: m[3] } });
    s.addText(String(i + 1).padStart(2, "0"), { x: x + 1.37, y: 2.33, w: 0.98, h: 0.26, margin: 0, align: "center", fontFace: "Georgia", fontSize: 13, bold: true, color: C.white });
    s.addText(m[0], { x: x + 0.4, y: 3.22, w: 2.92, h: 0.4, margin: 0, align: "center", fontSize: 20, bold: true, color: C.ink });
    s.addText(m[1], { x: x + 0.35, y: 3.86, w: 3.02, h: 0.62, margin: 0, align: "center", fontSize: 11.5, color: C.muted, valign: "mid" });
    s.addText(m[2], { x: x + 0.35, y: 4.78, w: 3.02, h: 0.32, margin: 0, align: "center", fontSize: 12.5, bold: true, color: m[3] });
  });
  s.addText("输出不是“最终鉴定”", { x: 2.02, y: 6.08, w: 2.3, h: 0.3, margin: 0, fontSize: 13, bold: true, color: C.red });
  s.addText("候选等级 + 支持特征 + 冲突特征 + 下一步观察建议 + 来源", { x: 4.18, y: 6.08, w: 6.85, h: 0.3, margin: 0, fontSize: 13, color: C.ink });
  s.addNotes("现场演示时可以输入委陵菜，说明候选不再固定六条；也可以展示照片加“灌木、黄色花、羽状复叶”的联合约束。 ");
}

// 08 模型
{
  const s = pptx.addSlide();
  s.background = { color: C.forest };
  addTitle(s, "07 / BIOCLIP v1.7", "模型负责排序，语义约束负责缩小生态与性状范围", 8, true);
  const flow = ["多器官照片", "BioCLIP-2\n视觉编码", "290 种标签\n五提示词集成", "性状/物候/地理\n约束校正", "候选列表\n待人工复核"];
  flow.forEach((t, i) => {
    const x = 0.64 + i * 2.53;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 2.05, w: 2.0, h: 1.15, fill: { color: i === 3 ? C.orange : C.forest2 }, line: { color: i === 3 ? C.orange : "426354" }, rectRadius: 0.04 });
    s.addText(t, { x: x + 0.14, y: 2.34, w: 1.72, h: 0.55, margin: 0, align: "center", valign: "mid", fontSize: 12.3, bold: true, color: i === 3 ? C.forest : C.ivory });
    if (i < 4) s.addText("→", { x: x + 2.02, y: 2.4, w: 0.5, h: 0.3, margin: 0, align: "center", fontSize: 18, color: C.orange });
  });
  addStat(s, 1.0, 4.3, "1.58s", "CPU 联合推理实测", C.orange, true);
  addStat(s, 4.05, 4.3, "5×", "每个物种提示词集成", C.blue, true);
  addStat(s, 7.03, 4.3, "4类", "约束库参与排序", C.orange, true);
  addStat(s, 10.0, 4.3, "0", "不伪造模型结论", C.blue, true);
  s.addText("边界：当前为坝上名录内闭集识别；低分、器官不足或名录外物种必须进入待复核流程。", { x: 1.02, y: 6.02, w: 11.12, h: 0.36, margin: 0, align: "center", fontSize: 12.8, color: "C8D6CF" });
  s.addNotes("不要把模型讲成万能识别。重点是它只在290种名录内排序，文字约束会依据性状、时间和环境校正；最终仍需老师或标本证据确认。 ");
}

// 09 样本闭环
{
  const s = pptx.addSlide();
  s.background = { color: C.paper };
  addTitle(s, "08 / SAMPLE LOOP", "后续实习同学如何继续完善知识库", 9);
  addPhoto(s, photos[2], 0.72, 1.48, 3.65, 4.92);
  const steps = [
    ["01", "多器官拍摄", "全株、生境、花、叶、茎、果实分开记录"],
    ["02", "填写观察信息", "暂定名称、生境、日期、器官标签与说明"],
    ["03", "本地待复核", "不直接写入正式名录，保留来源和原始判断"],
    ["04", "教师确认后入库", "更新正式名称、别名、图片与教学材料"],
  ];
  steps.forEach((st, i) => addModule(s, st[0], st[1], st[2], 4.78, 1.48 + i * 1.25, 7.7, i === 2 ? C.red : (i === 3 ? C.moss : C.orange)));
  s.addText("形成跨年级、可追溯的课程数据资产", { x: 5.05, y: 6.55, w: 6.92, h: 0.32, margin: 0, align: "center", fontSize: 15, bold: true, color: C.ink });
  s.addNotes("这页直接回答老师可能问的‘平台以后谁来维护’。关键不是让学生随意扩库，而是先待复核、后确认。 ");
}

// 10 小程序
{
  const s = pptx.addSlide();
  s.background = { color: C.ivory };
  addTitle(s, "09 / MINI PROGRAM ROADMAP", "实习小程序是新的入口，不是重新建设一套平台", 10);
  s.addShape(pptx.ShapeType.roundRect, { x: 0.85, y: 1.72, w: 3.0, h: 3.85, fill: { color: C.forest }, line: { color: C.forest }, rectRadius: 0.08 });
  s.addText("实习小程序", { x: 1.25, y: 2.12, w: 2.2, h: 0.5, margin: 0, align: "center", fontSize: 24, color: C.ivory, bold: true });
  ["相机与相册", "离线名录缓存", "位置/样方记录", "样本提交", "课程任务"].forEach((t, i) => addPill(s, t, 1.35, 2.95 + i * 0.46, 2.0, i === 0));
  s.addText("HTTPS API", { x: 4.38, y: 3.16, w: 1.28, h: 0.32, margin: 0, align: "center", fontFace: "Georgia", fontSize: 11, bold: true, color: C.orange });
  s.addShape(pptx.ShapeType.line, { x: 3.88, y: 3.55, w: 2.25, h: 0, line: { color: C.orange, width: 2.2 } });
  s.addShape(pptx.ShapeType.roundRect, { x: 6.02, y: 1.72, w: 6.45, h: 3.85, fill: { color: C.paper }, line: { color: "C6D0C8" }, rectRadius: 0.05 });
  s.addText("共享后台能力", { x: 6.38, y: 2.08, w: 2.2, h: 0.42, margin: 0, fontSize: 21, bold: true, color: C.ink });
  addModule(s, "A", "统一知识库 API", "植物、别名、特征、图片、教学文档共用同一数据源。", 6.4, 2.75, 5.7, C.moss);
  addModule(s, "B", "统一识别 API", "Web 与小程序调用同一 BioCLIP/后续模型服务。", 6.4, 4.15, 5.7, C.orange);
  s.addText("第一阶段：只读名录 + 联合识别     第二阶段：登录与样本上传     第三阶段：样方/GIS与教师审核", { x: 1.0, y: 6.22, w: 11.4, h: 0.38, margin: 0, align: "center", fontSize: 12.5, color: C.ink });
  s.addNotes("小程序扩展分三阶段，先保证现场查询和识别，再做身份、上传、教师审核，最后接样方和GIS。这样控制课程作业范围，也保留长期发展空间。 ");
}

// 11 验证与成果
{
  const s = pptx.addSlide();
  s.background = { color: C.forest };
  addTitle(s, "10 / VALIDATION", "我们已经完成的，不只是页面设计", 11, true);
  const facts = [
    ["290 / 290", "正式植物均有可加载图片"],
    ["13 / 13", "前端回归测试通过"],
    ["2 / 2", "BioCLIP 后端单元测试通过"],
    ["5视口", "桌面与移动端响应式检查"],
    ["Vercel", "生产前端已部署"],
    ["v1.7", "真实模型服务已接入"],
  ];
  facts.forEach((f, i) => {
    const x = 0.76 + (i % 3) * 4.18;
    const y = 1.65 + Math.floor(i / 3) * 1.75;
    s.addShape(pptx.ShapeType.rect, { x, y, w: 3.74, h: 1.33, fill: { color: C.forest2 }, line: { color: "3F6253" } });
    s.addText(f[0], { x: x + 0.28, y: y + 0.22, w: 1.45, h: 0.45, margin: 0, fontFace: "Georgia", fontSize: 23, bold: true, color: C.orange });
    s.addText(f[1], { x: x + 1.65, y: y + 0.3, w: 1.78, h: 0.55, margin: 0, fontSize: 11.5, color: C.ivory, valign: "mid" });
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 1.02, y: 5.42, w: 11.28, h: 0.84, fill: { color: C.orange }, line: { color: C.orange }, rectRadius: 0.04 });
  s.addText("原型边界：候选结果必须复核；模型服务仍需本地或校内服务器；教师审核与账号体系尚未上线。", { x: 1.32, y: 5.7, w: 10.68, h: 0.3, margin: 0, align: "center", fontSize: 13, bold: true, color: C.forest });
  s.addNotes("先讲完成度，再主动讲边界，会比回避限制更可信。模型、账号和教师后台可以作为后续课程或毕业设计继续实现。 ");
}

// 12 总结
{
  const s = pptx.addSlide();
  s.background = { color: C.ivory };
  addPhoto(s, photos[3], 0, 0, 5.25, 7.5);
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 5.25, h: 7.5, fill: { color: C.forest, transparency: 47 }, line: { transparency: 100 } });
  s.addText("结论", { x: 5.92, y: 0.78, w: 1.2, h: 0.32, margin: 0, fontFace: "Georgia", fontSize: 12, bold: true, color: C.orange, charSpacing: 1.6 });
  s.addText("让植物识别成为\n可学习、可复核、可积累的过程", { x: 5.92, y: 1.35, w: 6.55, h: 1.35, margin: 0, fontFace: "STZhongsong", fontSize: 29, color: C.ink, breakLine: false });
  const closes = [
    ["课程价值", "降低第一次认样方时的信息检索成本"],
    ["数据价值", "形成跨年级持续维护的坝上植物知识库"],
    ["技术价值", "以统一数据与 API 支撑 Web、小程序和后续模型"],
  ];
  closes.forEach((c, i) => {
    s.addText(String(i + 1).padStart(2, "0"), { x: 5.95, y: 3.55 + i * 0.9, w: 0.45, h: 0.25, margin: 0, fontFace: "Georgia", fontSize: 11, bold: true, color: C.orange });
    s.addText(c[0], { x: 6.55, y: 3.5 + i * 0.9, w: 1.15, h: 0.3, margin: 0, fontSize: 13, bold: true, color: C.ink });
    s.addText(c[1], { x: 7.75, y: 3.5 + i * 0.9, w: 4.62, h: 0.36, margin: 0, fontSize: 12.2, color: C.muted });
  });
  s.addText("谢谢老师与同学指导", { x: 5.95, y: 6.55, w: 3.5, h: 0.35, margin: 0, fontSize: 13, bold: true, color: C.ink });
  s.addText("Q & A", { x: 10.58, y: 6.45, w: 1.65, h: 0.46, margin: 0, fontFace: "Georgia", fontSize: 22, bold: true, align: "right", color: C.orange });
  s.addNotes("最后回到课程价值、数据价值和技术价值。结束后可以现场打开联合识别页面演示。 ");
}

pptx.writeFile({ fileName: output, compression: true });

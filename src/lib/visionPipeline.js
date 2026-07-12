const REQUIRED_PARTS = ["全株", "花", "叶", "茎", "果实"];

function normalizePart(value) {
  if (value.includes("全") || value.includes("生境")) return "全株";
  if (value.includes("花")) return "花";
  if (value.includes("叶")) return "叶";
  if (value.includes("茎") || value.includes("树皮")) return "茎";
  if (value.includes("果") || value.includes("种子")) return "果实";
  return value || "未标注";
}

async function inspectFile(file, partLabel) {
  const result = {
    name: file.name, type: file.type, size: file.size, organLabel: normalizePart(partLabel),
    validType: /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type), dimensions: null, warnings: [],
  };
  if (file.size > 20 * 1024 * 1024) result.warnings.push("文件超过 20 MB，建议压缩后再入库");
  if (!result.validType) result.warnings.push("不支持的图片格式");
  if (typeof createImageBitmap === "function" && result.validType) {
    try {
      const bitmap = await createImageBitmap(file);
      result.dimensions = { width: bitmap.width, height: bitmap.height };
      if (Math.min(bitmap.width, bitmap.height) < 720) result.warnings.push("短边低于 720 px，细部识别可能受限");
      bitmap.close();
    } catch { result.warnings.push("浏览器无法读取图片尺寸"); }
  }
  return result;
}

export async function visionPipeline(files, partLabels = []) {
  const list = Array.from(files || []);
  const inspected = await Promise.all(list.map((file, index) => inspectFile(file, partLabels[index] || "未标注")));
  const observed = new Set(inspected.map((item) => item.organLabel));
  const missingParts = REQUIRED_PARTS.filter((part) => !observed.has(part));
  const validCount = inspected.filter((item) => item.validType).length;
  return {
    status: validCount ? "待复核" : "等待图片", files: inspected, missingParts,
    suggestion: missingParts.length ? `建议继续补拍：${missingParts.slice(0, 3).join("、")}。多器官样本能减少仅凭花色造成的误判。` : "器官覆盖较完整，可提交教师复核或后续模型服务。",
    candidates: [], conclusion: "本地图像检查未运行物种识别，只评价文件与器官覆盖。",
  };
}

export default visionPipeline;

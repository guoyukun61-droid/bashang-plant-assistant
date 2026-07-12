const TERM_GROUPS = {
  花色: ["黄色", "白色", "紫色", "蓝色", "红色", "粉色", "绿色"],
  花序: ["头状花序", "穗状花序", "总状花序", "伞形花序", "圆锥花序", "聚伞花序", "球状花序"],
  叶序: ["轮生", "互生", "对生", "簇生", "基生"],
  果实: ["蒴果", "瘦果", "荚果", "浆果", "核果", "颖果", "蓇葖果"],
  生境: ["湿地", "草地", "林缘", "河滩", "沙地", "山坡", "路旁", "沼泽"],
};

const EXTRA_TERMS = [
  "禾本科", "菊科", "豆科", "毛茛科", "木贼科", "针叶", "卷须", "藤本", "草本", "灌木",
  "乔木", "球状", "舌状花", "管状花", "掌状复叶", "羽状复叶", "肉质", "有刺", "有毛",
  "中空", "有节", "孢子囊穗", "多年生", "一年生",
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[，。！？、；：,.!?;:（）()\s]+/g, " ").trim();
}

function extractTerms(query, featureIndex) {
  const normalized = normalize(query);
  const indexedTerms = featureIndex
    .map((record) => record.value)
    .filter((value) => value && value.length >= 2 && normalized.includes(normalize(value)));
  const knownTerms = [...Object.values(TERM_GROUPS).flat(), ...EXTRA_TERMS]
    .filter((term) => normalized.includes(normalize(term)));
  const words = normalized.split(" ").filter((word) => word.length >= 2 && word.length <= 10);
  return unique([...indexedTerms, ...knownTerms, ...words]);
}

function conflictingTerms(searchText, requested) {
  const conflicts = [];
  Object.entries(TERM_GROUPS).forEach(([group, terms]) => {
    if (group === "生境") return;
    const requestedInGroup = terms.filter((term) => requested.includes(term));
    if (!requestedInGroup.length) return;
    const observed = terms.filter((term) => searchText.includes(normalize(term)) && !requestedInGroup.includes(term));
    if (observed.length) conflicts.push(`${group}记录为${observed.slice(0, 2).join("或")}`);
  });
  return conflicts;
}

function nextObservation(plant, unknowns) {
  const suggestions = plant.identification.suggestedParts || [];
  if (unknowns.some((term) => term.includes("花") || TERM_GROUPS.花色.includes(term))) {
    return "补拍花的正面与完整花序侧面，确认花色、对称性和花序结构。";
  }
  if (unknowns.some((term) => term.includes("叶") || TERM_GROUPS.叶序.includes(term))) {
    return "沿连续茎节拍摄叶片正反面，确认叶序、叶缘和叶柄。";
  }
  if (suggestions.length) return `下一步重点观察：${suggestions.slice(0, 3).join("、")}。`;
  return "补充全株、生境和花或果实特写，再进行二次筛选。";
}

function levelFor(score, supportCount, conflictCount) {
  if (supportCount >= 3 && conflictCount === 0 && score >= 8) return "高度匹配";
  if (supportCount >= 2 && conflictCount <= 1) return "较为匹配";
  if (supportCount >= 1) return "可能相关";
  return "需进一步观察";
}

function comparePlants(query, plants) {
  const mentioned = plants.filter((plant) => {
    const names = [plant.names.chinese, ...(plant.names.alias || "").split(/[、，,]/)];
    return names.some((name) => name && query.includes(name));
  });
  if (!/(区分|区别|对比|比较)/.test(query) || mentioned.length < 2) return null;
  const pair = mentioned.slice(0, 2);
  const fields = [
    ["整体", (plant) => plant.morphology.appearance],
    ["茎", (plant) => plant.morphology.stem.description || plant.morphology.stem.structure],
    ["叶", (plant) => plant.morphology.leaf.description || plant.morphology.leaf.arrangement],
    ["繁殖结构", (plant) => plant.morphology.fruit.description || plant.morphology.flower.description],
    ["生境", (plant) => plant.ecology.habitat],
  ];
  return {
    mode: "comparison", query, plants: pair,
    rows: fields.map(([label, getter]) => ({ label, values: pair.map((plant) => getter(plant) || "待补充") })),
    nextObservation: "先比较茎的分枝与节间，再观察孢子囊穗或其他繁殖结构；不要只凭整体轮廓判断。",
  };
}

export function assistantEngine(query, knowledgeBase) {
  const plants = knowledgeBase?.plants || [];
  const featureIndex = knowledgeBase?.featureIndex || [];
  const normalized = normalize(query);
  if (!normalized) return { mode: "empty", query: "", features: [], candidates: [] };
  const comparison = comparePlants(query, plants);
  if (comparison) return comparison;

  const terms = extractTerms(query, featureIndex);
  const matchingIndex = featureIndex.filter((record) => terms.some((term) => normalize(record.value).includes(normalize(term)) || normalize(term).includes(normalize(record.value))));
  const indexedByPlant = new Map();
  matchingIndex.forEach((record) => record.plantIds.forEach((plantId) => {
    if (!indexedByPlant.has(plantId)) indexedByPlant.set(plantId, []);
    indexedByPlant.get(plantId).push(record);
  }));

  const candidates = plants.map((plant) => {
    const search = normalize(plant.searchText);
    const directName = [plant.names.chinese, plant.names.latin, plant.names.alias]
      .filter(Boolean).some((name) => normalized.includes(normalize(name)) || normalize(name).includes(normalized));
    const supports = terms.filter((term) => search.includes(normalize(term)));
    const indexSupports = (indexedByPlant.get(plant.id) || []).map((record) => `${record.category}：${record.value}`);
    const supportFeatures = unique([...supports, ...indexSupports]);
    const conflicts = conflictingTerms(search, terms);
    const unknowns = terms.filter((term) => !search.includes(normalize(term)) && !indexSupports.some((item) => item.includes(term)));
    const taxonomySupport = terms.filter((term) => [plant.taxonomy.family, plant.taxonomy.genus].some((value) => normalize(value) === normalize(term))).length;
    const score = (directName ? 14 : 0) + supportFeatures.length * 3 + indexSupports.length * 2 + taxonomySupport * 6 - conflicts.length * 3;
    return {
      plant, matchLevel: levelFor(score, supportFeatures.length, conflicts.length),
      supportFeatures: supportFeatures.slice(0, 6), conflictFeatures: conflicts.slice(0, 3),
      pendingFeatures: unknowns.slice(0, 4), nextObservation: nextObservation(plant, unknowns),
      sources: unique([plant.sources.iplantUrl ? "iPlant 物种资料" : "", ...indexSupports.map(() => "特征反向索引"), "01植物部位特征"]),
      _score: score,
    };
  }).filter((candidate) => candidate._score > 0)
    .sort((a, b) => b._score - a._score || a.plant.serial - b.plant.serial);

  return {
    mode: "identification", query, features: terms, candidates,
    disclaimer: "本地候选结果基于结构化字段与反向索引，不代表模型鉴定结论。",
  };
}

export default assistantEngine;

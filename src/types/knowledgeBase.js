/**
 * @typedef {Object} SampleImage
 * @property {string} id
 * @property {string} plantId
 * @property {string} submittedName
 * @property {string} organLabel
 * @property {boolean} matched
 * @property {"已挂接"|"待复核"} reviewStatus
 * @property {string} displayUrl
 * @property {string} thumbnailUrl
 * @property {string} submittedAt
 */

/**
 * @typedef {Object} PlantRecordV2
 * @property {string} id HBFC-xxx 主 ID
 * @property {string} legacyId Pxxx 旧 ID
 * @property {{chinese:string, alias:string, latin:string, originalChinese:string, originalLatin:string}} names
 * @property {{family:string, familyLatin:string, genus:string, genusLatin:string}} taxonomy
 * @property {{lifeForm:string, habitat:string}} ecology
 * @property {{introduction:string, habitatNote:string, sourceIntroduction:string}} profile
 * @property {Object} morphology
 * @property {{quickMethod:string, keyCombination:string, suggestedParts:string[], steps:string[]}} identification
 * @property {{localSamples:SampleImage[], iplantReferences:Object[], status:Object}} media
 * @property {{completeness:number, needsReview:boolean, reviewFlags:string[], revisions:Object[]}} quality
 * @property {Object} sources
 * @property {string} searchText
 */

/** @typedef {{id:string, organ:string, category:string, value:string, beginnerExplanation:string, plantCount:number, plantNames:string[], plantIds:string[], recommendedPart:string, example:string, note:string}} FeatureIndexRecord */
/** @typedef {{id:string, organ:string, term:string, explanation:string, captureMethod:string, indexField:string, namingExample:string}} GlossaryTerm */
/** @typedef {{id:string, subject:string, minimumCount:number, requirement:string, commonIssue:string, partCode:string}} CaptureChecklistItem */
/** @typedef {{plants:PlantRecordV2[], featureIndex:FeatureIndexRecord[], glossary:GlossaryTerm[], captureChecklist:CaptureChecklistItem[], pendingSamples:SampleImage[], summary:Object}} KnowledgeBaseV2 */

export {};

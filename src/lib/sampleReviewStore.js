const STORAGE_KEY = "bashang-imported-sample-reviews-v1";

export function loadImportedReviews() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveImportedReview(sampleId, decision) {
  const reviews = loadImportedReviews();
  reviews[sampleId] = { ...decision, sampleId, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  return reviews[sampleId];
}

export function exportReviewFile(records) {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bashang-sample-reviews-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

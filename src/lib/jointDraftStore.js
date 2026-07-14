const DB_NAME = "bashang-plant-assistant-drafts";
const STORE_NAME = "joint-identification";
const DB_VERSION = 1;
const DRAFT_ID = "active";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function loadJointDraft() {
  return transact("readonly", (store) => store.get(DRAFT_ID));
}

export async function saveJointDraft(draft) {
  return transact("readwrite", (store) => store.put({
    id: DRAFT_ID,
    updatedAt: new Date().toISOString(),
    query: draft.query || "",
    conditions: draft.conditions || null,
    submitted: draft.submitted || "",
    entries: (draft.entries || []).map((entry) => ({ file: entry.file, part: entry.part })),
    modelResult: draft.modelResult || null,
    imageCheck: draft.imageCheck || null,
    message: draft.message || "",
  }));
}

export async function clearJointDraft() {
  return transact("readwrite", (store) => store.delete(DRAFT_ID));
}

export async function loadVisionDraft() {
  return transact("readonly", (store) => store.get("vision"));
}

export async function saveVisionDraft(draft) {
  return transact("readwrite", (store) => store.put({
    id: "vision",
    updatedAt: new Date().toISOString(),
    mode: draft.mode || "check",
    submission: draft.submission || null,
    entries: (draft.entries || []).map((entry) => ({ file: entry.file, part: entry.part })),
    result: draft.result || null,
    modelResult: draft.modelResult || null,
    message: draft.message || "",
  }));
}

export async function clearVisionDraft() {
  return transact("readwrite", (store) => store.delete("vision"));
}

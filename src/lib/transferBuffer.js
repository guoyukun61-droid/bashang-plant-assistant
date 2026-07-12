let transferredFiles = [];

export function setTransferredFiles(files) {
  transferredFiles = Array.from(files || []);
}

export function consumeTransferredFiles() {
  const files = transferredFiles;
  transferredFiles = [];
  return files;
}

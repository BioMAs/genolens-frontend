/**
 * Records the files a component hands to the browser, so a test can assert on what a user
 * would actually receive (name and content) rather than on which helper was called.
 *
 * Every download in the app ends in `URL.createObjectURL(blob)` followed by an anchor click;
 * jsdom implements neither, so both are replaced here and the blob read back as text.
 */
export interface CapturedDownload {
  filename: string;
  text: string;
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

export function captureDownloads() {
  const blobs = new Map<string, Blob>();
  const pending: Promise<CapturedDownload>[] = [];
  let counter = 0;

  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:test/${counter++}`;
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = () => {};

  const clickSpy = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      const blob = blobs.get(this.href);
      if (!blob) return;
      const filename = this.download;
      pending.push(readBlob(blob).then((text) => ({ filename, text })));
    });

  return {
    /** Every file downloaded so far, in order. */
    files: () => Promise.all(pending),
    count: () => pending.length,
    restore: () => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    },
  };
}

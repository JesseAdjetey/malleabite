// Canvas file-upload helper.
//
// Canvas's submission upload is a 3-step protocol:
//   1. Ask Canvas for a signed upload URL + form params  (our server does this
//      via canvasGetUploadUrl, which has the user's encrypted API token).
//   2. POST the actual file bytes (multipart) directly to that signed URL.
//      Canvas returns a file_id.
//   3. Submit the assignment referencing the file_id (canvasSubmit).
//
// This module owns step 2 — step 1 lives in the canvasGetUploadUrl Cloud
// Function, and step 3 is canvasSubmit. Bytes never touch our Cloud
// Functions, which keeps invocation cost low and avoids size limits.

import { getFunctions, httpsCallable } from 'firebase/functions';

export interface UploadProgress {
  loaded: number;
  total: number;
  pct: number;
}

export interface UploadResult {
  fileId: string;
}

/**
 * Upload a single file to Canvas as part of an assignment submission.
 * Resolves with the file_id assigned by Canvas, which can then be passed
 * to canvasSubmit. Rejects with an Error whose message is suitable for
 * direct toast display.
 */
export async function uploadFileToCanvas(
  assignmentId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void
): Promise<UploadResult> {
  const functions = getFunctions();

  // Step 1 — get signed upload URL from our backend.
  const getUploadUrl = httpsCallable<
    { assignmentId: string; name: string; size: number; contentType: string },
    { uploadUrl: string; uploadParams: Record<string, string> }
  >(functions, 'canvasGetUploadUrl');

  const step1 = await getUploadUrl({
    assignmentId,
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
  });

  const { uploadUrl, uploadParams } = step1.data;

  // Step 2 — POST the file bytes directly to Canvas's storage URL.
  // Canvas requires multipart/form-data with the upload_params followed
  // by the file as the LAST field (their docs are explicit about ordering).
  const form = new FormData();
  for (const [k, v] of Object.entries(uploadParams)) form.append(k, v);
  form.append('file', file);

  const result = await postWithProgress(uploadUrl, form, onProgress);

  // Canvas responds with the file JSON. The id field is what we need.
  if (!result || typeof result !== 'object' || !('id' in result)) {
    throw new Error('Canvas upload did not return a file id');
  }
  return { fileId: String((result as { id: string | number }).id) };
}

/**
 * Wraps XHR (not fetch) because fetch has no upload-progress events in
 * any browser as of 2026. Yes, really.
 */
function postWithProgress(
  url: string,
  form: FormData,
  onProgress?: (p: UploadProgress) => void
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress({ loaded: e.loaded, total: e.total, pct: (e.loaded / e.total) * 100 });
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Canvas upload returned non-JSON response'));
        }
      } else {
        reject(new Error(`Canvas upload failed: ${xhr.status} ${xhr.responseText.slice(0, 200)}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error while uploading to Canvas')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.send(form);
  });
}

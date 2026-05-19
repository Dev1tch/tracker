import { apiClient } from './client.js';

/**
 * Uploaded media object metadata.
 * @typedef {Object} MediaUploadResult
 * @property {string} id
 * @property {string} user_id
 * @property {'notes'|'board'} kind
 * @property {string} storage_path
 * @property {string} url
 * @property {string|null} mime
 * @property {number|null} size_bytes
 * @property {string} created_at
 */

export class MediaApi {
  /**
   * Upload a single image. Returns the public URL the document should embed.
   * @param {{ file: File|Blob, kind: 'notes'|'board', filename?: string }} opts
   * @returns {Promise<MediaUploadResult>}
   */
  async upload({ file, kind, filename }) {
    if (!file) throw new Error('media.upload: file is required.');
    if (kind !== 'notes' && kind !== 'board') {
      throw new Error("media.upload: kind must be 'notes' or 'board'.");
    }
    const form = new FormData();
    form.append('kind', kind);
    const name = filename || (file instanceof File ? file.name : 'upload.bin');
    form.append('file', file, name);

    /* Don't set Content-Type explicitly — the browser must add the multipart
       boundary. The api client only auto-applies JSON when body isn't FormData. */
    return apiClient.request('/media/', {
      method: 'POST',
      body: form,
    });
  }
}

export const mediaApi = new MediaApi();

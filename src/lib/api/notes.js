import { apiClient } from './client.js';

/**
 * Server-side notes document (single-blob LWW).
 * @typedef {Object} NotesDocumentData
 * @property {string} user_id
 * @property {*} tree
 * @property {number} version
 * @property {string} updated_at
 */

export class NotesApi {
  async getDocument() {
    const data = await apiClient.get('/notes/');
    return normalizeDocument(data);
  }

  /** Unconditionally overwrite the user's notes document. */
  async updateDocument({ tree }) {
    const data = await apiClient.put('/notes/', { tree });
    return normalizeDocument(data);
  }
}

function normalizeDocument(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    user_id: data.user_id || null,
    tree: data.tree ?? [],
    version: Number.isFinite(data.version) ? data.version : Number(data.version) || 0,
    updated_at: data.updated_at || null,
  };
}

export const notesApi = new NotesApi();

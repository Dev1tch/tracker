import { apiClient } from './client.js';

/**
 * Server-side notes document (single-blob LWW).
 * @typedef {Object} NotesDocumentData
 * @property {string} user_id
 * @property {*} tree
 * @property {number} version
 * @property {string} updated_at
 */

export class NotesConflictError extends Error {
  constructor(document) {
    super('Notes document version is out of date.');
    this.name = 'NotesConflictError';
    this.document = document;
  }
}

export class NotesApi {
  async getDocument() {
    const data = await apiClient.get('/notes/');
    return normalizeDocument(data);
  }

  /**
   * Persist the tree if the server's version matches base_version.
   * Throws NotesConflictError (with the server's current document) on 409.
   */
  async updateDocument({ tree, baseVersion }) {
    try {
      const data = await apiClient.put('/notes/', {
        tree,
        base_version: baseVersion,
      });
      return normalizeDocument(data);
    } catch (err) {
      if (err?.status === 409 && err?.data?.document) {
        throw new NotesConflictError(normalizeDocument(err.data.document));
      }
      throw err;
    }
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

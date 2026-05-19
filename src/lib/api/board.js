import { apiClient } from './client.js';

/**
 * Server-side board document (single-blob LWW).
 * @typedef {Object} BoardDocumentData
 * @property {string} user_id
 * @property {{ nodes:any[], edges:any[], frames:any[], viewport:any }} state
 * @property {number} version
 * @property {string} updated_at
 */

export class BoardConflictError extends Error {
  constructor(document) {
    super('Board document version is out of date.');
    this.name = 'BoardConflictError';
    this.document = document;
  }
}

export class BoardApi {
  async getDocument() {
    const data = await apiClient.get('/board/');
    return normalizeDocument(data);
  }

  async updateDocument({ state, baseVersion }) {
    try {
      const data = await apiClient.put('/board/', {
        state,
        base_version: baseVersion,
      });
      return normalizeDocument(data);
    } catch (err) {
      if (err?.status === 409 && err?.data?.document) {
        throw new BoardConflictError(normalizeDocument(err.data.document));
      }
      throw err;
    }
  }
}

function normalizeDocument(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    user_id: data.user_id || null,
    state: data.state ?? {
      nodes: [],
      edges: [],
      frames: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    version: Number.isFinite(data.version) ? data.version : Number(data.version) || 0,
    updated_at: data.updated_at || null,
  };
}

export const boardApi = new BoardApi();

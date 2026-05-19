import { apiClient } from './client.js';

/**
 * Server-side board document (single-blob LWW).
 * @typedef {Object} BoardDocumentData
 * @property {string} user_id
 * @property {{ nodes:any[], edges:any[], frames:any[], viewport:any }} state
 * @property {number} version
 * @property {string} updated_at
 */

export class BoardApi {
  async getDocument() {
    const data = await apiClient.get('/board/');
    return normalizeDocument(data);
  }

  async updateDocument({ state }) {
    const data = await apiClient.put('/board/', { state });
    return normalizeDocument(data);
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

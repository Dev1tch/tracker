import { apiClient } from './client.js';

/**
 * Server-side board document (single-blob LWW).
 * @typedef {Object} BoardDocumentData
 * @property {string} user_id
 * @property {{ boards?:any[], activeBoardId?:string, nodes?:any[], edges?:any[], frames?:any[], viewport?:any }} state
 * @property {number} version
 * @property {string} updated_at
 */

export class BoardApi {
  async getDocument() {
    const data = await apiClient.get('/board/');
    return normalizeDocument(data);
  }

  async updateDocument({ state, baseVersion, allowEmptyOverwrite = false }) {
    const data = await apiClient.put('/board/', {
      state: stripInlineImageNodes(state),
      base_version: Number.isFinite(baseVersion) ? baseVersion : null,
      allow_empty_overwrite: allowEmptyOverwrite,
    });
    return normalizeDocument(data);
  }
}

/**
 * The board syncs as one JSON blob through a serverless function capped at
 * ~4.5MB. Inline base64 `data:` images are often megabytes each, so a single
 * un-uploaded image can blow past the cap and break every save AND load
 * (413 FUNCTION_PAYLOAD_TOO_LARGE). Images belong in storage, referenced by
 * URL; base64 must never reach the server. Image nodes whose src is still a
 * data: URL (upload pending or failed) are dropped from the synced payload —
 * they stay in the local cache and reappear once their upload completes.
 */
export function stripInlineImageNodes(state) {
  if (!state || typeof state !== 'object') return state;
  const isInline = (node) =>
    node?.type === 'image' && typeof node.src === 'string' && node.src.startsWith('data:');
  const clean = (nodes) => (Array.isArray(nodes) ? nodes.filter((n) => !isInline(n)) : nodes);
  if (Array.isArray(state.boards)) {
    return { ...state, boards: state.boards.map((b) => ({ ...b, nodes: clean(b.nodes) })) };
  }
  if (Array.isArray(state.nodes)) {
    return { ...state, nodes: clean(state.nodes) };
  }
  return state;
}

function normalizeDocument(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    user_id: data.user_id || null,
    state: data.state ?? {
      boards: [{
        id: 'board-1',
        label: '1',
        nodes: [],
        edges: [],
        frames: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      }],
      activeBoardId: 'board-1',
    },
    version: Number.isFinite(data.version) ? data.version : Number(data.version) || 0,
    updated_at: data.updated_at || null,
  };
}

export const boardApi = new BoardApi();

'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bold,
  Brush as BrushIcon,
  Calendar,
  ChevronRight,
  Eraser,
  ExternalLink,
  Frame as FrameIcon,
  Image as ImageIcon,
  Italic,
  Layers,
  Link as LinkIcon,
  ListTodo,
  List,
  Maximize,
  MousePointer2,
  Pencil as PencilIcon,
  PenTool as PenIcon,
  RefreshCw,
  Search,
  Trash2,
  Type,
  Underline,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';
import CustomSelect from '@/components/ui/CustomSelect';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { tasksApi, TASK_STATUS } from '@/features/tasks/api';
import { boardApi, mediaApi } from '@/lib/api';
import { useDocumentSync } from '@/lib/sync/useDocumentSync';
import TaskDetailModal from '@/features/tasks/components/TasksBoard/components/TaskDetailModal';
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
  STATUS_ORDER,
} from '@/features/tasks/constants/task-board.constants';
import { formatPriority, formatStatus } from '@/features/tasks/utils/task-formatters';
import { buildUpdatePayload } from '@/features/tasks/utils/task-form.utils';
import { formatShortDate, toIsoOrNull } from '@/features/tasks/utils/task-date.utils';
import '@/features/tasks/components/TasksBoard/TasksBoard.css';
import '@/features/tasks/components/TasksBoard/components/TasksListMobile.css';
import './Board.css';

const STORAGE_KEY = 'board.state';
const BOARD_DB_NAME = 'sal-board';
const BOARD_DB_STORE = 'state';
const BOARD_DB_KEY = 'current';
const BOARD_DB_META_KEY = 'sync-meta';
const BOARD_DB_VERSION = 1;
const BOARD_PERSIST_DEBOUNCE_MS = 250;
const BOARD_SYNC_DEBOUNCE_MS = 900;
const MAX_IMAGE_WIDTH = 320;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const MIN_NODE_SIZE = 30;
const MIN_FRAME_SIZE = 60;
const FRAME_COLORS = [
  '#f87171', // red
  '#60a5fa', // blue
  '#34d399', // green
  '#fbbf24', // amber
  '#a78bfa', // violet
  '#f472b6', // pink
  '#2dd4bf', // teal
  '#fb923c', // orange
];
const BOARD_HISTORY_LIMIT = 80;
const URL_PATTERN = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i;

function normalizeUrl(value) {
  const text = (value || '').trim();
  if (!URL_PATTERN.test(text)) return null;
  return text.startsWith('http://') || text.startsWith('https://')
    ? text
    : `https://${text}`;
}

function getLinkPreview(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const path = `${parsed.pathname || ''}${parsed.search || ''}`.replace(/\/$/, '');
    return {
      hostname,
      title: hostname,
      subtitle: path && path !== '/' ? path : parsed.protocol.replace(':', ''),
      favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`,
    };
  } catch {
    return {
      hostname: url,
      title: url,
      subtitle: 'link',
      favicon: '',
    };
  }
}

function getDescriptionPreview(text, maxLength = 110) {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatSpentTime(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

function getNormalizedSubtaskPayload(parentId, form) {
  return {
    title: form.title.trim(),
    description: form.description || null,
    task_type_id: form.task_type_id || null,
    parent_task_id: parentId,
    status: form.status,
    priority: form.priority,
    start_date: toIsoOrNull(form.start_date),
    due_date: toIsoOrNull(form.due_date),
  };
}
const WHEEL_ZOOM_STEP = 1.04;
const MOUSE_WHEEL_ZOOM_STEP = 1.12;
const BUTTON_ZOOM_STEP = 1.1;
const ALIGN_GUIDE_TOLERANCE_PX = 6;
const ALIGN_GUIDE_PADDING = 28;
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const PASTED_TEXT_SCREEN_WIDTH = 420;
const DEFAULT_LINK_PREVIEW_WIDTH = 280;
const DEFAULT_LINK_PREVIEW_HEIGHT = 150;
const DEFAULT_TASK_NODE_WIDTH = 280;
const DEFAULT_TASK_NODE_HEIGHT = 92;
const DEFAULT_TASK_DETAIL_WIDTH = 950;
const DEFAULT_TASK_DETAIL_HEIGHT = 730;
const BOARD_TASK_CARD_VIEW_SETTINGS = {
  title: true,
  description: true,
  status: true,
  task_type: true,
  priority: true,
  start_date: false,
  due_date: true,
  created_at: false,
  total_spent_time_minutes: true,
};
const BOARD_STATUS_COLORS = {
  [TASK_STATUS.TO_DO]: '#94a3b8',
  [TASK_STATUS.IN_PROGRESS]: '#60a5fa',
  [TASK_STATUS.PAUSED]: '#9ca3af',
  [TASK_STATUS.IN_REVIEW]: '#fbbf24',
  [TASK_STATUS.COMPLETED]: '#34d399',
  [TASK_STATUS.CANCELLED]: '#f87171',
  [TASK_STATUS.ARCHIVED]: '#6b7280',
};
const DEFAULT_ARROW_STROKE_WIDTH = 1.6;
const DRAWING_TOOLS = ['pen', 'pencil', 'brush'];
const ERASER_TOOL = 'eraser';
const MARKUP_TOOLS = [...DRAWING_TOOLS, ERASER_TOOL];
const DRAWING_COLOR_PRESETS = [
  '#ffffff',
  '#0f172a',
  '#94a3b8',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#f472b6',
  '#2dd4bf',
  '#fb923c',
  '#c084fc',
];
const DRAWING_DEFAULTS = {
  pen: { thickness: 2, color: '#ffffff' },
  pencil: { thickness: 1.4, color: '#cbd5e1' },
  brush: { thickness: 8, color: '#60a5fa' },
  eraser: { thickness: 18 },
};
const TEXT_FONT_OPTIONS = [
  { label: 'System', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Inter', value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Arial Black', value: '"Arial Black", Gadget, sans-serif' },
  { label: 'Aptos', value: 'Aptos, Calibri, "Segoe UI", sans-serif' },
  { label: 'Calibri', value: 'Calibri, Candara, "Segoe UI", sans-serif' },
  { label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { label: 'Candara', value: 'Candara, Calibri, "Segoe UI", sans-serif' },
  { label: 'Consolas', value: 'Consolas, "Liberation Mono", monospace' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Garamond', value: 'Garamond, Georgia, serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { label: 'Lucida Console', value: '"Lucida Console", Monaco, monospace' },
  { label: 'Menlo', value: 'Menlo, Monaco, Consolas, monospace' },
  { label: 'Monaco', value: 'Monaco, "Lucida Console", monospace' },
  { label: 'Palatino', value: 'Palatino, "Palatino Linotype", Georgia, serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

function quoteFontFamily(family) {
  return `"${String(family).replace(/"/g, '\\"')}", sans-serif`;
}

function normalizeFontFamilyFirst(value) {
  return String(value || '')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
}

function mergeFontOptions(...groups) {
  const seen = new Set();
  const merged = [];
  groups.flat().forEach((option) => {
    if (!option?.label || !option?.value) return;
    const key = option.label.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(option);
  });
  return merged;
}

const HANDLE_DIRS = {
  tl: { sx: -1, sy: -1, cursor: 'nwse-resize' },
  t:  { sx:  0, sy: -1, cursor: 'ns-resize'  },
  tr: { sx:  1, sy: -1, cursor: 'nesw-resize' },
  r:  { sx:  1, sy:  0, cursor: 'ew-resize'  },
  br: { sx:  1, sy:  1, cursor: 'nwse-resize' },
  b:  { sx:  0, sy:  1, cursor: 'ns-resize'  },
  bl: { sx: -1, sy:  1, cursor: 'nesw-resize' },
  l:  { sx: -1, sy:  0, cursor: 'ew-resize'  },
};
const HANDLE_IDS = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyBoardState() {
  return { nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT };
}

function normalizeBoardState(parsed) {
  if (!parsed || typeof parsed !== 'object') return emptyBoardState();
  const nodes = Array.isArray(parsed.nodes)
    ? parsed.nodes.map((node) => {
        if (node?.type === 'text' && node.href) {
          return {
            ...node,
            type: 'link',
            href: node.href,
            w: node.w || DEFAULT_LINK_PREVIEW_WIDTH,
            h: node.h || DEFAULT_LINK_PREVIEW_HEIGHT,
            html: undefined,
            content: undefined,
          };
        }
        return node;
      })
    : [];
  return {
    nodes,
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    frames: Array.isArray(parsed.frames) ? parsed.frames : [],
    viewport:
      parsed.viewport && typeof parsed.viewport === 'object'
        ? { ...DEFAULT_VIEWPORT, ...parsed.viewport }
        : DEFAULT_VIEWPORT,
  };
}

function loadLegacyLocalState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeBoardState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function openBoardDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    let req;
    try {
      req = window.indexedDB.open(BOARD_DB_NAME, BOARD_DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOARD_DB_STORE)) {
        db.createObjectStore(BOARD_DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

async function idbGetBoardState() {
  const db = await openBoardDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(BOARD_DB_STORE, 'readonly');
      const req = tx.objectStore(BOARD_DB_STORE).get(BOARD_DB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbPutBoardState(state) {
  const db = await openBoardDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(BOARD_DB_STORE, 'readwrite');
      tx.objectStore(BOARD_DB_STORE).put(state, BOARD_DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbGetBoardSyncMeta() {
  try {
    const db = await openBoardDB();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(BOARD_DB_STORE, 'readonly');
        const req = tx.objectStore(BOARD_DB_STORE).get(BOARD_DB_META_KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

async function idbPutBoardSyncMeta(meta) {
  try {
    const db = await openBoardDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(BOARD_DB_STORE, 'readwrite');
        tx.objectStore(BOARD_DB_STORE).put(meta, BOARD_DB_META_KEY);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* meta is non-critical */
  }
}

/* Synchronous initial state used for first paint. IndexedDB hydration
   replaces this asynchronously on mount — see hydration effect. */
function loadState() {
  return loadLegacyLocalState() || emptyBoardState();
}

/* A node's center point — used to decide whether it sits inside a frame. */
function nodeCenterCoords(node, bounds) {
  const w = bounds[node.id]?.w ?? node.w ?? 100;
  const h = bounds[node.id]?.h ?? node.h ?? 40;
  return { x: node.x + w / 2, y: node.y + h / 2 };
}

function frameContains(frame, node, bounds) {
  const c = nodeCenterCoords(node, bounds);
  return (
    c.x >= frame.x &&
    c.x <= frame.x + frame.w &&
    c.y >= frame.y &&
    c.y <= frame.y + frame.h
  );
}

function nodesInsideFrame(frame, nodes, bounds) {
  return nodes.filter((n) => frameContains(frame, n, bounds));
}

function nodeTransform(node) {
  return node.rotation ? `rotate(${node.rotation}deg)` : undefined;
}

function serializeBoardState(nodes, edges) {
  return JSON.stringify({ nodes, edges });
}

function isTextInputTarget(target) {
  return (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  );
}

function readEditablePlainText(root) {
  if (!root) return '';
  const parts = [];

  function pushLineBreak() {
    if (parts.length === 0 || parts[parts.length - 1] === '\n') return;
    parts.push('\n');
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.nodeValue || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tagName = node.tagName;
    if (tagName === 'BR') {
      parts.push('\n');
      return;
    }

    const isBlockLine = tagName === 'DIV' || tagName === 'P' || tagName === 'LI';
    if (isBlockLine) pushLineBreak();
    node.childNodes.forEach(walk);
  }

  root.childNodes.forEach(walk);
  return parts.join('').replace(/\n+$/, '');
}

function sanitizeTextHtml(root) {
  if (!root) return '';
  const clone = root.cloneNode(true);
  clone.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name !== 'style' && name !== 'href') {
        el.removeAttribute(attr.name);
      }
    });
  });
  return clone.innerHTML;
}

/* Selection stash so the inline formatting commands keep working even after
   the toolbar's controls (dropdown trigger, search input, color picker)
   steal focus from the contentEditable. We capture the range on toolbar
   mousedown and replay it onto the contentEditable just before each
   `document.execCommand` call. */
let savedTextSelection = null;

function captureTextSelection() {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  const editing = document.querySelector('.boardTextNode.editing .boardTextContent');
  // Only stash the range while it's still inside the editing text — once
  // focus moves to a toolbar input the selection there is irrelevant.
  if (editing && editing.contains(range.commonAncestorContainer)) {
    savedTextSelection = range.cloneRange();
  }
}

function applyFontSizeToEditingText(size) {
  const editing = document.querySelector('.boardTextNode.editing .boardTextContent');
  if (!editing) return;
  const normalized = Math.max(8, Math.min(120, Math.round(size)));

  // Snapshot the intended range BEFORE focusing. The selectionchange listener
  // that keeps savedTextSelection up to date can overwrite it with a
  // collapsed caret in the gap between focus() and our explicit restore.
  const intendedRange = savedTextSelection
    ? savedTextSelection.cloneRange()
    : null;

  editing.focus();

  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel) return;

  sel.removeAllRanges();
  if (
    intendedRange &&
    editing.contains(intendedRange.commonAncestorContainer)
  ) {
    sel.addRange(intendedRange);
  } else {
    const fallback = document.createRange();
    fallback.selectNodeContents(editing);
    fallback.collapse(false);
    sel.addRange(fallback);
  }

  const range = sel.getRangeAt(0);

  if (!range.collapsed) {
    // Wrap the selection directly in a styled span. We deliberately avoid
    // execCommand('fontSize') here: in styleWithCSS mode it produces
    // `<span style="font-size: xx-large">` (a CSS keyword, not a px value),
    // and the historical post-pass that converted `<font size="7">` to a px
    // span finds nothing to fix up.
    const span = document.createElement('span');
    span.style.fontSize = `${normalized}px`;
    try {
      range.surroundContents(span);
    } catch {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }

    const next = document.createRange();
    next.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(next);
    savedTextSelection = next.cloneRange();
    return;
  }

  // Collapsed cursor: drop a styled span around two zero-width caret holders
  // and park the caret between them. Using two ZWSPs keeps the caret away
  // from the span's trailing edge so subsequent typing stays inside the span
  // across browsers.
  const span = document.createElement('span');
  span.style.fontSize = `${normalized}px`;
  const caretText = document.createTextNode('​​');
  span.appendChild(caretText);
  range.insertNode(span);

  const caret = document.createRange();
  caret.setStart(caretText, 1);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
  savedTextSelection = caret.cloneRange();
}

/* applyFontFamilyToEditingText removed: font family is now stored on the
   node (node.fontFamily) and applied as an inline style to the whole text,
   so we no longer need a per-selection execCommand path. */

/* ---------- Anchor handles ----------
   Four small dots on the edges of any connectable item. Visible when the
   user is in arrow tool and hovers the item (CSS-driven) or when the item
   is the active arrow source. Clicking a dot starts/completes the arrow on
   that specific side; clicking the item body keeps the existing auto-pick
   behaviour. */
const ANCHOR_SIDES = ['top', 'right', 'bottom', 'left'];

function AnchorHandles({ active, activeSide, zoom = 1, onPickSide }) {
  if (!active) return null;
  const scale = 1 / Math.max(zoom, 0.0001);
  return (
    <div className="boardAnchorHandles" aria-hidden={!onPickSide}>
      {ANCHOR_SIDES.map((side) => (
        <button
          key={side}
          type="button"
          className={`boardAnchorHandle boardAnchorHandle-${side} ${activeSide === side ? 'active' : ''}`}
          style={{ '--anchor-scale': scale }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onPickSide?.(side);
          }}
          aria-label={`Connect from ${side}`}
        />
      ))}
    </div>
  );
}

/* ---------- Text node ---------- */
function TextNode({
  node,
  editing,
  selected,
  connected,
  tool,
  zoom,
  arrowActive,
  arrowActiveSide,
  onPickAnchor,
  registerRef,
  onDoubleClick,
  onMouseDown,
  onClick,
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (node.html) {
      if (el.innerHTML !== node.html) el.innerHTML = node.html;
    } else if (!editing && el.textContent !== (node.content || '')) {
      el.textContent = node.content || '';
    }
  }, [node.content, node.html, editing]);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editing]);

  const hasExplicitSize = node.w != null;

  return (
    <div
      className={`boardNode boardTextNode ${selected ? 'selected' : ''} ${connected ? 'connected' : ''} ${editing ? 'editing' : ''} ${tool === 'arrow' ? 'arrowTarget' : ''} ${hasExplicitSize ? 'sized' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        fontSize: node.fontSize ? `${node.fontSize}px` : undefined,
        fontFamily: node.fontFamily || undefined,
        color: node.color || undefined,
        fontWeight: node.bold ? 700 : undefined,
        fontStyle: node.italic ? 'italic' : undefined,
        textDecoration: node.underline ? 'underline' : undefined,
        textAlign: node.align || undefined,
        lineHeight: 1.3,
        transform: nodeTransform(node),
        transformOrigin: 'center',
      }}
      ref={(el) => registerRef(node.id, el)}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={() => onDoubleClick(node.id)}
    >
      {node.href && !editing ? (
        <a
          ref={ref}
          className="boardTextContent boardTextLink"
          href={node.href}
          target="_blank"
          rel="noreferrer"
          draggable={false}
          onClick={(e) => {
            if (!selected) {
              e.preventDefault();
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
          }}
        >
          {node.content || node.href}
        </a>
      ) : (
        // We deliberately render no children / no dangerouslySetInnerHTML
        // here. The useLayoutEffect above is the single source of truth for
        // the contentEditable's innerHTML — leaving React to manage it via
        // dangerouslySetInnerHTML caused React to re-apply the stale
        // node.html on every re-render of the editing node, which silently
        // wiped each keystroke the user typed.
        <div
          ref={ref}
          className="boardTextContent"
          contentEditable={editing}
          suppressContentEditableWarning
          onMouseDown={editing ? (e) => e.stopPropagation() : undefined}
        />
      )}
      {tool === 'arrow' && !editing ? (
        <AnchorHandles
          active
          activeSide={arrowActive ? arrowActiveSide : null}
          zoom={zoom}
          onPickSide={onPickAnchor}
        />
      ) : null}
    </div>
  );
}

function pointsToSmoothPath(points) {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  // Catmull-Rom-style smoothing: draw a quadratic to each midpoint using the
  // previous point as the control point, so the line passes through every
  // sampled point without harsh corners.
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    d += ` Q${curr.x},${curr.y} ${mx},${my}`;
  }
  const lastPrev = points[points.length - 2];
  const last = points[points.length - 1];
  d += ` Q${lastPrev.x},${lastPrev.y} ${last.x},${last.y}`;
  return d;
}

function pointsToBrushSegments(points, baseThickness) {
  // Velocity-modulated stroke: faster pointer = thinner line, slower = wider.
  // Each consecutive pair of points becomes its own short path with a custom
  // stroke-width so the visible thickness varies along the stroke.
  const segments = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const dt = Math.max(1, (curr.t || 0) - (prev.t || 0));
    const speed = dist / dt;
    const widthFactor = Math.max(0.35, Math.min(1.6, 1.4 / (1 + speed * 0.18)));
    segments.push({
      d: `M${prev.x},${prev.y} L${curr.x},${curr.y}`,
      width: baseThickness * widthFactor,
    });
  }
  return segments;
}

function pointToSegmentDistance(point, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lengthSq = vx * vx + vy * vy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * vx + (point.y - a.y) * vy) / lengthSq));
  const x = a.x + t * vx;
  const y = a.y + t * vy;
  return Math.hypot(point.x - x, point.y - y);
}

function buildDrawingNodeFromWorldPoints(sourceNode, worldPoints, id) {
  const xs = worldPoints.map((p) => p.x);
  const ys = worldPoints.map((p) => p.y);
  const pad = Math.max(2, sourceNode.thickness || 2);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;
  return {
    ...sourceNode,
    id,
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    points: worldPoints.map((p) => ({
      x: p.x - minX,
      y: p.y - minY,
      t: p.t,
    })),
  };
}

function splitDrawingNodeByEraser(node, eraserPoint, eraserRadius) {
  const sourcePoints = Array.isArray(node.points) ? node.points : [];
  if (node.type !== 'drawing' || sourcePoints.length < 2) return [node];
  const points = sourcePoints.map((p) => ({
    x: node.x + p.x,
    y: node.y + p.y,
    t: p.t,
  }));
  const pointHitRadius = eraserRadius + Math.min(2, Math.max(0.5, (node.thickness || 2) * 0.18));
  const segmentBreakRadius = eraserRadius;
  const keptRuns = [];
  let currentRun = [];

  points.forEach((point, index) => {
    const prev = points[index - 1];
    const shouldErase = Math.hypot(point.x - eraserPoint.x, point.y - eraserPoint.y) <= pointHitRadius;
    if (shouldErase) {
      if (currentRun.length >= 2) keptRuns.push(currentRun);
      currentRun = [];
      return;
    }

    const shouldBreakSegment = prev
      ? pointToSegmentDistance(eraserPoint, prev, point) <= segmentBreakRadius
      : false;
    if (shouldBreakSegment && currentRun.length >= 2) {
      keptRuns.push(currentRun);
      currentRun = [point];
      return;
    }
    if (shouldBreakSegment) {
      currentRun = [point];
      return;
    }

    currentRun.push(point);
  });
  if (currentRun.length >= 2) keptRuns.push(currentRun);

  return keptRuns.map((run, index) =>
    buildDrawingNodeFromWorldPoints(node, run, index === 0 ? node.id : generateId())
  );
}

function DrawingNode({
  node,
  selected,
  tool,
  zoom,
  arrowActive,
  arrowActiveSide,
  onPickAnchor,
  registerRef,
  onMouseDown,
  onClick,
}) {
  const variant = node.variant || 'pen';
  const color = node.color || '#ffffff';
  const thickness = node.thickness || 2;
  // Render points in local (bounding-box-relative) coordinates.
  const points = node.points || [];

  let pathContent = null;
  if (variant === 'brush') {
    const segs = pointsToBrushSegments(points, thickness);
    pathContent = segs.map((s, i) => (
      <path
        key={i}
        d={s.d}
        stroke={color}
        strokeWidth={s.width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ));
  } else if (variant === 'pencil') {
    pathContent = (
      <path
        d={pointsToSmoothPath(points)}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.78}
        filter={`url(#pencilGrain-${node.id})`}
      />
    );
  } else {
    pathContent = (
      <path
        d={pointsToSmoothPath(points)}
        stroke={color}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }

  return (
    <div
      className={`boardNode boardDrawingNode ${selected ? 'selected' : ''} ${tool === 'arrow' ? 'arrowTarget' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        transform: nodeTransform(node),
        transformOrigin: 'center',
      }}
      ref={(el) => registerRef(node.id, el)}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <svg
        width={node.w}
        height={node.h}
        viewBox={`0 0 ${node.w} ${node.h}`}
        style={{ display: 'block', overflow: 'visible', pointerEvents: 'none' }}
      >
        {variant === 'pencil' ? (
          <defs>
            <filter
              id={`pencilGrain-${node.id}`}
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.9"
                numOctaves="2"
                seed="7"
              />
              <feDisplacementMap in="SourceGraphic" scale="1.4" />
            </filter>
          </defs>
        ) : null}
        <g style={{ pointerEvents: 'visiblePainted' }}>{pathContent}</g>
      </svg>
      {tool === 'arrow' ? (
        <AnchorHandles
          active
          activeSide={arrowActive ? arrowActiveSide : null}
          zoom={zoom}
          onPickSide={onPickAnchor}
        />
      ) : null}
    </div>
  );
}

function ImageNode({
  node,
  selected,
  tool,
  zoom,
  arrowActive,
  arrowActiveSide,
  onPickAnchor,
  registerRef,
  onMouseDown,
  onClick,
}) {
  return (
    <div
      className={`boardNode boardImageNode ${selected ? 'selected' : ''} ${tool === 'arrow' ? 'arrowTarget' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        transform: nodeTransform(node),
        transformOrigin: 'center',
      }}
      ref={(el) => registerRef(node.id, el)}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <img src={node.src} alt="" draggable={false} />
      {tool === 'arrow' ? (
        <AnchorHandles
          active
          activeSide={arrowActive ? arrowActiveSide : null}
          zoom={zoom}
          onPickSide={onPickAnchor}
        />
      ) : null}
    </div>
  );
}

function LinkNode({
  node,
  selected,
  tool,
  zoom,
  arrowActive,
  arrowActiveSide,
  onPickAnchor,
  registerRef,
  onMouseDown,
  onClick,
}) {
  const preview = getLinkPreview(node.href || node.url || node.content || '');
  const width = node.w || DEFAULT_LINK_PREVIEW_WIDTH;
  const height = node.h || DEFAULT_LINK_PREVIEW_HEIGHT;
  const widthScale = width / DEFAULT_LINK_PREVIEW_WIDTH;
  const heightScale = height / DEFAULT_LINK_PREVIEW_HEIGHT;
  const rawScale = Math.min(widthScale, heightScale);
  const scale = Math.max(0.12, Math.min(8, Number.isFinite(rawScale) ? rawScale : 1));

  return (
    <div
      className={`boardNode boardLinkNode ${selected ? 'selected' : ''} ${tool === 'arrow' ? 'arrowTarget' : ''}`}
      style={{
        left: node.x,
        top: node.y,
        width,
        height,
        '--board-link-scale': scale,
        transform: nodeTransform(node),
        transformOrigin: 'center',
      }}
      ref={(el) => registerRef(node.id, el)}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div className="boardLinkPreviewTop">
        <div className="boardLinkFavicon">
          {preview.favicon ? (
            <img src={preview.favicon} alt="" draggable={false} />
          ) : (
            <LinkIcon size={17} strokeWidth={1.6} />
          )}
        </div>
        {selected ? (
          <button
            type="button"
            className="boardLinkOpenBtn"
            title="Open link"
            aria-label="Open link"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              window.open(node.href, '_blank', 'noopener,noreferrer');
            }}
          >
            <ExternalLink size={14} strokeWidth={1.7} />
          </button>
        ) : null}
      </div>
      <div className="boardLinkPreviewBody">
        <div className="boardLinkPreviewTitle">{preview.title}</div>
        <div className="boardLinkPreviewSubtitle">{preview.subtitle}</div>
      </div>
      <div className="boardLinkPreviewUrl">{node.href}</div>
      {tool === 'arrow' ? (
        <AnchorHandles
          active
          activeSide={arrowActive ? arrowActiveSide : null}
          zoom={zoom}
          onPickSide={onPickAnchor}
        />
      ) : null}
    </div>
  );
}

function BoardTaskCard({ task, taskTypeById, selected }) {
  const due = formatShortDate(task?.due_date);
  const descriptionPreview = getDescriptionPreview(task?.description);
  const taskType =
    task?.task_type_id !== null && task?.task_type_id !== undefined
      ? (taskTypeById.get(String(task.task_type_id)) || null)
      : null;
  const taskTypeColor = taskType?.color || '#6ea8fe';
  const priorityMeta = PRIORITY_META[task?.priority] || {
    label: formatPriority(task?.priority),
    className: 'normal',
  };
  const taskStatusMeta = STATUS_META[task?.status] || {
    label: formatStatus(task?.status),
    className: 'todo',
  };

  if (!task) {
    return (
      <div className="tasksCard boardImportedTaskCard boardTaskMissing">
        <div className="tasksCardTop">
          <span className="taskStatusDot" />
          <h4>Task unavailable</h4>
        </div>
        <p>This imported task could not be found.</p>
      </div>
    );
  }

  return (
    <div
      className={`tasksCard boardImportedTaskCard ${taskType ? 'hasTypeAccent' : ''} ${selected ? 'selected' : ''}`}
      style={taskType ? { '--task-type-color': taskTypeColor } : undefined}
    >
      <div className="tasksCardTop">
        <span
          className={`taskStatusDot ${taskStatusMeta.className}`}
          title={taskStatusMeta.label}
        />
        <h4>{task.title}</h4>
      </div>
      <div className="tasksCardMeta">
        {taskType ? (
          <span className="taskTypeMeta" style={{ color: taskTypeColor }}>
            {taskType.name}
          </span>
        ) : null}
        <span className={`priorityBadge ${priorityMeta.className}`}>
          {priorityMeta.label}
        </span>
        {task.description ? (
          <div className="tasksDescriptionHint">
            <List size={12} />
            <div className="tasksDescriptionPreview">{descriptionPreview}</div>
          </div>
        ) : null}
        {due ? (
          <span className="taskDueDate">{due}</span>
        ) : null}
        {task.status === TASK_STATUS.COMPLETED && (task.total_spent_time_minutes ?? 0) > 0 ? (
          <span className="taskSpentBadge">{formatSpentTime(task.total_spent_time_minutes)}</span>
        ) : null}
      </div>
    </div>
  );
}

function TaskNode({
  node,
  selected,
  expanded,
  task,
  tasks,
  taskTypes,
  taskTypeById,
  statusColors,
  isSaving,
  tool,
  zoom,
  arrowActive,
  arrowActiveSide,
  onPickAnchor,
  registerRef,
  onMouseDown,
  onClick,
  onCollapse,
  onSave,
  onDelete,
  onUpdateStatus,
  onCreateSubtask,
  onDeleteSubtask,
  onOpenTask,
}) {
  const width = expanded
    ? (node.detailW || node.w || DEFAULT_TASK_DETAIL_WIDTH)
    : (node.cardW || node.w || DEFAULT_TASK_NODE_WIDTH);
  const height = expanded
    ? (node.detailH || node.h || DEFAULT_TASK_DETAIL_HEIGHT)
    : (node.cardH || node.h || DEFAULT_TASK_NODE_HEIGHT);
  const baseWidth = expanded ? DEFAULT_TASK_DETAIL_WIDTH : DEFAULT_TASK_NODE_WIDTH;
  const baseHeight = expanded ? DEFAULT_TASK_DETAIL_HEIGHT : DEFAULT_TASK_NODE_HEIGHT;
  const rawScale = Math.min(width / baseWidth, height / baseHeight);
  const taskScale = Math.max(
    expanded ? 0.05 : 0.08,
    Math.min(expanded ? 8 : 14, Number.isFinite(rawScale) ? rawScale : 1)
  );
  const className = [
    'boardNode',
    'boardTaskNode',
    expanded ? 'expanded' : 'card',
    selected ? 'selected' : '',
    tool === 'arrow' ? 'arrowTarget' : '',
  ].filter(Boolean).join(' ');

  function handleMouseDown(event) {
    if (
      expanded &&
      event.target.closest('input, textarea, button, select, [contenteditable="true"], .customSelect, .tasksDatePicker')
    ) {
      event.stopPropagation();
      return;
    }
    onMouseDown(event);
  }

  return (
    <div
      className={className}
      style={{
        left: node.x,
        top: node.y,
        width,
        height,
        '--board-task-scale': taskScale,
        transform: nodeTransform(node),
        transformOrigin: 'center',
      }}
      ref={(el) => registerRef(node.id, el)}
      onMouseDown={handleMouseDown}
      onClick={onClick}
    >
      {expanded ? (
        <div className="boardTaskDetailEmbed">
          <TaskDetailModal
            key={task?.id || 'board-task-detail'}
            task={task}
            allTasks={tasks}
            taskTypes={taskTypes}
            onClose={onCollapse}
            onSave={onSave}
            onDelete={onDelete}
            onUpdateStatus={onUpdateStatus}
            onCreateSubtask={onCreateSubtask}
            onDeleteSubtask={onDeleteSubtask}
            onOpenTask={onOpenTask}
            onOpenTypeManager={() => {}}
            cardViewSettings={BOARD_TASK_CARD_VIEW_SETTINGS}
            statusColors={statusColors}
            isSaving={isSaving}
            isMobile={false}
            embedded
          />
        </div>
      ) : (
        <BoardTaskCard task={task} taskTypeById={taskTypeById} selected={selected} />
      )}
      {tool === 'arrow' && !expanded ? (
        <AnchorHandles
          active
          activeSide={arrowActive ? arrowActiveSide : null}
          zoom={zoom}
          onPickSide={onPickAnchor}
        />
      ) : null}
    </div>
  );
}

function TaskImportPanel({
  tasks,
  taskTypeById,
  query,
  onQueryChange,
  onImport,
  onRefresh,
  loading,
  error,
}) {
  return (
    <div className="boardImportPanel" onMouseDown={(event) => event.stopPropagation()}>
      <div className="boardImportPanelHeader">
        <div>
          <strong>Import task</strong>
          <span>{tasks.length} available</span>
        </div>
        <button
          type="button"
          className="boardImportIconBtn"
          onClick={onRefresh}
          title="Refresh tasks"
          aria-label="Refresh tasks"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>
      <label className="boardImportSearch">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search title or content"
        />
      </label>
      {error ? <div className="boardImportError">{error}</div> : null}
      <div className="boardImportTaskList">
        {loading ? (
          <div className="boardImportEmpty">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="boardImportEmpty">No tasks found</div>
        ) : (
          tasks.map((task) => {
            const type =
              task.task_type_id !== null && task.task_type_id !== undefined
                ? taskTypeById.get(String(task.task_type_id))
                : null;
            const due = formatShortDate(task.due_date);
            const statusMeta = STATUS_META[task.status] || {
              label: formatStatus(task.status),
              className: 'todo',
            };
            const dotColor = BOARD_STATUS_COLORS[task.status] || BOARD_STATUS_COLORS[TASK_STATUS.TO_DO];
            const priorityMeta = PRIORITY_META[task.priority] || {
              label: formatPriority(task.priority),
              className: 'normal',
            };
            return (
              <button
                type="button"
                key={task.id}
                className="tasksMobileRow boardImportTaskRow"
                onClick={() => onImport(task)}
              >
                <span
                  className="tasksMobileRowDot"
                  style={{ background: dotColor }}
                  title={statusMeta.label}
                />
                <span className="tasksMobileRowTitle">
                  {task.title}
                </span>
                <div className="tasksMobileRowMeta">
                  {type ? (
                    <span
                      className="taskTypeMeta"
                      style={{ color: type.color || '#6ea8fe' }}
                    >
                      {type.name}
                    </span>
                  ) : null}
                  <span className={`priorityBadge ${priorityMeta.className}`}>
                    {priorityMeta.label}
                  </span>
                  {due ? (
                    <span className="taskDueDate">
                      <Calendar size={8} />
                      {due}
                    </span>
                  ) : null}
                </div>
                <ChevronRight size={12} className="tasksMobileRowChevron" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ---------- Selection frame (resize + rotate handles) ----------
   Lives inside the surface, so it scales + rotates with the world. Each
   handle counter-scales (1/zoom) to stay a constant size on screen. */
function SelectionFrame({ node, bounds, zoom, onResizeStart, onRotateStart }) {
  const { w, h } = nodeSize(node, bounds);
  const handleScale = 1 / zoom;

  return (
    <div
      className="boardSelectionFrame"
      style={{
        left: node.x,
        top: node.y,
        width: w,
        height: h,
        transform: nodeTransform(node),
        transformOrigin: 'center',
      }}
    >
      <div
        className="boardSelectionOutline"
        style={{ borderWidth: `${1 / zoom}px` }}
      />

      {/* Rotate arm + knob, perpendicular to top edge */}
      <div
        className="boardRotateLink"
        style={{
          left: '50%',
          top: 0,
          height: 18 / zoom,
          width: `${1 / zoom}px`,
          transform: `translate(-50%, -100%)`,
        }}
      />
      <div
        className="boardRotateHandle"
        style={{
          left: '50%',
          top: 0,
          transform: `translate(-50%, calc(-100% - ${18 / zoom}px)) scale(${handleScale})`,
        }}
        onMouseDown={(e) => onRotateStart(e, node)}
      />

      {/* 8 resize handles */}
      {HANDLE_IDS.map((id) => {
        const dir = HANDLE_DIRS[id];
        const left = dir.sx === -1 ? 0 : dir.sx === 0 ? '50%' : '100%';
        const top = dir.sy === -1 ? 0 : dir.sy === 0 ? '50%' : '100%';
        return (
          <div
            key={id}
            className={`boardResizeHandle handle-${id}`}
            style={{
              left,
              top,
              cursor: dir.cursor,
              transform: `translate(-50%, -50%) scale(${handleScale})`,
            }}
            onMouseDown={(e) => onResizeStart(e, id, node)}
          />
        );
      })}
    </div>
  );
}

/* ---------- Arrow routing helpers ----------
   Orthogonal (90°) lines with rounded elbows. Edges exit the source on the
   side that faces the target and enter the target on the opposite side, with
   a single mid-axis bend in between. */

function nodeSize(node, bounds) {
  const b = bounds[node.id];
  return {
    w: b?.w ?? node.w ?? 100,
    h: b?.h ?? node.h ?? 40,
  };
}

function nodeCenterOf(node, bounds) {
  const { w, h } = nodeSize(node, bounds);
  return { x: node.x + w / 2, y: node.y + h / 2 };
}

function nodeRectAt(node, bounds, x = node.x, y = node.y) {
  const { w, h } = nodeSize(node, bounds);
  return rectFromBox(x, y, w, h);
}

function rectFromBox(x, y, w, h) {
  return {
    left: x,
    top: y,
    right: x + w,
    bottom: y + h,
    centerX: x + w / 2,
    centerY: y + h / 2,
  };
}

function verticalGuide(x, moving, target) {
  return {
    x,
    y1: Math.min(moving.top, target.top),
    y2: Math.max(moving.bottom, target.bottom),
  };
}

function horizontalGuide(y, moving, target) {
  return {
    y,
    x1: Math.min(moving.left, target.left),
    x2: Math.max(moving.right, target.right),
  };
}

function horizontalSegment(y, x1, x2) {
  return { y, x1: Math.min(x1, x2), x2: Math.max(x1, x2), kind: 'spacing' };
}

function verticalSegment(x, y1, y2) {
  return { x, y1: Math.min(y1, y2), y2: Math.max(y1, y2), kind: 'spacing' };
}

/* Each spacing guide line sits INSIDE the gap it measures — placed at the
   vertical (or horizontal) midpoint of the two items it spans — instead of
   being parked on a single ruler below/beside all items. Reading order:
   gap A↔B has its line floating between A and B; gap B↔C has its own line
   between B and C. Two same-length parallel lines = visual confirmation
   that the spacings are equal. */
function spacingHorizontalGuides(moving, left, right, side) {
  if (side === 'between') {
    return [
      horizontalSegment((moving.centerY + left.centerY) / 2, left.right, moving.left),
      horizontalSegment((moving.centerY + right.centerY) / 2, moving.right, right.left),
    ];
  }

  const staticY = (left.centerY + right.centerY) / 2;
  const movingGap = side === 'before'
    ? horizontalSegment(
        (moving.centerY + left.centerY) / 2,
        moving.right,
        left.left
      )
    : horizontalSegment(
        (moving.centerY + right.centerY) / 2,
        right.right,
        moving.left
      );
  return [
    horizontalSegment(staticY, left.right, right.left),
    movingGap,
  ];
}

function spacingVerticalGuides(moving, top, bottom, side) {
  if (side === 'between') {
    return [
      verticalSegment((moving.centerX + top.centerX) / 2, top.bottom, moving.top),
      verticalSegment((moving.centerX + bottom.centerX) / 2, moving.bottom, bottom.top),
    ];
  }

  const staticX = (top.centerX + bottom.centerX) / 2;
  const movingGap = side === 'before'
    ? verticalSegment(
        (moving.centerX + top.centerX) / 2,
        moving.bottom,
        top.top
      )
    : verticalSegment(
        (moving.centerX + bottom.centerX) / 2,
        bottom.bottom,
        moving.top
      );
  return [
    verticalSegment(staticX, top.bottom, bottom.top),
    movingGap,
  ];
}

function getWheelZoomFactor(deltaY) {
  const direction = deltaY < 0 ? 1 : -1;
  const absDelta = Math.abs(deltaY);
  const isMouseWheel = absDelta >= 40;
  const step = isMouseWheel ? MOUSE_WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
  if (isMouseWheel) {
    const notches = Math.max(1, Math.min(3, Math.round(absDelta / 100)));
    const factor = Math.pow(step, notches);
    return direction > 0 ? factor : 1 / factor;
  }
  return direction > 0 ? step : 1 / step;
}

function getDragAlignmentGuides(node, nextX, nextY, nodes, bounds, tolerance) {
  const moving = nodeRectAt(node, bounds, nextX, nextY);
  const movingVerticals = [
    { value: moving.left, offset: moving.left - nextX },
    { value: moving.centerX, offset: moving.centerX - nextX },
    { value: moving.right, offset: moving.right - nextX },
  ];
  const movingHorizontals = [
    { value: moving.top, offset: moving.top - nextY },
    { value: moving.centerY, offset: moving.centerY - nextY },
    { value: moving.bottom, offset: moving.bottom - nextY },
  ];
  let vertical = null;
  let horizontal = null;
  let spacingX = null;
  let spacingY = null;
  const targets = nodes
    .filter((other) => other.id !== node.id)
    .map((other) => nodeRectAt(other, bounds));

  targets.forEach((target) => {
    [target.left, target.centerX, target.right].forEach((x) => {
      movingVerticals.forEach((movingX) => {
        const distance = Math.abs(movingX.value - x);
        if (distance > tolerance || (vertical && distance >= vertical.distance)) return;
        vertical = {
          distance,
          x,
          snappedX: x - movingX.offset,
          target,
        };
      });
    });
    [target.top, target.centerY, target.bottom].forEach((y) => {
      movingHorizontals.forEach((movingY) => {
        const distance = Math.abs(movingY.value - y);
        if (distance > tolerance || (horizontal && distance >= horizontal.distance)) return;
        horizontal = {
          distance,
          y,
          snappedY: y - movingY.offset,
          target,
        };
      });
    });
  });

  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      const a = targets[i];
      const b = targets[j];
      const left = a.left <= b.left ? a : b;
      const right = left === a ? b : a;
      const horizontalGap = right.left - left.right;
      if (horizontalGap > 0) {
        const movingWidth = moving.right - moving.left;
        [
          ...(horizontalGap >= movingWidth
            ? [{ x: left.right + (horizontalGap - movingWidth) / 2, left, right, side: 'between' }]
            : []),
          { x: left.left - horizontalGap - moving.right + moving.left, left, right, side: 'before' },
          { x: right.right + horizontalGap, left, right, side: 'after' },
        ].forEach((candidate) => {
          const distance = Math.abs(nextX - candidate.x);
          if (distance <= tolerance && (!spacingX || distance < spacingX.distance)) {
            spacingX = { ...candidate, distance };
          }
        });
      }

      const top = a.top <= b.top ? a : b;
      const bottom = top === a ? b : a;
      const verticalGap = bottom.top - top.bottom;
      if (verticalGap > 0) {
        const movingHeight = moving.bottom - moving.top;
        [
          ...(verticalGap >= movingHeight
            ? [{ y: top.bottom + (verticalGap - movingHeight) / 2, top, bottom, side: 'between' }]
            : []),
          { y: top.top - verticalGap - moving.bottom + moving.top, top, bottom, side: 'before' },
          { y: bottom.bottom + verticalGap, top, bottom, side: 'after' },
        ].forEach((candidate) => {
          const distance = Math.abs(nextY - candidate.y);
          if (distance <= tolerance && (!spacingY || distance < spacingY.distance)) {
            spacingY = { ...candidate, distance };
          }
        });
      }
    }
  }

  if (spacingX && vertical && spacingX.distance >= vertical.distance) spacingX = null;
  if (spacingY && horizontal && spacingY.distance >= horizontal.distance) spacingY = null;

  const finalX = spacingX ? spacingX.x : vertical ? vertical.snappedX : nextX;
  const finalY = spacingY ? spacingY.y : horizontal ? horizontal.snappedY : nextY;
  const snappedMoving = nodeRectAt(node, bounds, finalX, finalY);
  const spacingHorizontal = spacingX
    ? spacingHorizontalGuides(snappedMoving, spacingX.left, spacingX.right, spacingX.side)
    : [];
  const spacingVertical = spacingY
    ? spacingVerticalGuides(snappedMoving, spacingY.top, spacingY.bottom, spacingY.side)
    : [];
  return {
    x: finalX,
    y: finalY,
    vertical: [
      ...(vertical ? [verticalGuide(vertical.x, snappedMoving, vertical.target)] : []),
      ...spacingVertical,
    ],
    horizontal: [
      ...(horizontal ? [horizontalGuide(horizontal.y, snappedMoving, horizontal.target)] : []),
      ...spacingHorizontal,
    ],
  };
}

function getResizeAlignment(node, next, handleId, nodes, bounds, tolerance, minSize = MIN_NODE_SIZE) {
  const dir = HANDLE_DIRS[handleId];
  const moving = rectFromBox(next.x, next.y, next.w, next.h);
  let vertical = null;
  let horizontal = null;

  const verticalCandidates = [];
  if (dir.sx < 0) {
    verticalCandidates.push(
      { value: moving.left, kind: 'left' },
      { value: moving.centerX, kind: 'center' }
    );
  } else if (dir.sx > 0) {
    verticalCandidates.push(
      { value: moving.right, kind: 'right' },
      { value: moving.centerX, kind: 'center' }
    );
  }

  const horizontalCandidates = [];
  if (dir.sy < 0) {
    horizontalCandidates.push(
      { value: moving.top, kind: 'top' },
      { value: moving.centerY, kind: 'middle' }
    );
  } else if (dir.sy > 0) {
    horizontalCandidates.push(
      { value: moving.bottom, kind: 'bottom' },
      { value: moving.centerY, kind: 'middle' }
    );
  }

  nodes.forEach((other) => {
    if (other.id === node.id) return;
    const target = nodeRectAt(other, bounds);
    [target.left, target.centerX, target.right].forEach((x) => {
      verticalCandidates.forEach((candidate) => {
        const distance = Math.abs(candidate.value - x);
        if (distance > tolerance || (vertical && distance >= vertical.distance)) return;
        vertical = { distance, x, kind: candidate.kind, target };
      });
    });
    [target.top, target.centerY, target.bottom].forEach((y) => {
      horizontalCandidates.forEach((candidate) => {
        const distance = Math.abs(candidate.value - y);
        if (distance > tolerance || (horizontal && distance >= horizontal.distance)) return;
        horizontal = { distance, y, kind: candidate.kind, target };
      });
    });
  });

  const snapped = { ...next };
  if (vertical) {
    const right = next.x + next.w;
    if (vertical.kind === 'left') {
      snapped.x = Math.min(vertical.x, right - minSize);
      snapped.w = right - snapped.x;
    } else if (vertical.kind === 'right') {
      snapped.w = Math.max(minSize, vertical.x - next.x);
    } else if (vertical.kind === 'center') {
      if (dir.sx < 0) {
        snapped.x = Math.min(2 * vertical.x - right, right - minSize);
        snapped.w = right - snapped.x;
      } else if (dir.sx > 0) {
        snapped.w = Math.max(minSize, 2 * (vertical.x - next.x));
      }
    }
  }
  if (horizontal) {
    const bottom = next.y + next.h;
    if (horizontal.kind === 'top') {
      snapped.y = Math.min(horizontal.y, bottom - minSize);
      snapped.h = bottom - snapped.y;
    } else if (horizontal.kind === 'bottom') {
      snapped.h = Math.max(minSize, horizontal.y - next.y);
    } else if (horizontal.kind === 'middle') {
      if (dir.sy < 0) {
        snapped.y = Math.min(2 * horizontal.y - bottom, bottom - minSize);
        snapped.h = bottom - snapped.y;
      } else if (dir.sy > 0) {
        snapped.h = Math.max(minSize, 2 * (horizontal.y - next.y));
      }
    }
  }

  const snappedRect = rectFromBox(snapped.x, snapped.y, snapped.w, snapped.h);
  const verticalTarget = vertical?.target;
  const horizontalTarget = horizontal?.target;
  return {
    next: snapped,
    vertical: vertical ? [verticalGuide(vertical.x, snappedRect, verticalTarget)] : [],
    horizontal: horizontal ? [horizontalGuide(horizontal.y, snappedRect, horizontalTarget)] : [],
  };
}

const SIDE_VECTOR = {
  right:  { x:  1, y:  0 },
  left:   { x: -1, y:  0 },
  bottom: { x:  0, y:  1 },
  top:    { x:  0, y: -1 },
};

function isHorizontalSide(side) {
  return side === 'left' || side === 'right';
}

function oppositeSide(side) {
  switch (side) {
    case 'right':  return 'left';
    case 'left':   return 'right';
    case 'bottom': return 'top';
    case 'top':    return 'bottom';
    default:       return 'right';
  }
}

function getAnchor(node, bounds, side, offset = 0) {
  const { w, h } = nodeSize(node, bounds);
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;
  let local;
  switch (side) {
    case 'right':  local = { x:  w / 2 + offset, y: 0 }; break;
    case 'left':   local = { x: -w / 2 - offset, y: 0 }; break;
    case 'bottom': local = { x: 0, y:  h / 2 + offset }; break;
    case 'top':    local = { x: 0, y: -h / 2 - offset }; break;
    default:       local = { x: 0, y: 0 };
  }
  const R = ((node.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(R);
  const sin = Math.sin(R);
  return {
    x: cx + cos * local.x - sin * local.y,
    y: cy + sin * local.x + cos * local.y,
  };
}

function pickAutoSide(item, target, bounds) {
  const sc = nodeCenterOf(item, bounds);
  const dx = target.x - sc.x;
  const dy = target.y - sc.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

function isExplicitSide(side) {
  return side === 'top' || side === 'right' || side === 'bottom' || side === 'left';
}

/* Axis-aligned segment vs rect overlap test. A segment lying exactly on an
   edge of the rect does not count as a hit (so a route grazing the outside of
   an avoid-rect is acceptable). */
function segmentHitsRect(p1, p2, r) {
  const EPS = 0.01;
  if (Math.abs(p1.x - p2.x) < EPS) {
    const x = p1.x;
    if (x <= r.left + EPS || x >= r.right - EPS) return false;
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    return maxY > r.top + EPS && minY < r.bottom - EPS;
  }
  if (Math.abs(p1.y - p2.y) < EPS) {
    const y = p1.y;
    if (y <= r.top + EPS || y >= r.bottom - EPS) return false;
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    return maxX > r.left + EPS && minX < r.right - EPS;
  }
  return false;
}

function pathClearOfRects(points, avoidRects) {
  for (let i = 0; i < points.length - 1; i += 1) {
    for (const r of avoidRects) {
      if (segmentHitsRect(points[i], points[i + 1], r)) return false;
    }
  }
  return true;
}

function dropZeroLengthSegments(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    if (Math.abs(points[i].x - prev.x) > 0.5 || Math.abs(points[i].y - prev.y) > 0.5) {
      out.push(points[i]);
    }
  }
  return out;
}

/* Insert intermediate orthogonal points so that consecutive points always
   share x or y. Used when a candidate "L" route would otherwise have an L
   bend implicit between two corners. */
function ensureOrthogonal(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    const next = points[i];
    if (Math.abs(prev.x - next.x) > 0.5 && Math.abs(prev.y - next.y) > 0.5) {
      out.push({ x: next.x, y: prev.y });
    }
    out.push(next);
  }
  return out;
}

/* Generate a set of canonical orthogonal candidate routes, drop the ones that
   cut through either rectangle, then return the shortest survivor. Picking by
   length means we choose the most direct route automatically — no hand-tuned
   ordering needed per side combination. */
function routeBetweenRects(sRect, tRect, sp, tp, sSide, tSide, pad) {
  const sv = SIDE_VECTOR[sSide];
  const s1 = { x: sp.x + sv.x * pad, y: sp.y + sv.y * pad };
  const sHoriz = isHorizontalSide(sSide);
  const tHoriz = isHorizontalSide(tSide);

  const unionTop    = Math.min(sRect.top,    tRect.top)    - pad;
  const unionBottom = Math.max(sRect.bottom, tRect.bottom) + pad;
  const unionLeft   = Math.min(sRect.left,   tRect.left)   - pad;
  const unionRight  = Math.max(sRect.right,  tRect.right)  + pad;

  const candidates = [];
  const push = (pts) => candidates.push(dropZeroLengthSegments(pts));

  // Each candidate's final segment goes straight from the last corner to tp,
  // approaching the target perpendicular to its side — the rounded-corner
  // generator then gives the elbow before that segment the same treatment
  // as every other bend in the path.
  if (sHoriz && tHoriz) {
    const midX = (s1.x + tp.x) / 2;
    push([sp, s1, { x: midX, y: s1.y }, { x: midX, y: tp.y }, tp]);
    push([sp, s1, { x: s1.x, y: unionTop },    { x: tp.x, y: unionTop },    tp]);
    push([sp, s1, { x: s1.x, y: unionBottom }, { x: tp.x, y: unionBottom }, tp]);
    push([sp, s1, { x: unionLeft,  y: s1.y }, { x: unionLeft,  y: tp.y }, tp]);
    push([sp, s1, { x: unionRight, y: s1.y }, { x: unionRight, y: tp.y }, tp]);
  } else if (!sHoriz && !tHoriz) {
    const midY = (s1.y + tp.y) / 2;
    push([sp, s1, { x: s1.x, y: midY }, { x: tp.x, y: midY }, tp]);
    push([sp, s1, { x: s1.x, y: unionBottom }, { x: tp.x, y: unionBottom }, tp]);
    push([sp, s1, { x: s1.x, y: unionTop },    { x: tp.x, y: unionTop },    tp]);
    push([sp, s1, { x: unionLeft,  y: s1.y }, { x: unionLeft,  y: tp.y }, tp]);
    push([sp, s1, { x: unionRight, y: s1.y }, { x: unionRight, y: tp.y }, tp]);
  } else if (sHoriz && !tHoriz) {
    push([sp, s1, { x: tp.x, y: s1.y }, tp]);
    push([sp, s1, { x: s1.x, y: unionTop },    { x: tp.x, y: unionTop },    tp]);
    push([sp, s1, { x: s1.x, y: unionBottom }, { x: tp.x, y: unionBottom }, tp]);
    push([sp, s1, { x: unionLeft,  y: s1.y }, { x: unionLeft,  y: tp.y }, tp]);
    push([sp, s1, { x: unionRight, y: s1.y }, { x: unionRight, y: tp.y }, tp]);
  } else {
    push([sp, s1, { x: s1.x, y: tp.y }, tp]);
    push([sp, s1, { x: s1.x, y: unionTop },    { x: tp.x, y: unionTop },    tp]);
    push([sp, s1, { x: s1.x, y: unionBottom }, { x: tp.x, y: unionBottom }, tp]);
    push([sp, s1, { x: unionLeft,  y: s1.y }, { x: unionLeft,  y: tp.y }, tp]);
    push([sp, s1, { x: unionRight, y: s1.y }, { x: unionRight, y: tp.y }, tp]);
  }

  // Avoid the rectangles themselves — segmentHitsRect's EPS lets the first
  // and last segments touch the source/target edges without counting as hits.
  const avoid = [sRect, tRect];
  const valid = candidates.filter((c) => pathClearOfRects(c, avoid));
  if (valid.length === 0) return candidates[0];

  // Among clear candidates, pick the shortest. Add a small bend penalty so a
  // slightly longer route with fewer corners beats a barely-shorter zig-zag.
  const BEND_PENALTY = 12;
  let best = valid[0];
  let bestCost = pathLength(best) + (best.length - 2) * BEND_PENALTY;
  for (let i = 1; i < valid.length; i += 1) {
    const c = valid[i];
    const cost = pathLength(c) + (c.length - 2) * BEND_PENALTY;
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  return best;
}

/* Route between an anchored side of a rect and a free point (or vice versa).
   Avoids only the rect's interior. */
function routeRectToPoint(rect, sp, sSide, tp, pad) {
  const sv = SIDE_VECTOR[sSide];
  const s1 = { x: sp.x + sv.x * pad, y: sp.y + sv.y * pad };
  const sHoriz = isHorizontalSide(sSide);
  const candidates = [];
  const push = (pts) => candidates.push(dropZeroLengthSegments(ensureOrthogonal(pts)));

  if (sHoriz) {
    // First segment is horizontal. From s1 go to tp via an L.
    push([sp, s1, { x: tp.x, y: s1.y }, tp]);
    push([sp, s1, { x: s1.x, y: tp.y }, tp]);
    // Detour over the rect
    push([sp, s1, { x: s1.x, y: rect.top - pad },    { x: tp.x, y: rect.top - pad },    tp]);
    push([sp, s1, { x: s1.x, y: rect.bottom + pad }, { x: tp.x, y: rect.bottom + pad }, tp]);
  } else {
    push([sp, s1, { x: s1.x, y: tp.y }, tp]);
    push([sp, s1, { x: tp.x, y: s1.y }, tp]);
    push([sp, s1, { x: rect.left - pad,  y: s1.y }, { x: rect.left - pad,  y: tp.y }, tp]);
    push([sp, s1, { x: rect.right + pad, y: s1.y }, { x: rect.right + pad, y: tp.y }, tp]);
  }

  const avoid = [rect];
  const valid = candidates.filter((c) => pathClearOfRects(c, avoid));
  if (valid.length === 0) return candidates[0];
  const BEND_PENALTY = 12;
  let best = valid[0];
  let bestCost = pathLength(best) + (best.length - 2) * BEND_PENALTY;
  for (let i = 1; i < valid.length; i += 1) {
    const c = valid[i];
    const cost = pathLength(c) + (c.length - 2) * BEND_PENALTY;
    if (cost < bestCost) {
      best = c;
      bestCost = cost;
    }
  }
  return best;
}

function routePointToPoint(s, t) {
  // Free endpoints — keep the original Z behaviour with no avoid rects.
  const points = [s];
  if (Math.abs(s.x - t.x) > 1 && Math.abs(s.y - t.y) > 1) {
    if (Math.abs(t.x - s.x) >= Math.abs(t.y - s.y)) {
      const midX = (s.x + t.x) / 2;
      points.push({ x: midX, y: s.y });
      points.push({ x: midX, y: t.y });
    } else {
      const midY = (s.y + t.y) / 2;
      points.push({ x: s.x, y: midY });
      points.push({ x: t.x, y: midY });
    }
  }
  points.push(t);
  return dropZeroLengthSegments(points);
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function pointAlongPath(points, t) {
  // t in [0, 1]
  const total = pathLength(points);
  if (total === 0) return points[0];
  const target = total * t;
  let acc = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + len >= target) {
      const frac = len === 0 ? 0 : (target - acc) / len;
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
    acc += len;
  }
  return points[points.length - 1];
}

/* Build an SVG path string from an array of orthogonal waypoints with a small
   quadratic arc at each interior corner. Corners are clamped to the shorter
   of the two adjacent legs so we never overshoot. */
function roundedPathFromPoints(points, r = 14) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x},${p.y}`;
  }
  if (points.length === 2) {
    const [a, b] = points;
    return `M ${a.x},${a.y} L ${b.x},${b.y}`;
  }

  const segs = [`M ${points[0].x},${points[0].y}`];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dxIn  = curr.x - prev.x;
    const dyIn  = curr.y - prev.y;
    const dxOut = next.x - curr.x;
    const dyOut = next.y - curr.y;
    const lenIn  = Math.hypot(dxIn, dyIn);
    const lenOut = Math.hypot(dxOut, dyOut);
    const cR = Math.min(r, lenIn / 2, lenOut / 2);
    if (cR < 0.5) {
      segs.push(`L ${curr.x},${curr.y}`);
      continue;
    }
    const startX = curr.x - (dxIn / (lenIn || 1)) * cR;
    const startY = curr.y - (dyIn / (lenIn || 1)) * cR;
    const endX   = curr.x + (dxOut / (lenOut || 1)) * cR;
    const endY   = curr.y + (dyOut / (lenOut || 1)) * cR;
    segs.push(`L ${startX},${startY}`);
    segs.push(`Q ${curr.x},${curr.y} ${endX},${endY}`);
  }
  const last = points[points.length - 1];
  segs.push(`L ${last.x},${last.y}`);
  return segs.join(' ');
}

function rectOfItem(item, bounds) {
  const { w, h } = nodeSize(item, bounds);
  return {
    left:   item.x,
    top:    item.y,
    right:  item.x + w,
    bottom: item.y + h,
  };
}

// Distance the route is pushed outside source/target rectangles before turning.
// Big enough that the final segment (pad − target offset) easily fits the
// arrowhead marker length (~10 marker units × strokeWidth) so the last
// corner stays clear of the arrowhead body.
const ROUTE_PADDING = 26;

/* Compute the geometry for an edge: route waypoints + midpoint + endpoint
   anchor positions. Honors edge.fromSide / edge.toSide when present, else
   falls back to geometric pickAutoSide. */
function computeEdgeGeometry(edge, itemById, bounds) {
  const source = edge.from ? itemById.get(edge.from) : null;
  const target = edge.to ? itemById.get(edge.to) : null;

  if (source && target) {
    const sRect = rectOfItem(source, bounds);
    const tRect = rectOfItem(target, bounds);
    const sSide = isExplicitSide(edge.fromSide)
      ? edge.fromSide
      : pickAutoSide(source, nodeCenterOf(target, bounds), bounds);
    const tSide = isExplicitSide(edge.toSide)
      ? edge.toSide
      : pickAutoSide(target, nodeCenterOf(source, bounds), bounds);
    const sp = getAnchor(source, bounds, sSide, 0);
    const tp = getAnchor(target, bounds, tSide, 4);
    const points = routeBetweenRects(sRect, tRect, sp, tp, sSide, tSide, ROUTE_PADDING);
    return { points, sSide, tSide };
  }

  if (source && edge.end) {
    const sRect = rectOfItem(source, bounds);
    const sSide = isExplicitSide(edge.fromSide)
      ? edge.fromSide
      : pickAutoSide(source, edge.end, bounds);
    const sp = getAnchor(source, bounds, sSide, 0);
    const points = routeRectToPoint(sRect, sp, sSide, edge.end, ROUTE_PADDING);
    return { points, sSide, tSide: null };
  }

  if (edge.start && target) {
    const tRect = rectOfItem(target, bounds);
    const tSide = isExplicitSide(edge.toSide)
      ? edge.toSide
      : pickAutoSide(target, edge.start, bounds);
    const tp = getAnchor(target, bounds, tSide, 4);
    const forwardPath = routeRectToPoint(tRect, tp, tSide, edge.start, ROUTE_PADDING);
    const points = forwardPath.slice().reverse();
    return { points, sSide: null, tSide };
  }

  if (edge.start && edge.end) {
    return { points: routePointToPoint(edge.start, edge.end), sSide: null, tSide: null };
  }

  return null;
}

/* ---------- Arrows layer (SVG over the world) ---------- */
function ArrowsLayer({
  nodes,
  frames,
  edges,
  bounds,
  zoom,
  arrowSource,
  arrowPointSource,
  mousePos,
  selectedEdgeId,
  onSelectEdge,
  onRemoveEdge,
  onEdgeEndpointMouseDown,
}) {
  const itemById = new Map([...frames, ...nodes].map((item) => [item.id, item]));

  return (
    <svg className="boardArrows" width="1" height="1" overflow="visible">
      <defs>
        <marker
          id="boardArrowHead"
          markerWidth="14"
          markerHeight="14"
          refX="12"
          refY="7"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,1 L13,7 L0,13 L3.6,7 Z" fill="currentColor" />
        </marker>
        <marker
          id="boardArrowHeadGhost"
          markerWidth="14"
          markerHeight="14"
          refX="12"
          refY="7"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,1 L13,7 L0,13 L3.6,7 Z" fill="var(--text-tertiary)" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const geom = computeEdgeGeometry(edge, itemById, bounds);
        if (!geom) return null;
        const { points } = geom;
        const d = roundedPathFromPoints(points);
        const isSelected = selectedEdgeId === edge.id;
        const mid = pointAlongPath(points, 0.5);
        const s = points[0];
        const t = points[points.length - 1];
        const baseStrokeWidth = edge.strokeWidth || DEFAULT_ARROW_STROKE_WIDTH;
        const strokeWidth = (isSelected ? baseStrokeWidth + 0.6 : baseStrokeWidth) / zoom;
        const hitStrokeWidth = Math.max(14, baseStrokeWidth + 10) / zoom;
        const handleRadius = 6 / zoom;
        const handleStrokeWidth = 1.4 / zoom;
        const deleteRadius = 11 / zoom;
        const deleteStrokeWidth = 1.2 / zoom;
        const deleteXOffset = 3.5 / zoom;
        const deleteXStrokeWidth = 1.6 / zoom;
        return (
          <g key={edge.id}>
            {/* Wide invisible hit area so the line is easy to click. */}
            <path
              d={d}
              className="boardArrowHit"
              style={{ strokeWidth: hitStrokeWidth }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id);
              }}
            />
            <path
              d={d}
              className={`boardArrowLine ${isSelected ? 'selected' : ''}`}
              style={{ strokeWidth }}
              markerEnd="url(#boardArrowHead)"
            />
            {isSelected && edge.start && (
              <circle
                cx={s.x}
                cy={s.y}
                r={handleRadius}
                className="boardArrowEndpointHandle"
                style={{ strokeWidth: handleStrokeWidth }}
                onMouseDown={(e) => onEdgeEndpointMouseDown(e, edge.id, 'start')}
              />
            )}
            {isSelected && edge.end && (
              <circle
                cx={t.x}
                cy={t.y}
                r={handleRadius}
                className="boardArrowEndpointHandle"
                style={{ strokeWidth: handleStrokeWidth }}
                onMouseDown={(e) => onEdgeEndpointMouseDown(e, edge.id, 'end')}
              />
            )}
            {isSelected && (
              <g
                className="boardArrowDeleteBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveEdge(edge.id);
                }}
                aria-label="Delete connection"
              >
                <circle
                  cx={mid.x}
                  cy={mid.y}
                  r={deleteRadius + strokeWidth}
                  className="boardArrowDeleteMask"
                />
                <circle
                  cx={mid.x}
                  cy={mid.y}
                  r={deleteRadius}
                  className="boardArrowDeleteCircle"
                  style={{ strokeWidth: deleteStrokeWidth }}
                />
                <path
                  d={`M ${mid.x - deleteXOffset},${mid.y - deleteXOffset} L ${mid.x + deleteXOffset},${mid.y + deleteXOffset} M ${mid.x + deleteXOffset},${mid.y - deleteXOffset} L ${mid.x - deleteXOffset},${mid.y + deleteXOffset}`}
                  className="boardArrowDeleteX"
                  style={{ strokeWidth: deleteXStrokeWidth }}
                />
              </g>
            )}
          </g>
        );
      })}

      {(arrowSource || arrowPointSource) && mousePos && (() => {
        const ghostEdge = arrowSource
          ? { from: arrowSource.id, fromSide: arrowSource.side, end: mousePos }
          : { start: arrowPointSource, end: mousePos };
        const geom = computeEdgeGeometry(ghostEdge, itemById, bounds);
        if (!geom) return null;
        const d = roundedPathFromPoints(geom.points);
        return (
          <path
            d={d}
            className="boardArrowGhost"
            style={{
              strokeWidth: 1.3 / zoom,
              strokeDasharray: `${5 / zoom} ${4 / zoom}`,
            }}
            markerEnd="url(#boardArrowHeadGhost)"
          />
        );
      })()}
    </svg>
  );
}

/* ---------- Frame ----------
   A frame is a transparent grouping rectangle with a colored border and a
   floating label above its top-left corner. Membership is derived (any node
   whose center lies inside the rect is "in" the frame), so adding/removing
   members is just a matter of moving things in or out. */
function FrameNode({
  frame,
  selected,
  editing,
  zoom,
  tool,
  arrowActive,
  arrowActiveSide,
  onPickAnchor,
  onMouseDown,
  onClick,
  onLabelDoubleClick,
  onLabelCommit,
}) {
  const labelRef = useRef(null);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = labelRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editing]);

  /* Label size is computed in SCREEN pixels first (using the frame's
     apparent on-screen width = frame.w * zoom), then converted to CSS px
     by dividing by zoom. After the surface's `scale(zoom)` transform, the
     label always renders at the chosen screen size — never blowing up at
     high zoom. */
  const screenFrameWidth = frame.w * zoom;
  /* Smaller coefficient + a tighter cap so even huge frames at max zoom
     show a compact tag instead of a banner. */
  const baseFontSize = Math.round(
    Math.max(9, Math.min(13, screenFrameWidth * 0.011))
  );
  const labelFontSize = baseFontSize / zoom;
  const labelPaddingY = Math.max(2, Math.round(baseFontSize * 0.2)) / zoom;
  const labelPaddingX = Math.max(6, Math.round(baseFontSize * 0.55)) / zoom;
  /* Max width in CSS px = the larger of (frame width in CSS px) or 120
     screen px. Both stay readable at any zoom. */
  const labelMaxWidth = Math.max(120 / zoom, frame.w);
  const labelBorderWidth = 1 / zoom;
  const frameBorderWidth = labelBorderWidth;
  const fillMode = frame.fillMode || 'translucent';
  const frameBackground =
    fillMode === 'solid'
      ? frame.color
      : `color-mix(in srgb, ${frame.color} 12%, transparent)`;

  return (
    <div
      className={`boardFrame ${selected ? 'selected' : ''}`}
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        borderColor: frame.color,
        borderWidth: frameBorderWidth,
        background: frameBackground,
        '--frame-color': frame.color,
      }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div
        ref={labelRef}
        className={`boardFrameLabel ${editing ? 'editing' : ''}`}
        style={{
          fontSize: `${labelFontSize}px`,
          padding: `${labelPaddingY}px ${labelPaddingX}px`,
          maxWidth: labelMaxWidth,
          borderWidth: labelBorderWidth,
        }}
        contentEditable={editing}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Frame name"
        onClick={(e) => {
          if (editing) {
            e.stopPropagation();
            return;
          }
          e.stopPropagation();
          onClick(e);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onLabelDoubleClick();
        }}
        onMouseDown={(e) => {
          if (e.detail > 1) {
            e.stopPropagation();
            return;
          }
          // The label also works as a grab handle, while editing keeps text
          // selection isolated from board dragging.
          if (editing) {
            e.stopPropagation();
            return;
          }
          e.stopPropagation();
          onMouseDown(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => onLabelCommit(e.currentTarget.textContent || '')}
      >
        {frame.name || 'Frame'}
      </div>
      {tool === 'arrow' ? (
        <AnchorHandles
          active
          activeSide={arrowActive ? arrowActiveSide : null}
          zoom={zoom}
          onPickSide={onPickAnchor}
        />
      ) : null}
    </div>
  );
}

/* ============================ Main ============================ */
export default function Board() {
  const initial = loadState();
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);
  const [frames, setFrames] = useState(initial.frames);
  const [viewport, setViewport] = useState(initial.viewport);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedFrameId, setSelectedFrameId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingFrameId, setEditingFrameId] = useState(null);
  const [frameDraft, setFrameDraft] = useState(null);
  // arrowSource is either null or { id, side } where side is 'auto' | 'top' |
  // 'right' | 'bottom' | 'left'. 'auto' means the user clicked the body of the
  // item (so the routing should pick a side geometrically).
  const [arrowSource, setArrowSource] = useState(null);
  const arrowSourceId = arrowSource?.id ?? null;
  const [arrowPointSource, setArrowPointSource] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [nodeBounds, setNodeBounds] = useState({});
  const [isPanning, setIsPanning] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState({ vertical: [], horizontal: [] });
  const [fontOptions, setFontOptions] = useState(TEXT_FONT_OPTIONS);
  const [textToolbarFont, setTextToolbarFont] = useState(TEXT_FONT_OPTIONS[0].value);
  // Style at the cursor inside the currently-editing text node. Lets the
  // floating toolbar reflect whatever the user just moved their caret onto,
  // rather than the node's outer-level fontSize/fontFamily.
  const [cursorFontSize, setCursorFontSize] = useState(null);
  const [cursorFontFamily, setCursorFontFamily] = useState(null);
  // Per-drawing-tool configuration. Keyed by variant so swapping pen/pencil/
  // brush keeps each one's last-used thickness and color.
  const [drawingConfig, setDrawingConfig] = useState(DRAWING_DEFAULTS);
  // The stroke the user is currently dragging out. Null when not drawing.
  const [drawingDraft, setDrawingDraft] = useState(null);
  const [eraserPoint, setEraserPoint] = useState(null);
  const [isDrawingPaletteOpen, setIsDrawingPaletteOpen] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState('');
  const [isTaskImportOpen, setIsTaskImportOpen] = useState(false);
  const [taskImportQuery, setTaskImportQuery] = useState('');
  const [expandedTaskNodeId, setExpandedTaskNodeId] = useState(null);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState(null);

  const wrapperRef = useRef(null);
  const surfaceRef = useRef(null);
  const fileInputRef = useRef(null);
  const nodeElRefs = useRef({});
  /* When the user is mid-drag on a resize handle we want them to be free to
     shrink the box past the content — the auto-fit ResizeObserver below
     would otherwise immediately undo every "make smaller" move. */
  const reflowDisabledRef = useRef(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const restoringHistoryRef = useRef(false);
  const loadingLocalFontsRef = useRef(false);
  const lastBoardStateRef = useRef(serializeBoardState(initial.nodes, initial.edges));
  const nodeDragMovedRef = useRef(false);
  const lastNodeClickRef = useRef({ id: null, time: 0 });
  /* IndexedDB hydration must finish before we start writing, otherwise an
     empty initial state could overwrite the user's saved board. */
  const persistHydratedRef = useRef(false);
  const persistTimerRef = useRef(null);

  const taskTypeById = useMemo(
    () => new Map(taskTypes.map((type) => [String(type.id), type])),
    [taskTypes]
  );
  const statusOptionColors = useMemo(
    () =>
      STATUS_ORDER.reduce((acc, status) => {
        acc[status] = BOARD_STATUS_COLORS[status] || BOARD_STATUS_COLORS[TASK_STATUS.TO_DO];
        return acc;
      }, {}),
    []
  );
  const filteredImportTasks = useMemo(() => {
    const search = taskImportQuery.trim().toLowerCase();
    return tasks
      .filter((task) => !task.parent_task_id && !task.is_deleted)
      .filter((task) => {
        if (!search) return true;
        return `${task.title || ''} ${task.description || ''}`.toLowerCase().includes(search);
      });
  }, [taskImportQuery, tasks]);

  const loadLocalFontOptions = useCallback(async () => {
    if (
      loadingLocalFontsRef.current ||
      typeof window === 'undefined' ||
      typeof window.queryLocalFonts !== 'function'
    ) {
      return;
    }

    loadingLocalFontsRef.current = true;
    try {
      const fonts = await window.queryLocalFonts();
      const localFamilies = [...new Set(
        fonts
          .map((font) => font.family)
          .filter(Boolean)
      )]
        .sort((a, b) => a.localeCompare(b))
        .map((family) => ({
          label: family,
          value: quoteFontFamily(family),
          searchText: family,
        }));
      setFontOptions(mergeFontOptions(TEXT_FONT_OPTIONS, localFamilies));
    } catch {
      /* Permission denied or no user activation — fallback fonts remain available. */
      loadingLocalFontsRef.current = false;
    }
  }, []);

  /* Local font discovery is browser/permission dependent, so keep a strong fallback list. */
  useEffect(() => {
    loadLocalFontOptions();
  }, [loadLocalFontOptions]);

  const loadTaskData = useCallback(async () => {
    setTasksLoading(true);
    setTasksError('');
    try {
      const [taskItems, typeItems] = await Promise.all([
        tasksApi.getTasks(),
        tasksApi.getTaskTypes(),
      ]);
      setTasks(Array.isArray(taskItems) ? taskItems : []);
      setTaskTypes(Array.isArray(typeItems) ? typeItems : []);
    } catch (error) {
      console.error('Failed to load board task imports:', error);
      setTasksError(error?.message || 'Failed to load tasks');
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  /* IndexedDB is the authoritative *local* cache; the server (when
     authenticated) is the cross-device source of truth via boardSyncApi. */
  const boardSyncApi = useMemo(
    () => ({
      getDocument: () => boardApi.getDocument(),
      updateDocument: async ({ snapshot }) => {
        const doc = await boardApi.updateDocument({ state: snapshot });
        await idbPutBoardSyncMeta({
          serverUpdatedAt: doc.updated_at,
          dirty: false,
        });
        return doc;
      },
    }),
    []
  );

  const {
    initialServerDoc: initialServerBoard,
    markHydrated: markBoardHydrated,
    setSnapshot: setBoardSnapshot,
    schedulePush: scheduleBoardPush,
    isAuthenticated: isBoardAuthenticated,
  } = useDocumentSync({
    api: boardSyncApi,
    debounceMs: BOARD_SYNC_DEBOUNCE_MS,
    featureKey: 'board',
  });

  /* Hydrate from IndexedDB on mount. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await idbGetBoardState();
        if (cancelled) return;
        if (stored) {
          const normalized = normalizeBoardState(stored);
          setNodes(normalized.nodes);
          setEdges(normalized.edges);
          setFrames(normalized.frames);
          setViewport(normalized.viewport);
          lastBoardStateRef.current = serializeBoardState(
            normalized.nodes,
            normalized.edges
          );
        } else if (
          initial.nodes.length ||
          initial.edges.length ||
          initial.frames.length
        ) {
          await idbPutBoardState({
            nodes: initial.nodes,
            edges: initial.edges,
            frames: initial.frames,
            viewport: initial.viewport,
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Board: IndexedDB hydration failed, using localStorage fallback', err);
      } finally {
        if (!cancelled) {
          persistHydratedRef.current = true;
          markBoardHydrated();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reconcile with initial server doc by timestamp. No conflict UI: local
     dirty wins, then newer side wins, otherwise no-op. */
  const initialBoardReconciledRef = useRef(false);
  useEffect(() => {
    if (!persistHydratedRef.current) return;
    if (!initialServerBoard) return;
    if (initialBoardReconciledRef.current) return;
    initialBoardReconciledRef.current = true;

    (async () => {
      const meta = await idbGetBoardSyncMeta();
      const localDirty = Boolean(meta?.dirty);
      const localServerUpdatedAt = meta?.serverUpdatedAt || null;
      const remoteUpdatedAt = initialServerBoard.updated_at || null;
      const remoteState = initialServerBoard.state || {};

      const remoteIsNewer =
        !localServerUpdatedAt ||
        (remoteUpdatedAt && remoteUpdatedAt > localServerUpdatedAt);

      if (localDirty) {
        setBoardSnapshot(latestPersistRef.current);
        scheduleBoardPush();
      } else if (remoteIsNewer) {
        const normalized = normalizeBoardState(remoteState);
        setNodes(normalized.nodes);
        setEdges(normalized.edges);
        setFrames(normalized.frames);
        setViewport(normalized.viewport);
        lastBoardStateRef.current = serializeBoardState(
          normalized.nodes,
          normalized.edges
        );
        await idbPutBoardState({
          nodes: normalized.nodes,
          edges: normalized.edges,
          frames: normalized.frames,
          viewport: normalized.viewport,
        }).catch(() => {});
        await idbPutBoardSyncMeta({
          serverUpdatedAt: remoteUpdatedAt,
          dirty: false,
        });
      } else {
        await idbPutBoardSyncMeta({
          serverUpdatedAt: remoteUpdatedAt,
          dirty: false,
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialServerBoard]);

  /* Persist board state to IDB and schedule a push. Mark dirty so a reload
     before the PUT completes pushes the unsynced edits up. */
  useEffect(() => {
    if (!persistHydratedRef.current) return;
    if (!initialBoardReconciledRef.current) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    const snapshot = { nodes, edges, frames, viewport };
    setBoardSnapshot(snapshot);
    persistTimerRef.current = setTimeout(async () => {
      persistTimerRef.current = null;
      try {
        await idbPutBoardState(snapshot);
        const meta = await idbGetBoardSyncMeta();
        await idbPutBoardSyncMeta({
          serverUpdatedAt: meta?.serverUpdatedAt || null,
          dirty: true,
        });
      } catch (err) {
        console.warn('Board: failed to persist state to IndexedDB', err);
      }
    }, BOARD_PERSIST_DEBOUNCE_MS);
    scheduleBoardPush();
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [nodes, edges, frames, viewport, scheduleBoardPush, setBoardSnapshot]);

  /* Image upload helper: uploads when authenticated, falls back to inline
     base64 (today's behaviour) when logged out. */
  const uploadBoardImage = useCallback(async (file) => {
    if (!file) return '';
    if (!isBoardAuthenticated()) {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }
    try {
      const result = await mediaApi.upload({ file, kind: 'board' });
      return result?.url || '';
    } catch (err) {
      console.warn('Board: image upload failed, falling back to inline base64', err);
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }
  }, [isBoardAuthenticated]);

  /* Mirror latest state into a ref so the unmount flush below sees the
     most recent values without resubscribing on every change. */
  const latestPersistRef = useRef({ nodes, edges, frames, viewport });
  useEffect(() => {
    latestPersistRef.current = { nodes, edges, frames, viewport };
  }, [nodes, edges, frames, viewport]);

  /* Flush any pending write on unmount so a fast tab switch doesn't lose
     the most recent edits. */
  useEffect(() => {
    return () => {
      if (!persistHydratedRef.current) return;
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      idbPutBoardState(latestPersistRef.current).catch(() => {});
    };
  }, []);

  /* Board history: content only. Viewport changes are intentionally excluded. */
  useEffect(() => {
    const current = serializeBoardState(nodes, edges);
    if (current === lastBoardStateRef.current) return;

    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      lastBoardStateRef.current = current;
      return;
    }

    undoStackRef.current.push(JSON.parse(lastBoardStateRef.current));
    if (undoStackRef.current.length > BOARD_HISTORY_LIMIT) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    lastBoardStateRef.current = current;
  }, [nodes, edges]);

  /* Measure rendered node sizes for arrow geometry */
  useLayoutEffect(() => {
    const next = {};
    nodes.forEach((n) => {
      const el = nodeElRefs.current[n.id];
      if (!el) return;
      next[n.id] = { w: el.offsetWidth, h: el.offsetHeight };
    });
    // Layout-measure pattern; we need rendered sizes to draw arrows correctly.
    setNodeBounds(next);
  }, [nodes]);

  /* Convert screen pixels to world coords (inverse of the surface transform). */
  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const wrap = wrapperRef.current;
      if (!wrap) return { x: 0, y: 0 };
      const rect = wrap.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - viewport.x) / viewport.zoom,
        y: (sy - viewport.y) / viewport.zoom,
      };
    },
    [viewport]
  );

  /* Wheel: zoom in/out, anchored to the cursor. */
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return undefined;
    function onWheel(e) {
      // Let UI elements with their own scroll/wheel needs use the wheel
      // natively — without this they'd be hijacked by the zoom handler.
      const target = e.target;
      if (target && typeof target.closest === 'function') {
        if (
          target.closest('.boardTaskDetailEmbed') ||
          target.closest('.customSelectList') ||
          target.closest('.tasksDatePopover') ||
          target.closest('.tasksTimeSelectDropdown') ||
          target.closest('.salColorPickerPopover') ||
          target.closest('.boardTextFloatingToolbar')
        ) {
          return;
        }
      }
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const factor = getWheelZoomFactor(e.deltaY);
      setViewport((prev) => {
        const nextZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, prev.zoom * factor)
        );
        if (nextZoom === prev.zoom) return prev;
        const worldX = (cursorX - prev.x) / prev.zoom;
        const worldY = (cursorY - prev.y) / prev.zoom;
        return {
          zoom: nextZoom,
          x: cursorX - worldX * nextZoom,
          y: cursorY - worldY * nextZoom,
        };
      });
    }
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, []);

  /* Track mouse for the ghost arrow (in world coords). */
  useEffect(() => {
    if (!arrowSource && !arrowPointSource) return undefined;
    function handleMove(e) {
      setMousePos(screenToWorld(e.clientX, e.clientY));
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [arrowSource, arrowPointSource, screenToWorld]);

  const selectNode = useCallback((id) => {
    setSelectedId(id);
    setSelectedEdgeId(null);
    setSelectedFrameId(null);
  }, []);

  const removeNode = useCallback((id) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setEditingId((cur) => (cur === id ? null : cur));
    setExpandedTaskNodeId((cur) => (cur === id ? null : cur));
    setArrowSource((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  function collapseTaskNode(id) {
    if (!id) return;
    const zoom = Math.max(viewport.zoom || 1, 0.01);
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== id || node.type !== 'task') return node;
        const detailW = node.w || node.detailW || DEFAULT_TASK_DETAIL_WIDTH / zoom;
        const detailH = node.h || node.detailH || DEFAULT_TASK_DETAIL_HEIGHT / zoom;
        const cardW = node.cardW || DEFAULT_TASK_NODE_WIDTH / zoom;
        const cardH = node.cardH || DEFAULT_TASK_NODE_HEIGHT / zoom;
        return {
          ...node,
          detailW,
          detailH,
          w: cardW,
          h: cardH,
        };
      })
    );
    setExpandedTaskNodeId((cur) => (cur === id ? null : cur));
  }

  function expandTaskNode(id) {
    if (!id) return;
    const zoom = Math.max(viewport.zoom || 1, 0.01);
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== id || node.type !== 'task') return node;
        const cardW = node.w || node.cardW || DEFAULT_TASK_NODE_WIDTH / zoom;
        const cardH = node.h || node.cardH || DEFAULT_TASK_NODE_HEIGHT / zoom;
        const detailW = node.detailW || DEFAULT_TASK_DETAIL_WIDTH / zoom;
        const detailH = node.detailH || DEFAULT_TASK_DETAIL_HEIGHT / zoom;
        return {
          ...node,
          cardW,
          cardH,
          w: detailW,
          h: detailH,
        };
      })
    );
    setExpandedTaskNodeId(id);
  }

  function collapseExpandedTaskNode() {
    if (expandedTaskNodeId) {
      collapseTaskNode(expandedTaskNodeId);
    }
  }

  const removeEdge = useCallback((id) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    setSelectedEdgeId((cur) => (cur === id ? null : cur));
  }, []);

  function setEdgeStrokeWidth(id, value) {
    const strokeWidth = Math.max(1, Math.min(12, Number(value) || DEFAULT_ARROW_STROKE_WIDTH));
    setEdges((prev) =>
      prev.map((edge) => (edge.id === id ? { ...edge, strokeWidth } : edge))
    );
  }

  const selectEdge = useCallback((id) => {
    setSelectedEdgeId(id);
    setSelectedId(null);
    setSelectedFrameId(null);
    setArrowSource(null);
    setArrowPointSource(null);
  }, []);

  const handleEdgeEndpointMouseDown = useCallback((e, edgeId, endpoint) => {
    e.stopPropagation();
    e.preventDefault();
    selectEdge(edgeId);

    function onMove(ev) {
      const point = screenToWorld(ev.clientX, ev.clientY);
      setEdges((prev) =>
        prev.map((edge) =>
          edge.id === edgeId ? { ...edge, [endpoint]: point } : edge
        )
      );
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [screenToWorld, selectEdge]);

  const selectFrame = useCallback((id) => {
    setSelectedFrameId(id);
    setSelectedId(null);
    setSelectedEdgeId(null);
  }, []);

  const removeFrame = useCallback((id) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    setSelectedFrameId((cur) => (cur === id ? null : cur));
    setEditingFrameId((cur) => (cur === id ? null : cur));
    setArrowSource((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  /* Read current DOM text of the frame whose name is being edited. */
  const readEditingFrameName = useCallback(() => {
    const el = document.querySelector('.boardFrameLabel.editing');
    return el?.textContent?.trim() || '';
  }, []);

  /* Read the current DOM-side content of the editing text node. We don't
     mirror keystrokes into React state (avoids cursor jumps on
     contentEditable), so the source of truth during editing is the DOM. */
  const readEditingText = useCallback(() => {
    const el = document.querySelector('.boardTextNode.editing .boardTextContent');
    return readEditablePlainText(el);
  }, []);

  const readEditingHtml = useCallback(() => {
    const el = document.querySelector('.boardTextNode.editing .boardTextContent');
    return sanitizeTextHtml(el);
  }, []);

  const restoreBoardState = useCallback((state) => {
    restoringHistoryRef.current = true;
    setNodes(Array.isArray(state.nodes) ? state.nodes : []);
    setEdges(Array.isArray(state.edges) ? state.edges : []);
    setSelectedId(null);
    setSelectedEdgeId(null);
    setEditingId(null);
    setArrowSource(null);
    setArrowPointSource(null);
    setMousePos(null);
    setAlignmentGuides({ vertical: [], horizontal: [] });
  }, []);

  const undoBoard = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(JSON.parse(lastBoardStateRef.current));
    restoreBoardState(previous);
  }, [restoreBoardState]);

  const redoBoard = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(JSON.parse(lastBoardStateRef.current));
    restoreBoardState(next);
  }, [restoreBoardState]);

  /* Keyboard: ESC commits text edit / clears transient state, Delete removes
     selection. */
  useEffect(() => {
    function handleKey(e) {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      const isRedo =
        (e.metaKey || e.ctrlKey) &&
        ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y');
      if ((isUndo || isRedo) && !isTextInputTarget(e.target)) {
        e.preventDefault();
        if (isRedo) {
          redoBoard();
        } else {
          undoBoard();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (editingId) {
          commitText(editingId, readEditingText(), readEditingHtml());
          return;
        }
        if (editingFrameId) {
          setFrameName(editingFrameId, readEditingFrameName());
          setEditingFrameId(null);
          return;
        }
        setArrowSource(null);
        setArrowPointSource(null);
        setSelectedId(null);
        setSelectedEdgeId(null);
        setSelectedFrameId(null);
        setFrameDraft(null);
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !editingId &&
        !editingFrameId
      ) {
        if (isTextInputTarget(e.target)) {
          return;
        }
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId);
        } else if (selectedFrameId) {
          removeFrame(selectedFrameId);
        } else if (selectedId) {
          removeNode(selectedId);
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedId,
    selectedEdgeId,
    selectedFrameId,
    editingId,
    editingFrameId,
    removeNode,
    removeEdge,
    removeFrame,
    readEditingText,
    readEditingFrameName,
    undoBoard,
    redoBoard,
  ]);

  /* Auto-fit the editing text node to its content while it's being edited.
     When a font/size/format change makes the text larger than its current
     box (which the user manually resized), grow node.w/h so the content
     stays inside the visible rectangle. Only expands — never shrinks below
     the user-chosen size. Skipped while a resize-drag is in progress. */
  useEffect(() => {
    if (!editingId) return undefined;
    const editingEl = document.querySelector('.boardTextNode.editing');
    if (!editingEl || typeof ResizeObserver === 'undefined') return undefined;
    const contentEl = editingEl.querySelector('.boardTextContent');

    function fit() {
      if (reflowDisabledRef.current) return;
      const sw = editingEl.scrollWidth;
      const sh = editingEl.scrollHeight;
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== editingId || n.type !== 'text') return n;
          // Only auto-fit nodes the user has already explicitly sized —
          // otherwise CSS auto-sizing handles growth for free.
          if (n.w == null && n.h == null) return n;
          let nextW = n.w;
          let nextH = n.h;
          if (n.w != null && sw > n.w) nextW = Math.ceil(sw);
          if (n.h != null && sh > n.h) nextH = Math.ceil(sh);
          if (nextW === n.w && nextH === n.h) return n;
          return { ...n, w: nextW, h: nextH };
        })
      );
    }

    const ro = new ResizeObserver(fit);
    ro.observe(editingEl);
    if (contentEl) ro.observe(contentEl);
    return () => ro.disconnect();
  }, [editingId]);

  /* Continuously track the user's text selection while editing so the
     formatting helpers (font, size, color, bold/italic) can always restore
     it onto the contentEditable just before execCommand runs — even after
     focus has hopped to a toolbar input. We only stash ranges that live
     inside the editing element; ranges from a search field, the size
     input, etc., are ignored. */
  useEffect(() => {
    if (!editingId) return undefined;
    function onSelChange() {
      const editing = document.querySelector(
        '.boardTextNode.editing .boardTextContent'
      );
      if (!editing) return;
      // Only track changes while the editor is actually the focused element.
      // When focus moves to a toolbar input, some browsers collapse the
      // editor's visible selection — that selectionchange would otherwise
      // clobber the range the user actually wants to format.
      if (document.activeElement !== editing) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!editing.contains(range.commonAncestorContainer)) return;

      savedTextSelection = range.cloneRange();

      // Surface the caret's resolved style so the toolbar can show the size
      // and font the user is actually typing into.
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!node || !editing.contains(node)) return;
      const computed = window.getComputedStyle(node);
      const sizePx = Math.round(parseFloat(computed.fontSize));
      if (Number.isFinite(sizePx)) {
        setCursorFontSize((prev) => (prev === sizePx ? prev : sizePx));
      }
      const computedFirst = normalizeFontFamilyFirst(computed.fontFamily);
      const matched = fontOptions.find(
        (opt) => normalizeFontFamilyFirst(opt.value) === computedFirst
      );
      if (matched) {
        setCursorFontFamily((prev) => (prev === matched.value ? prev : matched.value));
      }
    }
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [editingId, fontOptions]);

  // Reset detected caret style whenever a different node enters edit mode.
  useEffect(() => {
    setCursorFontSize(null);
    setCursorFontFamily(null);
  }, [editingId]);


  const editingIdRef = useRef(editingId);
  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

  // Document-level double-click detector for entering edit on text nodes.
  // The React onDoubleClick / onClick path is unreliable here: once a node
  // gets selected, the SelectionFrame's resize handles cover small text
  // bodies and intercept the second click, so the native dblclick never
  // dispatches to the text node. Hit-testing with elementsFromPoint at the
  // click coordinates lets us find the underlying node regardless of what's
  // visually on top, then we trigger edit mode on two clicks within 400ms.
  // setEditingId is deferred via setTimeout so the current mousedown event
  // finishes cleanly — applying it synchronously caused the commit listener
  // to attach mid-event and tear edit mode back down on the same gesture.
  useEffect(() => {
    if (tool !== 'select') return undefined;
    let lastClick = { id: null, time: 0 };
    function onDocMouseDown(e) {
      if (editingIdRef.current) return;
      const els = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(e.clientX, e.clientY)
        : [e.target];
      const textNodeEl = els.find((el) => el?.classList?.contains?.('boardTextNode'));
      if (!textNodeEl) {
        lastClick = { id: null, time: 0 };
        return;
      }
      let nodeId = null;
      for (const [id, el] of Object.entries(nodeElRefs.current)) {
        if (el === textNodeEl) {
          nodeId = id;
          break;
        }
      }
      if (!nodeId) return;
      const now = Date.now();
      if (lastClick.id === nodeId && now - lastClick.time < 400) {
        lastClick = { id: null, time: 0 };
        setTimeout(() => setEditingId(nodeId), 0);
        return;
      }
      lastClick = { id: nodeId, time: now };
    }
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [tool]);

  /* Commit the currently-edited text when the user clicks anywhere outside
     the text node, the toolbar popout, or the color picker UI. This is what
     drives "click somewhere else to finish editing" — the contentEditable
     itself never auto-commits on blur. */
  useEffect(() => {
    if (!editingId) return undefined;
    function onDocMouseDown(e) {
      const t = e.target;
      if (
        t.closest &&
        (t.closest('.boardTextNode.editing') ||
          t.closest('.boardSelectionFrame') ||
          t.closest('.boardTextFloatingToolbar') ||
          t.closest('.boardToolbarPopout') ||
          t.closest('.salColorPickerWrap') ||
          t.closest('.salColorPickerPopover'))
      ) {
        return;
      }
      commitText(editingId, readEditingText(), readEditingHtml());
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, readEditingHtml, readEditingText]);

  /* Same pattern for frame-name editing — outside click commits. */
  useEffect(() => {
    if (!editingFrameId) return undefined;
    function onDocMouseDown(e) {
      const t = e.target;
      if (
        t.closest &&
        (t.closest('.boardFrameLabel.editing') ||
          t.closest('.boardToolbarPopout') ||
          t.closest('.salColorPickerWrap') ||
          t.closest('.salColorPickerPopover'))
      ) {
        return;
      }
      setFrameName(editingFrameId, readEditingFrameName());
      setEditingFrameId(null);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [editingFrameId, readEditingFrameName]);

  const registerNodeRef = useCallback((id, el) => {
    if (el) nodeElRefs.current[id] = el;
    else delete nodeElRefs.current[id];
  }, []);

  /* Switching tools cancels any in-progress arrow / frame draft. */
  const selectTool = useCallback((next) => {
    setTool(next);
    if (!MARKUP_TOOLS.includes(next)) {
      setIsDrawingPaletteOpen(false);
    }
    setArrowSource(null);
    setArrowPointSource(null);
    setFrameDraft(null);
  }, []);

  function setFrameName(id, name) {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name } : f))
    );
  }

  function setFrameColor(id, color) {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, color } : f))
    );
  }

  function setFrameFillMode(id, fillMode) {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, fillMode } : f))
    );
  }

  /* ---------- mutations ---------- */

  function addTextNode(worldX, worldY) {
    const id = generateId();
    setNodes((prev) => [
      ...prev,
      { id, type: 'text', x: worldX, y: worldY, content: '', fontSize: 16 },
    ]);
    setEditingId(id);
    selectNode(id);
  }

  function addTaskNode(task) {
    if (!task?.id || !wrapperRef.current) return;
    const zoom = Math.max(viewport.zoom || 1, 0.01);
    const cardW = DEFAULT_TASK_NODE_WIDTH / zoom;
    const cardH = DEFAULT_TASK_NODE_HEIGHT / zoom;
    const detailW = DEFAULT_TASK_DETAIL_WIDTH / zoom;
    const detailH = DEFAULT_TASK_DETAIL_HEIGHT / zoom;
    const rect = wrapperRef.current.getBoundingClientRect();
    const center = screenToWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    const id = generateId();
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'task',
        taskId: task.id,
        x: center.x - cardW / 2,
        y: center.y - cardH / 2,
        w: cardW,
        h: cardH,
        cardW,
        cardH,
        detailW,
        detailH,
      },
    ]);
    collapseExpandedTaskNode();
    selectNode(id);
    selectTool('select');
    setIsTaskImportOpen(false);
  }

  const handleUpdateTask = useCallback(async (taskId, patch) => {
    const current = tasks.find((task) => task.id === taskId);
    if (!current) return;
    setIsSavingTask(true);
    try {
      const payload = buildUpdatePayload(current, patch);
      const updated = await tasksApi.updateTask(taskId, payload);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    } catch (error) {
      console.error('Failed to update board task:', error);
      setTasksError(error?.message || 'Failed to update task');
      throw error;
    } finally {
      setIsSavingTask(false);
    }
  }, [tasks]);

  const handleUpdateTaskStatus = useCallback(async (taskIds, status) => {
    const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
    if (ids.length === 0) return;
    const previous = tasks;
    setTasks((prev) =>
      prev.map((task) =>
        ids.includes(task.id)
          ? {
              ...task,
              status,
              completed_at:
                status === TASK_STATUS.COMPLETED
                  ? task.completed_at || new Date().toISOString()
                  : task.completed_at,
              pause_start_date:
                status === TASK_STATUS.PAUSED
                  ? task.pause_start_date || new Date().toISOString()
                  : task.pause_start_date,
            }
          : task
      )
    );
    try {
      await tasksApi.updateTasksBulkStatus({ task_ids: ids, status });
      loadTaskData();
    } catch (error) {
      setTasks(previous);
      console.error('Failed to update board task status:', error);
      setTasksError(error?.message || 'Failed to update task status');
      throw error;
    }
  }, [loadTaskData, tasks]);

  const handleCreateSubtask = useCallback(async (parentId, form) => {
    const payload = getNormalizedSubtaskPayload(parentId, form);
    if (!payload.title) return;
    try {
      const created = await tasksApi.createTask(payload);
      setTasks((prev) => prev.map((task) =>
        task.id === parentId ? { ...task, is_parent: true } : task
      ).concat(created));
    } catch (error) {
      console.error('Failed to create board subtask:', error);
      setTasksError(error?.message || 'Failed to create subtask');
      throw error;
    }
  }, []);

  const handleDeleteTask = useCallback(async (taskId) => {
    if (!taskId) return;
    const ids = new Set([taskId]);
    let expanded = true;
    while (expanded) {
      expanded = false;
      tasks.forEach((task) => {
        if (task.parent_task_id && ids.has(task.parent_task_id) && !ids.has(task.id)) {
          ids.add(task.id);
          expanded = true;
        }
      });
    }
    const deleteIds = Array.from(ids);
    const previous = tasks;
    setTasks((prev) => prev.filter((task) => !ids.has(task.id)));
    try {
      await tasksApi.deleteTasksBulk({ task_ids: deleteIds });
      setPendingDeleteTaskId(null);
      setExpandedTaskNodeId(null);
      setNodes((prev) => prev.filter((node) => node.type !== 'task' || !ids.has(node.taskId)));
    } catch (error) {
      setTasks(previous);
      console.error('Failed to delete board task:', error);
      setTasksError(error?.message || 'Failed to delete task');
    }
  }, [tasks]);

  const addPastedTextNode = useCallback((text, worldX, worldY, fontSize = 16, width) => {
    const content = (text || '').replace(/\r\n?/g, '\n').trim();
    if (!content) return;
    const id = generateId();
    const href = normalizeUrl(content);
    if (href) {
      setNodes((prev) => [
        ...prev,
        {
          id,
          type: 'link',
          x: worldX - DEFAULT_LINK_PREVIEW_WIDTH / 2,
          y: worldY - DEFAULT_LINK_PREVIEW_HEIGHT / 2,
          w: DEFAULT_LINK_PREVIEW_WIDTH,
          h: DEFAULT_LINK_PREVIEW_HEIGHT,
          href,
        },
      ]);
      setEditingId(null);
      selectNode(id);
      return;
    }
    const shouldWrap = !href && width;
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'text',
        x: shouldWrap ? worldX - width / 2 : worldX,
        y: worldY,
        w: shouldWrap ? width : undefined,
        content,
        href: href || undefined,
        fontSize,
        align: 'left',
      },
    ]);
    setEditingId(null);
    selectNode(id);
  }, [selectNode]);

  function setTextFontSize(id, value) {
    const v = Math.max(8, Math.min(120, Math.round(value)));
    if (editingId === id) {
      applyFontSizeToEditingText(v);
      return;
    }
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id && n.type === 'text' ? { ...n, fontSize: v } : n
      )
    );
  }

  /* Apply font family to the WHOLE text node (not just the selected
     fragment). We also strip any inline `font-family` from inner spans the
     contentEditable might have accumulated from previous execCommand-style
     edits — otherwise those overrides would shadow the node-level font. */
  function setTextFontFamily(id, fontFamily) {
    if (editingId === id) {
      const editingEl = document.querySelector(
        '.boardTextNode.editing .boardTextContent'
      );
      if (editingEl) {
        editingEl.querySelectorAll('[style*="font-family"]').forEach((el) => {
          el.style.fontFamily = '';
          if (!el.getAttribute('style')?.trim()) {
            el.removeAttribute('style');
          }
        });
      }
    }
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id && n.type === 'text' ? { ...n, fontFamily } : n
      )
    );
  }

  function changeTextColor(color) {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, color);
  }

  function toggleInlineCommand(command) {
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(command);
  }

  function toggleBulletList() {
    document.execCommand('insertUnorderedList');
  }

  function applyTextAlignment(alignment) {
    const command = {
      left: 'justifyLeft',
      center: 'justifyCenter',
      right: 'justifyRight',
    }[alignment];
    if (command) document.execCommand(command);
  }

  const addImageNode = useCallback((dataUrl, worldX, worldY) => {
    const img = new Image();
    img.onload = () => {
      const scale =
        img.naturalWidth > MAX_IMAGE_WIDTH
          ? MAX_IMAGE_WIDTH / img.naturalWidth
          : 1;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const id = generateId();
      setNodes((prev) => [
        ...prev,
        {
          id,
          type: 'image',
          x: worldX - w / 2,
          y: worldY - h / 2,
          src: dataUrl,
          w,
          h,
        },
      ]);
    };
    img.src = dataUrl;
  }, []);

  useEffect(() => {
    function handlePaste(e) {
      if (isTextInputTarget(e.target)) return;
      const imageItem = Array.from(e.clipboardData?.items || []).find((item) =>
        item.type.startsWith('image/')
      );
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const center = screenToWorld(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (!file) return;

        e.preventDefault();
        uploadBoardImage(file).then((url) => {
          if (url) addImageNode(url, center.x, center.y);
        });
        return;
      }

      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (!text) return;

      e.preventDefault();
      addPastedTextNode(
        text,
        center.x,
        center.y,
        Math.round(16 / viewport.zoom),
        Math.round(PASTED_TEXT_SCREEN_WIDTH / viewport.zoom)
      );
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addImageNode, addPastedTextNode, screenToWorld, uploadBoardImage, viewport.zoom]);

  function commitText(id, text, html = '') {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      removeNode(id);
    } else {
      const href = normalizeUrl(trimmed);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? href
              ? {
                  ...n,
                  type: 'link',
                  href,
                  content: undefined,
                  html: undefined,
                  w: n.w || DEFAULT_LINK_PREVIEW_WIDTH,
                  h: n.h || DEFAULT_LINK_PREVIEW_HEIGHT,
                }
              : { ...n, content: text, html: html || undefined, href: undefined }
            : n
        )
      );
    }
    setEditingId((cur) => (cur === id ? null : cur));
  }

  function moveNode(id, x, y) {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, x, y } : n))
    );
  }

  /* Compute new {x, y, w, h} for a resize drag of `handleId`, given the
     starting state and the cumulative world-space mouse delta. Handles
     rotation by working in box-local (un-rotated) space.

     By default the aspect ratio is preserved:
       - Corner handles: drag is projected onto the diagonal, both axes scale
         by the same factor.
       - Edge handles: the perpendicular axis scales proportionally to the
         dragged axis.
     Holding Shift allows freeform resizing. */
  function computeResize(start, handleId, delta, shiftKey = false) {
    const dir = HANDLE_DIRS[handleId];
    const hw = start.w / 2;
    const hh = start.h / 2;
    const cx = start.x + hw;
    const cy = start.y + hh;
    const R = ((start.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(R);
    const sin = Math.sin(R);

    // Initial handle position in world space.
    const hLocalX = dir.sx * hw;
    const hLocalY = dir.sy * hh;
    const hWorldX = cx + cos * hLocalX - sin * hLocalY;
    const hWorldY = cy + sin * hLocalX + cos * hLocalY;

    // Anchor (opposite corner/edge) — stays fixed in world space.
    const aLocalX = -dir.sx * hw;
    const aLocalY = -dir.sy * hh;
    const aWorldX = cx + cos * aLocalX - sin * aLocalY;
    const aWorldY = cy + sin * aLocalX + cos * aLocalY;

    // Target handle position in world after the drag.
    const tx = hWorldX + delta.x - aWorldX;
    const ty = hWorldY + delta.y - aWorldY;

    // Convert into anchor-local axis-aligned coords (rotate by -R).
    const localX = cos * tx + sin * ty;
    const localY = -sin * tx + cos * ty;

    let newHw = hw;
    let newHh = hh;

    const shouldPreserveAspect = !shiftKey;

    if (shouldPreserveAspect && dir.sx !== 0 && dir.sy !== 0) {
      // Corner: project drag onto the diagonal vector
      // (2*dir.sx*hw, 2*dir.sy*hh) and scale both half-sizes by the same s.
      const denom = 2 * (hw * hw + hh * hh) || 1;
      const s =
        (localX * dir.sx * hw + localY * dir.sy * hh) / denom;
      const minS = MIN_NODE_SIZE / (2 * Math.max(hw, hh, 1));
      const clamped = Math.max(minS, s);
      newHw = clamped * hw;
      newHh = clamped * hh;
    } else if (shouldPreserveAspect && (dir.sx !== 0 || dir.sy !== 0)) {
      // Edge: scale the dragged axis, derive the other from
      // the original aspect ratio.
      if (dir.sx !== 0) {
        newHw = Math.max(MIN_NODE_SIZE / 2, (dir.sx * localX) / 2);
        newHh = hh > 0 ? newHw * (hh / hw) : hh;
      } else {
        newHh = Math.max(MIN_NODE_SIZE / 2, (dir.sy * localY) / 2);
        newHw = hw > 0 ? newHh * (hw / hh) : hw;
      }
    } else {
      if (dir.sx !== 0) {
        newHw = Math.max(MIN_NODE_SIZE / 2, (dir.sx * localX) / 2);
      }
      if (dir.sy !== 0) {
        newHh = Math.max(MIN_NODE_SIZE / 2, (dir.sy * localY) / 2);
      }
    }

    // New center = anchor + Rotate((dir.sx * newHw, dir.sy * newHh), R).
    const ox = dir.sx * newHw;
    const oy = dir.sy * newHh;
    const newCx = aWorldX + cos * ox - sin * oy;
    const newCy = aWorldY + sin * ox + cos * oy;

    const result = {
      x: newCx - newHw,
      y: newCy - newHh,
      w: newHw * 2,
      h: newHh * 2,
    };
    // For text nodes, scale font with the box. We use the geometric mean of
    // the width and height ratios so text grows when the box grows on either
    // axis (and shrinks when shrunk).
    if (start.fontSize) {
      const wRatio = (newHw * 2) / start.w;
      const hRatio = (newHh * 2) / start.h;
      const scale = Math.sqrt(Math.max(wRatio, 0.01) * Math.max(hRatio, 0.01));
      result.fontSize = Math.max(8, Math.min(120, start.fontSize * scale));
    }
    return result;
  }

  function handleResizeStart(e, handleId, node) {
    e.stopPropagation();
    e.preventDefault();

    // If the user just clicked this node and is now clicking its resize handle,
    // treat that as a double-click on the node and enter edit mode instead of
    // starting a resize. On small/medium text nodes the handles overlap the
    // body, so a real double-click intent often lands the second click on a
    // handle.
    const now = Date.now();
    const last = lastNodeClickRef.current;
    if (last.id === node.id && now - last.time < 400) {
      lastNodeClickRef.current = { id: null, time: 0 };
      handleNodeDoubleClick(node.id);
      return;
    }
    lastNodeClickRef.current = { id: node.id, time: now };

    /* Disable the auto-fit reflow while the user is mid-drag; otherwise
       the ResizeObserver below would constantly snap the node back up to
       its content size and prevent the user from shrinking it. */
    reflowDisabledRef.current = true;
    const size = nodeSize(node, nodeBounds);
    const start = {
      x: node.x,
      y: node.y,
      w: size.w,
      h: size.h,
      rotation: node.rotation || 0,
      fontSize: node.type === 'text' ? node.fontSize || 16 : null,
    };
    const startWorld = screenToWorld(e.clientX, e.clientY);
    const baseFontSize = start.fontSize;

    function onMove(ev) {
      const world = screenToWorld(ev.clientX, ev.clientY);
      const delta = {
        x: world.x - startWorld.x,
        y: world.y - startWorld.y,
      };
      const next = computeResize(start, handleId, delta, ev.shiftKey);
      const aligned = getResizeAlignment(
        node,
        next,
        handleId,
        nodes,
        nodeBounds,
        ALIGN_GUIDE_TOLERANCE_PX / viewport.zoom
      );
      let finalNext = aligned.next;
      if (baseFontSize) {
        const wRatio = finalNext.w / start.w;
        const hRatio = finalNext.h / start.h;
        const scale = Math.sqrt(Math.max(wRatio, 0.01) * Math.max(hRatio, 0.01));
        finalNext = {
          ...finalNext,
          fontSize: Math.max(8, Math.min(120, baseFontSize * scale)),
        };
      }
      setAlignmentGuides({
        vertical: aligned.vertical,
        horizontal: aligned.horizontal,
      });
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== node.id) return n;
          if (n.type !== 'task') return { ...n, ...finalNext };
          const nextTaskSize =
            expandedTaskNodeId === n.id
              ? { detailW: finalNext.w, detailH: finalNext.h }
              : { cardW: finalNext.w, cardH: finalNext.h };
          return { ...n, ...finalNext, ...nextTaskSize };
        })
      );
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setAlignmentGuides({ vertical: [], horizontal: [] });
      reflowDisabledRef.current = false;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleRotateStart(e, node) {
    e.stopPropagation();
    e.preventDefault();
    const size = nodeSize(node, nodeBounds);
    const cx = node.x + size.w / 2;
    const cy = node.y + size.h / 2;

    function onMove(ev) {
      const world = screenToWorld(ev.clientX, ev.clientY);
      const angle = Math.atan2(world.y - cy, world.x - cx);
      let degrees = (angle * 180) / Math.PI + 90;
      // Shift = snap to 15°
      if (ev.shiftKey) {
        degrees = Math.round(degrees / 15) * 15;
      }
      setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, rotation: degrees } : n))
      );
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /* ---------- surface interactions (pan / click) ---------- */

  function handleSurfaceMouseDown(e) {
    // Drawing tools should always capture the mousedown, even when it lands
    // on an existing node, so the user can draw over anything.
    if (!MARKUP_TOOLS.includes(tool) && e.target !== e.currentTarget) return;
    if (editingId || editingFrameId) return;

    /* Frame tool: drag a rectangle on empty surface to create a new frame.
       On release we collect every node whose centre falls inside that rect
       (already implicit via frameContains in subsequent renders) and pop
       open the label for the user to name it. */
    if (tool === 'frame') {
      const start = screenToWorld(e.clientX, e.clientY);
      setFrameDraft({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });

      function onFrameMove(ev) {
        const cur = screenToWorld(ev.clientX, ev.clientY);
        setFrameDraft({ x1: start.x, y1: start.y, x2: cur.x, y2: cur.y });
      }
      function onFrameUp(ev) {
        window.removeEventListener('mousemove', onFrameMove);
        window.removeEventListener('mouseup', onFrameUp);
        setFrameDraft(null);
        const end = screenToWorld(ev.clientX, ev.clientY);
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        if (w < MIN_FRAME_SIZE || h < MIN_FRAME_SIZE) return;
        const id = generateId();
        const color = FRAME_COLORS[frames.length % FRAME_COLORS.length];
        setFrames((prev) => [...prev, { id, x, y, w, h, color, name: '', fillMode: 'translucent' }]);
        selectFrame(id);
        setEditingFrameId(id);
        // Auto-switch back to select tool so the user can move things right
        // after drawing the frame.
        selectTool('select');
      }
      window.addEventListener('mousemove', onFrameMove);
      window.addEventListener('mouseup', onFrameUp);
      return;
    }

    if (tool === ERASER_TOOL) {
      e.preventDefault();
      const thickness = drawingConfig.eraser.thickness;
      const radius = thickness / 2;

      function eraseAt(world) {
        setEraserPoint(world);
        const removedIds = new Set();
        setNodes((prev) =>
          prev.flatMap((node) => {
            if (node.type !== 'drawing') return [node];
            const pieces = splitDrawingNodeByEraser(node, world, radius);
            if (pieces.length === 0) {
              removedIds.add(node.id);
            } else if (!pieces.some((piece) => piece.id === node.id)) {
              removedIds.add(node.id);
            }
            return pieces;
          })
        );
        if (removedIds.size > 0) {
          setEdges((prev) =>
            prev.filter((edge) => !removedIds.has(edge.from) && !removedIds.has(edge.to))
          );
          setSelectedId((cur) => (removedIds.has(cur) ? null : cur));
        }
      }

      eraseAt(screenToWorld(e.clientX, e.clientY));
      function onEraseMove(ev) {
        eraseAt(screenToWorld(ev.clientX, ev.clientY));
      }
      function onEraseUp() {
        window.removeEventListener('mousemove', onEraseMove);
        window.removeEventListener('mouseup', onEraseUp);
        setEraserPoint(null);
      }
      window.addEventListener('mousemove', onEraseMove);
      window.addEventListener('mouseup', onEraseUp);
      return;
    }

    if (DRAWING_TOOLS.includes(tool)) {
      const start = screenToWorld(e.clientX, e.clientY);
      const t0 = performance.now();
      const cfg = drawingConfig[tool];
      const initialDraft = {
        variant: tool,
        thickness: cfg.thickness,
        color: cfg.color,
        points: [{ x: start.x, y: start.y, t: 0 }],
      };
      setDrawingDraft(initialDraft);
      // Track the live stroke in a ref instead of state for the per-pointer
      // append loop — calling setState for every mousemove drops frames.
      const live = { ...initialDraft, points: [...initialDraft.points] };

      function onDrawMove(ev) {
        const world = screenToWorld(ev.clientX, ev.clientY);
        const last = live.points[live.points.length - 1];
        const dx = world.x - last.x;
        const dy = world.y - last.y;
        // Subsample: skip near-zero-movement points to keep paths tidy.
        if (Math.hypot(dx, dy) < 0.6) return;
        live.points.push({
          x: world.x,
          y: world.y,
          t: performance.now() - t0,
        });
        setDrawingDraft({ ...live, points: live.points.slice() });
      }
      function onDrawUp() {
        window.removeEventListener('mousemove', onDrawMove);
        window.removeEventListener('mouseup', onDrawUp);
        setDrawingDraft(null);
        const pts = live.points;
        // Throw away accidental clicks that didn't produce a stroke.
        if (pts.length < 2) return;
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const pad = Math.max(2, live.thickness);
        const minX = Math.min(...xs) - pad;
        const minY = Math.min(...ys) - pad;
        const maxX = Math.max(...xs) + pad;
        const maxY = Math.max(...ys) + pad;
        const id = generateId();
        setNodes((prev) => [
          ...prev,
          {
            id,
            type: 'drawing',
            variant: live.variant,
            thickness: live.thickness,
            color: live.color,
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
            // Store points relative to the bounding-box origin so moving the
            // node only changes node.x/y, not every point.
            points: pts.map((p) => ({ x: p.x - minX, y: p.y - minY, t: p.t })),
          },
        ]);
      }
      window.addEventListener('mousemove', onDrawMove);
      window.addEventListener('mouseup', onDrawUp);
      return;
    }

    const startScreenX = e.clientX;
    const startScreenY = e.clientY;
    const startViewX = viewport.x;
    const startViewY = viewport.y;
    let moved = false;
    setIsPanning(true);

    function onMove(ev) {
      const dx = ev.clientX - startScreenX;
      const dy = ev.clientY - startScreenY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      setViewport((prev) => ({
        ...prev,
        x: startViewX + dx,
        y: startViewY + dy,
      }));
    }
    function onUp(ev) {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsPanning(false);
      if (moved) return;
      // It was a click, not a drag — handle per-tool.
      setSelectedEdgeId(null);
      setSelectedFrameId(null);
      if (tool === 'text') {
        const w = screenToWorld(ev.clientX, ev.clientY);
        addTextNode(w.x, w.y);
      } else if (tool === 'arrow') {
        const w = screenToWorld(ev.clientX, ev.clientY);
        if (arrowSource) {
          const fromSide = arrowSource.side === 'auto' ? undefined : arrowSource.side;
          setEdges((prev) => [
            ...prev,
            { id: generateId(), from: arrowSource.id, fromSide, end: w },
          ]);
          setArrowSource(null);
          setArrowPointSource(null);
          setMousePos(null);
        } else if (arrowPointSource) {
          if (Math.hypot(w.x - arrowPointSource.x, w.y - arrowPointSource.y) >= 4) {
            const id = generateId();
            setEdges((prev) => [
              ...prev,
              { id, start: arrowPointSource, end: w },
            ]);
            selectEdge(id);
          }
          setArrowPointSource(null);
          setMousePos(null);
        } else {
          setSelectedId(null);
          setArrowPointSource(w);
          setMousePos(w);
        }
      } else {
        setSelectedId(null);
        collapseExpandedTaskNode();
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /* Shared arrow-tool click handler. `side` is 'auto' for body clicks, or a
     specific side ('top'/'right'/'bottom'/'left') when the user clicked one
     of the anchor dots. Returns true if the click was fully handled by the
     arrow flow. */
  const connectArrowTo = useCallback((itemId, side, onComplete) => {
    if (arrowPointSource) {
      const id = generateId();
      const toSide = side === 'auto' ? undefined : side;
      setEdges((prev) => [
        ...prev,
        { id, start: arrowPointSource, to: itemId, toSide },
      ]);
      setArrowSource(null);
      setArrowPointSource(null);
      setMousePos(null);
      selectEdge(id);
      return;
    }
    if (!arrowSource) {
      setArrowSource({ id: itemId, side });
      setArrowPointSource(null);
      onComplete?.();
      return;
    }
    if (arrowSource.id === itemId) {
      // Clicking the same item toggles its arrow side or cancels.
      if (arrowSource.side !== side) {
        setArrowSource({ id: itemId, side });
      } else {
        setArrowSource(null);
      }
      return;
    }
    // Connect arrowSource -> this item
    const fromSide = arrowSource.side === 'auto' ? undefined : arrowSource.side;
    const toSide = side === 'auto' ? undefined : side;
    const exists = edges.some(
      (ed) => ed.from === arrowSource.id && ed.to === itemId
        && (ed.fromSide || 'auto') === (fromSide || 'auto')
        && (ed.toSide || 'auto') === (toSide || 'auto')
    );
    let id = null;
    if (!exists) {
      id = generateId();
      setEdges((prev) => [
        ...prev,
        { id, from: arrowSource.id, to: itemId, fromSide, toSide },
      ]);
    }
    setArrowSource(null);
    setArrowPointSource(null);
    setMousePos(null);
    if (id) {
      selectEdge(id);
    } else {
      onComplete?.();
    }
  }, [arrowPointSource, arrowSource, edges, selectEdge]);

  /* ---------- frame interactions ---------- */

  function handleFrameClick(e, frame) {
    e.stopPropagation();
    if (editingFrameId === frame.id) return;
    if (tool === 'arrow') {
      connectArrowTo(frame.id, 'auto', () => selectFrame(frame.id));
      return;
    }
    selectFrame(frame.id);
  }

  function handleFrameLabelDoubleClick(id) {
    setEditingFrameId(id);
    selectFrame(id);
  }

  function handleFrameLabelCommit(id, name) {
    setFrameName(id, name.trim());
    setEditingFrameId((cur) => (cur === id ? null : cur));
  }

  /* Drag a frame and bring its members (nodes whose centre is inside the
     frame at drag-start) along for the ride. Items that have since been
     dragged out remain in place. */
  function handleFrameMouseDown(e, frame) {
    if (tool !== 'select') return;
    if (editingFrameId === frame.id) return;
    e.stopPropagation();
    selectFrame(frame.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origFrameX = frame.x;
    const origFrameY = frame.y;
    const zoomAtStart = viewport.zoom;
    const members = nodesInsideFrame(frame, nodes, nodeBounds);
    const memberStarts = members.map((m) => ({ id: m.id, x: m.x, y: m.y }));
    const alignmentTargets = frames;
    let moved = false;

    function onMove(ev) {
      const dx = (ev.clientX - startX) / zoomAtStart;
      const dy = (ev.clientY - startY) / zoomAtStart;
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 3) {
        return;
      }
      moved = true;
      const nextX = origFrameX + dx;
      const nextY = origFrameY + dy;
      const alignment = getDragAlignmentGuides(
        frame,
        nextX,
        nextY,
        alignmentTargets,
        nodeBounds,
        ALIGN_GUIDE_TOLERANCE_PX / zoomAtStart
      );
      const alignedDx = alignment.x - origFrameX;
      const alignedDy = alignment.y - origFrameY;
      setAlignmentGuides({
        vertical: alignment.vertical,
        horizontal: alignment.horizontal,
      });
      setFrames((prev) =>
        prev.map((f) =>
          f.id === frame.id ? { ...f, x: alignment.x, y: alignment.y } : f
        )
      );
      if (memberStarts.length) {
        setNodes((prev) =>
          prev.map((n) => {
            const ms = memberStarts.find((m) => m.id === n.id);
            return ms ? { ...n, x: ms.x + alignedDx, y: ms.y + alignedDy } : n;
          })
        );
      }
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setAlignmentGuides({ vertical: [], horizontal: [] });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleFrameResizeStart(e, handleId, frame) {
    e.stopPropagation();
    e.preventDefault();
    const start = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    const startWorld = screenToWorld(e.clientX, e.clientY);
    const dir = HANDLE_DIRS[handleId];
    const alignmentTargets = frames;

    function onMove(ev) {
      const world = screenToWorld(ev.clientX, ev.clientY);
      const dx = world.x - startWorld.x;
      const dy = world.y - startWorld.y;
      let nextX = start.x;
      let nextY = start.y;
      let nextW = start.w;
      let nextH = start.h;
      if (dir.sx === 1) {
        nextW = Math.max(MIN_FRAME_SIZE, start.w + dx);
      } else if (dir.sx === -1) {
        nextW = Math.max(MIN_FRAME_SIZE, start.w - dx);
        nextX = start.x + (start.w - nextW);
      }
      if (dir.sy === 1) {
        nextH = Math.max(MIN_FRAME_SIZE, start.h + dy);
      } else if (dir.sy === -1) {
        nextH = Math.max(MIN_FRAME_SIZE, start.h - dy);
        nextY = start.y + (start.h - nextH);
      }
      const aligned = getResizeAlignment(
        frame,
        { x: nextX, y: nextY, w: nextW, h: nextH },
        handleId,
        alignmentTargets,
        nodeBounds,
        ALIGN_GUIDE_TOLERANCE_PX / viewport.zoom,
        MIN_FRAME_SIZE
      );
      const finalNext = aligned.next;
      setAlignmentGuides({
        vertical: aligned.vertical,
        horizontal: aligned.horizontal,
      });
      setFrames((prev) =>
        prev.map((f) =>
          f.id === frame.id ? { ...f, ...finalNext } : f
        )
      );
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setAlignmentGuides({ vertical: [], horizontal: [] });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const w = screenToWorld(e.clientX, e.clientY);
    uploadBoardImage(file).then((url) => {
      if (url) addImageNode(url, w.x, w.y);
    });
  }

  /* ---------- node interactions ---------- */

  function handleNodeClick(e, node) {
    e.stopPropagation();
    if (nodeDragMovedRef.current) {
      nodeDragMovedRef.current = false;
      return;
    }
    if (editingId === node.id) return;

    // Backup React-side double-click detection. The document-level mousedown
    // listener (set up further up) is the primary path, but we also catch it
    // here for paths where React's click event does reach the node cleanly.
    const now = Date.now();
    const last = lastNodeClickRef.current;
    if (last.id === node.id && now - last.time < 400) {
      lastNodeClickRef.current = { id: null, time: 0 };
      handleNodeDoubleClick(node.id);
      return;
    }
    lastNodeClickRef.current = { id: node.id, time: now };

    setSelectedEdgeId(null);
    if (tool === 'arrow') {
      connectArrowTo(node.id, 'auto', () => selectNode(node.id));
      return;
    }
    if (tool === 'select') {
      selectNode(node.id);
      if (node.type === 'task') {
        if (expandedTaskNodeId !== node.id) {
          if (expandedTaskNodeId) {
            collapseTaskNode(expandedTaskNodeId);
          }
          expandTaskNode(node.id);
        }
      } else {
        collapseExpandedTaskNode();
      }
    }
  }

  function handleNodeMouseDown(e, node) {
    if (tool !== 'select' || editingId === node.id) return;
    e.stopPropagation();
    nodeDragMovedRef.current = false;
    selectNode(node.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = node.x;
    const origY = node.y;
    const zoomAtStart = viewport.zoom;
    let moved = false;
    function onMove(ev) {
      const dx = (ev.clientX - startX) / zoomAtStart;
      const dy = (ev.clientY - startY) / zoomAtStart;
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 3) {
        return;
      }
      moved = true;
      nodeDragMovedRef.current = true;
      const nextX = origX + dx;
      const nextY = origY + dy;
      const alignment = getDragAlignmentGuides(
        node,
        nextX,
        nextY,
        nodes,
        nodeBounds,
        ALIGN_GUIDE_TOLERANCE_PX / zoomAtStart
      );
      setAlignmentGuides({
        vertical: alignment.vertical,
        horizontal: alignment.horizontal,
      });
      moveNode(node.id, alignment.x, alignment.y);
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setAlignmentGuides({ vertical: [], horizontal: [] });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleNodeDoubleClick(id) {
    const node = nodes.find((n) => n.id === id);
    if (node?.type === 'text') {
      setEditingId(id);
    } else if (node?.type === 'link') {
      // Convert the link back to a plain text node so the user can edit the
      // URL or replace it with anything else. The href becomes the editable
      // content; subsequent commitText will re-detect if it's still a URL.
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                type: 'text',
                content: n.href || n.content || '',
                html: undefined,
                href: undefined,
                w: undefined,
                h: undefined,
              }
            : n
        )
      );
      setEditingId(id);
    }
  }

  /* ---------- toolbar / zoom controls ---------- */

  function openImagePicker() {
    fileInputRef.current?.click();
  }

  function handleImageInputChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const center = screenToWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    uploadBoardImage(file).then((url) => {
      if (url) addImageNode(url, center.x, center.y);
    });
  }

  function removeSelected() {
    if (selectedEdgeId) {
      removeEdge(selectedEdgeId);
    } else if (selectedFrameId) {
      removeFrame(selectedFrameId);
    } else if (selectedId) {
      removeNode(selectedId);
    }
  }

  function toggleDrawingPalette() {
    const nextOpen = !isDrawingPaletteOpen;
    setIsDrawingPaletteOpen(nextOpen);
    if (nextOpen) {
      if (!MARKUP_TOOLS.includes(tool)) {
        selectTool('pen');
      }
    } else if (MARKUP_TOOLS.includes(tool)) {
      selectTool('select');
    }
  }

  /* Anchor zoom-button changes at the viewport center for predictability. */
  function zoomBy(factor) {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cursorX = rect.width / 2;
    const cursorY = rect.height / 2;
    setViewport((prev) => {
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, prev.zoom * factor)
      );
      if (nextZoom === prev.zoom) return prev;
      const worldX = (cursorX - prev.x) / prev.zoom;
      const worldY = (cursorY - prev.y) / prev.zoom;
      return {
        zoom: nextZoom,
        x: cursorX - worldX * nextZoom,
        y: cursorY - worldY * nextZoom,
      };
    });
  }

  function resetView() {
    setViewport(DEFAULT_VIEWPORT);
  }

  return (
    <div className="boardShell">
      <div className="boardLayout">
       <div className="boardToolbarCluster">
        <aside className="boardToolbar" aria-label="Board tools">
          <button
            type="button"
            className={`boardToolBtn ${tool === 'select' ? 'active' : ''}`}
            onClick={() => selectTool('select')}
            title="Select & move"
            aria-label="Select"
          >
            <MousePointer2 size={18} />
          </button>
          <button
            type="button"
            className={`boardToolBtn ${tool === 'text' ? 'active' : ''}`}
            onClick={() => selectTool('text')}
            title="Write text (click anywhere)"
            aria-label="Write text"
          >
            <Type size={18} />
          </button>
          <button
            type="button"
            className={`boardToolBtn ${tool === 'arrow' ? 'active' : ''}`}
            onClick={() => selectTool('arrow')}
            title="Connect with arrows (click two items)"
            aria-label="Arrow"
          >
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            className={`boardToolBtn ${tool === 'frame' ? 'active' : ''}`}
            onClick={() => selectTool('frame')}
            title="Frame - drag a rectangle to group items"
            aria-label="Frame"
          >
            <FrameIcon size={18} />
          </button>
          <button
            type="button"
            className={`boardToolBtn ${isDrawingPaletteOpen || MARKUP_TOOLS.includes(tool) ? 'active' : ''}`}
            onClick={toggleDrawingPalette}
            title="Drawing tools"
            aria-label="Drawing tools"
          >
            <BrushIcon size={18} />
          </button>

          <button
            type="button"
            className="boardToolBtn"
            onClick={openImagePicker}
            title="Import image"
            aria-label="Import image"
          >
            <ImageIcon size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleImageInputChange}
          />

          <button
            type="button"
            className={`boardToolBtn ${isTaskImportOpen ? 'active' : ''}`}
            onClick={() => {
              setIsTaskImportOpen((open) => !open);
              selectTool('select');
            }}
            title="Import task"
            aria-label="Import task"
          >
            <ListTodo size={18} />
          </button>

          <button
            type="button"
            className="boardToolBtn danger"
            onClick={removeSelected}
            disabled={!selectedId && !selectedEdgeId && !selectedFrameId}
            title="Delete selected (Del)"
            aria-label="Delete selected"
          >
            <Trash2 size={18} />
          </button>
        </aside>

        {isDrawingPaletteOpen ? (
          <div className="boardDrawingPalette" aria-label="Drawing actions">
            <button
              type="button"
              className={`boardToolBtn ${tool === 'pen' ? 'active' : ''}`}
              onClick={() => {
                setIsDrawingPaletteOpen(true);
                selectTool('pen');
              }}
              title="Pen - clean line"
              aria-label="Pen"
            >
              <PenIcon size={18} />
            </button>
            <button
              type="button"
              className={`boardToolBtn ${tool === 'pencil' ? 'active' : ''}`}
              onClick={() => {
                setIsDrawingPaletteOpen(true);
                selectTool('pencil');
              }}
              title="Pencil - rough line"
              aria-label="Pencil"
            >
              <PencilIcon size={18} />
            </button>
            <button
              type="button"
              className={`boardToolBtn ${tool === 'brush' ? 'active' : ''}`}
              onClick={() => {
                setIsDrawingPaletteOpen(true);
                selectTool('brush');
              }}
              title="Brush - speed-varying width"
              aria-label="Brush"
            >
              <BrushIcon size={18} />
            </button>
            <button
              type="button"
              className={`boardToolBtn ${tool === ERASER_TOOL ? 'active' : ''}`}
              onClick={() => {
                setIsDrawingPaletteOpen(true);
                selectTool(ERASER_TOOL);
              }}
              title="Eraser"
              aria-label="Eraser"
            >
              <Eraser size={18} />
            </button>
          </div>
        ) : null}

        {isTaskImportOpen ? (
          <TaskImportPanel
            tasks={filteredImportTasks}
            taskTypeById={taskTypeById}
            query={taskImportQuery}
            onQueryChange={setTaskImportQuery}
            onImport={addTaskNode}
            onRefresh={loadTaskData}
            loading={tasksLoading}
            error={tasksError}
          />
        ) : null}

        {(() => {
          if (!selectedEdgeId || editingId || editingFrameId) return null;
          const edge = edges.find((item) => item.id === selectedEdgeId);
          if (!edge) return null;
          const strokeWidth = edge.strokeWidth || DEFAULT_ARROW_STROKE_WIDTH;
          return (
            <div className="boardToolbarPopout" aria-label="Arrow style">
              <ArrowRight size={16} />
              <input
                type="number"
                className="boardPopoutSize"
                min={1}
                max={12}
                step={0.5}
                value={strokeWidth}
                onChange={(e) => setEdgeStrokeWidth(edge.id, e.target.value)}
                aria-label="Arrow thickness"
              />
            </div>
          );
        })()}

        {DRAWING_TOOLS.includes(tool) && !editingId && !editingFrameId ? (
          <div className="boardToolbarPopout" aria-label={`${tool} settings`}>
            {tool === 'pen' ? <PenIcon size={16} /> : tool === 'pencil' ? <PencilIcon size={16} /> : <BrushIcon size={16} />}
            <input
              type="number"
              className="boardPopoutSize"
              min={1}
              max={64}
              step={0.5}
              value={drawingConfig[tool].thickness}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isFinite(v)) return;
                setDrawingConfig((prev) => ({
                  ...prev,
                  [tool]: { ...prev[tool], thickness: Math.max(0.5, Math.min(64, v)) },
                }));
              }}
              aria-label={`${tool} thickness`}
            />
            <span className="boardPopoutDivider" aria-hidden="true" />
            <ColorPicker
              value={drawingConfig[tool].color}
              onChange={(color) =>
                setDrawingConfig((prev) => ({
                  ...prev,
                  [tool]: { ...prev[tool], color },
                }))
              }
              presets={DRAWING_COLOR_PRESETS}
              placeholder={DRAWING_DEFAULTS[tool].color}
            />
          </div>
        ) : null}

        {tool === ERASER_TOOL && !editingId && !editingFrameId ? (
          <div className="boardToolbarPopout" aria-label="Eraser settings">
            <Eraser size={16} />
            <input
              type="number"
              className="boardPopoutSize"
              min={2}
              max={96}
              step={1}
              value={drawingConfig.eraser.thickness}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isFinite(v)) return;
                setDrawingConfig((prev) => ({
                  ...prev,
                  eraser: { ...prev.eraser, thickness: Math.max(2, Math.min(96, v)) },
                }));
              }}
              aria-label="Eraser thickness"
            />
          </div>
        ) : null}

        {(() => {
          /* Frame popout: shows whenever a frame is selected OR being named.
             Houses the frame's color picker so the user can pick a custom
             color, plus a hint to rename via the label. */
          const activeFrameId = editingFrameId || selectedFrameId;
          if (!activeFrameId) return null;
          const frame = frames.find((f) => f.id === activeFrameId);
          if (!frame) return null;
          return (
            <div className="boardToolbarPopout" aria-label="Frame style">
              <input
                className="boardPopoutLabel boardFrameNameInput"
                value={frame.name || ''}
                placeholder="Frame"
                onChange={(e) => setFrameName(frame.id, e.target.value)}
                aria-label="Frame name"
              />
              <span className="boardPopoutDivider" aria-hidden="true" />
              <ColorPicker
                value={frame.color}
                onChange={(c) => setFrameColor(frame.id, c)}
              />
              <div className="boardFrameFillToggle" aria-label="Frame fill">
                <button
                  className={`boardFrameFillBtn ${(frame.fillMode || 'translucent') === 'translucent' ? 'active' : ''}`}
                  onClick={() => setFrameFillMode(frame.id, 'translucent')}
                  type="button"
                  title="Transparent fill"
                  aria-label="Transparent fill"
                >
                  <FrameIcon size={13} />
                </button>
                <button
                  className={`boardFrameFillBtn ${(frame.fillMode || 'translucent') === 'solid' ? 'active' : ''}`}
                  onClick={() => setFrameFillMode(frame.id, 'solid')}
                  type="button"
                  title="Solid fill"
                  aria-label="Solid fill"
                >
                  <Layers size={13} />
                </button>
              </div>
            </div>
          );
        })()}
       </div>

        <div
          ref={wrapperRef}
          className={`boardWrapper boardCursor-${tool}${
            isPanning ? ' isPanning' : ''
          }${arrowSource || arrowPointSource ? ' boardArrowDrawing' : ''}`}
          style={{
            backgroundSize: `${48 * viewport.zoom}px ${48 * viewport.zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }}
          onMouseDown={handleSurfaceMouseDown}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div
            ref={surfaceRef}
            className="boardSurface"
            style={{
              transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            }}
          >
            {/* Frames render behind everything else so they read as a
                grouping container, not a foreground panel. */}
            {frames.map((frame) => {
              const arrowActive = arrowSource?.id === frame.id;
              return (
                <FrameNode
                  key={frame.id}
                  frame={frame}
                  selected={selectedFrameId === frame.id}
                  editing={editingFrameId === frame.id}
                  zoom={viewport.zoom}
                  tool={tool}
                  arrowActive={arrowActive}
                  arrowActiveSide={arrowActive ? arrowSource.side : null}
                  onPickAnchor={(side) => connectArrowTo(frame.id, side, () => selectFrame(frame.id))}
                  onClick={(e) => handleFrameClick(e, frame)}
                  onMouseDown={(e) => handleFrameMouseDown(e, frame)}
                  onLabelDoubleClick={() => handleFrameLabelDoubleClick(frame.id)}
                  onLabelCommit={(name) => handleFrameLabelCommit(frame.id, name)}
                />
              );
            })}

            {/* Draft rectangle while the user drags out a new frame. */}
            {frameDraft && (
              <div
                className="boardFrameDraft"
                style={{
                  left: Math.min(frameDraft.x1, frameDraft.x2),
                  top: Math.min(frameDraft.y1, frameDraft.y2),
                  width: Math.abs(frameDraft.x2 - frameDraft.x1),
                  height: Math.abs(frameDraft.y2 - frameDraft.y1),
                  borderWidth: 2 / viewport.zoom,
                }}
              />
            )}

            <ArrowsLayer
              nodes={nodes}
              frames={frames}
              edges={edges}
              bounds={nodeBounds}
              zoom={viewport.zoom}
              arrowSource={arrowSource}
              arrowPointSource={arrowPointSource}
              mousePos={mousePos}
              selectedEdgeId={selectedEdgeId}
              onSelectEdge={selectEdge}
              onRemoveEdge={removeEdge}
              onEdgeEndpointMouseDown={handleEdgeEndpointMouseDown}
            />
            {(() => {
              const selected = selectedId
                ? nodes.find((n) => n.id === selectedId)
                : null;
              if (!selected) return null;
              return (
                <SelectionFrame
                  node={selected}
                  bounds={nodeBounds}
                  zoom={viewport.zoom}
                  onResizeStart={handleResizeStart}
                  onRotateStart={handleRotateStart}
                />
              );
            })()}

            {(() => {
              if (!editingId) return null;
              const node = nodes.find((item) => item.id === editingId);
              if (!node || node.type !== 'text') return null;
              const size = nodeSize(node, nodeBounds);
              // Prefer the size detected at the caret over the node-level
              // fontSize, so the input reflects whatever the user just
              // moved the caret into.
              const fontSize = Math.round(
                cursorFontSize != null ? cursorFontSize : node.fontSize || 16
              );
              const displayedFontFamily =
                cursorFontFamily || node.fontFamily || textToolbarFont;
              const toolbarScale = 1 / viewport.zoom;
              return (
                <div
                  className="boardTextFloatingToolbar"
                  style={{
                    left: node.x + size.w / 2,
                    top: node.y - 10 / viewport.zoom,
                    transform: `translate(-50%, -100%) scale(${toolbarScale})`,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    // Snapshot the editable's selection BEFORE the click can
                    // shift focus into a dropdown input — apply* helpers
                    // restore this range right before execCommand runs.
                    captureTextSelection();
                    if (!['INPUT', 'SELECT'].includes(e.target.tagName)) {
                      e.preventDefault();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="number"
                    className="boardPopoutSize"
                    min={8}
                    max={120}
                    /* Use defaultValue + key + commit-on-blur/Enter instead
                       of controlled value. Per-keystroke commit would call
                       applyFontSizeToEditingText, which refocuses the
                       contentEditable mid-typing and steals focus from this
                       input. Now the size only applies when the user is
                       finished editing the number. */
                    key={`size-${editingId}-${fontSize}`}
                    defaultValue={fontSize}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v)) {
                        setTextFontSize(editingId, v);
                      } else {
                        // restore previous on invalid input
                        e.target.value = String(fontSize);
                      }
                    }}
                    aria-label="Font size"
                  />
                  <div
                    className="boardTextFontSelectWrap"
                    onMouseDownCapture={loadLocalFontOptions}
                    aria-label="Font family"
                  >
                    <CustomSelect
                      options={fontOptions}
                      value={displayedFontFamily}
                      onChange={(fontFamily) => {
                        setTextToolbarFont(fontFamily);
                        setTextFontFamily(editingId, fontFamily);
                      }}
                      placeholder="Font"
                      searchable
                      searchPlaceholder="Search fonts"
                      listPosition="local"
                    />
                  </div>
                  <button
                    type="button"
                    className="boardTextFormatBtn"
                    onClick={() => toggleInlineCommand('bold')}
                    title="Bold"
                    aria-label="Bold"
                  >
                    <Bold size={15} />
                  </button>
                  <button
                    type="button"
                    className="boardTextFormatBtn"
                    onClick={() => toggleInlineCommand('italic')}
                    title="Italic"
                    aria-label="Italic"
                  >
                    <Italic size={15} />
                  </button>
                  <button
                    type="button"
                    className="boardTextFormatBtn"
                    onClick={() => toggleInlineCommand('underline')}
                    title="Underline"
                    aria-label="Underline"
                  >
                    <Underline size={15} />
                  </button>
                  <button
                    type="button"
                    className="boardTextFormatBtn"
                    onClick={toggleBulletList}
                    title="Bullet list"
                    aria-label="Bullet list"
                  >
                    <List size={15} />
                  </button>
                  <span className="boardPopoutDivider" aria-hidden="true" />
                  {[
                    ['left', AlignLeft],
                    ['center', AlignCenter],
                    ['right', AlignRight],
                  ].map(([align, Icon]) => (
                    <button
                      key={align}
                      type="button"
                      className="boardTextFormatBtn"
                      onClick={() => applyTextAlignment(align)}
                      title={`Align ${align}`}
                      aria-label={`Align ${align}`}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                  <span className="boardPopoutDivider" aria-hidden="true" />
                  <ColorPicker
                    value={node.color || '#ffffff'}
                    onChange={changeTextColor}
                  />
                </div>
              );
            })()}

            {(() => {
              /* Resize handles around a selected frame — same 8 corners/edges
                 as nodes use, minus the rotate arm. */
              if (!selectedFrameId) return null;
              const frame = frames.find((f) => f.id === selectedFrameId);
              if (!frame) return null;
              const handleScale = 1 / viewport.zoom;
              return (
                <div
                  className="boardFrameSelectionFrame"
                  style={{
                    left: frame.x,
                    top: frame.y,
                    width: frame.w,
                    height: frame.h,
                  }}
                >
                  {HANDLE_IDS.map((id) => {
                    const dir = HANDLE_DIRS[id];
                    const left =
                      dir.sx === -1 ? 0 : dir.sx === 0 ? '50%' : '100%';
                    const top =
                      dir.sy === -1 ? 0 : dir.sy === 0 ? '50%' : '100%';
                    return (
                      <div
                        key={id}
                        className={`boardResizeHandle handle-${id}`}
                        style={{
                          left,
                          top,
                          cursor: dir.cursor,
                          transform: `translate(-50%, -50%) scale(${handleScale})`,
                        }}
                        onMouseDown={(e) =>
                          handleFrameResizeStart(e, id, frame)
                        }
                      />
                    );
                  })}
                </div>
              );
            })()}

            {nodes.map((node) => {
              const selected = selectedId === node.id || arrowSourceId === node.id;
              const arrowActive = arrowSource?.id === node.id;
              const commonProps = {
                node,
                selected,
                tool,
                zoom: viewport.zoom,
                arrowActive,
                arrowActiveSide: arrowActive ? arrowSource.side : null,
                onPickAnchor: (side) => connectArrowTo(node.id, side, () => selectNode(node.id)),
                registerRef: registerNodeRef,
                onClick: (e) => handleNodeClick(e, node),
                onMouseDown: (e) => handleNodeMouseDown(e, node),
              };

              if (node.type === 'text') {
                return (
                  <TextNode
                    key={node.id}
                    {...commonProps}
                    editing={editingId === node.id}
                    connected={edges.some((edge) => edge.from === node.id || edge.to === node.id)}
                    onDoubleClick={handleNodeDoubleClick}
                  />
                );
              }

              if (node.type === 'link') {
                return <LinkNode key={node.id} {...commonProps} />;
              }

              if (node.type === 'task') {
                const task = tasks.find((item) => item.id === node.taskId) || null;
                return (
                  <TaskNode
                    key={node.id}
                    {...commonProps}
                    expanded={expandedTaskNodeId === node.id}
                    task={task}
                    tasks={tasks}
                    taskTypes={taskTypes}
                    taskTypeById={taskTypeById}
                    statusColors={statusOptionColors}
                    isSaving={isSavingTask}
                    onCollapse={() => collapseTaskNode(node.id)}
                    onSave={handleUpdateTask}
                    onDelete={(taskId) => setPendingDeleteTaskId(taskId)}
                    onUpdateStatus={handleUpdateTaskStatus}
                    onCreateSubtask={handleCreateSubtask}
                    onDeleteSubtask={handleDeleteTask}
                    onOpenTask={(taskId) => {
                      setNodes((prev) =>
                        prev.map((item) =>
                          item.id === node.id ? { ...item, taskId } : item
                        )
                      );
                    }}
                  />
                );
              }

              if (node.type === 'drawing') {
                return <DrawingNode key={node.id} {...commonProps} />;
              }

              return <ImageNode key={node.id} {...commonProps} />;
            })}

            {/* Live preview of the stroke the user is currently dragging out. */}
            {drawingDraft && drawingDraft.points.length > 0 ? (() => {
              const pts = drawingDraft.points;
              const xs = pts.map((p) => p.x);
              const ys = pts.map((p) => p.y);
              const pad = Math.max(2, drawingDraft.thickness);
              const minX = Math.min(...xs) - pad;
              const minY = Math.min(...ys) - pad;
              const maxX = Math.max(...xs) + pad;
              const maxY = Math.max(...ys) + pad;
              const previewNode = {
                id: 'drawing-draft',
                variant: drawingDraft.variant,
                thickness: drawingDraft.thickness,
                color: drawingDraft.color,
                x: minX,
                y: minY,
                w: maxX - minX,
                h: maxY - minY,
                points: pts.map((p) => ({ x: p.x - minX, y: p.y - minY, t: p.t })),
              };
              return (
                <DrawingNode
                  node={previewNode}
                  selected={false}
                  tool={tool}
                  registerRef={() => {}}
                  onMouseDown={() => {}}
                  onClick={() => {}}
                />
              );
            })() : null}

            {eraserPoint ? (
              <div
                className="boardEraserPreview"
                style={{
                  left: eraserPoint.x - drawingConfig.eraser.thickness / 2,
                  top: eraserPoint.y - drawingConfig.eraser.thickness / 2,
                  width: drawingConfig.eraser.thickness,
                  height: drawingConfig.eraser.thickness,
                  borderWidth: 1 / viewport.zoom,
                }}
              />
            ) : null}

            {alignmentGuides.vertical.map((guide) => (
              <div
                key={`v-${guide.x}-${guide.y1}-${guide.y2}`}
                className={`boardAlignmentGuide boardAlignmentGuideVertical ${guide.kind === 'spacing' ? 'boardAlignmentGuideSpacing' : ''}`}
                style={{
                  left: guide.x,
                  top: guide.y1,
                  height: guide.y2 - guide.y1,
                  width: 1 / viewport.zoom,
                }}
              />
            ))}
            {alignmentGuides.horizontal.map((guide) => (
              <div
                key={`h-${guide.y}-${guide.x1}-${guide.x2}`}
                className={`boardAlignmentGuide boardAlignmentGuideHorizontal ${guide.kind === 'spacing' ? 'boardAlignmentGuideSpacing' : ''}`}
                style={{
                  left: guide.x1,
                  top: guide.y,
                  width: guide.x2 - guide.x1,
                  height: 1 / viewport.zoom,
                }}
              />
            ))}
          </div>

          <div className="boardZoomControls" aria-label="Zoom controls">
            <button
              type="button"
              className="boardZoomBtn"
              onClick={() => zoomBy(BUTTON_ZOOM_STEP)}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={15} />
            </button>
            <button
              type="button"
              className="boardZoomBtn"
              onClick={() => zoomBy(1 / BUTTON_ZOOM_STEP)}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              className="boardZoomBtn"
              onClick={resetView}
              title="Reset view"
              aria-label="Reset view"
            >
              <Maximize size={14} />
            </button>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingDeleteTaskId)}
        title="Delete Task"
        message="This action will remove the task and any nested subtasks. Continue?"
        confirmText="Delete"
        cancelText="Cancel"
        onCancel={() => setPendingDeleteTaskId(null)}
        onConfirm={() => handleDeleteTask(pendingDeleteTaskId)}
      />
    </div>
  );
}

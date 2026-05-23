'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlarmClock,
  Archive,
  Award,
  Banknote,
  Bell,
  Bold,
  Brain,
  Bug,
  Building2,
  Book,
  Bookmark,
  Box,
  Briefcase,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clipboard,
  Cloud,
  Code2,
  Coffee,
  Compass,
  Cpu,
  CreditCard,
  Database,
  Dumbbell,
  Eye,
  Flag,
  Flame,
  FileText,
  Folder,
  FolderPlus,
  Gift,
  Globe,
  GraduationCap,
  Hash,
  Headphones,
  Heart,
  Home,
  Image,
  Inbox,
  Italic,
  KeyRound,
  Landmark,
  Layers,
  Lightbulb,
  Link,
  ListTodo,
  Lock,
  Mail,
  Map,
  MapPin,
  MessageSquare,
  Monitor,
  Moon,
  Music,
  Palette,
  Paperclip,
  PenLine,
  Pencil,
  Phone,
  Pin,
  Plane,
  Play,
  Plus,
  Puzzle,
  Rocket,
  Save,
  Scissors,
  Search,
  Server,
  Settings,
  Shield,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  Terminal,
  Trash2,
  Trophy,
  Underline,
  Undo2,
  User,
  Wallet,
  Wrench,
  Zap,
  Redo2,
} from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';
import CustomSelect from '@/components/ui/CustomSelect';
import { notesApi, mediaApi } from '@/lib/api';
import { useDocumentSync } from '@/lib/sync/useDocumentSync';
import './Notes.css';

const STORAGE_KEY = 'notes.filesystem';
const VIEW_STORAGE_KEY = 'notes.viewState';
const NOTES_DB_NAME = 'sal-notes';
const NOTES_DB_STORE = 'state';
const NOTES_DB_KEY = 'tree';
const NOTES_DB_META_KEY = 'sync-meta';
const NOTES_DB_VERSION = 1;
const NOTES_PERSIST_DEBOUNCE_MS = 250;
const NOTES_SYNC_DEBOUNCE_MS = 900;
const DEFAULT_ICON_COLOR = 'currentColor';
const DEFAULT_PICKER_ICON_COLOR = '#9ca3af';
const DEFAULT_FOLDER_ICON = { kind: 'icon', name: 'folder', color: DEFAULT_ICON_COLOR };
const DEFAULT_FILE_ICON = { kind: 'icon', name: 'fileText', color: DEFAULT_ICON_COLOR };
const LEGACY_DEFAULT_ICON_COLORS = new Set(['#fbbf24', '#93c5fd']);
const ICON_COLOR_PRESETS = [
  '#ffffff',
  '#9ca3af',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#f472b6',
  '#2dd4bf',
  '#fb923c',
  '#c084fc',
  '#94a3b8',
];
const EMOJI_OPTIONS = [
  '📝', '📌', '📎', '📁', '📂', '📄', '📚', '📖', '🔖', '✅', '⭐', '✨',
  '🔥', '💡', '🎯', '🚀', '🧠', '💭', '💬', '🔒', '🔑', '🧾', '📊', '📈',
  '💼', '🏠', '🌱', '🌙', '☀️', '⚡', '🎨', '🎵', '📷', '🗺️', '🧩', '🛠️',
  '💻', '🧪', '📦', '🗃️', '🕒', '📅', '🏷️', '❤️', '💎', '🍀', '🌊', '🏆',
  '🍎', '☕', '🍕', '✈️', '🚗', '🏋️', '🎮', '🎬', '📡', '🌍', '🔮', '🪄',
  '😀', '😄', '🙂', '😎', '🤓', '🤔', '🙌', '👏', '🙏', '💪', '👀', '✍️',
  '💯', '❗', '❓', '➕', '➖', '🔁', '🔔', '🔕', '📣', '📍', '🚩', '🧭',
  '🗂️', '🗒️', '📓', '📔', '📕', '📗', '📘', '📙', '📰', '🧷', '✂️', '🖊️',
  '🖋️', '✏️', '📐', '📏', '🔎', '🧮', '💰', '💳', '🧑‍💻', '🕹️', '🎧', '🎤',
  '🏢', '🏛️', '🏫', '🏥', '🏖️', '⛰️', '🌆', '🌌', '🌈', '❄️', '🌸', '🍄',
  '🥑', '🍓', '🍔', '🍜', '🍱', '🧁', '🚲', '🚆', '🚢', '⌛', '⏳', '⏰',
  '🧘', '🛌', '🩺', '💊', '🔬', '🧬', '🛰️', '🧱', '🧰', '⚙️', '🧲', '🪙',
];
const ICON_OPTIONS = [
  { name: 'activity', label: 'Activity', Icon: Activity },
  { name: 'alarm', label: 'Alarm', Icon: AlarmClock },
  { name: 'folder', label: 'Folder', Icon: Folder },
  { name: 'fileText', label: 'File', Icon: FileText },
  { name: 'book', label: 'Book', Icon: Book },
  { name: 'bookmark', label: 'Bookmark', Icon: Bookmark },
  { name: 'archive', label: 'Archive', Icon: Archive },
  { name: 'award', label: 'Award', Icon: Award },
  { name: 'banknote', label: 'Money', Icon: Banknote },
  { name: 'bell', label: 'Bell', Icon: Bell },
  { name: 'brain', label: 'Brain', Icon: Brain },
  { name: 'bug', label: 'Bug', Icon: Bug },
  { name: 'building', label: 'Building', Icon: Building2 },
  { name: 'inbox', label: 'Inbox', Icon: Inbox },
  { name: 'briefcase', label: 'Work', Icon: Briefcase },
  { name: 'home', label: 'Home', Icon: Home },
  { name: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { name: 'camera', label: 'Camera', Icon: Camera },
  { name: 'checkCircle', label: 'Done', Icon: CheckCircle2 },
  { name: 'clipboard', label: 'Clipboard', Icon: Clipboard },
  { name: 'cloud', label: 'Cloud', Icon: Cloud },
  { name: 'todo', label: 'Todo', Icon: ListTodo },
  { name: 'star', label: 'Star', Icon: Star },
  { name: 'heart', label: 'Heart', Icon: Heart },
  { name: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { name: 'flame', label: 'Flame', Icon: Flame },
  { name: 'zap', label: 'Energy', Icon: Zap },
  { name: 'lightbulb', label: 'Idea', Icon: Lightbulb },
  { name: 'rocket', label: 'Rocket', Icon: Rocket },
  { name: 'palette', label: 'Palette', Icon: Palette },
  { name: 'image', label: 'Image', Icon: Image },
  { name: 'music', label: 'Music', Icon: Music },
  { name: 'coffee', label: 'Coffee', Icon: Coffee },
  { name: 'compass', label: 'Compass', Icon: Compass },
  { name: 'cpu', label: 'CPU', Icon: Cpu },
  { name: 'creditCard', label: 'Card', Icon: CreditCard },
  { name: 'dumbbell', label: 'Fitness', Icon: Dumbbell },
  { name: 'eye', label: 'Eye', Icon: Eye },
  { name: 'flag', label: 'Flag', Icon: Flag },
  { name: 'gift', label: 'Gift', Icon: Gift },
  { name: 'globe', label: 'Globe', Icon: Globe },
  { name: 'graduation', label: 'Study', Icon: GraduationCap },
  { name: 'headphones', label: 'Audio', Icon: Headphones },
  { name: 'message', label: 'Message', Icon: MessageSquare },
  { name: 'mail', label: 'Mail', Icon: Mail },
  { name: 'tag', label: 'Tag', Icon: Tag },
  { name: 'hash', label: 'Hash', Icon: Hash },
  { name: 'link', label: 'Link', Icon: Link },
  { name: 'paperclip', label: 'Attach', Icon: Paperclip },
  { name: 'lock', label: 'Lock', Icon: Lock },
  { name: 'key', label: 'Key', Icon: KeyRound },
  { name: 'shield', label: 'Shield', Icon: Shield },
  { name: 'user', label: 'Person', Icon: User },
  { name: 'wallet', label: 'Wallet', Icon: Wallet },
  { name: 'landmark', label: 'Landmark', Icon: Landmark },
  { name: 'layers', label: 'Layers', Icon: Layers },
  { name: 'map', label: 'Map', Icon: Map },
  { name: 'mapPin', label: 'Place', Icon: MapPin },
  { name: 'monitor', label: 'Monitor', Icon: Monitor },
  { name: 'moon', label: 'Moon', Icon: Moon },
  { name: 'penLine', label: 'Pen', Icon: PenLine },
  { name: 'phone', label: 'Phone', Icon: Phone },
  { name: 'pin', label: 'Pin', Icon: Pin },
  { name: 'plane', label: 'Plane', Icon: Plane },
  { name: 'play', label: 'Play', Icon: Play },
  { name: 'puzzle', label: 'Puzzle', Icon: Puzzle },
  { name: 'save', label: 'Save', Icon: Save },
  { name: 'scissors', label: 'Scissors', Icon: Scissors },
  { name: 'server', label: 'Server', Icon: Server },
  { name: 'shopping', label: 'Shopping', Icon: ShoppingBag },
  { name: 'smile', label: 'Smile', Icon: Smile },
  { name: 'sun', label: 'Sun', Icon: Sun },
  { name: 'target', label: 'Target', Icon: Target },
  { name: 'terminal', label: 'Terminal', Icon: Terminal },
  { name: 'code', label: 'Code', Icon: Code2 },
  { name: 'database', label: 'Database', Icon: Database },
  { name: 'box', label: 'Box', Icon: Box },
  { name: 'settings', label: 'Settings', Icon: Settings },
  { name: 'trophy', label: 'Trophy', Icon: Trophy },
  { name: 'wrench', label: 'Wrench', Icon: Wrench },
  { name: 'circle', label: 'Circle', Icon: Circle },
];
const ICON_COMPONENTS = ICON_OPTIONS.reduce((acc, option) => {
  acc[option.name] = option.Icon;
  return acc;
}, {});
const NOTE_TEXT_COLOR_PRESETS = [
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
const NOTE_FONT_SIZE_OPTIONS = ['12', '14', '15', '16', '18', '20', '24', '28', '32'];
const NOTE_FONT_SIZE_SELECT_OPTIONS = NOTE_FONT_SIZE_OPTIONS.map((size) => ({
  label: size,
  value: size,
}));
const NOTES_EDITOR_WIDTH_STORAGE_KEY = 'notes.editorWidth';
const NOTES_EDITOR_WIDTH_MIN = 520;
/* Persistence ceiling only — the runtime max comes from the editor
   container's measured width so the ruler adapts to the screen. */
const NOTES_EDITOR_WIDTH_MAX = 6000;
const NOTES_EDITOR_WIDTH_DEFAULT = 820;
const NOTE_FONT_OPTIONS = [
  { label: 'System', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Inter', value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet', value: '"Trebuchet MS", sans-serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
  { label: 'Menlo', value: 'Menlo, Monaco, Consolas, monospace' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
];

function normalizeFontFamilyFirst(value) {
  return String(value || '')
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getEditorHtml(content) {
  const value = String(content || '');
  if (!value) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return value;
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function loadEditorWidth() {
  if (typeof window === 'undefined') return NOTES_EDITOR_WIDTH_DEFAULT;
  const stored = Number.parseInt(window.localStorage.getItem(NOTES_EDITOR_WIDTH_STORAGE_KEY), 10);
  if (!Number.isFinite(stored)) return NOTES_EDITOR_WIDTH_DEFAULT;
  return Math.max(NOTES_EDITOR_WIDTH_MIN, Math.min(NOTES_EDITOR_WIDTH_MAX, stored));
}

function saveEditorWidth(value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NOTES_EDITOR_WIDTH_STORAGE_KEY, String(value));
  } catch {}
}

function formatModifiedDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Last modified unknown';
  return `Last modified ${date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function createId(prefix = 'note') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFile(name = 'Untitled note') {
  const now = new Date().toISOString();
  return {
    id: createId('file'),
    type: 'file',
    name,
    icon: DEFAULT_FILE_ICON,
    content: '',
    createdAt: now,
    updatedAt: now,
  };
}

function createFolder(name = 'New folder') {
  const now = new Date().toISOString();
  return {
    id: createId('folder'),
    type: 'folder',
    name,
    icon: DEFAULT_FOLDER_ICON,
    children: [],
    createdAt: now,
    updatedAt: now,
  };
}

const DEFAULT_TREE = [
  {
    id: 'notes-root-folder',
    type: 'folder',
    name: 'Personal',
    icon: DEFAULT_FOLDER_ICON,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    children: [
      {
        id: 'notes-welcome-file',
        type: 'file',
        name: 'Welcome',
        icon: { kind: 'emoji', value: '📝', color: DEFAULT_ICON_COLOR },
        content: 'A quiet place for quick notes.',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
  },
];

function normalizeTree(value) {
  if (!Array.isArray(value)) return DEFAULT_TREE;

  const normalizeIcon = (icon, type) => {
    const fallback = type === 'folder' ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON;
    if (!icon || typeof icon !== 'object') return fallback;

    if (icon.kind === 'emoji' && typeof icon.value === 'string') {
      return {
        kind: 'emoji',
        value: icon.value,
        color: typeof icon.color === 'string' ? icon.color : DEFAULT_ICON_COLOR,
      };
    }

    if (icon.kind === 'icon' && ICON_COMPONENTS[icon.name]) {
      const isLegacyDefault =
        (type === 'folder' && icon.name === DEFAULT_FOLDER_ICON.name && LEGACY_DEFAULT_ICON_COLORS.has(icon.color)) ||
        (type === 'file' && icon.name === DEFAULT_FILE_ICON.name && LEGACY_DEFAULT_ICON_COLORS.has(icon.color));

      return {
        kind: 'icon',
        name: icon.name,
        color: isLegacyDefault
          ? DEFAULT_ICON_COLOR
          : typeof icon.color === 'string'
            ? icon.color
            : fallback.color,
      };
    }

    return fallback;
  };

  const normalizeNode = (node) => {
    if (!node || typeof node !== 'object' || !node.id || !node.name) return null;

    if (node.type === 'folder') {
      return {
        id: node.id,
        type: 'folder',
        name: String(node.name),
        icon: normalizeIcon(node.icon, 'folder'),
        createdAt: node.createdAt || node.updatedAt || new Date().toISOString(),
        updatedAt: node.updatedAt || new Date().toISOString(),
        children: Array.isArray(node.children)
          ? node.children.map(normalizeNode).filter(Boolean)
          : [],
      };
    }

    if (node.type === 'file') {
      return {
        id: node.id,
        type: 'file',
        name: String(node.name),
        icon: normalizeIcon(node.icon, 'file'),
        content: typeof node.content === 'string' ? node.content : '',
        createdAt: node.createdAt || node.updatedAt || new Date().toISOString(),
        updatedAt: node.updatedAt || new Date().toISOString(),
      };
    }

    return null;
  };

  const normalized = value.map(normalizeNode).filter(Boolean);
  return normalized.length ? normalized : DEFAULT_TREE;
}

function loadTree() {
  if (typeof window === 'undefined') return DEFAULT_TREE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TREE;
    return normalizeTree(JSON.parse(raw));
  } catch {
    return DEFAULT_TREE;
  }
}

function loadNotesViewState() {
  if (typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(VIEW_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      selectedFileId:
        typeof parsed.selectedFileId === 'string'
          ? parsed.selectedFileId
          : typeof parsed.selectedId === 'string'
            ? parsed.selectedId
            : null,
      openFolderIds: Array.isArray(parsed.openFolderIds)
        ? parsed.openFolderIds.filter((id) => typeof id === 'string')
        : null,
    };
  } catch {
    return null;
  }
}

function saveNotesViewState({ selectedFileId, openFolders }) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      VIEW_STORAGE_KEY,
      JSON.stringify({
        selectedFileId: selectedFileId || null,
        openFolderIds: Array.from(openFolders || []),
      })
    );
  } catch {}
}

function openNotesDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    let req;
    try {
      req = window.indexedDB.open(NOTES_DB_NAME, NOTES_DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(NOTES_DB_STORE)) {
        db.createObjectStore(NOTES_DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

async function idbGetNotesTree() {
  const db = await openNotesDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(NOTES_DB_STORE, 'readonly');
      const req = tx.objectStore(NOTES_DB_STORE).get(NOTES_DB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbPutNotesTree(tree) {
  const db = await openNotesDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(NOTES_DB_STORE, 'readwrite');
      tx.objectStore(NOTES_DB_STORE).put(tree, NOTES_DB_KEY);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbGetNotesSyncMeta() {
  try {
    const db = await openNotesDB();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(NOTES_DB_STORE, 'readonly');
        const req = tx.objectStore(NOTES_DB_STORE).get(NOTES_DB_META_KEY);
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

async function idbPutNotesSyncMeta(meta) {
  try {
    const db = await openNotesDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(NOTES_DB_STORE, 'readwrite');
        tx.objectStore(NOTES_DB_STORE).put(meta, NOTES_DB_META_KEY);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* meta is non-critical; sync hook keeps its own in-memory mirror */
  }
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'folder') {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }

  return null;
}

function findFirstFile(nodes) {
  for (const node of nodes) {
    if (node.type === 'file') return node;
    if (node.type === 'folder') {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }

  return null;
}

function isFolderId(nodes, id) {
  return findNode(nodes, id)?.type === 'folder';
}

function findParentId(nodes, id, parentId = null) {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    if (node.type === 'folder') {
      const found = findParentId(node.children, id, node.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function getTargetFolderId(nodes, selectedId) {
  const selected = findNode(nodes, selectedId);
  if (!selected) return null;
  if (selected.type === 'folder') return selected.id;
  // File selected: create siblings next to it inside its parent folder.
  const parent = findParentId(nodes, selectedId);
  return parent ?? null;
}

function removeNodeReturn(nodes, id) {
  let removed = null;
  function strip(items) {
    const out = [];
    for (const node of items) {
      if (node.id === id) {
        removed = node;
        continue;
      }
      if (node.type === 'folder') {
        out.push({ ...node, children: strip(node.children) });
      } else {
        out.push(node);
      }
    }
    return out;
  }
  const next = strip(nodes);
  return { tree: next, removed };
}

function isDescendant(nodes, ancestorId, descendantId) {
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor || ancestor.type !== 'folder') return false;
  return !!findNode(ancestor.children, descendantId);
}

function moveNode(nodes, draggedId, targetFolderId) {
  if (!draggedId) return nodes;
  if (draggedId === targetFolderId) return nodes;
  if (targetFolderId && isDescendant(nodes, draggedId, targetFolderId)) return nodes;
  const currentParent = findParentId(nodes, draggedId);
  if (currentParent === undefined) return nodes;
  if ((currentParent ?? null) === (targetFolderId ?? null)) return nodes;
  const { tree: stripped, removed } = removeNodeReturn(nodes, draggedId);
  if (!removed) return nodes;
  return addChild(stripped, targetFolderId, {
    ...removed,
    updatedAt: new Date().toISOString(),
  });
}

function updateNode(nodes, id, updater) {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.type !== 'folder') return node;

    return {
      ...node,
      children: updateNode(node.children, id, updater),
    };
  });
}

function addChild(nodes, folderId, child) {
  if (!folderId) return [...nodes, child];

  return updateNode(nodes, folderId, (node) => {
    if (node.type !== 'folder') return node;
    return {
      ...node,
      updatedAt: new Date().toISOString(),
      children: [...node.children, child],
    };
  });
}

function deleteNode(nodes, id) {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => {
      if (node.type !== 'folder') return node;
      return {
        ...node,
        children: deleteNode(node.children, id),
      };
    });
}

function collectOpenFolders(nodes, ids = new Set()) {
  nodes.forEach((node) => {
    if (node.type !== 'folder') return;
    ids.add(node.id);
    collectOpenFolders(node.children, ids);
  });
  return ids;
}

function restoreNotesViewState(nodes) {
  const viewState = loadNotesViewState();
  const selectedNode = viewState?.selectedFileId
    ? findNode(nodes, viewState.selectedFileId)
    : null;

  return {
    selectedId: selectedNode?.type === 'file'
      ? selectedNode.id
      : findFirstFile(nodes)?.id || null,
    openFolders: viewState?.openFolderIds
      ? new Set(viewState.openFolderIds.filter((id) => isFolderId(nodes, id)))
      : collectOpenFolders(nodes),
  };
}

function filterTree(nodes, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return nodes;

  return nodes.reduce((matches, node) => {
    const nameMatches = node.name.toLowerCase().includes(trimmed);
    if (node.type === 'file') {
      if (nameMatches || node.content.toLowerCase().includes(trimmed)) matches.push(node);
      return matches;
    }

    const childMatches = filterTree(node.children, query);
    if (nameMatches || childMatches.length > 0) {
      matches.push({ ...node, children: childMatches });
    }
    return matches;
  }, []);
}

function getCreatedTime(node) {
  const value = Date.parse(node.createdAt || node.updatedAt || 0);
  return Number.isNaN(value) ? 0 : value;
}

/* Creation-date ordering at every level. Folders still come before files at
   the same depth so containers don't get lost between leaf items. */
function sortTree(nodes) {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return getCreatedTime(b) - getCreatedTime(a);
  });
  return sorted.map((node) =>
    node.type === 'folder' ? { ...node, children: sortTree(node.children) } : node
  );
}

function countTree(nodes) {
  return nodes.reduce(
    (counts, node) => {
      if (node.type === 'file') {
        counts.files += 1;
        return counts;
      }

      counts.folders += 1;
      const childCounts = countTree(node.children);
      counts.files += childCounts.files;
      counts.folders += childCounts.folders;
      return counts;
    },
    { files: 0, folders: 0 }
  );
}

function isLikelyFallbackTree(nodes) {
  const counts = countTree(nodes);
  if (counts.files > 1 || counts.folders > 1) return false;
  const firstFolder = nodes[0];
  if (firstFolder?.id !== 'notes-root-folder') return false;
  const firstFile = firstFolder?.children?.[0];
  return firstFile?.id === 'notes-welcome-file'
    || firstFile?.content === 'A quiet place for quick notes.';
}

function isRicherTree(candidate, baseline) {
  const candidateCounts = countTree(candidate);
  const baselineCounts = countTree(baseline);
  return candidateCounts.files > baselineCounts.files
    || candidateCounts.folders > baselineCounts.folders;
}

function NodeIcon({ node }) {
  const icon = node.icon || (node.type === 'folder' ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON);

  if (icon.kind === 'emoji') {
    return (
      <span className="notesNodeEmoji" aria-hidden="true">
        {icon.value}
      </span>
    );
  }

  const Icon = ICON_COMPONENTS[icon.name] || (node.type === 'folder' ? Folder : FileText);
  return <Icon size={15} strokeWidth={1.5} color={icon.color || DEFAULT_ICON_COLOR} />;
}

function getPopoverStyle(anchorRect) {
  if (!anchorRect || typeof window === 'undefined') return undefined;

  const width = 300;
  const maxHeight = 340;
  const gap = 8;
  const pad = 10;
  let left = anchorRect.left;
  let top = anchorRect.bottom + gap;

  if (left + width > window.innerWidth - pad) {
    left = window.innerWidth - width - pad;
  }
  if (left < pad) left = pad;

  if (top + maxHeight > window.innerHeight - pad) {
    top = anchorRect.top - maxHeight - gap;
  }
  if (top < pad) top = pad;

  return { left, top, width, maxHeight };
}

function IconPickerPopover({ node, anchorRect, onClose, onPick }) {
  const [activeTab, setActiveTab] = useState('emojis');
  const [iconColor, setIconColor] = useState(
    node?.icon?.kind === 'icon' && node.icon.color !== DEFAULT_ICON_COLOR
      ? node.icon.color
      : DEFAULT_PICKER_ICON_COLOR
  );
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!node) return undefined;

    function handlePointerDown(event) {
      if (popoverRef.current?.contains(event.target)) return;
      onClose();
    }

    function handleScroll(event) {
      if (popoverRef.current?.contains(event.target)) return;
      onClose();
    }

    function handleResize() {
      onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [node, onClose]);

  if (!node) return null;

  const selectedIconName = node.icon?.kind === 'icon' ? node.icon.name : null;
  const selectedEmoji = node.icon?.kind === 'emoji' ? node.icon.value : null;
  const popoverStyle = getPopoverStyle(anchorRect);

  return (
    <div
      ref={popoverRef}
      className="notesIconPopover"
      role="dialog"
      aria-label={`Choose icon for ${node.name}`}
      style={popoverStyle}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="notesIconPopoverHead">
        <div>
          <h3>Icon</h3>
          <p>{node.name}</p>
        </div>
        <button type="button" className="notesIconPopoverClose" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="notesPickerTabs" role="tablist" aria-label="Icon type">
        <button
          type="button"
          className={`notesPickerTab ${activeTab === 'emojis' ? 'active' : ''}`}
          onClick={() => setActiveTab('emojis')}
        >
          Emojis
        </button>
        <button
          type="button"
          className={`notesPickerTab ${activeTab === 'icons' ? 'active' : ''}`}
          onClick={() => setActiveTab('icons')}
        >
          Icons
        </button>
      </div>

      {activeTab === 'icons' ? (
        <div className="notesIconColorPanel">
          <span>Color</span>
          <div className="notesIconColorPicker">
            <ColorPicker
              value={iconColor}
              onChange={(color) => setIconColor(color)}
              presets={ICON_COLOR_PRESETS}
              placeholder={DEFAULT_PICKER_ICON_COLOR}
            />
          </div>
        </div>
      ) : null}

      <div className="notesPickerGrid">
        {activeTab === 'emojis'
          ? EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`notesPickerCell emoji ${selectedEmoji === emoji ? 'active' : ''}`}
                onClick={() => onPick({ kind: 'emoji', value: emoji, color: DEFAULT_ICON_COLOR })}
              >
                {emoji}
              </button>
            ))
          : ICON_OPTIONS.map(({ name, label, Icon }) => (
              <button
                key={name}
                type="button"
                className={`notesPickerCell ${selectedIconName === name ? 'active' : ''}`}
                title={label}
                onClick={() => onPick({ kind: 'icon', name, color: iconColor })}
              >
                <Icon size={16} strokeWidth={1.5} color={iconColor} />
              </button>
            ))}
      </div>
    </div>
  );
}

function DeleteConfirmDialog({ node, onCancel, onConfirm }) {
  if (!node) return null;

  const isFolder = node.type === 'folder';

  return (
    <div className="notesConfirmOverlay" role="presentation" onMouseDown={onCancel}>
      <div
        className="notesConfirmDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${node.name}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="notesConfirmIcon">
          <Trash2 size={18} strokeWidth={1.5} />
        </div>
        <div className="notesConfirmBody">
          <h3>Delete {isFolder ? 'folder' : 'file'}</h3>
          <p>
            <span>{node.name}</span>
            {isFolder ? ' and everything inside it will be removed.' : ' will be removed.'}
          </p>
        </div>
        <div className="notesConfirmActions">
          <button type="button" className="notesConfirmBtn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="notesConfirmBtn danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RichTextEditor({ file, onChange, onUploadImage }) {
  const editorRef = useRef(null);
  const editorRootRef = useRef(null);
  const selectionRef = useRef(null);
  const writingWidthRef = useRef(null);
  const rulerDragRef = useRef(null);
  const rulerAnimationRef = useRef(null);
  const [initialHtml] = useState(() => getEditorHtml(file.content));
  const historyRef = useRef({
    past: [],
    future: [],
    current: initialHtml,
  });
  const [textColor, setTextColor] = useState('#ffffff');
  const [activeColor, setActiveColor] = useState('#ffffff');
  const [colorTarget, setColorTarget] = useState('text');
  const [frameStyle, setFrameStyle] = useState('outline');
  const [fontFamily, setFontFamily] = useState(NOTE_FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState('15');
  const [writingWidth, setWritingWidth] = useState(loadEditorWidth);
  /* Runtime ceiling driven by the editor's measured width — lets the ruler
     expand on wide screens and shrink with the window instead of being
     pinned at a hardcoded 1520 px. */
  const [dynamicMax, setDynamicMax] = useState(NOTES_EDITOR_WIDTH_MAX);
  const modifiedLabel = formatModifiedDate(file.updatedAt);
  const rulerSpanPercent = Math.max(
    0,
    Math.min(100, (writingWidth / Math.max(dynamicMax, NOTES_EDITOR_WIDTH_MIN)) * 100)
  );

  useEffect(() => {
    writingWidthRef.current = writingWidth;
  }, [writingWidth]);

  useEffect(() => {
    const el = editorRootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setDynamicMax(Math.max(NOTES_EDITOR_WIDTH_MIN, Math.round(w)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* When the available width shrinks (e.g., window resized smaller) clamp
     the user's saved writingWidth so the page indicator doesn't overflow. */
  useEffect(() => {
    if (writingWidth > dynamicMax) {
      const next = Math.max(NOTES_EDITOR_WIDTH_MIN, dynamicMax);
      setWritingWidth(next);
      writingWidthRef.current = next;
    }
  }, [dynamicMax, writingWidth]);

  const normalizeWritingWidth = useCallback((value) => (
    Math.max(
      NOTES_EDITOR_WIDTH_MIN,
      Math.min(dynamicMax, Number.parseInt(value, 10) || NOTES_EDITOR_WIDTH_DEFAULT)
    )
  ), [dynamicMax]);

  const changeWritingWidth = useCallback((value, { persist = true } = {}) => {
    const next = normalizeWritingWidth(value);
    setWritingWidth(next);
    writingWidthRef.current = next;
    if (persist) saveEditorWidth(next);
  }, [normalizeWritingWidth]);

  const handleRulerPointerDown = useCallback((event, side) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = writingWidthRef.current || NOTES_EDITOR_WIDTH_DEFAULT;
    rulerDragRef.current = { startX, startWidth, side };

    function handlePointerMove(moveEvent) {
      const drag = rulerDragRef.current;
      if (!drag) return;
      const delta = moveEvent.clientX - drag.startX;
      const direction = drag.side === 'left' ? -1 : 1;
      const nextWidth = Math.round((drag.startWidth + delta * direction * 2) / 10) * 10;

      if (rulerAnimationRef.current) {
        cancelAnimationFrame(rulerAnimationRef.current);
      }

      rulerAnimationRef.current = requestAnimationFrame(() => {
        rulerAnimationRef.current = null;
        changeWritingWidth(nextWidth, { persist: false });
      });
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      rulerDragRef.current = null;
      if (rulerAnimationRef.current) {
        cancelAnimationFrame(rulerAnimationRef.current);
        rulerAnimationRef.current = null;
      }
      saveEditorWidth(writingWidthRef.current || NOTES_EDITOR_WIDTH_DEFAULT);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [changeWritingWidth]);

  const pushHistory = useCallback((before, after) => {
    if (after === before) return;
    historyRef.current.past.push(before);
    if (historyRef.current.past.length > 100) historyRef.current.past.shift();
    historyRef.current.future = [];
    historyRef.current.current = after;
    onChange(after);
  }, [onChange]);

  const setEditorNode = useCallback((node) => {
    editorRef.current = node;
    if (!node) return;
    node.innerHTML = initialHtml;
    historyRef.current = {
      past: [],
      future: [],
      current: initialHtml,
    };
  }, [initialHtml]);

  const saveSelection = useCallback(() => {
    if (typeof window === 'undefined') return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const editor = editorRef.current;
    if (!editor) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    selectionRef.current = range.cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const range = selectionRef.current;
    if (!range || typeof window === 'undefined') return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const detectCurrentStyle = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (!node || !editor.contains(node)) return;

    const computed = window.getComputedStyle(node);

    const sizePx = Math.round(parseFloat(computed.fontSize));
    if (Number.isFinite(sizePx)) {
      const sizeStr = String(sizePx);
      if (NOTE_FONT_SIZE_OPTIONS.includes(sizeStr)) {
        setFontSize((prev) => (prev === sizeStr ? prev : sizeStr));
      }
    }

    const computedFirst = normalizeFontFamilyFirst(computed.fontFamily);
    const matched = NOTE_FONT_OPTIONS.find(
      (opt) => normalizeFontFamilyFirst(opt.value) === computedFirst
    );
    if (matched) {
      setFontFamily((prev) => (prev === matched.value ? prev : matched.value));
    }
  }, []);

  const handleSelectionUpdate = useCallback(() => {
    saveSelection();
    detectCurrentStyle();
  }, [saveSelection, detectCurrentStyle]);

  const setEditorHtml = useCallback((html) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = html;
    historyRef.current.current = html;
    onChange(html);
  }, [onChange]);

  const recordChange = useCallback((nextHtml) => {
    const history = historyRef.current;
    if (nextHtml === history.current) return;
    pushHistory(history.current, nextHtml);
  }, [pushHistory]);

  const syncContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    recordChange(editor.innerHTML);
  }, [recordChange]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    if (history.past.length === 0) return;

    const previous = history.past.pop();
    const editor = editorRef.current;
    const current = editor?.innerHTML ?? history.current;
    history.future.push(current);
    setEditorHtml(previous);
  }, [setEditorHtml]);

  const redo = useCallback(() => {
    const history = historyRef.current;
    if (history.future.length === 0) return;

    const next = history.future.pop();
    const editor = editorRef.current;
    const current = editor?.innerHTML ?? history.current;
    history.past.push(current);
    setEditorHtml(next);
  }, [setEditorHtml]);

  const runCommand = useCallback((command, value = null) => {
    const editor = editorRef.current;
    if (!editor || typeof document === 'undefined') return;
    editor.focus();
    restoreSelection();
    const before = editor.innerHTML;
    document.execCommand(command, false, value);
    const after = editor.innerHTML;
    pushHistory(before, after);
    saveSelection();
  }, [pushHistory, restoreSelection, saveSelection]);

  /* Async image insertion: we save the cursor position synchronously (so the
     insert lands where the user actually pasted), do the upload, then insert
     <img src=URL> at that range. If the editor is gone by then (e.g. user
     switched notes), we drop the result silently. */
  const insertImageFromUpload = useCallback(async (file) => {
    if (!onUploadImage || !file) return;
    const editor = editorRef.current;
    if (!editor) return;
    saveSelection();
    const savedRange = selectionRef.current ? selectionRef.current.cloneRange() : null;
    try {
      const url = await onUploadImage(file);
      if (!url) return;
      const currentEditor = editorRef.current;
      if (!currentEditor) return;
      currentEditor.focus();
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      if (sel && savedRange && currentEditor.contains(savedRange.commonAncestorContainer)) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
      const before = currentEditor.innerHTML;
      const safeUrl = String(url).replace(/"/g, '&quot;');
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${safeUrl}" alt="" style="max-width:100%;height:auto;" />`
      );
      const after = currentEditor.innerHTML;
      pushHistory(before, after);
      saveSelection();
    } catch (err) {
      console.warn('Notes: image upload failed', err);
    }
  }, [onUploadImage, pushHistory, saveSelection]);

  const handlePaste = useCallback((event) => {
    if (!onUploadImage) return;
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    insertImageFromUpload(file);
  }, [insertImageFromUpload, onUploadImage]);

  const handleDrop = useCallback((event) => {
    if (!onUploadImage) return;
    const file = Array.from(event.dataTransfer?.files || []).find((f) =>
      f.type.startsWith('image/')
    );
    if (!file) return;
    event.preventDefault();
    /* Move the caret to the drop point before insertion so the image lands
       where the user dropped, not where the cursor was. */
    if (typeof document !== 'undefined' && document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(event.clientX, event.clientY);
      if (range && editorRef.current?.contains(range.commonAncestorContainer)) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        saveSelection();
      }
    }
    insertImageFromUpload(file);
  }, [insertImageFromUpload, onUploadImage, saveSelection]);

  const findSelectedFrame = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined') return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;

    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE && node.dataset?.notesFrame === 'true') {
        return node;
      }
      node = node.parentElement;
    }

    return null;
  }, []);

  const getCurrentRange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined') return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range;
  }, []);

  const getFramesInSelection = useCallback(() => {
    const editor = editorRef.current;
    const range = getCurrentRange();
    if (!editor || !range) return [];

    const closest = findSelectedFrame();
    const intersecting = Array.from(editor.querySelectorAll('[data-notes-frame="true"]'))
      .filter((frame) => {
        try {
          return range.intersectsNode(frame);
        } catch {
          return false;
        }
      });

    return closest && !intersecting.includes(closest)
      ? [closest, ...intersecting]
      : intersecting;
  }, [findSelectedFrame, getCurrentRange]);

  const unwrapElement = useCallback((element) => {
    const fragment = document.createDocumentFragment();
    while (element.firstChild) {
      fragment.appendChild(element.firstChild);
    }
    element.replaceWith(fragment);
  }, []);

  const wrapSelection = useCallback((style, attributes = {}) => {
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined') return;

    editor.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const before = editor.innerHTML;
    const span = document.createElement('span');
    Object.assign(span.style, style);
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });

    try {
      range.surroundContents(span);
    } catch {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }

    selection.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    selection.addRange(nextRange);
    const after = editor.innerHTML;
    pushHistory(before, after);
    saveSelection();
  }, [pushHistory, restoreSelection, saveSelection]);

  const wrapSelectedTextNodes = useCallback((style, attributes = {}) => {
    const editor = editorRef.current;
    const range = getCurrentRange();
    if (!editor || !range || range.collapsed) return false;

    const textNodes = [];
    const walker = document.createTreeWalker(editor, window.NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue) continue;

      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      if (range.intersectsNode(node) && node.nodeValue.trim()) {
        textNodes.push(node);
      }
    }

    let wrappedAny = false;
    [...textNodes].reverse().forEach((node) => {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.nodeValue.length;
      if (start >= end) return;

      const nodeText = node.nodeValue.slice(start, end);
      if (!nodeText.trim()) return;

      const nodeRange = document.createRange();
      nodeRange.setStart(node, start);
      nodeRange.setEnd(node, end);

      const span = document.createElement('span');
      Object.assign(span.style, style);
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
      span.textContent = nodeText;
      nodeRange.deleteContents();
      nodeRange.insertNode(span);
      wrappedAny = true;
    });

    return wrappedAny;
  }, [getCurrentRange]);

  const applyInlineStyle = useCallback((style) => {
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined') return;

    // Snapshot the intended range BEFORE focusing the editor. editor.focus()
    // synchronously fires the focus event, whose handler is saveSelection —
    // and the browser may have already collapsed the visual selection at this
    // point, so that handler would overwrite selectionRef with a collapsed
    // caret and clobber the range we actually want to operate on.
    const savedRange = selectionRef.current
      ? selectionRef.current.cloneRange()
      : null;

    editor.focus();

    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.addRange(savedRange);
    } else {
      const fallback = document.createRange();
      fallback.selectNodeContents(editor);
      fallback.collapse(false);
      selection.addRange(fallback);
    }

    const range = selection.getRangeAt(0);

    if (!range.collapsed) {
      const before = editor.innerHTML;
      const wrapped = wrapSelectedTextNodes(style);
      if (!wrapped) {
        // Fallback: wrap whatever's selected as a single span. Inlined here
        // instead of delegating to wrapSelection because wrapSelection also
        // re-focuses and re-restores the selection — which would reintroduce
        // the very onFocus→saveSelection clobber we just sidestepped.
        const span = document.createElement('span');
        Object.assign(span.style, style);
        try {
          range.surroundContents(span);
        } catch {
          span.appendChild(range.extractContents());
          range.insertNode(span);
        }
        const next = document.createRange();
        next.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(next);
      }
      pushHistory(before, editor.innerHTML);
      saveSelection();
      return;
    }

    // Collapsed cursor: drop a styled span around two zero-width caret holders
    // and park the caret between them. Using two ZWSPs (instead of one with the
    // caret at its edge) keeps the caret in the middle of the text node so
    // subsequent typing stays inside the span across browsers — Chrome/Safari
    // are happy either way, but Firefox can "break out" of an inline element
    // when the caret sits at its trailing edge.
    const before = editor.innerHTML;
    const span = document.createElement('span');
    Object.assign(span.style, style);
    const caretText = document.createTextNode('​​');
    span.appendChild(caretText);
    range.insertNode(span);

    const caret = document.createRange();
    caret.setStart(caretText, 1);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);

    pushHistory(before, editor.innerHTML);
    saveSelection();
  }, [pushHistory, saveSelection, wrapSelectedTextNodes]);

  const applyFontSize = useCallback((size) => {
    setFontSize(size);
    applyInlineStyle({ fontSize: `${size}px` });
  }, [applyInlineStyle]);

  const applyFontFamily = useCallback((family) => {
    setFontFamily(family);
    applyInlineStyle({ fontFamily: family });
  }, [applyInlineStyle]);

  const applyTextColor = useCallback((color) => {
    setTextColor(color);
    runCommand('foreColor', color);
  }, [runCommand]);

  const applyFrameColor = useCallback((color, style = frameStyle) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();

    const before = editor.innerHTML;
    const selectedFrames = getFramesInSelection();
    const frameStyles = {
      border: `1px solid ${color}`,
      borderRadius: '3px',
      padding: style === 'filled' ? '2px 5px' : '1px 4px',
      backgroundColor: style === 'filled' ? color : 'transparent',
    };

    if (selectedFrames.length > 0) {
      selectedFrames.forEach((frame) => {
        Object.assign(frame.style, frameStyles);
        frame.dataset.notesFrame = 'true';
        frame.dataset.frameStyle = style;
      });
      pushHistory(before, editor.innerHTML);
      saveSelection();
      return;
    }

    const wrapped = wrapSelectedTextNodes(frameStyles, {
      'data-notes-frame': 'true',
      'data-frame-style': style,
    });
    if (!wrapped) {
      wrapSelection(frameStyles, {
        'data-notes-frame': 'true',
        'data-frame-style': style,
      });
      return;
    }
    pushHistory(before, editor.innerHTML);
    saveSelection();
  }, [frameStyle, getFramesInSelection, pushHistory, restoreSelection, saveSelection, wrapSelectedTextNodes, wrapSelection]);

  const clearFrameColor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || typeof window === 'undefined') return;
    editor.focus();
    restoreSelection();

    const before = editor.innerHTML;
    const frames = getFramesInSelection();
    frames.forEach(unwrapElement);
    pushHistory(before, editor.innerHTML);
    saveSelection();
  }, [getFramesInSelection, pushHistory, restoreSelection, saveSelection, unwrapElement]);

  const clearTextColor = useCallback(() => {
    const editor = editorRef.current;
    const range = getCurrentRange();
    if (!editor || !range) return;
    editor.focus();
    restoreSelection();

    const before = editor.innerHTML;
    const candidates = Array.from(editor.querySelectorAll('[style], font')).filter((element) => {
      try {
        return range.intersectsNode(element);
      } catch {
        return false;
      }
    });

    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== editor) {
      if (node.nodeType === Node.ELEMENT_NODE) candidates.push(node);
      node = node.parentElement;
    }

    [...new Set(candidates)].forEach((element) => {
      element.style.color = '';
      element.removeAttribute('color');
      if (element.tagName === 'FONT' && element.attributes.length === 0) {
        unwrapElement(element);
      }
    });

    pushHistory(before, editor.innerHTML);
    saveSelection();
  }, [getCurrentRange, pushHistory, restoreSelection, saveSelection, unwrapElement]);

  const clearActiveColor = useCallback(() => {
    if (colorTarget === 'frame') {
      clearFrameColor();
      return;
    }
    clearTextColor();
  }, [clearFrameColor, clearTextColor, colorTarget]);

  const applyActiveColor = useCallback((color) => {
    setActiveColor(color);
    if (colorTarget === 'text') {
      applyTextColor(color);
      return;
    }
    applyFrameColor(color, frameStyle);
  }, [applyFrameColor, applyTextColor, colorTarget, frameStyle]);

  const handleEditorKeyDown = useCallback((event) => {
    if (!event.ctrlKey && !event.metaKey) return;

    const key = event.key.toLowerCase();
    if (key === 'z' && event.shiftKey) {
      event.preventDefault();
      redo();
      return;
    }

    if (key === 'z') {
      event.preventDefault();
      undo();
      return;
    }

    if (key === 'y') {
      event.preventDefault();
      redo();
    }
  }, [redo, undo]);

  return (
    <div className="notesRichEditor" ref={editorRootRef}>
      <div className="notesFormatToolbar" aria-label="Text formatting">
        <button
          type="button"
          className="notesFormatBtn"
          title="Undo"
          onMouseDown={(event) => event.preventDefault()}
          onClick={undo}
        >
          <Undo2 size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="notesFormatBtn"
          title="Redo"
          onMouseDown={(event) => event.preventDefault()}
          onClick={redo}
        >
          <Redo2 size={15} strokeWidth={1.7} />
        </button>
        <span className="notesFormatDivider" />
        <button
          type="button"
          className="notesFormatBtn"
          title="Bold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('bold')}
        >
          <Bold size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="notesFormatBtn"
          title="Italic"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('italic')}
        >
          <Italic size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="notesFormatBtn"
          title="Underline"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('underline')}
        >
          <Underline size={15} strokeWidth={1.7} />
        </button>
        <span className="notesFormatDivider" />
        <button
          type="button"
          className="notesFormatBtn"
          title="Align left"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('justifyLeft')}
        >
          <AlignLeft size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="notesFormatBtn"
          title="Align center"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('justifyCenter')}
        >
          <AlignCenter size={15} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          className="notesFormatBtn"
          title="Align right"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('justifyRight')}
        >
          <AlignRight size={15} strokeWidth={1.7} />
        </button>
        <span className="notesFormatDivider" />
        <div className="notesFontFamilySelectWrap" onMouseDown={saveSelection}>
          <CustomSelect
            options={NOTE_FONT_OPTIONS}
            value={fontFamily}
            onChange={applyFontFamily}
            listPosition="local"
          />
        </div>
        <div className="notesFontSizeSelectWrap" onMouseDown={saveSelection}>
          <CustomSelect
            options={NOTE_FONT_SIZE_SELECT_OPTIONS}
            value={fontSize}
            onChange={applyFontSize}
            listPosition="local"
          />
        </div>
        <span className="notesFormatDivider" />
        <div className="notesColorControl" onMouseDown={saveSelection}>
          <div className="notesSegmentGroup" aria-label="Color target">
            <button
              type="button"
              className={`notesSegmentBtn ${colorTarget === 'text' ? 'active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setColorTarget('text');
                setActiveColor(textColor);
              }}
            >
              Text
            </button>
            <button
              type="button"
              className={`notesSegmentBtn ${colorTarget === 'frame' ? 'active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setColorTarget('frame');
                setActiveColor('#60a5fa');
              }}
            >
              Frame
            </button>
          </div>
          {colorTarget === 'frame' ? (
            <div className="notesSegmentGroup" aria-label="Frame style">
              <button
                type="button"
                className={`notesSegmentBtn ${frameStyle === 'outline' ? 'active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setFrameStyle('outline')}
              >
                Outline
              </button>
              <button
                type="button"
                className={`notesSegmentBtn ${frameStyle === 'filled' ? 'active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setFrameStyle('filled')}
              >
                Fill
              </button>
            </div>
          ) : null}
          <ColorPicker
            value={activeColor}
            onChange={applyActiveColor}
            presets={NOTE_TEXT_COLOR_PRESETS}
            placeholder="#ffffff"
          />
          <button
            type="button"
            className="notesSegmentBtn clear"
            title={colorTarget === 'frame' ? 'Clear frame color' : 'Clear text color'}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearActiveColor}
          >
            Clear
          </button>
        </div>
        <span className="notesFormatDivider" />
        <button
          type="button"
          className="notesFormatBtn text"
          title="Bullet list"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand('insertUnorderedList')}
        >
          • List
        </button>
        <span className="notesModifiedAt">{modifiedLabel}</span>
      </div>

      <div
        className="notesRulerWrap"
        style={{
          '--notes-writing-width': `${writingWidth}px`,
          '--notes-ruler-span': `${rulerSpanPercent}%`,
        }}
      >
        <div className="notesRuler" aria-label="Writing area width">
          <span className="notesRulerLabel">Page</span>
          <div className="notesRulerTrack">
            <span className="notesRulerPage">
              <span
                className="notesRulerEdge left"
                role="slider"
                tabIndex={0}
                aria-label="Adjust left page edge"
                aria-valuemin={NOTES_EDITOR_WIDTH_MIN}
                aria-valuemax={dynamicMax}
                aria-valuenow={writingWidth}
                onPointerDown={(event) => handleRulerPointerDown(event, 'left')}
              />
              <span
                className="notesRulerEdge right"
                role="slider"
                tabIndex={0}
                aria-label="Adjust right page edge"
                aria-valuemin={NOTES_EDITOR_WIDTH_MIN}
                aria-valuemax={dynamicMax}
                aria-valuenow={writingWidth}
                onPointerDown={(event) => handleRulerPointerDown(event, 'right')}
              />
            </span>
            <input
              className="notesRulerInput"
              type="range"
              min={NOTES_EDITOR_WIDTH_MIN}
              max={dynamicMax}
              step="20"
              value={writingWidth}
              onChange={(event) => changeWritingWidth(event.target.value)}
              aria-label="Writing area width"
            />
          </div>
          <span className="notesRulerValue">{writingWidth}px</span>
        </div>

        <div
          ref={setEditorNode}
          className="notesBodyInput"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Start typing..."
          onInput={syncContent}
          onBlur={saveSelection}
          onKeyUp={handleSelectionUpdate}
          onKeyDown={handleEditorKeyDown}
          onMouseUp={handleSelectionUpdate}
          onFocus={handleSelectionUpdate}
          onPaste={handlePaste}
          onDrop={handleDrop}
        />
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  openFolders,
  selectedId,
  editingId,
  editingName,
  query,
  onSelect,
  onToggle,
  onStartRename,
  onChangeEditingName,
  onCommitRename,
  onCancelRename,
  onOpenIconPicker,
  onDelete,
  onMoveNode,
  dragOverId,
  onDragOverNode,
  onDragLeaveNode,
  onDragEnd,
}) {
  const isFolder = node.type === 'folder';
  const isOpen = openFolders.has(node.id);
  const isSelected = selectedId === node.id;
  const isEditing = editingId === node.id;
  const isDragOver = dragOverId === node.id;
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);

  const handleRowKeyDown = (event) => {
    if (isEditing) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      onSelect(node.id);
      if (isFolder) onToggle(node.id);
    }

    if (event.key === 'F2') {
      event.preventDefault();
      onStartRename(node.id);
    }
  };

  return (
    <div className="notesTreeNode">
      <div
        role="button"
        tabIndex={0}
        className={`notesTreeItem ${isSelected ? 'active' : ''} ${isDragOver ? 'dragOver' : ''}`}
        style={{ '--notes-depth': depth }}
        onClick={() => onSelect(node.id)}
        onKeyDown={handleRowKeyDown}
        draggable={!isEditing}
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/x-notes-id', node.id);
          event.dataTransfer.setData('text/plain', node.name);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (!isFolder) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'move';
          onDragOverNode(node.id);
        }}
        onDragLeave={(event) => {
          if (!isFolder) return;
          event.stopPropagation();
          onDragLeaveNode(node.id);
        }}
        onDrop={(event) => {
          if (!isFolder) return;
          event.preventDefault();
          event.stopPropagation();
          const draggedId = event.dataTransfer.getData('text/x-notes-id');
          onDragLeaveNode(node.id);
          if (!draggedId || draggedId === node.id) return;
          onMoveNode(draggedId, node.id);
        }}
      >
        <span
          className={`notesTreeChevron ${isFolder && isOpen ? 'open' : ''}`}
          onClick={(event) => {
            if (!isFolder) return;
            event.stopPropagation();
            onToggle(node.id);
          }}
        >
          {isFolder ? <ChevronRight size={14} strokeWidth={1.6} /> : null}
        </span>
        {isEditing ? (
          <button
            type="button"
            className="notesNodeIconEditBtn"
            title="Change icon"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              onOpenIconPicker(node.id, event.currentTarget.getBoundingClientRect());
            }}
          >
            <NodeIcon node={node} />
          </button>
        ) : (
          <span className="notesNodeIcon">
            <NodeIcon node={node} />
          </span>
        )}
        {isEditing ? (
          <input
            ref={inputRef}
            className="notesTreeRenameInput"
            value={editingName}
            onChange={(event) => onChangeEditingName(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={onCommitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onCommitRename();
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelRename();
              }
            }}
            aria-label={`Rename ${node.name}`}
          />
        ) : (
          <span className="notesTreeLabel">{node.name}</span>
        )}
        <span className="notesTreeActions">
          <span
            role="button"
            tabIndex={0}
            className="notesIconGhost"
            title="Rename"
            onClick={(event) => {
              event.stopPropagation();
              onStartRename(node.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onStartRename(node.id);
            }}
          >
            <Pencil size={12} strokeWidth={1.5} />
          </span>
          <span
            role="button"
            tabIndex={0}
            className="notesIconGhost danger"
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(node.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
            onDelete(node.id);
          }}
        >
          <Trash2 size={12} strokeWidth={1.5} />
          </span>
        </span>
      </div>
      {isFolder && (isOpen || query.trim()) && node.children.length > 0 ? (
        <div className="notesTreeChildren">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              openFolders={openFolders}
              selectedId={selectedId}
              editingId={editingId}
              editingName={editingName}
              query={query}
              onSelect={onSelect}
              onToggle={onToggle}
              onStartRename={onStartRename}
              onChangeEditingName={onChangeEditingName}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onOpenIconPicker={onOpenIconPicker}
              onDelete={onDelete}
              onMoveNode={onMoveNode}
              dragOverId={dragOverId}
              onDragOverNode={onDragOverNode}
              onDragLeaveNode={onDragLeaveNode}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export {
  RichTextEditor,
  loadTree as loadNotesTree,
  idbGetNotesTree,
  idbPutNotesTree,
  findNode as findNoteNode,
  updateNode as updateNoteNode,
  NodeIcon as NotesNodeIcon,
};

export default function Notes() {
  const [tree, setTree] = useState(loadTree);
  const [selectedId, setSelectedId] = useState(() => restoreNotesViewState(loadTree()).selectedId);
  const [query, setQuery] = useState('');
  const [openFolders, setOpenFolders] = useState(() => restoreNotesViewState(loadTree()).openFolders);
  const [editing, setEditing] = useState(null);
  const [iconPicker, setIconPicker] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const handleDragOverNode = useCallback((id) => setDragOverId(id), []);
  const handleDragLeaveNode = useCallback((id) => {
    setDragOverId((cur) => (cur === id ? null : cur));
  }, []);
  const handleDragEnd = useCallback(() => setDragOverId(null), []);

  const selectedNode = useMemo(() => findNode(tree, selectedId), [tree, selectedId]);
  const selectedFile = selectedNode?.type === 'file' ? selectedNode : null;
  const iconPickerNode = useMemo(() => findNode(tree, iconPicker?.nodeId), [iconPicker?.nodeId, tree]);
  const iconPickerNodeId = iconPicker?.nodeId || null;
  const pendingDeleteNode = useMemo(() => findNode(tree, pendingDeleteId), [pendingDeleteId, tree]);
  const visibleTree = useMemo(() => sortTree(filterTree(tree, query)), [tree, query]);
  const treeCounts = useMemo(() => countTree(tree), [tree]);

  /* IndexedDB is the authoritative *local* cache. localStorage caps out
     around ~5MB per origin, which the notes tree blows past as soon as the
     user pastes an image (now uploaded to object storage, but legacy data
     URLs can still live in the tree). The server (when authenticated) is
     the cross-device source of truth — see syncApi below. */
  const notesHydratedRef = useRef(false);
  const notesPersistTimerRef = useRef(null);
  const latestTreeRef = useRef(tree);
  useEffect(() => {
    latestTreeRef.current = tree;
  }, [tree]);

  useEffect(() => {
    if (!notesHydratedRef.current) return;
    saveNotesViewState({
      selectedFileId: selectedFile?.id || loadNotesViewState()?.selectedFileId || null,
      openFolders,
    });
  }, [openFolders, selectedFile?.id]);

  const notesSyncApi = useMemo(
    () => ({
      getDocument: () => notesApi.getDocument(),
      updateDocument: async ({ snapshot }) => {
        const doc = await notesApi.updateDocument({ tree: snapshot });
        /* Mirror server's updated_at into IDB so a reload's reconcile
           compares against the same baseline, and clear the dirty flag. */
        await idbPutNotesSyncMeta({
          serverUpdatedAt: doc.updated_at,
          dirty: false,
        });
        return doc;
      },
    }),
    []
  );

  const {
    initialServerDoc,
    markHydrated,
    setSnapshot,
    schedulePush,
    isAuthenticated,
  } = useDocumentSync({
    api: notesSyncApi,
    debounceMs: NOTES_SYNC_DEBOUNCE_MS,
    featureKey: 'notes',
  });

  /* Hydrate from IDB on mount. We render local-first for instant feel, then
     reconcile with the server doc once it arrives. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await idbGetNotesTree();
        if (cancelled) return;
        if (stored) {
          const hydrated = normalizeTree(stored);
          const restoredView = restoreNotesViewState(hydrated);
          setTree(hydrated);
          setSelectedId(restoredView.selectedId);
          setOpenFolders(restoredView.openFolders);
        } else {
          const seed = latestTreeRef.current;
          if (seed && seed.length) {
            await idbPutNotesTree(seed).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Notes: IndexedDB hydration failed, using localStorage fallback', err);
      } finally {
        if (!cancelled) {
          notesHydratedRef.current = true;
          markHydrated();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [markHydrated]);

  /* When the initial server doc arrives, reconcile by timestamp. There is
     no user-facing conflict UI: whichever side has the newer state wins.
     The `dirty` flag in IDB meta covers the case where the user edited
     locally but the PUT hadn't completed before reload — we push those
     edits up regardless of server timestamp. */
  const initialReconciledRef = useRef(false);
  useEffect(() => {
    if (!notesHydratedRef.current) return;
    if (!initialServerDoc) return;
    if (initialReconciledRef.current) return;
    initialReconciledRef.current = true;

    (async () => {
      const meta = await idbGetNotesSyncMeta();
      const localDirty = Boolean(meta?.dirty);
      const localServerUpdatedAt = meta?.serverUpdatedAt || null;
      const remoteUpdatedAt = initialServerDoc.updated_at || null;
      const remoteTree = Array.isArray(initialServerDoc.tree)
        ? initialServerDoc.tree
        : [];

      const remoteIsNewer =
        !localServerUpdatedAt ||
        (remoteUpdatedAt && remoteUpdatedAt > localServerUpdatedAt);

      if (
        localDirty &&
        isLikelyFallbackTree(latestTreeRef.current) &&
        isRicherTree(remoteTree, latestTreeRef.current)
      ) {
        /* A fallback/default local tree should never overwrite a richer
           server document. This protects against reload/hydration failures
           that otherwise mark the placeholder tree as dirty. */
        const hydrated = normalizeTree(remoteTree);
        const restoredView = restoreNotesViewState(hydrated);
        setTree(hydrated);
        setSelectedId(restoredView.selectedId);
        setOpenFolders(restoredView.openFolders);
        await idbPutNotesTree(hydrated).catch(() => {});
        await idbPutNotesSyncMeta({
          serverUpdatedAt: remoteUpdatedAt,
          dirty: false,
        });
      } else if (localDirty) {
        /* Unsynced local edits trump server. Push them up. */
        setSnapshot(latestTreeRef.current);
        schedulePush();
      } else if (remoteIsNewer) {
        /* Server has fresher data — adopt silently. */
        const hydrated = normalizeTree(remoteTree);
        const restoredView = restoreNotesViewState(hydrated);
        setTree(hydrated);
        setSelectedId(restoredView.selectedId);
        setOpenFolders(restoredView.openFolders);
        await idbPutNotesTree(hydrated).catch(() => {});
        await idbPutNotesSyncMeta({
          serverUpdatedAt: remoteUpdatedAt,
          dirty: false,
        });
      } else {
        /* Local matches server (no pending edits). Just record the baseline
           so future reconciles compare correctly. */
        await idbPutNotesSyncMeta({
          serverUpdatedAt: remoteUpdatedAt,
          dirty: false,
        });
      }
    })();
  }, [initialServerDoc, schedulePush, setSnapshot]);

  /* Persist tree changes to IDB and (if authenticated) schedule a push.
     Mark the local document dirty so a reload before the PUT lands knows
     to push the unsynced edits up rather than adopt server. */
  useEffect(() => {
    if (!notesHydratedRef.current) return;
    if (!initialReconciledRef.current) return; /* Don't mark dirty mid-reconcile. */
    if (notesPersistTimerRef.current) {
      clearTimeout(notesPersistTimerRef.current);
    }
    const snapshot = tree;
    setSnapshot(snapshot);
    notesPersistTimerRef.current = setTimeout(async () => {
      notesPersistTimerRef.current = null;
      try {
        await idbPutNotesTree(snapshot);
        const meta = await idbGetNotesSyncMeta();
        await idbPutNotesSyncMeta({
          serverUpdatedAt: meta?.serverUpdatedAt || null,
          dirty: true,
        });
      } catch (err) {
        console.warn('Notes: failed to persist tree to IndexedDB', err);
      }
    }, NOTES_PERSIST_DEBOUNCE_MS);
    schedulePush();
    return () => {
      if (notesPersistTimerRef.current) {
        clearTimeout(notesPersistTimerRef.current);
        notesPersistTimerRef.current = null;
      }
    };
  }, [tree, schedulePush, setSnapshot]);

  /* Image upload handler passed to RichTextEditor; only active when the user
     is authenticated. When logged out, falls back to browser default (inline
     base64) — same behaviour as today. */
  const handleUploadImage = useCallback(async (file) => {
    if (!isAuthenticated()) {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }
    try {
      const result = await mediaApi.upload({ file, kind: 'notes' });
      return result?.url || '';
    } catch (err) {
      console.warn('Notes: image upload failed, falling back to inline base64', err);
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }
  }, [isAuthenticated]);

  /* Flush any pending debounced IDB write on unmount so a quick tab switch
     after typing doesn't drop the last edits. The sync hook handles
     flushing the network write itself. */
  useEffect(() => {
    return () => {
      if (!notesHydratedRef.current) return;
      if (notesPersistTimerRef.current) {
        clearTimeout(notesPersistTimerRef.current);
        notesPersistTimerRef.current = null;
      }
      idbPutNotesTree(latestTreeRef.current).catch(() => {});
    };
  }, []);

  const toggleFolder = useCallback((id) => {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addFile = useCallback(() => {
    const file = createFile();
    const folderId = getTargetFolderId(tree, selectedId);

    setTree((current) => addChild(current, folderId, file));
    setSelectedId(file.id);
    setEditing({ id: file.id, name: file.name });
    if (folderId) setOpenFolders((current) => new Set([...current, folderId]));
  }, [selectedId, tree]);

  const addFolder = useCallback(() => {
    const folder = createFolder();
    const folderId = getTargetFolderId(tree, selectedId);

    setTree((current) => addChild(current, folderId, folder));
    setSelectedId(folder.id);
    setEditing({ id: folder.id, name: folder.name });
    setOpenFolders((current) => new Set([...current, folder.id, ...(folderId ? [folderId] : [])]));
  }, [selectedId, tree]);

  const moveNodeTo = useCallback((draggedId, targetFolderId) => {
    setTree((current) => moveNode(current, draggedId, targetFolderId));
    if (targetFolderId) {
      setOpenFolders((current) => new Set([...current, targetFolderId]));
    }
  }, []);

  const startRename = useCallback((id) => {
    const node = findNode(tree, id);
    if (!node) return;

    setSelectedId(id);
    setEditing({ id, name: node.name });
  }, [tree]);

  const commitRename = useCallback(() => {
    if (!editing) return;

    const nextName = editing.name.trim();
    const node = findNode(tree, editing.id);
    setEditing(null);
    if (!node || !nextName || nextName === node.name) return;

    setTree((current) =>
      updateNode(current, editing.id, (item) => ({
        ...item,
        name: nextName,
        updatedAt: new Date().toISOString(),
      }))
    );
  }, [editing, tree]);

  const cancelRename = useCallback(() => {
    setEditing(null);
  }, []);

  const updateNodeIcon = useCallback((icon) => {
    if (!iconPickerNodeId) return;

    setTree((current) =>
      updateNode(current, iconPickerNodeId, (node) => ({
        ...node,
        icon,
        updatedAt: new Date().toISOString(),
      }))
    );
  }, [iconPickerNodeId]);

  const requestDeleteNode = useCallback((id) => {
    setPendingDeleteId(id);
  }, []);

  const confirmDeleteNode = useCallback(() => {
    if (!pendingDeleteId) return;

    setTree((current) => {
      const nextTree = deleteNode(current, pendingDeleteId);
      if (pendingDeleteId === selectedId || !findNode(nextTree, selectedId)) {
        const nextSelection = findFirstFile(nextTree)?.id || nextTree[0]?.id || null;
        setSelectedId(nextSelection);
      }
      return nextTree;
    });
    setPendingDeleteId(null);
  }, [pendingDeleteId, selectedId]);

  const updateSelectedFile = useCallback((updates) => {
    if (!selectedFile) return;
    setTree((current) =>
      updateNode(current, selectedFile.id, (node) => ({
        ...node,
        ...updates,
        updatedAt: new Date().toISOString(),
      }))
    );
  }, [selectedFile]);

  return (
    <section className="notesShell" aria-label="Notes">
      <aside className="notesSidebar">
        <div className="notesSidebarHead">
          <div className="notesCounters" aria-label="Filesystem totals">
            <span>{treeCounts.folders} folders</span>
            <span>{treeCounts.files} files</span>
          </div>
          <div className="notesCreateActions">
            <button type="button" className="notesIconBtn" title="New folder" onClick={addFolder}>
              <FolderPlus size={16} strokeWidth={1.5} />
            </button>
            <button type="button" className="notesIconBtn primary" title="New text file" onClick={addFile}>
              <Plus size={17} strokeWidth={1.6} />
            </button>
          </div>
        </div>

        <label className="notesSearch">
          <Search size={14} strokeWidth={1.5} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search notes"
          />
        </label>

        <div
          className={`notesTree ${dragOverId === '__root__' ? 'dragOverRoot' : ''}`}
          aria-label="File system"
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes('text/x-notes-id')) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDragOverId('__root__');
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            setDragOverId((cur) => (cur === '__root__' ? null : cur));
          }}
          onDrop={(event) => {
            event.preventDefault();
            const draggedId = event.dataTransfer.getData('text/x-notes-id');
            setDragOverId(null);
            if (!draggedId) return;
            moveNodeTo(draggedId, null);
          }}
        >
          {visibleTree.length > 0 ? (
            visibleTree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                openFolders={openFolders}
                selectedId={selectedId}
                editingId={editing?.id || null}
                editingName={editing?.name || ''}
                query={query}
                onSelect={setSelectedId}
                onToggle={toggleFolder}
                onStartRename={startRename}
                onChangeEditingName={(name) => setEditing((current) => (current ? { ...current, name } : current))}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onOpenIconPicker={(nodeId, anchorRect) => setIconPicker({ nodeId, anchorRect })}
                onDelete={requestDeleteNode}
                onMoveNode={moveNodeTo}
                dragOverId={dragOverId}
                onDragOverNode={handleDragOverNode}
                onDragLeaveNode={handleDragLeaveNode}
                onDragEnd={handleDragEnd}
              />
            ))
          ) : (
            <div className="notesEmptyTree">No matches</div>
          )}
        </div>
      </aside>

      <main className="notesEditor">
        {selectedFile ? (
          <>
            <input
              className="notesTitleInput"
              value={selectedFile.name}
              onChange={(event) => updateSelectedFile({ name: event.target.value })}
              aria-label="Note title"
            />
            <RichTextEditor
              key={selectedFile.id}
              file={selectedFile}
              onChange={(content) => updateSelectedFile({ content })}
              onUploadImage={handleUploadImage}
            />
          </>
        ) : (
          <div className="notesEmptyEditor">
            <FileText size={24} strokeWidth={1.4} />
            <h3>Select a text file</h3>
            <p>Create a file from the left panel to start writing.</p>
          </div>
        )}
      </main>
      <IconPickerPopover
        key={iconPickerNodeId || 'closed'}
        node={iconPickerNode}
        anchorRect={iconPicker?.anchorRect}
        onClose={() => setIconPicker(null)}
        onPick={updateNodeIcon}
      />
      <DeleteConfirmDialog
        node={pendingDeleteNode}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteNode}
      />
    </section>
  );
}

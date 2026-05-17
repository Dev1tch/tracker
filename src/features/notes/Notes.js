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
import './Notes.css';

const STORAGE_KEY = 'notes.filesystem';
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

function createId(prefix = 'note') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createFile(name = 'Untitled note') {
  return {
    id: createId('file'),
    type: 'file',
    name,
    icon: DEFAULT_FILE_ICON,
    content: '',
    updatedAt: new Date().toISOString(),
  };
}

function createFolder(name = 'New folder') {
  return {
    id: createId('folder'),
    type: 'folder',
    name,
    icon: DEFAULT_FOLDER_ICON,
    children: [],
    updatedAt: new Date().toISOString(),
  };
}

const DEFAULT_TREE = [
  {
    id: 'notes-root-folder',
    type: 'folder',
    name: 'Personal',
    icon: DEFAULT_FOLDER_ICON,
    updatedAt: new Date(0).toISOString(),
    children: [
      {
        id: 'notes-welcome-file',
        type: 'file',
        name: 'Welcome',
        icon: { kind: 'emoji', value: '📝', color: DEFAULT_ICON_COLOR },
        content: 'A quiet place for quick notes.',
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

function getTargetFolderId(nodes, selectedId) {
  const selected = findNode(nodes, selectedId);
  if (!selected) return null;
  return selected.type === 'folder' ? selected.id : null;
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

function RichTextEditor({ file, onChange }) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
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

  const applyFontSize = useCallback((size) => {
    wrapSelection({ fontSize: `${size}px` });
  }, [wrapSelection]);

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
    <div className="notesRichEditor">
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
        <div className="notesFontSizeSelectWrap" onMouseDown={saveSelection}>
          <CustomSelect
            options={NOTE_FONT_SIZE_SELECT_OPTIONS}
            value="15"
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
      </div>

      <div
        ref={setEditorNode}
        className="notesBodyInput"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Start typing..."
        onInput={syncContent}
        onBlur={saveSelection}
        onKeyUp={saveSelection}
        onKeyDown={handleEditorKeyDown}
        onMouseUp={saveSelection}
        onFocus={saveSelection}
      />
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
}) {
  const isFolder = node.type === 'folder';
  const isOpen = openFolders.has(node.id);
  const isSelected = selectedId === node.id;
  const isEditing = editingId === node.id;
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
        className={`notesTreeItem ${isSelected ? 'active' : ''}`}
        style={{ '--notes-depth': depth }}
        onClick={() => onSelect(node.id)}
        onKeyDown={handleRowKeyDown}
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
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Notes() {
  const [tree, setTree] = useState(loadTree);
  const [selectedId, setSelectedId] = useState(() => findFirstFile(loadTree())?.id || null);
  const [query, setQuery] = useState('');
  const [openFolders, setOpenFolders] = useState(() => collectOpenFolders(loadTree()));
  const [editing, setEditing] = useState(null);
  const [iconPicker, setIconPicker] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const selectedNode = useMemo(() => findNode(tree, selectedId), [tree, selectedId]);
  const selectedFile = selectedNode?.type === 'file' ? selectedNode : null;
  const iconPickerNode = useMemo(() => findNode(tree, iconPicker?.nodeId), [iconPicker?.nodeId, tree]);
  const iconPickerNodeId = iconPicker?.nodeId || null;
  const pendingDeleteNode = useMemo(() => findNode(tree, pendingDeleteId), [pendingDeleteId, tree]);
  const visibleTree = useMemo(() => filterTree(tree, query), [tree, query]);
  const treeCounts = useMemo(() => countTree(tree), [tree]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
    } catch {}
  }, [tree]);

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

        <div className="notesTree" aria-label="File system">
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

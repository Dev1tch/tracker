import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ChevronRight,
  FileText,
  Folder,
  FolderInput,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react-native';

import ActionButton from '../../components/ActionButton';
import ColorField from '../../components/ColorField';
import ModalSheet from '../../components/ModalSheet';
import ScreenShell from '../../components/ScreenShell';
import SectionCard from '../../components/SectionCard';
import TextField from '../../components/TextField';
import NoteEditorModal from './NoteEditorModal';
import {
  EMOJI_OPTIONS,
  ICON_COLOR_PRESETS,
  ICON_COMPONENTS,
  ICON_OPTIONS,
} from './icons';
import { notesApi } from '../../shared/api';
import { useTheme } from '../../theme';
import { useToast } from '../../providers/ToastProvider';
import { useDialog } from '../../providers/DialogProvider';

const DEFAULT_ICON_COLOR = 'currentColor';
const DEFAULT_FOLDER_ICON = { kind: 'icon', name: 'folder', color: DEFAULT_ICON_COLOR };
const DEFAULT_FILE_ICON = { kind: 'icon', name: 'fileText', color: DEFAULT_ICON_COLOR };

function createId(prefix) {
  const rand = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createFile(name = 'Untitled note') {
  const stamp = nowIso();
  return { id: createId('file'), type: 'file', name, icon: DEFAULT_FILE_ICON, content: '', createdAt: stamp, updatedAt: stamp };
}

function createFolder(name = 'New folder') {
  const stamp = nowIso();
  return { id: createId('folder'), type: 'folder', name, icon: DEFAULT_FOLDER_ICON, children: [], createdAt: stamp, updatedAt: stamp };
}

function normalizeTree(value) {
  return Array.isArray(value) ? value : [];
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'folder' && node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentFolderId(nodes, id, parentId = null) {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    if (node.type === 'folder' && node.children) {
      const found = findParentFolderId(node.children, id, node.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function updateNode(nodes, id, updater) {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.type === 'folder' && node.children) {
      return { ...node, children: updateNode(node.children, id, updater) };
    }
    return node;
  });
}

function deleteNode(nodes, id) {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => (
      node.type === 'folder' && node.children
        ? { ...node, children: deleteNode(node.children, id) }
        : node
    ));
}

function insertIntoFolder(nodes, folderId, newNode) {
  if (!folderId) return [...nodes, newNode];
  return nodes.map((node) => {
    if (node.id === folderId && node.type === 'folder') {
      return { ...node, children: [...(node.children || []), newNode] };
    }
    if (node.type === 'folder' && node.children) {
      return { ...node, children: insertIntoFolder(node.children, folderId, newNode) };
    }
    return node;
  });
}

// Folder options for "move to" — skips the node itself and (since it returns
// before recursing) its whole subtree, so a folder can't be moved into itself.
function collectFolderOptions(nodes, excludeId, depth = 0, out = []) {
  nodes.forEach((node) => {
    if (node.type !== 'folder') return;
    if (node.id === excludeId) return;
    out.push({ value: node.id, label: `${'   '.repeat(depth)}${node.name}` });
    collectFolderOptions(node.children || [], excludeId, depth + 1, out);
  });
  return out;
}

// Reorder a node among its siblings (web's drag before/after, as reliable controls).
function reorderWithinParent(nodes, nodeId, dir) {
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx !== -1) {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= nodes.length) return nodes;
    const copy = nodes.slice();
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    return copy;
  }
  return nodes.map((n) => (
    n.type === 'folder' && n.children ? { ...n, children: reorderWithinParent(n.children, nodeId, dir) } : n
  ));
}

function getTargetFolderId(tree, selectedId) {
  if (!selectedId) return null;
  const node = findNode(tree, selectedId);
  if (!node) return null;
  if (node.type === 'folder') return node.id;
  const parent = findParentFolderId(tree, selectedId);
  return parent ?? null;
}

function countTree(nodes, acc = { folders: 0, files: 0 }) {
  nodes.forEach((node) => {
    if (node.type === 'folder') {
      acc.folders += 1;
      countTree(node.children || [], acc);
    } else {
      acc.files += 1;
    }
  });
  return acc;
}

function filterTree(nodes, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;

  const walk = (list) => list.reduce((acc, node) => {
    if (node.type === 'folder') {
      const children = walk(node.children || []);
      const selfMatch = (node.name || '').toLowerCase().includes(needle);
      if (selfMatch || children.length) {
        acc.push({ ...node, children });
      }
    } else {
      const hay = `${node.name || ''} ${node.content || ''}`.toLowerCase();
      if (hay.includes(needle)) acc.push(node);
    }
    return acc;
  }, []);

  return walk(nodes);
}

function collectFolderIds(nodes, acc = []) {
  nodes.forEach((node) => {
    if (node.type === 'folder') {
      acc.push(node.id);
      collectFolderIds(node.children || [], acc);
    }
  });
  return acc;
}

function flattenVisible(nodes, openSet, depth, out) {
  nodes.forEach((node) => {
    out.push({ node, depth });
    if (node.type === 'folder' && openSet.has(node.id) && node.children?.length) {
      flattenVisible(node.children, openSet, depth + 1, out);
    }
  });
  return out;
}

function NodeIcon({ icon, type }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  if (icon?.kind === 'emoji' && icon.value) {
    return <Text style={styles.emojiIcon}>{icon.value}</Text>;
  }
  const color = !icon?.color || icon.color === DEFAULT_ICON_COLOR ? theme.colors.secondary : icon.color;
  const Glyph = (icon?.kind === 'icon' && ICON_COMPONENTS[icon.name])
    || (type === 'folder' ? Folder : FileText);
  return <Glyph color={color} size={15} strokeWidth={1.6} />;
}

export default function NotesScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const addToast = useToast();
  const { confirm } = useDialog();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openFolders, setOpenFolders] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editorFileId, setEditorFileId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveTarget, setMoveTarget] = useState(null);
  const [iconTab, setIconTab] = useState('emoji');
  const loadedRef = useRef(false);
  const saveTimerRef = useRef(null);

  const fetchTree = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const doc = await notesApi.getDocument();
      const nextTree = normalizeTree(doc?.tree);
      setTree(nextTree);
      setOpenFolders(new Set(collectFolderIds(nextTree)));
      loadedRef.current = true;
    } catch (error) {
      console.error('Failed to load notes', error);
      addToast(error?.message || 'Failed to load notes.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Debounced last-write-wins save to the server document.
  useEffect(() => {
    if (!loadedRef.current) return undefined;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      notesApi.updateDocument({ tree }).catch((error) => {
        console.error('Failed to save notes', error);
        addToast(error?.message || 'Failed to save notes.', 'error');
      });
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tree, addToast]);

  const counts = useMemo(() => countTree(tree), [tree]);
  const displayTree = useMemo(() => filterTree(tree, query), [tree, query]);
  const effectiveOpen = useMemo(
    () => (query.trim() ? new Set(collectFolderIds(displayTree)) : openFolders),
    [query, displayTree, openFolders]
  );
  const rows = useMemo(
    () => flattenVisible(displayTree, effectiveOpen, 0, []),
    [displayTree, effectiveOpen]
  );

  const editorFile = useMemo(
    () => (editorFileId ? findNode(tree, editorFileId) : null),
    [editorFileId, tree]
  );

  const toggleFolder = useCallback((id) => {
    setSelectedId(id);
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleAddFile = useCallback(() => {
    const node = createFile();
    const targetFolderId = getTargetFolderId(tree, selectedId);
    setTree((current) => insertIntoFolder(current, targetFolderId, node));
    if (targetFolderId) {
      setOpenFolders((current) => new Set(current).add(targetFolderId));
    }
    setSelectedId(node.id);
    setRenameTarget(node);
    setRenameValue(node.name);
  }, [selectedId, tree]);

  const handleAddFolder = useCallback(() => {
    const node = createFolder();
    const targetFolderId = getTargetFolderId(tree, selectedId);
    setTree((current) => insertIntoFolder(current, targetFolderId, node));
    setOpenFolders((current) => {
      const next = new Set(current).add(node.id);
      if (targetFolderId) next.add(targetFolderId);
      return next;
    });
    setSelectedId(node.id);
    setRenameTarget(node);
    setRenameValue(node.name);
  }, [selectedId, tree]);

  const commitRename = useCallback(() => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (name) {
      setTree((current) => updateNode(current, renameTarget.id, (node) => ({ ...node, name, updatedAt: nowIso() })));
    }
    setRenameTarget(null);
    setRenameValue('');
  }, [renameTarget, renameValue]);

  const setNodeEmoji = useCallback((emoji) => {
    if (!renameTarget) return;
    setTree((current) => updateNode(current, renameTarget.id, (node) => ({
      ...node,
      icon: emoji
        ? { kind: 'emoji', value: emoji, color: node.icon?.color || DEFAULT_ICON_COLOR }
        : (node.type === 'folder' ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON),
      updatedAt: nowIso(),
    })));
  }, [renameTarget]);

  const setNodeIconName = useCallback((name) => {
    if (!renameTarget) return;
    setTree((current) => updateNode(current, renameTarget.id, (node) => ({
      ...node,
      icon: { kind: 'icon', name, color: node.icon?.color || DEFAULT_ICON_COLOR },
      updatedAt: nowIso(),
    })));
  }, [renameTarget]);

  const setNodeIconColor = useCallback((color) => {
    if (!renameTarget) return;
    setTree((current) => updateNode(current, renameTarget.id, (node) => ({
      ...node,
      icon: { ...(node.icon || (node.type === 'folder' ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON)), color },
      updatedAt: nowIso(),
    })));
  }, [renameTarget]);

  const handleMove = useCallback((targetFolderId) => {
    if (!moveTarget) return;
    const node = findNode(tree, moveTarget.id);
    if (!node) { setMoveTarget(null); return; }
    setTree((current) => insertIntoFolder(deleteNode(current, moveTarget.id), targetFolderId || null, node));
    if (targetFolderId) {
      setOpenFolders((current) => new Set(current).add(targetFolderId));
    }
    setMoveTarget(null);
  }, [moveTarget, tree]);

  const moveFolderOptions = useMemo(() => (
    moveTarget ? [{ value: '', label: 'Root' }, ...collectFolderOptions(tree, moveTarget.id)] : []
  ), [moveTarget, tree]);

  const handleReorder = useCallback((dir) => {
    if (!moveTarget) return;
    setTree((current) => reorderWithinParent(current, moveTarget.id, dir));
  }, [moveTarget]);

  const confirmDelete = useCallback(async (node) => {
    const message = node.type === 'folder'
      ? `"${node.name}" and everything inside it will be removed.`
      : `"${node.name}" will be removed.`;
    const ok = await confirm({
      title: 'Delete ' + (node.type === 'folder' ? 'folder' : 'file') + '?',
      message,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setTree((current) => deleteNode(current, node.id));
    if (editorFileId === node.id) {
      setEditorFileId(null);
    }
  }, [confirm, editorFileId]);

  const openFile = useCallback((node) => {
    setSelectedId(node.id);
    setEditorFileId(node.id);
  }, []);

  const handleEditorContent = useCallback((html) => {
    if (!editorFileId) return;
    setTree((current) => updateNode(current, editorFileId, (node) => ({ ...node, content: html, updatedAt: nowIso() })));
  }, [editorFileId]);

  const handleEditorTitle = useCallback((name) => {
    if (!editorFileId) return;
    setTree((current) => updateNode(current, editorFileId, (node) => ({ ...node, name, updatedAt: nowIso() })));
  }, [editorFileId]);

  const renameIsFolder = renameTarget?.type === 'folder';

  return (
    <>
      <ScreenShell
        title="Notes"
        showPageHeader={false}
        refreshControl={(
          <RefreshControl
            tintColor={theme.colors.text}
            refreshing={refreshing}
            onRefresh={() => fetchTree({ silent: true })}
          />
        )}
        stickyHeader={(
          <View>
            <View style={styles.headerRow}>
              <View style={styles.counters}>
                <Text style={styles.counterPill}>{counts.folders} folders</Text>
                <Text style={styles.counterPill}>{counts.files} files</Text>
              </View>
              <View style={styles.headerActions}>
                <ActionButton label="Folder" variant="ghost" compact onPress={handleAddFolder} />
                <ActionButton label="File" compact onPress={handleAddFile} />
              </View>
            </View>
            <View style={styles.searchRow}>
              <Search color={theme.colors.muted} size={14} strokeWidth={1.7} />
              <TextInput
                placeholder="Search notes"
                placeholderTextColor={theme.colors.muted}
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
              />
            </View>
          </View>
        )}
      >
        {loading ? (
          <SectionCard><Text style={styles.mutedText}>Loading notes…</Text></SectionCard>
        ) : rows.length === 0 ? (
          <SectionCard>
            <Text style={styles.emptyTitle}>{query.trim() ? 'No matches' : 'No notes yet'}</Text>
            <Text style={styles.emptyBody}>
              {query.trim() ? 'Try a different search.' : 'Create a file or folder to start writing.'}
            </Text>
          </SectionCard>
        ) : (
          <View style={styles.tree}>
            {rows.map(({ node, depth }) => {
              const isFolder = node.type === 'folder';
              const isOpen = effectiveOpen.has(node.id);
              const isSelected = selectedId === node.id;

              return (
                <View
                  key={node.id}
                  style={[styles.treeRow, isSelected ? styles.treeRowActive : null, { paddingLeft: 10 + depth * 16 }]}
                >
                  <Pressable
                    style={styles.treeRowMain}
                    onPress={() => (isFolder ? toggleFolder(node.id) : openFile(node))}
                  >
                    {isFolder ? (
                      <ChevronRight
                        color={theme.colors.tertiary}
                        size={13}
                        strokeWidth={1.7}
                        style={isOpen ? styles.chevronOpen : null}
                      />
                    ) : (
                      <View style={styles.chevronSpacer} />
                    )}
                    <NodeIcon icon={node.icon} type={node.type} />
                    <Text numberOfLines={1} style={styles.treeLabel}>{node.name}</Text>
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    style={styles.treeAction}
                    onPress={() => { setRenameTarget(node); setRenameValue(node.name); }}
                  >
                    <Pencil color={theme.colors.tertiary} size={14} strokeWidth={1.6} />
                  </Pressable>
                  <Pressable hitSlop={8} style={styles.treeAction} onPress={() => setMoveTarget(node)}>
                    <FolderInput color={theme.colors.tertiary} size={14} strokeWidth={1.6} />
                  </Pressable>
                  <Pressable hitSlop={8} style={styles.treeAction} onPress={() => confirmDelete(node)}>
                    <Trash2 color={theme.colors.danger} size={14} strokeWidth={1.6} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScreenShell>

      <NoteEditorModal
        visible={Boolean(editorFile)}
        file={editorFile}
        onChangeContent={handleEditorContent}
        onChangeTitle={handleEditorTitle}
        onClose={() => setEditorFileId(null)}
      />

      <ModalSheet
        visible={Boolean(renameTarget)}
        title={renameIsFolder ? 'Folder' : 'File'}
        onClose={commitRename}
        footer={(
          <View style={styles.modalFooterEnd}>
            <ActionButton label="Done" icon="checkmark" onPress={commitRename} />
          </View>
        )}
      >
        <TextField
          label="Name"
          placeholder={renameIsFolder ? 'New folder' : 'Untitled note'}
          value={renameValue}
          onChangeText={setRenameValue}
        />
        <View style={styles.iconTabs}>
          <Pressable
            onPress={() => setIconTab('emoji')}
            style={[styles.iconTab, iconTab === 'emoji' ? styles.iconTabActive : null]}
          >
            <Text style={[styles.iconTabLabel, iconTab === 'emoji' ? styles.iconTabLabelActive : null]}>Emoji</Text>
          </Pressable>
          <Pressable
            onPress={() => setIconTab('icon')}
            style={[styles.iconTab, iconTab === 'icon' ? styles.iconTabActive : null]}
          >
            <Text style={[styles.iconTabLabel, iconTab === 'icon' ? styles.iconTabLabelActive : null]}>Icons</Text>
          </Pressable>
        </View>

        <View style={styles.emojiGrid}>
          <Pressable style={styles.emojiCell} onPress={() => setNodeEmoji(null)}>
            <NodeIcon icon={renameIsFolder ? DEFAULT_FOLDER_ICON : DEFAULT_FILE_ICON} type={renameTarget?.type} />
          </Pressable>
          {iconTab === 'emoji'
            ? EMOJI_OPTIONS.map((emoji) => (
              <Pressable key={emoji} style={styles.emojiCell} onPress={() => setNodeEmoji(emoji)}>
                <Text style={styles.emojiIcon}>{emoji}</Text>
              </Pressable>
            ))
            : ICON_OPTIONS.map((option) => {
              const Glyph = option.Icon;
              const active = renameTarget?.icon?.kind === 'icon' && renameTarget.icon.name === option.name;
              return (
                <Pressable
                  key={option.name}
                  style={[styles.emojiCell, active ? styles.emojiCellActive : null]}
                  onPress={() => setNodeIconName(option.name)}
                >
                  <Glyph color={theme.colors.secondary} size={16} strokeWidth={1.6} />
                </Pressable>
              );
            })}
        </View>
        <ColorField
          label="Icon Color"
          value={renameTarget?.icon?.color && renameTarget.icon.color !== DEFAULT_ICON_COLOR ? renameTarget.icon.color : ICON_COLOR_PRESETS[0]}
          onChange={setNodeIconColor}
          presetColors={ICON_COLOR_PRESETS}
        />
      </ModalSheet>

      <ModalSheet
        visible={Boolean(moveTarget)}
        title={`Organize "${moveTarget?.name || ''}"`}
        onClose={() => setMoveTarget(null)}
        stickyContent={(
          <>
            <Text style={styles.formSectionLabel}>Reorder</Text>
            <View style={styles.reorderRow}>
              <ActionButton label="Move Up" variant="ghost" compact onPress={() => handleReorder('up')} />
              <ActionButton label="Move Down" variant="ghost" compact onPress={() => handleReorder('down')} />
            </View>
            <Text style={styles.formSectionLabel}>Move to folder</Text>
          </>
        )}
      >
        {moveFolderOptions.map((option) => (
          <Pressable
            key={option.value || 'root'}
            style={styles.moveRow}
            onPress={() => handleMove(option.value)}
          >
            <Folder color={theme.colors.tertiary} size={14} strokeWidth={1.6} />
            <Text style={styles.moveRowLabel}>{option.label.trim() || 'Root'}</Text>
          </Pressable>
        ))}
      </ModalSheet>
    </>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  counters: {
    flexDirection: 'row',
    gap: 8,
  },
  counterPill: {
    color: theme.colors.tertiary,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    paddingVertical: 0,
    letterSpacing: 0.3,
  },
  tree: {
    gap: 2,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
    paddingVertical: 9,
  },
  treeRowActive: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  treeRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  chevronSpacer: {
    width: 13,
  },
  treeLabel: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  treeAction: {
    width: 30,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIcon: {
    fontSize: 15,
  },
  mutedText: {
    color: theme.colors.tertiary,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  emptyBody: {
    color: theme.colors.tertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  modalFooterEnd: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  formSectionLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiCell: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  emojiCellActive: {
    borderColor: theme.colors.text,
    backgroundColor: theme.colors.surfaceSoft,
  },
  iconTabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.borderDim,
  },
  iconTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  iconTabActive: {
    backgroundColor: theme.colors.surfaceSoft,
  },
  iconTabLabel: {
    color: theme.colors.tertiary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  iconTabLabelActive: {
    color: theme.colors.text,
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
  },
  moveRowLabel: {
    color: theme.colors.text,
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

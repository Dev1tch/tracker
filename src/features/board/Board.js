'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bold,
  Frame as FrameIcon,
  Image as ImageIcon,
  Italic,
  Layers,
  List,
  Maximize,
  MousePointer2,
  Trash2,
  Type,
  Underline,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';
import CustomSelect from '@/components/ui/CustomSelect';
import './Board.css';

const STORAGE_KEY = 'board.state';
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
const WHEEL_ZOOM_STEP = 1.04;
const MOUSE_WHEEL_ZOOM_STEP = 1.12;
const BUTTON_ZOOM_STEP = 1.1;
const ALIGN_GUIDE_TOLERANCE_PX = 6;
const ALIGN_GUIDE_PADDING = 28;
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const PASTED_TEXT_SCREEN_WIDTH = 420;
const DEFAULT_ARROW_STROKE_WIDTH = 1.6;
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

function loadState() {
  if (typeof window === 'undefined') {
    return { nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT };
    const parsed = JSON.parse(raw);
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      frames: Array.isArray(parsed.frames) ? parsed.frames : [],
      viewport: parsed.viewport && typeof parsed.viewport === 'object'
        ? { ...DEFAULT_VIEWPORT, ...parsed.viewport }
        : DEFAULT_VIEWPORT,
    };
  } catch {
    return { nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT };
  }
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

function restoreTextSelection() {
  const editing = document.querySelector('.boardTextNode.editing .boardTextContent');
  if (!editing) return false;
  editing.focus();
  if (savedTextSelection && editing.contains(savedTextSelection.commonAncestorContainer)) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedTextSelection);
  }
  return true;
}

function applyFontSizeToEditingText(size) {
  if (!restoreTextSelection()) return;
  const normalized = Math.max(8, Math.min(120, Math.round(size)));
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('fontSize', false, '7');
  document.querySelectorAll('.boardTextNode.editing font[size="7"]').forEach((font) => {
    font.removeAttribute('size');
    font.style.fontSize = `${normalized}px`;
  });
}

/* applyFontFamilyToEditingText removed: font family is now stored on the
   node (node.fontFamily) and applied as an inline style to the whole text,
   so we no longer need a per-selection execCommand path. */

/* ---------- Text node ---------- */
function TextNode({
  node,
  editing,
  selected,
  connected,
  tool,
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
        <div
          ref={ref}
          className="boardTextContent"
          contentEditable={editing}
          suppressContentEditableWarning
          onMouseDown={editing ? (e) => e.stopPropagation() : undefined}
          dangerouslySetInnerHTML={node.html ? { __html: node.html } : undefined}
        >
          {node.html ? null : node.content || ''}
        </div>
      )}
    </div>
  );
}

function ImageNode({
  node,
  selected,
  tool,
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

function getAnchor(node, bounds, side, offset) {
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

function pickSides(source, target, bounds) {
  const sc = nodeCenterOf(source, bounds);
  const tc = nodeCenterOf(target, bounds);
  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  }
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

function orthogonalPath(s, t, axis, r = 14) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  if (axis === 'horizontal') {
    if (Math.abs(dy) < 2 || Math.abs(dx) < 2) {
      return `M ${s.x},${s.y} L ${t.x},${t.y}`;
    }
    const midX = (s.x + t.x) / 2;
    const sx = Math.sign(midX - s.x) || 1;
    const sy = Math.sign(dy) || 1;
    const cR = Math.min(r, Math.abs(dx) / 2, Math.abs(dy) / 2);
    return [
      `M ${s.x},${s.y}`,
      `L ${midX - sx * cR},${s.y}`,
      `Q ${midX},${s.y} ${midX},${s.y + sy * cR}`,
      `L ${midX},${t.y - sy * cR}`,
      `Q ${midX},${t.y} ${midX + sx * cR},${t.y}`,
      `L ${t.x},${t.y}`,
    ].join(' ');
  }
  // vertical
  if (Math.abs(dx) < 2 || Math.abs(dy) < 2) {
    return `M ${s.x},${s.y} L ${t.x},${t.y}`;
  }
  const midY = (s.y + t.y) / 2;
  const sy = Math.sign(midY - s.y) || 1;
  const sx = Math.sign(dx) || 1;
  const cR = Math.min(r, Math.abs(dy) / 2, Math.abs(dx) / 2);
  return [
    `M ${s.x},${s.y}`,
    `L ${s.x},${midY - sy * cR}`,
    `Q ${s.x},${midY} ${s.x + sx * cR},${midY}`,
    `L ${t.x - sx * cR},${midY}`,
    `Q ${t.x},${midY} ${t.x},${midY + sy * cR}`,
    `L ${t.x},${t.y}`,
  ].join(' ');
}

function edgeMidpoint(s, t, axis) {
  // The "elbow" of the Z route — clicking here opens the delete affordance.
  if (axis === 'horizontal') {
    const midX = (s.x + t.x) / 2;
    return { x: midX, y: (s.y + t.y) / 2 };
  }
  const midY = (s.y + t.y) / 2;
  return { x: (s.x + t.x) / 2, y: midY };
}

function resolveEdgePoints(edge, nodeById, bounds) {
  const source = edge.from ? nodeById.get(edge.from) : null;
  const target = edge.to ? nodeById.get(edge.to) : null;
  let s;
  let t;
  let axis;

  if (source && target) {
    const [sSide, tSide] = pickSides(source, target, bounds);
    s = getAnchor(source, bounds, sSide, 0);
    t = getAnchor(target, bounds, tSide, 6);
    axis = sSide === 'right' || sSide === 'left' ? 'horizontal' : 'vertical';
    return { s, t, axis };
  }

  if (source && edge.end) {
    const sc = nodeCenterOf(source, bounds);
    const dx = edge.end.x - sc.x;
    const dy = edge.end.y - sc.y;
    const side =
      Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0 ? 'right' : 'left'
        : dy >= 0 ? 'bottom' : 'top';
    s = getAnchor(source, bounds, side, 0);
    t = edge.end;
    axis = side === 'right' || side === 'left' ? 'horizontal' : 'vertical';
    return { s, t, axis };
  }

  if (edge.start && target) {
    const tc = nodeCenterOf(target, bounds);
    const dx = tc.x - edge.start.x;
    const dy = tc.y - edge.start.y;
    const side =
      Math.abs(dx) >= Math.abs(dy)
        ? dx >= 0 ? 'left' : 'right'
        : dy >= 0 ? 'top' : 'bottom';
    s = edge.start;
    t = getAnchor(target, bounds, side, 6);
    axis = side === 'left' || side === 'right' ? 'horizontal' : 'vertical';
    return { s, t, axis };
  }

  if (edge.start && edge.end) {
    s = edge.start;
    t = edge.end;
    axis = Math.abs(t.x - s.x) >= Math.abs(t.y - s.y) ? 'horizontal' : 'vertical';
    return { s, t, axis };
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
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
        <marker
          id="boardArrowHeadGhost"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-tertiary)" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const points = resolveEdgePoints(edge, itemById, bounds);
        if (!points) return null;
        const { s, t, axis } = points;
        const d = orthogonalPath(s, t, axis);
        const isSelected = selectedEdgeId === edge.id;
        const mid = edgeMidpoint(s, t, axis);
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
          ? { from: arrowSource, end: mousePos }
          : { start: arrowPointSource, end: mousePos };
        const points = resolveEdgePoints(ghostEdge, itemById, bounds);
        if (!points) return null;
        const d = orthogonalPath(points.s, points.t, points.axis);
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
  const [arrowSource, setArrowSource] = useState(null);
  const [arrowPointSource, setArrowPointSource] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [nodeBounds, setNodeBounds] = useState({});
  const [isPanning, setIsPanning] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState({ vertical: [], horizontal: [] });
  const [fontOptions, setFontOptions] = useState(TEXT_FONT_OPTIONS);
  const [textToolbarFont, setTextToolbarFont] = useState(TEXT_FONT_OPTIONS[0].value);

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

  /* Persist */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ nodes, edges, frames, viewport })
      );
    } catch {
      /* private mode / quota — ignore */
    }
  }, [nodes, edges, frames, viewport]);

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
          target.closest('.customSelectList') ||
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
    setArrowSource((cur) => (cur === id ? null : cur));
  }, []);

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
    setArrowSource((cur) => (cur === id ? null : cur));
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
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (editing.contains(range.commonAncestorContainer)) {
        savedTextSelection = range.cloneRange();
      }
    }
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);
  }, [editingId]);

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

  const addPastedTextNode = useCallback((text, worldX, worldY, fontSize = 16, width) => {
    const content = (text || '').replace(/\r\n?/g, '\n').trim();
    if (!content) return;
    const id = generateId();
    const href = normalizeUrl(content);
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
        const reader = new FileReader();
        reader.onload = () => addImageNode(reader.result, center.x, center.y);
        reader.readAsDataURL(file);
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
  }, [addImageNode, addPastedTextNode, screenToWorld, viewport.zoom]);

  function commitText(id, text, html = '') {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      removeNode(id);
    } else {
      const href = normalizeUrl(trimmed);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, content: text, html: href ? undefined : html || undefined, href: href || undefined }
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
        prev.map((n) => (n.id === node.id ? { ...n, ...finalNext } : n))
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
    // Only react when the surface itself is the event target — not a node.
    if (e.target !== e.currentTarget) return;
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
          setEdges((prev) => [
            ...prev,
            { id: generateId(), from: arrowSource, end: w },
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
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /* ---------- frame interactions ---------- */

  function handleFrameClick(e, frame) {
    e.stopPropagation();
    if (editingFrameId === frame.id) return;
    if (tool === 'arrow') {
      if (arrowPointSource) {
        const id = generateId();
        setEdges((prev) => [
          ...prev,
          { id, start: arrowPointSource, to: frame.id },
        ]);
        setArrowSource(null);
        setArrowPointSource(null);
        setMousePos(null);
        selectEdge(id);
      } else if (!arrowSource) {
        setArrowSource(frame.id);
        setArrowPointSource(null);
        selectFrame(frame.id);
      } else if (arrowSource !== frame.id) {
        const exists = edges.some(
          (ed) => ed.from === arrowSource && ed.to === frame.id
        );
        let id = null;
        if (!exists) {
          id = generateId();
          setEdges((prev) => [
            ...prev,
            { id, from: arrowSource, to: frame.id },
          ]);
        }
        setArrowSource(null);
        setArrowPointSource(null);
        setMousePos(null);
        if (id) {
          selectEdge(id);
        } else {
          selectFrame(frame.id);
        }
      }
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
    const reader = new FileReader();
    reader.onload = () => addImageNode(reader.result, w.x, w.y);
    reader.readAsDataURL(file);
  }

  /* ---------- node interactions ---------- */

  function handleNodeClick(e, node) {
    e.stopPropagation();
    if (editingId === node.id) return;
    setSelectedEdgeId(null);
    if (tool === 'arrow') {
      if (arrowPointSource) {
        const id = generateId();
        setEdges((prev) => [
          ...prev,
          { id, start: arrowPointSource, to: node.id },
        ]);
        setArrowSource(null);
        setArrowPointSource(null);
        setMousePos(null);
        selectEdge(id);
      } else if (!arrowSource) {
        setArrowSource(node.id);
        setArrowPointSource(null);
        selectNode(node.id);
      } else if (arrowSource !== node.id) {
        const exists = edges.some(
          (ed) => ed.from === arrowSource && ed.to === node.id
        );
        let id = null;
        if (!exists) {
          id = generateId();
          setEdges((prev) => [
            ...prev,
            { id, from: arrowSource, to: node.id },
          ]);
        }
        setArrowSource(null);
        setArrowPointSource(null);
        setMousePos(null);
        if (id) {
          selectEdge(id);
        } else {
          selectNode(node.id);
        }
      }
      return;
    }
    if (tool === 'select') {
      selectNode(node.id);
    }
  }

  function handleNodeMouseDown(e, node) {
    if (tool !== 'select' || editingId === node.id) return;
    e.stopPropagation();
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
    const reader = new FileReader();
    reader.onload = () => addImageNode(reader.result, center.x, center.y);
    reader.readAsDataURL(file);
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
            title="Frame — drag a rectangle to group items"
            aria-label="Frame"
          >
            <FrameIcon size={18} />
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
            className="boardToolBtn danger"
            onClick={removeSelected}
            disabled={!selectedId && !selectedEdgeId && !selectedFrameId}
            title="Delete selected (Del)"
            aria-label="Delete selected"
          >
            <Trash2 size={18} />
          </button>
        </aside>

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

        {(() => {
          /* Frame popout: shows whenever a frame is selected OR being named.
             Houses the frame's color picker so the user can pick a custom
             colour, plus a hint to rename via the label. */
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
            {frames.map((frame) => (
              <FrameNode
                key={frame.id}
                frame={frame}
                selected={selectedFrameId === frame.id}
                editing={editingFrameId === frame.id}
                zoom={viewport.zoom}
                onClick={(e) => handleFrameClick(e, frame)}
                onMouseDown={(e) => handleFrameMouseDown(e, frame)}
                onLabelDoubleClick={() => handleFrameLabelDoubleClick(frame.id)}
                onLabelCommit={(name) => handleFrameLabelCommit(frame.id, name)}
              />
            ))}

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
              const fontSize = Math.round(node.fontSize || 16);
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
                      value={node.fontFamily || textToolbarFont}
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

            {nodes.map((node) =>
              node.type === 'text' ? (
                <TextNode
                  key={node.id}
                  node={node}
                  editing={editingId === node.id}
                  selected={selectedId === node.id || arrowSource === node.id}
                  connected={edges.some((edge) => edge.from === node.id || edge.to === node.id)}
                  tool={tool}
                  registerRef={registerNodeRef}
                  onDoubleClick={handleNodeDoubleClick}
                  onClick={(e) => handleNodeClick(e, node)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                />
              ) : (
                <ImageNode
                  key={node.id}
                  node={node}
                  selected={selectedId === node.id || arrowSource === node.id}
                  tool={tool}
                  registerRef={registerNodeRef}
                  onClick={(e) => handleNodeClick(e, node)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                />
              )
            )}

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
    </div>
  );
}

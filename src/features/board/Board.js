'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  Image as ImageIcon,
  Maximize,
  MousePointer2,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import ColorPicker from '@/components/ui/ColorPicker';
import './Board.css';

const STORAGE_KEY = 'board.state';
const MAX_IMAGE_WIDTH = 320;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const MIN_NODE_SIZE = 30;
const BOARD_HISTORY_LIMIT = 80;
const WHEEL_ZOOM_STEP = 1.04;
const MOUSE_WHEEL_ZOOM_STEP = 1.12;
const BUTTON_ZOOM_STEP = 1.1;
const ALIGN_GUIDE_TOLERANCE_PX = 6;
const ALIGN_GUIDE_PADDING = 28;
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

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
    return { nodes: [], edges: [], viewport: DEFAULT_VIEWPORT };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: [], edges: [], viewport: DEFAULT_VIEWPORT };
    const parsed = JSON.parse(raw);
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      viewport: parsed.viewport && typeof parsed.viewport === 'object'
        ? { ...DEFAULT_VIEWPORT, ...parsed.viewport }
        : DEFAULT_VIEWPORT,
    };
  } catch {
    return { nodes: [], edges: [], viewport: DEFAULT_VIEWPORT };
  }
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
    if (!editing && el.textContent !== (node.content || '')) {
      el.textContent = node.content || '';
    }
  }, [node.content, editing]);

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
        color: node.color || undefined,
        lineHeight: 1.3,
        transform: nodeTransform(node),
        transformOrigin: 'center',
      }}
      ref={(el) => registerRef(node.id, el)}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={() => onDoubleClick(node.id)}
    >
      <div
        ref={ref}
        className="boardTextContent"
        contentEditable={editing}
        suppressContentEditableWarning
        onMouseDown={editing ? (e) => e.stopPropagation() : undefined}
      >
        {node.content || ''}
      </div>
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
        [
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
        [
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

function getResizeAlignment(node, next, handleId, nodes, bounds, tolerance) {
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
      snapped.x = Math.min(vertical.x, right - MIN_NODE_SIZE);
      snapped.w = right - snapped.x;
    } else if (vertical.kind === 'right') {
      snapped.w = Math.max(MIN_NODE_SIZE, vertical.x - next.x);
    } else if (vertical.kind === 'center') {
      if (dir.sx < 0) {
        snapped.x = Math.min(2 * vertical.x - right, right - MIN_NODE_SIZE);
        snapped.w = right - snapped.x;
      } else if (dir.sx > 0) {
        snapped.w = Math.max(MIN_NODE_SIZE, 2 * (vertical.x - next.x));
      }
    }
  }
  if (horizontal) {
    const bottom = next.y + next.h;
    if (horizontal.kind === 'top') {
      snapped.y = Math.min(horizontal.y, bottom - MIN_NODE_SIZE);
      snapped.h = bottom - snapped.y;
    } else if (horizontal.kind === 'bottom') {
      snapped.h = Math.max(MIN_NODE_SIZE, horizontal.y - next.y);
    } else if (horizontal.kind === 'middle') {
      if (dir.sy < 0) {
        snapped.y = Math.min(2 * horizontal.y - bottom, bottom - MIN_NODE_SIZE);
        snapped.h = bottom - snapped.y;
      } else if (dir.sy > 0) {
        snapped.h = Math.max(MIN_NODE_SIZE, 2 * (horizontal.y - next.y));
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

/* ---------- Arrows layer (SVG over the world) ---------- */
function ArrowsLayer({
  nodes,
  edges,
  bounds,
  arrowSource,
  mousePos,
  selectedEdgeId,
  onSelectEdge,
  onRemoveEdge,
}) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg className="boardArrows" width="1" height="1" overflow="visible">
      <defs>
        <marker
          id="boardArrowHead"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" />
        </marker>
        <marker
          id="boardArrowHeadGhost"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L8,3 L0,6 Z" fill="var(--text-tertiary)" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const source = nodeById.get(edge.from);
        const target = nodeById.get(edge.to);
        if (!source || !target) return null;
        const [sSide, tSide] = pickSides(source, target, bounds);
        const s = getAnchor(source, bounds, sSide, 0);
        const t = getAnchor(target, bounds, tSide, 6);
        const axis = sSide === 'right' || sSide === 'left' ? 'horizontal' : 'vertical';
        const d = orthogonalPath(s, t, axis);
        const isSelected = selectedEdgeId === edge.id;
        const mid = edgeMidpoint(s, t, axis);
        return (
          <g key={edge.id}>
            {/* Wide invisible hit area so the line is easy to click. */}
            <path
              d={d}
              className="boardArrowHit"
              onClick={(e) => {
                e.stopPropagation();
                onSelectEdge(edge.id);
              }}
            />
            <path
              d={d}
              className={`boardArrowLine ${isSelected ? 'selected' : ''}`}
              markerEnd="url(#boardArrowHead)"
            />
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
                  r="11"
                  className="boardArrowDeleteCircle"
                />
                <path
                  d={`M ${mid.x - 3.5},${mid.y - 3.5} L ${mid.x + 3.5},${mid.y + 3.5} M ${mid.x + 3.5},${mid.y - 3.5} L ${mid.x - 3.5},${mid.y + 3.5}`}
                  className="boardArrowDeleteX"
                />
              </g>
            )}
          </g>
        );
      })}

      {arrowSource && mousePos && (() => {
        const source = nodeById.get(arrowSource);
        if (!source) return null;
        const sCenter = nodeCenterOf(source, bounds);
        const dx = mousePos.x - sCenter.x;
        const dy = mousePos.y - sCenter.y;
        const side =
          Math.abs(dx) >= Math.abs(dy)
            ? dx >= 0 ? 'right' : 'left'
            : dy >= 0 ? 'bottom' : 'top';
        const sAnchor = getAnchor(source, bounds, side, 0);
        const axis = side === 'right' || side === 'left' ? 'horizontal' : 'vertical';
        const d = orthogonalPath(sAnchor, mousePos, axis);
        return (
          <path
            d={d}
            className="boardArrowGhost"
            markerEnd="url(#boardArrowHeadGhost)"
          />
        );
      })()}
    </svg>
  );
}

/* ============================ Main ============================ */
export default function Board() {
  const initial = loadState();
  const [nodes, setNodes] = useState(initial.nodes);
  const [edges, setEdges] = useState(initial.edges);
  const [viewport, setViewport] = useState(initial.viewport);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [arrowSource, setArrowSource] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [nodeBounds, setNodeBounds] = useState({});
  const [isPanning, setIsPanning] = useState(false);
  const [alignmentGuides, setAlignmentGuides] = useState({ vertical: [], horizontal: [] });

  const wrapperRef = useRef(null);
  const surfaceRef = useRef(null);
  const fileInputRef = useRef(null);
  const nodeElRefs = useRef({});
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const restoringHistoryRef = useRef(false);
  const lastBoardStateRef = useRef(serializeBoardState(initial.nodes, initial.edges));

  /* Persist */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ nodes, edges, viewport })
      );
    } catch {
      /* private mode / quota — ignore */
    }
  }, [nodes, edges, viewport]);

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
    if (!arrowSource) return undefined;
    function handleMove(e) {
      setMousePos(screenToWorld(e.clientX, e.clientY));
    }
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, [arrowSource, screenToWorld]);

  const selectNode = useCallback((id) => {
    setSelectedId(id);
    setSelectedEdgeId(null);
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

  const selectEdge = useCallback((id) => {
    setSelectedEdgeId(id);
    setSelectedId(null);
  }, []);

  /* Read the current DOM-side content of the editing text node. We don't
     mirror keystrokes into React state (avoids cursor jumps on
     contentEditable), so the source of truth during editing is the DOM. */
  const readEditingText = useCallback(() => {
    const el = document.querySelector('.boardTextNode.editing .boardTextContent');
    return readEditablePlainText(el);
  }, []);

  const restoreBoardState = useCallback((state) => {
    restoringHistoryRef.current = true;
    setNodes(Array.isArray(state.nodes) ? state.nodes : []);
    setEdges(Array.isArray(state.edges) ? state.edges : []);
    setSelectedId(null);
    setSelectedEdgeId(null);
    setEditingId(null);
    setArrowSource(null);
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
          commitText(editingId, readEditingText());
          return;
        }
        setArrowSource(null);
        setSelectedId(null);
        setSelectedEdgeId(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !editingId) {
        if (isTextInputTarget(e.target)) {
          return;
        }
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId);
        } else if (selectedId) {
          removeNode(selectedId);
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedEdgeId, editingId, removeNode, removeEdge, readEditingText, undoBoard, redoBoard]);

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
          t.closest('.boardToolbarPopout') ||
          t.closest('.salColorPickerWrap') ||
          t.closest('.salColorPickerPopover'))
      ) {
        return;
      }
      commitText(editingId, readEditingText());
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, readEditingText]);

  const registerNodeRef = useCallback((id, el) => {
    if (el) nodeElRefs.current[id] = el;
    else delete nodeElRefs.current[id];
  }, []);

  /* Switching tools cancels any in-progress arrow. */
  const selectTool = useCallback((next) => {
    setTool(next);
    setArrowSource(null);
  }, []);

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

  function setTextFontSize(id, value) {
    const v = Math.max(8, Math.min(120, Math.round(value)));
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id && n.type === 'text' ? { ...n, fontSize: v } : n
      )
    );
  }

  function changeTextColor(id, color) {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id && n.type === 'text' ? { ...n, color } : n
      )
    );
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
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;
      const wrap = wrapperRef.current;
      if (!wrap) return;

      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const center = screenToWorld(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      const reader = new FileReader();
      reader.onload = () => addImageNode(reader.result, center.x, center.y);
      reader.readAsDataURL(file);
    }

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addImageNode, screenToWorld]);

  function commitText(id, text) {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      removeNode(id);
    } else {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, content: text } : n))
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
    if (editingId) return;
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
      if (tool === 'text') {
        const w = screenToWorld(ev.clientX, ev.clientY);
        addTextNode(w.x, w.y);
      } else if (tool === 'arrow') {
        setArrowSource(null);
      } else {
        setSelectedId(null);
      }
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
      if (!arrowSource) {
        setArrowSource(node.id);
        selectNode(node.id);
      } else if (arrowSource !== node.id) {
        const exists = edges.some(
          (ed) => ed.from === arrowSource && ed.to === node.id
        );
        if (!exists) {
          setEdges((prev) => [
            ...prev,
            { id: generateId(), from: arrowSource, to: node.id },
          ]);
        }
        setArrowSource(node.id);
        selectNode(node.id);
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
            disabled={!selectedId && !selectedEdgeId}
            title="Delete selected (Del)"
            aria-label="Delete selected"
          >
            <Trash2 size={18} />
          </button>
        </aside>

        {(() => {
          if (!editingId) return null;
          const node = nodes.find((n) => n.id === editingId);
          if (!node || node.type !== 'text') return null;
          const fontSize = Math.round(node.fontSize || 16);
          return (
            <div className="boardToolbarPopout" aria-label="Text formatting">
              <input
                type="number"
                className="boardPopoutSize"
                min={8}
                max={120}
                value={fontSize}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) setTextFontSize(editingId, v);
                }}
                aria-label="Font size"
              />
              <span className="boardPopoutDivider" aria-hidden="true" />
              <ColorPicker
                value={node.color || '#ffffff'}
                onChange={(c) => changeTextColor(editingId, c)}
              />
            </div>
          );
        })()}
       </div>

        <div
          ref={wrapperRef}
          className={`boardWrapper boardCursor-${tool}${
            isPanning ? ' isPanning' : ''
          }${arrowSource ? ' boardArrowDrawing' : ''}`}
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
            <ArrowsLayer
              nodes={nodes}
              edges={edges}
              bounds={nodeBounds}
              arrowSource={arrowSource}
              mousePos={mousePos}
              selectedEdgeId={selectedEdgeId}
              onSelectEdge={selectEdge}
              onRemoveEdge={removeEdge}
            />
            {(() => {
              const selected = selectedId
                ? nodes.find((n) => n.id === selectedId)
                : null;
              if (!selected || editingId === selected.id) return null;
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

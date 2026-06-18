import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Bold,
  Brush,
  Eraser,
  Frame as FrameIcon,
  ImagePlus,
  Italic,
  Lock,
  LogOut,
  Maximize2,
  Minus,
  MousePointer2,
  Pen,
  Pencil,
  PencilLine,
  Pipette,
  Plus,
  Redo2,
  Trash2,
  Type,
  Underline,
  Undo2,
  Unlock,
} from 'lucide-react-native';

import ActionButton from '../../components/ActionButton';
import BrandMark from '../../components/BrandMark';
import ThemeSwitcher from '../../components/ThemeSwitcher';
import ColorPickerSheet from '../../components/ColorPickerSheet';
import LoadingScreen from '../../components/LoadingScreen';
import ModalSheet from '../../components/ModalSheet';
import TextField from '../../components/TextField';
import { boardApi, mediaApi } from '../../shared/api';
import { useTheme } from '../../theme';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../../providers/ToastProvider';
import { useDialog } from '../../providers/DialogProvider';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };
const TEXT_NODE = { w: 200, h: 90 };
const IMAGE_NODE = { w: 240, h: 180 };
const MIN_NODE_SIZE = 40;
const MIN_FRAME_SIZE = 80;
const GRID = 40;
const HISTORY_LIMIT = 60;

const FONT_SIZES = [12, 14, 16, 18, 22, 28, 36, 48];
const PALETTE = ['#ffffff', '#cbd5e1', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185', '#2dd4bf', '#f97316', '#e879f9', '#0f172a'];
const FRAME_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185', '#2dd4bf', '#f97316'];
const DRAWING_DEFAULTS = {
  pen: { color: '#ffffff', thickness: 2.5 },
  pencil: { color: '#cbd5e1', thickness: 1.4 },
  brush: { color: '#60a5fa', thickness: 8 },
  eraser: { thickness: 18 },
};

function clampW(value, min, max) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function makeId(prefix) {
  const rand = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').trim();
}

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex || `rgba(255,255,255,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function nodeSize(node) {
  if (node.type === 'image') return { w: node.w || IMAGE_NODE.w, h: node.h || IMAGE_NODE.h };
  if (node.type === 'drawing') return { w: node.w || 0, h: node.h || 0 };
  return { w: node.w || TEXT_NODE.w, h: node.h || TEXT_NODE.h };
}

function nodeCenter(node) {
  const { w, h } = nodeSize(node);
  return { x: node.x + w / 2, y: node.y + h / 2 };
}

// ---- Frame grouping (matches the web: membership is derived from whether an
// item's centre falls inside the frame rect; nesting is resolved recursively) ----
function pointInFrame(cx, cy, frame) {
  return cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h;
}

function framesInsideFrame(frame, frames) {
  return frames.filter((f) => f.id !== frame.id && pointInFrame(f.x + f.w / 2, f.y + f.h / 2, frame));
}

function collectNestedFrameIds(seedIds, frames) {
  const collected = new Set(seedIds);
  let changed = true;
  while (changed) {
    changed = false;
    frames.forEach((frame) => {
      if (!collected.has(frame.id)) return;
      framesInsideFrame(frame, frames).forEach((child) => {
        if (!collected.has(child.id)) { collected.add(child.id); changed = true; }
      });
    });
  }
  return collected;
}

// 8 resize handles: corners + edge midpoints. sx/sy say which edges move.
const RESIZE_HANDLES = [
  { sx: -1, sy: -1 }, { sx: 0, sy: -1 }, { sx: 1, sy: -1 },
  { sx: -1, sy: 0 }, { sx: 1, sy: 0 },
  { sx: -1, sy: 1 }, { sx: 0, sy: 1 }, { sx: 1, sy: 1 },
];

// Free resize of a rect from the (sx,sy) handle; the opposite edge stays fixed.
function resizeRect(start, sx, sy, dx, dy, minW, minH) {
  let x = start.x; let y = start.y; let w = start.w; let h = start.h;
  if (sx === 1) { w = Math.max(start.w + dx, minW); }
  else if (sx === -1) { const right = start.x + start.w; w = Math.max(start.w - dx, minW); x = right - w; }
  if (sy === 1) { h = Math.max(start.h + dy, minH); }
  else if (sy === -1) { const bottom = start.y + start.h; h = Math.max(start.h - dy, minH); y = bottom - h; }
  return { x, y, w, h };
}

// Uniform scale factor + anchor for a handle drag (used by locked-frame resize).
function scaleFromHandle(start, sx, sy, dx, dy, minSize) {
  const ratios = [];
  if (sx !== 0) ratios.push((start.w + sx * dx) / start.w);
  if (sy !== 0) ratios.push((start.h + sy * dy) / start.h);
  let s = ratios.length ? ratios.reduce((best, r) => (Math.abs(r - 1) > Math.abs(best - 1) ? r : best), ratios[0]) : 1;
  const minS = minSize / Math.min(start.w, start.h);
  return Math.max(s, minS, 0.05);
}

function anchorFromHandle(start, sx, sy) {
  return {
    x: sx === 1 ? start.x : sx === -1 ? start.x + start.w : start.x + start.w / 2,
    y: sy === 1 ? start.y : sy === -1 ? start.y + start.h : start.y + start.h / 2,
  };
}

// Scale a node about an anchor by factor s (position, size, font, drawing points).
function scaleNodeBy(node, anchorX, anchorY, s) {
  const out = {
    ...node,
    x: anchorX + (node.x - anchorX) * s,
    y: anchorY + (node.y - anchorY) * s,
  };
  if (Number.isFinite(node.w)) out.w = node.w * s;
  if (Number.isFinite(node.h)) out.h = node.h * s;
  if (node.type === 'text' && Number.isFinite(node.fontSize)) {
    out.fontSize = Math.max(8, Math.min(120, node.fontSize * s));
  }
  if (node.type === 'drawing' && Array.isArray(node.points)) {
    out.points = node.points.map((p) => ({ x: p.x * s, y: p.y * s }));
  }
  return out;
}


function contentBounds(board) {
  const rects = [];
  (board.nodes || []).forEach((n) => { const { w, h } = nodeSize(n); rects.push({ x: n.x, y: n.y, w, h }); });
  (board.frames || []).forEach((f) => rects.push({ x: f.x, y: f.y, w: f.w, h: f.h }));
  if (rects.length === 0) return null;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  rects.forEach((r) => { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); });
  return { minX, minY, maxX, maxY };
}

// Partial eraser (ported from the web Board): clip each stroke segment at the
// eraser circle's boundary, keeping only the parts OUTSIDE the circle, then
// regroup the surviving pieces into runs. The erased gap matches the circle
// exactly instead of removing whole points.
function interpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pointsAlmostEqual(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.001;
}

function clipSegmentOutsideCircle(a, b, center, radius) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const fx = a.x - center.x;
  const fy = a.y - center.y;
  const A = dx * dx + dy * dy;
  if (A === 0) {
    return Math.hypot(a.x - center.x, a.y - center.y) <= radius ? [] : [[a, b]];
  }
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - radius * radius;
  const disc = B * B - 4 * A * C;
  const startInside = C <= 0;
  const endInside = Math.hypot(b.x - center.x, b.y - center.y) <= radius;
  if (disc <= 0) {
    return startInside && endInside ? [] : [[a, b]];
  }
  const sq = Math.sqrt(disc);
  const t1 = (-B - sq) / (2 * A);
  const t2 = (-B + sq) / (2 * A);
  const enter = Math.max(0, Math.min(t1, t2));
  const exit = Math.min(1, Math.max(t1, t2));
  if (exit <= 0 || enter >= 1) {
    return startInside && endInside ? [] : [[a, b]];
  }
  const pieces = [];
  if (enter > 0) pieces.push([a, interpPoint(a, b, enter)]);
  if (exit < 1) pieces.push([interpPoint(a, b, exit), b]);
  return pieces.filter(([s, e]) => Math.hypot(e.x - s.x, e.y - s.y) >= 0.1);
}

function buildStrokeNode(sourceNode, worldPoints, id) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  worldPoints.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  return {
    ...sourceNode,
    id,
    x: minX, y: minY, w: maxX - minX, h: maxY - minY,
    points: worldPoints.map((p) => ({ x: p.x - minX, y: p.y - minY })),
  };
}

function eraseFromStroke(node, wx, wy, radius) {
  const src = Array.isArray(node.points) ? node.points : [];
  if (node.type !== 'drawing' || src.length < 2) return [node];
  // Fast reject: eraser circle nowhere near this stroke's bounding box.
  const nw = node.w || 0; const nh = node.h || 0;
  if (wx < node.x - radius || wx > node.x + nw + radius || wy < node.y - radius || wy > node.y + nh + radius) {
    return [node];
  }
  const center = { x: wx, y: wy };
  const points = src.map((p) => ({ x: node.x + p.x, y: node.y + p.y }));
  const keptRuns = [];
  let cur = [];
  let clipped = false;
  const finishRun = () => { if (cur.length >= 2) keptRuns.push(cur); cur = []; };
  const appendPiece = (start, end) => {
    if (cur.length === 0) { cur = [start, end]; return; }
    const last = cur[cur.length - 1];
    if (!pointsAlmostEqual(last, start)) { finishRun(); cur = [start, end]; return; }
    if (!pointsAlmostEqual(last, end)) cur.push(end);
  };
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const point = points[i];
    const pieces = clipSegmentOutsideCircle(prev, point, center, radius);
    if (pieces.length !== 1 || !pointsAlmostEqual(pieces[0][0], prev) || !pointsAlmostEqual(pieces[0][1], point)) {
      clipped = true;
    }
    if (pieces.length === 0) { if (cur.length >= 2) keptRuns.push(cur); cur = []; continue; }
    pieces.forEach((piece, pieceIndex) => {
      if (pieceIndex > 0) finishRun();
      appendPiece(piece[0], piece[1]);
    });
  }
  finishRun();
  if (!clipped) return [node];
  return keptRuns.map((run, i) => buildStrokeNode(node, run, i === 0 ? node.id : makeId('draw')));
}

// Static dot backdrop sized to the visible canvas. Kept small (viewport-sized,
// not a giant world-sized SVG) so it never exceeds Android's max GPU texture
// size — a huge SVG was crashing the board on Android.
function GridLayer({ width, height, color }) {
  if (!width || !height) return null;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <Pattern id="boardDots" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <Circle cx={1} cy={1} r={1} fill={color} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#boardDots)" />
    </Svg>
  );
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ---- Arrows / connectors. Rendered with Views (react-native-svg does not
// update dynamically here). An edge connects node→node, node→point, point→node
// or point→point: `from`/`to` are node ids, `start`/`end` are free world points.

// Where a connector leaves/enters a node: the centre of the side that faces the
// other end (so the line exits perpendicular to the border).
function nodeSideExit(node, tx, ty) {
  const { w, h } = nodeSize(node);
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (Math.abs(dx) * h >= Math.abs(dy) * w) {
    return { x: cx + (dx >= 0 ? w / 2 : -w / 2), y: cy, side: dx >= 0 ? 'right' : 'left' };
  }
  return { x: cx, y: cy + (dy >= 0 ? h / 2 : -h / 2), side: dy >= 0 ? 'bottom' : 'top' };
}

function resolveEdgeEnds(edge, nodeById) {
  const fromNode = edge.from ? nodeById.get(edge.from) : null;
  const toNode = edge.to ? nodeById.get(edge.to) : null;
  const fromRef = fromNode ? nodeCenter(fromNode) : edge.start;
  const toRef = toNode ? nodeCenter(toNode) : edge.end;
  if (!fromRef || !toRef) return null;
  const s = fromNode ? nodeSideExit(fromNode, toRef.x, toRef.y) : { x: edge.start.x, y: edge.start.y, side: null };
  const e = toNode ? nodeSideExit(toNode, fromRef.x, fromRef.y) : { x: edge.end.x, y: edge.end.y, side: null };
  return { start: { x: s.x, y: s.y }, startSide: s.side, end: { x: e.x, y: e.y }, endSide: e.side };
}

function leavesHorizontally(side, from, toward) {
  if (side === 'left' || side === 'right') return true;
  if (side === 'top' || side === 'bottom') return false;
  return Math.abs(toward.x - from.x) >= Math.abs(toward.y - from.y);
}

// Orthogonal (90°) route between the two ends, honoring each node side so the
// first/last segment is perpendicular to its border. Matches the web design.
function routeEdge(ends) {
  const { start: s, startSide, end: e, endSide } = ends;
  const firstH = leavesHorizontally(startSide, s, e);
  const lastH = leavesHorizontally(endSide, e, s);
  if (firstH && lastH) {
    const midX = (s.x + e.x) / 2;
    return [s, { x: midX, y: s.y }, { x: midX, y: e.y }, e];
  }
  if (!firstH && !lastH) {
    const midY = (s.y + e.y) / 2;
    return [s, { x: s.x, y: midY }, { x: e.x, y: midY }, e];
  }
  if (firstH && !lastH) return [s, { x: e.x, y: s.y }, e];
  return [s, { x: s.x, y: e.y }, e];
}

function edgePolyline(edge, nodeById) {
  const ends = resolveEdgeEnds(edge, nodeById);
  return ends ? routeEdge(ends) : null;
}

// One straight, rounded bar between two world points (used for the line + head).
function segView(ax, ay, bx, by, thickness, color, key) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.3) return null;
  return (
    <View
      key={key}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: ax,
        top: ay - thickness / 2,
        width: len + thickness, // overlap neighbours so elbows join cleanly
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transformOrigin: '0% 50%',
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  );
}

function ArrowShape({ points, color, strokeWidth, selected }) {
  const theme = useTheme();
  if (!points || points.length < 2) return null;
  const c = selected ? theme.colors.info : color;
  const sw = (selected ? strokeWidth + 1 : strokeWidth) || 1.8;
  const segs = [];
  for (let i = 1; i < points.length; i += 1) {
    segs.push(segView(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, sw, c, `s${i}`));
  }
  const a = points[points.length - 2];
  const b = points[points.length - 1];
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const headLen = Math.max(11, sw * 4);
  const spread = 0.5;
  const back = dir + Math.PI;
  const wingA = { x: b.x + headLen * Math.cos(back - spread), y: b.y + headLen * Math.sin(back - spread) };
  const wingB = { x: b.x + headLen * Math.cos(back + spread), y: b.y + headLen * Math.sin(back + spread) };
  return (
    <>
      {segs}
      {segView(b.x, b.y, wingA.x, wingA.y, sw, c, 'ha')}
      {segView(b.x, b.y, wingB.x, wingB.y, sw, c, 'hb')}
    </>
  );
}

function EdgesLayer({ edges, nodeById, selectedEdgeId }) {
  return (
    <>
      {edges.map((edge) => {
        const pts = edgePolyline(edge, nodeById);
        if (!pts) return null;
        return (
          <ArrowShape
            key={edge.id}
            points={pts}
            color="rgba(255,255,255,0.85)"
            strokeWidth={edge.strokeWidth || 1.8}
            selected={selectedEdgeId === edge.id}
          />
        );
      })}
    </>
  );
}

// Catmull-Rom spline through the control points, adaptively subdivided so that
// long segments (created by fast finger drags) are filled with a smooth curve
// instead of a straight chord. Returns a denser point list.
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function smoothStroke(points) {
  if (!points || points.length < 3) return points || [];
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(1, Math.min(24, Math.round(len / 6)));
    for (let s = 1; s <= steps; s += 1) out.push(catmullRom(p0, p1, p2, p3, s / steps));
  }
  return out;
}

// A freehand stroke rendered as a chain of thin, rounded, rotated Views.
// react-native-svg does not apply dynamic updates in this environment, but plain
// Views do — so strokes are drawn without SVG. Points are in world coords;
// offsetX/offsetY position a committed stroke relative to its node origin.
const StrokeShape = memo(function StrokeShape({ points, color, thickness, opacity = 1, offsetX = 0, offsetY = 0 }) {
  const pts = smoothStroke(points);
  if (!pts || pts.length < 2) return null;
  const segs = [];
  for (let i = 1; i < pts.length; i += 1) {
    const ax = pts[i - 1].x + offsetX;
    const ay = pts[i - 1].y + offsetY;
    const dx = (pts[i].x + offsetX) - ax;
    const dy = (pts[i].y + offsetY) - ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.3) continue;
    segs.push(
      <View
        key={i}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: ax,
          top: ay - thickness / 2,
          width: len + thickness * 0.5,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          opacity,
          transformOrigin: '0% 50%',
          transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
        }}
      />,
    );
  }
  return <>{segs}</>;
});

// Live stroke, isolated so capturing points never re-renders the rest of the
// board. The gesture pushes points via the imperative ref.
const LiveStroke = forwardRef(function LiveStroke({ color, thickness, opacity }, ref) {
  const [pts, setPts] = useState(null);
  useImperativeHandle(ref, () => ({
    begin: (p) => setPts([p]),
    extend: (p) => setPts((cur) => (cur ? [...cur, p] : [p])),
    clear: () => setPts(null),
  }), []);
  if (!pts || pts.length < 2) return null;
  return <StrokeShape points={pts} color={color} thickness={thickness} opacity={opacity} />;
});

// Committed freehand strokes.
function DrawingsLayer({ drawings, selectedId }) {
  const theme = useTheme();
  return (
    <>
      {drawings.map((node) => (
        <StrokeShape
          key={node.id}
          points={node.points}
          offsetX={node.x}
          offsetY={node.y}
          color={selectedId === node.id ? theme.colors.info : (node.color || '#ffffff')}
          thickness={node.thickness || 2.5}
          opacity={node.variant === 'pencil' ? 0.8 : 1}
        />
      ))}
    </>
  );
}

const HANDLE_SIZE = 18;

// 8 resize handles around a w×h box. Gestures are memoized so an in-progress
// resize is not interrupted when the parent re-renders with the new size.
function ResizeHandles({ w, h, color, scale, onStart, onMove, onEnd }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const gestures = useMemo(() => RESIZE_HANDLES.map((hd) => Gesture.Pan()
    .onStart(() => { hx.value = 0; hy.value = 0; runOnJS(onStart)(hd.sx, hd.sy); })
    .onChange((e) => { hx.value += e.changeX / scale.value; hy.value += e.changeY / scale.value; runOnJS(onMove)(hx.value, hy.value); })
    .onEnd(() => { runOnJS(onEnd)(hx.value, hy.value); })), [hx, hy, onEnd, onMove, onStart, scale]);
  return (
    <>
      {RESIZE_HANDLES.map((hd, i) => {
        const left = hd.sx === -1 ? -HANDLE_SIZE / 2 : hd.sx === 1 ? w - HANDLE_SIZE / 2 : w / 2 - HANDLE_SIZE / 2;
        const top = hd.sy === -1 ? -HANDLE_SIZE / 2 : hd.sy === 1 ? h - HANDLE_SIZE / 2 : h / 2 - HANDLE_SIZE / 2;
        return (
          <GestureDetector key={`${hd.sx}:${hd.sy}`} gesture={gestures[i]}>
            <View style={[styles.handleDot, { left, top, borderColor: color || theme.colors.info }]} />
          </GestureDetector>
        );
      })}
    </>
  );
}

// Frame position/size come from props (the parent applies the live group
// transform during drag/resize), so this is a pure gesture reporter.
const FrameView = memo(function FrameView({ frame, scale, draggable, selected, onSelect, onDragStart, onDragMove, onDragEnd, onResizeStart, onResizeMove, onResizeEnd, onPinchStart, onPinchScale, onPinchEnd }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const ax = useSharedValue(0);
  const ay = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(draggable)
    .maxPointers(1)
    .onStart(() => { ax.value = 0; ay.value = 0; runOnJS(onDragStart)(frame.id); })
    .onChange((e) => { ax.value += e.changeX / scale.value; ay.value += e.changeY / scale.value; runOnJS(onDragMove)(ax.value, ay.value); })
    .onEnd(() => { runOnJS(onDragEnd)(ax.value, ay.value); });
  const tap = Gesture.Tap().enabled(draggable).onEnd(() => runOnJS(onSelect)(frame.id));
  const pinch = Gesture.Pinch()
    .enabled(selected && draggable)
    .onStart(() => runOnJS(onPinchStart)('frame', frame.id))
    .onChange((e) => runOnJS(onPinchScale)(e.scale))
    .onEnd((e) => runOnJS(onPinchEnd)(e.scale));
  const gesture = Gesture.Simultaneous(Gesture.Race(tap, pan), pinch);

  const handleResizeStart = useCallback((sx, sy) => onResizeStart(frame.id, sx, sy), [frame.id, onResizeStart]);

  const color = frame.color || FRAME_COLORS[0];
  const w = Math.max(frame.w, MIN_FRAME_SIZE);
  const h = Math.max(frame.h, MIN_FRAME_SIZE);
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[
          styles.frame,
          { left: frame.x, top: frame.y, width: w, height: h, borderColor: color, backgroundColor: hexToRgba(color, frame.fillMode === 'solid' ? 0.85 : 0.12) },
          selected ? (frame.locked ? styles.frameSelectedLocked : styles.frameSelected) : null,
        ]}
      >
        <Text style={[styles.frameLabel, { color }]} numberOfLines={1}>
          {frame.locked ? '🔒 ' : ''}{frame.name || 'Frame'}
        </Text>
        {selected && draggable ? (
          <ResizeHandles w={w} h={h} color={color} scale={scale} onStart={handleResizeStart} onMove={onResizeMove} onEnd={onResizeEnd} />
        ) : null}
      </View>
    </GestureDetector>
  );
});

const CanvasNode = memo(function CanvasNode({ node, scale, draggable, selected, onTap, onLiveMove, onMove, onResizeStart, onResizeMove, onResizeEnd, onPinchStart, onPinchScale, onPinchEnd }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(draggable)
    .maxPointers(1)
    .onChange((e) => { dx.value += e.changeX / scale.value; dy.value += e.changeY / scale.value; runOnJS(onLiveMove)(node.id, dx.value, dy.value); })
    .onEnd(() => { runOnJS(onMove)(node.id, dx.value, dy.value); dx.value = 0; dy.value = 0; });
  const tap = Gesture.Tap().enabled(draggable).onEnd(() => runOnJS(onTap)(node.id));
  const pinch = Gesture.Pinch()
    .enabled(selected && draggable)
    .onStart(() => runOnJS(onPinchStart)('node', node.id))
    .onChange((e) => runOnJS(onPinchScale)(e.scale))
    .onEnd((e) => runOnJS(onPinchEnd)(e.scale));
  const gesture = Gesture.Simultaneous(Gesture.Race(tap, pan), pinch);

  const handleResizeStart = useCallback((sx, sy) => onResizeStart(node.id, sx, sy), [node.id, onResizeStart]);

  const { w, h } = nodeSize(node);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: dy.value }] }));

  const isImage = node.type === 'image';
  const resizable = node.type === 'text' || node.type === 'image';
  const text = node.content || stripHtml(node.html) || '';

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.node, isImage ? styles.nodeImageWrap : null, { left: node.x, top: node.y, width: w, height: h }, selected ? styles.nodeSelected : null, animatedStyle]}
      >
        {isImage ? (
          <View style={styles.nodeImageClip}>
            {node.src ? (
              <Image source={{ uri: node.src }} style={styles.nodeImage} contentFit="fill" />
            ) : (
              <View style={styles.nodeImageEmpty}><Text style={styles.nodePlaceholder}>image</Text></View>
            )}
          </View>
        ) : (
          <Text
            numberOfLines={40}
            style={[styles.nodeText, {
              fontSize: node.fontSize || 16,
              lineHeight: Math.round((node.fontSize || 16) * 1.3),
              color: node.color || theme.colors.text,
              fontWeight: node.bold ? '700' : '400',
              fontStyle: node.italic ? 'italic' : 'normal',
              textDecorationLine: node.underline ? 'underline' : 'none',
              textAlign: node.align || 'left',
            }]}
          >
            {text || 'Tap to edit'}
          </Text>
        )}
        {selected && draggable && resizable ? (
          <ResizeHandles w={w} h={h} color={theme.colors.info} scale={scale} onStart={handleResizeStart} onMove={onResizeMove} onEnd={onResizeEnd} />
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
});

const TOOLS = [
  { key: 'select', Icon: MousePointer2 },
  { key: 'text', Icon: Type },
  { key: 'image', Icon: ImagePlus },
  { key: 'pen', Icon: Pen },
  { key: 'pencil', Icon: PencilLine },
  { key: 'brush', Icon: Brush },
  { key: 'eraser', Icon: Eraser },
  { key: 'arrow', Icon: ArrowRight },
  { key: 'frame', Icon: FrameIcon },
];
const DRAW_TOOLS = ['pen', 'pencil', 'brush'];

export default function BoardScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const addToast = useToast();
  const { confirm } = useDialog();
  const { logout } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const [selectedFrameId, setSelectedFrameId] = useState(null);
  const [arrowDraft, setArrowDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [eraseCursor, setEraseCursor] = useState(null);
  const [liveDrag, setLiveDrag] = useState(null);
  const [frameDrag, setFrameDrag] = useState(null);
  const [frameResize, setFrameResize] = useState(null);
  const [nodeResize, setNodeResize] = useState(null);
  const [livePinch, setLivePinch] = useState(null);
  const [frameDraft, setFrameDraft] = useState(null);
  const [colorPicker, setColorPicker] = useState(null);
  const [drawSettings, setDrawSettings] = useState(DRAWING_DEFAULTS);

  const versionRef = useRef(0);
  const saveTimerRef = useRef(null);
  const stateRef = useRef(null);
  const strokeRef = useRef(null);
  const liveRef = useRef(null);
  const frameDraftRef = useRef(null);
  const arrowDraftRef = useRef(null);
  const frameGroupRef = useRef(null);
  const frameResizeRef = useRef(null);
  const nodeResizeRef = useRef(null);
  const pinchRef = useRef(null);
  const selectedIdRef = useRef(null);
  const drawSettingsRef = useRef(DRAWING_DEFAULTS);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const fittedRef = useRef(false);
  const canvasRef = useRef(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startScale = useSharedValue(1);
  const toolSV = useSharedValue('select');
  // Window-space offset of the canvas, so we can convert gesture absoluteX/Y
  // (transform-immune) into canvas-local screen coords. event.x/y proved
  // unreliable here, so we use absoluteX/Y minus this origin instead.
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  const measureCanvas = useCallback(() => {
    canvasRef.current?.measureInWindow((x, y) => {
      if (typeof x === 'number' && !Number.isNaN(x)) { originX.value = x; originY.value = y; }
    });
  }, [originX, originY]);

  useEffect(() => { toolSV.value = tool; }, [tool, toolSV]);
  useEffect(() => { drawSettingsRef.current = drawSettings; }, [drawSettings]);

  const activeBoard = useMemo(() => {
    if (!document) return null;
    return document.boards.find((b) => b.id === document.activeBoardId) || document.boards[0] || null;
  }, [document]);

  const applyViewport = useCallback((vp) => { tx.value = vp.x || 0; ty.value = vp.y || 0; scale.value = vp.zoom || 1; }, [scale, tx, ty]);

  const fitToBoard = useCallback((board) => {
    const bounds = contentBounds(board);
    const cw = containerSize.width || 360;
    const ch = containerSize.height || 600;
    if (!bounds) { applyViewport(DEFAULT_VIEWPORT); return; }
    const pad = 60;
    const bw = Math.max(bounds.maxX - bounds.minX, 1);
    const bh = Math.max(bounds.maxY - bounds.minY, 1);
    const z = Math.max(Math.min(Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh), MAX_ZOOM), MIN_ZOOM);
    applyViewport({ zoom: z, x: (cw - bw * z) / 2 - bounds.minX * z, y: (ch - bh * z) / 2 - bounds.minY * z });
  }, [applyViewport, containerSize]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await boardApi.getDocument();
        if (cancelled) return;
        const state = doc?.state || { boards: [], activeBoardId: '' };
        const boards = Array.isArray(state.boards) && state.boards.length
          ? state.boards
          : [{ id: 'board-1', label: '1', nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT }];
        const activeBoardId = state.activeBoardId && boards.some((b) => b.id === state.activeBoardId) ? state.activeBoardId : boards[0].id;
        versionRef.current = doc?.version || 0;
        setDocument({ boards, activeBoardId });
        applyViewport(boards.find((b) => b.id === activeBoardId)?.viewport || DEFAULT_VIEWPORT);
      } catch (error) {
        console.error('Failed to load board', error);
        addToast(error?.message || 'Failed to load board.', 'error');
        setDocument({ boards: [{ id: 'board-1', label: '1', nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT }], activeBoardId: 'board-1' });
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [addToast, applyViewport]);

  stateRef.current = document;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    if (fittedRef.current || !activeBoard || !containerSize.width) return;
    if ((activeBoard.nodes || []).length || (activeBoard.frames || []).length) fitToBoard(activeBoard);
    fittedRef.current = true;
  }, [activeBoard, containerSize, fitToBoard]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const current = stateRef.current;
      if (!current) return;
      const state = {
        ...current,
        boards: current.boards.map((b) => (b.id === current.activeBoardId ? { ...b, viewport: { x: tx.value, y: ty.value, zoom: scale.value } } : b)),
      };
      try {
        const doc = await boardApi.updateDocument({ state, baseVersion: versionRef.current });
        versionRef.current = doc?.version || versionRef.current;
      } catch (error) {
        if (Number(error?.status) === 409) {
          try {
            const fresh = await boardApi.getDocument();
            versionRef.current = fresh?.version || versionRef.current;
            const retry = await boardApi.updateDocument({ state, baseVersion: versionRef.current });
            versionRef.current = retry?.version || versionRef.current;
            return;
          } catch { /* fall through */ }
        }
        console.error('Failed to save board', error);
        addToast(error?.message || 'Failed to save board.', 'error');
      }
    }, 900);
  }, [addToast, scale, tx, ty]);

  const pushHistory = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const board = current.boards.find((b) => b.id === current.activeBoardId);
    if (!board) return;
    undoRef.current = [...undoRef.current.slice(-(HISTORY_LIMIT - 1)), { nodes: board.nodes || [], edges: board.edges || [], frames: board.frames || [] }];
    redoRef.current = [];
  }, []);

  const applyContent = useCallback((updater) => {
    setDocument((current) => (current ? { ...current, boards: current.boards.map((b) => (b.id === current.activeBoardId ? updater(b) : b)) } : current));
    scheduleSave();
  }, [scheduleSave]);

  const commitContent = useCallback((updater) => { pushHistory(); applyContent(updater); }, [applyContent, pushHistory]);

  const restoreSnapshot = useCallback((fromRef, toRef) => {
    const current = stateRef.current;
    if (!current) return;
    const board = current.boards.find((b) => b.id === current.activeBoardId);
    if (!board || fromRef.current.length === 0) return;
    const snapshot = fromRef.current[fromRef.current.length - 1];
    fromRef.current = fromRef.current.slice(0, -1);
    toRef.current = [...toRef.current, { nodes: board.nodes || [], edges: board.edges || [], frames: board.frames || [] }];
    setDocument((cur) => ({ ...cur, boards: cur.boards.map((b) => (b.id === cur.activeBoardId ? { ...b, ...snapshot } : b)) }));
    setSelectedId(null); setSelectedEdgeId(null); setSelectedFrameId(null);
    scheduleSave();
  }, [scheduleSave]);

  const undo = useCallback(() => restoreSnapshot(undoRef, redoRef), [restoreSnapshot]);
  const redo = useCallback(() => restoreSnapshot(redoRef, undoRef), [restoreSnapshot]);

  const clearSelection = useCallback(() => { setSelectedId(null); setSelectedEdgeId(null); setSelectedFrameId(null); }, []);
  const selectFrame = useCallback((id) => { setSelectedFrameId(id); setSelectedId(null); setSelectedEdgeId(null); }, []);

  const addTextAt = useCallback((wx, wy) => {
    const node = { id: makeId('text'), type: 'text', x: wx - TEXT_NODE.w / 2, y: wy - TEXT_NODE.h / 2, w: TEXT_NODE.w, h: TEXT_NODE.h, content: '', fontSize: 16, color: '#ffffff', align: 'left' };
    commitContent((b) => ({ ...b, nodes: [...(b.nodes || []), node] }));
    setSelectedId(node.id); setTool('select'); setEditing({ kind: 'text', id: node.id }); setEditText('');
  }, [commitContent]);

  const addImageAt = useCallback(async (wx, wy) => {
    if (uploading) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { addToast('Photo permission is required.', 'error'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;
      setUploading(true);
      const asset = result.assets[0];
      const ratio = asset.width && asset.height ? asset.height / asset.width : 0.75;
      const node = { id: makeId('image'), type: 'image', x: wx - IMAGE_NODE.w / 2, y: wy - (IMAGE_NODE.w * ratio) / 2, w: IMAGE_NODE.w, h: Math.round(IMAGE_NODE.w * ratio), src: asset.uri };
      commitContent((b) => ({ ...b, nodes: [...(b.nodes || []), node] }));
      setSelectedId(node.id); setTool('select');
      const uploaded = await mediaApi.upload({ file: { uri: asset.uri, name: asset.fileName || 'board.jpg', type: asset.mimeType || 'image/jpeg' }, kind: 'board' });
      if (uploaded?.url) applyContent((b) => ({ ...b, nodes: (b.nodes || []).map((n) => (n.id === node.id ? { ...n, src: uploaded.url } : n)) }));
      else addToast('Image upload failed — it will not sync until re-added.', 'error');
    } catch (error) {
      console.error('Failed to add image', error);
      addToast(error?.message || 'Failed to add image.', 'error');
    } finally {
      setUploading(false);
    }
  }, [addToast, applyContent, commitContent, uploading]);

  const handleSurfaceTap = useCallback((wx, wy) => {
    if (tool === 'text') { addTextAt(wx, wy); return; }
    if (tool === 'image') { addImageAt(wx, wy); return; }
    if (tool === 'select') {
      // Hit-test drawings/edges (their SVG layer can't capture touches), nearest first.
      const cur = stateRef.current;
      const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
      if (board) {
        const r = 16 / scale.value;
        const draw = (board.nodes || []).find((n) => n.type === 'drawing' && (n.points || []).some((p) => Math.hypot(n.x + p.x - wx, n.y + p.y - wy) <= r));
        if (draw) { setSelectedId(draw.id); setSelectedEdgeId(null); setSelectedFrameId(null); return; }
        const byId = new Map((board.nodes || []).map((n) => [n.id, n]));
        const tol = 14 / scale.value;
        const edge = (board.edges || []).find((e) => {
          const pts = edgePolyline(e, byId);
          if (!pts) return false;
          for (let i = 1; i < pts.length; i += 1) {
            if (distToSegment(wx, wy, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= tol) return true;
          }
          return false;
        });
        if (edge) { setSelectedEdgeId(edge.id); setSelectedId(null); setSelectedFrameId(null); return; }
      }
    }
    clearSelection();
  }, [addImageAt, addTextAt, clearSelection, scale, tool]);

  // Drawing — live points go through liveRef so the rest of the board does not
  // re-render while drawing (keeps fast strokes smooth). strokeRef is the
  // source of truth used on commit.
  const beginStroke = useCallback((wx, wy) => {
    const p = { x: wx, y: wy };
    strokeRef.current = [p];
    liveRef.current?.begin(p);
  }, []);
  const extendStroke = useCallback((wx, wy) => {
    if (!strokeRef.current) return;
    const last = strokeRef.current[strokeRef.current.length - 1];
    if (last && Math.hypot(wx - last.x, wy - last.y) < 1.5) return;
    const p = { x: wx, y: wy };
    strokeRef.current.push(p);
    liveRef.current?.extend(p);
  }, []);
  const commitStroke = useCallback((variant) => {
    const pts = strokeRef.current || [];
    strokeRef.current = null;
    liveRef.current?.clear();
    if (pts.length < 2) return;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    pts.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    const cfg = drawSettingsRef.current[variant] || DRAWING_DEFAULTS.pen;
    const node = { id: makeId('draw'), type: 'drawing', variant, color: cfg.color, thickness: cfg.thickness, x: minX, y: minY, w: maxX - minX, h: maxY - minY, points: pts.map((p) => ({ x: p.x - minX, y: p.y - minY })) };
    commitContent((b) => ({ ...b, nodes: [...(b.nodes || []), node] }));
  }, [commitContent]);

  // Eraser
  const eraseAt = useCallback((wx, wy) => {
    setEraseCursor({ x: wx, y: wy });
    const radius = drawSettingsRef.current.eraser.thickness;
    applyContent((b) => ({
      ...b,
      nodes: (b.nodes || []).flatMap((n) => (n.type === 'drawing' ? eraseFromStroke(n, wx, wy, radius) : [n])),
    }));
  }, [applyContent]);

  // Frames
  const beginFrame = useCallback((wx, wy) => { frameDraftRef.current = { x: wx, y: wy, x2: wx, y2: wy }; setFrameDraft({ x: wx, y: wy, w: 0, h: 0 }); }, []);
  const extendFrame = useCallback((wx, wy) => {
    if (!frameDraftRef.current) return;
    frameDraftRef.current = { ...frameDraftRef.current, x2: wx, y2: wy };
    const d = frameDraftRef.current;
    setFrameDraft({ x: Math.min(d.x, d.x2), y: Math.min(d.y, d.y2), w: Math.abs(d.x2 - d.x), h: Math.abs(d.y2 - d.y) });
  }, []);
  const commitFrame = useCallback(() => {
    const d = frameDraftRef.current;
    frameDraftRef.current = null; setFrameDraft(null);
    if (!d) return;
    const x = Math.min(d.x, d.x2); const y = Math.min(d.y, d.y2);
    const w = Math.abs(d.x2 - d.x); const h = Math.abs(d.y2 - d.y);
    if (w < MIN_FRAME_SIZE || h < MIN_FRAME_SIZE) return;
    const idx = (activeBoard?.frames || []).length;
    const frame = { id: makeId('frame'), x, y, w, h, color: FRAME_COLORS[idx % FRAME_COLORS.length], name: `Frame ${idx + 1}`, fillMode: 'translucent', locked: false };
    commitContent((b) => ({ ...b, frames: [...(b.frames || []), frame] }));
    setTool('select');
  }, [activeBoard, commitContent]);

  // Arrows — drag from one spot to another. Endpoints snap to a node if the
  // drag starts/ends over one, otherwise they are free-floating points.
  const nodeAtPoint = useCallback((wx, wy) => {
    const cur = stateRef.current;
    const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
    if (!board) return null;
    const ns = board.nodes || [];
    for (let i = ns.length - 1; i >= 0; i -= 1) {
      const n = ns[i];
      if (n.type === 'drawing') continue;
      const { w, h } = nodeSize(n);
      if (wx >= n.x && wx <= n.x + w && wy >= n.y && wy <= n.y + h) return n;
    }
    return null;
  }, []);

  const beginArrow = useCallback((wx, wy) => {
    const node = nodeAtPoint(wx, wy);
    arrowDraftRef.current = { fromId: node?.id || null, start: { x: wx, y: wy }, end: { x: wx, y: wy } };
    setArrowDraft(arrowDraftRef.current);
  }, [nodeAtPoint]);
  const extendArrow = useCallback((wx, wy) => {
    if (!arrowDraftRef.current) return;
    arrowDraftRef.current = { ...arrowDraftRef.current, end: { x: wx, y: wy } };
    setArrowDraft(arrowDraftRef.current);
  }, []);
  const commitArrow = useCallback(() => {
    const d = arrowDraftRef.current;
    arrowDraftRef.current = null; setArrowDraft(null);
    if (!d) return;
    if (Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y) < 12) return;
    const toNode = nodeAtPoint(d.end.x, d.end.y);
    const fromId = d.fromId;
    const toId = toNode && toNode.id !== fromId ? toNode.id : null;
    const edge = {
      id: makeId('edge'),
      strokeWidth: 2,
      ...(fromId ? { from: fromId } : { start: d.start }),
      ...(toId ? { to: toId } : { end: d.end }),
    };
    commitContent((b) => ({ ...b, edges: [...(b.edges || []), edge] }));
  }, [commitContent, nodeAtPoint]);

  // Node interactions. Tapping an already-selected text node opens its editor.
  const handleNodeTap = useCallback((id) => {
    if (selectedIdRef.current === id) {
      const cur = stateRef.current;
      const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
      const node = board?.nodes.find((n) => n.id === id);
      if (node?.type === 'text') {
        setEditing({ kind: 'text', id });
        setEditText(node.content || stripHtml(node.html) || '');
        return;
      }
    }
    setSelectedId(id); setSelectedEdgeId(null); setSelectedFrameId(null);
  }, []);

  // Live position while dragging a node, so connected arrows follow in real time.
  const onNodeLiveMove = useCallback((id, dxv, dyv) => setLiveDrag({ id, dx: dxv, dy: dyv }), []);
  const moveNode = useCallback((id, dxv, dyv) => {
    setLiveDrag(null);
    commitContent((b) => ({ ...b, nodes: (b.nodes || []).map((n) => (n.id === id ? { ...n, x: n.x + dxv, y: n.y + dyv } : n)) }));
  }, [commitContent]);
  // Node resize from any of the 8 handles (the opposite edge stays anchored).
  const onNodeResizeStart = useCallback((id, sx, sy) => {
    const cur = stateRef.current;
    const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
    const node = board?.nodes.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = nodeSize(node);
    nodeResizeRef.current = { id, sx, sy, start: { x: node.x, y: node.y, w, h } };
    setNodeResize({ dx: 0, dy: 0 });
  }, []);
  const onNodeResizeMove = useCallback((dx, dy) => setNodeResize({ dx, dy }), []);
  const onNodeResizeEnd = useCallback((dx, dy) => {
    const r = nodeResizeRef.current;
    nodeResizeRef.current = null;
    setNodeResize(null);
    if (!r) return;
    const rect = resizeRect(r.start, r.sx, r.sy, dx, dy, MIN_NODE_SIZE, MIN_NODE_SIZE);
    commitContent((b) => ({ ...b, nodes: (b.nodes || []).map((n) => (n.id === r.id ? { ...n, ...rect } : n)) }));
  }, [commitContent]);
  const updateNode = useCallback((patch) => { if (!selectedId) return; commitContent((b) => ({ ...b, nodes: (b.nodes || []).map((n) => (n.id === selectedId ? { ...n, ...patch } : n)) })); }, [commitContent, selectedId]);

  // Compute the move group for a frame: nested frames + nodes whose centre is inside.
  const computeFrameGroup = useCallback((frameId) => {
    const cur = stateRef.current;
    const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
    if (!board) return { frameIds: new Set([frameId]), nodeIds: new Set() };
    const frameIds = collectNestedFrameIds([frameId], board.frames || []);
    const groupFrames = (board.frames || []).filter((f) => frameIds.has(f.id));
    const nodeIds = new Set();
    (board.nodes || []).forEach((n) => {
      const c = nodeCenter(n);
      if (groupFrames.some((f) => pointInFrame(c.x, c.y, f))) nodeIds.add(n.id);
    });
    return { frameIds, nodeIds };
  }, []);

  // Frame move (drags contained nodes + nested frames).
  const onFrameDragStart = useCallback((id) => { frameGroupRef.current = computeFrameGroup(id); setFrameDrag({ dx: 0, dy: 0 }); }, [computeFrameGroup]);
  const onFrameDragMove = useCallback((dx, dy) => setFrameDrag({ dx, dy }), []);
  const onFrameDragEnd = useCallback((dx, dy) => {
    const grp = frameGroupRef.current;
    frameGroupRef.current = null;
    setFrameDrag(null);
    if (!grp || (dx === 0 && dy === 0)) return;
    commitContent((b) => ({
      ...b,
      frames: (b.frames || []).map((f) => (grp.frameIds.has(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f)),
      nodes: (b.nodes || []).map((n) => (grp.nodeIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
    }));
  }, [commitContent]);

  // Frame resize. Locked: scale the frame + its contents about the top-left.
  // Unlocked: free-resize the frame rect only.
  const onFrameResizeStart = useCallback((id, sx, sy) => {
    const cur = stateRef.current;
    const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
    const frame = board?.frames.find((f) => f.id === id);
    if (!frame) return;
    if (frame.locked) {
      const grp = computeFrameGroup(id);
      frameResizeRef.current = {
        frameId: id, locked: true, sx, sy,
        start: { x: frame.x, y: frame.y, w: frame.w, h: frame.h },
        frameStarts: (board.frames || []).filter((f) => grp.frameIds.has(f.id)).map((f) => ({ ...f })),
        nodeStarts: (board.nodes || []).filter((n) => grp.nodeIds.has(n.id)).map((n) => ({ ...n })),
      };
    } else {
      frameResizeRef.current = { frameId: id, locked: false, sx, sy, start: { x: frame.x, y: frame.y, w: frame.w, h: frame.h } };
    }
    setFrameResize({ ddx: 0, ddy: 0 });
  }, [computeFrameGroup]);
  const onFrameResizeMove = useCallback((ddx, ddy) => setFrameResize({ ddx, ddy }), []);
  const onFrameResizeEnd = useCallback((ddx, ddy) => {
    const r = frameResizeRef.current;
    frameResizeRef.current = null;
    setFrameResize(null);
    if (!r) return;
    if (!r.locked) {
      const rect = resizeRect(r.start, r.sx, r.sy, ddx, ddy, MIN_FRAME_SIZE, MIN_FRAME_SIZE);
      commitContent((b) => ({ ...b, frames: (b.frames || []).map((f) => (f.id === r.frameId ? { ...f, ...rect } : f)) }));
      return;
    }
    const s = scaleFromHandle(r.start, r.sx, r.sy, ddx, ddy, MIN_FRAME_SIZE);
    const a = anchorFromHandle(r.start, r.sx, r.sy);
    const frameById = new Map(r.frameStarts.map((f) => [f.id, { ...f, x: a.x + (f.x - a.x) * s, y: a.y + (f.y - a.y) * s, w: f.w * s, h: f.h * s }]));
    const nodeById2 = new Map(r.nodeStarts.map((n) => [n.id, scaleNodeBy(n, a.x, a.y, s)]));
    commitContent((b) => ({
      ...b,
      frames: (b.frames || []).map((f) => (frameById.has(f.id) ? frameById.get(f.id) : f)),
      nodes: (b.nodes || []).map((n) => (nodeById2.has(n.id) ? nodeById2.get(n.id) : n)),
    }));
  }, [commitContent]);

  // Pinch-to-resize an item (node or frame) about its centre. Triggered by the
  // item's own pinch gesture, so it only fires when both fingers are on it.
  const onPinchStart = useCallback((kind, id) => {
    const cur = stateRef.current;
    const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
    if (!board) return;
    if (kind === 'frame') {
      const frame = board.frames.find((f) => f.id === id);
      if (!frame) return;
      const center = { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
      const minS = MIN_FRAME_SIZE / Math.min(frame.w, frame.h);
      if (frame.locked) {
        const grp = computeFrameGroup(id);
        pinchRef.current = { kind: 'frame', center, minS,
          frameStarts: (board.frames || []).filter((f) => grp.frameIds.has(f.id)).map((f) => ({ ...f })),
          nodeStarts: (board.nodes || []).filter((n) => grp.nodeIds.has(n.id)).map((n) => ({ ...n })) };
      } else {
        pinchRef.current = { kind: 'frame', center, minS, frameStarts: [{ ...frame }], nodeStarts: [] };
      }
      setLivePinch({ s: 1 });
    } else {
      const node = board.nodes.find((n) => n.id === id);
      if (!node) return;
      const { w, h } = nodeSize(node);
      pinchRef.current = { kind: 'node', center: { x: node.x + w / 2, y: node.y + h / 2 }, nodeStart: { ...node }, minS: MIN_NODE_SIZE / Math.min(w, h) };
      setLivePinch({ s: 1 });
    }
  }, [computeFrameGroup]);
  const onPinchScale = useCallback((s) => { if (pinchRef.current) setLivePinch({ s }); }, []);
  const onPinchEnd = useCallback((sIn) => {
    const p = pinchRef.current;
    pinchRef.current = null;
    setLivePinch(null);
    if (!p) return;
    const s = Math.max(sIn, p.minS || 0.05);
    if (p.kind === 'node') {
      const scaled = scaleNodeBy(p.nodeStart, p.center.x, p.center.y, s);
      commitContent((b) => ({ ...b, nodes: (b.nodes || []).map((n) => (n.id === scaled.id ? scaled : n)) }));
      return;
    }
    const a = p.center;
    const frameById = new Map(p.frameStarts.map((f) => [f.id, { ...f, x: a.x + (f.x - a.x) * s, y: a.y + (f.y - a.y) * s, w: f.w * s, h: f.h * s }]));
    const nodeById2 = new Map(p.nodeStarts.map((n) => [n.id, scaleNodeBy(n, a.x, a.y, s)]));
    commitContent((b) => ({
      ...b,
      frames: (b.frames || []).map((f) => (frameById.has(f.id) ? frameById.get(f.id) : f)),
      nodes: (b.nodes || []).map((n) => (nodeById2.has(n.id) ? nodeById2.get(n.id) : n)),
    }));
  }, [commitContent]);

  const updateFrame = useCallback((patch) => { if (!selectedFrameId) return; commitContent((b) => ({ ...b, frames: (b.frames || []).map((f) => (f.id === selectedFrameId ? { ...f, ...patch } : f)) })); }, [commitContent, selectedFrameId]);
  const updateEdge = useCallback((patch) => { if (!selectedEdgeId) return; commitContent((b) => ({ ...b, edges: (b.edges || []).map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e)) })); }, [commitContent, selectedEdgeId]);

  const deleteSelected = useCallback(() => {
    if (selectedEdgeId) { commitContent((b) => ({ ...b, edges: (b.edges || []).filter((e) => e.id !== selectedEdgeId) })); setSelectedEdgeId(null); return; }
    if (selectedFrameId) { commitContent((b) => ({ ...b, frames: (b.frames || []).filter((f) => f.id !== selectedFrameId) })); setSelectedFrameId(null); return; }
    if (selectedId) {
      commitContent((b) => ({ ...b, nodes: (b.nodes || []).filter((n) => n.id !== selectedId), edges: (b.edges || []).filter((e) => e.from !== selectedId && e.to !== selectedId) }));
      setSelectedId(null);
    }
  }, [commitContent, selectedEdgeId, selectedFrameId, selectedId]);

  const openRename = useCallback((kind, id, value) => { setEditing({ kind, id }); setEditText(value || ''); }, []);
  const editTextNode = useCallback((id) => {
    const cur = stateRef.current;
    const board = cur?.boards.find((b) => b.id === cur.activeBoardId);
    const node = board?.nodes.find((n) => n.id === id);
    if (!node) return;
    setSelectedId(id); setSelectedEdgeId(null); setSelectedFrameId(null);
    setEditing({ kind: 'text', id });
    setEditText(node.content || stripHtml(node.html) || '');
  }, []);
  const commitEdit = useCallback(() => {
    if (!editing) return;
    const value = editText;
    if (editing.kind === 'frame') {
      commitContent((b) => ({ ...b, frames: (b.frames || []).map((f) => (f.id === editing.id ? { ...f, name: value } : f)) }));
    } else {
      commitContent((b) => ({ ...b, nodes: (b.nodes || []).map((n) => (n.id === editing.id ? { ...n, content: value, html: undefined } : n)) }));
    }
    setEditing(null); setEditText('');
  }, [commitContent, editText, editing]);

  // Boards
  const addBoard = useCallback(() => {
    setDocument((current) => {
      const label = String((current?.boards.length || 0) + 1);
      const board = { id: makeId('board'), label, nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT };
      return { boards: [...current.boards, board], activeBoardId: board.id };
    });
    applyViewport(DEFAULT_VIEWPORT); clearSelection(); scheduleSave();
  }, [applyViewport, clearSelection, scheduleSave]);

  const switchBoard = useCallback((boardId) => {
    setDocument((current) => ({ ...current, activeBoardId: boardId }));
    clearSelection();
    applyViewport(document?.boards.find((b) => b.id === boardId)?.viewport || DEFAULT_VIEWPORT);
    undoRef.current = []; redoRef.current = [];
    scheduleSave();
  }, [applyViewport, clearSelection, document, scheduleSave]);

  const deleteBoard = useCallback(async (boardId) => {
    const ok = await confirm({
      title: 'Delete board?',
      message: 'This removes the board and everything on it.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDocument((current) => {
      const remaining = current.boards.filter((b) => b.id !== boardId);
      const boards = remaining.length ? remaining : [{ id: 'board-1', label: '1', nodes: [], edges: [], frames: [], viewport: DEFAULT_VIEWPORT }];
      const activeBoardId = boards.some((b) => b.id === current.activeBoardId) ? current.activeBoardId : boards[0].id;
      return { boards, activeBoardId };
    });
    scheduleSave();
  }, [confirm, scheduleSave]);

  const setDrawConfig = useCallback((variant, patch) => setDrawSettings((cur) => ({ ...cur, [variant]: { ...cur[variant], ...patch } })), []);

  // Gestures
  const surfacePan = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .onStart((event) => {
      const t = toolSV.value;
      const wx = (event.absoluteX - originX.value - tx.value) / scale.value;
      const wy = (event.absoluteY - originY.value - ty.value) / scale.value;
      if (t === 'pen' || t === 'pencil' || t === 'brush') runOnJS(beginStroke)(wx, wy);
      else if (t === 'eraser') { runOnJS(pushHistory)(); runOnJS(eraseAt)(wx, wy); }
      else if (t === 'frame') runOnJS(beginFrame)(wx, wy);
      else if (t === 'arrow') runOnJS(beginArrow)(wx, wy);
      else { startTx.value = tx.value; startTy.value = ty.value; }
    })
    .onUpdate((event) => {
      const t = toolSV.value;
      const wx = (event.absoluteX - originX.value - tx.value) / scale.value;
      const wy = (event.absoluteY - originY.value - ty.value) / scale.value;
      if (t === 'pen' || t === 'pencil' || t === 'brush') runOnJS(extendStroke)(wx, wy);
      else if (t === 'eraser') runOnJS(eraseAt)(wx, wy);
      else if (t === 'frame') runOnJS(extendFrame)(wx, wy);
      else if (t === 'arrow') runOnJS(extendArrow)(wx, wy);
      else { tx.value = startTx.value + event.translationX; ty.value = startTy.value + event.translationY; }
    })
    .onEnd(() => {
      const t = toolSV.value;
      if (t === 'pen' || t === 'pencil' || t === 'brush') runOnJS(commitStroke)(t);
      else if (t === 'eraser') runOnJS(setEraseCursor)(null);
      else if (t === 'frame') runOnJS(commitFrame)();
      else if (t === 'arrow') runOnJS(commitArrow)();
    }), [beginArrow, beginFrame, beginStroke, commitArrow, commitFrame, commitStroke, eraseAt, extendArrow, extendFrame, extendStroke, originX, originY, pushHistory, scale, startTx, startTy, toolSV, tx, ty]);

  const surfaceTap = useMemo(() => Gesture.Tap().onEnd((event) => {
    runOnJS(handleSurfaceTap)((event.absoluteX - originX.value - tx.value) / scale.value, (event.absoluteY - originY.value - ty.value) / scale.value);
  }), [handleSurfaceTap, originX, originY, scale, tx, ty]);

  // Canvas pinch always zooms the board. Pinching ON a selected item resizes it
  // instead (handled by that item's own pinch gesture).
  const pinch = useMemo(() => Gesture.Pinch()
    .onStart(() => { startScale.value = scale.value; })
    .onUpdate((event) => { scale.value = clampW(startScale.value * event.scale, MIN_ZOOM, MAX_ZOOM); })
    .onEnd(() => { runOnJS(scheduleSave)(); }), [scale, scheduleSave, startScale]);

  const canvasGesture = useMemo(() => Gesture.Simultaneous(Gesture.Race(surfacePan, surfaceTap), pinch), [pinch, surfacePan, surfaceTap]);

  const surfaceStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  if (loading) return <LoadingScreen message="Loading board…" />;

  const nodes = activeBoard?.nodes || [];
  const edges = activeBoard?.edges || [];
  const frames = activeBoard?.frames || [];

  // Live overrides for any in-progress move/resize/pinch so the canvas updates
  // in real time before the gesture commits.
  const liveFrameOverride = new Map();
  const liveNodeOverride = new Map();
  if (frameDrag && frameGroupRef.current) {
    const { frameIds, nodeIds } = frameGroupRef.current;
    frames.forEach((f) => { if (frameIds.has(f.id)) liveFrameOverride.set(f.id, { ...f, x: f.x + frameDrag.dx, y: f.y + frameDrag.dy }); });
    nodes.forEach((n) => { if (nodeIds.has(n.id)) liveNodeOverride.set(n.id, { ...n, x: n.x + frameDrag.dx, y: n.y + frameDrag.dy }); });
  } else if (frameResize && frameResizeRef.current) {
    const r = frameResizeRef.current;
    if (!r.locked) {
      const f = frames.find((x) => x.id === r.frameId);
      if (f) liveFrameOverride.set(f.id, { ...f, ...resizeRect(r.start, r.sx, r.sy, frameResize.ddx, frameResize.ddy, MIN_FRAME_SIZE, MIN_FRAME_SIZE) });
    } else {
      const s = scaleFromHandle(r.start, r.sx, r.sy, frameResize.ddx, frameResize.ddy, MIN_FRAME_SIZE);
      const a = anchorFromHandle(r.start, r.sx, r.sy);
      r.frameStarts.forEach((f0) => liveFrameOverride.set(f0.id, { ...f0, x: a.x + (f0.x - a.x) * s, y: a.y + (f0.y - a.y) * s, w: f0.w * s, h: f0.h * s }));
      r.nodeStarts.forEach((n0) => liveNodeOverride.set(n0.id, scaleNodeBy(n0, a.x, a.y, s)));
    }
  } else if (nodeResize && nodeResizeRef.current) {
    const r = nodeResizeRef.current;
    const orig = nodes.find((n) => n.id === r.id);
    if (orig) liveNodeOverride.set(r.id, { ...orig, ...resizeRect(r.start, r.sx, r.sy, nodeResize.dx, nodeResize.dy, MIN_NODE_SIZE, MIN_NODE_SIZE) });
  } else if (livePinch && pinchRef.current) {
    const p = pinchRef.current;
    const s = Math.max(livePinch.s, p.minS || 0.05);
    if (p.kind === 'node') {
      liveNodeOverride.set(p.nodeStart.id, scaleNodeBy(p.nodeStart, p.center.x, p.center.y, s));
    } else {
      const a = p.center;
      p.frameStarts.forEach((f0) => liveFrameOverride.set(f0.id, { ...f0, x: a.x + (f0.x - a.x) * s, y: a.y + (f0.y - a.y) * s, w: f0.w * s, h: f0.h * s }));
      p.nodeStarts.forEach((n0) => liveNodeOverride.set(n0.id, scaleNodeBy(n0, a.x, a.y, s)));
    }
  }
  const nodeForRender = (n) => liveNodeOverride.get(n.id) || n;
  const frameForRender = (f) => liveFrameOverride.get(f.id) || f;

  const drawings = nodes.filter((n) => n.type === 'drawing').map(nodeForRender);
  const visualNodes = nodes.filter((n) => n.type !== 'drawing');
  const renderFrames = [...frames].sort((a, b) => (b.w * b.h) - (a.w * a.h));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  // For arrows: reflect any live node movement (single-node drag OR frame group
  // move/resize) so connected arrows track it in real time.
  const edgeNodeById = (liveDrag || liveNodeOverride.size)
    ? new Map(nodes.map((n) => {
      if (liveDrag && liveDrag.id === n.id) return [n.id, { ...n, x: n.x + liveDrag.dx, y: n.y + liveDrag.dy }];
      return [n.id, liveNodeOverride.get(n.id) || n];
    }))
    : nodeById;
  const selectedNode = selectedId ? nodeById.get(selectedId) : null;
  const selectedFrame = selectedFrameId ? frames.find((f) => f.id === selectedFrameId) : null;
  const isDrawTool = DRAW_TOOLS.includes(tool);
  const drawCfg = drawSettings[tool] || DRAWING_DEFAULTS.pen;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topHeader}>
          <View style={styles.brandRow}>
            <BrandMark size={14} />
            <Text style={styles.brand}>Life tracker</Text>
            <Text style={styles.brandSlash}>/</Text>
            <Text style={styles.brandActive}>board</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeSwitcher />
            <Pressable hitSlop={10} onPress={logout} style={styles.logoutButton}>
              <LogOut size={16} color={theme.colors.secondary} strokeWidth={1.5} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <View ref={canvasRef} collapsable={false} style={styles.canvasContainer} onLayout={(event) => { setContainerSize(event.nativeEvent.layout); measureCanvas(); }}>
        <GridLayer width={containerSize.width} height={containerSize.height} color={theme.colors.borderDim} />
        <GestureDetector gesture={canvasGesture}>
          <Animated.View style={styles.canvasFill}>
            <Animated.View style={[styles.surface, surfaceStyle]}>
              {renderFrames.map((f0) => {
                const frame = frameForRender(f0);
                return (
                  <FrameView key={frame.id} frame={frame} scale={scale} draggable={tool === 'select'} selected={selectedFrameId === frame.id}
                    onSelect={selectFrame} onDragStart={onFrameDragStart} onDragMove={onFrameDragMove} onDragEnd={onFrameDragEnd}
                    onResizeStart={onFrameResizeStart} onResizeMove={onFrameResizeMove} onResizeEnd={onFrameResizeEnd}
                    onPinchStart={onPinchStart} onPinchScale={onPinchScale} onPinchEnd={onPinchEnd} />
                );
              })}
              <EdgesLayer edges={edges} nodeById={edgeNodeById} selectedEdgeId={selectedEdgeId} />
              <DrawingsLayer drawings={drawings} selectedId={selectedId} />
              <LiveStroke ref={liveRef} color={drawCfg.color || '#ffffff'} thickness={drawCfg.thickness || 2.5} opacity={tool === 'pencil' ? 0.8 : 1} />
              {tool === 'eraser' && eraseCursor ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: eraseCursor.x - drawSettings.eraser.thickness,
                    top: eraseCursor.y - drawSettings.eraser.thickness,
                    width: drawSettings.eraser.thickness * 2,
                    height: drawSettings.eraser.thickness * 2,
                    borderRadius: drawSettings.eraser.thickness,
                    borderWidth: 1.5,
                    borderColor: '#ffffff',
                    backgroundColor: 'transparent',
                  }}
                />
              ) : null}
              {frameDraft ? <View pointerEvents="none" style={[styles.frame, styles.frameDraft, { left: frameDraft.x, top: frameDraft.y, width: frameDraft.w, height: frameDraft.h }]} /> : null}
              {arrowDraft ? (
                <ArrowShape
                  points={edgePolyline(
                    {
                      from: arrowDraft.fromId || undefined,
                      start: arrowDraft.fromId ? undefined : arrowDraft.start,
                      end: arrowDraft.end,
                    },
                    nodeById,
                  )}
                  color="rgba(255,255,255,0.85)"
                  strokeWidth={2}
                  selected
                />
              ) : null}
              {visualNodes.map((n0) => {
                const node = nodeForRender(n0);
                return (
                  <CanvasNode key={node.id} node={node} scale={scale} draggable={tool === 'select'} selected={selectedId === node.id} onTap={handleNodeTap} onLiveMove={onNodeLiveMove} onMove={moveNode} onResizeStart={onNodeResizeStart} onResizeMove={onNodeResizeMove} onResizeEnd={onNodeResizeEnd} onPinchStart={onPinchStart} onPinchScale={onPinchScale} onPinchEnd={onPinchEnd} />
                );
              })}
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {tool === 'arrow' && !arrowDraft ? (
          <View pointerEvents="none" style={styles.hintBar}><Text style={styles.hintText}>Drag to draw an arrow — start or end on an item to connect it</Text></View>
        ) : null}
        {nodes.length === 0 && frames.length === 0 ? (
          <View pointerEvents="none" style={styles.canvasHint}><Text style={styles.canvasHintText}>Pick a tool below and tap the canvas</Text></View>
        ) : null}

        {/* Floating board-page switcher, fixed at the canvas top-left. */}
        <View style={styles.boardTabs}>
          {document.boards.map((board) => {
            const active = board.id === document.activeBoardId;
            return (
              <Pressable key={board.id} onPress={() => switchBoard(board.id)} onLongPress={() => deleteBoard(board.id)} style={[styles.boardTab, active ? styles.boardTabActive : null]}>
                <Text style={[styles.boardTabLabel, active ? styles.boardTabLabelActive : null]}>{board.label}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={addBoard} style={styles.boardTabAdd}><Plus color={theme.colors.tertiary} size={14} strokeWidth={1.8} /></Pressable>
          <Pressable onPress={() => deleteBoard(document.activeBoardId)} style={styles.boardTabAdd}><Trash2 color={theme.colors.danger} size={13} strokeWidth={1.8} /></Pressable>
        </View>
      </View>

      {/* Contextual style row (above the toolbar) */}
      {isDrawTool ? (
        <View style={styles.contextBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contextRow}>
            <Pressable style={styles.ctxStepBtn} onPress={() => setDrawConfig(tool, { thickness: Math.max((drawCfg.thickness || 2) - 1, 0.5) })}><Minus color={theme.colors.text} size={14} /></Pressable>
            <Text style={styles.ctxValue}>{Math.round(drawCfg.thickness || 2)}px</Text>
            <Pressable style={styles.ctxStepBtn} onPress={() => setDrawConfig(tool, { thickness: Math.min((drawCfg.thickness || 2) + 1, 48) })}><Plus color={theme.colors.text} size={14} /></Pressable>
            <View style={styles.ctxDivider} />
            {PALETTE.map((c) => (
              <Pressable key={c} onPress={() => setDrawConfig(tool, { color: c })} style={[styles.swatch, { backgroundColor: c }, drawCfg.color === c ? styles.swatchActive : null]} />
            ))}
            <Pressable onPress={() => setColorPicker({ target: 'draw', value: drawCfg.color || '#ffffff' })} style={[styles.swatch, styles.swatchCustom]}>
              <Pipette color={theme.colors.text} size={12} />
            </Pressable>
          </ScrollView>
        </View>
      ) : tool === 'eraser' ? (
        <View style={styles.contextBar}>
          <View style={styles.contextRow}>
            <Pressable style={styles.ctxStepBtn} onPress={() => setDrawConfig('eraser', { thickness: Math.max(drawSettings.eraser.thickness - 4, 4) })}><Minus color={theme.colors.text} size={14} /></Pressable>
            <Text style={styles.ctxValue}>Eraser {Math.round(drawSettings.eraser.thickness)}px</Text>
            <Pressable style={styles.ctxStepBtn} onPress={() => setDrawConfig('eraser', { thickness: Math.min(drawSettings.eraser.thickness + 4, 96) })}><Plus color={theme.colors.text} size={14} /></Pressable>
          </View>
        </View>
      ) : selectedNode?.type === 'text' ? (
        <View style={styles.contextBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contextRow}>
            <Pressable style={styles.ctxLockBtn} onPress={() => editTextNode(selectedNode.id)}>
              <Pencil color={theme.colors.text} size={14} />
              <Text style={styles.ctxText}>Edit</Text>
            </Pressable>
            <View style={styles.ctxDivider} />
            <Pressable style={[styles.ctxToggle, selectedNode.bold ? styles.ctxToggleActive : null]} onPress={() => updateNode({ bold: !selectedNode.bold })}><Bold color={theme.colors.text} size={15} /></Pressable>
            <Pressable style={[styles.ctxToggle, selectedNode.italic ? styles.ctxToggleActive : null]} onPress={() => updateNode({ italic: !selectedNode.italic })}><Italic color={theme.colors.text} size={15} /></Pressable>
            <Pressable style={[styles.ctxToggle, selectedNode.underline ? styles.ctxToggleActive : null]} onPress={() => updateNode({ underline: !selectedNode.underline })}><Underline color={theme.colors.text} size={15} /></Pressable>
            <View style={styles.ctxDivider} />
            {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([al, Icon]) => (
              <Pressable key={al} style={[styles.ctxToggle, (selectedNode.align || 'left') === al ? styles.ctxToggleActive : null]} onPress={() => updateNode({ align: al })}><Icon color={theme.colors.text} size={15} /></Pressable>
            ))}
            <View style={styles.ctxDivider} />
            <Pressable style={styles.ctxStepBtn} onPress={() => { const i = FONT_SIZES.indexOf(selectedNode.fontSize || 16); updateNode({ fontSize: FONT_SIZES[Math.max(i - 1, 0)] || 12 }); }}><Minus color={theme.colors.text} size={14} /></Pressable>
            <Text style={styles.ctxValue}>{selectedNode.fontSize || 16}</Text>
            <Pressable style={styles.ctxStepBtn} onPress={() => { const i = FONT_SIZES.indexOf(selectedNode.fontSize || 16); updateNode({ fontSize: FONT_SIZES[Math.min(i + 1, FONT_SIZES.length - 1)] || 48 }); }}><Plus color={theme.colors.text} size={14} /></Pressable>
            <View style={styles.ctxDivider} />
            {PALETTE.map((c) => (
              <Pressable key={c} onPress={() => updateNode({ color: c })} style={[styles.swatch, { backgroundColor: c }, selectedNode.color === c ? styles.swatchActive : null]} />
            ))}
            <Pressable onPress={() => setColorPicker({ target: 'text', value: selectedNode.color || '#ffffff' })} style={[styles.swatch, styles.swatchCustom]}>
              <Pipette color={theme.colors.text} size={12} />
            </Pressable>
          </ScrollView>
        </View>
      ) : selectedFrame ? (
        <View style={styles.contextBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contextRow}>
            <Pressable style={styles.ctxToggle} onPress={() => updateFrame({ fillMode: selectedFrame.fillMode === 'solid' ? 'translucent' : 'solid' })}>
              <Text style={styles.ctxText}>{selectedFrame.fillMode === 'solid' ? 'Solid' : 'Faint'}</Text>
            </Pressable>
            <Pressable style={[styles.ctxLockBtn, selectedFrame.locked ? styles.ctxToggleActive : null]} onPress={() => updateFrame({ locked: !selectedFrame.locked })}>
              {selectedFrame.locked ? <Lock color={theme.colors.text} size={14} /> : <Unlock color={theme.colors.text} size={14} />}
              <Text style={styles.ctxText}>{selectedFrame.locked ? 'Scales content' : 'Frame only'}</Text>
            </Pressable>
            <Pressable style={styles.ctxToggle} onPress={() => openRename('frame', selectedFrame.id, selectedFrame.name)}><Pencil color={theme.colors.text} size={15} /></Pressable>
            <View style={styles.ctxDivider} />
            {FRAME_COLORS.map((c) => (
              <Pressable key={c} onPress={() => updateFrame({ color: c })} style={[styles.swatch, { backgroundColor: c }, selectedFrame.color === c ? styles.swatchActive : null]} />
            ))}
            <Pressable onPress={() => setColorPicker({ target: 'frame', value: selectedFrame.color || FRAME_COLORS[0] })} style={[styles.swatch, styles.swatchCustom]}>
              <Pipette color={theme.colors.text} size={12} />
            </Pressable>
          </ScrollView>
        </View>
      ) : selectedEdgeId ? (
        <View style={styles.contextBar}>
          <View style={styles.contextRow}>
            <Text style={styles.ctxText}>Arrow width</Text>
            <Pressable style={styles.ctxStepBtn} onPress={() => { const e = edges.find((x) => x.id === selectedEdgeId); updateEdge({ strokeWidth: Math.max((e?.strokeWidth || 1.8) - 1, 1) }); }}><Minus color={theme.colors.text} size={14} /></Pressable>
            <Text style={styles.ctxValue}>{Math.round(edges.find((x) => x.id === selectedEdgeId)?.strokeWidth || 1.8)}</Text>
            <Pressable style={styles.ctxStepBtn} onPress={() => { const e = edges.find((x) => x.id === selectedEdgeId); updateEdge({ strokeWidth: Math.min((e?.strokeWidth || 1.8) + 1, 12) }); }}><Plus color={theme.colors.text} size={14} /></Pressable>
          </View>
        </View>
      ) : null}

      {/* Bottom toolbar: scrollable tools on the left, pinned actions on the right. */}
      <View style={styles.toolbarWrap}>
        <View style={styles.toolbarRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarScroll} contentContainerStyle={styles.toolbar}>
            {TOOLS.map(({ key, Icon }) => {
              const active = tool === key;
              return (
                <Pressable key={key} onPress={() => setTool(key)} style={[styles.toolBtn, active ? styles.toolBtnActive : null]}>
                  <Icon color={active ? theme.colors.text : theme.colors.tertiary} size={18} strokeWidth={1.7} />
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.toolbarActions}>
            <Pressable style={[styles.toolBtn, undoRef.current.length ? null : styles.toolBtnDisabled]} disabled={!undoRef.current.length} onPress={undo}><Undo2 color={theme.colors.secondary} size={18} strokeWidth={1.7} /></Pressable>
            <Pressable style={[styles.toolBtn, redoRef.current.length ? null : styles.toolBtnDisabled]} disabled={!redoRef.current.length} onPress={redo}><Redo2 color={theme.colors.secondary} size={18} strokeWidth={1.7} /></Pressable>
            <Pressable style={styles.toolBtn} onPress={() => fitToBoard(activeBoard)}><Maximize2 color={theme.colors.secondary} size={17} strokeWidth={1.7} /></Pressable>
            {(selectedId || selectedEdgeId || selectedFrameId) ? (
              <Pressable style={styles.toolBtn} onPress={deleteSelected}><Trash2 color={theme.colors.danger} size={18} strokeWidth={1.7} /></Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <ModalSheet
        visible={Boolean(editing)}
        title={editing?.kind === 'frame' ? 'Frame name' : 'Edit Text'}
        onClose={commitEdit}
        footer={(<View style={styles.modalFooterEnd}><ActionButton label="Done" icon="checkmark" onPress={commitEdit} /></View>)}
      >
        <TextField label={editing?.kind === 'frame' ? 'Name' : 'Text'} placeholder="Type…" value={editText} onChangeText={setEditText} multiline={editing?.kind !== 'frame'} />
      </ModalSheet>

      <ColorPickerSheet
        visible={Boolean(colorPicker)}
        title={colorPicker?.target === 'frame' ? 'Frame color' : colorPicker?.target === 'text' ? 'Text color' : 'Color'}
        value={colorPicker?.value || '#ffffff'}
        presetColors={colorPicker?.target === 'frame' ? FRAME_COLORS : PALETTE}
        onChange={(hex) => setColorPicker((prev) => (prev ? { ...prev, value: hex } : prev))}
        onClose={() => {
          const picked = colorPicker;
          setColorPicker(null);
          if (!picked) return;
          if (picked.target === 'draw') setDrawConfig(tool, { color: picked.value });
          else if (picked.target === 'text') updateNode({ color: picked.value });
          else if (picked.target === 'frame') updateFrame({ color: picked.value });
        }}
      />
    </View>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  safeArea: { backgroundColor: theme.colors.background },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.borderDim },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brand: { color: theme.colors.secondary, fontSize: 10, fontWeight: '500', letterSpacing: 4, textTransform: 'uppercase' },
  brandSlash: { color: theme.colors.muted, fontSize: 10, marginHorizontal: 2 },
  brandActive: { color: theme.colors.secondary, fontSize: 10, fontWeight: '500', letterSpacing: 1, textTransform: 'lowercase' },
  logoutButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  boardTabs: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.background, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6 },
  boardTab: { minWidth: 32, height: 28, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: theme.colors.backgroundAlt },
  boardTabActive: { backgroundColor: theme.colors.accent },
  boardTabLabel: { color: theme.colors.tertiary, fontSize: 12, fontWeight: '500' },
  boardTabLabelActive: { color: theme.colors.background },
  boardTabAdd: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: theme.colors.backgroundAlt },
  canvasContainer: { flex: 1, overflow: 'hidden', backgroundColor: theme.colors.backgroundAlt },
  canvasFill: { flex: 1 },
  surface: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, transformOrigin: 'top left' },
  node: { position: 'absolute', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: 6, padding: 10, overflow: 'visible' },
  nodeImageWrap: { padding: 0 },
  nodeImageClip: { flex: 1, overflow: 'hidden', borderRadius: 4 },
  nodeSelected: { borderColor: theme.colors.info, borderWidth: 2 },
  nodeText: { color: theme.colors.text, fontSize: 16 },
  nodeImage: { width: '100%', height: '100%', borderRadius: 4 },
  nodeImageEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nodePlaceholder: { color: theme.colors.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  handleDot: { position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: 4, backgroundColor: '#f8fafc', borderWidth: 2 },
  frame: { position: 'absolute', borderWidth: 1.5, borderRadius: 6 },
  frameSelected: { borderWidth: 2.5, borderStyle: 'dashed' },
  frameSelectedLocked: { borderWidth: 2.5, borderStyle: 'solid' },
  frameDraft: { borderStyle: 'dashed', borderColor: theme.colors.info, backgroundColor: 'transparent' },
  frameLabel: { position: 'absolute', top: -18, left: 0, fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  hintBar: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: 'rgba(10,10,10,0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.borderDim },
  hintText: { color: theme.colors.secondary, fontSize: 11, letterSpacing: 0.5 },
  canvasHint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  canvasHintText: { color: theme.colors.muted, fontSize: 12, letterSpacing: 0.4 },
  contextBar: { backgroundColor: theme.colors.background, borderTopWidth: 1, borderTopColor: theme.colors.borderDim },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  ctxStepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.borderDim, borderRadius: 6 },
  ctxToggle: { minWidth: 34, height: 30, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.borderDim, borderRadius: 6 },
  ctxToggleActive: { backgroundColor: theme.colors.surfaceSoft, borderColor: theme.colors.border },
  ctxLockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.colors.borderDim, borderRadius: 6 },
  ctxValue: { color: theme.colors.text, fontSize: 12, minWidth: 34, textAlign: 'center' },
  ctxText: { color: theme.colors.secondary, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  ctxDivider: { width: 1, height: 22, backgroundColor: theme.colors.borderDim, marginHorizontal: 2 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.border },
  swatchActive: { borderColor: theme.colors.info, borderWidth: 2 },
  swatchCustom: { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSoft },
  toolbarWrap: { backgroundColor: theme.colors.background, borderTopWidth: 1, borderTopColor: theme.colors.borderDim },
  toolbarRow: { flexDirection: 'row', alignItems: 'center' },
  toolbarScroll: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 10, paddingRight: 4, paddingVertical: 8 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10, paddingLeft: 4, borderLeftWidth: 1, borderLeftColor: theme.colors.borderDim },
  toolBtn: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  toolBtnActive: { backgroundColor: theme.colors.surfaceSoft },
  toolBtnDisabled: { opacity: 0.4 },
  modalFooterEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
});

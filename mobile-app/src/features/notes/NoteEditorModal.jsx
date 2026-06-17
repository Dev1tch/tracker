import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft } from 'lucide-react-native';

import { mediaApi } from '../../shared/api';
import { useTheme } from '../../theme';
import { useToast } from '../../providers/ToastProvider';
import ColorPickerSheet from '../../components/ColorPickerSheet';

// Self-contained contentEditable + execCommand editor. It round-trips the same
// HTML the web app stores in `file.content` (bold/italic/underline, lists, align,
// font family/size, text color, and the bespoke "frame" boxed-text spans), so
// notes look identical across web and mobile. The editor chrome (toolbar, panels,
// borders, body bg/text) is themed from the active theme.
const buildEditorHtml = (theme) => {
  const c = theme.colors;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; height: 100%; background: ${c.background}; color: ${c.text};
    font-family: -apple-system, system-ui, Roboto, sans-serif; }
  body { display: flex; flex-direction: column; }
  #toolbar { flex: 0 0 auto; z-index: 5; display: flex; flex-wrap: nowrap; gap: 4px;
    padding: 8px; background: ${c.card}; border-bottom: 1px solid ${c.borderDim};
    overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
  #toolbar::-webkit-scrollbar { display: none; }
  #toolbar button, .panelBtn { flex: 0 0 auto; background: transparent; color: ${c.text}; border: 1px solid ${c.border};
    border-radius: 4px; min-width: 34px; height: 32px; font-size: 13px; padding: 0 8px; }
  #toolbar button:active, .panelBtn:active { background: ${c.surfaceSoft}; }
  .tsep { flex: 0 0 auto; width: 1px; align-self: stretch; margin: 1px 4px; background: ${c.border}; }
  #panel { display: none; flex: 0 0 auto; flex-wrap: wrap; gap: 6px; padding: 10px;
    background: ${c.card}; border-bottom: 1px solid ${c.borderDim}; }
  #panel.show { display: flex; }
  .swatch { width: 28px; height: 28px; border-radius: 14px; border: 1px solid ${c.border}; padding: 0; }
  .swatch.sel { box-shadow: 0 0 0 2px ${c.info}; }
  .customPick { display: inline-flex; align-items: center; gap: 6px; }
  .pickDot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
  .panelLabel { color: ${c.tertiary}; font-size: 10px; letter-spacing: 1px;
    text-transform: uppercase; align-self: center; margin: 0 4px; width: 100%; }
  #editor { flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch;
    padding: 16px; font-size: 16px; line-height: 1.8;
    outline: none; white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
  #editor:empty:before { content: attr(data-placeholder); color: ${c.muted}; }
  #editor img { max-width: 100%; height: auto; border-radius: 6px; }
  #editor img[data-wrap="left"] { float: left; margin: 4px 12px 4px 0; }
  #editor img[data-wrap="right"] { float: right; margin: 4px 0 4px 12px; }
  #editor img[data-wrap="center"] { display: block; margin: 8px auto; float: none; }
  #imgbar { display: none; flex: 0 0 auto; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px;
    background: ${c.card}; border-bottom: 1px solid ${c.borderDim}; }
  #imgbar.show { display: flex; }
  #imgbar button { background: transparent; color: ${c.text}; border: 1px solid ${c.border};
    border-radius: 4px; min-width: 44px; height: 32px; font-size: 12px; padding: 0 8px; }
  #imgbar input[type=range] { width: 96px; accent-color: ${c.info}; }
</style>
</head>
<body>
<div id="toolbar">
  <button data-cmd="undo" title="Undo">&#8634;</button>
  <button data-cmd="redo" title="Redo">&#8635;</button>
  <span class="tsep"></span>
  <button data-cmd="bold"><b>B</b></button>
  <button data-cmd="italic"><i>I</i></button>
  <button data-cmd="underline"><u>U</u></button>
  <button id="colorBtn">Color</button>
  <button id="frameBtn">Frame</button>
  <span class="tsep"></span>
  <button id="fontBtn">Font</button>
  <button id="sizeBtn">Size</button>
  <span class="tsep"></span>
  <button data-cmd="insertUnorderedList">&bull;</button>
  <button data-cmd="insertOrderedList">1.</button>
  <button data-cmd="justifyLeft">&#8676;</button>
  <button data-cmd="justifyCenter">&#8596;</button>
  <button data-cmd="justifyRight">&#8677;</button>
  <span class="tsep"></span>
  <button id="imgBtn">Image</button>
</div>
<div id="panel"></div>
<div id="imgbar">
  <span class="panelLabel">Image</span>
  <button data-img="left">Left</button>
  <button data-img="center">Center</button>
  <button data-img="right">Right</button>
  <input type="range" id="imgsize" min="15" max="100" value="100" />
  <button data-img="del">Delete</button>
</div>
<div id="editor" contenteditable="true" data-placeholder="Start typing..."></div>
<script>
  var editor = document.getElementById('editor');
  var panel = document.getElementById('panel');
  var savedRange = null;
  var currentColor = '#ffffff';
  var frameColor = '#60a5fa';
  var FONTS = [['System',''],['Inter','Inter, sans-serif'],['Arial','Arial, sans-serif'],['Georgia','Georgia, serif'],['Times','"Times New Roman", serif'],['Verdana','Verdana, sans-serif'],['Trebuchet','"Trebuchet MS", sans-serif'],['Courier','"Courier New", monospace'],['Menlo','Menlo, monospace'],['Impact','Impact, sans-serif']];
  var SIZES = [12,14,15,16,18,20,24,28,32];
  var COLORS = ['#ffffff','#94a3b8','#f87171','#fbbf24','#34d399','#60a5fa','#a78bfa','#fb7185','#2dd4bf','#f97316','#e879f9','#22d3ee'];

  function post(msg){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  var timer = null;
  function change(){ clearTimeout(timer); timer = setTimeout(function(){ post({ type: 'change', html: editor.innerHTML }); }, 300); }
  function saveRange(){ var sel = window.getSelection(); if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0); }
  function restoreRange(){ if (savedRange){ var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); } }
  function bindMD(el){ el.addEventListener('mousedown', function(e){ e.preventDefault(); }); }

  function exec(cmd){ editor.focus(); restoreRange(); document.execCommand(cmd, false, null); change(); }

  function wrapSelection(applyFn){
    editor.focus(); restoreRange();
    var sel = window.getSelection(); if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0); if (range.collapsed) return;
    var span = document.createElement('span'); applyFn(span);
    try { range.surroundContents(span); }
    catch (e) { try { var frag = range.extractContents(); span.appendChild(frag); range.insertNode(span); } catch (e2) { return; } }
    var nr = document.createRange(); nr.selectNodeContents(span);
    sel.removeAllRanges(); sel.addRange(nr); savedRange = nr;
    change();
  }

  function closePanel(){ panel.className = ''; panel.innerHTML = ''; }
  function mkBtn(label){ var b = document.createElement('button'); b.className = 'panelBtn'; b.textContent = label; bindMD(b); return b; }
  var PIPETTE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12"/><path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z"/><path d="m2 22 .414-.414"/></svg>';
  function mkPick(color){ var b = document.createElement('button'); b.className = 'panelBtn customPick'; b.innerHTML = '<span class="pickDot" style="background:' + color + '"></span>' + PIPETTE; bindMD(b); return b; }

  function openPanel(mode){
    if (panel.className === 'show' && panel.getAttribute('data-mode') === mode){ closePanel(); return; }
    panel.innerHTML = ''; panel.className = 'show'; panel.setAttribute('data-mode', mode);
    if (mode === 'font'){
      FONTS.forEach(function(f){ var b = mkBtn(f[0]); b.style.fontFamily = f[1] || 'inherit';
        b.addEventListener('click', function(e){ e.preventDefault(); wrapSelection(function(s){ s.style.fontFamily = f[1]; }); closePanel(); }); panel.appendChild(b); });
    } else if (mode === 'size'){
      SIZES.forEach(function(sz){ var b = mkBtn(String(sz));
        b.addEventListener('click', function(e){ e.preventDefault(); wrapSelection(function(s){ s.style.fontSize = sz + 'px'; }); closePanel(); }); panel.appendChild(b); });
    } else if (mode === 'color'){
      var clabel = document.createElement('span'); clabel.className = 'panelLabel'; clabel.textContent = 'Text color';
      panel.appendChild(clabel);
      COLORS.forEach(function(c){ var b = document.createElement('button'); b.className = 'swatch'; b.style.background = c; bindMD(b);
        b.addEventListener('click', function(e){ e.preventDefault(); currentColor = c; editor.focus(); restoreRange(); document.execCommand('foreColor', false, c); change(); closePanel(); }); panel.appendChild(b); });
      var ccustom = mkPick(currentColor);
      ccustom.addEventListener('click', function(e){ e.preventDefault(); post({ type: 'pickColor', target: 'text', current: currentColor }); });
      panel.appendChild(ccustom);
    } else if (mode === 'frame'){
      var label = document.createElement('span'); label.className = 'panelLabel'; label.textContent = 'Frame color';
      panel.appendChild(label);
      COLORS.forEach(function(c){ var b = document.createElement('button'); b.className = 'swatch'; b.style.background = c;
        if (c === frameColor) b.classList.add('sel'); bindMD(b);
        b.addEventListener('click', function(e){ e.preventDefault(); frameColor = c;
          Array.prototype.forEach.call(panel.querySelectorAll('.swatch'), function(s){ s.classList.remove('sel'); });
          b.classList.add('sel'); });
        panel.appendChild(b); });
      var fcustom = mkPick(frameColor);
      fcustom.addEventListener('click', function(e){ e.preventDefault(); post({ type: 'pickColor', target: 'frame', current: frameColor }); });
      panel.appendChild(fcustom);
      [['Outline','outline'],['Fill','fill'],['Remove','remove']].forEach(function(o){ var b = mkBtn(o[0]);
        b.addEventListener('click', function(e){ e.preventDefault(); if (o[1] === 'remove'){ removeFrame(); } else { applyFrame(o[1]); } closePanel(); }); panel.appendChild(b); });
    }
  }

  function applyFrame(kind){
    wrapSelection(function(s){
      s.setAttribute('data-notes-frame', 'true');
      s.setAttribute('data-frame-style', kind);
      s.style.border = '1px solid ' + frameColor;
      s.style.borderRadius = '3px';
      s.style.padding = '0 4px';
      if (kind === 'fill'){ s.style.background = frameColor; s.style.color = '#000'; }
    });
  }

  function removeFrame(){
    editor.focus(); restoreRange();
    var sel = window.getSelection(); if (!sel.rangeCount) return;
    var node = sel.getRangeAt(0).startContainer;
    var n = node.nodeType === 3 ? node.parentNode : node;
    while (n && n !== editor){
      if (n.getAttribute && n.getAttribute('data-notes-frame') === 'true'){
        n.removeAttribute('data-notes-frame'); n.removeAttribute('data-frame-style');
        n.style.border = ''; n.style.background = ''; n.style.borderRadius = ''; n.style.padding = ''; n.style.color = '';
        break;
      }
      n = n.parentNode;
    }
    change();
  }

  editor.addEventListener('input', change);
  editor.addEventListener('keyup', saveRange);
  editor.addEventListener('mouseup', saveRange);

  Array.prototype.forEach.call(document.querySelectorAll('#toolbar button[data-cmd]'), function(b){
    bindMD(b);
    b.addEventListener('click', function(e){ e.preventDefault(); exec(b.getAttribute('data-cmd')); });
  });
  [['fontBtn','font'],['sizeBtn','size'],['colorBtn','color'],['frameBtn','frame']].forEach(function(pair){
    var btn = document.getElementById(pair[0]); bindMD(btn);
    btn.addEventListener('click', function(e){ e.preventDefault(); openPanel(pair[1]); });
  });
  var imgBtn = document.getElementById('imgBtn'); bindMD(imgBtn);
  imgBtn.addEventListener('click', function(e){ e.preventDefault(); post({ type: 'pickImage' }); });

  // Image selection toolbar (align / size slider / delete). Shown as a fixed bar
  // right under the main toolbar when an image is tapped (not floating at the image).
  var imgbar = document.getElementById('imgbar');
  var imgsize = document.getElementById('imgsize');
  var selectedImg = null;
  function deselectImg(){ if (selectedImg){ selectedImg.style.outline = ''; } selectedImg = null; imgbar.classList.remove('show'); }
  function selectImg(img){
    deselectImg(); selectedImg = img; img.style.outline = '2px solid #60a5fa';
    var w = parseInt(img.style.width, 10); imgsize.value = (w && !isNaN(w)) ? w : 100;
    imgbar.classList.add('show');
  }
  editor.addEventListener('click', function(e){
    if (e.target && e.target.tagName === 'IMG'){ selectImg(e.target); }
    else { deselectImg(); }
  });
  imgsize.addEventListener('input', function(){
    if (!selectedImg) return;
    selectedImg.style.width = imgsize.value + '%';
    selectedImg.style.height = 'auto';
    change();
  });
  Array.prototype.forEach.call(imgbar.querySelectorAll('button'), function(b){
    bindMD(b);
    b.addEventListener('click', function(e){
      e.preventDefault();
      if (!selectedImg) return;
      var kind = b.getAttribute('data-img');
      if (kind === 'del'){ var img = selectedImg; deselectImg(); img.parentNode && img.parentNode.removeChild(img); change(); return; }
      if (kind === 'left' || kind === 'right' || kind === 'center'){ selectedImg.setAttribute('data-wrap', kind); }
      change();
    });
  });

  // Auto-list: typing "1." / "-" / "*" at the very start of a line + space.
  function inList(node){ var n = node && node.nodeType === 3 ? node.parentNode : node;
    while (n && n !== editor){ if (n.nodeName === 'LI' || n.nodeName === 'OL' || n.nodeName === 'UL') return true; n = n.parentNode; } return false; }
  editor.addEventListener('keydown', function(e){
    if (e.key !== ' ') return;
    var sel = window.getSelection(); if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0); if (!range.collapsed) return;
    var tn = range.startContainer; if (tn.nodeType !== 3) return;
    var before = tn.textContent.slice(0, range.startOffset);
    var m = /^(\\s*)(\\d+\\.|[-*])$/.exec(before);
    if (!m || inList(tn)) return;
    e.preventDefault();
    var markerLen = m[2].length;
    tn.textContent = tn.textContent.slice(0, range.startOffset - markerLen) + tn.textContent.slice(range.startOffset);
    var nr = document.createRange(); nr.setStart(tn, Math.max(range.startOffset - markerLen, 0)); nr.collapse(true);
    sel.removeAllRanges(); sel.addRange(nr); savedRange = nr;
    document.execCommand(m[2].charAt(m[2].length - 1) === '.' ? 'insertOrderedList' : 'insertUnorderedList');
    change();
  });

  window.setContent = function(html){ editor.innerHTML = html || ''; };
  window.applyTextColor = function(hex){ currentColor = hex; editor.focus(); restoreRange(); document.execCommand('foreColor', false, hex); change(); closePanel(); };
  window.setFrameColor = function(hex){ frameColor = hex; var sws = panel.querySelectorAll('.swatch'); Array.prototype.forEach.call(sws, function(s){ s.classList.remove('sel'); }); };
  window.insertImage = function(url){ editor.focus(); restoreRange();
    document.execCommand('insertHTML', false, '<img src="' + url + '" />'); change(); };
  post({ type: 'ready' });
</script>
</body>
</html>`;
};

function formatModified(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `Last modified ${date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })}`;
}

export default function NoteEditorModal({ visible, file, onChangeContent, onChangeTitle, onClose }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const addToast = useToast();
  const insets = useSafeAreaInsets();
  const webRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [colorPicker, setColorPicker] = useState(null);
  const initialContentRef = useRef('');

  // Capture the content to seed once when the modal opens (keyed by file id below).
  initialContentRef.current = file?.content || '';

  const handleMessage = useCallback(async (event) => {
    let payload;
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    if (payload.type === 'ready') {
      webRef.current?.injectJavaScript(
        `window.setContent(${JSON.stringify(initialContentRef.current)}); true;`
      );
      return;
    }

    if (payload.type === 'change') {
      onChangeContent(payload.html || '');
      return;
    }

    if (payload.type === 'pickColor') {
      setColorPicker({
        target: payload.target,
        value: payload.current && String(payload.current).charAt(0) === '#' ? payload.current : '#ffffff',
      });
      return;
    }

    if (payload.type === 'pickImage') {
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          addToast('Photo permission is required to add images.', 'error');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
        if (result.canceled || !result.assets?.length) return;

        setSaving(true);
        const asset = result.assets[0];
        const uploaded = await mediaApi.upload({
          file: {
            uri: asset.uri,
            name: asset.fileName || asset.uri.split('/').pop() || 'note-image.jpg',
            type: asset.mimeType || 'image/jpeg',
          },
          kind: 'notes',
        });
        const url = uploaded?.url || '';
        if (!url) {
          addToast('Image upload failed.', 'error');
          return;
        }
        webRef.current?.injectJavaScript(`window.insertImage(${JSON.stringify(url)}); true;`);
      } catch (error) {
        console.error('Failed to add note image', error);
        addToast(error?.message || 'Failed to add image.', 'error');
      } finally {
        setSaving(false);
      }
    }
  }, [addToast, onChangeContent]);

  // Remount the WebView per file so it seeds the right content with a fresh history.
  const webViewKey = useMemo(() => file?.id || 'none', [file?.id]);
  const editorHtml = useMemo(() => buildEditorHtml(theme), [theme]);
  const modified = formatModified(file?.updatedAt);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={styles.header}>
          <View style={styles.breadcrumbRow}>
            <Pressable hitSlop={12} onPress={onClose} style={styles.backButton}>
              <ChevronLeft color={theme.colors.secondary} size={18} strokeWidth={1.7} />
              <Text style={styles.breadcrumb}>Notes</Text>
            </Pressable>
            {saving ? <ActivityIndicator color={theme.colors.tertiary} size="small" /> : null}
          </View>

          <TextInput
            style={styles.titleInput}
            value={file?.name || ''}
            onChangeText={onChangeTitle}
            placeholder="Untitled note"
            placeholderTextColor={theme.colors.muted}
            multiline
          />

          {modified ? <Text style={styles.modifiedLabel}>{modified}</Text> : null}
        </View>

        {file ? (
          <WebView
            key={webViewKey}
            ref={webRef}
            originWhitelist={['*']}
            source={{ html: editorHtml }}
            onMessage={handleMessage}
            keyboardDisplayRequiresUserAction={false}
            hideKeyboardAccessoryView
            // Disable the WebView's own scroll so the page can't scroll as a whole
            // (which dragged the toolbar away). Only the inner #editor scrolls.
            scrollEnabled={false}
            nestedScrollEnabled
            style={styles.webview}
            containerStyle={styles.webviewContainer}
          />
        ) : null}

        <ColorPickerSheet
          visible={!!colorPicker}
          title={colorPicker?.target === 'frame' ? 'Frame color' : 'Text color'}
          value={colorPicker?.value || '#ffffff'}
          presetColors={['#ffffff', '#94a3b8', '#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#fb7185', '#2dd4bf', '#f97316', '#e879f9', '#22d3ee']}
          onChange={(hex) => setColorPicker((prev) => (prev ? { ...prev, value: hex } : prev))}
          onClose={() => {
            const picked = colorPicker;
            setColorPicker(null);
            if (picked) {
              const fn = picked.target === 'frame' ? 'window.setFrameColor' : 'window.applyTextColor';
              webRef.current?.injectJavaScript(`${fn}(${JSON.stringify(picked.value)}); true;`);
            }
          }}
        />
      </View>
    </Modal>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderDim,
    gap: 8,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingRight: 8,
  },
  breadcrumb: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  titleInput: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 0.3,
    paddingVertical: 2,
  },
  modifiedLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  webviewContainer: {
    backgroundColor: theme.colors.background,
  },
});

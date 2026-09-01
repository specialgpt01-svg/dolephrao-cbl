// LOFT LEARN - Admin Sources & Bases Component
let adminSourcesCache = [];
let adminBasesCache = [];
let adminBasesCacheMap = {};
let adminDraggedBaseId = null;
let adminCertSimulationMode = false;
let selectedAdminCertField = 'name';

function escapeJS(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const ADMIN_CERT_TEXT_FIELDS = {
  name: { label: 'ชื่อผู้เรียน', marker: '.cert-marker-name', prefix: 'admin-source-cert-name', defaults: { x: 50, y: 36, width: 62, fontSize: 35, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  source: { label: 'แหล่งเรียนรู้', marker: '.cert-marker-source', prefix: 'admin-source-cert-source', defaults: { x: 50, y: 47, width: 72, fontSize: 19.5, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  score: { label: 'คะแนน', marker: '.cert-marker-score', prefix: 'admin-source-cert-score', defaults: { x: 50, y: 56, width: 40, fontSize: 17.5, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  date: { label: 'วันที่', marker: '.cert-marker-date', prefix: 'admin-source-cert-date', defaults: { x: 50, y: 65, width: 42, fontSize: 17.5, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  refNo: { label: 'เลขอ้างอิง', marker: '.cert-marker-ref', prefix: 'admin-source-cert-ref', defaults: { x: 50, y: 88, width: 45, fontSize: 10.5, fontFamily: 'Sarabun', color: '#6b7280', bold: false, italic: false, align: 'center' } }
};

  function scrollAdminEditorPanel(tabId) {
    const panel = document.querySelector('#admin-tab-' + tabId + ' .admin-editor-panel');
    if (window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) {
      if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSourceImageUpload(input) {
    if (input.files && input.files[0]) {
      currentCropContext = 'source';
      currentFileName = "source_" + Date.now() + "_" + input.files[0].name;
      openCropModal(input.files[0]);
    }
  }

  function handleBaseImageUpload(input) {
    if (input.files && input.files[0]) {
      currentCropContext = 'base';
      currentFileName = "base_" + Date.now() + "_" + input.files[0].name;
      openCropModal(input.files[0]);
    }
  }

  function handleSourceCertificateUpload(input) {
    if (input.files && input.files[0]) {
      currentCropContext = 'certificateTemplate';
      currentFileName = "certificate_template_" + Date.now() + "_" + input.files[0].name;
      openCropModal(input.files[0]);
    }
  }

  function handleSourceCertSignatureUpload(input) {
    if (input.files && input.files[0]) {
      currentCropContext = 'certSignature';
      currentFileName = "cert_signature_" + Date.now() + "_" + input.files[0].name;
      openCropModal(input.files[0]);
    }
  }

  function setNumberValue(id, value, fallback) {
    const el = document.getElementById(id);
    if (!el) return;
    const n = Number(value);
    el.value = Number.isFinite(n) ? String(n) : String(fallback);
  }

  function getNumberValue(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function setTextValue(id, value, fallback) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value == null || value === '' ? fallback : String(value);
  }

  function getTextValue(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const value = String(el.value || '').trim();
    return value || fallback;
  }

  function setBoolValue(id, value, fallback) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = value == null ? fallback : value;
    el.value = (v === true || String(v) === 'true') ? 'true' : 'false';
  }

  function getBoolValue(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const value = String(el.value || '').toLowerCase();
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  }

  function getAdminCertFieldState(key) {
    const cfg = ADMIN_CERT_TEXT_FIELDS[key];
    if (!cfg) return null;
    const p = cfg.prefix;
    const d = cfg.defaults;
    return {
      x: getNumberValue(p + '-x', d.x),
      y: getNumberValue(p + '-y', d.y),
      width: getNumberValue(p + '-w', d.width),
      fontSize: getNumberValue(p + '-size', d.fontSize),
      fontFamily: getTextValue(p + '-font', d.fontFamily),
      color: getTextValue(p + '-color', d.color),
      bold: getBoolValue(p + '-bold', d.bold),
      italic: getBoolValue(p + '-italic', d.italic),
      align: getTextValue(p + '-align', d.align)
    };
  }

  function setAdminCertFieldState(key, data) {
    const cfg = ADMIN_CERT_TEXT_FIELDS[key];
    if (!cfg) return;
    const p = cfg.prefix;
    const d = cfg.defaults;
    setNumberValue(p + '-x', data.x, d.x);
    setNumberValue(p + '-y', data.y, d.y);
    setNumberValue(p + '-w', data.width, d.width);
    setNumberValue(p + '-size', data.fontSize, d.fontSize);
    setTextValue(p + '-font', data.fontFamily, d.fontFamily);
    setTextValue(p + '-color', data.color, d.color);
    setBoolValue(p + '-bold', data.bold, d.bold);
    setBoolValue(p + '-italic', data.italic, d.italic);
    setTextValue(p + '-align', data.align, d.align);
  }

  function getAdminCertCustomRow(index) {
    const rows = document.querySelectorAll('.admin-cert-custom-field-row');
    return rows[index] || null;
  }

  function getAdminCertCustomState(row) {
    if (!row) return null;
    return {
      text: ((row.querySelector('.custom-field-text') || {}).value || '').trim(),
      x: parseFloat((row.querySelector('.custom-field-x') || {}).value) || 50,
      y: parseFloat((row.querySelector('.custom-field-y') || {}).value) || 50,
      width: parseFloat((row.querySelector('.custom-field-width') || {}).value) || 45,
      fontSize: parseFloat((row.querySelector('.custom-field-size') || {}).value) || 16,
      fontFamily: ((row.querySelector('.custom-field-font') || {}).value || 'Sarabun').trim(),
      color: ((row.querySelector('.custom-field-color') || {}).value || '#111827').trim(),
      bold: String(((row.querySelector('.custom-field-bold') || {}).value || 'false')).toLowerCase() === 'true',
      italic: String(((row.querySelector('.custom-field-italic') || {}).value || 'false')).toLowerCase() === 'true',
      align: ((row.querySelector('.custom-field-align') || {}).value || 'center').trim()
    };
  }

  function setAdminCertCustomState(row, state) {
    if (!row || !state) return;
    const set = (selector, value) => {
      const el = row.querySelector(selector);
      if (el) el.value = value;
    };
    set('.custom-field-text', state.text || '');
    set('.custom-field-x', Number.isFinite(Number(state.x)) ? state.x : 50);
    set('.custom-field-y', Number.isFinite(Number(state.y)) ? state.y : 50);
    set('.custom-field-width', Number.isFinite(Number(state.width)) ? state.width : 45);
    set('.custom-field-size', Number.isFinite(Number(state.fontSize)) ? state.fontSize : 16);
    set('.custom-field-font', state.fontFamily || 'Sarabun');
    set('.custom-field-color', state.color || '#111827');
    set('.custom-field-bold', state.bold ? 'true' : 'false');
    set('.custom-field-italic', state.italic ? 'true' : 'false');
    set('.custom-field-align', state.align || 'center');
  }

  function getSelectedAdminCertState() {
    if (selectedAdminCertField.startsWith('custom:')) {
      const row = getAdminCertCustomRow(Number(selectedAdminCertField.split(':')[1]));
      return getAdminCertCustomState(row);
    }
    return getAdminCertFieldState(selectedAdminCertField);
  }

  function setSelectedAdminCertState(state) {
    if (!state) return;
    if (selectedAdminCertField.startsWith('custom:')) {
      const row = getAdminCertCustomRow(Number(selectedAdminCertField.split(':')[1]));
      setAdminCertCustomState(row, state);
      return;
    }
    setAdminCertFieldState(selectedAdminCertField, state);
  }

  function getAdminCertScaleRatio() {
    const preview = document.getElementById('admin-source-cert-preview');
    if (!preview) return 0.48;
    const rect = preview.getBoundingClientRect();
    let containerWidth = rect.width;
    if (!containerWidth || containerWidth < 100) {
      containerWidth = preview.parentElement ? preview.parentElement.clientWidth : 480;
    }
    if (!containerWidth || containerWidth < 100) containerWidth = 480;
    return containerWidth / 1000;
  }

  function applyAdminCertMarkerStyle(marker, state) {
    if (!marker || !state) return;
    marker.style.left = state.x + '%';
    marker.style.top = state.y + '%';
    marker.style.width = state.width + '%';
    marker.style.fontSize = Math.max(6, state.fontSize * getAdminCertScaleRatio()) + 'px';
    marker.style.fontFamily = '"' + (state.fontFamily || 'Sarabun') + '","Noto Sans Thai",Arial,sans-serif';
    marker.style.color = state.color || '#111827';
    marker.style.fontWeight = state.bold ? '900' : '500';
    marker.style.fontStyle = state.italic ? 'italic' : 'normal';
    marker.style.textAlign = state.align || 'center';
  }

  function refreshAdminCertFieldSelector() {
    const select = document.getElementById('admin-cert-selected-field');
    if (!select) return;
    const oldValue = selectedAdminCertField || select.value || 'name';
    const builtIns = Object.keys(ADMIN_CERT_TEXT_FIELDS).map(key => '<option value="' + key + '">' + ADMIN_CERT_TEXT_FIELDS[key].label + '</option>');
    const customOptions = [];
    document.querySelectorAll('.admin-cert-custom-field-row').forEach((row, idx) => {
      const state = getAdminCertCustomState(row) || {};
      const label = (state.text || 'ข้อความเอง ' + (idx + 1)).slice(0, 24);
      customOptions.push('<option value="custom:' + idx + '">' + label + '</option>');
    });
    select.innerHTML = builtIns.concat(customOptions).join('');
    select.value = select.querySelector('option[value="' + oldValue + '"]') ? oldValue : 'name';
    selectedAdminCertField = select.value;
  }

  function syncAdminCertToolbar() {
    const toolbar = document.getElementById('admin-cert-text-toolbar');
    const preview = document.getElementById('admin-source-cert-preview');
    if (toolbar) toolbar.style.display = (preview && preview.style.display !== 'none') ? 'flex' : 'none';
    refreshAdminCertFieldSelector();
    const state = getSelectedAdminCertState() || getAdminCertFieldState('name');
    if (!state) return;
    const font = document.getElementById('admin-cert-toolbar-font');
    const size = document.getElementById('admin-cert-toolbar-size');
    const color = document.getElementById('admin-cert-toolbar-color');
    if (font) font.value = state.fontFamily || 'Sarabun';
    if (size) size.value = state.fontSize || 16;
    if (color) color.value = state.color || '#111827';
    const boldBtn = document.getElementById('admin-cert-toolbar-bold');
    const italicBtn = document.getElementById('admin-cert-toolbar-italic');
    if (boldBtn) boldBtn.classList.toggle('active', !!state.bold);
    if (italicBtn) italicBtn.classList.toggle('active', !!state.italic);

    const previewEl = document.getElementById('admin-source-cert-preview');
    if (previewEl) {
      previewEl.querySelectorAll('.cert-position-marker').forEach(el => el.classList.remove('is-selected'));
      let selectedEl = null;
      if (selectedAdminCertField.startsWith('custom:')) {
        selectedEl = previewEl.querySelector('.cert-marker-custom[data-cert-field="' + selectedAdminCertField + '"]');
      } else {
        const cfg = ADMIN_CERT_TEXT_FIELDS[selectedAdminCertField];
        selectedEl = cfg ? previewEl.querySelector(cfg.marker) : null;
      }
      if (selectedEl) selectedEl.classList.add('is-selected');
    }
  }

  function selectAdminCertText(value) {
    selectedAdminCertField = value || 'name';
    syncAdminCertToolbar();
  }

  function applyAdminCertToolbarChange() {
    const state = getSelectedAdminCertState();
    if (!state) return;
    const font = document.getElementById('admin-cert-toolbar-font');
    const size = document.getElementById('admin-cert-toolbar-size');
    const color = document.getElementById('admin-cert-toolbar-color');
    state.fontFamily = font ? font.value : state.fontFamily;
    state.fontSize = size ? Number(size.value) || state.fontSize : state.fontSize;
    state.color = color ? color.value : state.color;
    setSelectedAdminCertState(state);
    updateAdminSourceCertPreview();
  }

  function changeAdminCertFontSize(delta) {
    const size = document.getElementById('admin-cert-toolbar-size');
    if (!size) return;
    const next = Math.max(6, Math.min(96, (Number(size.value) || 16) + delta));
    size.value = String(next);
    applyAdminCertToolbarChange();
  }

  function toggleAdminCertStyle(prop) {
    const state = getSelectedAdminCertState();
    if (!state) return;
    if (prop === 'bold') state.bold = !state.bold;
    if (prop === 'italic') state.italic = !state.italic;
    setSelectedAdminCertState(state);
    updateAdminSourceCertPreview();
  }

  function setAdminCertAlign(align) {
    const state = getSelectedAdminCertState();
    if (!state) return;
    state.align = ['left', 'center', 'right'].includes(align) ? align : 'center';
    setSelectedAdminCertState(state);
    updateAdminSourceCertPreview();
  }

  function makeMarkerDraggable(markerEl, inputX, inputY) {
    if (!markerEl) return;
    if (markerEl.dataset.draggableBound === "true") return;
    markerEl.dataset.draggableBound = "true";

    let isDragging = false;
    let startX, startY;
    let startLeft, startTop;

    const xInput = typeof inputX === 'string' ? document.getElementById(inputX) : inputX;
    const yInput = typeof inputY === 'string' ? document.getElementById(inputY) : inputY;

    function onStart(e) {
      e.preventDefault();
      if (markerEl.dataset.certField) {
        selectedAdminCertField = markerEl.dataset.certField;
        syncAdminCertToolbar();
      }
      isDragging = true;
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;

      startLeft = xInput ? parseFloat(xInput.value) : 50;
      startTop = yInput ? parseFloat(yInput.value) : 50;

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
    }

    function onMove(e) {
      if (!isDragging) return;
      const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
      const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;

      const dx = clientX - startX;
      const dy = clientY - startY;

      const previewContainer = document.getElementById('admin-source-cert-preview');
      if (!previewContainer) return;
      const rect = previewContainer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const pctDx = (dx / rect.width) * 100;
      const pctDy = (dy / rect.height) * 100;

      let newX = startLeft + pctDx;
      let newY = startTop + pctDy;

      newX = Math.max(0, Math.min(100, parseFloat(newX.toFixed(1))));
      newY = Math.max(0, Math.min(100, parseFloat(newY.toFixed(1))));

      if (xInput) xInput.value = String(newX);
      if (yInput) yInput.value = String(newY);

      markerEl.style.left = newX + '%';
      markerEl.style.top = newY + '%';
    }

    function onEnd() {
      isDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }

    markerEl.addEventListener('mousedown', onStart);
    markerEl.addEventListener('touchstart', onStart, { passive: false });
    markerEl.addEventListener('click', function(e) {
      e.preventDefault();
      if (markerEl.dataset.certField) {
        selectedAdminCertField = markerEl.dataset.certField;
        syncAdminCertToolbar();
      }
    });
  }

  function bindMarkerDraggables() {
    const preview = document.getElementById('admin-source-cert-preview');
    if (!preview) return;
    makeMarkerDraggable(preview.querySelector('.cert-marker-name'), 'admin-source-cert-name-x', 'admin-source-cert-name-y');
    makeMarkerDraggable(preview.querySelector('.cert-marker-source'), 'admin-source-cert-source-x', 'admin-source-cert-source-y');
    makeMarkerDraggable(preview.querySelector('.cert-marker-score'), 'admin-source-cert-score-x', 'admin-source-cert-score-y');
    makeMarkerDraggable(preview.querySelector('.cert-marker-date'), 'admin-source-cert-date-x', 'admin-source-cert-date-y');
    makeMarkerDraggable(preview.querySelector('.cert-marker-ref'), 'admin-source-cert-ref-x', 'admin-source-cert-ref-y');
    makeMarkerDraggable(preview.querySelector('.cert-marker-sig'), 'admin-source-cert-sig-x', 'admin-source-cert-sig-y');
  }

  function bindCertInputListeners() {
    const inputs = [
      'admin-source-cert-name-x', 'admin-source-cert-name-y', 'admin-source-cert-name-w', 'admin-source-cert-name-size',
      'admin-source-cert-source-x', 'admin-source-cert-source-y', 'admin-source-cert-source-w', 'admin-source-cert-source-size',
      'admin-source-cert-score-x', 'admin-source-cert-score-y', 'admin-source-cert-score-w', 'admin-source-cert-score-size',
      'admin-source-cert-date-x', 'admin-source-cert-date-y', 'admin-source-cert-date-w', 'admin-source-cert-date-size',
      'admin-source-cert-ref-x', 'admin-source-cert-ref-y', 'admin-source-cert-ref-w', 'admin-source-cert-ref-size',
      'admin-source-cert-sig-x', 'admin-source-cert-sig-y', 'admin-source-cert-sig-w'
    ];
    Object.keys(ADMIN_CERT_TEXT_FIELDS).forEach(key => {
      const p = ADMIN_CERT_TEXT_FIELDS[key].prefix;
      inputs.push(p + '-font', p + '-color', p + '-bold', p + '-italic', p + '-align');
    });
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.listenerBound) {
        el.dataset.listenerBound = "true";
        el.addEventListener('input', updateAdminSourceCertPreview);
      }
    });
  }

  function addAdminSourceCertCustomFieldRow(f) {
    const container = document.getElementById('admin-source-cert-custom-fields-list');
    if (!container) return;
    const idx = container.querySelectorAll('.admin-cert-custom-field-row').length;
    const field = f || { text: 'ข้อความใหม่', x: 50, y: 50, width: 45, fontSize: 16, fontFamily: 'Sarabun', color: '#111827', bold: false, italic: false, align: 'center' };
    
    const row = document.createElement('div');
    row.className = 'admin-cert-custom-field-row loft-card flex flex-col gap-2 p-3 mb-2';
    row.style.background = 'var(--bg2)';
    row.style.border = '1px solid var(--card-border)';
    row.style.margin = '0 0 8px 0';
    row.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="text-xxs font-bold text-muted">แถวที่ ${idx + 1}</span>
        <button type="button" class="btn-primary" style="padding:4px 8px; font-size:0.68rem; background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="this.closest('.admin-cert-custom-field-row').remove(); selectedAdminCertField='name'; updateAdminSourceCertPreview();">ลบ</button>
      </div>
      <div class="input-group mb-1">
        <i class="fas fa-quote-left"></i>
        <input type="text" class="custom-field-text" placeholder="ข้อความที่ต้องการแสดง" value="${escapeJS(field.text)}">
      </div>
      <div class="grid grid-cols-5 gap-2">
        <label class="text-[10px] text-muted flex flex-col">พิกัด X<input type="number" class="custom-field-x" value="${field.x}" min="0" max="100" step="0.1" style="padding:4px; font-size:0.75rem; border-radius:4px; border:1px solid var(--card-border); background:var(--glass); color:var(--text);"></label>
        <label class="text-[10px] text-muted flex flex-col">พิกัด Y<input type="number" class="custom-field-y" value="${field.y}" min="0" max="100" step="0.1" style="padding:4px; font-size:0.75rem; border-radius:4px; border:1px solid var(--card-border); background:var(--glass); color:var(--text);"></label>
        <label class="text-[10px] text-muted flex flex-col">กว้าง<input type="number" class="custom-field-width" value="${field.width || 45}" min="10" max="100" step="1" style="padding:4px; font-size:0.75rem; border-radius:4px; border:1px solid var(--card-border); background:var(--glass); color:var(--text);"></label>
        <label class="text-[10px] text-muted flex flex-col">ขนาด (pt)<input type="number" class="custom-field-size" value="${field.fontSize}" min="6" max="96" step="1" style="padding:4px; font-size:0.75rem; border-radius:4px; border:1px solid var(--card-border); background:var(--glass); color:var(--text);"></label>
        <label class="text-[10px] text-muted flex flex-col">สีข้อความ<input type="color" class="custom-field-color" value="${field.color}" style="padding:0; height:26px; width:100%; border:none; background:transparent; cursor:pointer;"></label>
      </div>
      <input type="hidden" class="custom-field-font" value="${field.fontFamily || 'Sarabun'}">
      <input type="hidden" class="custom-field-bold" value="${field.bold ? 'true' : 'false'}">
      <input type="hidden" class="custom-field-italic" value="${field.italic ? 'true' : 'false'}">
      <input type="hidden" class="custom-field-align" value="${field.align || 'center'}">
    `;
    
    container.appendChild(row);
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', updateAdminSourceCertPreview);
    });
    selectedAdminCertField = 'custom:' + idx;
    updateAdminSourceCertPreview();
  }

  function setAdminSourceCertificateTemplate(template) {
    const cert = template || {};
    const fields = cert.fields || {};
    const name = fields.name || {};
    const sourceField = fields.source || {};
    const score = fields.score || {};
    const date = fields.date || {};
    const refNoField = fields.refNo || {};
    
    const bgEl = document.getElementById('admin-source-cert-bg');
    if (bgEl) {
      bgEl.value = cert.backgroundUrl || '';
      if (!bgEl._hasCertStatusListener) {
        bgEl._hasCertStatusListener = true;
        bgEl.addEventListener('input', function() {
          updateAdminSourceCertStatusBanner();
        });
      }
    }
    
    // Signature position (URL comes from global settings, only position is per-source)
    const sig = cert.signature || {};
    const sigUrlEl = document.getElementById('admin-source-cert-sig-url');
    if (sigUrlEl) sigUrlEl.value = cert.signatureUrl || '';
    setNumberValue('admin-source-cert-sig-x', sig.x, 50);
    setNumberValue('admin-source-cert-sig-y', sig.y, 80);
    setNumberValue('admin-source-cert-sig-w', sig.width, 15);

    setNumberValue('admin-source-cert-name-x', name.x, 50);
    setNumberValue('admin-source-cert-name-y', name.y, 36);
    setNumberValue('admin-source-cert-name-w', name.width, 62);
    setNumberValue('admin-source-cert-name-size', name.fontSize, 38);
    setNumberValue('admin-source-cert-source-x', sourceField.x, 50);
    setNumberValue('admin-source-cert-source-y', sourceField.y, 47);
    setNumberValue('admin-source-cert-source-w', sourceField.width, 72);
    setNumberValue('admin-source-cert-source-size', sourceField.fontSize, 28);
    setNumberValue('admin-source-cert-score-x', score.x, 50);
    setNumberValue('admin-source-cert-score-y', score.y, 56);
    setNumberValue('admin-source-cert-score-w', score.width, 40);
    setNumberValue('admin-source-cert-score-size', score.fontSize, 18);
    setNumberValue('admin-source-cert-date-x', date.x, 50);
    setNumberValue('admin-source-cert-date-y', date.y, 65);
    setNumberValue('admin-source-cert-date-w', date.width, 42);
    setNumberValue('admin-source-cert-date-size', date.fontSize, 18);
    setNumberValue('admin-source-cert-ref-x', refNoField.x, 50);
    setNumberValue('admin-source-cert-ref-y', refNoField.y, 88);
    setNumberValue('admin-source-cert-ref-w', refNoField.width, 45);
    setNumberValue('admin-source-cert-ref-size', refNoField.fontSize, 14);
    setAdminCertFieldState('name', Object.assign({}, ADMIN_CERT_TEXT_FIELDS.name.defaults, name));
    setAdminCertFieldState('source', Object.assign({}, ADMIN_CERT_TEXT_FIELDS.source.defaults, sourceField));
    setAdminCertFieldState('score', Object.assign({}, ADMIN_CERT_TEXT_FIELDS.score.defaults, score));
    setAdminCertFieldState('date', Object.assign({}, ADMIN_CERT_TEXT_FIELDS.date.defaults, date));
    setAdminCertFieldState('refNo', Object.assign({}, ADMIN_CERT_TEXT_FIELDS.refNo.defaults, refNoField));

    // Populate custom fields list
    const customContainer = document.getElementById('admin-source-cert-custom-fields-list');
    if (customContainer) {
      customContainer.innerHTML = '';
      (cert.customFields || []).forEach(f => {
        addAdminSourceCertCustomFieldRow(f);
      });
    }

    selectedAdminCertField = 'name';
    updateAdminSourceCertPreview();
    updateAdminSourceCertStatusBanner();
  }

  function updateAdminSourceCertStatusBanner() {
    const banner = document.getElementById('admin-source-cert-status-banner');
    if (!banner) return;
    const bg = (document.getElementById('admin-source-cert-bg') || {}).value || '';
    const hasCustom = Boolean(bg.trim());

    if (hasCustom) {
      banner.className = 'loft-card p-3 rounded-xl flex items-center justify-between';
      banner.style.background = 'rgba(16,185,129,0.12)';
      banner.style.border = '1px solid rgba(16,185,129,0.3)';
      banner.style.margin = '0 0 12px 0';
      banner.innerHTML = `
        <div class="flex items-center gap-2">
          <i class="fas fa-certificate text-base" style="color:#10b981;"></i>
          <div>
            <span class="text-xs font-bold block" style="color:#10b981;">สถานะ: ใช้ "ใบประกาศเฉพาะแหล่งเรียนรู้"</span>
            <span class="text-xxs text-muted block">ตั้งค่าภาพพื้นหลังและจัดวางพิกัดเฉพาะของแหล่งเรียนรู้นี้</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full text-xxs font-bold" style="background:#10b981; color:#fff;">เฉพาะแหล่งเรียนรู้</span>
      `;
    } else if (_cachedGlobalCertUrl) {
      banner.className = 'loft-card p-3 rounded-xl flex items-center justify-between';
      banner.style.background = 'rgba(59,130,246,0.12)';
      banner.style.border = '1px solid rgba(59,130,246,0.3)';
      banner.style.margin = '0 0 12px 0';
      banner.innerHTML = `
        <div class="flex items-center gap-2">
          <i class="fas fa-university text-base" style="color:#3b82f6;"></i>
          <div>
            <span class="text-xs font-bold block" style="color:#3b82f6;">สถานะ: ใช้ "ใบประกาศกลางของระบบ"</span>
            <span class="text-xxs text-muted block">ไม่ได้อัปโหลดภาพเฉพาะ จึงดึงแบบฟอร์มภาพประกาศกลางของระบบมาใช้</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded-full text-xxs font-bold" style="background:#3b82f6; color:#fff;">กลางของระบบ</span>
      `;
    } else {
      banner.className = 'loft-card p-3 rounded-xl flex items-center justify-between';
      banner.style.background = 'rgba(245,158,11,0.12)';
      banner.style.border = '1px solid rgba(245,158,11,0.3)';
      banner.style.margin = '0 0 12px 0';
      banner.innerHTML = `
        <div class="flex items-center gap-2">
          <i class="fas fa-award text-base" style="color:#f59e0b;"></i>
          <div>
            <span class="text-xs font-bold block" style="color:#f59e0b;">สถานะ: ใช้ "ใบประกาศมาตรฐานระบบ"</span>
            <span class="text-xxs text-muted block">ใช้แบบฟอร์มเกียรติบัตรกรอบทองมาตรฐานของระบบให้อัตโนมัติ</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="/cert-editor.html" target="_blank" style="padding: 4px 10px; font-size: 0.72rem; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; border-radius: 8px; display: inline-flex; align-items: center; gap: 4px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            <i class="fas fa-paint-brush"></i> ปรับดีไซน์ใบประกาศสด
          </a>
          <span class="px-2 py-0.5 rounded-full text-xxs font-bold" style="background:#f59e0b; color:#fff;">มาตรฐานระบบ</span>
        </div>
      `;
    }
  }

  function resetAdminSourceCertificateTemplate() {
    const bgEl = document.getElementById('admin-source-cert-bg');
    if (bgEl) bgEl.value = '';
    const customContainer = document.getElementById('admin-source-cert-custom-fields-list');
    if (customContainer) customContainer.innerHTML = '';
    const previewEl = document.getElementById('admin-source-cert-preview');
    if (previewEl) previewEl.style.display = 'none';
    updateAdminSourceCertStatusBanner();
    showCustomAlert('ยกเลิกเทมเพลตเฉพาะเรียบร้อยแล้ว<br><small class="text-muted">ระบบจะใช้ใบประกาศมาตรฐานของระบบให้อัตโนมัติเมื่อกดบันทึก</small>', 'info');
  }

  window.resetAdminSourceCertificateTemplate = resetAdminSourceCertificateTemplate;
  window.updateAdminSourceCertStatusBanner = updateAdminSourceCertStatusBanner;

  function getAdminSourceCertificateTemplate() {
    const bg = (document.getElementById('admin-source-cert-bg') || {}).value || '';
    const backgroundUrl = String(bg || '').trim();
    if (!backgroundUrl) return null;
    
    // Signature position only (URL is now a global setting)
    const signatureUrl = (document.getElementById('admin-source-cert-sig-url') || {}).value || '';
    const signature = {
      x: getNumberValue('admin-source-cert-sig-x', 50),
      y: getNumberValue('admin-source-cert-sig-y', 80),
      width: getNumberValue('admin-source-cert-sig-w', 15)
    };

    // Read custom fields
    const customFields = [];
    const rows = document.querySelectorAll('.admin-cert-custom-field-row');
    rows.forEach(row => {
      const text = (row.querySelector('.custom-field-text').value || '').trim();
      const x = parseFloat(row.querySelector('.custom-field-x').value) || 50;
      const y = parseFloat(row.querySelector('.custom-field-y').value) || 50;
      const width = parseFloat((row.querySelector('.custom-field-width') || {}).value) || 45;
      const fontSize = parseFloat(row.querySelector('.custom-field-size').value) || 16;
      const fontFamily = ((row.querySelector('.custom-field-font') || {}).value || 'Sarabun').trim();
      const color = row.querySelector('.custom-field-color').value || '#111827';
      const bold = String(((row.querySelector('.custom-field-bold') || {}).value || 'false')).toLowerCase() === 'true';
      const italic = String(((row.querySelector('.custom-field-italic') || {}).value || 'false')).toLowerCase() === 'true';
      const align = ((row.querySelector('.custom-field-align') || {}).value || 'center').trim();
      if (text) {
        customFields.push({ text, x, y, width, fontSize, fontFamily, color, bold, italic, align });
      }
    });

    return {
      backgroundUrl: backgroundUrl,
      signatureUrl: signatureUrl,
      signature: signature,
      customFields: customFields,
      fields: {
        name: {
          x: getNumberValue('admin-source-cert-name-x', 50),
          y: getNumberValue('admin-source-cert-name-y', 47),
          width: getNumberValue('admin-source-cert-name-w', 62),
          fontSize: getNumberValue('admin-source-cert-name-size', 42),
          fontFamily: getTextValue('admin-source-cert-name-font', 'Sarabun'),
          color: getTextValue('admin-source-cert-name-color', '#111827'),
          bold: getBoolValue('admin-source-cert-name-bold', true),
          italic: getBoolValue('admin-source-cert-name-italic', false),
          align: getTextValue('admin-source-cert-name-align', 'center')
        },
        source: {
          x: getNumberValue('admin-source-cert-source-x', 50),
          y: getNumberValue('admin-source-cert-source-y', 56),
          width: getNumberValue('admin-source-cert-source-w', 72),
          fontSize: getNumberValue('admin-source-cert-source-size', 20),
          fontFamily: getTextValue('admin-source-cert-source-font', 'Sarabun'),
          color: getTextValue('admin-source-cert-source-color', '#111827'),
          bold: getBoolValue('admin-source-cert-source-bold', true),
          italic: getBoolValue('admin-source-cert-source-italic', false),
          align: getTextValue('admin-source-cert-source-align', 'center')
        },
        score: {
          x: getNumberValue('admin-source-cert-score-x', 50),
          y: getNumberValue('admin-source-cert-score-y', 68),
          width: getNumberValue('admin-source-cert-score-w', 40),
          fontSize: getNumberValue('admin-source-cert-score-size', 18),
          fontFamily: getTextValue('admin-source-cert-score-font', 'Sarabun'),
          color: getTextValue('admin-source-cert-score-color', '#111827'),
          bold: getBoolValue('admin-source-cert-score-bold', true),
          italic: getBoolValue('admin-source-cert-score-italic', false),
          align: getTextValue('admin-source-cert-score-align', 'center')
        },
        date: {
          x: getNumberValue('admin-source-cert-date-x', 50),
          y: getNumberValue('admin-source-cert-date-y', 78),
          width: getNumberValue('admin-source-cert-date-w', 42),
          fontSize: getNumberValue('admin-source-cert-date-size', 18),
          fontFamily: getTextValue('admin-source-cert-date-font', 'Sarabun'),
          color: getTextValue('admin-source-cert-date-color', '#111827'),
          bold: getBoolValue('admin-source-cert-date-bold', true),
          italic: getBoolValue('admin-source-cert-date-italic', false),
          align: getTextValue('admin-source-cert-date-align', 'center')
        },
        refNo: {
          x: getNumberValue('admin-source-cert-ref-x', 50),
          y: getNumberValue('admin-source-cert-ref-y', 88),
          width: getNumberValue('admin-source-cert-ref-w', 45),
          fontSize: getNumberValue('admin-source-cert-ref-size', 14),
          fontFamily: getTextValue('admin-source-cert-ref-font', 'Sarabun'),
          color: getTextValue('admin-source-cert-ref-color', '#6b7280'),
          bold: getBoolValue('admin-source-cert-ref-bold', false),
          italic: getBoolValue('admin-source-cert-ref-italic', false),
          align: getTextValue('admin-source-cert-ref-align', 'center')
        }
      }
    };
  }

  function updateAdminSourceCertPreview() {
    const preview = document.getElementById('admin-source-cert-preview');
    if (!preview) return;
    const bg = ((document.getElementById('admin-source-cert-bg') || {}).value || '').trim();
    preview.style.display = bg ? 'block' : 'none';
    if (bg) preview.style.backgroundImage = "url('" + bg + "')";

    const name = preview.querySelector('.cert-marker-name');
    const sourceField = preview.querySelector('.cert-marker-source');
    const score = preview.querySelector('.cert-marker-score');
    const date = preview.querySelector('.cert-marker-date');
    const refNoField = preview.querySelector('.cert-marker-ref');
    const sigField = preview.querySelector('.cert-marker-sig');

    const sourceName = ((document.getElementById('admin-source-name') || {}).value || '').trim() || 'แหล่งเรียนรู้';
    const today = new Date();
    const refNoVal = `LOFT-${today.getFullYear() + 543}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-9999`;
    const thDate = new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'long', year: 'numeric' }).format(today);

    const markerText = {
      name: adminCertSimulationMode ? 'นายสมชาย รักดี' : 'ชื่อผู้เรียน',
      source: adminCertSimulationMode ? ('ผ่านการเรียนรู้เรื่อง ' + sourceName) : 'แหล่งเรียนรู้',
      score: adminCertSimulationMode ? 'คะแนนทดสอบ 10/10' : 'คะแนน',
      date: adminCertSimulationMode ? thDate : 'วันที่',
      refNo: adminCertSimulationMode ? ('เลขอ้างอิง: ' + refNoVal) : 'เลขอ้างอิง'
    };

    Object.keys(ADMIN_CERT_TEXT_FIELDS).forEach(key => {
      const cfg = ADMIN_CERT_TEXT_FIELDS[key];
      const marker = preview.querySelector(cfg.marker);
      if (!marker) return;
      marker.dataset.certField = key;
      marker.innerText = markerText[key];
      marker.classList.toggle('simulating', adminCertSimulationMode);
      applyAdminCertMarkerStyle(marker, getAdminCertFieldState(key));
    });

    // Signature, director name and title are in the background image — no separate marker needed

    preview.querySelectorAll('.cert-marker-custom').forEach(el => el.remove());
    document.querySelectorAll('.admin-cert-custom-field-row').forEach((row, idx) => {
      const state = getAdminCertCustomState(row);
      if (!state || !state.text) return;
      const xInput = row.querySelector('.custom-field-x');
      const yInput = row.querySelector('.custom-field-y');
      const marker = document.createElement('div');
      marker.className = 'cert-position-marker cert-marker-custom';
      marker.dataset.index = idx;
      marker.dataset.certField = 'custom:' + idx;
      marker.style.pointerEvents = 'auto';
      marker.style.cursor = 'move';
      marker.innerText = state.text;
      marker.classList.toggle('simulating', adminCertSimulationMode);
      applyAdminCertMarkerStyle(marker, state);
      preview.appendChild(marker);
      makeMarkerDraggable(marker, xInput, yInput);
    });

    bindMarkerDraggables();
    bindCertInputListeners();
    syncAdminCertToolbar();
  }

  function toggleAdminSourceCertSimulation() {
    adminCertSimulationMode = !adminCertSimulationMode;
    const btn = document.getElementById('btn-admin-cert-simulate');
    if (btn) {
      if (adminCertSimulationMode) {
        btn.style.background = 'linear-gradient(135deg, var(--gold), #d97706)';
        btn.style.color = '#fff';
        btn.innerHTML = '<i class="fas fa-eye-slash mr-1"></i>ปิดการจำลอง';
      } else {
        btn.style.background = 'var(--glass)';
        btn.style.color = 'var(--text)';
      }
    }
    updateAdminSourceCertPreview();
  }

  function testGenerateAdminSourceCert() {
    const sourceId = document.getElementById('admin-source-id').value;
    const sourceName = document.getElementById('admin-source-name').value || 'แหล่งเรียนรู้ทดสอบ';
    const phone = localStorage.getItem("userPhone") || "guest";
    const liveTemplate = getAdminSourceCertificateTemplate();

    if (!sourceId || sourceId === '(ระบบสร้างอัตโนมัติ)') {
      return showCustomAlert("กรุณากรอกชื่อและบันทึกแหล่งเรียนรู้ก่อนทดสอบออกใบประกาศ", "warning");
    }

    showLoading(true);
    apiPost('generateCert', withAuthData({
      name: 'นายสมชาย รักดี (ทดสอบระบบ)',
      source: sourceName,
      score: '100%',
      phone: phone,
      sourceId: sourceId,
      isTest: true,
      template: liveTemplate
    })).then(function(res) {
      showLoading(false);
      if (res && res.status === 'success' && res.url) {
        window.open(res.url, '_blank');
        showCustomAlert('สร้างตัวอย่างใบประกาศสำเร็จ!<br><br><a href="' + res.url + '" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none;">คลิกที่นี่เพื่อเปิดดู PDF</a>', 'success', 'ตัวอย่างใบประกาศ');
      } else {
        showCustomAlert('เกิดข้อผิดพลาด: ' + ((res && res.message) || 'ไม่สามารถทดสอบออกใบประกาศได้'), 'error');
      }
    }).catch(function(err) {
      showLoading(false);
      showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    });
  }

  window.toggleAdminSourceCertSimulation = toggleAdminSourceCertSimulation;
  window.testGenerateAdminSourceCert = testGenerateAdminSourceCert;

  window.addEventListener('resize', function() {
    updateAdminSourceCertPreview();
  });

  function clearAdminBaseForm() {
    const sourceSelect = document.getElementById('admin-base-source-id');
    if (!sourceSelect || !(sourceSelect.value || '').trim()) {
      document.getElementById('admin-base-source-id').value = '';
    }
    document.getElementById('admin-base-id').value = '(ระบบสร้างอัตโนมัติ)';
    document.getElementById('admin-base-name').value = '';
    document.getElementById('admin-base-description').value = '';
    document.getElementById('admin-base-cover').value = '';
    document.getElementById('admin-base-preview').style.display = 'none';
    document.getElementById('admin-base-order').value = '';
    document.getElementById('admin-base-active').checked = true;
    document.getElementById('admin-base-history').value = '';
    document.getElementById('admin-base-result').value = '';
    document.getElementById('admin-base-contact').value = '';
    document.getElementById('admin-base-video').value = '';
    document.getElementById('admin-base-gallery').value = '';
    document.getElementById('admin-base-external').value = '';
    document.getElementById('admin-base-gps').value = '';
    document.getElementById('admin-base-mode').value = 'create';
  }

  function setAdminBasesCache(sourceId, bases) {
    const sid = String(sourceId || '').trim();
    if (!sid) return;
    adminBasesCacheMap[sid] = bases || [];
  }

  function getAdminBasesCache(sourceId) {
    const sid = String(sourceId || '').trim();
    return sid && adminBasesCacheMap[sid] ? adminBasesCacheMap[sid] : [];
  }

  function populateAdminBaseSourceOptions() {
    const sourceSelect = document.getElementById('admin-base-source-id');
    if (!sourceSelect) return;
    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const instSelect = document.getElementById('admin-base-institution-filter');
    const selectedInst = isSuper ? (instSelect ? instSelect.value : 'ALL') : userInst;

    const baseInstGroup = document.getElementById('admin-base-institution-filter')?.closest('.input-group');
    if (baseInstGroup) {
      baseInstGroup.style.display = isSuper ? 'block' : 'none';
    }
    
    const currentValue = sourceSelect.value || '';
    let filteredSources = adminSourcesCache || [];
    if (selectedInst && selectedInst !== 'ALL' && selectedInst !== 'ทั้งหมด') {
      filteredSources = filteredSources.filter(function(s) {
        return (s.institutionId || s.institution_id || 'INS_PHRAO') === selectedInst;
      });
    }

    let options = '<option value="">— เลือกแหล่งเรียนรู้สำหรับจัดการฐาน (' + (filteredSources.length) + ' แหล่ง) —</option>';
    filteredSources.forEach(function(item) {
      options += '<option value="' + item.SourceID + '">' + item.SourceName + ' (' + formatTambon(item.TambonName) + ')</option>';
    });
    sourceSelect.innerHTML = options;
    if (currentValue && filteredSources.some(function(s) { return String(s.SourceID) === String(currentValue); })) {
      sourceSelect.value = currentValue;
    }
  }

  function onAdminBaseInstitutionChange() {
    populateAdminBaseSourceOptions();
    if (typeof loadAdminBases === 'function') {
      loadAdminBases();
    }
  }

  function populateAdminQuizBaseOptions(sourceId) {
    const baseSelect = document.getElementById('admin-quiz-base-id');
    if (!baseSelect) return;
    const sid = String(sourceId || '').trim();
    const currentValue = baseSelect.value || '';
    let options = '<option value="">— เลือกฐานการเรียนรู้ —</option>';
    const list = getAdminBasesCache(sid) || [];
    list.forEach(function(b) {
      options += '<option value="' + escapeJS(b.baseId) + '">' + (b.baseName || b.baseId) + '</option>';
    });
    baseSelect.innerHTML = options;
    if (currentValue && list.some(function(b) { return String(b.baseId) === String(currentValue); })) {
      baseSelect.value = currentValue;
    } else {
      baseSelect.value = '';
    }
  }

  function fetchAdminBasesBySource(sourceId) {
    const sid = String(sourceId || '').trim();
    if (!sid) return Promise.resolve([]);
    return apiGet('getAdminBasesBySource', withAuthParams({ sourceId: sid }))
      .then(function(res) {
        if (res && res.status === "success") {
          setAdminBasesCache(sid, res.data || []);
          return res.data || [];
        }
        setAdminBasesCache(sid, []);
        return [];
      }).catch(function() {
        setAdminBasesCache(sid, []);
        return [];
      });
  }

  function loadAdminBases() {
    const sourceId = (document.getElementById('admin-base-source-id').value || '').trim();
    const container = document.getElementById('admin-base-list-container');
    if (!container) return;
    clearAdminBaseForm();
    adminBasesCache = [];
    if (!sourceId) {
      container.innerHTML = '<div class="text-center text-muted py-3">เลือกแหล่งเรียนรู้เพื่อจัดการฐาน</div>';
      populateAdminQuizBaseOptions('');
      return;
    }
    container.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-circle-notch fa-spin"></i> กำลังโหลดฐานการเรียนรู้...</div>';
    fetchAdminBasesBySource(sourceId).then(function(list) {
      adminBasesCache = list || [];
      renderAdminBaseList();
      populateAdminQuizBaseOptions(sourceId);
    });
  }

  function renderAdminBaseList() {
    const container = document.getElementById('admin-base-list-container');
    if (!container) return;
    if (!adminBasesCache || adminBasesCache.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3">ยังไม่มีฐานการเรียนรู้ในแหล่งเรียนรู้นี้</div>';
      return;
    }
    let html = '';
    adminBasesCache.forEach(function(b, idx) {
      html += '<div class="admin-base-item" draggable="true" ondragstart="onAdminBaseDragStart(event,\'' + escapeJS(b.baseId) + '\')" ondragover="onAdminBaseDragOver(event)" ondrop="onAdminBaseDrop(event,\'' + escapeJS(b.baseId) + '\')" ondragend="onAdminBaseDragEnd()">' +
                '<div class="admin-base-top">' +
                  '<div>' +
                    '<div class="admin-base-title"><i class="fas fa-grip-vertical mr-1 admin-drag-handle"></i>' + (idx + 1) + '. ' + (b.baseName || '-') + '</div>' +
                    '<div class="admin-base-sub">' + (b.isActive ? '\u0e40\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19' : '\u0e1b\u0e34\u0e14\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19') + '</div>' +
                  '</div>' +
                  '<div class="admin-item-actions">' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;" onclick="editAdminBase(\'' + escapeJS(b.baseId) + '\')"><i class="fas fa-pen"></i></button>' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="deleteAdminBase(\'' + escapeJS(b.baseId) + '\')"><i class="fas fa-trash"></i></button>' +
                  '</div>' +
                '</div>' +
              '</div>';
    });
    container.innerHTML = html;
  }

  function editAdminBase(baseId) {
    const item = (adminBasesCache || []).find(function(b) { return String(b.baseId) === String(baseId); });
    if (!item) return showCustomAlert("ไม่พบฐานที่เลือก", "error");
    const modeEl = document.getElementById('admin-base-mode');
    if (modeEl) modeEl.value = 'edit';
    document.getElementById('admin-base-id').value = item.baseId || '';
    document.getElementById('admin-base-name').value = item.baseName || '';
    document.getElementById('admin-base-description').value = item.description || '';
    const imgUrl = item.coverImage || '';
    document.getElementById('admin-base-cover').value = imgUrl;
    const preview = document.getElementById('admin-base-preview');
    if (imgUrl) {
      preview.style.backgroundImage = "url('" + imgUrl + "')";
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
    document.getElementById('admin-base-order').value = item.displayOrder != null ? item.displayOrder : '';
    document.getElementById('admin-base-active').checked = !!item.isActive;
    document.getElementById('admin-base-history').value = item.history || '';
    document.getElementById('admin-base-result').value = item.result || '';
    document.getElementById('admin-base-contact').value = item.contact || '';
    document.getElementById('admin-base-video').value = item.videoUrl || '';
    document.getElementById('admin-base-gallery').value = item.gallery || '';
    document.getElementById('admin-base-external').value = item.external || '';
    document.getElementById('admin-base-gps').value = item.gps || '';
    const titleEl = document.getElementById('admin-base-modal-title');
    if (titleEl) titleEl.innerText = "แก้ไขฐานการเรียนรู้: " + (item.baseName || '');
    const modalEl = document.getElementById('admin-base-editor-modal');
    if (modalEl) modalEl.style.display = 'flex';
  }

  function saveAdminBase() {
    const sourceId = (document.getElementById('admin-base-source-id').value || '').trim();
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    let mode = (document.getElementById('admin-base-mode').value || 'create').toLowerCase();
    const rawBaseId = (document.getElementById('admin-base-id').value || '').trim();
    if (rawBaseId && rawBaseId !== '(ระบบสร้างอัตโนมัติ)') {
      mode = 'edit';
    }
    const data = {
      mode: mode,
      sourceId: sourceId,
      baseId: (rawBaseId && rawBaseId !== '(ระบบสร้างอัตโนมัติ)') ? rawBaseId : '',
      baseName: (document.getElementById('admin-base-name').value || '').trim(),
      description: (document.getElementById('admin-base-description').value || '').trim(),
      coverImage: (document.getElementById('admin-base-cover').value || '').trim(),
      displayOrder: (document.getElementById('admin-base-order').value || '').trim(),
      isActive: document.getElementById('admin-base-active').checked,
      history: (document.getElementById('admin-base-history').value || '').trim(),
      result: (document.getElementById('admin-base-result').value || '').trim(),
      contact: (document.getElementById('admin-base-contact').value || '').trim(),
      videoUrl: (document.getElementById('admin-base-video').value || '').trim(),
      gallery: (document.getElementById('admin-base-gallery').value || '').trim(),
      external: (document.getElementById('admin-base-external').value || '').trim(),
      gps: (document.getElementById('admin-base-gps').value || '').trim()
    };
    if (!data.baseName) return showCustomAlert("กรุณากรอกชื่อฐานการเรียนรู้", "warning");
    showLoading(true);
    apiPost('saveAdminBase', withAuthData(data))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert("บันทึกฐานการเรียนรู้เรียบร้อย", "success");
          cacheSources = null;
          fetchAdminBasesBySource(sourceId).then(function(list) {
            adminBasesCache = list || [];
            renderAdminBaseList();
            populateAdminQuizBaseOptions(sourceId);
          });
          clearAdminBaseForm();
          closeAdminBaseEditorModal();
        } else {
          showCustomAlert(res.message || "บันทึกไม่สำเร็จ", "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function deleteAdminBase(baseId) {
    const sourceId = (document.getElementById('admin-base-source-id').value || '').trim();
    if (!sourceId || !baseId) return;
    showCustomConfirm("ต้องการลบฐานการเรียนรู้นี้ใช่หรือไม่? ระบบจะลบเนื้อหาและข้อสอบที่เกี่ยวข้องด้วย", function() {
      showLoading(true);
      apiPost('deleteAdminBase', withAuthData({ baseId: baseId }))
        .then(function(res) {
          showLoading(false);
          if (res.status === "success") {
            showCustomAlert("ลบข้อมูลเรียบร้อย", "success");
            cacheSources = null;
            loadAdminBases();
            if ((document.getElementById('admin-quiz-source-id').value || '').trim() === sourceId) {
              populateAdminQuizBaseOptions(sourceId);
              loadAdminQuizzes();
            }
          } else {
            showCustomAlert(res.message || "ลบไม่สำเร็จ", "error");
          }
        }).catch(function() {
          showLoading(false);
          showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        });
    });
  }

  // ── Global Settings (ลายเซ็นต์ + ชื่อผู้บริหาร) ─────────────────────────────

  function loadGlobalSettings() {
    var isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    var userInst = localStorage.getItem('userInstitution') || 'INS_PHRAO';

    var selectorContainer = document.getElementById('settings-institution-selector-container');
    if (selectorContainer) {
      selectorContainer.style.display = isSuper ? 'block' : 'none';
    }

    var mgmtCard = document.getElementById('settings-institution-mgmt-card');
    if (mgmtCard) {
      mgmtCard.style.display = isSuper ? 'block' : 'none';
    }

    if (isSuper) {
      renderSettingsTabInstitutions();
    }

    var selectEl = document.getElementById('settings-institution-select');
    if (selectEl && !isSuper) {
      selectEl.value = userInst;
    }
    var instId = isSuper ? (selectEl ? selectEl.value : userInst) : userInst;
    if (instId === 'ALL') instId = 'INS_PHRAO';

    apiGet('getGlobalSettings', withAuthParams({ institutionId: instId }))
      .then(function(res) {
        if (res.status !== 'success') return;
        var gs = res.settings || {};
        var nameEl  = document.getElementById('global-director-name');
        var titleEl = document.getElementById('global-director-title');
        var sigEl   = document.getElementById('global-signature-url');
        if (nameEl)  nameEl.value  = gs.directorName  || '';
        if (titleEl) titleEl.value = gs.directorTitle || '';
        if (sigEl) {
          sigEl.value = gs.signatureUrl || '';
          _refreshGlobalSigPreview(gs.signatureUrl || '');
        }
      }).catch(function() {});
  }
  window.loadGlobalSettings = loadGlobalSettings;

  function saveGlobalSettings() {
    var isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    var userInst = localStorage.getItem('userInstitution') || 'INS_PHRAO';
    var selectEl = document.getElementById('settings-institution-select');
    var instId = isSuper ? (selectEl ? selectEl.value : userInst) : userInst;
    if (instId === 'ALL') instId = 'INS_PHRAO';

    var nameEl  = document.getElementById('global-director-name');
    var titleEl = document.getElementById('global-director-title');
    var sigEl   = document.getElementById('global-signature-url');
    var directorName  = (nameEl  ? nameEl.value  : '').trim();
    var directorTitle = (titleEl ? titleEl.value : '').trim();
    var signatureUrl  = (sigEl   ? sigEl.value   : '').trim();
    showLoading(true);
    apiPost('saveGlobalSettings', withAuthParams({ institutionId: instId, directorName: directorName, directorTitle: directorTitle, signatureUrl: signatureUrl }))
      .then(function(res) {
        showLoading(false);
        if (res.status === 'success') {
          showCustomAlert('บันทึกการตั้งค่าระบบเรียบร้อย', 'success');
        } else {
          showCustomAlert('บันทึกไม่สำเร็จ: ' + (res.message || ''), 'error');
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
      });
  }
  window.saveGlobalSettings = saveGlobalSettings;

  function handleGlobalSignatureUpload(input) {
    if (!input.files || !input.files[0]) return;
    currentCropContext = 'globalCertSignature';
    currentFileName = 'global_signature_' + Date.now() + '_' + input.files[0].name;
    var reader = new FileReader();
    reader.onload = function(e) { openCropModal(e.target.result); };
    reader.readAsDataURL(input.files[0]);
  }
  window.handleGlobalSignatureUpload = handleGlobalSignatureUpload;

  function _refreshGlobalSigPreview(url) {
    var preview = document.getElementById('global-sig-preview');
    var img     = document.getElementById('global-sig-preview-img');
    if (!preview || !img) return;
    if (url) {
      var validUrl = typeof getValidImageUrl === 'function' ? getValidImageUrl(url) : url;
      img.src = validUrl;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }

  function renderSettingsTabInstitutions() {
    var container = document.getElementById('settings-institution-list-container');
    if (!container) return;

    var isSuperAdmin = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;

    var cardMgmt = document.getElementById('settings-institution-mgmt-card');
    if (cardMgmt) {
      cardMgmt.style.display = isSuperAdmin ? 'block' : 'none';
    }

    var selectorContainer = document.getElementById('settings-institution-selector-container');
    if (selectorContainer) {
      selectorContainer.style.display = isSuperAdmin ? 'block' : 'none';
    }

    if (!isSuperAdmin) return;

    container.innerHTML = '<div class="text-center text-muted py-3 text-xs"><i class="fas fa-circle-notch fa-spin mr-1"></i> กำลังโหลดสถานศึกษา...</div>';

    apiGet('getInstitutions', withAuthParams({}))
      .then(function(res) {
        if (!res || res.status !== 'success' || !Array.isArray(res.institutions)) {
          container.innerHTML = '<div class="text-center text-muted py-3 text-xs">ไม่พบข้อมูลสถานศึกษา</div>';
          return;
        }
        window._cachedInstitutionsList = res.institutions;

        // อัปเดต INSTITUTION_TAMBONS_MAP ให้ตรงกับฐานข้อมูลล่าสุด
        res.institutions.forEach(function(inst) {
          var subs = inst.subUnits || inst.sub_units;
          if (inst.id && Array.isArray(subs) && subs.length > 0) {
            INSTITUTION_TAMBONS_MAP[inst.id] = subs;
          }
        });

        // อัปเดตดรอปดาวน์เลือกสถานศึกษาในหน้าตั้งค่า
        var selectEl = document.getElementById('settings-institution-select');
        if (selectEl) {
          var curVal = selectEl.value;
          var optHtml = '';
          res.institutions.forEach(function(inst) {
            optHtml += '<option value="' + escapeHtml(inst.id) + '">' + escapeHtml(inst.name || inst.id) + '</option>';
          });
          selectEl.innerHTML = optHtml;
          if (curVal) selectEl.value = curVal;
        }

        var html = '';
        res.institutions.forEach(function(inst) {
          var subs = inst.subUnits || inst.sub_units || [];
          var subUnitsCount = subs.length;
          var isRoot = (inst.id === 'INS_PHRAO');
          var deleteBtnHtml = isRoot 
            ? '' 
            : '<button type="button" class="btn-primary" style="padding:6px 10px; font-size:0.75rem; border-radius:var(--r-pill); background:linear-gradient(135deg,#ef4444,#dc2626); border:none; color:white;" title="ลบสถานศึกษานี้" onclick="deleteInstitutionAction(\'' + escapeJS(inst.id) + '\')">' +
                '<i class="fas fa-trash"></i>' +
              '</button>';

          html += 
            '<div class="flex items-center justify-between p-3.5 bg-white/70 dark:bg-gray-800/70 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex-wrap gap-2 mb-2 hover:shadow-sm transition">' +
              '<div class="flex items-center gap-3">' +
                '<div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">' +
                  escapeHtml(inst.code || inst.id.replace('INS_', '')) +
                '</div>' +
                '<div>' +
                  '<h6 class="font-bold text-xs text-theme-inv">' + escapeHtml(inst.name || inst.id) + '</h6>' +
                  '<p class="text-[11px] text-muted">' + escapeHtml(inst.district || '-') + ', ' + escapeHtml(inst.province || 'เชียงใหม่') + ' • <b class="text-blue-500 font-bold">' + subUnitsCount + '</b> สถานศึกษาในสังกัด (ศกร.ตำบล/ศศช.)</p>' +
                '</div>' +
              '</div>' +
              '<div class="flex items-center gap-2">' +
                '<button type="button" class="btn-primary" style="padding:6px 12px; font-size:0.75rem; border-radius:var(--r-pill); background:linear-gradient(135deg,#059669,#047857); border:none; color:white;" onclick="if(typeof openManageSubUnitsModal===\'function\'){openManageSubUnitsModal(\'' + escapeJS(inst.id) + '\');}else{openInstitutionModal(\'' + escapeJS(inst.id) + '\');}">' +
                  '<i class="fas fa-sitemap mr-1"></i> จัดการสังกัด (' + subUnitsCount + ')' +
                '</button>' +
                '<button type="button" class="btn-primary" style="padding:6px 12px; font-size:0.75rem; border-radius:var(--r-pill); background:linear-gradient(135deg,#2563eb,#1d4ed8); border:none; color:white;" onclick="openInstitutionModal(\'' + escapeJS(inst.id) + '\')">' +
                  '<i class="fas fa-edit mr-1"></i> แก้ไข' +
                '</button>' +
                deleteBtnHtml +
              '</div>' +
            '</div>';
        });

        // Add shortcut link to full institutions workspace
        html += 
          '<div style="text-align:right; margin-top:8px;">' +
            '<button type="button" class="btn-primary text-xs" style="padding:6px 14px; border-radius:var(--r-pill); background:var(--glass); border:1px solid var(--card-border); color:var(--primary); font-weight:700;" onclick="window.location.href=\'institutions.html\'">' +
              '<i class="fas fa-arrow-right mr-1"></i> ไปที่หน้าจัดการสถานศึกษาเต็มรูปแบบ' +
            '</button>' +
          '</div>';

        container.innerHTML = html;
      }).catch(function(err) {
        console.error('renderSettingsTabInstitutions error:', err);
        container.innerHTML = '<div class="text-center text-muted py-3 text-xs">เกิดข้อผิดพลาดในการโหลดข้อมูลสถานศึกษา</div>';
      });
  }
  window.renderSettingsTabInstitutions = renderSettingsTabInstitutions;

  function deleteInstitutionAction(instId) {
    if (!instId) return;
    if (instId === 'INS_PHRAO') {
      return showCustomAlert("ไม่สามารถลบสถานศึกษาหลักของระบบ (สกร.อำเภอพร้าว) ได้ครับ", "warning");
    }
    var list = window._cachedInstitutionsList || [];
    var inst = list.find(function(i) { return String(i.id) === String(instId); });
    var instName = inst ? inst.name : instId;

    showCustomConfirm("ต้องการลบสถานศึกษา \"" + instName + "\" ใช่หรือไม่?\n⚠️ ข้อมูลสถานศึกษาและสถานศึกษาในสังกัดจะถูกลบออกจากระบบ", function() {
      showLoading(true);
      apiPost('deleteInstitution', withAuthData({ id: instId }))
        .then(function(res) {
          showLoading(false);
          if (res && res.status === 'success') {
            showCustomAlert("ลบสถานศึกษาเรียบร้อยแล้ว", "success");
            renderSettingsTabInstitutions();
            if (typeof loadAdminStats === 'function') loadAdminStats();
          } else {
            showCustomAlert(res.message || "ลบไม่สำเร็จ", "error");
          }
        }).catch(function() {
          showLoading(false);
          showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
        });
    });
  }
  window.deleteInstitutionAction = deleteInstitutionAction;

  function onAdminBaseDragStart(event, baseId) {
    adminDraggedBaseId = baseId;
    if (event && event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(baseId || ''));
    }
    if (event && event.currentTarget) event.currentTarget.classList.add('dragging');
  }

  function onAdminBaseDragOver(event) {
    if (event) event.preventDefault();
  }

  function onAdminBaseDrop(event, targetBaseId) {
    if (event) event.preventDefault();
    const dragged = adminDraggedBaseId || (event && event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
    if (!dragged || dragged === targetBaseId) return;
    const fromIndex = (adminBasesCache || []).findIndex(function(b) { return String(b.baseId) === String(dragged); });
    const toIndex = (adminBasesCache || []).findIndex(function(b) { return String(b.baseId) === String(targetBaseId); });
    if (fromIndex < 0 || toIndex < 0) return;
    const moved = adminBasesCache.splice(fromIndex, 1)[0];
    adminBasesCache.splice(toIndex, 0, moved);
    renderAdminBaseList();
  }

  function onAdminBaseDragEnd() {
    document.querySelectorAll('.admin-base-item').forEach(function(el) { el.classList.remove('dragging'); });
    adminDraggedBaseId = null;
  }

  function saveAdminBaseOrder() {
    const sourceId = (document.getElementById('admin-base-source-id').value || '').trim();
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    if (!adminBasesCache || adminBasesCache.length === 0) return showCustomAlert("ไม่มีรายการฐานสำหรับจัดลำดับ", "warning");
    const baseIds = adminBasesCache.map(function(b) { return b.baseId; }).filter(Boolean);
    showLoading(true);
    apiPost('saveAdminBaseOrder', withAuthData({ sourceId: sourceId, baseIds: baseIds }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") showCustomAlert("บันทึกลำดับเรียบร้อย", "success");
        else showCustomAlert(res.message || "บันทึกลำดับไม่สำเร็จ", "error");
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function cleanTambonForCompare(name) {
    let clean = String(name || '').trim().toLowerCase();
    if (clean === '' || clean === 'all' || clean === 'ทั้งหมด' || clean.indexOf('ทั้งหมด') > -1) {
      return 'all';
    }
    if (clean.indexOf('บ้านโป่ง') > -1) {
      return 'บ้านโป่ง';
    }
    return clean.replace(/^(?:ศกร\.ระดับตำบล|สกร\.ระดับตำบล|ศกร\.ตำบล|สกร\.ตำบล|ศศช\.บ้าน|ศศช\.|สกร\.|ศกร\.|ต\.|ตำบล|บ้าน|บ\.)\s*/u, '').trim();
  }

  function setSelectTambonValue(selectId, tambonName) {
    const select = document.getElementById(selectId);
    if (!select) return;
    if (!tambonName) {
      select.value = "";
      return;
    }
    const cleanTarget = cleanTambonForCompare(tambonName);
    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      if (cleanTambonForCompare(opt.value) === cleanTarget) {
        select.value = opt.value;
        return;
      }
    }
    select.value = tambonName;
  }

  let _cachedGlobalCertUrl = '';
  function updateGlobalCertCache(callback) {
    apiGet('getGlobalSettings', {}).then(function(res) {
      if (res && res.status === 'success' && res.settings) {
        _cachedGlobalCertUrl = res.settings.certificateTemplate || res.settings.globalCertTemplate || '';
      }
      if (typeof callback === 'function') callback();
    }).catch(function() {
      if (typeof callback === 'function') callback();
    });
  }

  // Uses global window.getSubUnitsForInstitution and window.INSTITUTION_SUB_UNITS_MAP from api.js

  function populateSourceEditorTambons(instId, selectedValue) {
    const select = document.getElementById('admin-source-tambon');
    if (!select) return;
    const units = getSubUnitsForInstitution(instId);
    let html = '<option value="">— เลือกสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.) —</option>';
    units.forEach(function(u) {
      html += '<option value="' + u + '">' + u + '</option>';
    });
    select.innerHTML = html;
    if (selectedValue) {
      setSelectTambonValue('admin-source-tambon', selectedValue);
    }
  }
  window.populateSourceEditorTambons = populateSourceEditorTambons;

  function updateTambonFilterOptions(instId) {
    const filterSelect = document.getElementById('admin-source-tambon-filter');
    if (!filterSelect) return;
    const tambons = getSubUnitsForInstitution(instId);
    
    let html = '<option value="">🔍 ทุกสถานศึกษาในสังกัด</option><option value="ทั้งหมด" selected>🌍 ทุกสถานศึกษาในสังกัด (ทั้งหมด)</option>';
    tambons.forEach(function(t) {
      html += '<option value="' + t + '">' + t + '</option>';
    });
    filterSelect.innerHTML = html;
  }

  function onAdminSourceInstitutionChange() {
    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const instSelect = document.getElementById('admin-source-institution-filter');
    const instId = isSuper ? (instSelect ? instSelect.value : 'ALL') : userInst;
    updateTambonFilterOptions(instId);
    loadAdminSources();
  }

  function loadAdminSources() {
    const container = document.getElementById('admin-source-list-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-circle-notch fa-spin"></i> กำลังโหลดข้อมูล...</div>';
    
    const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";

    // แสดง/ซ่อนตัวเลือกตำบลและอำเภอตามสิทธิ์
    const filterWrapper = document.getElementById('admin-source-tambon-filter-wrapper');
    if (filterWrapper) {
      filterWrapper.style.display = (role === 'admin' || role === 'teacher') ? 'block' : 'none';
    }

    const instFilterGroup = document.getElementById('admin-source-institution-filter')?.closest('.input-group');
    if (instFilterGroup) {
      instFilterGroup.style.display = isSuper ? 'block' : 'none';
    }

    const baseInstGroup = document.getElementById('admin-base-institution-filter')?.closest('.input-group');
    if (baseInstGroup) {
      baseInstGroup.style.display = isSuper ? 'block' : 'none';
    }

    const instSelect = document.getElementById('admin-source-institution-filter');
    if (instSelect && !isSuper) {
      instSelect.value = userInst;
    }
    const instId = isSuper ? (instSelect ? instSelect.value : 'ALL') : userInst;
    updateTambonFilterOptions(instId);

    apiGet('getAdminSources', withAuthParams({ institutionId: instId }))
      .then(function(res) {
        if (res.status !== "success") {
          container.innerHTML = '<div class="text-center text-muted py-4">โหลดข้อมูลไม่สำเร็จ</div>';
          return;
        }
        adminSourcesCache = res.data || [];
        updateGlobalCertCache(function() {
          renderAdminSourceList();
          if (typeof populateAdminQuizSourceOptions === 'function') populateAdminQuizSourceOptions();
          populateAdminBaseSourceOptions();
        });
      }).catch(function() {
        container.innerHTML = '<div class="text-center text-muted py-4">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>';
      });
  }

  function renderAdminSourceList() {
    const container = document.getElementById('admin-source-list-container');
    if (!container) return;
    
    const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
    const filterSelect = document.getElementById('admin-source-tambon-filter');
    const selectedTambon = filterSelect ? (filterSelect.value || '').trim() : '';

    const keyword = (document.getElementById('admin-source-search').value || '').trim().toLowerCase();
    let list = adminSourcesCache || [];

    // กรองตามสถานศึกษา ถ้าเลือกเฉพาะ
    const instSelect = document.getElementById('admin-source-institution-filter');
    const selectedInst = instSelect ? instSelect.value : 'ALL';
    if (role === 'admin' && selectedInst && selectedInst !== 'ALL' && selectedInst !== 'ทั้งหมด') {
      list = list.filter(function(item) {
        return (item.institutionId || item.institution_id || 'INS_PHRAO') === selectedInst;
      });
    }

    // กรองตำบลสำหรับครูประจำตำบลและแอดมิน
    if (role === 'teacher') {
      const userTambon = String(localStorage.getItem("userTambon") || "").trim();
      const teacherClean = cleanTambonForCompare(userTambon);
      if (teacherClean && teacherClean !== 'all') {
        list = list.filter(function(item) {
          return cleanTambonForCompare(item.TambonName) === teacherClean;
        });
      }
    } else if (role === 'admin' && selectedTambon && selectedTambon !== 'ทั้งหมด' && selectedTambon !== 'all') {
      const targetClean = cleanTambonForCompare(selectedTambon);
      if (targetClean && targetClean !== 'all') {
        list = list.filter(function(item) {
          return cleanTambonForCompare(item.TambonName) === targetClean;
        });
      }
    }

    if (keyword) {
      list = list.filter(function(item) {
        const txt = [item.SourceName, item.TambonName].join(' ').toLowerCase();
        return txt.indexOf(keyword) > -1;
      });
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3">ไม่พบข้อมูลแหล่งเรียนรู้</div>';
      return;
    }

    let html = '';
    list.forEach(function(item) {
      const certTemplate = item.certificateTemplate || item.cert_template || {};
      const bg = String(certTemplate.backgroundUrl || '').trim();
      let certBadge = '';
      if (bg) {
        certBadge = ' · <span style="color:#10b981; font-weight:600;"><i class="fas fa-certificate mr-1"></i>ใบประกาศเฉพาะแหล่งเรียนรู้</span>';
      } else if (_cachedGlobalCertUrl) {
        certBadge = ' · <span style="color:#3b82f6; font-weight:600;"><i class="fas fa-university mr-1"></i>ใบประกาศกลางของระบบ</span>';
      } else {
        certBadge = ' · <span style="color:#d97706; font-weight:600;"><i class="fas fa-award mr-1"></i>ใบประกาศมาตรฐานระบบ</span>';
      }
      const evalGrade = item.evaluation && item.evaluation.grade ? item.evaluation.grade : '';
      const evalText = evalGrade ? ' · <span style="color:#d97706; font-weight:bold;">🎖️ ' + evalGrade + '</span>' : '';
      
      html += '<div class="admin-item">' +
                '<div class="admin-item-head">' +
                  '<div>' +
                    '<div class="admin-item-title">' + (item.SourceName || 'ไม่ระบุชื่อ') + '</div>' +
                    '<div class="admin-item-sub">' + formatTambon(item.TambonName) + certBadge + evalText + '</div>' +
                  '</div>' +
                  '<div class="admin-item-actions">' +
                    '<button class="btn-primary" title="ประเมินมาตรฐานแหล่งเรียนรู้" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,#f59e0b,#d97706);" onclick="openSourceEvaluation(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-award"></i></button>' +
                    '<button class="btn-primary" title="แก้ไขแหล่งเรียนรู้" style="padding:6px 10px;font-size:.78rem;" onclick="editAdminSource(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-pen"></i></button>' +
                    '<button class="btn-primary" title="จัดการฐาน" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,#0ea5e9,#0284c7);" onclick="focusAdminBaseManager(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-layer-group"></i></button>' +
                    '<button class="btn-primary" title="จัดการแบบทดสอบ" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,var(--primary),var(--primary-dk));" onclick="focusAdminQuizManager(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-question"></i></button>' +
                    '<button class="btn-primary" title="ลบ" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="deleteAdminSource(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-trash"></i></button>' +
                  '</div>' +
                '</div>' +
              '</div>';
    });
    container.innerHTML = html;
  }

  function editAdminSource(sourceId) {
    const item = (adminSourcesCache || []).find(function(s) { return String(s.SourceID) === String(sourceId); });
    if (!item) return showCustomAlert("ไม่พบข้อมูลที่เลือก", "error");

    document.getElementById('admin-source-id').value = item.SourceID || '';
    document.getElementById('admin-source-name').value = item.SourceName || '';
    const itemInst = item.institution_id || item.institutionId || (localStorage.getItem("userInstitution") || "INS_PHRAO");
    populateSourceEditorTambons(itemInst, item.TambonName);
    const imgUrl = item.CoverImageURL || '';
    document.getElementById('admin-source-cover').value = imgUrl;
    var _certTplEl = document.getElementById('admin-source-cert-template');
    if (_certTplEl) _certTplEl.value = item.CertTemplateID || '';
    const preview = document.getElementById('admin-source-preview');
    if (imgUrl) {
      preview.style.backgroundImage = "url('" + imgUrl + "')";
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
    const lat = String(item.Latitude || '').trim();
    const lng = String(item.Longitude || '').trim();
    document.getElementById('admin-source-coord').value = (lat && lng) ? (lat + ', ' + lng) : (lat || lng);
    document.getElementById('admin-history').value = (item.info && item.info.history) ? item.info.history : '';
    document.getElementById('admin-result').value = (item.info && item.info.result) ? item.info.result : '';
    document.getElementById('admin-contact').value = (item.info && item.info.contact) ? item.info.contact : '';
    document.getElementById('admin-gallery').value = (item.info && item.info.gallery) ? item.info.gallery : '';
    document.getElementById('admin-external').value = (item.info && item.info.external) ? item.info.external : '';
    document.getElementById('admin-source-subject').value = item.subjectCategory || '';
    document.getElementById('admin-source-credits').value = item.creditHours || 0;
    document.getElementById('admin-gps').value = (item.info && item.info.gps) ? item.info.gps : '';
    var _typeEl = document.getElementById('admin-source-type');
    if (_typeEl) _typeEl.value = item.sourceType || '';

    var fac = (item.facilities || (item.info && item.info.facilities)) || {};
    var soc = fac.social_media || {};
    setTextValue('admin-facility-capacity', fac.capacity_people, '');
    setTextValue('admin-facility-parking', fac.parking_spaces, '');
    setTextValue('admin-facility-restrooms', fac.restrooms, '');
    setTextValue('admin-facility-tables', fac.tables_chairs, '');
    setTextValue('admin-facility-travel', fac.travel_info, '');
    setTextValue('admin-facility-distance', fac.main_road_distance, '');
    setTextValue('admin-facility-facebook', soc.facebook, '');
    setTextValue('admin-facility-line', soc.line, '');
    setTextValue('admin-facility-website', soc.website, '');
    setTextValue('admin-facility-tiktok', soc.tiktok, '');

    setAdminSourceCertificateTemplate(item.certificateTemplate || null);
    document.getElementById('admin-edit-mode').value = 'edit';
    document.getElementById('admin-original-source-id').value = item.SourceID || '';
    const titleEl = document.getElementById('admin-source-modal-title');
    if (titleEl) titleEl.innerText = "แก้ไขแหล่งเรียนรู้: " + (item.SourceName || '');
    const modalEl = document.getElementById('admin-source-editor-modal');
    if (modalEl) modalEl.style.display = 'flex';
  }

  function focusAdminBaseManager(sourceId) {
    const sourceSelect = document.getElementById('admin-base-source-id');
    if (!sourceSelect) return;
    sourceSelect.value = sourceId;
    if (typeof switchAdminTab === 'function') switchAdminTab('bases');
    else loadAdminBases();
    scrollAdminEditorPanel('bases');
  }

  function saveAdminSource() {
    const mode = document.getElementById('admin-edit-mode').value || 'create';
    const sourceId = (mode === 'edit' ? (document.getElementById('admin-source-id').value || '').trim() : '');
    const sourceName = (document.getElementById('admin-source-name').value || '').trim();
    const tambonName = (document.getElementById('admin-source-tambon').value || '').trim();
    const coordinates = (document.getElementById('admin-source-coord').value || '').trim();
    if (!sourceName || !tambonName) {
      return showCustomAlert("กรุณากรอกชื่อแหล่งเรียนรู้และตำบลให้ครบ", "warning");
    }
    
    let lat = "";
    let lng = "";
    if (coordinates) {
      const parts = coordinates.split(',');
      if (parts.length !== 2) {
        return showCustomAlert("รูปแบบพิกัดไม่ถูกต้อง กรุณากรอกแบบ lat, lng", "warning");
      }
      lat = parts[0].trim();
      lng = parts[1].trim();
    }

    const facilities = {
      capacity_people: getNumberValue('admin-facility-capacity', 0),
      parking_spaces: getNumberValue('admin-facility-parking', 0),
      restrooms: getNumberValue('admin-facility-restrooms', 0),
      tables_chairs: getNumberValue('admin-facility-tables', 0),
      travel_info: getTextValue('admin-facility-travel', ''),
      main_road_distance: getTextValue('admin-facility-distance', ''),
      social_media: {
        facebook: getTextValue('admin-facility-facebook', ''),
        line: getTextValue('admin-facility-line', ''),
        website: getTextValue('admin-facility-website', ''),
        tiktok: getTextValue('admin-facility-tiktok', ''),
      }
    };

    const data = {
      mode: mode,
      originalSourceId: (document.getElementById('admin-original-source-id').value || '').trim(),
      sourceId: sourceId,
      sourceName: sourceName,
      tambonName: tambonName,
      coverImageUrl: (document.getElementById('admin-source-cover').value || '').trim(),
      certTemplateId: ((document.getElementById('admin-source-cert-template') || {}).value || '').trim(),
      certificateTemplate: getAdminSourceCertificateTemplate(),
      coordinates: coordinates,
      latitude: lat,
      longitude: lng,
      history: (document.getElementById('admin-history').value || '').trim(),
      result: (document.getElementById('admin-result').value || '').trim(),
      contact: (document.getElementById('admin-contact').value || '').trim(),
      gallery: (document.getElementById('admin-gallery').value || '').trim(),
      external: (document.getElementById('admin-external').value || '').trim(),
      subjectCategory: document.getElementById('admin-source-subject').value,
      creditHours: document.getElementById('admin-source-credits').value,
      sourceType: (document.getElementById('admin-source-type') || {}).value || '',
      facilities: facilities,
      gps: (document.getElementById('admin-gps').value || '').trim() || coordinates
    };

    showLoading(true);
    apiPost('saveAdminSource', withAuthData(data))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert("บันทึกข้อมูลแหล่งเรียนรู้เรียบร้อย", "success");
          cacheSources = null;
          cacheMapSources = null;
          clearAdminForm();
          closeAdminSourceEditorModal();
          loadAdminSources();
        } else {
          showCustomAlert(res.message || "บันทึกไม่สำเร็จ", "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function deleteAdminSource(sourceId) {
    if (!sourceId) return;
    showCustomConfirm("ต้องการลบแหล่งเรียนรู้นี้ใช่หรือไม่? ระบบจะลบข้อมูลเนื้อหาที่เกี่ยวข้องด้วย", function() {
      showLoading(true);
      apiPost('deleteAdminSource', withAuthData({ sourceId: sourceId }))
        .then(function(res) {
          showLoading(false);
          if (res.status === "success") {
            showCustomAlert("ลบข้อมูลเรียบร้อย", "success");
            cacheSources = null;
            cacheMapSources = null;
            clearAdminQuizForm();
            adminQuizzesCache = [];
            document.getElementById('admin-quiz-list-container').innerHTML = '<div class="text-center text-muted py-3">เลือกแหล่งเรียนรู้เพื่อจัดการข้อสอบ</div>';
            loadAdminSources();
          } else {
            showCustomAlert(res.message || "ลบไม่สำเร็จ", "error");
          }
        }).catch(function() {
          showLoading(false);
          showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        });
    });
  }

  /* ═══════════════════════════════════════════════════════
     ระบบประเมินมาตรฐานแหล่งเรียนรู้ตามมาตรา 6 พ.ร.บ. สกร.
     ═══════════════════════════════════════════════════════ */

  function openSourceEvaluation(sourceId) {
    console.log("openSourceEvaluation called with sourceId:", sourceId);
    try {
      const item = (adminSourcesCache || []).find(function(s) { return String(s.SourceID) === String(sourceId); });
      console.log("Found source item in cache:", item);
      if (!item) {
        showCustomAlert("ไม่พบข้อมูลที่เลือก: " + sourceId, "error");
        return;
      }

      const idEl = document.getElementById('eval-modal-source-id');
      const nameEl = document.getElementById('eval-modal-source-name');
      const tambonEl = document.getElementById('eval-modal-source-tambon');
      console.log("In-modal elements check:", { idEl, nameEl, tambonEl });

      if (idEl) idEl.value = item.SourceID || '';
      if (nameEl) nameEl.innerText = item.SourceName || 'ไม่ระบุชื่อ';
      if (tambonEl) tambonEl.innerText = 'ตำบล' + (item.TambonName || 'ไม่ระบุ');

      const evalData = item.evaluation || {};
      console.log("Evaluation data loaded:", evalData);

      const evaluatorEl = document.getElementById('eval-evaluator-name');
      const dateEl = document.getElementById('eval-evaluated-date');
      const commentsEl = document.getElementById('eval-comments');
      console.log("Evaluator inputs check:", { evaluatorEl, dateEl, commentsEl });

      if (evaluatorEl) evaluatorEl.value = evalData.evaluator || '';
      if (dateEl) dateEl.value = evalData.evaluated_at || new Date().toISOString().split('T')[0];
      if (commentsEl) commentsEl.value = evalData.comments || '';

      const checklist = evalData.checklist || {};
      const checkboxes = document.querySelectorAll('.eval-check');
      console.log("Checkboxes count:", checkboxes.length);
      checkboxes.forEach(function(cb) {
        const std = cb.getAttribute('data-std');
        const ind = cb.getAttribute('data-ind');
        const idx = cb.getAttribute('data-idx');
        const key = 'std' + std + '_' + ind + '_' + idx;
        cb.checked = checklist[key] === true || checklist[key] === "true";
      });

      calculateEvaluationScore();

      const modal = document.getElementById('admin-source-evaluation-modal');
      console.log("Modal display setup:", modal);
      if (modal) {
        modal.style.display = 'flex';
        console.log("Set display flex successfully!");
      } else {
        console.error("Modal element #admin-source-evaluation-modal not found!");
      }
    } catch (e) {
      console.error("Error in openSourceEvaluation:", e);
      showCustomAlert("เกิดข้อผิดพลาด: " + e.message, "error");
    }
  }
  window.openSourceEvaluation = openSourceEvaluation;

  function closeSourceEvaluationModal() {
    const modal = document.getElementById('admin-source-evaluation-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  window.closeSourceEvaluationModal = closeSourceEvaluationModal;

  function calculateEvaluationScore() {
    try {
      const checkboxes = document.querySelectorAll('.eval-check');
      const checkedData = {};
      checkboxes.forEach(function(cb) {
        const std = cb.getAttribute('data-std');
        const ind = cb.getAttribute('data-ind');
        const idx = cb.getAttribute('data-idx');
        const key = 'std' + std + '_' + ind + '_' + idx;
        checkedData[key] = cb.checked;
      });

      const scores = { std1: 0, std2: 0, std3: 0, std4: 0, std5: 0, std6: 0 };

      // ฟังก์ชันช่วยนับจำนวนกล่องที่ติ๊กในแต่ละตัวบ่งชี้
      function countChecked(std, ind, totalItems) {
        let count = 0;
        for (let i = 0; i < totalItems; i++) {
          if (checkedData['std' + std + '_' + ind + '_' + i] === true) {
            count++;
          }
        }
        return count;
      }

      // ฟังก์ชันคำนวณคะแนนตามแบบประเมิน สกร. (มี 1 ข้อ=1, 2 ข้อ=3, 3 ข้อ=5)
      function calcStandard3Checklist(checkedCount) {
        if (checkedCount === 3) return 5;
        if (checkedCount === 2) return 3;
        if (checkedCount === 1) return 1;
        return 0;
      }

      // ม.1
      const ind1_1 = countChecked(1, '1.1', 3);
      const ind1_2 = countChecked(1, '1.2', 3);
      const ind1_3 = countChecked(1, '1.3', 3);
      const ind1_4 = countChecked(1, '1.4', 3);
      const ind1_5 = countChecked(1, '1.5', 3);

      const s1_1 = calcStandard3Checklist(ind1_1);
      const s1_2 = calcStandard3Checklist(ind1_2);
      const s1_3 = calcStandard3Checklist(ind1_3);
      const s1_4 = calcStandard3Checklist(ind1_4);
      const s1_5 = calcStandard3Checklist(ind1_5);
      
      scores.std1 = parseFloat(((s1_1 + s1_2 + s1_3 + s1_4 + s1_5) / 5).toFixed(2));

      // ม.2
      const ind2_1 = countChecked(2, '2.1', 3);
      const ind2_2 = countChecked(2, '2.2', 3);
      const ind2_3 = countChecked(2, '2.3', 3);
      const ind2_4 = countChecked(2, '2.4', 2); // 2 ข้อย่อย

      const s2_1 = calcStandard3Checklist(ind2_1);
      const s2_2 = calcStandard3Checklist(ind2_2);
      const s2_3 = calcStandard3Checklist(ind2_3);
      
      let s2_4 = 0;
      if (ind2_4 === 2) s2_4 = 5;
      else if (ind2_4 === 1) s2_4 = 3;

      scores.std2 = parseFloat(((s2_1 + s2_2 + s2_3 + s2_4) / 4).toFixed(2));

      // ม.3: 3.1 มี 4 ข้อย่อย: 2 ข้อ=1, 3 ข้อ=3, 4 ข้อ=5
      const ind3_1 = countChecked(3, '3.1', 4);
      let s3_1 = 0;
      if (ind3_1 === 4) s3_1 = 5;
      else if (ind3_1 === 3) s3_1 = 3;
      else if (ind3_1 === 2) s3_1 = 1;
      scores.std3 = s3_1;

      // ม.4: 4.1 มี 6 ข้อย่อย: 2 ข้อ=1, 4 ข้อ=3, 6 ข้อ=5
      const ind4_1 = countChecked(4, '4.1', 6);
      let s4_1 = 0;
      if (ind4_1 === 6) s4_1 = 5;
      else if (ind4_1 >= 4) s4_1 = 3;
      else if (ind4_1 >= 2) s4_1 = 1;
      scores.std4 = s4_1;

      // ม.5: 5.1 มี 3 ข้อย่อย: 1 ข้อ=1, 2 ข้อ=3, 3 ข้อ=5
      const ind5_1 = countChecked(5, '5.1', 3);
      const s5_1 = calcStandard3Checklist(ind5_1);
      scores.std5 = s5_1;

      // ม.6: 6.1 มี 4 ข้อย่อย: 2 ข้อ=1, 3 ข้อ=3, 4 ข้อ=5
      const ind6_1 = countChecked(6, '6.1', 4);
      let s6_1 = 0;
      if (ind6_1 === 4) s6_1 = 5;
      else if (ind6_1 === 3) s6_1 = 3;
      else if (ind6_1 === 2) s6_1 = 1;
      scores.std6 = s6_1;

      // สรุปคะแนน
      const totalScore = parseFloat((scores.std1 + scores.std2 + scores.std3 + scores.std4 + scores.std5 + scores.std6).toFixed(2));
      const averageScore = parseFloat((totalScore / 6).toFixed(2));

      // จัดเกรด
      let grade = 'ต้องปรับปรุง';
      let badgeColor = '#ef4444'; 
      if (averageScore >= 4.5) {
        grade = 'ดีมาก';
        badgeColor = '#10b981'; 
      } else if (averageScore >= 3.5) {
        grade = 'ดี';
        badgeColor = '#3b82f6'; 
      } else if (averageScore >= 2.5) {
        grade = 'พอใช้';
        badgeColor = '#f59e0b'; 
      } else if (averageScore >= 1.5) {
        grade = 'ควรปรับปรุง';
        badgeColor = '#f97316'; 
      }

      // อัปเดต UI รายมาตรฐาน
      const s1 = document.getElementById('eval-score-std1'); if (s1) s1.innerText = scores.std1 + '/5 คะแนน';
      const s2 = document.getElementById('eval-score-std2'); if (s2) s2.innerText = scores.std2 + '/5 คะแนน';
      const s3 = document.getElementById('eval-score-std3'); if (s3) s3.innerText = scores.std3 + '/5 คะแนน';
      const s4 = document.getElementById('eval-score-std4'); if (s4) s4.innerText = scores.std4 + '/5 คะแนน';
      const s5 = document.getElementById('eval-score-std5'); if (s5) s5.innerText = scores.std5 + '/5 คะแนน';
      const s6 = document.getElementById('eval-score-std6'); if (s6) s6.innerText = scores.std6 + '/5 คะแนน';

      // อัปเดต UI สรุปรวม
      const liveTotal = document.getElementById('eval-live-total-score'); if (liveTotal) liveTotal.innerText = totalScore;
      const liveAvg = document.getElementById('eval-live-avg-score'); if (liveAvg) liveAvg.innerText = averageScore.toFixed(2);
      
      const badge = document.getElementById('eval-live-grade-badge');
      if (badge) {
        badge.innerText = grade;
        badge.style.backgroundColor = badgeColor;
      }
    } catch (e) {
      console.error("Error in calculateEvaluationScore:", e);
    }
  }
  window.calculateEvaluationScore = calculateEvaluationScore;

  // ผูกการเปลี่ยนแปลงของเช็คบ็อกซ์ทุกอันเข้ากับการคำนวณคะแนนสด
  document.addEventListener('change', function(e) {
    if (e.target && e.target.classList.contains('eval-check')) {
      calculateEvaluationScore();
    }
  });

  function saveSourceEvaluation() {
    const sourceId = document.getElementById('eval-modal-source-id').value;
    const evaluator = document.getElementById('eval-evaluator-name').value.trim();
    const evaluatedAt = document.getElementById('eval-evaluated-date').value;
    const comments = document.getElementById('eval-comments').value.trim();

    if (!evaluator) {
      return showCustomAlert("กรุณาระบุชื่อผู้ประเมิน", "warning");
    }

    // รวบรวมข้อมูลเช็คลิสต์และคะแนน
    const checkboxes = document.querySelectorAll('.eval-check');
    const checklist = {};
    checkboxes.forEach(function(cb) {
      const std = cb.getAttribute('data-std');
      const ind = cb.getAttribute('data-ind');
      const idx = cb.getAttribute('data-idx');
      const key = 'std' + std + '_' + ind + '_' + idx;
      checklist[key] = cb.checked;
    });

    const scores = {
      std1: parseFloat(document.getElementById('eval-score-std1').innerText),
      std2: parseFloat(document.getElementById('eval-score-std2').innerText),
      std3: parseFloat(document.getElementById('eval-score-std3').innerText),
      std4: parseFloat(document.getElementById('eval-score-std4').innerText),
      std5: parseFloat(document.getElementById('eval-score-std5').innerText),
      std6: parseFloat(document.getElementById('eval-score-std6').innerText),
    };

    const totalScore = parseFloat(document.getElementById('eval-live-total-score').innerText);
    const averageScore = parseFloat(document.getElementById('eval-live-avg-score').innerText);
    const grade = document.getElementById('eval-live-grade-badge').innerText;

    showLoading(true);
    apiPost('saveSourceEvaluation', withAuthData({
      sourceId: sourceId,
      evaluator: evaluator,
      evaluated_at: evaluatedAt,
      comments: comments,
      checklist: checklist,
      scores: scores,
      total_score: totalScore,
      average_score: averageScore,
      grade: grade
    })).then(function(res) {
      showLoading(false);
      if (res.status === 'success') {
        showCustomAlert("บันทึกผลการประเมินมาตรฐานเรียบร้อยแล้ว", "success");
        closeSourceEvaluationModal();
        
        // เคลียร์แคชและโหลดแหล่งเรียนรู้อัปเดตใหม่
        cacheSources = null;
        cacheMapSources = null;
        loadAdminSources();
      } else {
        showCustomAlert(res.message || "บันทึกผลการประเมินไม่สำเร็จ", "error");
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
    });
  }
  window.saveSourceEvaluation = saveSourceEvaluation;

  function downloadSourceStandardCert(sourceId) {
    if (!sourceId) {
      const idEl = document.getElementById('eval-modal-source-id');
      if (idEl) sourceId = idEl.value;
    }
    if (!sourceId && typeof activeSourceDetailData !== 'undefined' && activeSourceDetailData) {
      sourceId = activeSourceDetailData.SourceID;
    }
    if (!sourceId) return showCustomAlert("ไม่พบรหัสแหล่งเรียนรู้", "error");

    showLoading(true);
    apiPost('generateSourceStandardCert', withAuthData({ sourceId: sourceId, isTest: true }))
      .then(function(res) {
        showLoading(false);
        if (res.status === 'success' && res.pdf_base64) {
          const a = document.createElement('a');
          a.href = res.pdf_base64;
          a.download = res.filename || "ใบประกาศมาตรฐาน.pdf";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showCustomAlert("ดาวน์โหลดใบประกาศมาตรฐานแหล่งเรียนรู้เรียบร้อย", "success");
        } else {
          showCustomAlert(res.message || "ไม่สามารถออกใบประกาศได้", "error");
        }
      }).catch(function(err) {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการสร้าง PDF", "error");
      });
  }
  window.downloadSourceStandardCert = downloadSourceStandardCert;

  function openAdminSourceEditorModal(item) {
    clearAdminForm();
    const titleEl = document.getElementById('admin-source-modal-title');
    if (titleEl) titleEl.innerText = "เพิ่มแหล่งเรียนรู้";
    
    const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
    const userTambon = String(localStorage.getItem("userTambon") || "").trim();
    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const instFilter = document.getElementById('admin-source-institution-filter');
    let currentInst = isSuper ? (instFilter ? instFilter.value : 'INS_PHRAO') : userInst;
    if (currentInst === 'ALL' || !currentInst) currentInst = 'INS_PHRAO';

    const filterSelect = document.getElementById('admin-source-tambon-filter');
    let defaultTambon = '';
    if (role === 'teacher' && userTambon) {
      defaultTambon = userTambon;
    } else if (filterSelect && filterSelect.value && filterSelect.value !== 'ทั้งหมด' && filterSelect.value !== 'ALL') {
      defaultTambon = filterSelect.value;
    }
    populateSourceEditorTambons(currentInst, defaultTambon);

    const modalEl = document.getElementById('admin-source-editor-modal');
    if (modalEl) modalEl.style.display = 'flex';
  }
  window.openAdminSourceEditorModal = openAdminSourceEditorModal;

  function closeAdminSourceEditorModal() {
    const modalEl = document.getElementById('admin-source-editor-modal');
    if (modalEl) modalEl.style.display = 'none';
    clearAdminForm();
  }
  window.closeAdminSourceEditorModal = closeAdminSourceEditorModal;

  function openAdminBaseEditorModal(item) {
    const sourceId = (document.getElementById('admin-base-source-id').value || '').trim();
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");

    clearAdminBaseForm();
    const titleEl = document.getElementById('admin-base-modal-title');
    if (titleEl) titleEl.innerText = "เพิ่มฐานการเรียนรู้";
    const modalEl = document.getElementById('admin-base-editor-modal');
    if (modalEl) modalEl.style.display = 'flex';
  }
  window.openAdminBaseEditorModal = openAdminBaseEditorModal;

  function closeAdminBaseEditorModal() {
    const modalEl = document.getElementById('admin-base-editor-modal');
    if (modalEl) modalEl.style.display = 'none';
    clearAdminBaseForm();
  }
  window.closeAdminBaseEditorModal = closeAdminBaseEditorModal;

  window.onAdminSourceInstitutionChange = onAdminSourceInstitutionChange;
  window.onAdminBaseInstitutionChange = onAdminBaseInstitutionChange;
  window.updateTambonFilterOptions = updateTambonFilterOptions;


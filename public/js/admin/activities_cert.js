// LOFT LEARN - Activity Certificate Template Editor Logic
let activeCertActivityId = null;
let activeCertActivityName = '';
let selectedAdminActivityCertField = 'name';
let adminActivityCertSimulationMode = false;

const ADMIN_ACTIVITY_CERT_TEXT_FIELDS = {
  name: { label: 'ชื่อผู้เรียน', marker: '.cert-marker-name', prefix: 'admin-activity-cert-name', defaults: { x: 50, y: 36, width: 62, fontSize: 35, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  source: { label: 'ชื่อกิจกรรม', marker: '.cert-marker-source', prefix: 'admin-activity-cert-source', defaults: { x: 50, y: 47, width: 72, fontSize: 19.5, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  score: { label: 'คะแนน', marker: '.cert-marker-score', prefix: 'admin-activity-cert-score', defaults: { x: 50, y: 56, width: 40, fontSize: 17.5, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  date: { label: 'วันที่', marker: '.cert-marker-date', prefix: 'admin-activity-cert-date', defaults: { x: 50, y: 65, width: 42, fontSize: 17.5, fontFamily: 'Sarabun', color: '#111827', bold: true, italic: false, align: 'center' } },
  refNo: { label: 'เลขอ้างอิง', marker: '.cert-marker-ref', prefix: 'admin-activity-cert-ref', defaults: { x: 50, y: 88, width: 45, fontSize: 10.5, fontFamily: 'Sarabun', color: '#6b7280', bold: false, italic: false, align: 'center' } }
};

function openActivityCertEditor(activityId, activityName) {
  activeCertActivityId = activityId;
  activeCertActivityName = activityName;

  document.getElementById('act-cert-modal-subtitle').innerText = 'กิจกรรม: ' + activityName + ' (' + activityId + ')';
  
  // Set loading state
  showLoading(true);

  // Clear fields and custom fields list
  const customContainer = document.getElementById('admin-activity-cert-custom-fields-list');
  if (customContainer) customContainer.innerHTML = '';
  document.getElementById('admin-activity-cert-bg').value = '';
  document.getElementById('admin-activity-cert-preview').style.display = 'none';

  // Get current template from Firebase via getActivities (or load the activities cache if we have it)
  // Let's call the API to fetch latest activity data or load from adminHomeActivities cache if available
  let cachedActivity = null;
  if (typeof adminHomeActivities !== 'undefined' && Array.isArray(adminHomeActivities)) {
    cachedActivity = adminHomeActivities.find(a => String(a.activityId) === String(activityId));
  }

  if (cachedActivity) {
    showLoading(false);
    setAdminActivityCertificateTemplate(cachedActivity.certificateTemplate || null);
    document.getElementById('admin-activity-cert-modal').style.display = 'flex';
  } else {
    // Fallback: fetch from server
    apiGet('getActivities', withAuthParams())
      .then(function(res) {
        showLoading(false);
        if (res.status === 'success' && Array.isArray(res.activities)) {
          const act = res.activities.find(a => String(a.activityId) === String(activityId));
          if (act) {
            setAdminActivityCertificateTemplate(act.certificateTemplate || null);
            document.getElementById('admin-activity-cert-modal').style.display = 'flex';
          } else {
            showCustomAlert('ไม่พบข้อมูลกิจกรรมนี้', 'error');
          }
        } else {
          showCustomAlert('ไม่สามารถโหลดเทมเพลตเกียรติบัตรได้', 'error');
        }
      })
      .catch(function() {
        showLoading(false);
        showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
      });
  }
}

function closeActivityCertModal() {
  document.getElementById('admin-activity-cert-modal').style.display = 'none';
}

function handleActivityCertificateUpload(input) {
  if (input.files && input.files[0]) {
    currentCropContext = 'activityCertificateTemplate';
    currentFileName = "activity_certificate_template_" + Date.now() + "_" + input.files[0].name;
    openCropModal(input.files[0]);
  }
}

function setAdminActivityCertificateTemplate(template) {
  const cert = template || {};
  const fields = cert.fields || {};
  const name = fields.name || {};
  const sourceField = fields.source || {};
  const score = fields.score || {};
  const date = fields.date || {};
  const refNoField = fields.refNo || {};
  
  document.getElementById('admin-activity-cert-bg').value = cert.backgroundUrl || '';
  
  // Signature defaults
  const sig = cert.signature || {};
  setNumberValue('admin-activity-cert-sig-x', sig.x, 50);
  setNumberValue('admin-activity-cert-sig-y', sig.y, 80);
  setNumberValue('admin-activity-cert-sig-w', sig.width, 15);

  setNumberValue('admin-activity-cert-name-x', name.x, 50);
  setNumberValue('admin-activity-cert-name-y', name.y, 47);
  setNumberValue('admin-activity-cert-name-w', name.width, 62);
  setNumberValue('admin-activity-cert-name-size', name.fontSize, 42);
  setNumberValue('admin-activity-cert-source-x', sourceField.x, 50);
  setNumberValue('admin-activity-cert-source-y', sourceField.y, 56);
  setNumberValue('admin-activity-cert-source-w', sourceField.width, 72);
  setNumberValue('admin-activity-cert-source-size', sourceField.fontSize, 20);
  setNumberValue('admin-activity-cert-score-x', score.x, 50);
  setNumberValue('admin-activity-cert-score-y', score.y, 68);
  setNumberValue('admin-activity-cert-score-w', score.width, 40);
  setNumberValue('admin-activity-cert-score-size', score.fontSize, 18);
  setNumberValue('admin-activity-cert-date-x', date.x, 50);
  setNumberValue('admin-activity-cert-date-y', date.y, 78);
  setNumberValue('admin-activity-cert-date-w', date.width, 42);
  setNumberValue('admin-activity-cert-date-size', date.fontSize, 18);
  setNumberValue('admin-activity-cert-ref-x', refNoField.x, 50);
  setNumberValue('admin-activity-cert-ref-y', refNoField.y, 88);
  setNumberValue('admin-activity-cert-ref-w', refNoField.width, 45);
  setNumberValue('admin-activity-cert-ref-size', refNoField.fontSize, 14);

  setAdminActivityCertFieldState('name', Object.assign({}, ADMIN_ACTIVITY_CERT_TEXT_FIELDS.name.defaults, name));
  setAdminActivityCertFieldState('source', Object.assign({}, ADMIN_ACTIVITY_CERT_TEXT_FIELDS.source.defaults, sourceField));
  setAdminActivityCertFieldState('score', Object.assign({}, ADMIN_ACTIVITY_CERT_TEXT_FIELDS.score.defaults, score));
  setAdminActivityCertFieldState('date', Object.assign({}, ADMIN_ACTIVITY_CERT_TEXT_FIELDS.date.defaults, date));
  setAdminActivityCertFieldState('refNo', Object.assign({}, ADMIN_ACTIVITY_CERT_TEXT_FIELDS.refNo.defaults, refNoField));

  // Populate custom fields list
  const customContainer = document.getElementById('admin-activity-cert-custom-fields-list');
  if (customContainer) {
    customContainer.innerHTML = '';
    (cert.customFields || []).forEach(f => {
      addAdminActivityCertCustomFieldRow(f);
    });
  }

  selectedAdminActivityCertField = 'name';
  updateAdminActivityCertPreview();
}

function getAdminActivityCertFieldState(key) {
  const cfg = ADMIN_ACTIVITY_CERT_TEXT_FIELDS[key];
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

function setAdminActivityCertFieldState(key, data) {
  const cfg = ADMIN_ACTIVITY_CERT_TEXT_FIELDS[key];
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

function getAdminActivityCertCustomRow(index) {
  const rows = document.querySelectorAll('#admin-activity-cert-custom-fields-list .admin-cert-custom-field-row');
  return rows[index] || null;
}

function getAdminActivityCertCustomState(row) {
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

function setAdminActivityCertCustomState(row, state) {
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

function getSelectedAdminActivityCertState() {
  if (selectedAdminActivityCertField.startsWith('custom:')) {
    const row = getAdminActivityCertCustomRow(Number(selectedAdminActivityCertField.split(':')[1]));
    return getAdminActivityCertCustomState(row);
  }
  return getAdminActivityCertFieldState(selectedAdminActivityCertField);
}

function setSelectedAdminActivityCertState(state) {
  if (!state) return;
  if (selectedAdminActivityCertField.startsWith('custom:')) {
    const row = getAdminActivityCertCustomRow(Number(selectedAdminActivityCertField.split(':')[1]));
    setAdminActivityCertCustomState(row, state);
    return;
  }
  setAdminActivityCertFieldState(selectedAdminActivityCertField, state);
}

function getAdminActivityCertScaleRatio() {
  const preview = document.getElementById('admin-activity-cert-preview');
  if (!preview) return 0.48;
  const rect = preview.getBoundingClientRect();
  let containerWidth = rect.width;
  if (!containerWidth || containerWidth < 100) {
    containerWidth = preview.parentElement ? preview.parentElement.clientWidth : 480;
  }
  if (!containerWidth || containerWidth < 100) containerWidth = 480;
  return containerWidth / 1000;
}

function applyAdminActivityCertMarkerStyle(marker, state) {
  if (!marker || !state) return;
  marker.style.left = state.x + '%';
  marker.style.top = state.y + '%';
  marker.style.width = state.width + '%';
  marker.style.fontSize = Math.max(6, state.fontSize * getAdminActivityCertScaleRatio()) + 'px';
  marker.style.fontFamily = '"' + (state.fontFamily || 'Sarabun') + '","Noto Sans Thai",Arial,sans-serif';
  marker.style.color = state.color || '#111827';
  marker.style.fontWeight = state.bold ? '900' : '500';
  marker.style.fontStyle = state.italic ? 'italic' : 'normal';
  marker.style.textAlign = state.align || 'center';
}

function refreshAdminActivityCertFieldSelector() {
  const select = document.getElementById('admin-activity-cert-selected-field');
  if (!select) return;
  const oldValue = selectedAdminActivityCertField || select.value || 'name';
  const builtIns = Object.keys(ADMIN_ACTIVITY_CERT_TEXT_FIELDS).map(key => '<option value="' + key + '">' + ADMIN_ACTIVITY_CERT_TEXT_FIELDS[key].label + '</option>');
  const customOptions = [];
  document.querySelectorAll('#admin-activity-cert-custom-fields-list .admin-cert-custom-field-row').forEach((row, idx) => {
    const state = getAdminActivityCertCustomState(row) || {};
    const label = (state.text || 'ข้อความเอง ' + (idx + 1)).slice(0, 24);
    customOptions.push('<option value="custom:' + idx + '">' + label + '</option>');
  });
  select.innerHTML = builtIns.concat(customOptions).join('');
  select.value = select.querySelector('option[value="' + oldValue + '"]') ? oldValue : 'name';
  selectedAdminActivityCertField = select.value;
}

function syncAdminActivityCertToolbar() {
  const toolbar = document.getElementById('admin-activity-cert-text-toolbar');
  const preview = document.getElementById('admin-activity-cert-preview');
  if (toolbar) toolbar.style.display = (preview && preview.style.display !== 'none') ? 'flex' : 'none';
  refreshAdminActivityCertFieldSelector();
  const state = getSelectedAdminActivityCertState() || getAdminActivityCertFieldState('name');
  if (!state) return;
  const font = document.getElementById('admin-activity-cert-toolbar-font');
  const size = document.getElementById('admin-activity-cert-toolbar-size');
  const color = document.getElementById('admin-activity-cert-toolbar-color');
  if (font) font.value = state.fontFamily || 'Sarabun';
  if (size) size.value = state.fontSize || 16;
  if (color) color.value = state.color || '#111827';
  const boldBtn = document.getElementById('admin-activity-cert-toolbar-bold');
  const italicBtn = document.getElementById('admin-activity-cert-toolbar-italic');
  if (boldBtn) boldBtn.classList.toggle('active', !!state.bold);
  if (italicBtn) italicBtn.classList.toggle('active', !!state.italic);

  const previewEl = document.getElementById('admin-activity-cert-preview');
  if (previewEl) {
    previewEl.querySelectorAll('.cert-position-marker').forEach(el => el.classList.remove('is-selected'));
    let selectedEl = null;
    if (selectedAdminActivityCertField.startsWith('custom:')) {
      selectedEl = previewEl.querySelector('.cert-marker-custom[data-cert-field="' + selectedAdminActivityCertField + '"]');
    } else {
      const cfg = ADMIN_ACTIVITY_CERT_TEXT_FIELDS[selectedAdminActivityCertField];
      selectedEl = cfg ? previewEl.querySelector(cfg.marker) : null;
    }
    if (selectedEl) selectedEl.classList.add('is-selected');
  }
}

function selectAdminActivityCertText(value) {
  selectedAdminActivityCertField = value || 'name';
  syncAdminActivityCertToolbar();
}

function applyAdminActivityCertToolbarChange() {
  const state = getSelectedAdminActivityCertState();
  if (!state) return;
  const font = document.getElementById('admin-activity-cert-toolbar-font');
  const size = document.getElementById('admin-activity-cert-toolbar-size');
  const color = document.getElementById('admin-activity-cert-toolbar-color');
  state.fontFamily = font ? font.value : state.fontFamily;
  state.fontSize = size ? Number(size.value) || state.fontSize : state.fontSize;
  state.color = color ? color.value : state.color;
  setSelectedAdminActivityCertState(state);
  updateAdminActivityCertPreview();
}

function changeAdminActivityCertFontSize(delta) {
  const size = document.getElementById('admin-activity-cert-toolbar-size');
  if (!size) return;
  const next = Math.max(6, Math.min(96, (Number(size.value) || 16) + delta));
  size.value = String(next);
  applyAdminActivityCertToolbarChange();
}

function toggleAdminActivityCertStyle(prop) {
  const state = getSelectedAdminActivityCertState();
  if (!state) return;
  if (prop === 'bold') state.bold = !state.bold;
  if (prop === 'italic') state.italic = !state.italic;
  setSelectedAdminActivityCertState(state);
  updateAdminActivityCertPreview();
}

function setAdminActivityCertAlign(align) {
  const state = getSelectedAdminActivityCertState();
  if (!state) return;
  state.align = ['left', 'center', 'right'].includes(align) ? align : 'center';
  setSelectedAdminActivityCertState(state);
  updateAdminActivityCertPreview();
}

function makeActivityMarkerDraggable(markerEl, inputX, inputY) {
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
      selectedAdminActivityCertField = markerEl.dataset.certField;
      syncAdminActivityCertToolbar();
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

    const previewContainer = document.getElementById('admin-activity-cert-preview');
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
      selectedAdminActivityCertField = markerEl.dataset.certField;
      syncAdminActivityCertToolbar();
    }
  });
}

function bindActivityMarkerDraggables() {
  const preview = document.getElementById('admin-activity-cert-preview');
  if (!preview) return;
  makeActivityMarkerDraggable(preview.querySelector('.cert-marker-name'), 'admin-activity-cert-name-x', 'admin-activity-cert-name-y');
  makeActivityMarkerDraggable(preview.querySelector('.cert-marker-source'), 'admin-activity-cert-source-x', 'admin-activity-cert-source-y');
  makeActivityMarkerDraggable(preview.querySelector('.cert-marker-score'), 'admin-activity-cert-score-x', 'admin-activity-cert-score-y');
  makeActivityMarkerDraggable(preview.querySelector('.cert-marker-date'), 'admin-activity-cert-date-x', 'admin-activity-cert-date-y');
  makeActivityMarkerDraggable(preview.querySelector('.cert-marker-ref'), 'admin-activity-cert-ref-x', 'admin-activity-cert-ref-y');
  makeActivityMarkerDraggable(preview.querySelector('.cert-marker-sig'), 'admin-activity-cert-sig-x', 'admin-activity-cert-sig-y');
}

function bindActivityCertInputListeners() {
  const inputs = [
    'admin-activity-cert-name-x', 'admin-activity-cert-name-y', 'admin-activity-cert-name-w', 'admin-activity-cert-name-size',
    'admin-activity-cert-source-x', 'admin-activity-cert-source-y', 'admin-activity-cert-source-w', 'admin-activity-cert-source-size',
    'admin-activity-cert-score-x', 'admin-activity-cert-score-y', 'admin-activity-cert-score-w', 'admin-activity-cert-score-size',
    'admin-activity-cert-date-x', 'admin-activity-cert-date-y', 'admin-activity-cert-date-w', 'admin-activity-cert-date-size',
    'admin-activity-cert-ref-x', 'admin-activity-cert-ref-y', 'admin-activity-cert-ref-w', 'admin-activity-cert-ref-size',
    'admin-activity-cert-sig-x', 'admin-activity-cert-sig-y', 'admin-activity-cert-sig-w'
  ];
  Object.keys(ADMIN_ACTIVITY_CERT_TEXT_FIELDS).forEach(key => {
    const p = ADMIN_ACTIVITY_CERT_TEXT_FIELDS[key].prefix;
    inputs.push(p + '-font', p + '-color', p + '-bold', p + '-italic', p + '-align');
  });
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.listenerBound) {
      el.dataset.listenerBound = "true";
      el.addEventListener('input', updateAdminActivityCertPreview);
    }
  });
}

function addAdminActivityCertCustomFieldRow(f) {
  const container = document.getElementById('admin-activity-cert-custom-fields-list');
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
      <button type="button" class="btn-primary" style="padding:4px 8px; font-size:0.68rem; background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="this.closest('.admin-cert-custom-field-row').remove(); selectedAdminActivityCertField='name'; updateAdminActivityCertPreview();">ลบ</button>
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
    input.addEventListener('input', updateAdminActivityCertPreview);
  });
  selectedAdminActivityCertField = 'custom:' + idx;
  updateAdminActivityCertPreview();
}

function updateAdminActivityCertPreview() {
  const preview = document.getElementById('admin-activity-cert-preview');
  if (!preview) return;
  const bg = (document.getElementById('admin-activity-cert-bg').value || '').trim();
  preview.style.display = bg ? 'block' : 'none';
  if (bg) preview.style.backgroundImage = "url('" + bg + "')";

  const sigField = preview.querySelector('.cert-marker-sig');

  const today = new Date();
  const refNoVal = `LOFT-${today.getFullYear() + 543}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-9999`;
  const thDate = new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'long', year: 'numeric' }).format(today);

  const markerText = {
    name: adminActivityCertSimulationMode ? 'นายสมชาย รักดี' : 'ชื่อผู้เรียน',
    source: adminActivityCertSimulationMode ? activeCertActivityName : 'ชื่อกิจกรรม',
    score: adminActivityCertSimulationMode ? 'คะแนนทดสอบ 10/10' : 'คะแนน',
    date: adminActivityCertSimulationMode ? thDate : 'วันที่',
    refNo: adminActivityCertSimulationMode ? ('เลขอ้างอิง: ' + refNoVal) : 'เลขอ้างอิง'
  };

  Object.keys(ADMIN_ACTIVITY_CERT_TEXT_FIELDS).forEach(key => {
    const cfg = ADMIN_ACTIVITY_CERT_TEXT_FIELDS[key];
    const marker = preview.querySelector(cfg.marker);
    if (!marker) return;
    marker.dataset.certField = key;
    marker.innerText = markerText[key];
    marker.classList.toggle('simulating', adminActivityCertSimulationMode);
    applyAdminActivityCertMarkerStyle(marker, getAdminActivityCertFieldState(key));
  });

  if (sigField) {
    const sigX = getNumberValue('admin-activity-cert-sig-x', 50);
    const sigY = getNumberValue('admin-activity-cert-sig-y', 75);
    const sigW = getNumberValue('admin-activity-cert-sig-w', 15);
    sigField.style.left = sigX + '%';
    sigField.style.top = sigY + '%';
    sigField.style.width = sigW + '%';
    
    // Signature URL: load from global signature URL settings
    let sigUrl = '';
    const globalSigEl = document.getElementById('global-signature-url');
    if (globalSigEl) sigUrl = globalSigEl.value || '';
    
    const labelEl = sigField.querySelector('.sig-label');
    const imgEl = sigField.querySelector('.sig-preview-img');
    if (sigUrl) {
      if (imgEl) {
        imgEl.src = sigUrl;
        imgEl.style.display = 'block';
      }
      if (labelEl) labelEl.style.display = 'none';
      sigField.classList.add('simulating');
    } else {
      if (imgEl) imgEl.style.display = 'none';
      if (labelEl) labelEl.style.display = 'block';
      sigField.classList.remove('simulating');
    }

    let dirPreview = sigField.querySelector('.sig-director-preview');
    if (!dirPreview) {
      dirPreview = document.createElement('div');
      dirPreview.className = 'sig-director-preview';
      dirPreview.style.cssText = 'text-align: center; margin-top: 4px; pointer-events: none; width: 100%; white-space: nowrap; font-family: "Sarabun","Noto Sans Thai",sans-serif;';
      sigField.appendChild(dirPreview);
    }
    
    const ratio = getAdminActivityCertScaleRatio();
    const dNameSize = Math.max(7, Math.round(18 * ratio));
    const dTitleSize = Math.max(5.5, Math.round(13.5 * ratio));

    dirPreview.innerHTML = `
      <div style="font-size: ${dNameSize}px; font-weight: 800; color: #111827; line-height: 1.2;">(นายประวิตร ประธรรมโย)</div>
      <div style="font-size: ${dTitleSize}px; font-weight: 400; color: #475569; line-height: 1.2; margin-top: 2px;">ผู้อำนวยการศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว</div>
    `;

    makeActivityMarkerDraggable(sigField, 'admin-activity-cert-sig-x', 'admin-activity-cert-sig-y');
  }

  preview.querySelectorAll('.cert-marker-custom').forEach(el => el.remove());
  document.querySelectorAll('#admin-activity-cert-custom-fields-list .admin-cert-custom-field-row').forEach((row, idx) => {
    const state = getAdminActivityCertCustomState(row);
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
    marker.classList.toggle('simulating', adminActivityCertSimulationMode);
    applyAdminActivityCertMarkerStyle(marker, state);
    preview.appendChild(marker);
    makeActivityMarkerDraggable(marker, xInput, yInput);
  });

  bindActivityMarkerDraggables();
  bindActivityCertInputListeners();
  syncAdminActivityCertToolbar();
}

function toggleAdminActivityCertSimulation() {
  adminActivityCertSimulationMode = !adminActivityCertSimulationMode;
  const btn = document.getElementById('btn-admin-activity-cert-simulate');
  if (btn) {
    if (adminActivityCertSimulationMode) {
      btn.innerHTML = '<i class="fas fa-edit mr-1"></i>โหมดแก้ไขตำแหน่ง';
      btn.style.background = 'linear-gradient(135deg, var(--gold), #d97706)';
      btn.style.color = '#fff';
    } else {
      btn.innerHTML = '<i class="fas fa-eye mr-1"></i>จำลองข้อความจริง';
      btn.style.background = 'var(--glass)';
      btn.style.color = 'var(--text)';
    }
  }
  updateAdminActivityCertPreview();
}

function getAdminActivityCertificateTemplate() {
  const bg = (document.getElementById('admin-activity-cert-bg').value || '').trim();
  if (!bg) return null;

  const template = {
    backgroundUrl: bg,
    signature: {
      x: getNumberValue('admin-activity-cert-sig-x', 50),
      y: getNumberValue('admin-activity-cert-sig-y', 80),
      width: getNumberValue('admin-activity-cert-sig-w', 15)
    },
    customFields: [],
    fields: {
      name: {
        x: getNumberValue('admin-activity-cert-name-x', 50),
        y: getNumberValue('admin-activity-cert-name-y', 36),
        width: getNumberValue('admin-activity-cert-name-w', 62),
        fontSize: getNumberValue('admin-activity-cert-name-size', 38),
        fontFamily: getTextValue('admin-activity-cert-name-font', 'Sarabun'),
        color: getTextValue('admin-activity-cert-name-color', '#111827'),
        bold: getBoolValue('admin-activity-cert-name-bold', true),
        italic: getBoolValue('admin-activity-cert-name-italic', false),
        align: getTextValue('admin-activity-cert-name-align', 'center')
      },
      source: {
        x: getNumberValue('admin-activity-cert-source-x', 50),
        y: getNumberValue('admin-activity-cert-source-y', 47),
        width: getNumberValue('admin-activity-cert-source-w', 72),
        fontSize: getNumberValue('admin-activity-cert-source-size', 28),
        fontFamily: getTextValue('admin-activity-cert-source-font', 'Sarabun'),
        color: getTextValue('admin-activity-cert-source-color', '#111827'),
        bold: getBoolValue('admin-activity-cert-source-bold', true),
        italic: getBoolValue('admin-activity-cert-source-italic', false),
        align: getTextValue('admin-activity-cert-source-align', 'center')
      },
      score: {
        x: getNumberValue('admin-activity-cert-score-x', 50),
        y: getNumberValue('admin-activity-cert-score-y', 56),
        width: getNumberValue('admin-activity-cert-score-w', 40),
        fontSize: getNumberValue('admin-activity-cert-score-size', 18),
        fontFamily: getTextValue('admin-activity-cert-score-font', 'Sarabun'),
        color: getTextValue('admin-activity-cert-score-color', '#111827'),
        bold: getBoolValue('admin-activity-cert-score-bold', true),
        italic: getBoolValue('admin-activity-cert-score-italic', false),
        align: getTextValue('admin-activity-cert-score-align', 'center')
      },
      date: {
        x: getNumberValue('admin-activity-cert-date-x', 50),
        y: getNumberValue('admin-activity-cert-date-y', 65),
        width: getNumberValue('admin-activity-cert-date-w', 42),
        fontSize: getNumberValue('admin-activity-cert-date-size', 18),
        fontFamily: getTextValue('admin-activity-cert-date-font', 'Sarabun'),
        color: getTextValue('admin-activity-cert-date-color', '#111827'),
        bold: getBoolValue('admin-activity-cert-date-bold', true),
        italic: getBoolValue('admin-activity-cert-date-italic', false),
        align: getTextValue('admin-activity-cert-date-align', 'center')
      },
      refNo: {
        x: getNumberValue('admin-activity-cert-ref-x', 50),
        y: getNumberValue('admin-activity-cert-ref-y', 88),
        width: getNumberValue('admin-activity-cert-ref-w', 45),
        fontSize: getNumberValue('admin-activity-cert-ref-size', 14),
        fontFamily: getTextValue('admin-activity-cert-ref-font', 'Sarabun'),
        color: getTextValue('admin-activity-cert-ref-color', '#6b7280'),
        bold: getBoolValue('admin-activity-cert-ref-bold', false),
        italic: getBoolValue('admin-activity-cert-ref-italic', false),
        align: getTextValue('admin-activity-cert-ref-align', 'center')
      }
    }
  };

  const rows = document.querySelectorAll('#admin-activity-cert-custom-fields-list .admin-cert-custom-field-row');
  rows.forEach(row => {
    const state = getAdminActivityCertCustomState(row);
    if (state && state.text) {
      template.customFields.push(state);
    }
  });

  return template;
}

function testGenerateAdminActivityCert() {
  const activityId = activeCertActivityId;
  const activityName = activeCertActivityName || 'กิจกรรมทดสอบ';
  const phone = localStorage.getItem("userPhone") || "guest";
  const liveTemplate = getAdminActivityCertificateTemplate();

  if (!activityId) {
    return showCustomAlert("กรุณาเลือกกิจกรรมก่อนทดสอบออกใบประกาศ", "warning");
  }

  showLoading(true);
  apiPost('generateCert', withAuthData({
    name: 'นายสมชาย รักดี (ทดสอบระบบ)',
    source: activityName,
    score: '100%',
    phone: phone,
    activityId: activityId,
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

function resetAdminActivityCertificateTemplate() {
  const bgEl = document.getElementById('admin-activity-cert-bg');
  if (bgEl) bgEl.value = '';
  const customContainer = document.getElementById('admin-activity-cert-custom-fields-list');
  if (customContainer) customContainer.innerHTML = '';
  const previewEl = document.getElementById('admin-activity-cert-preview');
  if (previewEl) previewEl.style.display = 'none';
  showCustomAlert('ยกเลิกเทมเพลตเฉพาะกิจกรรมเรียบร้อยแล้ว<br><small class="text-muted">ระบบจะใช้ใบประกาศมาตรฐานของระบบให้อัตโนมัติเมื่อกดบันทึก</small>', 'info');
}

window.toggleAdminActivityCertSimulation = toggleAdminActivityCertSimulation;
window.testGenerateAdminActivityCert = testGenerateAdminActivityCert;
window.resetAdminActivityCertificateTemplate = resetAdminActivityCertificateTemplate;
window.getAdminActivityCertificateTemplate = getAdminActivityCertificateTemplate;

function saveActivityCertificateTemplate() {
  if (!activeCertActivityId) return;
  const bg = (document.getElementById('admin-activity-cert-bg').value || '').trim();
  if (!bg) {
    showCustomConfirm("คุณยังไม่ได้กำหนดภาพพื้นหลังใบเกียรติบัตร ยืนยันที่จะบันทึกค่านี่ใช่หรือไม่? (ระบบจะใช้แบบฟอร์มเกียรติบัตรมาตรฐานแทน)", function() {
      submitActivityCertTemplateSave(null);
    });
  } else {
    const template = getAdminActivityCertificateTemplate();
    submitActivityCertTemplateSave(template);
  }
}

function submitActivityCertTemplateSave(template) {
  showLoading(true);
  apiPost('saveActivityCertificateTemplate', withAuthData({
    activityId: activeCertActivityId,
    certificateTemplate: template
  }))
  .then(function(res) {
    showLoading(false);
    if (res.status === 'success') {
      showCustomAlert('บันทึกเทมเพลตใบประกาศสำหรับกิจกรรมเรียบร้อยแล้ว!', 'success');
      
      // Update local cache
      if (typeof adminHomeActivities !== 'undefined' && Array.isArray(adminHomeActivities)) {
        const act = adminHomeActivities.find(a => String(a.activityId) === String(activeCertActivityId));
        if (act) act.certificateTemplate = template;
      }
      closeActivityCertModal();
    } else {
      showCustomAlert(res.message || 'บันทึกค่ายเกียรติบัตรไม่สำเร็จ', 'error');
    }
  })
  .catch(function() {
    showLoading(false);
    showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
  });
}

// Bind resize listener for the activity cert surface preview
window.addEventListener('resize', function() {
  const modal = document.getElementById('admin-activity-cert-modal');
  if (modal && modal.style.display !== 'none') {
    updateAdminActivityCertPreview();
  }
});

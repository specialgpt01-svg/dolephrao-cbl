// LOFT LEARN - Admin Institutions & Sub-Units Management Component
(function() {
  'use strict';

  let _activeEditingSubUnits = [];
  let _activeEditingInstId = null;

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * โหลดข้อมูลสถานศึกษาทั้งหมดและสถิติ
   */
  function loadAdminInstitutions(forceFresh) {
    const listContainer = document.getElementById('admin-institutions-list');
    if (!listContainer) return;

    if (forceFresh) {
      window._cachedInstitutionsList = null;
    }

    listContainer.innerHTML = 
      '<div class="text-center py-8 text-muted">' +
        '<i class="fas fa-spinner fa-spin fa-2x mb-2"></i>' +
        '<p class="text-xs">กำลังโหลดข้อมูลสถานศึกษาและสถานศึกษาในสังกัด...</p>' +
      '</div>';

    apiGet('getInstitutions', withAuthParams({}))
      .then(function(res) {
        if (res && res.status === 'success') {
          const list = res.institutions || [];
          window._cachedInstitutionsList = list;

          // อัปเดตการ์ด KPI สรุปภาพรวม
          const stats = res.stats || {};
          const statTotal = document.getElementById('inst-stat-total');
          const statSubUnits = document.getElementById('inst-stat-sub-units');
          const statUsers = document.getElementById('inst-stat-users');
          const statSources = document.getElementById('inst-stat-sources');

          if (statTotal) statTotal.innerText = stats.totalInstitutions !== undefined ? stats.totalInstitutions : list.length;
          if (statSubUnits) statSubUnits.innerText = stats.totalSubUnits !== undefined ? stats.totalSubUnits : list.reduce((acc, cur) => acc + (cur.subUnitsCount || 0), 0);
          if (statUsers) statUsers.innerText = stats.totalUsers !== undefined ? stats.totalUsers : '-';
          if (statSources) statSources.innerText = stats.totalSources !== undefined ? stats.totalSources : '-';

          renderAdminInstitutionsList(list, res.isSuperAdmin);
        } else {
          listContainer.innerHTML = 
            '<div class="text-center py-6 text-danger text-xs">' +
              '<i class="fas fa-exclamation-circle fa-2x mb-2"></i>' +
              '<p>' + escapeHtml((res && res.message) || 'โหลดข้อมูลสถานศึกษาไม่สำเร็จ') + '</p>' +
            '</div>';
        }
      })
      .catch(function(err) {
        listContainer.innerHTML = 
          '<div class="text-center py-6 text-danger text-xs">' +
            '<i class="fas fa-exclamation-triangle fa-2x mb-2"></i>' +
            '<p>เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์</p>' +
          '</div>';
      });
  }

  /**
   * เรนเดอร์การ์ดรายการสถานศึกษา
   */
  function renderAdminInstitutionsList(list, isSuperAdmin) {
    const container = document.getElementById('admin-institutions-list');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = 
        '<div class="text-center py-8 loft-card" style="background:var(--bg2); border:1px dashed var(--card-border);">' +
          '<i class="fas fa-university text-3xl mb-2 text-muted"></i>' +
          '<h5 class="font-bold text-sm text-theme-inv">ยังไม่มีข้อมูลสถานศึกษาในระบบ</h5>' +
          '<p class="text-xs text-muted mb-3">กดปุ่ม "เพิ่มสถานศึกษาใหม่" ด้านบนเพื่อเริ่มต้นสร้างสถานศึกษา</p>' +
          '<button type="button" class="btn-primary text-xs" style="padding:6px 14px; border-radius:var(--r-pill); background:linear-gradient(135deg,#2563eb,#1d4ed8); border:none; color:white;" onclick="openInstitutionModal()">' +
            '<i class="fas fa-plus mr-1"></i> เพิ่มสถานศึกษาแรก' +
          '</button>' +
        '</div>';
      return;
    }

    let html = '';
    list.forEach(function(inst) {
      const subUnits = inst.subUnits || inst.sub_units || [];
      const subUnitsCount = subUnits.length;
      const themeColor = inst.themeColor || '#059669';
      const isMainPhrao = inst.id === 'INS_PHRAO';

      let subUnitsPreviewHtml = '';
      if (subUnitsCount > 0) {
        const previewItems = subUnits.slice(0, 8);
        previewItems.forEach(function(sub) {
          subUnitsPreviewHtml += 
            '<span class="inst-subunit-tag" style="background:var(--glass); border:1px solid var(--glass-border); color:var(--text);">' +
              '<i class="fas fa-school text-[10px] mr-1" style="color:' + themeColor + '"></i>' +
              escapeHtml(sub) +
            '</span>';
        });
        if (subUnitsCount > 8) {
          subUnitsPreviewHtml += 
            '<span class="inst-subunit-tag font-bold" style="background:var(--bg2); border:1px solid var(--card-border); color:var(--text-soft);">' +
              '+ อีก ' + (subUnitsCount - 8) + ' แห่ง' +
            '</span>';
        }
      } else {
        subUnitsPreviewHtml = '<span class="text-xs text-muted italic">ยังไม่มีรายชื่อสถานศึกษาในสังกัด (คลิกปุ่มจัดการสังกัดเพื่อเพิ่ม)</span>';
      }

      html += 
        '<div class="loft-card inst-card-item mb-4" style="background:var(--card-solid, var(--card)); border:1px solid var(--card-border); border-radius:20px; padding:18px; position:relative; overflow:hidden;">' +
          
          '<!-- Top Color Accent Bar -->' +
          '<div style="position:absolute; top:0; left:0; right:0; height:4px; background:' + themeColor + ';"></div>' +

          '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-3">' +
            '<div class="flex items-start gap-3">' +
              '<div style="width:46px; height:46px; border-radius:14px; background:linear-gradient(135deg, ' + themeColor + ', #064e3b); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:white; font-size:1.3rem; box-shadow:0 4px 12px rgba(0,0,0,0.15);">' +
                '<i class="fas fa-university"></i>' +
              '</div>' +
              '<div>' +
                '<div class="flex items-center gap-2 flex-wrap">' +
                  '<h4 class="font-black text-base text-theme-inv" style="margin:0;">' + escapeHtml(inst.name) + '</h4>' +
                  '<span class="badge badge-primary text-[10px] font-mono font-bold" style="background:rgba(37,99,235,0.12); color:#2563eb; border:1px solid rgba(37,99,235,0.25);">' + escapeHtml(inst.id) + '</span>' +
                  (isMainPhrao ? '<span class="badge text-[10px] font-bold" style="background:rgba(16,185,129,0.15); color:#10b981;">⭐ สถานศึกษาหลัก</span>' : '') +
                '</div>' +
                '<p class="text-xs text-muted mt-1 mb-0">' +
                  '<i class="fas fa-location-dot mr-1 text-red-400"></i>' + escapeHtml(inst.district || '-') + ' จ.' + escapeHtml(inst.province || 'เชียงใหม่') +
                  (inst.code && inst.code !== inst.id ? ' • <span class="text-muted">รหัสย่อ: ' + escapeHtml(inst.code) + '</span>' : '') +
                '</p>' +
              '</div>' +
            '</div>' +

            '<!-- Action Buttons -->' +
            '<div class="flex items-center gap-2 flex-wrap">' +
              '<button type="button" class="btn-primary text-xs" style="padding:7px 14px; border-radius:var(--r-pill); background:linear-gradient(135deg,#059669,#047857); border:none; color:white; font-weight:700;" onclick="openManageSubUnitsModal(\'' + escapeJS(inst.id) + '\')">' +
                '<i class="fas fa-sitemap mr-1"></i> จัดการสถานศึกษาในสังกัด (' + subUnitsCount + ')' +
              '</button>' +
              '<button type="button" class="btn-primary text-xs" style="padding:7px 12px; border-radius:var(--r-pill); background:var(--glass); border:1px solid var(--card-border); color:var(--text); font-weight:700;" onclick="openInstitutionModal(\'' + escapeJS(inst.id) + '\')">' +
                '<i class="fas fa-edit mr-1"></i> แก้ไข' +
              '</button>' +
              (isSuperAdmin && !isMainPhrao ? 
                '<button type="button" class="btn-primary text-xs text-rose-500" style="padding:7px 10px; border-radius:var(--r-pill); background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); font-weight:700;" onclick="deleteInstitutionAction(\'' + escapeJS(inst.id) + '\', \'' + escapeJS(inst.name) + '\')">' +
                  '<i class="fas fa-trash-alt"></i>' +
                '</button>' : '') +
            '</div>' +
          '</div>' +

          '<!-- Statistics Badges -->' +
          '<div class="grid grid-cols-3 gap-2 my-3 text-center">' +
            '<div class="p-2 rounded-xl" style="background:var(--bg2); border:1px solid var(--card-border);">' +
              '<span class="text-muted text-[10px] block font-bold">สถานศึกษาในสังกัด</span>' +
              '<strong class="text-theme-inv text-sm font-black">' + subUnitsCount + '</strong> <span class="text-[10px] text-muted">แห่ง</span>' +
            '</div>' +
            '<div class="p-2 rounded-xl" style="background:var(--bg2); border:1px solid var(--card-border);">' +
              '<span class="text-muted text-[10px] block font-bold">ผู้เรียนในระบบ</span>' +
              '<strong class="text-theme-inv text-sm font-black">' + (inst.usersCount || 0) + '</strong> <span class="text-[10px] text-muted">คน</span>' +
            '</div>' +
            '<div class="p-2 rounded-xl" style="background:var(--bg2); border:1px solid var(--card-border);">' +
              '<span class="text-muted text-[10px] block font-bold">แหล่งเรียนรู้</span>' +
              '<strong class="text-theme-inv text-sm font-black">' + (inst.sourcesCount || 0) + '</strong> <span class="text-[10px] text-muted">แห่ง</span>' +
            '</div>' +
          '</div>' +

          '<!-- Sub-units Chips Container -->' +
          '<div class="mt-2">' +
            '<div class="text-[11px] font-bold text-muted mb-1.5 flex items-center justify-between">' +
              '<span><i class="fas fa-list-check mr-1"></i> รายชื่อสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.):</span>' +
              '<span class="cursor-pointer text-blue-500 hover:underline" onclick="openManageSubUnitsModal(\'' + escapeJS(inst.id) + '\')">+ เพิ่ม/แก้ไข</span>' +
            '</div>' +
            '<div class="flex flex-wrap gap-1.5">' +
              subUnitsPreviewHtml +
            '</div>' +
          '</div>' +

        '</div>';
    });

    container.innerHTML = html;
  }

  /**
   * เปิด Modal จัดการสถานศึกษาในสังกัด (ศกร.ตำบล / ศศช.)
   */
  function openManageSubUnitsModal(instId) {
    const modal = document.getElementById('modal-manage-sub-units');
    if (!modal) return;

    _activeEditingInstId = instId;
    const list = window._cachedInstitutionsList || [];
    const inst = list.find(function(i) { return String(i.id) === String(instId); });

    if (!inst) {
      showCustomAlert('ไม่พบข้อมูลสถานศึกษา', 'error');
      return;
    }

    _activeEditingSubUnits = Array.isArray(inst.subUnits) ? [...inst.subUnits] : (Array.isArray(inst.sub_units) ? [...inst.sub_units] : []);

    const nameEl = document.getElementById('sub-units-modal-inst-name');
    const countEl = document.getElementById('sub-units-modal-count');
    if (nameEl) nameEl.innerText = inst.name || inst.id;
    if (countEl) countEl.innerText = _activeEditingSubUnits.length;

    renderSubUnitsEditorList();

    // รีเซ็ตแท็บเป็นโหมดรายการ
    switchSubUnitsEditorTab('list');

    modal.style.display = 'flex';
  }

  function closeManageSubUnitsModal() {
    const modal = document.getElementById('modal-manage-sub-units');
    if (modal) modal.style.display = 'none';
    _activeEditingInstId = null;
    _activeEditingSubUnits = [];
  }

  /**
   * สลับแท็บใน Modal: รายการทีละแห่ง vs วางข้อความหลายบรรทัด
   */
  function switchSubUnitsEditorTab(tab) {
    const listView = document.getElementById('sub-units-tab-list-view');
    const bulkView = document.getElementById('sub-units-tab-bulk-view');
    const tabBtnList = document.getElementById('sub-units-tab-btn-list');
    const tabBtnBulk = document.getElementById('sub-units-tab-btn-bulk');

    if (tab === 'bulk') {
      if (listView) listView.style.display = 'none';
      if (bulkView) bulkView.style.display = 'block';
      if (tabBtnList) { tabBtnList.classList.remove('active'); tabBtnList.style.background = 'var(--glass)'; }
      if (tabBtnBulk) { tabBtnBulk.classList.add('active'); tabBtnBulk.style.background = 'var(--primary)'; }

      const bulkInput = document.getElementById('sub-units-bulk-textarea');
      if (bulkInput) bulkInput.value = _activeEditingSubUnits.join('\n');
    } else {
      if (listView) listView.style.display = 'block';
      if (bulkView) bulkView.style.display = 'none';
      if (tabBtnList) { tabBtnList.classList.add('active'); tabBtnList.style.background = 'var(--primary)'; }
      if (tabBtnBulk) { tabBtnBulk.classList.remove('active'); tabBtnBulk.style.background = 'var(--glass)'; }
    }
  }

  /**
   * เรนเดอร์รายการแก้ไข ศกร.ตำบล / ศศช. ทีละแถว
   */
  function renderSubUnitsEditorList() {
    const container = document.getElementById('sub-units-items-container');
    const countEl = document.getElementById('sub-units-modal-count');
    if (countEl) countEl.innerText = _activeEditingSubUnits.length;

    if (!container) return;

    if (_activeEditingSubUnits.length === 0) {
      container.innerHTML = 
        '<div class="text-center py-6 text-muted text-xs">' +
          '<i class="fas fa-school fa-2x mb-2 text-muted"></i>' +
          '<p>ยังไม่มีรายการสถานศึกษาในสังกัด</p>' +
          '<p class="text-[11px]">พิมพ์ชื่อด้านล่างเพื่อเพิ่มแห่งแรก หรือใช้แถบ "วางข้อความหลายบรรทัด"</p>' +
        '</div>';
      return;
    }

    let html = '';
    _activeEditingSubUnits.forEach(function(sub, idx) {
      html += 
        '<div class="flex items-center gap-2 p-2 rounded-xl mb-1.5" style="background:var(--bg2); border:1px solid var(--card-border);">' +
          '<span class="text-xs font-mono font-bold text-muted w-6 text-center">' + (idx + 1) + '.</span>' +
          '<input type="text" class="sub-unit-edit-input flex-1 text-xs" style="padding:6px 10px; border-radius:8px; border:1px solid var(--input-border); background:var(--input-bg); color:var(--text); font-weight:600; outline:none;" value="' + escapeHtml(sub) + '" onchange="updateSubUnitValue(' + idx + ', this.value)">' +
          '<div class="flex items-center gap-1">' +
            (idx > 0 ? '<button type="button" class="btn-primary" style="padding:4px 8px; font-size:10px; background:var(--glass); color:var(--text); border:1px solid var(--card-border);" onclick="moveSubUnitRow(' + idx + ', -1)" title="เลื่อนขึ้น"><i class="fas fa-arrow-up"></i></button>' : '') +
            (idx < _activeEditingSubUnits.length - 1 ? '<button type="button" class="btn-primary" style="padding:4px 8px; font-size:10px; background:var(--glass); color:var(--text); border:1px solid var(--card-border);" onclick="moveSubUnitRow(' + idx + ', 1)" title="เลื่อนลง"><i class="fas fa-arrow-down"></i></button>' : '') +
            '<button type="button" class="btn-primary text-rose-500" style="padding:4px 8px; font-size:10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2);" onclick="removeSubUnitRow(' + idx + ')" title="ลบ"><i class="fas fa-trash-alt"></i></button>' +
          '</div>' +
        '</div>';
    });

    container.innerHTML = html;
  }

  function updateSubUnitValue(idx, val) {
    if (idx >= 0 && idx < _activeEditingSubUnits.length) {
      _activeEditingSubUnits[idx] = val.trim();
    }
  }

  function moveSubUnitRow(idx, direction) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= _activeEditingSubUnits.length) return;
    const temp = _activeEditingSubUnits[idx];
    _activeEditingSubUnits[idx] = _activeEditingSubUnits[targetIdx];
    _activeEditingSubUnits[targetIdx] = temp;
    renderSubUnitsEditorList();
  }

  function removeSubUnitRow(idx) {
    if (idx >= 0 && idx < _activeEditingSubUnits.length) {
      _activeEditingSubUnits.splice(idx, 1);
      renderSubUnitsEditorList();
    }
  }

  function addNewSubUnitRow() {
    const input = document.getElementById('sub-units-new-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      showCustomAlert('กรุณากรอกชื่อสถานศึกษาในสังกัด', 'warning');
      return;
    }
    if (_activeEditingSubUnits.includes(val)) {
      showCustomAlert('มีชื่อสถานศึกษานี้ในรายการแล้ว', 'warning');
      return;
    }
    _activeEditingSubUnits.push(val);
    input.value = '';
    renderSubUnitsEditorList();
    input.focus();
  }

  function applyBulkSubUnits() {
    const bulkInput = document.getElementById('sub-units-bulk-textarea');
    if (!bulkInput) return;
    const lines = bulkInput.value.split(/[\r\n,]+/u).map(s => s.trim()).filter(s => s.length > 0);
    _activeEditingSubUnits = Array.from(new Set(lines));
    switchSubUnitsEditorTab('list');
    renderSubUnitsEditorList();
    showCustomAlert('ปรับปรุงรายการสังกัด ' + _activeEditingSubUnits.length + ' แห่งแล้ว อย่าลืมกดบันทึก', 'info');
  }

  /**
   * บันทึกรายการสถานศึกษาในสังกัดขึ้นเซิร์ฟเวอร์
   */
  function saveSubUnitsAction() {
    if (!_activeEditingInstId) return;

    // รวบรวมค่าปัจจุบันจาก input ถ้าอยู่ในโหมด list
    const inputs = document.querySelectorAll('.sub-unit-edit-input');
    if (inputs && inputs.length > 0) {
      const updated = [];
      inputs.forEach(function(inp) {
        const v = inp.value.trim();
        if (v && !updated.includes(v)) updated.push(v);
      });
      _activeEditingSubUnits = updated;
    }

    if (typeof showLoading === 'function') showLoading(true);

    apiPost('updateSubUnits', withAuthData({
      id: _activeEditingInstId,
      subUnits: _activeEditingSubUnits
    }))
    .then(function(res) {
      if (typeof showLoading === 'function') showLoading(false);
      if (res && res.status === 'success') {
        showCustomAlert(res.message || 'บันทึกสถานศึกษาในสังกัดเรียบร้อยแล้ว!', 'success');
        closeManageSubUnitsModal();
        loadAdminInstitutions(true);
      } else {
        showCustomAlert((res && res.message) || 'บันทึกไม่สำเร็จ', 'error');
      }
    })
    .catch(function(err) {
      if (typeof showLoading === 'function') showLoading(false);
      showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    });
  }

  /**
   * ลบสถานศึกษา (Super Admin)
   */
  function deleteInstitutionAction(instId, instName) {
    if (!confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบสถานศึกษา "' + (instName || instId) + '"?\nการกระทำนี้ไม่สามารถย้อนคืนได้')) {
      return;
    }

    if (typeof showLoading === 'function') showLoading(true);

    apiPost('deleteInstitution', withAuthData({ id: instId }))
      .then(function(res) {
        if (typeof showLoading === 'function') showLoading(false);
        if (res && res.status === 'success') {
          showCustomAlert(res.message || 'ลบสถานศึกษาเรียบร้อยแล้ว', 'success');
          loadAdminInstitutions(true);
        } else {
          showCustomAlert((res && res.message) || 'ไม่สามารถลบสถานศึกษาได้', 'error');
        }
      })
      .catch(function() {
        if (typeof showLoading === 'function') showLoading(false);
        showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
      });
  }

  // ส่งออกฟังก์ชันสู่ Window
  window.loadAdminInstitutions = loadAdminInstitutions;
  window.renderAdminInstitutionsList = renderAdminInstitutionsList;
  window.openManageSubUnitsModal = openManageSubUnitsModal;
  window.closeManageSubUnitsModal = closeManageSubUnitsModal;
  window.switchSubUnitsEditorTab = switchSubUnitsEditorTab;
  window.updateSubUnitValue = updateSubUnitValue;
  window.moveSubUnitRow = moveSubUnitRow;
  window.removeSubUnitRow = removeSubUnitRow;
  window.addNewSubUnitRow = addNewSubUnitRow;
  window.applyBulkSubUnits = applyBulkSubUnits;
  window.saveSubUnitsAction = saveSubUnitsAction;
  window.deleteInstitutionAction = deleteInstitutionAction;

})();

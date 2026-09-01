// LOFT LEARN - Admin Quizzes Component
let adminQuizzesCache = [];
let adminQuizDrafts = [];
let adminDraggedQuizId = null;

  function adminQuizBaseRequiredMessage() {
    return "\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e10\u0e32\u0e19\u0e01\u0e32\u0e23\u0e40\u0e23\u0e35\u0e22\u0e19\u0e23\u0e39\u0e49\u0e01\u0e48\u0e2d\u0e19\u0e08\u0e36\u0e07\u0e08\u0e30\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e02\u0e49\u0e2d\u0e2a\u0e2d\u0e1a\u0e44\u0e14\u0e49";
  }

  function getAdminQuizSelection() {
    const sourceEl = document.getElementById('admin-quiz-source-id');
    const baseEl = document.getElementById('admin-quiz-base-id');
    return {
      sourceId: ((sourceEl && sourceEl.value) || '').trim(),
      baseId: ((baseEl && baseEl.value) || '').trim()
    };
  }

  function getAdminQuizType() {
    const typeEl = document.getElementById('admin-quiz-type');
    const raw = String((typeEl && typeEl.value) || 'posttest').trim().toLowerCase();
    return raw === 'pretest' ? 'pretest' : 'posttest';
  }

  function setAdminQuizControlsEnabled(enabled) {
    [
      'btn-admin-quiz-add',
      'btn-admin-quiz-save',
      'btn-admin-quiz-clear',
      'btn-admin-quiz-export',
      'btn-admin-quiz-import',
      'btn-admin-quiz-order'
    ].forEach(function(id) {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '' : '.45';
      btn.style.cursor = enabled ? '' : 'not-allowed';
    });
  }

  function showAdminQuizBaseRequiredState() {
    adminQuizDrafts = [];
    adminQuizzesCache = [];
    const msg = adminQuizBaseRequiredMessage();
    const form = document.getElementById('admin-quiz-form-list');
    const list = document.getElementById('admin-quiz-list-container');
    const html = '<div class="admin-quiz-locked text-center text-muted py-4">' +
      '<i class="fas fa-layer-group mb-2" style="color:var(--primary);font-size:1.4rem;"></i>' +
      '<div>' + msg + '</div>' +
      '</div>';
    if (form) form.innerHTML = html;
    if (list) list.innerHTML = '<div class="text-center text-muted py-3">' + msg + '</div>';
    setAdminQuizControlsEnabled(false);
  }

  function hasAdminQuizBaseSelection() {
    const selection = getAdminQuizSelection();
    return !!(selection.sourceId && selection.baseId);
  }

  function clearAdminQuizForm() {
    if (!hasAdminQuizBaseSelection()) {
      showAdminQuizBaseRequiredState();
      return;
    }
    adminQuizDrafts = [createAdminQuizDraft()];
    renderAdminQuizForm();
    document.getElementById('admin-quiz-mode').value = 'create';
    document.getElementById('admin-quiz-id').value = '';
  }

  function populateAdminQuizSourceOptions() {
    const sourceSelect = document.getElementById('admin-quiz-source-id');
    if (!sourceSelect) return;
    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const instSelect = document.getElementById('admin-quiz-institution-filter');
    const selectedInst = isSuper ? (instSelect ? instSelect.value : 'ALL') : userInst;

    const quizInstGroup = document.getElementById('admin-quiz-institution-filter')?.closest('.input-group');
    if (quizInstGroup) {
      quizInstGroup.style.display = isSuper ? 'block' : 'none';
    }

    const currentValue = sourceSelect.value || '';
    let filteredSources = adminSourcesCache || [];
    if (selectedInst && selectedInst !== 'ALL' && selectedInst !== 'ทั้งหมด') {
      filteredSources = filteredSources.filter(function(s) {
        return (s.institutionId || s.institution_id || 'INS_PHRAO') === selectedInst;
      });
    }

    let options = '<option value="">— เลือกแหล่งเรียนรู้สำหรับจัดการข้อสอบ (' + (filteredSources.length) + ' แหล่ง) —</option>';
    filteredSources.forEach(function(item) {
      options += '<option value="' + item.SourceID + '">' + item.SourceName + ' (' + formatTambon(item.TambonName) + ')</option>';
    });
    sourceSelect.innerHTML = options;
    if (currentValue && filteredSources.some(function(s) { return String(s.SourceID) === String(currentValue); })) {
      sourceSelect.value = currentValue;
    }
  }

  function onAdminQuizInstitutionChange() {
    populateAdminQuizSourceOptions();
    if (typeof loadAdminQuizzes === 'function') {
      loadAdminQuizzes();
    }
  }

  function focusAdminQuizManager(sourceId) {
    const sourceSelect = document.getElementById('admin-quiz-source-id');
    if (!sourceSelect) return;
    sourceSelect.value = sourceId;
    if (typeof switchAdminTab === 'function') switchAdminTab('quizzes');
    else {
      clearAdminQuizForm();
      loadAdminQuizzes();
    }
    const editor = document.querySelector('#admin-tab-quizzes .admin-editor-panel');
    if (window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) {
      if (editor) editor.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const quizForm = document.getElementById('admin-quiz-form-list');
      if (quizForm) quizForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function loadAdminQuizzes() {
    const selection = getAdminQuizSelection();
    const sourceId = selection.sourceId;
    const container = document.getElementById('admin-quiz-list-container');
    if (!container) return;
    setAdminQuizControlsEnabled(false);
    adminQuizzesCache = [];

    if (!sourceId) {
      const baseSelect = document.getElementById('admin-quiz-base-id');
      if (baseSelect) {
        baseSelect.innerHTML = '<option value="">\u2014 \u0e40\u0e25\u0e37\u0e2d\u0e01\u0e10\u0e32\u0e19\u0e01\u0e32\u0e23\u0e40\u0e23\u0e35\u0e22\u0e19\u0e23\u0e39\u0e49 \u2014</option>';
        baseSelect.value = '';
      }
      adminQuizDrafts = [];
      const form = document.getElementById('admin-quiz-form-list');
      if (form) form.innerHTML = '<div class="text-center text-muted py-4">\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19\u0e23\u0e39\u0e49\u0e01\u0e48\u0e2d\u0e19</div>';
      container.innerHTML = '<div class="text-center text-muted py-3">เลือกแหล่งเรียนรู้เพื่อจัดการข้อสอบ</div>';
      return;
    }

    container.innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-circle-notch fa-spin"></i> กำลังโหลดข้อสอบ...</div>';
    const ensureBases = getAdminBasesCache(sourceId).length > 0
      ? Promise.resolve(getAdminBasesCache(sourceId))
      : fetchAdminBasesBySource(sourceId);

    ensureBases.then(function() {
      populateAdminQuizBaseOptions(sourceId);
      const finalBaseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
      if (!finalBaseId) {
        showAdminQuizBaseRequiredState();
        return null;
      }
      return apiGet('getAdminQuizBySource', withAuthParams({ sourceId: sourceId, baseId: finalBaseId, quizType: getAdminQuizType() }));
    }).then(function(res) {
      if (res === null) return;
      if (!res || res.status !== "success") {
        container.innerHTML = '<div class="text-center text-muted py-3">โหลดข้อสอบไม่สำเร็จ</div>';
        return;
      }
      adminQuizzesCache = res.data || [];
      adminQuizDrafts = (adminQuizzesCache.length ? adminQuizzesCache : [createAdminQuizDraft()]).map(createAdminQuizDraft);
      setAdminQuizControlsEnabled(true);
      renderAdminQuizForm();
      renderAdminQuizList();
    }).catch(function() {
      container.innerHTML = '<div class="text-center text-muted py-3">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>';
    });
  }

  function renderAdminQuizList() {
    const container = document.getElementById('admin-quiz-list-container');
    if (!container) return;
    if (!adminQuizzesCache || adminQuizzesCache.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3">ยังไม่มีข้อสอบในแหล่งเรียนรู้นี้</div>';
      return;
    }

    let html = '';
    adminQuizzesCache.forEach(function(q, idx) {
      html += '<div class="admin-quiz-item" draggable="true" ondragstart="onAdminQuizDragStart(event,\'' + escapeJS(q.quizId) + '\')" ondragover="onAdminQuizDragOver(event)" ondrop="onAdminQuizDrop(event,\'' + escapeJS(q.quizId) + '\')" ondragend="onAdminQuizDragEnd()">' +
                '<div class="admin-quiz-top">' +
                  '<div class="admin-quiz-title"><i class="fas fa-grip-vertical mr-1 admin-drag-handle"></i>ข้อ ' + (idx + 1) + ': ' + (q.question || '-') + '</div>' +
                  '<div class="admin-item-actions">' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;" onclick="editAdminQuiz(\'' + escapeJS(q.quizId) + '\')"><i class="fas fa-pen"></i></button>' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="deleteAdminQuiz(\'' + escapeJS(q.quizId) + '\')"><i class="fas fa-trash"></i></button>' +
                  '</div>' +
                '</div>' +
                '<div class="admin-quiz-choices">' +
                  '<span>A) ' + (q.choiceA || '-') + '</span>' +
                  '<span>B) ' + (q.choiceB || '-') + '</span>' +
                  '<span>C) ' + (q.choiceC || '-') + '</span>' +
                  '<span>D) ' + (q.choiceD || '-') + '</span>' +
                '</div>' +
                '<div class="admin-quiz-answer">เฉลย: <strong>' + (q.answer || '-') + '</strong></div>' +
              '</div>';
    });
    container.innerHTML = html;
  }

  function createAdminQuizDraft(data) {
    const q = data || {};
    // รองรับทั้ง choiceA/B/C/D และ choices[] array จาก API
    const choices = Array.isArray(q.choices) ? q.choices : [];
    return {
      quizId: String(q.quizId || q.id || ''),
      question: q.question || '',
      choiceA: q.choiceA || choices[0] || '',
      choiceB: q.choiceB || choices[1] || '',
      choiceC: q.choiceC || choices[2] || '',
      choiceD: q.choiceD || choices[3] || '',
      answer: String(q.answer || 'A').trim().toUpperCase()
    };
  }

  function syncAdminQuizDraftsFromForm() {
    const cards = document.querySelectorAll('#admin-quiz-form-list .admin-quiz-form-card');
    const drafts = [];
    cards.forEach(function(card) {
      drafts.push({
        quizId: card.getAttribute('data-quiz-id') || '',
        question: (card.querySelector('[data-field="question"]') || {}).value || '',
        choiceA: (card.querySelector('[data-field="choiceA"]') || {}).value || '',
        choiceB: (card.querySelector('[data-field="choiceB"]') || {}).value || '',
        choiceC: (card.querySelector('[data-field="choiceC"]') || {}).value || '',
        choiceD: (card.querySelector('[data-field="choiceD"]') || {}).value || '',
        answer: ((card.querySelector('input[type="radio"]:checked') || {}).value || 'A').toUpperCase()
      });
    });
    adminQuizDrafts = drafts.length ? drafts : [createAdminQuizDraft()];
    return adminQuizDrafts;
  }

  function renderAdminQuizForm() {
    const container = document.getElementById('admin-quiz-form-list');
    if (!container) return;
    if (!adminQuizDrafts || adminQuizDrafts.length === 0) adminQuizDrafts = [createAdminQuizDraft()];

    let html = '';
    adminQuizDrafts.forEach(function(q, idx) {
      const group = 'admin-quiz-answer-' + idx;
      const choices = [
        ['A', 'choiceA'],
        ['B', 'choiceB'],
        ['C', 'choiceC'],
        ['D', 'choiceD']
      ];
      html += '<div class="admin-quiz-form-card" data-index="' + idx + '" data-quiz-id="' + escapeJS(q.quizId || '') + '">' +
                '<div class="admin-quiz-form-head">' +
                  '<div class="admin-quiz-form-title">ข้อ ' + (idx + 1) + '</div>' +
                  '<div class="admin-item-actions">' +
                    '<button class="icon-btn" onclick="moveAdminQuizDraft(' + idx + ', -1)" title="เลื่อนขึ้น"><i class="fas fa-arrow-up"></i></button>' +
                    '<button class="icon-btn" onclick="moveAdminQuizDraft(' + idx + ', 1)" title="เลื่อนลง"><i class="fas fa-arrow-down"></i></button>' +
                    '<button class="icon-btn" onclick="removeAdminQuizDraft(' + idx + ')" title="ลบข้อ"><i class="fas fa-trash"></i></button>' +
                  '</div>' +
                '</div>' +
                '<textarea data-field="question" rows="3" placeholder="คำถาม">' + escapeHtml(q.question || '') + '</textarea>' +
                '<div class="admin-quiz-form-options">';
      choices.forEach(function(choice) {
        const letter = choice[0];
        const field = choice[1];
        html += '<label class="admin-quiz-option-row">' +
                  '<input type="radio" name="' + group + '" value="' + letter + '"' + ((q.answer || 'A') === letter ? ' checked' : '') + '>' +
                  '<span class="admin-quiz-option-letter">' + letter + '</span>' +
                  '<input type="text" data-field="' + field + '" placeholder="ตัวเลือก ' + letter + '" value="' + escapeHtml(q[field] || '') + '">' +
                '</label>';
      });
      html +=   '</div>' +
              '</div>';
    });
    container.innerHTML = html;
  }

  function addAdminQuizDraft() {
    if (!hasAdminQuizBaseSelection()) {
      showAdminQuizBaseRequiredState();
      return showCustomAlert(adminQuizBaseRequiredMessage(), "warning");
    }
    syncAdminQuizDraftsFromForm();
    adminQuizDrafts.push(createAdminQuizDraft());
    renderAdminQuizForm();
  }

  function removeAdminQuizDraft(index) {
    syncAdminQuizDraftsFromForm();
    if (adminQuizDrafts.length <= 1) {
      adminQuizDrafts = [createAdminQuizDraft()];
    } else {
      adminQuizDrafts.splice(index, 1);
    }
    renderAdminQuizForm();
  }

  function moveAdminQuizDraft(index, delta) {
    syncAdminQuizDraftsFromForm();
    const next = index + delta;
    if (next < 0 || next >= adminQuizDrafts.length) return;
    const moved = adminQuizDrafts.splice(index, 1)[0];
    adminQuizDrafts.splice(next, 0, moved);
    renderAdminQuizForm();
  }

  function onAdminQuizDragStart(event, quizId) {
    adminDraggedQuizId = quizId;
    if (event && event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(quizId || ''));
    }
    if (event && event.currentTarget) event.currentTarget.classList.add('dragging');
  }

  function onAdminQuizDragOver(event) {
    if (event) event.preventDefault();
  }

  function onAdminQuizDrop(event, targetQuizId) {
    if (event) event.preventDefault();
    const draggedId = adminDraggedQuizId || (event && event.dataTransfer ? event.dataTransfer.getData('text/plain') : '');
    if (!draggedId || !targetQuizId || String(draggedId) === String(targetQuizId)) return;
    const fromIndex = adminQuizzesCache.findIndex(function(q) { return String(q.quizId) === String(draggedId); });
    const toIndex = adminQuizzesCache.findIndex(function(q) { return String(q.quizId) === String(targetQuizId); });
    if (fromIndex < 0 || toIndex < 0) return;
    const moved = adminQuizzesCache.splice(fromIndex, 1)[0];
    adminQuizzesCache.splice(toIndex, 0, moved);
    renderAdminQuizList();
  }

  function onAdminQuizDragEnd() {
    adminDraggedQuizId = null;
    document.querySelectorAll('.admin-quiz-item.dragging').forEach(function(el) {
      el.classList.remove('dragging');
    });
  }

  function editAdminQuiz(quizId) {
    const item = (adminQuizzesCache || []).find(function(q) { return String(q.quizId) === String(quizId); });
    if (!item) return showCustomAlert("ไม่พบข้อสอบที่เลือก", "error");
    
    openAdminQuizEditorModal();
    
    setTimeout(function() {
      const cards = document.querySelectorAll('#admin-quiz-form-list .admin-quiz-form-card');
      let target = null;
      cards.forEach(function(card) {
        if (String(card.getAttribute('data-quiz-id') || '') === String(quizId)) target = card;
      });
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('attention');
        setTimeout(function() { target.classList.remove('attention'); }, 1200);
      }
    }, 100);
  }

  function saveAdminQuiz() {
    return saveAdminQuizBatch();
  }

  function collectAdminQuizDraftsForSave() {
    const drafts = syncAdminQuizDraftsFromForm();
    const rows = [];
    for (let i = 0; i < drafts.length; i++) {
      const q = drafts[i];
      const isBlank = !q.question && !q.choiceA && !q.choiceB && !q.choiceC && !q.choiceD;
      if (isBlank) continue;
      if (!q.question || !q.choiceA || !q.choiceB || !q.choiceC || !q.choiceD) {
        return { error: "กรุณากรอกข้อ " + (i + 1) + " ให้ครบทั้งคำถามและตัวเลือก" };
      }
      if (['A', 'B', 'C', 'D'].indexOf(q.answer) === -1) q.answer = 'A';
      // แปลง choiceA/B/C/D เป็น choices[] array ที่ backend ต้องการ
      rows.push({
        quizId: q.quizId || '',
        question: q.question,
        choices: [q.choiceA, q.choiceB, q.choiceC, q.choiceD],
        answer: q.answer
      });
    }
    if (rows.length === 0) {
      return { error: "กรุณาเพิ่มข้อคำถามอย่างน้อย 1 ข้อ" };
    }
    return { rows: rows };
  }

  function saveAdminQuizBatch() {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    const baseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
    if (!sourceId) return showCustomAlert("\u0e01\u0e23\u0e38\u0e13\u0e32\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e41\u0e2b\u0e25\u0e48\u0e07\u0e40\u0e23\u0e35\u0e22\u0e19\u0e23\u0e39\u0e49\u0e01\u0e48\u0e2d\u0e19", "warning");
    if (!baseId) return showCustomAlert("กรุณาเลือกฐานการเรียนรู้ก่อน", "warning");
    const result = collectAdminQuizDraftsForSave();
    if (result.error) return showCustomAlert(result.error, "warning");

    showLoading(true);
    apiPost('saveAdminQuizBatch', withAuthData({ sourceId: sourceId, baseId: baseId, quizType: getAdminQuizType(), quizzes: result.rows }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert("\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e02\u0e49\u0e2d\u0e2a\u0e2d\u0e1a\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\u0e41\u0e25\u0e49\u0e27", "success");
          cacheSources = null;
          closeAdminQuizEditorModal();
          loadAdminQuizzes();
        } else {
          showCustomAlert(res.message || "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e02\u0e49\u0e2d\u0e2a\u0e2d\u0e1a\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08", "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14\u0e43\u0e19\u0e01\u0e32\u0e23\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d", "error");
      });
  }

  function deleteAdminQuiz(quizId) {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    if (!quizId || !sourceId) return;
    showCustomConfirm("ต้องการลบข้อสอบนี้ใช่หรือไม่?", function() {
      showLoading(true);
      apiPost('deleteAdminQuiz', withAuthData({ quizId: quizId, sourceId: sourceId, quizType: getAdminQuizType() }))
        .then(function(res) {
          showLoading(false);
          if (res.status === "success") {
            showCustomAlert("ลบข้อสอบเรียบร้อย", "success");
            loadAdminQuizzes();
            cacheSources = null;
          } else {
            showCustomAlert(res.message || "ลบข้อสอบไม่สำเร็จ", "error");
          }
        }).catch(function() {
          showLoading(false);
          showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        });
    });
  }

  function saveAdminQuizOrder() {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    const baseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    if (!baseId) return showCustomAlert("กรุณาเลือกฐานการเรียนรู้ก่อน", "warning");
    if (!adminQuizzesCache || adminQuizzesCache.length === 0) return showCustomAlert("ไม่มีข้อสอบให้จัดลำดับ", "warning");
    const quizIds = adminQuizzesCache.map(function(q) { return q.quizId; }).filter(Boolean);
    showLoading(true);
    apiPost('saveAdminQuizOrder', withAuthData({ sourceId: sourceId, baseId: baseId, quizType: getAdminQuizType(), quizIds: quizIds }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") showCustomAlert("บันทึกลำดับข้อสอบเรียบร้อย", "success");
        else showCustomAlert(res.message || "บันทึกลำดับไม่สำเร็จ", "error");
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function escapeCsvValue(value) {
    const s = String(value == null ? '' : value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(function(v) { return String(v || '').trim(); });
  }

  function exportAdminQuizCsv() {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    const baseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
    if (!baseId) return showCustomAlert(adminQuizBaseRequiredMessage(), "warning");
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    if (!adminQuizzesCache || adminQuizzesCache.length === 0) return showCustomAlert("ไม่มีข้อสอบให้ส่งออก", "warning");
    const header = ['question', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'answer'];
    let csv = header.join(',') + '\n';
    adminQuizzesCache.forEach(function(q) {
      const row = [
        escapeCsvValue(q.question || ''),
        escapeCsvValue(q.choiceA || ''),
        escapeCsvValue(q.choiceB || ''),
        escapeCsvValue(q.choiceC || ''),
        escapeCsvValue(q.choiceD || ''),
        escapeCsvValue((q.answer || '').toUpperCase())
      ];
      csv += row.join(',') + '\n';
    });
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const source = (adminSourcesCache || []).find(function(s) { return String(s.SourceID) === String(sourceId); });
    const safeName = (source && source.SourceName ? source.SourceName : sourceId).replace(/[\\/:*?"<>|]/g, '_');
    const bases = getAdminBasesCache(sourceId) || [];
    const base = baseId ? bases.find(function(b) { return String(b.baseId) === String(baseId); }) : null;
    const safeBase = base ? String(base.baseName || baseId).replace(/[\\/:*?"<>|]/g, '_') : '';
    const filename = 'quiz_' + safeName + (safeBase ? ('_' + safeBase) : '') + '.csv';
    const link = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    link.href = objUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function() { URL.revokeObjectURL(objUrl); }, 1000);
  }

  function triggerAdminQuizCsvImport() {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    const baseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
    if (!baseId) return showCustomAlert(adminQuizBaseRequiredMessage(), "warning");
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    const input = document.getElementById('admin-quiz-csv-file');
    if (!input) return;
    input.value = '';
    input.click();
  }

  function handleAdminQuizCsvImport(input) {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    const baseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    if (!baseId) return showCustomAlert("กรุณาเลือกฐานการเรียนรู้ก่อน", "warning");
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const text = String((evt && evt.target && evt.target.result) || '');
        const lines = text.replace(/\r/g, '').split('\n').filter(function(l) { return String(l).trim() !== ''; });
        if (lines.length < 2) return showCustomAlert("ไฟล์ CSV ไม่มีข้อมูลข้อสอบ", "warning");
        const headers = parseCsvLine(lines[0]).map(function(h) { return h.toLowerCase(); });
        const hMap = {};
        headers.forEach(function(h, i) { hMap[h] = i; });
        const getVal = function(cols, keyList) {
          for (let i = 0; i < keyList.length; i++) {
            const idx = hMap[keyList[i]];
            if (idx !== undefined) return String(cols[idx] || '').trim();
          }
          return '';
        };
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const question = getVal(cols, ['question', 'questiontext']);
          const choiceA = getVal(cols, ['choicea', 'a', 'optiona']);
          const choiceB = getVal(cols, ['choiceb', 'b', 'optionb']);
          const choiceC = getVal(cols, ['choicec', 'c', 'optionc']);
          const choiceD = getVal(cols, ['choiced', 'd', 'optiond']);
          const answer = getVal(cols, ['answer', 'correctanswer']).toUpperCase();
          const quizId = getVal(cols, ['quizid', 'id']);
          if (!question || !choiceA || !choiceB || !choiceC || !choiceD) continue;
          rows.push({
            quizId: quizId,
            question: question,
            choices: [choiceA, choiceB, choiceC, choiceD],
            answer: ['A', 'B', 'C', 'D'].indexOf(answer) > -1 ? answer : 'A'
          });
        }
        if (rows.length === 0) return showCustomAlert("ไม่พบข้อมูลข้อสอบที่ถูกต้องในไฟล์ CSV", "warning");
        showCustomConfirm("พบ " + rows.length + " ข้อ ต้องการแทนที่ข้อสอบเดิมทั้งหมดของแหล่งนี้หรือไม่? (กดตกลง = แทนที่ทั้งหมด, กดยกเลิก = ยกเลิกนำเข้า)", function() {
          showLoading(true);
          apiPost('importAdminQuizCsv', withAuthData({ sourceId: sourceId, baseId: baseId, quizType: getAdminQuizType(), rows: rows, replaceExisting: true }))
            .then(function(res) {
              showLoading(false);
              if (res.status === "success") {
                showCustomAlert("นำเข้าข้อสอบสำเร็จ", "success");
                loadAdminQuizzes();
                cacheSources = null;
              } else {
                showCustomAlert(res.message || "นำเข้าไม่สำเร็จ", "error");
              }
            }).catch(function() {
              showLoading(false);
              showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
            });
        });
      } catch (e) {
        showCustomAlert("อ่านไฟล์ CSV ไม่สำเร็จ", "error");
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  window.addAdminQuizDraft = addAdminQuizDraft;
  window.removeAdminQuizDraft = removeAdminQuizDraft;
  window.moveAdminQuizDraft = moveAdminQuizDraft;
  window.clearAdminQuizForm = clearAdminQuizForm;
  window.saveAdminQuiz = saveAdminQuiz;
  window.saveAdminQuizBatch = saveAdminQuizBatch;
  window.saveAdminQuizOrder = saveAdminQuizOrder;
  window.exportAdminQuizCsv = exportAdminQuizCsv;
  window.triggerAdminQuizCsvImport = triggerAdminQuizCsvImport;
  window.handleAdminQuizCsvImport = handleAdminQuizCsvImport;

  function openAdminQuizEditorModal(item) {
    const selection = getAdminQuizSelection();
    if (!selection.sourceId || !selection.baseId) {
      return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้และฐานก่อนจัดการข้อสอบ", "warning");
    }
    const modalEl = document.getElementById('admin-quiz-editor-modal');
    if (modalEl) modalEl.style.display = 'flex';
  }

  function closeAdminQuizEditorModal() {
    const modalEl = document.getElementById('admin-quiz-editor-modal');
    if (modalEl) modalEl.style.display = 'none';
  }

  window.openAdminQuizEditorModal = openAdminQuizEditorModal;
  window.closeAdminQuizEditorModal = closeAdminQuizEditorModal;
  window.onAdminQuizInstitutionChange = onAdminQuizInstitutionChange;
  window.populateAdminQuizSourceOptions = populateAdminQuizSourceOptions;

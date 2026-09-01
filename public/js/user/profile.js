// LOFT LEARN - User Profile Component
let currentUserProfileUrl = "";
if (typeof window.cacheProfile === 'undefined') window.cacheProfile = null;

function openEditNicknameModal() {
    const curNick = cacheProfile ? (cacheProfile.nickname || '') : '';
    const inputEl = document.getElementById('input-edit-nickname');
    if (inputEl) inputEl.value = curNick;
    const modal = document.getElementById('modal-edit-nickname');
    if (modal) modal.style.display = 'flex';
  }

  function closeEditNicknameModal() {
    const modal = document.getElementById('modal-edit-nickname');
    if (modal) modal.style.display = 'none';
  }

  function saveNicknameAction() {
    const inputEl = document.getElementById('input-edit-nickname');
    const newNick = inputEl ? inputEl.value.trim() : '';

    if (typeof showLoading === 'function') showLoading(true);

    apiPost('updateNickname', withAuthParams({ nickname: newNick }))
      .then(function(res) {
        if (typeof showLoading === 'function') showLoading(false);
        if (res && res.status === 'success') {
          if (typeof showCustomAlert === 'function') {
            showCustomAlert(res.message || 'บันทึกฉายาสำเร็จแล้ว!', 'success');
          }
          if (cacheProfile) {
            cacheProfile.nickname = newNick;
            cacheProfile.displayName = res.displayName || newNick;
          }
          closeEditNicknameModal();
          loadProfileData(true);
          if (typeof cacheLeaderboard !== 'undefined') cacheLeaderboard = null;
          if (typeof loadLeaderboard === 'function') loadLeaderboard();
        } else {
          if (typeof showCustomAlert === 'function') {
            showCustomAlert((res && res.message) || 'ไม่สามารถตั้งฉายาได้', 'error');
          }
        }
      })
      .catch(function() {
        if (typeof showLoading === 'function') showLoading(false);
        if (typeof showCustomAlert === 'function') {
          showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        }
      });
  }

function isLoftAssetUrl(url) {
  const value = String(url || "").trim();
  if (!value || value === 'undefined' || value === 'null') return false;
  return value.startsWith("http") || value.startsWith("/") || value.startsWith("data:image/") || value.startsWith("storage/") || value.startsWith("uploads/");
}

function toggleProfileSection(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  const collapsed = card.classList.toggle("is-collapsed");
  try {
    localStorage.setItem("profile_section_" + cardId, collapsed ? "collapsed" : "open");
  } catch (e) {}

  if (!collapsed) {
    if (cardId === 'profile-nfe-history-card' && typeof loadNFEHistory === 'function') loadNFEHistory();
    if (cardId === 'profile-cert-history-card' && typeof loadUserCertificates === 'function') loadUserCertificates();
    if (cardId === 'credit-banking-card' && typeof loadCreditBank === 'function') loadCreditBank();
    if (cardId === 'profile-badges-card' && typeof loadUserBadges === 'function') loadUserBadges();
    if (cardId === 'id-plan-card' && typeof loadIDPlanData === 'function') loadIDPlanData();
  }
}

function restoreProfileSectionStates() {
  document.querySelectorAll(".profile-collapsible-card").forEach(function(card) {
    const id = card.id || "";
    let saved = "collapsed";
    try { saved = localStorage.getItem("profile_section_" + id) || "collapsed"; } catch (e) {}
    card.classList.toggle("is-collapsed", saved !== "open");
  });
}

window.toggleProfileSection = toggleProfileSection;

  /* ═══════════════════════════════════════════════════════
     LEARNING DASHBOARD  –  สถิติการเรียนรู้
  ═══════════════════════════════════════════════════════ */
  function renderLearningDashboard() {
    const phone = localStorage.getItem("userPhone") || "guest";
    let totalBasesCompleted = 0;
    let totalBasesAll       = 0;
    let quizzesPassed       = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("learning_progress_")) {
        try {
          const arr = JSON.parse(localStorage.getItem(k)) || [];
          totalBasesCompleted += arr.length;
        } catch(e) {}
      }
      if (k && k.startsWith("learning_pretest_done_" + phone + "_")) {
        quizzesPassed++;
      }
    }
    quizzesPassed += totalBasesCompleted;

    const score   = (cacheProfile && cacheProfile.score)    ? Number(cacheProfile.score)   : null;
    const level   = (cacheProfile && cacheProfile.level)    ? cacheProfile.level            : null;
    const nfeHrs  = cacheProfile && (cacheProfile.nfeHours !== undefined || cacheProfile.nfehours !== undefined)
      ? Number(cacheProfile.nfeHours ?? cacheProfile.nfehours)
      : null;

    function animateNum(id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      if (val === null || val === undefined) { el.textContent = "–"; return; }
      let start = 0;
      const end = Number(val);
      const dur = 800;
      const step = Math.ceil(dur / 30);
      const inc  = end / 30;
      let cur = 0;
      const timer = setInterval(function() {
        cur = Math.min(cur + inc, end);
        el.textContent = Math.round(cur);
        if (cur >= end) clearInterval(timer);
      }, step);
    }

    animateNum("ld-bases-done",    totalBasesCompleted);
    animateNum("ld-score",         score);
    animateNum("ld-quizzes-done",  quizzesPassed);
    animateNum("ld-nfe-hours",     nfeHrs);

    var srcKey = "_ld_sources_cache";
    function applyProgressBar(sources) {
      var total = 0;
      (sources || []).forEach(function(src) {
        total += ((src.bases && src.bases.length) || 0);
      });
      totalBasesAll = total;
      var pct = total > 0 ? Math.round((totalBasesCompleted / total) * 100) : 0;
      var pctEl  = document.getElementById("ld-progress-pct");
      var barEl  = document.getElementById("ld-progress-bar");
      var txtEl  = document.getElementById("ld-bases-total-text");
      if (pctEl) pctEl.textContent = pct + "%";
      if (barEl) barEl.style.width = pct + "%";
      if (txtEl) txtEl.textContent = "จากทั้งหมด " + total + " ฐานการเรียนรู้";

      let rankTitle = "นักเรียนรู้";
      let rankColor = "#22c55e";
      if (pct >= 80)      { rankTitle = "ผู้เชี่ยวชาญการเรียนรู้ 🏆"; rankColor = "#f59e0b"; }
      else if (pct >= 50) { rankTitle = "นักเรียนรู้ระดับสูง ⭐";   rankColor = "#3b82f6"; }
      else if (pct >= 20) { rankTitle = "นักเรียนรู้ก้าวหน้า 📈";   rankColor = "#8b5cf6"; }

      const badgeEl = document.getElementById("ld-rank-badge");
      if (badgeEl) {
        badgeEl.textContent = rankTitle;
        badgeEl.style.color = rankColor;
      }
    }

    try {
      var raw = sessionStorage.getItem(srcKey);
      if (raw) {
        applyProgressBar(JSON.parse(raw));
      } else {
        apiGet("getSources", {}).then(function(res) {
          if (res.status === "success" && res.sources) {
            sessionStorage.setItem(srcKey, JSON.stringify(res.sources));
            applyProgressBar(res.sources);
          }
        }).catch(function() {});
      }
    } catch(e) {
      applyProgressBar([]);
    }

    restoreProfileSectionStates();
  }

  /* ═══════════════════════════════════════════════════════
     LOAD PROFILE DATA
  ═══════════════════════════════════════════════════════ */
  function loadProfileData(forceFresh) {
    if (forceFresh) cacheProfile = null;
    const phone = localStorage.getItem("userPhone") || "guest";
    const localName = localStorage.getItem("userName") || "";
    const localTambon = localStorage.getItem("userTambon") || "";
    const localRole = String(localStorage.getItem("userRole") || "user").toLowerCase();

    function renderUI(me) {
      const fullName = me.fullName || me.full_name || localName || me.phone || "ผู้ใช้งานทั่วไป";
      const nickname = me.nickname || "";
      const isUnlocked = Boolean(me.nicknameUnlocked || me.nickname_unlocked || localRole === 'admin' || localRole === 'teacher');
      const displayName = me.displayName || (isUnlocked && nickname ? nickname : fullName);

      const pNameEl = document.getElementById('profile-name');
      if (pNameEl) pNameEl.innerText = displayName;

      const pRealNameEl = document.getElementById('profile-fullname-real');
      if (pRealNameEl) pRealNameEl.innerText = fullName;

      const btnEditNick = document.getElementById('btn-edit-nickname');
      const btnUnlockNick = document.getElementById('btn-unlock-nickname');
      const nickValEl = document.getElementById('profile-nickname-val');

      if (isUnlocked) {
        if (btnEditNick) btnEditNick.style.display = 'inline-block';
        if (btnUnlockNick) btnUnlockNick.style.display = 'none';
        if (nickValEl) nickValEl.innerText = nickname ? nickname : 'ยังไม่ได้ตั้ง (ใช้ชื่อจริง)';
      } else {
        if (btnEditNick) btnEditNick.style.display = 'none';
        if (btnUnlockNick) btnUnlockNick.style.display = 'inline-block';
        if (nickValEl) nickValEl.innerText = 'ยังไม่ปลดล็อก (ใช้บัตร 300 แต้ม)';
      }

      document.getElementById('profile-phone').innerText = me.phone || phone;
      document.getElementById('profile-tambon').innerText = formatTambon(me.tambon || localTambon) || "ไม่ระบุ";
      document.getElementById('profile-level').innerText = me.level || "1";
      document.getElementById('profile-score').innerText = me.score || "0";
      localStorage.setItem("userScore", me.score || "0");

      if (me.cosmetics && typeof applyCosmeticsToElement === 'function') {
        const pAvatar = document.querySelector('#profile-page .avatar-ring-wrapper') || document.getElementById('profile-preview');
        applyCosmeticsToElement(pAvatar, pNameEl, me.cosmetics);
      }
      
      const rawImgUrl = me.profileImage || me.profileimage || "";
      const imgUrl = typeof getValidImageUrl === 'function' ? getValidImageUrl(rawImgUrl) : rawImgUrl;
      const imgStatus = String(me.imageStatus || me.imagestatus || "Approved");
      const profileImg = document.getElementById('profile-preview');
      const adjustBtn = document.getElementById('btn-adjust-profile');
      const menuAdjust = document.getElementById('menu-adjust-profile');

      if (isLoftAssetUrl(imgUrl)) {
        if (imgStatus === 'Approved') {
          const freshImgUrl = imgUrl.includes('?') ? imgUrl : (imgUrl + '?t=' + Date.now());
          profileImg.style.backgroundImage = "url('" + freshImgUrl + "')";
          profileImg.setAttribute('data-url', imgUrl);
          if (adjustBtn) adjustBtn.style.display = 'inline-block';
          if (menuAdjust) menuAdjust.style.display = 'flex';
          
          const headerUser = document.getElementById('header-user-name');
          if (headerUser) headerUser.innerHTML = '<img src="' + freshImgUrl + '" style="width:25px; height:25px; border-radius:50%; vertical-align:middle; margin-right:5px; object-fit:cover;"> ' + displayName;
        } else {
          const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
          profileImg.style.backgroundImage = "url('" + placeholderImg + "')";
          profileImg.removeAttribute('data-url');
          if (adjustBtn) adjustBtn.style.display = 'none';
          if (menuAdjust) menuAdjust.style.display = 'none';
          
          const statusText = imgStatus === 'Pending' ? '(รออนุมัติรูป)' : '(รูปไม่เหมาะสม)';
          const headerUser = document.getElementById('header-user-name');
          if (headerUser) headerUser.innerHTML = '<i class="fas fa-user-circle mr-1" style="color:var(--primary-soft)"></i> ' + displayName + ' <span style="font-size:10px; color:var(--gold)">' + statusText + '</span>';
          
          if (imgStatus === 'Pending') {
            showCustomAlert("รูปโปรไฟล์ของคุณกำลังรอการตรวจสอบจากเจ้าหน้าที่", "info");
          } else if (imgStatus === 'Rejected') {
            showCustomAlert("รูปโปรไฟล์ของคุณไม่ผ่านการอนุมัติ กรุณาเปลี่ยนรูปที่เหมาะสม", "error");
          }
        }
      } else {
        const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
        profileImg.style.backgroundImage = "url('" + placeholderImg + "')";
        profileImg.removeAttribute('data-url');
        if (adjustBtn) adjustBtn.style.display = 'none';
        if (menuAdjust) menuAdjust.style.display = 'none';
      }
    }

    function triggerProfileSubLoads(fresh) {
      // 1. โหลด ID Plan card หลักทันที
      if (typeof loadIDPlanData === 'function') loadIDPlanData(fresh, phone);

      // 2. โหลดเฉพาะการ์ดที่ผู้เรียนขยายเปิดค้างไว้ในเบราว์เซอร์เท่านั้น (Smart Lazy Loading)
      setTimeout(function() {
        ['profile-nfe-history-card', 'profile-cert-history-card', 'credit-banking-card', 'profile-badges-card'].forEach(function(cardId) {
          const el = document.getElementById(cardId);
          if (el && !el.classList.contains('is-collapsed')) {
            if (cardId === 'profile-nfe-history-card' && typeof loadNFEHistory === 'function') loadNFEHistory(fresh);
            if (cardId === 'profile-cert-history-card' && typeof loadUserCertificates === 'function') loadUserCertificates(fresh);
            if (cardId === 'credit-banking-card' && typeof loadCreditBank === 'function') loadCreditBank(fresh);
            if (cardId === 'profile-badges-card' && typeof loadUserBadges === 'function') loadUserBadges(fresh);
          }
        });
      }, 100);
    }

    if (cacheProfile && !forceFresh) {
      renderUI(cacheProfile);
      renderLearningDashboard();
      triggerProfileSubLoads(false);
      return;
    }

    apiGet('getUserProfile', withAuthParams({ targetPhone: phone }))
      .then(function(res) {
        if(res && res.status === "success" && res.profile) {
          cacheProfile = res.profile;
          window.cacheProfile = res.profile;
          renderUI(res.profile);
          renderLearningDashboard();
        }
        triggerProfileSubLoads(forceFresh);
      })
      .catch(function() {
        if (!cacheProfile) {
          renderUI({ phone: phone, fullName: localName, tambon: localTambon });
          renderLearningDashboard();
        }
        triggerProfileSubLoads(forceFresh);
      });
  }

  function loadCreditBank(forceFresh) {
    if (forceFresh) {
      window.cacheSourcesList = null;
      window.cacheCertificatesHistory = null;
    }
    const container = document.getElementById('credit-bank-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4 text-muted text-xs"><i class="fas fa-circle-notch fa-spin mr-2" style="color:var(--primary)"></i>กำลังคำนวณหน่วยกิต...</div>';

    const myPhone = localStorage.getItem("userPhone") || "";

    const sourcesPromise = (window.cacheSourcesList && Array.isArray(window.cacheSourcesList))
      ? Promise.resolve({ status: 'success', sources: window.cacheSourcesList })
      : apiGet('getSources', {}).then(function(res) {
          if (res.status === 'success' && res.sources) window.cacheSourcesList = res.sources;
          return res;
        });

    const certsPromise = (window.cacheCertificatesHistory && Array.isArray(window.cacheCertificatesHistory))
      ? Promise.resolve({ status: 'success', history: window.cacheCertificatesHistory })
      : apiGet('getUserCertificates', withAuthParams({ phone: myPhone })).then(function(res) {
          if (res.status === 'success' && res.history) window.cacheCertificatesHistory = res.history;
          return res;
        });

    Promise.all([sourcesPromise, certsPromise]).then(function(results) {
      const sourcesRes = results[0] || {};
      const certsRes = results[1] || {};

      const sources = Array.isArray(sourcesRes.sources) ? sourcesRes.sources : (Array.isArray(sourcesRes.data) ? sourcesRes.data : []);
      const history = Array.isArray(certsRes.history) ? certsRes.history : (Array.isArray(certsRes.data) ? certsRes.data : []);

      const passedSourceIds = new Set();
      history.forEach(function(item) {
        if (item.sourceId) passedSourceIds.add(String(item.sourceId));
      });

      const categories = {};

      sources.forEach(function(src) {
        const catName = src.subjectCategory || src.subject_category || 'หมวดภูมิปัญญาท้องถิ่นและการงานอาชีพ';
        if (!categories[catName]) {
          categories[catName] = {
            name: catName,
            totalSources: 0,
            passedSources: 0,
            totalHours: 0,
            earnedHours: 0
          };
        }
        const hrs = Number(src.creditHours || src.credit_hours || 2.0);
        const isPassed = passedSourceIds.has(String(src.SourceID || src.id));

        categories[catName].totalSources += 1;
        categories[catName].totalHours += hrs;
        if (isPassed) {
          categories[catName].passedSources += 1;
          categories[catName].earnedHours += hrs;
        }
      });

      const catList = Object.values(categories);

      if (catList.length === 0) {
        container.innerHTML = `
          <div class="loft-card text-center py-6" style="background:var(--glass); border:1px dashed var(--card-border); margin-top:0;">
            <i class="fas fa-university text-3xl mb-2" style="color:var(--primary); opacity:0.6;"></i>
            <p class="font-bold text-sm text-theme-inv">ยังไม่มีรายการสะสมหน่วยกิต</p>
            <p class="text-xs text-muted mt-1">เข้าเรียนรู้ในฐานการเรียนรู้และทำแบบทดสอบเพื่อสะสมหน่วยกิต</p>
          </div>
        `;
        return;
      }

      let html = '';
      catList.forEach(function(cat) {
        const pct = cat.totalHours > 0 ? Math.min(Math.round((cat.earnedHours / cat.totalHours) * 100), 100) : 0;
        
        html += `
          <div class="loft-card p-4 rounded-2xl" style="background:var(--glass); border:1px solid var(--card-border); margin-top:0;">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs" style="background:rgba(59,130,246,0.12); color:#3b82f6; border:1px solid rgba(59,130,246,0.2);">
                  <i class="fas fa-book-reader"></i>
                </div>
                <div>
                  <h5 class="font-bold text-theme-inv text-xs" style="margin:0;">${typeof escapeHtml === 'function' ? escapeHtml(cat.name) : cat.name}</h5>
                  <span class="text-[10px] text-muted">ผ่านแล้ว ${cat.passedSources} / ${cat.totalSources} แหล่งเรียนรู้</span>
                </div>
              </div>
              <div class="text-right">
                <span class="font-black text-sm" style="color:var(--gold);">${cat.earnedHours.toFixed(1)} / ${cat.totalHours.toFixed(1)}</span>
                <span class="text-[10px] text-muted block">หน่วยกิต (ชม.)</span>
              </div>
            </div>
            
            <div class="w-full h-2 rounded-full overflow-hidden mt-2" style="background:var(--bg2);">
              <div class="h-full rounded-full transition-all duration-500" style="width:${pct}%; background:linear-gradient(90deg, var(--primary), var(--gold));"></div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }).catch(function(err) {
      console.error("Failed to load Credit Bank data", err);
      container.innerHTML = '<div class="text-center py-4 text-muted text-xs">เกิดข้อผิดพลาดในการคำนวณหน่วยกิตสะสม</div>';
    });
  }

  window.loadCreditBank = loadCreditBank;
  window.calculateAndRenderCreditBank = loadCreditBank;

  function openAvatarMenu() { document.getElementById('avatar-menu-modal').style.display = 'flex'; }
  function closeAvatarMenu() { document.getElementById('avatar-menu-modal').style.display = 'none'; }
  function triggerUpload() { document.getElementById('imageUpload').click(); closeAvatarMenu(); }

  function viewFullImage() {
    const picUrl = document.getElementById('profile-preview').getAttribute('data-url');
    if (isLoftAssetUrl(picUrl)) { document.getElementById('full-image-display').src = picUrl; document.getElementById('image-viewer').style.display = 'flex'; }
    else { showCustomAlert("ยังไม่มีรูปโปรไฟล์ครับ", "warning"); }
    closeAvatarMenu();
  }

  function closeCropModal() {
    document.getElementById('crop-modal').style.display = 'none';
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    const inputs = ['imageUpload', 'admin-source-cover-file', 'admin-base-cover-file', 'admin-base-cert-file', 'admin-featured-image-file', 'admin-product-image-file'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function applyCrop() {
    if (!cropper) return;
    const saveBtn = document.getElementById('btn-crop-save');
    if (saveBtn) saveBtn.disabled = true;
    showLoading(true);

    setTimeout(function() {
      try {
        const isSig = currentCropContext === 'certSignature' || currentCropContext === 'globalCertSignature';
        const outputWidth = currentCropContext === 'profile' ? 800 : ((currentCropContext === 'certificateTemplate' || currentCropContext === 'activityCertificateTemplate') ? 1600 : (isSig ? 500 : 960));
        const outputHeight = currentCropContext === 'profile' ? 800 : ((currentCropContext === 'certificateTemplate' || currentCropContext === 'activityCertificateTemplate') ? 1131 : (isSig ? 250 : 540));

        const canvas = cropper.getCroppedCanvas({
          width: outputWidth,
          height: outputHeight,
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high'
        });

        const format = isSig ? 'image/png' : 'image/jpeg';
        const quality = currentCropContext === 'profile' ? 0.92 : ((currentCropContext === 'certificateTemplate' || currentCropContext === 'activityCertificateTemplate') ? 0.85 : 0.85);
        const base64 = canvas.toDataURL(format, quality);
        const approxBytes = Math.ceil((base64.length - base64.indexOf(',') - 1) * 3 / 4);
        const maxBytes = (currentCropContext === 'profile') ? (2500 * 1024) : (3500 * 1024);
        if (approxBytes > maxBytes) {
          showLoading(false);
          if (saveBtn) saveBtn.disabled = false;
          showCustomAlert("รูปยังมีขนาดใหญ่เกินไป กรุณาครอบรูปให้เล็กลงหรือเลือกรูปใหม่", "error");
          return;
        }
        const phone = localStorage.getItem("userPhone");
        const action = (currentCropContext === 'profile') ? 'uploadImage' : 'uploadGeneralImage';

        apiPost(action, { 
          base64: base64, 
          fileName: currentFileName || ("upload_" + Date.now() + ".jpg"), 
          phone: phone,
          context: currentCropContext || "general"
        }).then(function(res) {
            showLoading(false);
            if (saveBtn) saveBtn.disabled = false;
            if(res.status === "success") {
              if (currentCropContext === 'profile') {
                const userRole = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
                const isAutoApprove = userRole === 'teacher' || userRole === 'admin';
                const freshUrl = res.url.includes('?') ? res.url : (res.url + '?t=' + Date.now());

                if (isAutoApprove) {
                  document.getElementById('profile-preview').style.backgroundImage = "url('" + freshUrl + "')";
                  document.getElementById('profile-preview').setAttribute('data-url', res.url);
                  
                  const adjustBtn = document.getElementById('btn-adjust-profile');
                  if (adjustBtn) adjustBtn.style.display = 'inline-block';
                  
                  showCustomAlert("อัปโหลดและเปลี่ยนรูปโปรไฟล์เรียบร้อยแล้ว!", "success");
                } else {
                  const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                  document.getElementById('profile-preview').style.backgroundImage = "url('" + placeholderImg + "')";
                  document.getElementById('profile-preview').removeAttribute('data-url');
                  
                  const adjustBtn = document.getElementById('btn-adjust-profile');
                  if (adjustBtn) adjustBtn.style.display = 'none';
                  
                  showCustomAlert("อัปโหลดรูปสำเร็จ! กรุณารอครูประจำตำบลตรวจสอบความเหมาะสมก่อนแสดงผล", "success");
                }

                cacheLeaderboard = null; 
                cacheProfile = null;
                closeCropModal();
                loadProfileData(true);
                if (typeof loadHomePageData === 'function') loadHomePageData(true);
              } else if (currentCropContext === 'source') {
                document.getElementById('admin-source-cover').value = res.url;
                const preview = document.getElementById('admin-source-preview');
                preview.style.backgroundImage = "url('" + res.url + "')";
                preview.style.display = 'block';
                showCustomAlert("อัปโหลดรูปปกสำเร็จ", "success");
                closeCropModal();
              } else if (currentCropContext === 'base') {
                document.getElementById('admin-base-cover').value = res.url;
                const preview = document.getElementById('admin-base-preview');
                preview.style.backgroundImage = "url('" + res.url + "')";
                preview.style.display = 'block';
                showCustomAlert("อัปโหลดรูปฐานสำเร็จ", "success");
                closeCropModal();
              } else if (currentCropContext === 'editUser') {
                document.getElementById('edit-user-image').value = res.url;
                showCustomAlert("อัปโหลดรูปสำเร็จ! อย่าลืมกดบันทึกการแก้ไข", "success");
                closeCropModal();
              } else if (currentCropContext === 'certificateTemplate') {
                // ใบประกาศแหล่งเรียนรู้ — set background URL ลงใน input และ preview
                var certBgEl = document.getElementById('admin-source-cert-bg');
                if (certBgEl) certBgEl.value = res.url;
                if (typeof updateAdminSourceCertPreview === 'function') updateAdminSourceCertPreview();
                showCustomAlert("อัปโหลดรูปพื้นหลังใบประกาศสำเร็จ", "success");
                closeCropModal();
              } else if (currentCropContext === 'activityCertificateTemplate') {
                // ใบประกาศกิจกรรม — set background URL ลงใน input และ preview
                var actCertBgEl = document.getElementById('admin-activity-cert-bg');
                if (actCertBgEl) actCertBgEl.value = res.url;
                if (typeof updateAdminActivityCertPreview === 'function') updateAdminActivityCertPreview();
                showCustomAlert("อัปโหลดรูปพื้นหลังใบประกาศกิจกรรมสำเร็จ", "success");
                closeCropModal();
              } else if (currentCropContext === 'certSignature') {
                // ลายเซ็นต์ใบประกาศแหล่งเรียนรู้
                var sigUrlEl = document.getElementById('admin-source-cert-sig-url');
                if (sigUrlEl) sigUrlEl.value = res.url;
                if (typeof updateAdminSourceCertPreview === 'function') updateAdminSourceCertPreview();
                showCustomAlert("อัปโหลดลายเซ็นสำเร็จ", "success");
                closeCropModal();
              } else if (currentCropContext === 'globalCertSignature') {
                // ลายเซ็นต์ผู้บริหาร (global)
                var globalSigEl = document.getElementById('global-signature-url');
                if (globalSigEl) globalSigEl.value = res.url;
                showCustomAlert("อัปโหลดลายเซ็นผู้บริหารสำเร็จ! กรุณากดบันทึกการตั้งค่า", "success");
                closeCropModal();
              } else if (currentCropContext === 'product' || currentCropContext === 'featured') {
                // รูปสินค้า/กิจกรรมเด่น — set ลงใน input field ที่ตรงกัน
                var targetInputId = currentCropContext === 'featured' ? 'admin-featured-image' : 'admin-product-image';
                var targetInput = document.getElementById(targetInputId);
                if (targetInput) {
                  targetInput.value = res.url;
                }
                // อัปเดต preview ด้วย
                var previewId = currentCropContext === 'featured' ? 'admin-featured-preview' : 'admin-product-preview';
                var prevEl = document.getElementById(previewId);
                if (prevEl) {
                  prevEl.style.backgroundImage = "url('" + res.url + "')";
                  prevEl.style.display = 'block';
                }
                showCustomAlert("อัปโหลดรูปภาพสำเร็จ", "success");
                closeCropModal();
              } else {
                closeCropModal();
              }
            } else {
              showCustomAlert(res.message || "อัปโหลดรูปไม่สำเร็จ", "error");
            }
        }).catch(function() {
          showLoading(false);
          if (saveBtn) saveBtn.disabled = false;
          showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        });
      } catch(e) {
        showLoading(false);
        if (saveBtn) saveBtn.disabled = false;
        showCustomAlert("เกิดข้อผิดพลาดในการครอบตัดรูปภาพ", "error");
      }
    }, 100);
  }

  function adjustProfileImage() {
    const picUrl = document.getElementById('profile-preview').getAttribute('data-url');
    if (isLoftAssetUrl(picUrl)) {
      currentCropContext = 'profile';
      currentFileName = "profile_" + localStorage.getItem("userPhone") + "_" + Date.now() + ".jpg";
      openCropModal(picUrl);
    } else {
      showCustomAlert("ยังไม่มีรูปโปรไฟล์ให้ปรับตำแหน่งครับ", "warning");
    }
    closeAvatarMenu();
  }

  function previewAndUploadImage(input) {
    if (input.files && input.files[0]) {
      currentCropContext = 'profile';
      currentFileName = "profile_" + localStorage.getItem("userPhone") + ".jpg";
      openCropModal(input.files[0]);
    }
  }

  // ─── Edit My Profile Functions ──────────────────────────────
  function openEditMyProfileModal() {
    const p = window.cacheProfile || {};
    const fullName = p.fullName || localStorage.getItem("userName") || "";
    const tambon = p.tambon || localStorage.getItem("userTambon") || "";
    const userCategory = p.userCategory || "ประชาชนทั่วไป";
    const ageGroup = p.ageGroup || "";
    const occupation = p.occupation || "";

    const nameEl = document.getElementById('edit-my-fullname');
    if (nameEl) nameEl.value = fullName;

    const myInst = localStorage.getItem("userInstitution") || localStorage.getItem("userInstitutionId") || "INS_PHRAO";
    const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(myInst) : [];
    const tambonSelect = document.getElementById('edit-my-tambon');
    if (tambonSelect) {
      let optHtml = '<option value="">— เลือกสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.) —</option>';
      subUnits.forEach(function(u) {
        optHtml += '<option value="' + u + '">' + u + '</option>';
      });
      tambonSelect.innerHTML = optHtml;
    }

    setSelectTambonValue('edit-my-tambon', tambon);

    const catEl = document.getElementById('edit-my-category');
    if (catEl) catEl.value = userCategory;

    const ageEl = document.getElementById('edit-my-age-group');
    if (ageEl) ageEl.value = ageGroup;

    const occEl = document.getElementById('edit-my-occupation');
    if (occEl) occEl.value = occupation;

    const modal = document.getElementById('edit-my-profile-modal');
    if (modal) modal.style.display = 'flex';
  }
  window.openEditMyProfileModal = openEditMyProfileModal;

  function closeEditMyProfileModal() {
    const modal = document.getElementById('edit-my-profile-modal');
    if (modal) modal.style.display = 'none';
  }
  window.closeEditMyProfileModal = closeEditMyProfileModal;

  function submitEditMyProfile() {
    const fullName = (document.getElementById('edit-my-fullname').value || '').trim();
    const tambon = (document.getElementById('edit-my-tambon').value || '').trim();
    const userCategory = (document.getElementById('edit-my-category').value || 'ประชาชนทั่วไป').trim();
    const ageGroup = (document.getElementById('edit-my-age-group').value || '').trim();
    const occupation = (document.getElementById('edit-my-occupation').value || '').trim();

    if (!fullName) return showCustomAlert("กรุณากรอกชื่อ-นามสกุล", "warning");

    showLoading(true);
    apiPost('updateUserDetails', withAuthParams({
      targetUserId: localStorage.getItem("userPhone"),
      fullName: fullName,
      tambon: tambon,
      userCategory: userCategory,
      ageGroup: ageGroup,
      occupation: occupation
    })).then(function(res) {
      showLoading(false);
      if (res.status === 'success') {
        showCustomAlert("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว", "success");
        closeEditMyProfileModal();
        
        localStorage.setItem("userName", fullName);
        if (tambon) localStorage.setItem("userTambon", tambon);

        const headerUserName = document.getElementById('header-user-name');
        if (headerUserName) headerUserName.innerText = fullName;

        window.cacheProfile = null;
        if (typeof loadProfileData === 'function') loadProfileData();
      } else {
        showCustomAlert(res.message || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล", "error");
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    });
  }
  window.submitEditMyProfile = submitEditMyProfile;

  // ─── Change My Password Functions ──────────────────────────────
  function openChangeMyPasswordModal() {
    const oldEl = document.getElementById('my-old-password');
    const newEl = document.getElementById('my-new-password');
    const confEl = document.getElementById('my-confirm-password');

    if (oldEl) oldEl.value = '';
    if (newEl) newEl.value = '';
    if (confEl) confEl.value = '';

    const modal = document.getElementById('change-my-password-modal');
    if (modal) modal.style.display = 'flex';
  }
  window.openChangeMyPasswordModal = openChangeMyPasswordModal;

  function closeChangeMyPasswordModal() {
    const modal = document.getElementById('change-my-password-modal');
    if (modal) modal.style.display = 'none';
  }
  window.closeChangeMyPasswordModal = closeChangeMyPasswordModal;

  function submitChangeMyPassword() {
    const oldPassword = (document.getElementById('my-old-password').value || '').trim();
    const newPassword = (document.getElementById('my-new-password').value || '').trim();
    const confirmPassword = (document.getElementById('my-confirm-password').value || '').trim();

    if (!oldPassword) return showCustomAlert("กรุณากรอกรหัสผ่านปัจจุบัน", "warning");
    if (!newPassword || newPassword.length < 6) return showCustomAlert("กรุณากรอกรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร", "warning");
    if (newPassword !== confirmPassword) return showCustomAlert("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน", "warning");

    showLoading(true);
    apiPost('changePassword', withAuthParams({
      oldPassword: oldPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword
    })).then(function(res) {
      showLoading(false);
      if (res.status === 'success') {
        showCustomAlert("เปลี่ยนรหัสผ่านสำเร็จแล้ว", "success");
        closeChangeMyPasswordModal();
      } else {
        showCustomAlert(res.message || "เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน", "error");
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    });
  }
  window.submitChangeMyPassword = submitChangeMyPassword;

  // ─── E-Portfolio Modal Functions ──────────────────────────────
  function openEPortfolioModal(targetPhone) {
    const phone = targetPhone || localStorage.getItem('userPhone') || '';
    if (!phone) {
      if (typeof showCustomAlert === 'function') {
        showCustomAlert('กรุณาเลือกผู้เรียนหรือเข้าสู่ระบบเพื่อดูสมุดสะสมการเรียนรู้', 'warning');
      }
      return;
    }

    if (typeof showLoading === 'function') showLoading(true);

    apiGet('getEPortfolio', withAuthParams({ targetPhone: phone }))
      .then(function(res) {
        if (typeof showLoading === 'function') showLoading(false);
        if (res && res.status === 'success' && res.profile) {
          const p = res.profile;

          const fullnameEl = document.getElementById('ep-fullname');
          if (fullnameEl) fullnameEl.innerText = p.fullName || p.username || '—';

          const phoneEl = document.getElementById('ep-phone');
          if (phoneEl) phoneEl.innerText = p.phone || p.username || '—';

          const tambonEl = document.getElementById('ep-tambon');
          if (tambonEl) tambonEl.innerText = (typeof formatTambon === 'function' ? formatTambon(p.tambon) : p.tambon) || '—';

          const levelEl = document.getElementById('ep-level');
          if (levelEl) levelEl.innerText = 'ระดับ ' + (p.level || 1);

          const scoreEl = document.getElementById('ep-score');
          if (scoreEl) scoreEl.innerText = Number(p.score || 0).toLocaleString();

          const nfeEl = document.getElementById('ep-nfe-hours');
          if (nfeEl) nfeEl.innerText = (p.nfeHours || p.nfe_hours || 0) + ' ชม.';

          const quizCount = (res.quizzes || []).length;
          const logCount = (res.logs || []).length;
          const progressEl = document.getElementById('ep-progress-pct');
          if (progressEl) progressEl.innerText = (quizCount + logCount) + ' กิจกรรม';

          // Render Quizzes table
          const quizTableBody = document.getElementById('ep-quizzes-table-body');
          if (quizTableBody) {
            if (res.quizzes && res.quizzes.length > 0) {
              let qHtml = '';
              res.quizzes.forEach(function(q) {
                const name = q.baseName || q.sourceName || q.baseId || q.sourceId || 'แบบทดสอบ';
                qHtml += '<tr style="border-bottom:1px solid var(--card-border);">' +
                  '<td style="padding:6px 4px; font-weight:600;">' + (typeof escapeJS === 'function' ? escapeJS(name) : name) + '</td>' +
                  '<td style="padding:6px 4px; text-align:center; color:var(--primary); font-weight:bold;">' + (q.score || '100%') + '</td>' +
                  '<td style="padding:6px 4px; text-align:right; color:var(--text-soft);">' + (q.date || '—') + '</td>' +
                  '</tr>';
              });
              quizTableBody.innerHTML = qHtml;
            } else {
              quizTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ไม่มีข้อมูลประวัติการทำแบบทดสอบ</td></tr>';
            }
          }

          // Render Logs table
          const logTableBody = document.getElementById('ep-logs-table-body');
          if (logTableBody) {
            if (res.logs && res.logs.length > 0) {
              let lHtml = '';
              res.logs.forEach(function(l) {
                lHtml += '<tr style="border-bottom:1px solid var(--card-border);">' +
                  '<td style="padding:6px 4px;">' +
                    '<div style="font-weight:600;">' + (typeof escapeJS === 'function' ? escapeJS(l.activityName || l.description || 'กิจกรรม') : (l.activityName || l.description || 'กิจกรรม')) + '</div>' +
                    (l.note ? '<div style="font-size:0.65rem; color:var(--text-soft);">' + (typeof escapeJS === 'function' ? escapeJS(l.note) : l.note) + '</div>' : '') +
                  '</td>' +
                  '<td style="padding:6px 4px; text-align:center; color:var(--gold); font-weight:bold;">+' + (l.score || 0) + ' แต้ม</td>' +
                  '<td style="padding:6px 4px; text-align:right; color:var(--text-soft);">' + (l.date || '—') + '</td>' +
                  '</tr>';
              });
              logTableBody.innerHTML = lHtml;
            } else {
              logTableBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-3">ไม่มีข้อมูลบันทึกกิจกรรมการเรียนรู้</td></tr>';
            }
          }

          // QR Code
          const qrEl = document.getElementById('ep-qrcode');
          if (qrEl) {
            const verifyUrl = encodeURIComponent(window.location.origin + '?eportfolio=' + (p.username || p.phone));
            qrEl.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + verifyUrl;
          }

          const modal = document.getElementById('eportfolio-modal');
          if (modal) modal.style.display = 'flex';
        } else {
          if (typeof showCustomAlert === 'function') {
            showCustomAlert((res && res.message) || 'ไม่สามารถโหลดข้อมูล E-Portfolio ได้', 'error');
          }
        }
      })
      .catch(function(err) {
        if (typeof showLoading === 'function') showLoading(false);
        if (typeof showCustomAlert === 'function') {
          showCustomAlert('เกิดข้อผิดพลาดในการโหลดข้อมูล E-Portfolio', 'error');
        }
      });
  }

  function printEPortfolio() {
    window.print();
  }

  window.openEPortfolioModal = openEPortfolioModal;
  window.printEPortfolio = printEPortfolio;

  window.loadProfileData = loadProfileData;
  window.renderLearningDashboard = renderLearningDashboard;
  window.openAvatarMenu = openAvatarMenu;
  window.closeAvatarMenu = closeAvatarMenu;
  window.triggerUpload = triggerUpload;
  window.viewFullImage = viewFullImage;
  window.closeCropModal = closeCropModal;
  window.applyCrop = applyCrop;
  window.adjustProfileImage = adjustProfileImage;
  window.previewAndUploadImage = previewAndUploadImage;

  // ═══ ID PLAN & AI ADVISOR FUNCTIONS ═══
  let lastAIDraft = null;

  function loadIDPlanData(fresh, targetPhone) {
    if (fresh) window.cacheIDPlanData = null;
    const area = document.getElementById('id-plan-content-area');
    if (!area) return;

    if (window.cacheIDPlanData && !fresh) {
      if (window.cacheIDPlanData.plan) {
        renderIDPlanCard(window.cacheIDPlanData.plan);
      }
      return;
    }

    const params = {};
    if (targetPhone) {
      params.targetPhone = targetPhone;
      params.targetUsername = targetPhone;
    }

    apiGet('getIDPlans', withAuthParams(params))
      .then(function(res) {
        if (res && res.status === 'success' && res.plan) {
          window.cacheIDPlanData = res;
          renderIDPlanCard(res.plan);
        } else {
          area.innerHTML =
            '<div class="text-center py-3">' +
              '<p class="text-muted text-xs mb-2">ยังไม่ได้สร้างแผนการเรียนรู้รายบุคคล (ID Plan)</p>' +
              '<button class="btn-primary text-xs" style="padding:6px 14px; border-radius:20px; background:linear-gradient(135deg,#f59e0b,#d97706); border:none;" onclick="openGenerateAIDraftModal()">' +
                '<i class="fas fa-magic mr-1"></i> ให้ AI ช่วยสร้างแผน ID Plan สู่เป้าหมาย' +
              '</button>' +
            '</div>';
        }
      })
      .catch(function() {
        area.innerHTML = '<div class="text-center text-muted text-xs py-2">เกิดข้อผิดพลาดในการดึงข้อมูล ID Plan</div>';
      });
  }

  function renderIDPlanCard(plan) {
    const area = document.getElementById('id-plan-content-area');
    if (!area) return;

    const items = plan.items || [];
    const doneCount = items.filter(i => i.status === 'Completed' || i.sage_approved).length;
    const totalCount = items.length || 1;
    const pct = Math.round((doneCount / totalCount) * 100);

    let statusBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400">🟢 ปฏิบัติตามแผน</span>';
    if (plan.status === 'InDanger') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400">🔴 เสี่ยงออกกลางคัน (ขาดเรียน > 20 วัน)</span>';
    } else if (plan.status === 'RePlanned') {
      statusBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">🟡 ลงพื้นที่ Re-Plan แล้ว</span>';
    }

    let itemsHtml = '';
    items.forEach(function(it) {
      const isDone = it.status === 'Completed' || it.sage_approved;
      const sageTag = it.sage_approved ? ' <span style="color:#fbbf24; font-size:0.7rem;">(✅ ปราชญ์ชาวบ้านรับรองแล้ว)</span>' : '';
      itemsHtml += 
        '<div style="background:rgba(0,0,0,0.15); border-radius:12px; padding:8px 12px; margin-top:6px; display:flex; align-items:center; justify-content:space-between; font-size:0.8rem;">' +
          '<div>' +
            '<span style="font-weight:700;' + (isDone ? 'text-decoration:line-through; color:var(--text-soft);' : '') + '">' + escapeHtml(it.custom_item_title) + '</span>' + sageTag +
            '<div style="font-size:0.7rem; color:var(--text-soft);">หมวด: ' + (it.category === 'academic' ? 'วิชาการ' : (it.category === 'vocation' ? 'อาชีพ/ภูมิปัญญา' : 'ดิจิทัล')) + ' | ' + it.target_hours + ' ชม.</div>' +
          '</div>' +
          '<div>' + (isDone ? '✅ ผ่านแล้ว' : '⏳ กำลังเรียนรู้') + '</div>' +
        '</div>';
    });

    area.innerHTML = 
      '<div style="text-align:left;">' +
        '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">' +
          '<strong style="font-size:0.9rem; color:var(--text-inv);">' + escapeHtml(plan.title || 'ID Plan') + '</strong>' +
          statusBadge +
        '</div>' +
        '<div style="font-size:0.78rem; color:var(--text-soft); margin-bottom:10px;">' +
          '🎯 <strong>เป้าหมายชีวิต:</strong> ' + escapeHtml(plan.target_career_goal || 'ไม่ระบุ') +
        '</div>' +
        '<div style="background:rgba(0,0,0,0.2); height:8px; border-radius:4px; overflow:hidden; margin-bottom:6px;">' +
          '<div style="width:' + pct + '%; height:100%; background:linear-gradient(90deg,#10b981,#059669); transition:width 0.4s;"></div>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-soft); margin-bottom:10px;">' +
          '<span>ความสำเร็จแผน: ' + pct + '% (' + doneCount + '/' + totalCount + ' รายการ)</span>' +
          '<span>เกณฑ์แจ้งเตือน: 20 วัน</span>' +
        '</div>' +
        '<div style="margin-top:10px;">' +
          '<strong style="font-size:0.8rem;">📋 รายการเป้าหมายการเรียนรู้ในแผน:</strong>' +
          itemsHtml +
        '</div>' +
      '</div>';
  }

  function openGenerateAIDraftModal() {
    const m = document.getElementById('modal-generate-ai-plan');
    if (m) m.style.display = 'flex';
  }

  function closeGenerateAIDraftModal() {
    const m = document.getElementById('modal-generate-ai-plan');
    if (m) m.style.display = 'none';
  }

  function runAIGenerateAction() {
    const goalEl = document.getElementById('ai-input-career-goal');
    const levelEl = document.getElementById('ai-input-digital-level');
    const outBox = document.getElementById('ai-draft-output-box');
    const saveBtn = document.getElementById('btn-save-ai-plan');

    const goal = goalEl ? goalEl.value.trim() : '';
    const level = levelEl ? levelEl.value : 'Basic';

    if (outBox) {
      outBox.style.display = 'block';
      outBox.innerHTML = '<div class="text-center py-3" style="color:var(--gold); font-weight:700;"><i class="fas fa-robot fa-spin mr-1"></i> LOFT AI Advisor กำลังประมวลผลวิเคราะห์จุดแข็ง-จุดอ่อน...</div>';
    }

    apiPost('generateAIDraft', withAuthParams({ careerGoal: goal, digitalLevel: level }))
      .then(function(res) {
        if (res.status === 'success' && res.draft) {
          lastAIDraft = res.draft;
          let html = '<div style="color:var(--primary); font-weight:800; margin-bottom:8px; font-size:0.88rem;">✨ ผลการวิเคราะห์จาก LOFT AI Advisor:</div>';
          html += '<div style="color:var(--text); margin-bottom:4px;"><strong>🎯 ชื่อแผน:</strong> ' + escapeHtml(res.draft.title) + '</div>';
          html += '<div style="color:var(--text); margin-bottom:4px;"><strong>🌟 จุดแข็ง:</strong> <span style="color:var(--text-soft);">' + escapeHtml((res.draft.strengths || []).join(', ')) + '</span></div>';
          html += '<div style="color:var(--text); margin-bottom:4px;"><strong>⚠️ จุดที่ต้องเร่งพัฒนา:</strong> <span style="color:var(--text-soft);">' + escapeHtml((res.draft.gaps || []).join(', ')) + '</span></div>';
          html += '<div style="margin-top:8px; font-weight:700; color:var(--text);">📚 รายการวิชาและภูมิปัญญาที่แนะนำ (' + (res.draft.items || []).length + ' รายการ):</div>';
          
          (res.draft.items || []).forEach(function(it, idx) {
            html += '<div style="margin-top:4px; padding:5px 8px; border-radius:8px; background:var(--glass); border:1px solid var(--glass-border); font-size:0.75rem; color:var(--text); font-weight:600;">' + 
              (idx + 1) + '. ' + escapeHtml(it.custom_item_title) + ' <span style="color:var(--gold); font-weight:700;">(' + it.target_hours + ' ชม.)</span>' +
            '</div>';
          });

          if (outBox) outBox.innerHTML = html;
          if (saveBtn) saveBtn.style.display = 'inline-block';
        } else {
          if (outBox) outBox.innerHTML = '<div style="color:#ef4444; font-weight:600; text-align:center; padding:8px 0;">ไม่สามารถสร้างร่างแผนได้</div>';
        }
      })
      .catch(function() {
        if (outBox) outBox.innerHTML = '<div style="color:#ef4444; font-weight:600; text-align:center; padding:8px 0;">เกิดข้อผิดพลาดในการสื่อสารกับ AI</div>';
      });
  }

  function saveAIDraftPlanAction() {
    if (!lastAIDraft) return;
    if (typeof showLoading === 'function') showLoading(true);

    apiPost('createOrUpdateIDPlan', withAuthParams({
      title: lastAIDraft.title,
      targetCareerGoal: lastAIDraft.target_career_goal,
      initialDigitalLevel: lastAIDraft.initial_digital_level,
      strengths: lastAIDraft.strengths,
      gaps: lastAIDraft.gaps,
      items: lastAIDraft.items,
    }))
    .then(function(res) {
      if (typeof showLoading === 'function') showLoading(false);
      if (res.status === 'success') {
        if (typeof showCustomAlert === 'function') showCustomAlert(res.message, 'success');
        closeGenerateAIDraftModal();
        window.cacheIDPlanData = res;
        if (res.plan) {
          renderIDPlanCard(res.plan);
        }
        loadIDPlanData(true);
      } else {
        if (typeof showCustomAlert === 'function') showCustomAlert(res.message || 'บันทึกแผนไม่สำเร็จ', 'error');
      }
    })
    .catch(function() {
      if (typeof showLoading === 'function') showLoading(false);
      if (typeof showCustomAlert === 'function') showCustomAlert('เกิดข้อผิดพลาดทางเครือข่าย', 'error');
    });
  }

  window.loadIDPlanData = loadIDPlanData;
  window.openGenerateAIDraftModal = openGenerateAIDraftModal;
  window.closeGenerateAIDraftModal = closeGenerateAIDraftModal;
  window.runAIGenerateAction = runAIGenerateAction;
  window.saveAIDraftPlanAction = saveAIDraftPlanAction;


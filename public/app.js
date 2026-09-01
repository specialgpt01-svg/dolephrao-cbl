


  if (typeof window.cacheLeaderboard === 'undefined') window.cacheLeaderboard = null;
  if (typeof window.cacheHomeData === 'undefined') window.cacheHomeData = null;
  if (typeof window.cacheHomeSummary === 'undefined') window.cacheHomeSummary = null;
  if (typeof window.cacheProfile === 'undefined') window.cacheProfile = null;
  if (typeof window.cacheHistory === 'undefined') window.cacheHistory = null;
  
  let confirmCallback = null;

  let currentLogPage = 1;
  let totalLogPages = 1;
  let adminHomeAreas = [];
  let adminHomeActivities = [];
  let adminLearnersCache = [];
  let activeAdminLearnerId = '';

  function isLoftAssetUrl(url) {
    const value = String(url || "").trim();
    if (!value || value === 'undefined' || value === 'null') return false;
    return value.startsWith("http") || value.startsWith("/") || value.startsWith("data:image/") || value.startsWith("storage/") || value.startsWith("uploads/");
  }

  // เพิ่มตัวแปรสำหรับแบ่งหน้าประวัติเกียรติบัตร

  // 🌟 ฟังก์ชันตัวช่วย: กำหนดสีและไอคอนตามระดับ Rank (Emerald Palette)
  function getRankStyle(levelStr) {
    const levelNumber = Number(levelStr);
    if (Number.isInteger(levelNumber)) {
      if (levelNumber >= 6) return { title: "Glorious Conqueror", color: "#fbbf24", icon: "fa-crown" };
      if (levelNumber === 5) return { title: "นักเรียนรู้ต้นแบบ", color: "#064e3b", icon: "fa-medal" };
      if (levelNumber === 4) return { title: "นักเรียนรู้ระดับเชี่ยวชาญ", color: "#059669", icon: "fa-gem" };
      if (levelNumber === 3) return { title: "นักเรียนรู้ระดับก้าวหน้า", color: "#10b981", icon: "fa-shield-alt" };
      if (levelNumber === 2) return { title: "นักเรียนรู้ระดับกลาง", color: "#34d399", icon: "fa-star" };
      if (levelNumber === 1) return { title: "นักเรียนรู้ระดับต้น", color: "#94a3b8", icon: "fa-star-half-alt" };
    }
    let lvl = String(levelStr).toUpperCase();
    if (lvl.indexOf("GLORIOUS") > -1 || lvl.indexOf("CONQUEROR") > -1) return { title: "Glorious Conqueror", color: "#fbbf24", icon: "fa-crown" };
    if (lvl.indexOf("ต้นแบบ") > -1 || lvl.indexOf("MASTER") > -1) return { title: "นักเรียนรู้ต้นแบบ", color: "#064e3b", icon: "fa-medal" };
    if (lvl.indexOf("เชี่ยวชาญ") > -1 || lvl.indexOf("DIAMOND") > -1) return { title: "นักเรียนรู้ระดับเชี่ยวชาญ", color: "#059669", icon: "fa-gem" };
    if (lvl.indexOf("ก้าวหน้า") > -1 || lvl.indexOf("PLATINUM") > -1) return { title: "นักเรียนรู้ระดับก้าวหน้า", color: "#10b981", icon: "fa-shield-alt" };
    if (lvl.indexOf("กลาง") > -1 || lvl.indexOf("GOLD") > -1) return { title: "นักเรียนรู้ระดับกลาง", color: "#34d399", icon: "fa-star" };
    if (lvl.indexOf("ต้น") > -1 || lvl.indexOf("SILVER") > -1) return { title: "นักเรียนรู้ระดับต้น", color: "#94a3b8", icon: "fa-star-half-alt" };
    return { title: "ผู้เตรียมความพร้อม", color: "#64748b", icon: "fa-seedling" };
  }

  function showCustomAlert(message, type, title) {
    if (typeof window.showCustomAlert === 'function' && window.showCustomAlert !== showCustomAlert) {
      return window.showCustomAlert({
        title: title || (type === 'error' ? 'เกิดข้อผิดพลาด' : (type === 'success' ? 'ดำเนินการสำเร็จ' : 'แจ้งเตือน')),
        message: message,
        type: type || 'info',
        isHtml: true
      });
    }
    type = type || 'info';
    title = title || 'แจ้งเตือน';
    const modal = document.getElementById('custom-alert-modal');
    if (!modal) return;
    const icon = document.getElementById('custom-alert-icon');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');
    const cancelBtn = document.getElementById('custom-alert-cancel');
    
    if (msgEl) msgEl.innerHTML = message;
    if (titleEl) titleEl.innerText = title;
    if (cancelBtn) cancelBtn.style.display = 'none';
    confirmCallback = null;

    if (icon) {
      if (type === 'success') { icon.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i>'; }
      else if (type === 'error') { icon.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444;"></i>'; if (titleEl) titleEl.innerText = 'เกิดข้อผิดพลาด';}
      else if (type === 'warning') { icon.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>'; }
      else { icon.innerHTML = '<i class="fas fa-info-circle" style="color: #10b981;"></i>'; }
    }

    modal.style.display = 'flex';
  }

  function showCustomConfirm(message, callback) {
    if (typeof window.showCustomConfirm === 'function' && window.showCustomConfirm !== showCustomConfirm) {
      return window.showCustomConfirm({
        title: 'ยืนยันการดำเนินการ',
        message: message,
        type: 'question',
        isHtml: true
      }, callback);
    }
    showCustomAlert(message, 'warning', 'ยืนยันการทำรายการ');
    const cancelBtn = document.getElementById('custom-alert-cancel');
    if (cancelBtn) cancelBtn.style.display = 'block'; 
    confirmCallback = callback;
  }

  function closeCustomAlert(isOk) {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) modal.style.display = 'none';
    if (isOk && confirmCallback) confirmCallback(); 
  }

  function hideElement(el) {
    if (el) el.style.display = 'none';
  }

  function hideBySelector(selector) {
    document.querySelectorAll(selector).forEach(hideElement);
  }

  function hideClosestBySelector(selector, closestSelector) {
    document.querySelectorAll(selector).forEach(function(el) {
      hideElement(el.closest(closestSelector) || el);
    });
  }

  function hideUploadControl(fileInputId) {
    const input = document.getElementById(fileInputId);
    hideElement(input);
    hideBySelector('button[onclick*="' + fileInputId + '"]');
  }

  function isFirebaseFreePageDisabled(pageId) {
    return LOFT_FIREBASE_FREE_MODE && DISABLED_FREE_MODE_PAGES.has(pageId);
  }

  function applyFirebaseFreeModeUI() {
    if (!LOFT_FIREBASE_FREE_MODE) return;

    hideBySelector('#nav-market, #nav-scan');
    hideBySelector('#market-page, #admin-activities-page, #admin-coupons-page');
    hideBySelector('#coupon-wallet-modal, #lucky-spin-modal, #qr-viewer-modal');
    hideBySelector('#proposal-page, #evaluation-modal, #proposal-review-modal');

    hideBySelector('button[onclick*="showPage(\'proposal-page\')"]');
    hideBySelector('button[onclick*="openCouponWalletModal"]');
    hideBySelector('button[onclick*="getAISummary"]');
    hideBySelector('button[onclick*="submitEvaluation"]');
    hideBySelector('button[onclick*="redeemCouponUI"]');
    hideBySelector('button[onclick*="openLuckySpinModal"]');
    hideBySelector('button[onclick*="openAdminActivitiesPanel"]');
    hideBySelector('button[onclick*="openAdminCouponsPanel"]');
    hideBySelector('button[onclick*="submitProposalReview"]');

    hideBySelector('button[onclick*="switchApproveTab(\'proposals\')"]');
    hideBySelector('#approve-tab-proposals');
    hideBySelector('button[onclick*="switchUserMgmtTab(\'cert\')"], #tab-btn-cert-history');
    hideBySelector('button[onclick*="switchAdminTab(\'activities\')"], #admin-tab-activities');

    hideBySelector('.profile-upload-wrapper');
    hideClosestBySelector('#cert-list-container', '.loft-card');
    hideClosestBySelector('#badges-shelf-container', '.loft-card');

    hideUploadControl('imageUpload');
    hideUploadControl('admin-source-cover-file');
    hideUploadControl('admin-base-cover-file');
    hideUploadControl('admin-base-cert-file');
    hideUploadControl('admin-featured-image-file');
    hideUploadControl('admin-product-image-file');

    const marketNav = document.getElementById('nav-market');
    if (marketNav) marketNav.classList.remove('active');
    const scanNav = document.getElementById('nav-scan');
    if (scanNav) scanNav.classList.remove('active');
  }

  function updateNavByRole() {
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const instId = String(localStorage.getItem("userInstitution") || "").trim().toUpperCase();

    const titleEl = document.getElementById('app-header-inst-title');
    const subtitleEl = document.getElementById('app-header-inst-subtitle');
    if (titleEl) {
      if (instId === 'INS_MAERIM' || instId === 'MAERIM') {
        titleEl.innerText = 'MAE RIM';
      } else if (instId === 'ALL' || instId === 'ทั้งหมด') {
        titleEl.innerText = 'CHIANG MAI';
      } else {
        titleEl.innerText = 'PHRAO';
      }
    }
    
    const logNav = document.getElementById('nav-log');
    if (logNav) logNav.style.display = (role === "user") ? "flex" : "none";
    
    const isStaff = (role === "teacher" || role === "admin");
    const manageNav = document.getElementById('nav-manage');
    if (manageNav) manageNav.style.display = isStaff ? "flex" : "none";
    
    const dashNav = document.getElementById('nav-dashboard');
    if (dashNav) dashNav.style.display = isStaff ? "flex" : "none";

    const profileNav = document.getElementById('nav-profile');
    if (profileNav) profileNav.style.display = (role === "guest") ? "none" : "flex";

    applyFirebaseFreeModeUI();
  }

  function safeRun(label, fn) {
    try {
      return fn();
    } catch (err) {
      console.error(label + ' failed', err);
      return null;
    }
  }

  let marketLoadingCallbacks = null;
  function ensureMarketLoaded(callback) {
    const container = document.getElementById('market-page');
    if (!container) {
      if (callback) callback();
      return;
    }
    if (container.getAttribute('data-loaded') === 'true') {
      if (callback) callback();
      return;
    }

    if (marketLoadingCallbacks !== null) {
      if (callback) marketLoadingCallbacks.push(callback);
      return;
    }

    marketLoadingCallbacks = [];
    if (callback) marketLoadingCallbacks.push(callback);

    showLoading(true);
    fetch('market.html?v=20260818-live-v1')
      .then(function(res) {
        if (!res.ok) {
          throw new Error('HTTP status ' + res.status);
        }
        return res.text();
      })
      .then(function(html) {
        container.innerHTML = html;
        container.setAttribute('data-loaded', 'true');

        // Move modals to body so they are not hidden when market-page is hidden.
        // Only remove stale body-level modals; the freshly loaded modals are inside container.
        ['coupon-wallet-modal', 'lucky-spin-modal', 'product-detail-modal', 'product-form-modal'].forEach(function(modalId) {
          document.querySelectorAll('body > #' + modalId).forEach(function(existingModal) {
            existingModal.remove();
          });

          const freshModal = container.querySelector('#' + modalId);
          if (freshModal) {
            document.body.appendChild(freshModal);
          }
        });

        applyFirebaseFreeModeUI();
        showLoading(false);
        safeRun('loadMarketData', loadMarketData);

        const callbacks = marketLoadingCallbacks;
        marketLoadingCallbacks = null;
        callbacks.forEach(function(cb) {
          if (cb) cb();
        });
      })
      .catch(function(err) {
        showLoading(false);
        console.error('Failed to load market page:', err);
        showCustomAlert("โหลดหน้าตลาดชุมชนไม่สำเร็จ", "error");
        const callbacks = marketLoadingCallbacks;
        marketLoadingCallbacks = null;
        callbacks.forEach(function(cb) {
          if (cb) cb();
        });
      });
  }

  var _pageHistoryStack = [];

  function goBackPage() {
    if (_pageHistoryStack && _pageHistoryStack.length > 0) {
      var prevPage = _pageHistoryStack.pop();
      showPage(prevPage, true);
    } else {
      showPage('home-page', true);
    }
  }
  window.goBackPage = goBackPage;

  function showPage(pageId, isBack) {
    if (window.stopSpeaking) window.stopSpeaking();

    // บันทึกหน้าปัจจุบันลง Stack หากไม่ใช่การย้อนกลับ
    if (!isBack) {
      var currentPage = '';
      var visibleSections = document.querySelectorAll('.page-section');
      for (var i = 0; i < visibleSections.length; i++) {
        if (visibleSections[i].style.display === 'block') {
          currentPage = visibleSections[i].id;
          break;
        }
      }
      if (currentPage && currentPage !== pageId && ['login-page', 'register-page'].indexOf(currentPage) === -1) {
        _pageHistoryStack.push(currentPage);
      }
    }

    const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (role === "guest") {
      const restrictedPages = [
        'profile-page', 
        'log-page', 
        'manage-page', 
        'dashboard-page', 
        'approve-page', 
        'user-mgmt-page', 
        'proposal-page', 
        'quiz-page', 
        'result-page',
        'admin-activities-page',
        'admin-coupons-page'
      ];
      if (restrictedPages.includes(pageId)) {
        showCustomConfirm("ฟีเจอร์นี้เฉพาะสมาชิกนักศึกษา กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อดำเนินการ", function() {
          if (typeof logoutNoConfirm === "function") logoutNoConfirm();
        });
        return showPage('home-page');
      }
    }

    if (isFirebaseFreePageDisabled(pageId)) {
      showCustomAlert('ฟีเจอร์นี้ถูกปิดชั่วคราวเพื่อให้ระบบพร้อมย้ายไป Firebase แบบฟรี', 'warning', 'ปิดฟีเจอร์ชั่วคราว');
      return showPage('home-page');
    }

    if (pageId !== 'scan-page') {
      stopQRScanner();
    }
    document.querySelectorAll('.page-section').forEach(function(page) { page.style.display = 'none'; });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
      targetPage.style.display = 'block';
      targetPage.scrollTop = 0;
    }
    
    const bottomNav = document.getElementById('main-bottom-nav');

    if (['login-page', 'register-page', 'quiz-page', 'result-page'].includes(pageId)) {
      if(bottomNav) bottomNav.style.display = 'none';
    } else {
      if(bottomNav) bottomNav.style.display = 'flex';
      
      const navItems = document.querySelectorAll('.bottom-nav .nav-item');
      navItems.forEach(function(item) { item.classList.remove('active'); });
      
      const setNavActive = (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
      };

      if(pageId === 'home-page' || pageId === 'detail-page') { setNavActive('nav-home'); if(pageId === 'home-page') safeRun('loadHomePageData', loadHomePageData); }
      if(pageId === 'map-page') { setNavActive('nav-map'); safeRun('loadDistrictMap', loadDistrictMap); }
      if(pageId === 'leaderboard-page') { setNavActive('nav-leaderboard'); safeRun('loadLeaderboard', loadLeaderboard); }
      if(pageId === 'profile-page') { setNavActive('nav-profile'); safeRun('loadProfileData', loadProfileData); }
      if(pageId === 'scan-page') { setNavActive('nav-scan'); }
      
      if(pageId === 'log-page') { setNavActive('nav-log'); safeRun('loadMyLogs', function() { loadMyLogs(1); }); }
      if(pageId === 'manage-page') { setNavActive('nav-manage'); }
      if(pageId === 'approve-page') { setNavActive('nav-manage'); safeRun('loadPendingLogs', loadPendingLogs); }
      if(pageId === 'user-mgmt-page') { setNavActive('nav-manage'); safeRun('loadUserMgmt', loadUserMgmt); }
      if(pageId === 'dashboard-page') { setNavActive('nav-dashboard'); safeRun('loadDashboard', loadDashboard); }
      if(pageId === 'proposal-page') { safeRun('loadUserProposals', loadUserProposals); }
      if(pageId === 'market-page') {
        setNavActive('nav-market');
        ensureMarketLoaded();
      }
      if(pageId === 'upskill-page') {
        setNavActive('nav-upskill');
        if (typeof initUpSkillPage === 'function') safeRun('initUpSkillPage', initUpSkillPage);
      }
      if (pageId === 'admin-page') {
        const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
        if (role !== "admin" && role !== "teacher") {
          showCustomAlert("หน้านี้สำหรับผู้ดูแลระบบ/ครูประจำตำบลเท่านั้น", "warning");
          return showPage('home-page');
        }
        setNavActive('nav-manage');

        const container = document.getElementById('admin-page');
        const needsReload = !container || container.getAttribute('data-loaded') !== 'true' || !document.getElementById('admin-tab-institutions');
        if (needsReload) {
          showLoading(true);
          fetch('admin.html?v=20260819-institutions-v7-fixed')
            .then(function(res) { return res.text(); })
            .then(function(html) {
              container.innerHTML = html;
              container.setAttribute('data-loaded', 'true');
              applyFirebaseFreeModeUI();
              showLoading(false);
              initAdminPage(role);
            })
            .catch(function(err) {
              showLoading(false);
              console.error('Failed to load admin page:', err);
              showCustomAlert("โหลดหน้าผู้ดูแลระบบไม่สำเร็จ", "error");
              showPage('home-page');
            });
          return;
        } else {
          initAdminPage(role);
        }
      }

      applyFirebaseFreeModeUI();
    }
  }

  function initAdminPage(role) {
    bindAdminPageEvents();

    const requestedTab = window.pendingAdminTab || 'stats';
    const requestedSubTab = window.pendingAdminSubWorkspace || window.pendingAdminUpSkillSubTab || '';
    delete window.pendingAdminTab;
    delete window.pendingAdminSubWorkspace;
    delete window.pendingAdminUpSkillSubTab;
    switchAdminTab(requestedTab, requestedSubTab);

    const badge = document.querySelector('#admin-page .header-bar .user-badge');
    if (badge) {
      if (role === "admin") badge.innerText = "Admin";
      else badge.innerText = "Teacher";
    }
    const srcTambonSelect = document.getElementById('admin-source-tambon');
    if (srcTambonSelect) {
      srcTambonSelect.disabled = false;
      if (role === "teacher" && !srcTambonSelect.value) {
        srcTambonSelect.value = localStorage.getItem("userTambon") || "";
      }
    }
    const sourceSearch = document.getElementById('admin-source-search');
    if (sourceSearch) sourceSearch.placeholder = '\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e0a\u0e37\u0e48\u0e2d/\u0e15\u0e33\u0e1a\u0e25';
  }

  function bindAdminPageEvents() {
    const container = document.getElementById('admin-page');
    if (!container || container.getAttribute('data-events-bound') === 'true') return;
    container.setAttribute('data-events-bound', 'true');

    container.addEventListener('click', function(event) {
      const tabBtn = event.target.closest('[data-admin-tab]');
      if (tabBtn && container.contains(tabBtn)) {
        event.preventDefault();
        switchAdminTab(tabBtn.getAttribute('data-admin-tab'));
        return;
      }

      const learnerRow = event.target.closest('[data-learner-id]');
      if (learnerRow && container.contains(learnerRow)) {
        event.preventDefault();
        openAdminLearnerDetail(learnerRow.getAttribute('data-learner-id'));
      }
    });

    container.addEventListener('input', function(event) {
      if (event.target && event.target.matches('[data-admin-learner-search]')) {
        renderAdminLearnerList();
      }
    });
  }

  const ADMIN_WORKSPACE_META = {
    stats: { title: 'รายงานภาพรวมระบบ', description: 'จำนวนสมาชิก เกียรติบัตร และสถิติแยกตามพื้นที่', icon: 'fa-chart-column' },
    institutions: { title: 'จัดการสถานศึกษา และสถานศึกษาในสังกัด', description: 'บริหารจัดการสถานศึกษาหลัก และรายชื่อสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.)', icon: 'fa-building-columns' },
    sources: { title: 'จัดการแหล่งเรียนรู้', description: 'ข้อมูลแหล่ง รูปปก พิกัด เนื้อหา และใบประกาศ', icon: 'fa-map-location-dot' },
    bases: { title: 'จัดการฐานการเรียนรู้', description: 'ฐานย่อย พิกัด GPS เนื้อหา และการเรียงลำดับ', icon: 'fa-layer-group' },
    quizzes: { title: 'จัดการแบบทดสอบ', description: 'คำถาม ตัวเลือก เฉลย และลำดับข้อสอบ', icon: 'fa-circle-question' },
    activities: { title: 'กิจกรรมเด่นหน้าแรก', description: 'ภาพหลัก ชื่อ ช่วงเวลา และสถานที่ของรายการเด่น 1 รายการ', icon: 'fa-star' },
    settings: { title: 'ข้อมูลผู้บริหารและลายเซ็น', description: 'ข้อมูลส่วนกลางที่ใช้ในใบประกาศ', icon: 'fa-sliders' },
    upskill: { title: 'จัดการอัพสกิล', description: 'วิดีโอและหมวดหมู่สำหรับผู้เรียน', icon: 'fa-rocket' }
  };

  function updateAdminWorkspaceHeader(tabId, subTabId) {
    const meta = Object.assign({}, ADMIN_WORKSPACE_META[tabId] || ADMIN_WORKSPACE_META.stats);
    if (tabId === 'upskill' && subTabId === 'cats') {
      meta.title = 'หมวดหมู่อัพสกิล';
      meta.description = 'จัดหมวด สี ไอคอน และลำดับการแสดงผล';
      meta.icon = 'fa-tags';
    } else if (tabId === 'upskill') {
      meta.title = 'วิดีโออัพสกิล';
      meta.description = 'เพิ่ม แก้ไข และลบวิดีโอสำหรับผู้เรียน';
      meta.icon = 'fa-video';
    } else if (tabId === 'activities' && subTabId === 'quarterly') {
      meta.title = 'กิจกรรมรายไตรมาส (21 พื้นที่)';
      meta.description = 'เพิ่ม แก้ไข และค้นหากิจกรรมรายพื้นที่ประจำไตรมาส';
      meta.icon = 'fa-calendar-days';
    }

    const title = document.getElementById('admin-workspace-title');
    const description = document.getElementById('admin-workspace-description');
    const icon = document.getElementById('admin-workspace-icon');
    if (title) title.innerText = meta.title;
    if (description) description.innerText = meta.description;
    if (icon) icon.className = 'fas ' + meta.icon + ' mr-2';
  }

  function configureAdminActivityWorkspace(subTabId) {
    const mode = subTabId === 'quarterly' ? 'quarterly' : 'featured';
    const tab = document.getElementById('admin-tab-activities');
    const featured = document.getElementById('admin-featured-wrapper');
    const quarterlyEditor = document.getElementById('admin-quarterly-editor-workspace');
    const quarterlyList = document.getElementById('admin-quarterly-list-workspace');
    const editorTitle = document.getElementById('admin-activities-editor-title');
    const editorIcon = document.getElementById('admin-activities-editor-icon');

    if (tab) {
      tab.classList.toggle('activity-featured-mode', mode === 'featured');
      tab.classList.toggle('activity-quarterly-mode', mode === 'quarterly');
    }
    if (featured) featured.style.display = mode === 'featured' ? 'block' : 'none';
    if (quarterlyEditor) quarterlyEditor.style.display = mode === 'quarterly' ? 'block' : 'none';
    if (quarterlyList) quarterlyList.style.display = mode === 'quarterly' ? 'block' : 'none';
    if (editorTitle) editorTitle.innerText = mode === 'quarterly' ? 'กิจกรรมรายไตรมาส (21 พื้นที่)' : 'กิจกรรมเด่นหน้าแรก';
    if (editorIcon) editorIcon.className = mode === 'quarterly' ? 'fas fa-calendar-days' : 'fas fa-star';

    return mode;
  }

  function switchAdminTab(tabId, subTabId) {
    let target = document.getElementById('admin-tab-' + tabId);
    if (!target) {
      const container = document.getElementById('admin-page');
      if (container) {
        showLoading(true);
        fetch('admin.html?v=20260819-institutions-v7-fixed')
          .then(function(res) { return res.text(); })
          .then(function(html) {
            container.innerHTML = html;
            container.setAttribute('data-loaded', 'true');
            showLoading(false);
            switchAdminTab(tabId, subTabId);
          })
          .catch(function() {
            showLoading(false);
          });
        return;
      }
    }

    // Update buttons
    document.querySelectorAll('#admin-page [data-admin-tab]').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('data-admin-tab') === tabId) btn.classList.add('active');
    });
    // Update content
    document.querySelectorAll('#admin-page .admin-tab-content').forEach(function(content) {
      content.classList.remove('active');
    });
    if (target) target.classList.add('active');
    updateAdminWorkspaceHeader(tabId, subTabId);

    // Load data based on tab
    if (tabId === 'stats') loadAdminStats();
    else if (tabId === 'institutions') {
      if (typeof loadAdminInstitutions === 'function') {
        loadAdminInstitutions();
      } else {
        const s = document.createElement('script');
        s.src = 'js/admin/institutions.js?v=20260819-institutions-v7-fixed';
        s.onload = function() {
          if (typeof loadAdminInstitutions === 'function') loadAdminInstitutions();
        };
        document.body.appendChild(s);
      }
    }
    else if (tabId === 'sources') loadAdminSources();
    else if (tabId === 'bases') {
      if (typeof populateAdminBaseSourceOptions === 'function') populateAdminBaseSourceOptions();
      const sourceEl = document.getElementById('admin-base-source-id');
      if (sourceEl && (sourceEl.value || '').trim()) loadAdminBases();
    } else if (tabId === 'quizzes') {
      if (typeof populateAdminQuizSourceOptions === 'function') populateAdminQuizSourceOptions();
      const sourceEl = document.getElementById('admin-quiz-source-id');
      if (sourceEl && (sourceEl.value || '').trim()) loadAdminQuizzes();
      else loadAdminQuizzes();
    } else if (tabId === 'activities') {
      const activityMode = configureAdminActivityWorkspace(subTabId);
      updateAdminWorkspaceHeader(tabId, activityMode);
      loadAdminHomeData();
    } else if (tabId === 'settings') {
      if (typeof loadGlobalSettings === 'function') loadGlobalSettings();
    } else if (tabId === 'upskill') {
      const targetSubTab = subTabId === 'cats' ? 'cats' : 'videos';
      updateAdminWorkspaceHeader(tabId, targetSubTab);
      if (typeof switchAdminUpSkillSubTab === 'function') switchAdminUpSkillSubTab(targetSubTab);
      else if (typeof loadAdminUpSkillVideos === 'function') loadAdminUpSkillVideos();
    }
  }
  window.switchAdminTab = switchAdminTab;
  window.bindAdminPageEvents = bindAdminPageEvents;

  function openAdminWorkspace(tabId, subTabId) {
    if (tabId === 'institutions') {
      window.location.href = 'institutions.html';
      return;
    }
    if (tabId === 'sources') {
      window.location.href = 'sources.html';
      return;
    }
    if (tabId === 'bases') {
      window.location.href = 'bases.html';
      return;
    }
    if (tabId === 'quizzes') {
      window.location.href = 'quizzes.html';
      return;
    }
    if (tabId === 'upskill') {
      window.location.href = 'upskill-admin.html';
      return;
    }
    if (tabId === 'activities') {
      window.location.href = 'activities-admin.html';
      return;
    }
    if (tabId === 'settings') {
      window.location.href = 'settings.html';
      return;
    }
    if (tabId === 'stats') {
      window.location.href = 'stats.html';
      return;
    }
    window.pendingAdminTab = tabId;
    window.pendingAdminSubWorkspace = subTabId || '';
    showPage('admin-page');
  }
  window.openAdminWorkspace = openAdminWorkspace;

  function showAdminSubTab(tabId) {
    openAdminWorkspace(tabId);
  }
  window.showAdminSubTab = showAdminSubTab;

  function loadAdminStats() {
    const areaList = document.getElementById('admin-top-areas-list');
    const filterEl = document.getElementById('admin-stats-tambon-filter');
    const instEl = document.getElementById('admin-stats-institution-filter');
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";

    // จัดการ Dropdown ตามสิทธิ์
    if (role === "teacher") {
       if (filterEl) {
         filterEl.value = localStorage.getItem("userTambon") || "";
         filterEl.disabled = true;
       }
       const container = document.getElementById('admin-stats-filter-container');
       if (container) container.style.display = 'none';
    } else {
       if (filterEl) filterEl.disabled = false;
       const container = document.getElementById('admin-stats-filter-container');
       if (container) container.style.display = 'flex';
       if (instEl) {
         instEl.parentElement.style.display = 'block';
         if (!instEl.getAttribute('data-init')) {
           instEl.setAttribute('data-init', 'true');
           if (userInst && userInst !== 'ALL' && userInst !== 'ทั้งหมด') {
             instEl.value = userInst;
           } else {
             instEl.value = 'ALL';
           }
           onAdminStatsInstitutionChange();
           return;
         }
       }
    }

    const tambonFilter = normalizeTambon((filterEl ? filterEl.value : '') || "ทั้งหมด");
    const isAllTambon = tambonFilter === 'all';

    // ─── ยังไม่เลือกพื้นที่: ไม่โหลด learner list ───
    if (isAllTambon && role !== "teacher") {
      adminLearnersCache = [];
      const learnerContainer = document.getElementById('admin-learner-list');
      if (learnerContainer) {
        learnerContainer.innerHTML = '<div class="text-center text-muted py-4 text-sm"><i class="fas fa-map-pin mr-1" style="color:var(--primary)"></i>เลือกพื้นที่จากช่องด้านบนเพื่อดูรายชื่อผู้เรียน</div>';
      }
      const countEl = document.getElementById('admin-learner-count');
      if (countEl) countEl.innerText = '';
    }

    if (areaList) areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs"><i class="fas fa-circle-notch fa-spin mr-1"></i> กำลังโหลด...</div>';

    const instId = (instEl && instEl.value) ? instEl.value : (userInst || 'ALL');

    apiGet('getAdminDashboardStats', withAuthParams({ tambon: tambonFilter, institutionId: instId }))
      .then(function(res) {
        if (res.status !== "success") {
          areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs">โหลดข้อมูลไม่สำเร็จ</div>';
          return;
        }
        renderAdminDashboardStats(res, isAllTambon, role, areaList);
      }).catch(function(err) {
        console.error("loadAdminStats error:", err);
        areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
      });
  }

  function renderAdminDashboardStats(res, isAllTambon, role, areaList) {
        
        // 1. KPI Cards
        const totalUsersEl = document.getElementById('stat-total-users');
        if (totalUsersEl) totalUsersEl.innerText = Number(res.totalUsers || 0).toLocaleString();
        
        const totalCertsEl = document.getElementById('stat-total-certs');
        if (totalCertsEl) totalCertsEl.innerText = Number(res.totalCerts || 0).toLocaleString();

        const totalScoreEl = document.getElementById('stat-total-score');
        if (totalScoreEl) totalScoreEl.innerText = Number(res.totalScore || 0).toLocaleString();

        const avgSatEl = document.getElementById('stat-avg-satisfaction');
        if (avgSatEl) avgSatEl.innerText = res.avgSatisfaction || "0.0";

        const ratingCountEl = document.getElementById('stat-rating-count');
        if (ratingCountEl) ratingCountEl.innerText = "จาก " + (res.totalRatings || 0) + " การประเมิน";

        const pendingPropEl = document.getElementById('stat-pending-proposals');
        if (pendingPropEl) pendingPropEl.innerText = res.pendingProposals || 0;

        // 2. มาตรา 6 Stats
        const evalStats = res.evaluationStats || { totalSources: 0, evaluatedCount: 0, avgScore: 0, grades: {} };
        const totalSourcesEl = document.getElementById('stat-total-sources');
        if (totalSourcesEl) totalSourcesEl.innerText = Number(evalStats.totalSources || 0).toLocaleString();

        const evalTotalSourcesEl = document.getElementById('eval-stat-total-sources');
        if (evalTotalSourcesEl) evalTotalSourcesEl.innerText = evalStats.totalSources || 0;

        const evalCountEl = document.getElementById('eval-stat-evaluated-count');
        if (evalCountEl) evalCountEl.innerText = evalStats.evaluatedCount || 0;

        const evalAvgScoreEl = document.getElementById('eval-stat-avg-score');
        if (evalAvgScoreEl) evalAvgScoreEl.innerText = evalStats.avgScore || "0.0";
        const evalAvgScoreBadgeEl = document.getElementById('eval-stat-avg-score-badge');
        if (evalAvgScoreBadgeEl) evalAvgScoreBadgeEl.innerText = evalStats.avgScore || "0.0";

        const grades = evalStats.grades || {};
        const totalEval = evalStats.evaluatedCount || 1;
        
        const excellentCount = grades['ดีมาก'] || 0;
        const elExc = document.getElementById('eval-count-excellent');
        if (elExc) elExc.innerText = excellentCount + ' แหล่ง';
        const barExc = document.getElementById('eval-bar-excellent');
        if (barExc) barExc.style.width = Math.min(100, (excellentCount / totalEval * 100)) + '%';

        const goodCount = grades['ดี'] || 0;
        const elGood = document.getElementById('eval-count-good');
        if (elGood) elGood.innerText = goodCount + ' แหล่ง';
        const barGood = document.getElementById('eval-bar-good');
        if (barGood) barGood.style.width = Math.min(100, (goodCount / totalEval * 100)) + '%';

        const fairCount = grades['พอใช้'] || 0;
        const elFair = document.getElementById('eval-count-fair');
        if (elFair) elFair.innerText = fairCount + ' แหล่ง';
        const barFair = document.getElementById('eval-bar-fair');
        if (barFair) barFair.style.width = Math.min(100, (fairCount / totalEval * 100)) + '%';

        const needsImpCount = grades['ควรปรับปรุง'] || 0;
        const elNeeds = document.getElementById('eval-count-needs-imp');
        if (elNeeds) elNeeds.innerText = needsImpCount + ' แหล่ง';
        const barNeeds = document.getElementById('eval-bar-needs-imp');
        if (barNeeds) barNeeds.style.width = Math.min(100, (needsImpCount / totalEval * 100)) + '%';

        const urgentImpCount = grades['ต้องปรับปรุง'] || 0;
        const elUrgent = document.getElementById('eval-count-urgent-imp');
        if (elUrgent) elUrgent.innerText = urgentImpCount + ' แหล่ง';
        const barUrgent = document.getElementById('eval-bar-urgent-imp');
        if (barUrgent) barUrgent.style.width = Math.min(100, (urgentImpCount / totalEval * 100)) + '%';

        // 3. Render Executive Area Comparison Breakdown Table (ตารางสรุปรายตำบล)
        const areaTable = Array.isArray(res.areaComparisonTable) ? res.areaComparisonTable : [];
        const execTbody = document.getElementById('exec-area-comparison-tbody');
        const execTableCountEl = document.getElementById('exec-table-total-count');
        if (execTableCountEl) execTableCountEl.innerText = areaTable.length + ' พื้นที่';

        if (execTbody) {
          if (areaTable.length === 0) {
            execTbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-muted">ยังไม่มีข้อมูลสถิติเปรียบเทียบในพื้นที่นี้</td></tr>';
          } else {
            let tHtml = '';
            areaTable.forEach(function(row, idx) {
              let rankBadge = '';
              if (idx === 0) rankBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-500/20 text-yellow-500 border border-yellow-500/30">🥇 อันดับ 1</span>';
              else if (idx === 1) rankBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-400/20 text-gray-300 border border-gray-400/30">🥈 อันดับ 2</span>';
              else if (idx === 2) rankBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-700/20 text-amber-600 border border-amber-700/30">🥉 อันดับ 3</span>';
              else rankBadge = '<span class="text-muted font-bold text-xs">#' + (idx + 1) + '</span>';

              const progressBadge = row.usersCount >= 5 
                ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">เติบโตโดดเด่น</span>'
                : '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-500 border border-blue-500/30">กำลังขยายตัว</span>';

              tHtml += '<tr class="hover:bg-white/5 transition-colors">' +
                         '<td class="py-3 px-3">' + rankBadge + '</td>' +
                         '<td class="py-3 px-3 font-bold text-theme-inv">' + escapeHtml(row.tambon) + '</td>' +
                         '<td class="py-3 px-3 text-center font-semibold text-theme-inv">' + Number(row.usersCount).toLocaleString() + ' คน</td>' +
                         '<td class="py-3 px-3 text-center font-semibold text-blue-500">' + Number(row.sourcesCount).toLocaleString() + ' แห่ง</td>' +
                         '<td class="py-3 px-3 text-center font-semibold text-amber-500">' + Number(row.certsCount).toLocaleString() + ' ใบ</td>' +
                         '<td class="py-3 px-3 text-right font-black text-purple-500">' + Number(row.totalScore).toLocaleString() + ' แต้ม</td>' +
                         '<td class="py-3 px-3 text-center">' + progressBadge + '</td>' +
                       '</tr>';
            });
            execTbody.innerHTML = tHtml;
          }
        }

        // 4. Render Visual Charts & Progress Bars
        const sourcesByTambon = res.sourcesByTambon || {};
        const sourcesTotal = Object.values(sourcesByTambon).reduce(function(a,b){return a+b;}, 0);
        const execSourcesTotalEl = document.getElementById('exec-chart-sources-total');
        if (execSourcesTotalEl) execSourcesTotalEl.innerText = sourcesTotal + ' แหล่ง';

        const fallbackSources = document.getElementById('fallback-sources-chart');
        if (fallbackSources) {
          const sEntries = Object.entries(sourcesByTambon).sort(function(a,b){return b[1]-a[1];}).slice(0, 10);
          const maxS = sEntries.length > 0 ? sEntries[0][1] : 1;
          fallbackSources.innerHTML = sEntries.map(function(e) {
            const pct = Math.max(6, (e[1] / maxS * 100)).toFixed(0);
            return '<div class="space-y-1 p-1.5 rounded-lg" style="background:var(--bg); border:1px solid var(--card-border);">' +
                     '<div class="flex justify-between text-xs">' +
                       '<span class="text-theme-inv font-medium">' + escapeHtml(e[0]) + '</span>' +
                       '<span class="font-bold text-blue-500">' + e[1] + ' แห่ง</span>' +
                     '</div>' +
                     '<div class="w-full bg-black/5 dark:bg-white/5 rounded-full h-2 overflow-hidden">' +
                       '<div class="h-full rounded-full" style="width:' + pct + '%; background:linear-gradient(90deg, #3b82f6, #1d4ed8);"></div>' +
                     '</div>' +
                   '</div>';
          }).join('') || '<div class="text-center text-muted py-4 text-xs">ไม่มีข้อมูลแหล่งเรียนรู้</div>';
        }

        const scoresByTambon = res.scoresByTambon || {};
        const scoresTotal = Object.values(scoresByTambon).reduce(function(a,b){return a+b;}, 0);
        const execScoresTotalEl = document.getElementById('exec-chart-scores-total');
        if (execScoresTotalEl) execScoresTotalEl.innerText = Number(scoresTotal).toLocaleString() + ' แต้ม';

        const fallbackScores = document.getElementById('fallback-scores-chart');
        if (fallbackScores) {
          const scEntries = Object.entries(scoresByTambon).sort(function(a,b){return b[1]-a[1];}).slice(0, 10);
          const maxSc = scEntries.length > 0 ? scEntries[0][1] : 1;
          fallbackScores.innerHTML = scEntries.map(function(e) {
            const pct = Math.max(6, (e[1] / maxSc * 100)).toFixed(0);
            return '<div class="space-y-1 p-1.5 rounded-lg" style="background:var(--bg); border:1px solid var(--card-border);">' +
                     '<div class="flex justify-between text-xs">' +
                       '<span class="text-theme-inv font-medium">' + escapeHtml(e[0]) + '</span>' +
                       '<span class="font-bold text-yellow-500">' + Number(e[1]).toLocaleString() + ' แต้ม</span>' +
                     '</div>' +
                     '<div class="w-full bg-black/5 dark:bg-white/5 rounded-full h-2 overflow-hidden">' +
                       '<div class="h-full rounded-full" style="width:' + pct + '%; background:linear-gradient(90deg, #f59e0b, #d97706);"></div>' +
                     '</div>' +
                   '</div>';
          }).join('') || '<div class="text-center text-muted py-4 text-xs">ไม่มีข้อมูลคะแนนสะสม</div>';
        }

        const levelCounts = res.levelCounts || {};
        const rankLabels = ['ระดับ 1 (ต้น)', 'ระดับ 2 (กลาง)', 'ระดับ 3 (ก้าวหน้า)', 'ระดับ 4 (เชี่ยวชาญ)', 'ระดับ 5 (ต้นแบบ)', 'ระดับ 6 (Glorious)'];
        const rankColors = ['#94a3b8', '#34d399', '#10b981', '#059669', '#064e3b', '#fbbf24'];
        const rankTotal = Object.values(levelCounts).reduce(function(a,b){return a+b;}, 0);
        const execRankTotalEl = document.getElementById('exec-chart-rank-total');
        if (execRankTotalEl) execRankTotalEl.innerText = rankTotal + ' คน';

        const fallbackRanks = document.getElementById('fallback-ranks-legend');
        if (fallbackRanks) {
          fallbackRanks.innerHTML = rankLabels.map(function(lbl, idx) {
            const lvlNum = idx + 1;
            const cnt = levelCounts[lvlNum] || levelCounts[String(lvlNum)] || 0;
            const pct = rankTotal > 0 ? Math.round((cnt / rankTotal) * 100) : 0;
            return '<div class="space-y-1.5 p-2 rounded-xl" style="background:var(--bg); border:1px solid var(--card-border);">' +
                     '<div class="flex items-center justify-between text-xs">' +
                       '<span class="flex items-center gap-2 font-bold text-theme-inv">' +
                         '<span class="w-3 h-3 rounded-full flex-shrink-0" style="background:' + rankColors[idx] + '"></span>' +
                         lbl +
                       '</span>' +
                       '<span class="font-black text-theme-inv">' + cnt + ' คน <span class="text-muted text-[10px]">(' + pct + '%)</span></span>' +
                     '</div>' +
                     '<div class="w-full bg-black/5 dark:bg-white/5 rounded-full h-2 overflow-hidden">' +
                       '<div class="h-full rounded-full transition-all duration-500" style="width:' + Math.max(cnt > 0 ? 5 : 0, pct) + '%; background:' + rankColors[idx] + ';"></div>' +
                     '</div>' +
                   '</div>';
          }).join('');
        }

        // โหลด learner เฉพาะเมื่อเลือกพื้นที่เฉพาะ
        if (!isAllTambon || role === "teacher") {
          adminLearnersCache = res.learners || [];
          renderAdminLearnerList();
          const learnerDetail = document.getElementById('admin-learner-detail');
          if (learnerDetail) learnerDetail.innerHTML = 'เลือกผู้เรียนจากรายการด้านซ้ายเพื่อดูข้อมูลทั้งหมด';
        }
        
        if (res.topAreas && res.topAreas.length > 0) {
          let html = '';
          const maxCount = res.topAreas[0].count;
          res.topAreas.forEach(function(area) {
            const pct = (area.count / maxCount * 100).toFixed(0);
            html += '<div class="space-y-1">' +
                      '<div class="flex justify-between text-xs">' +
                        '<span class="text-theme-inv font-semibold">' + area.name + '</span>' +
                        '<span class="text-muted">' + area.count + ' คน</span>' +
                      '</div>' +
                      '<div class="w-full bg-black/5 rounded-full h-1.5 overflow-hidden" style="background:rgba(0,0,0,0.05);">' +
                        '<div class="bg-primary h-full" style="width:' + pct + '%; background:var(--primary);"></div>' +
                      '</div>' +
                    '</div>';
          });
          areaList.innerHTML = html;
        } else {
          areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs">ยังไม่มีข้อมูลสถิติ</div>';
        }
        if (!isAllTambon || role === "teacher") {
          adminLearnersCache = [];
          renderAdminLearnerList();
        }
  }
  window.loadAdminStats = loadAdminStats;

  function onAdminStatsInstitutionChange() {
    const instEl = document.getElementById('admin-stats-institution-filter');
    const tambonEl = document.getElementById('admin-stats-tambon-filter');
    const instId = instEl ? instEl.value : 'ALL';

    if (tambonEl) {
      const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(instId) : [];
      let label = (instId === 'INS_MAERIM' ? 'แม่ริมทั้งหมด' : (instId === 'INS_PHRAO' ? 'พร้าวทั้งหมด' : 'รวมทุกสถานศึกษา'));
      let html = '<option value="ทั้งหมด" selected>🌍 ทุกสถานศึกษาในสังกัด (' + label + ')</option>';
      subUnits.forEach(function(u) {
        html += '<option value="' + u + '">' + u + '</option>';
      });
      tambonEl.innerHTML = html;
      tambonEl.value = "ทั้งหมด";
    }
    loadAdminStats();
  }
  window.onAdminStatsInstitutionChange = onAdminStatsInstitutionChange;

  function renderAdminLearnerList() {
    const container = document.getElementById('admin-learner-list');
    const countEl = document.getElementById('admin-learner-count');
    if (!container) return;
    const keywordEl = document.getElementById('admin-learner-search');
    const keyword = ((keywordEl && keywordEl.value) || '').trim().toLowerCase();
    let list = adminLearnersCache || [];
    if (keyword) {
      list = list.filter(function(item) {
        return [item.fullName, item.username, item.phone, item.tambon, item.level].join(' ').toLowerCase().indexOf(keyword) > -1;
      });
    }
    if (countEl) countEl.innerText = list.length + ' คน';
    if (!list.length) {
      container.innerHTML = '<div class="text-center text-muted py-3">ไม่พบรายชื่อผู้เรียน</div>';
      return;
    }

    let html = '';
    list.forEach(function(item) {
      const learnerId = item.username || item.phone || '';
      const image = item.image || '';
      const rawName = item.fullName || item.name || item.username || item.phone || '-';
      const displayName = (rawName === 'undefined' || !rawName) ? (item.username || item.phone || '-') : rawName;
      const activeClass = learnerId === activeAdminLearnerId ? ' active' : '';
      html += '<button type="button" class="admin-learner-row' + activeClass + '" data-learner-id="' + escapeHtml(learnerId) + '" onclick="openAdminLearnerDetail(\'' + escapeJS(learnerId) + '\')">' +
                '<div class="admin-learner-avatar" style="' + (image ? ('background-image:url(\'' + escapeHtml(image) + '\')') : '') + '">' +
                  (image ? '' : '<i class="fas fa-user"></i>') +
                '</div>' +
                '<div class="admin-learner-main">' +
                  '<div class="admin-learner-name">' + escapeHtml(displayName) + '</div>' +
                  '<div class="admin-learner-sub">' + escapeHtml(item.tambon || '-') + ' | ' + escapeHtml(item.phone || item.username || '-') + '</div>' +
                '</div>' +
                '<div class="admin-learner-score">' +
                  '<strong>' + (Number(item.score) || 0) + '</strong>' +
                  '<span>' + escapeHtml(item.level || 'คะแนน') + '</span>' +
                '</div>' +
              '</button>';
    });
    container.innerHTML = html;
  }

  function renderAdminDetailSection(title, icon, items, renderer) {
    let html = '<div class="admin-learner-detail-section">';
    html += '<h5><i class="fas ' + icon + '"></i> ' + title + ' <span>' + ((items && items.length) || 0) + '</span></h5>';
    if (!items || !items.length) {
      html += '<div class="text-muted text-xs py-2">ยังไม่มีข้อมูล</div>';
    } else {
      html += items.slice(0, 20).map(renderer).join('');
    }
    html += '</div>';
    return html;
  }

  function ensureAdminLearnerDetailTarget() {
    const inlineDetail = document.getElementById('admin-learner-detail');
    if (inlineDetail) return { detail: inlineDetail, inModal: false };

    let modal = document.getElementById('admin-learner-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'admin-learner-detail-modal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML =
        '<div class="loft-card admin-learner-detail-modal-card">' +
          '<div class="flex items-center justify-between gap-2 mb-3">' +
            '<h3 class="font-black text-theme-inv"><i class="fas fa-id-card mr-1" style="color:var(--gold)"></i>ข้อมูลผู้เรียน</h3>' +
            '<button type="button" class="admin-learner-modal-close" onclick="closeAdminLearnerDetailModal()" aria-label="ปิด">&times;</button>' +
          '</div>' +
          '<div id="admin-learner-detail-modal-body"></div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function(event) {
        if (event.target === modal) closeAdminLearnerDetailModal();
      });
    }
    modal.style.display = 'flex';
    return { detail: document.getElementById('admin-learner-detail-modal-body'), inModal: true };
  }

  function closeAdminLearnerDetailModal() {
    const modal = document.getElementById('admin-learner-detail-modal');
    if (modal) modal.style.display = 'none';
  }

  function openAdminLearnerDetail(username) {
    const target = ensureAdminLearnerDetailTarget();
    const detail = target.detail;
    if (!detail || !username) return;
    activeAdminLearnerId = username || '';
    renderAdminLearnerList();
    detail.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-circle-notch fa-spin mr-1"></i> กำลังโหลดข้อมูลผู้เรียน...</div>';
    apiGet('getAdminLearnerDetail', withAuthParams({ targetUsername: username }))
      .then(function(res) {
        if (!res || res.status !== "success") {
          detail.innerHTML = '<div class="text-center text-danger py-4">' + escapeHtml((res && res.message) || 'โหลดข้อมูลไม่สำเร็จ') + '</div>';
          return;
        }
        const p = res.profile || {};
        const s = res.summary || {};
        const rawProfileImage = p.profileImage || p.profileimage || p.image || '';
        const profileImage = typeof getValidImageUrl === 'function' ? getValidImageUrl(rawProfileImage) : rawProfileImage;
        const profileName = p.fullName || p.fullname || p.name || p.username || '-';
        const profileScore = p.score || p.totalScore || p.totalscore || 0;
        let html = '<div class="admin-learner-profile-head">';
        html += '<div class="admin-learner-avatar large" style="' + (profileImage ? ('background-image:url(\'' + escapeHtml(profileImage) + '\')') : '') + '">' + (profileImage ? '' : '<i class="fas fa-user"></i>') + '</div>';
        html += '<div><div class="admin-learner-detail-name">' + escapeHtml(profileName) + '</div>';
        html += '<div class="text-muted text-xs">' + escapeHtml(p.tambon || '-') + ' | ' + escapeHtml(p.phone || p.username || '-') + '</div>';
        html += '<div class="text-muted text-xs">ระดับ: ' + escapeHtml(p.level || '-') + ' | คะแนนสะสม: ' + (Number(profileScore) || 0) + '</div></div>';
        html += '</div>';

        html += '<div class="admin-learner-summary-grid">';
        html += '<div><b>' + (Number(s.passedQuizCount) || 0) + '</b><span>สอบผ่าน</span></div>';
        html += '<div><b>' + (Number(s.certCount) || 0) + '</b><span>ใบเกียรติบัตร</span></div>';
        html += '<div><b>' + (Number(s.logCount) || 0) + '</b><span>บันทึกเรียนรู้</span></div>';
        html += '<div><b>' + (Number(s.couponCount) || 0) + '</b><span>คูปอง</span></div>';
        html += '<div><b>' + (Number(s.checkInCount) || 0) + '</b><span>เช็กอิน</span></div>';
        html += '<div><b>' + (Number(s.nfeHours) || 0) + '</b><span>ชั่วโมง กพช.</span></div>';
        html += '</div>';

        html += renderAdminDetailSection('ประวัติแบบทดสอบ', 'fa-clipboard-check', res.quizzes, function(q) {
          return '<div class="admin-learner-detail-row"><b>' + escapeHtml(q.sourceId || '-') + '</b><span>' + escapeHtml(q.score || '-') + ' | ' + escapeHtml(q.status || '-') + ' | ' + escapeHtml(q.date || '') + '</span>' + (q.certUrl ? '<a href="' + escapeHtml(q.certUrl) + '" target="_blank">เปิดใบเกียรติบัตร</a>' : '') + '</div>';
        });
        html += renderAdminDetailSection('บันทึกการเรียนรู้', 'fa-book', res.learningLogs, function(log) {
          return '<div class="admin-learner-detail-row"><b>' + escapeHtml(log.activityName || '-') + '</b><span>' + escapeHtml(log.status || '-') + ' | +' + (Number(log.score) || 0) + ' | ' + escapeHtml(log.date || '') + '</span></div>';
        });
        html += renderAdminDetailSection('ประวัติคะแนน', 'fa-coins', res.points, function(tx) {
          return '<div class="admin-learner-detail-row"><b>' + escapeHtml(tx.description || tx.type || '-') + '</b><span>' + (Number(tx.points) || 0) + ' คะแนน | ' + escapeHtml(tx.date || '') + '</span></div>';
        });
        html += renderAdminDetailSection('คูปอง', 'fa-ticket', res.coupons, function(c) {
          return '<div class="admin-learner-detail-row"><b>' + escapeHtml(c.productName || c.code || '-') + '</b><span>' + escapeHtml(c.status || '-') + ' | ' + (Number(c.cost) || 0) + ' คะแนน | ' + escapeHtml(c.date || '') + '</span></div>';
        });
        html += renderAdminDetailSection('เช็กอินแหล่งเรียนรู้', 'fa-map-marker-alt', res.sourceCheckIns, function(ci) {
          return '<div class="admin-learner-detail-row"><b>' + escapeHtml(ci.sourceId || '-') + '</b><span>+' + (Number(ci.points) || 0) + ' | ' + escapeHtml(ci.date || '') + '</span></div>';
        });
        html += renderAdminDetailSection('เช็กอินกิจกรรม', 'fa-calendar-check', res.activityCheckIns, function(ci) {
          return '<div class="admin-learner-detail-row"><b>' + escapeHtml(ci.activityName || ci.activityId || '-') + '</b><span>+' + (Number(ci.points) || 0) + ' | ' + escapeHtml(ci.date || '') + '</span></div>';
        });
        html += renderAdminDetailSection('กพช.', 'fa-clock', res.nfe, function(n) {
          return '<div class="admin-learner-detail-row"><b>' + (Number(n.hours) || 0) + ' ชั่วโมง</b><span>' + escapeHtml(n.status || '-') + ' | ใช้ ' + (Number(n.pointsSpent) || 0) + ' คะแนน | ' + escapeHtml(n.date || '') + '</span></div>';
        });

        detail.innerHTML = html;
        const card = document.getElementById('admin-learner-detail-card');
        if (card && window.matchMedia && !window.matchMedia('(min-width: 1024px)').matches) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }).catch(function() {
        detail.innerHTML = '<div class="text-center text-danger py-4">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>';
      });
  }

  window.renderAdminLearnerList = renderAdminLearnerList;
  window.openAdminLearnerDetail = openAdminLearnerDetail;
  window.closeAdminLearnerDetailModal = closeAdminLearnerDetailModal;

  function showLoading(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }

  function toggleTheme() {
    // Legacy function, replaced by theme picker
    openThemePicker();
  }

  function openThemePicker() {
    document.getElementById('theme-picker-modal').style.display = 'flex';
  }

  function closeThemePicker() {
    document.getElementById('theme-picker-modal').style.display = 'none';
  }

  function changeFontSize(size) {
    const html = document.documentElement;
    html.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
    html.classList.add('font-size-' + size);
    
    localStorage.setItem('loft_font_size', size);
    
    document.querySelectorAll('.font-size-btn').forEach(function(btn) {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector('.font-size-btn.btn-sz-' + size);
    if (activeBtn) activeBtn.classList.add('active');
  }
  window.changeFontSize = changeFontSize;

  function rgbToHex(rgb) {
    if (!rgb) return "";
    if (rgb.startsWith('#')) return rgb;
    var match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return rgb;
    function hex(x) {
      return ("0" + parseInt(x).toString(16)).slice(-2);
    }
    return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
  }

  function updateThemeSelectorUI() {
    const isDark = localStorage.getItem('appTheme') === 'dark';
    const primaryColor = localStorage.getItem('appPrimaryColor') || '#10b981';

    // Update switch
    const sw = document.getElementById('dark-mode-switch');
    if (sw) sw.checked = isDark;

    // Update icon
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      if (isDark) {
        icon.className = "fas fa-moon";
        icon.style.color = "var(--primary)";
      } else {
        icon.className = "fas fa-sun";
        icon.style.color = "#fbbf24";
      }
    }

    // Update color dots active state
    document.querySelectorAll('.theme-dot-btn').forEach(function(btn) {
      if (btn.classList.contains('custom-color-trigger')) return;
      
      const btnStyleColor = btn.style.getPropertyValue('--dot-color').trim().toLowerCase();
      const normBtnColor = btnStyleColor.startsWith('#') ? btnStyleColor : rgbToHex(btn.style.backgroundColor);
      const normPrimary = primaryColor.toLowerCase();
      
      const isActive = (normBtnColor === normPrimary);
      btn.classList.toggle('active', isActive);
    });
  }
  window.updateThemeSelectorUI = updateThemeSelectorUI;

  function applyAppTheme(primaryColor, bgColor, isDark) {
    const root = document.documentElement;
    root.style.setProperty('--primary', primaryColor);
    root.style.setProperty('--primary-light', primaryColor + '40');
    root.style.setProperty('--primary-color', primaryColor);
    root.style.setProperty('--blue-app', primaryColor);
    
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    if (bgColor) {
      root.style.setProperty('--bg', bgColor);
      root.style.setProperty('--bg-color', bgColor);
      if (!isDark) {
        root.style.setProperty('--nav-bg', 'rgba(255,255,255,0.95)');
      } else {
        root.style.setProperty('--nav-bg', bgColor);
      }
    }
    
    localStorage.setItem('appPrimaryColor', primaryColor);
    if (bgColor) localStorage.setItem('appBgColor', bgColor);
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light');
    
    const picker = document.getElementById('custom-color-picker');
    if (picker) picker.value = primaryColor;
    
    updateThemeSelectorUI();
  }
  window.applyAppTheme = applyAppTheme;

  function toggleDarkMode(isDark) {
    const primaryColor = localStorage.getItem('appPrimaryColor') || '#10b981';
    const bgColor = isDark ? '#020617' : '#f8fafc';
    applyAppTheme(primaryColor, bgColor, isDark);
  }
  window.toggleDarkMode = toggleDarkMode;

  function changeThemeColor(hexColor) {
    const isDark = localStorage.getItem('appTheme') === 'dark';
    const bgColor = isDark ? '#020617' : '#f8fafc';
    applyAppTheme(hexColor, bgColor, isDark);
  }
  window.changeThemeColor = changeThemeColor;

  function applyCustomTheme(hexColor) {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const isDark = brightness < 128;
    
    let bgColor;
    if (isDark) {
      const darkR = Math.floor(r * 0.1);
      const darkG = Math.floor(g * 0.1);
      const darkB = Math.floor(b * 0.1);
      bgColor = `#${darkR.toString(16).padStart(2,'0')}${darkG.toString(16).padStart(2,'0')}${darkB.toString(16).padStart(2,'0')}`;
    } else {
      bgColor = '#f8fafc';
    }
    
    applyAppTheme(hexColor, bgColor, isDark);
  }
  window.applyCustomTheme = applyCustomTheme;



  function submitLog() {
    const activity = document.getElementById('log-activity-name').value;
    const desc = document.getElementById('log-description').value;
    const externalLink = document.getElementById('log-external-link').value;
    if(!activity || !desc) return showCustomAlert("กรุณากรอกชื่อกิจกรรมและรายละเอียดให้ครบถ้วน", "warning");

    showLoading(true);
    const data = {
      phone: localStorage.getItem("userPhone"),
      tambon: localStorage.getItem("userTambon"),
      activityName: activity,
      description: desc,
      externalLink: externalLink
    };

    apiPost('submitLog', withAuthData(data))
      .then(function(res) {
        showLoading(false);
        if(res.status === "success") {
          showCustomAlert(res.message, "success");
          document.getElementById('log-activity-name').value = '';
          document.getElementById('log-description').value = '';
          document.getElementById('log-external-link').value = '';
          loadMyLogs(1);
        } else { showCustomAlert("เกิดข้อผิดพลาด", "error"); }
      }).catch(function() { showLoading(false); showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
  }

  function loadMyLogs(page) {
    const phone = localStorage.getItem("userPhone");
    const startDate = document.getElementById('log-start-date').value;
    const endDate = document.getElementById('log-end-date').value;
    
    document.getElementById('log-history-container').innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    apiGet('getUserLogs', withAuthParams({ phone: phone, page: page, startDate: startDate, endDate: endDate }))
      .then(function(res) {
        currentLogPage = res.currentPage;
        totalLogPages = res.totalPages || 1;
        renderMyLogs(res.data);
        document.getElementById('log-page-info').innerText = 'หน้า ' + currentLogPage + ' / ' + totalLogPages;
        document.getElementById('btn-log-prev').disabled = currentLogPage <= 1;
        document.getElementById('btn-log-next').disabled = currentLogPage >= totalLogPages;
      }).catch(function() {
        document.getElementById('log-history-container').innerHTML = '<div class="text-center text-muted">โหลดไม่สำเร็จ</div>';
      });
  }

  function changeLogPage(direction) {
    let newPage = currentLogPage + direction;
    if (newPage >= 1 && newPage <= totalLogPages) {
      loadMyLogs(newPage);
    }
  }

  function renderMyLogs(logs) {
    const container = document.getElementById('log-history-container');
    if(logs.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-3">ไม่พบประวัติในระบบ/ช่วงเวลานี้</div>';
        return;
    }
    
    let html = '';
    logs.forEach(function(log) {
      let statusClass = log.status === "Approved" ? "status-approved" : (log.status === "Rejected" ? "status-rejected" : "status-pending");
      let statusText = log.status === "Approved" ? "✅ ผ่าน (" + log.score + " แต้ม)" : (log.status === "Rejected" ? "❌ ไม่ผ่าน" : "⏳ รอตรวจ");
      
      html += '<div class="log-card">' +
                 '<div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:5px;">' +
                   '<div class="log-title">' + log.activityName + '</div>' +
                   '<div class="status-badge ' + statusClass + '">' + statusText + '</div>' +
                 '</div>' +
                 '<div class="text-muted small mb-2"><i class="far fa-calendar-alt"></i> ' + log.date + '</div>' +
                 '<div class="log-desc">' + log.description + '</div>';
                 
      if (log.externalLink) {
        html += '<div class="mt-2 text-xs"><a href="' + log.externalLink + '" target="_blank" style="color:var(--peach); font-weight:bold; display:inline-flex; align-items:center; gap:5px;"><i class="fas fa-external-link-alt"></i> ดูลิงก์อ้างอิง/หลักฐาน</a></div>';
      }
      if (log.note) { html += '<div class="mt-2 p-2" style="background:var(--bg2); border-radius:5px; font-size:0.85rem; border-left:3px solid var(--primary); color: var(--text);"><b><i class="fas fa-comment-dots mr-1" style="color:var(--primary)"></i> ข้อเสนอแนะจากครู:</b> ' + log.note + '</div>'; }
      html += '</div>';
    });
    container.innerHTML = html;
  }

  function loadPendingLogs() {
    const role = localStorage.getItem("userRole");
    const tambon = localStorage.getItem("userTambon") || "ไม่ระบุ";
    
    if (role === 'admin') {
      document.getElementById('teacher-tambon-badge').innerText = "ทุกพื้นที่ (Admin)";
    } else {
      document.getElementById('teacher-tambon-badge').innerText = formatTambon(tambon);
    }
    
    const requestedTab = window.pendingApproveTab || 'logs';
    delete window.pendingApproveTab;
    switchApproveTab(requestedTab);
  }

  const APPROVAL_WORKSPACE_META = {
    logs: { title: 'ตรวจบันทึกกิจกรรม', description: 'อนุมัติบันทึกกิจกรรมและให้คะแนนผู้เรียน', icon: 'fa-list-check' },
    videologs: { title: 'ตรวจบันทึกอัพสกิล', description: 'ตรวจบันทึกหลังดูวิดีโอและให้คะแนนผลงาน', icon: 'fa-book-open' },
    proposals: { title: 'ข้อเสนอแนะผู้เรียน', description: 'พิจารณาความต้องการและข้อเสนอกิจกรรม', icon: 'fa-lightbulb' },
    nfe: { title: 'รายงานและอนุมัติชั่วโมง กพช.', description: 'ตรวจรายการแลกชั่วโมง อนุมัติ และส่งออกรายงาน', icon: 'fa-clock' }
  };

  function updateApprovalWorkspaceHeader(tabName) {
    const meta = APPROVAL_WORKSPACE_META[tabName] || APPROVAL_WORKSPACE_META.logs;
    const title = document.getElementById('approve-workspace-title');
    const description = document.getElementById('approve-workspace-description');
    const icon = document.getElementById('approve-workspace-icon');
    if (title) title.innerText = meta.title;
    if (description) description.innerText = meta.description;
    if (icon) icon.className = 'fas ' + meta.icon + ' mr-2';
  }

  function openApprovalWorkspace(tabName) {
    window.location.href = 'approvals.html?tab=' + (tabName || 'logs');
  }
  window.openApprovalWorkspace = openApprovalWorkspace;

  function switchApproveTab(tabName) {
    document.querySelectorAll('.approve-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('#approve-page .admin-tab-btn').forEach(b => {
      b.classList.remove('active');
      if (b.getAttribute('data-approve-tab') === tabName) b.classList.add('active');
    });
    
    const target = document.getElementById('approve-tab-' + tabName);
    if (target) target.style.display = 'block';
    updateApprovalWorkspaceHeader(tabName);

    if (tabName === 'logs') {
      fetchPendingLogs();
    } else if (tabName === 'videologs') {
      if (typeof loadAdminLearningLogs === 'function') loadAdminLearningLogs('pending');
    } else if (tabName === 'proposals') {
      loadPendingProposals();
    } else if (tabName === 'nfe') {
      if (typeof loadNFEAdminReport === 'function') loadNFEAdminReport();
    }
  }

  function fetchPendingLogs() {
    const role = localStorage.getItem("userRole");
    let tambon = localStorage.getItem("userTambon");
    
    // ถ้าเป็น Admin ให้ส่ง "ทั้งหมด" เพื่อดึงงานทุกพื้นที่
    if (role === 'admin') tambon = "ทั้งหมด";

    const container = document.getElementById('pending-list-container');
    container.innerHTML = '<div class="text-center text-muted mt-5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    apiGet('getPendingLogs', withAuthParams({ tambon: tambon }))
      .then(function(logs) {
        if (logs && logs.status === "error") {
          container.innerHTML = '<div class="text-center text-muted mt-5">' + (logs.message || 'ไม่มีสิทธิ์เข้าถึงข้อมูล') + '</div>';
          return;
        }
        if (logs.length === 0) {
            const msg = (role === 'admin') ? "ไม่มีงานค้างตรวจในระบบครับ" : "ไม่มีงานค้างตรวจในตำบลของคุณครับ";
            container.innerHTML = '<div class="text-center text-muted mt-5"><i class="fas fa-check-circle text-success fa-2x mb-3"></i><br>' + msg + '</div>';
            return;
        }
        let html = '';
        logs.forEach(function(log) {
          let areaTag = formatTambon(log.tambon);
          html += '<div class="log-card">' +
                     '<div class="log-title">' + (log.fullName || 'ไม่ระบุชื่อ') + '</div>' +
                     '<div class="text-muted small mb-2">' +
                       '<i class="fas fa-book"></i> กิจกรรม: ' + log.activityName + '<br>' +
                       '<i class="fas fa-map-marker-alt"></i> ' + areaTag + ' | <i class="fas fa-calendar-alt"></i> ' + log.date + 
                     '</div>' +
                     '<div class="log-desc mb-3" style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">' + log.description + '</div>' +
                     '<button class="btn-primary w-100" style="background-color: var(--primary-color);" onclick="openReviewModal(\'' + escapeJS(log.logId) + '\', \'' + escapeJS(log.phone) + '\', \'' + escapeJS(log.activityName) + '\', \'' + escapeJS(log.fullName || 'ไม่ระบุชื่อ') + '\', \'' + escapeJS(areaTag) + '\', \'' + escapeJS(log.description || '') + '\', \'' + escapeJS(log.externalLink || '') + '\')">' +
                       '<i class="fas fa-pen"></i> ประเมินผลงาน' +
                     '</button>' +
                   '</div>';
        });
        container.innerHTML = html;
      }).catch(function() {
        container.innerHTML = '<div class="text-center text-muted mt-5">โหลดไม่สำเร็จ</div>';
      });
  }

  function loadPendingProposals() {
    const container = document.getElementById('pending-proposals-container');
    container.innerHTML = '<div class="text-center text-muted mt-5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    apiGet('getPendingProposals', withAuthParams({}))
      .then(function(proposals) {
        if (proposals && proposals.status === "error") {
          container.innerHTML = '<div class="text-center text-muted mt-5">' + (proposals.message || 'ไม่มีสิทธิ์เข้าถึงข้อมูล') + '</div>';
          return;
        }
        if (!Array.isArray(proposals) || proposals.length === 0) {
          container.innerHTML = '<div class="text-center text-muted mt-5"><i class="fas fa-check-circle text-success fa-2x mb-3"></i><br>ไม่มีข้อเสนอแนะที่รอการพิจารณาครับ</div>';
          return;
        }
        
        let html = '';
        proposals.forEach(function(item) {
          let areaTag = formatTambon(item.tambon);
          html += '<div class="log-card">' +
                     '<div class="log-title">' + item.title + '</div>' +
                     '<div class="text-muted small mb-2">' +
                       '<i class="fas fa-user"></i> ' + (item.fullName || 'ไม่ระบุชื่อ') + ' (' + item.phone + ')<br>' +
                       '<i class="fas fa-map-marker-alt"></i> ' + areaTag + ' | <i class="fas fa-calendar-alt"></i> ' + item.timestamp + 
                     '</div>' +
                     '<div class="log-desc mb-3" style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">' + (item.description || '-') + '</div>' +
                     '<button class="btn-primary w-100" onclick="openProposalReviewModal(' + item.rowIdx + ', \'' + escapeJS(item.title) + '\', \'' + escapeJS(item.description) + '\', \'' + escapeJS(item.fullName || 'ไม่ระบุชื่อ') + '\', \'' + escapeJS(item.phone) + '\', \'' + escapeJS(areaTag) + '\')">' +
                       '<i class="fas fa-check-circle"></i> พิจารณาข้อเสนอ' +
                     '</button>' +
                   '</div>';
        });
        container.innerHTML = html;
      }).catch(function() {
        container.innerHTML = '<div class="text-center text-muted mt-5">โหลดไม่สำเร็จ</div>';
      });
  }

  function openProposalReviewModal(rowIdx, title, desc, fullName, phone, area) {
    document.getElementById('review-proposal-row').value = rowIdx;
    document.getElementById('review-proposal-user').innerText = (fullName || 'ไม่ระบุชื่อ') + ' (' + phone + ')';
    document.getElementById('review-proposal-area').innerText = area;
    document.getElementById('review-proposal-title').innerText = title;
    document.getElementById('review-proposal-desc').innerText = desc || '-';
    document.getElementById('proposal-review-modal').style.display = 'flex';
  }

  function closeProposalReviewModal() {
    document.getElementById('proposal-review-modal').style.display = 'none';
  }

  function submitProposalReview(status) {
    const rowIdx = document.getElementById('review-proposal-row').value;
    closeProposalReviewModal();
    showLoading(true);
    
    apiPost('reviewProposal', withAuthData({ rowIdx: rowIdx, status: status }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert("บันทึกการพิจารณาเรียบร้อย", "success");
          loadPendingProposals();
        } else {
          showCustomAlert(res.message || "ไม่สามารถบันทึกได้", "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

    function loadUserMgmt() {
    const container = document.getElementById('user-mgmt-page');
    if (container && container.getAttribute('data-loaded') !== 'true') {
      showLoading(true);
      fetch('user-mgmt.html?v=20260714-workspaces-v2')
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP status ' + res.status);
          return res.text();
        })
        .then(function(html) {
          container.innerHTML = html;
          container.setAttribute('data-loaded', 'true');
          applyFirebaseFreeModeUI();
          showLoading(false);
          initUserMgmtPage();
        })
        .catch(function(err) {
          showLoading(false);
          console.error('Failed to load user-mgmt page:', err);
          showCustomAlert("โหลดหน้าจัดการสมาชิกไม่สำเร็จ", "error");
          showPage('manage-page');
        });
      return;
    }
    initUserMgmtPage();
  }

  function initUserMgmtPage() {
    const role = localStorage.getItem("userRole");
    const tambon = localStorage.getItem("userTambon") || "ไม่ระบุ";
    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const badge = document.getElementById('user-mgmt-tambon-badge');
    const filterContainer = document.getElementById('admin-user-filter-container');
    const filterEl = document.getElementById('user-mgmt-tambon-filter');
    const instContainer = document.getElementById('admin-institution-filter-container');
    const instEl = document.getElementById('user-mgmt-institution-filter');

    if (instEl && !isSuper) {
      instEl.value = userInst;
      onUserMgmtInstitutionFilterChange();
    }

    if (role === 'admin') {
      if (badge) badge.innerText = isSuper ? "ทุกพื้นที่ (Super Admin)" : ("ศกร.ระดับอำเภอ" + (userInst === 'INS_MAERIM' ? 'แม่ริม' : 'พร้าว'));
      if (filterContainer) filterContainer.style.display = 'block';
      if (instContainer) instContainer.style.display = isSuper ? 'block' : 'none';
      if (filterEl && !filterEl.value) filterEl.value = "";
    } else {
      if (badge) badge.innerText = formatTambon(tambon);
      if (filterContainer) filterContainer.style.display = 'none';
      if (instContainer) instContainer.style.display = 'none';
      if (filterEl) filterEl.value = tambon;
    }

    const requestedTab = window.pendingUserMgmtTab || 'all';
    delete window.pendingUserMgmtTab;
    switchUserMgmtTab(requestedTab);
    if (requestedTab !== 'cert') fetchUserMgmtList();
  }

  function openUserManagementWorkspace(tabId) {
    const tabMap = { all: 'members', approve: 'approvals', cert: 'certs' };
    window.location.href = 'users.html?tab=' + (tabMap[tabId] || tabId || 'members');
  }
  window.openUserManagementWorkspace = openUserManagementWorkspace;

  function openAdminCouponsPanel() {
    window.location.href = 'market-admin.html?tab=coupons';
  }
  window.openAdminCouponsPanel = openAdminCouponsPanel;

  function getAISummary() {
    const container = document.getElementById('ai-summary-container');
    const textEl = document.getElementById('ai-summary-text');
    
    showLoading(true);
    apiGet('getAISummary', withAuthParams({}))
      .then(function(res) {
        showLoading(false);
        if (res.status === 'success') {
          container.style.display = 'block';
          textEl.innerText = res.summary;
          // เลื่อนไปที่ตำแหน่งสรุป
          container.scrollIntoView({ behavior: 'smooth' });
        } else {
          showCustomAlert(res.message, "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI", "error");
      });
  }

  function openReviewModal(logId, phone, activity, fullName, area, description, externalLink) {
    document.getElementById('review-log-id').value = logId;
    document.getElementById('review-phone').innerText = (fullName || 'ไม่ระบุชื่อ') + ' (' + phone + ')';
    document.getElementById('review-area').innerText = area;
    document.getElementById('review-activity').innerText = activity;
    document.getElementById('review-desc').innerText = description || 'ไม่มีรายละเอียด';
    document.getElementById('review-score').value = 50; 
    document.getElementById('review-note').value = '';

    const linkContainer = document.getElementById('review-link-container');
    const linkEl = document.getElementById('review-link');
    if (externalLink) {
      linkEl.href = externalLink;
      linkContainer.style.display = 'block';
    } else {
      linkEl.href = '#';
      linkContainer.style.display = 'none';
    }

    document.getElementById('review-modal').style.display = 'flex';
  }

  function submitReview(status) {
    const logId = document.getElementById('review-log-id').value;
    const score = document.getElementById('review-score').value;
    const note = document.getElementById('review-note').value;
    
    if(status === "Approved" && (score === "" || score < 0)) return showCustomAlert("กรุณาระบุคะแนนให้ถูกต้อง", "warning");
    
    document.getElementById('review-modal').style.display = 'none';
    showLoading(true);
    
    apiPost('reviewLog', withAuthData({ logId: logId, status: status, score: score, note: note }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert("บันทึกผลประเมินเรียบร้อย", "success");
          cacheLeaderboard = null;
          loadPendingLogs();
        } else {
          showCustomAlert(res.message || "ไม่สามารถบันทึกผลประเมินได้", "error");
        }
      }).catch(function() { showLoading(false); showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
  }

  

  let currentUserMgmtTab = 'approve';
  function switchUserMgmtTab(tabId) {
    currentUserMgmtTab = tabId;
    const approveBtn = document.getElementById('tab-btn-approve-img');
    const allUsersBtn = document.getElementById('tab-btn-all-users');
    if (approveBtn) approveBtn.classList.toggle('active', tabId === 'approve');
    if (allUsersBtn) allUsersBtn.classList.toggle('active', tabId === 'all');
    const certBtn = document.getElementById('tab-btn-cert-history');
    if (certBtn) certBtn.classList.toggle('active', tabId === 'cert');

    const workspaceMeta = {
      all: { title: 'จัดการสมาชิก', description: 'ค้นหา แก้ไขสิทธิ์ และจัดการบัญชีสมาชิก', icon: 'fa-users-cog' },
      approve: { title: 'อนุมัติรูปโปรไฟล์', description: 'ตรวจและอนุมัติรูปประจำตัวที่รอดำเนินการ', icon: 'fa-user-check' },
      cert: { title: 'ประวัติใบเกียรติบัตร', description: 'ค้นหาและตรวจสอบรายการใบเกียรติบัตรที่ออกแล้ว', icon: 'fa-award' }
    };
    const meta = workspaceMeta[tabId] || workspaceMeta.all;
    const workspaceTitle = document.getElementById('user-mgmt-workspace-title');
    const workspaceDescription = document.getElementById('user-mgmt-workspace-description');
    const workspaceIcon = document.getElementById('user-mgmt-workspace-icon');
    const statsRow = document.getElementById('user-mgmt-stats-row');
    if (workspaceTitle) workspaceTitle.innerText = meta.title;
    if (workspaceDescription) workspaceDescription.innerText = meta.description;
    if (workspaceIcon) workspaceIcon.className = 'fas ' + meta.icon;
    if (statsRow) statsRow.style.display = tabId === 'cert' ? 'none' : 'grid';

    const titleEl = document.getElementById('user-mgmt-title');
    if (titleEl) {
      titleEl.innerText = tabId === 'cert' ? 'ประวัติการออกใบเกียรติบัตร' : 'รายชื่อสมาชิก';
    }

    const role = localStorage.getItem("userRole");
    const filterEl = document.getElementById('user-mgmt-tambon-filter');
    const tambon = (role === 'admin') ? (filterEl ? filterEl.value : "") : (localStorage.getItem("userTambon") || "");

    if (role === 'admin' && !tambon) {
      const container = document.getElementById('user-mgmt-list');
      const countEl = document.getElementById('user-mgmt-count');
      if (countEl) countEl.innerText = tabId === 'cert' ? '0 รายการ' : '0 คน';
      const msg = tabId === 'cert' ? 'ประวัติใบเกียรติบัตร' : (tabId === 'approve' ? 'รูปรออนุมัติ' : 'รายชื่อสมาชิก');
      container.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-map-marker-alt fa-2x mb-2" style="color:var(--primary)"></i><div>กรุณาเลือกพื้นที่ด้านบนเพื่อแสดง' + msg + '</div></div>';
      updateUserMgmtStats([]);
      return;
    }

    if (tabId === 'cert') {
      fetchCertHistory();
    } else {
      renderUserMgmtList(fullUserList);
    }
  }

  let fullUserList = [];
  let fullCertHistory = [];
  let currentUserRoleFilter = 'all';

  function setUserRoleFilter(role) {
    currentUserRoleFilter = role || 'all';
    document.querySelectorAll('.btn-role-tab').forEach(function(btn) {
      btn.classList.remove('active');
    });
    const targetBtn = document.getElementById('role-tab-' + currentUserRoleFilter);
    if (targetBtn) targetBtn.classList.add('active');
    filterUserMgmtList();
  }
  window.setUserRoleFilter = setUserRoleFilter;

  function openAdminAddUserModal(defaultRole) {
    const role = defaultRole || (currentUserRoleFilter !== 'all' ? currentUserRoleFilter : 'user');
    const roleEl = document.getElementById('add-user-role');
    if (roleEl) roleEl.value = role;

    document.getElementById('add-user-fullname').value = '';
    document.getElementById('add-user-phone').value = '';
    document.getElementById('add-user-password').value = '';
    
    const instEl = document.getElementById('user-mgmt-institution-filter');
    const myInst = instEl ? instEl.value : (localStorage.getItem("userInstitution") || "INS_PHRAO");
    const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(myInst) : [];
    const tambonSelect = document.getElementById('add-user-tambon');
    if (tambonSelect) {
      let optHtml = '<option value="">— เลือกสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.) —</option>';
      subUnits.forEach(function(u) {
        optHtml += '<option value="' + u + '">' + u + '</option>';
      });
      tambonSelect.innerHTML = optHtml;
    }

    const filterEl = document.getElementById('user-mgmt-tambon-filter');
    if (filterEl && filterEl.value && filterEl.value !== 'ทั้งหมด') {
      setSelectTambonValue('add-user-tambon', filterEl.value);
    } else {
      if (tambonSelect) tambonSelect.value = '';
    }

    document.getElementById('admin-add-user-modal').style.display = 'flex';
  }
  window.openAdminAddUserModal = openAdminAddUserModal;

  function closeAdminAddUserModal() {
    document.getElementById('admin-add-user-modal').style.display = 'none';
  }
  window.closeAdminAddUserModal = closeAdminAddUserModal;

  function submitAdminAddUser() {
    const fullName = (document.getElementById('add-user-fullname').value || '').trim();
    const phone = (document.getElementById('add-user-phone').value || '').trim();
    const role = (document.getElementById('add-user-role').value || 'user').trim();
    const tambon = (document.getElementById('add-user-tambon').value || '').trim();
    const userCategory = (document.getElementById('add-user-category').value || 'ประชาชนทั่วไป').trim();
    const ageGroup = (document.getElementById('add-user-age-group').value || '').trim();
    const occupation = (document.getElementById('add-user-occupation').value || '').trim();
    const password = document.getElementById('add-user-password').value || '';

    if (!fullName) return showCustomAlert("กรุณากรอกชื่อ-นามสกุล", "warning");
    if (!phone) return showCustomAlert("กรุณากรอกเบอร์โทรศัพท์ (Username)", "warning");
    if (!tambon) return showCustomAlert("กรุณาเลือกตำบล/พื้นที่", "warning");
    if (!password || password.length < 6) return showCustomAlert("กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร", "warning");

    showLoading(true);
    apiPost('createUserByAdmin', withAuthParams({
      fullName: fullName,
      phone: phone,
      username: phone,
      role: role,
      tambon: tambon,
      userCategory: userCategory,
      ageGroup: ageGroup,
      occupation: occupation,
      password: password
    })).then(function(res) {
      showLoading(false);
      if (res.status === 'success') {
        showCustomAlert("เพิ่มสมาชิกใหม่เรียบร้อยแล้ว", "success");
        closeAdminAddUserModal();
        fetchUserMgmtList();
      } else {
        showCustomAlert(res.message || "เกิดข้อผิดพลาดในการสร้างผู้ใช้", "error");
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    });
  }
  window.submitAdminAddUser = submitAdminAddUser;

  function onUserMgmtTambonFilterChange() {
    if (currentUserMgmtTab === 'cert') fetchCertHistory();
    else fetchUserMgmtList();
  }

  function fetchUserMgmtList() {
    const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
    let tambon = localStorage.getItem("userTambon");
    const filterEl = document.getElementById('user-mgmt-tambon-filter');
    const addBtn = document.getElementById('admin-add-user-btn');
    const addBtnLabel = document.getElementById('admin-add-user-btn-label');
    const container = document.getElementById('user-mgmt-list');
    
    if (role === 'admin') {
      tambon = (filterEl && filterEl.value) ? filterEl.value : "";
      if (addBtn) addBtn.style.display = 'inline-flex';
      if (addBtnLabel) {
        if (currentUserRoleFilter === 'teacher') addBtnLabel.innerText = 'เพิ่มครูประจำตำบล';
        else if (currentUserRoleFilter === 'admin') addBtnLabel.innerText = 'เพิ่มผู้ดูแลระบบ';
        else addBtnLabel.innerText = 'เพิ่มสมาชิกใหม่';
      }

      if (!tambon) {
        if (container) {
          container.innerHTML = 
            '<div class="text-center text-muted py-12" style="padding: 40px 16px;">' +
              '<div style="width:64px; height:64px; border-radius:50%; background:var(--glass); border:1px solid var(--card-border); display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">' +
                '<i class="fas fa-filter fa-2x" style="color:var(--primary);"></i>' +
              '</div>' +
              '<h4 class="font-bold text-lg text-theme-inv mb-1">กรุณาเลือกตัวกรองพื้นที่เพื่อแสดงรายชื่อสมาชิก</h4>' +
              '<p class="text-xs text-soft max-w-sm mx-auto">เลือกตำบลที่ต้องการ หรือ เลือก "ทุกพื้นที่ (ทั้งหมด)" จากตัวกรองด้านบนเพื่อดึงข้อมูลสมาชิก</p>' +
            '</div>';
        }
        updateUserMgmtStats([]);
        return;
      }
    } else {
      if (addBtn) addBtn.style.display = 'none';
    }

    if (container) container.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const instEl = document.getElementById('user-mgmt-institution-filter');
    const instId = isSuper ? ((instEl && instEl.value) ? instEl.value : 'INS_PHRAO') : userInst;

    apiGet('getUsersByTambon', withAuthParams({ tambon: normalizeTambon(tambon), institutionId: instId }))
      .then(function(users) {
        fullUserList = users || [];
        updateUserMgmtStats(fullUserList);
        if (currentUserMgmtTab !== 'cert') renderUserMgmtList(fullUserList);
      }).catch(function() {
        container.innerHTML = '<div class="text-center text-muted py-8">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
      });
  }

  function onUserMgmtInstitutionFilterChange() {
    const instEl = document.getElementById('user-mgmt-institution-filter');
    const tambonEl = document.getElementById('user-mgmt-tambon-filter');
    const instId = instEl ? instEl.value : 'INS_PHRAO';

    if (tambonEl) {
      const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(instId) : [];
      let label = (instId === 'INS_MAERIM' ? 'แม่ริมทั้งหมด' : (instId === 'INS_PHRAO' ? 'พร้าวทั้งหมด' : 'รวมทุกสถานศึกษา'));
      let html = '<option value="" selected>🔍 -- กรุณาเลือกตัวกรองพื้นที่เพื่อดึงข้อมูล --</option>' +
                 '<option value="ทั้งหมด">🌍 ทุกสถานศึกษาในสังกัด (' + label + ')</option>';
      subUnits.forEach(function(u) {
        html += '<option value="' + u + '">' + u + '</option>';
      });
      tambonEl.innerHTML = html;
      tambonEl.value = "";
    }
    fetchUserMgmtList();
  }
  window.onUserMgmtInstitutionFilterChange = onUserMgmtInstitutionFilterChange;

  function updateUserMgmtStats(users) {
    const total = users.length;
    const pending = users.filter(function(u) { return u.imageStatus === 'Pending'; }).length;
    const approved = users.filter(function(u) { return u.imageStatus === 'Approved'; }).length;
    const rejected = users.filter(function(u) { return u.imageStatus === 'Rejected'; }).length;
    
    const totalEl = document.getElementById('user-stat-total');
    const pendingEl = document.getElementById('user-stat-pending');
    const approvedEl = document.getElementById('user-stat-approved');
    const rejectedEl = document.getElementById('user-stat-rejected');
    
    if (totalEl) totalEl.innerText = total;
    if (pendingEl) pendingEl.innerText = pending;
    if (approvedEl) approvedEl.innerText = approved;
    if (rejectedEl) rejectedEl.innerText = rejected;

    // อัปเดตตัวเลขนับตามสิทธิ์บทบาท (Role counts)
    const countAll = users.length;
    const countUser = users.filter(function(u) { return String(u.role || 'user').toLowerCase() === 'user'; }).length;
    const countTeacher = users.filter(function(u) { return String(u.role || '').toLowerCase() === 'teacher'; }).length;
    const countAdmin = users.filter(function(u) { return String(u.role || '').toLowerCase() === 'admin'; }).length;

    const elAll = document.getElementById('role-count-all');
    const elUser = document.getElementById('role-count-user');
    const elTeacher = document.getElementById('role-count-teacher');
    const elAdmin = document.getElementById('role-count-admin');

    if (elAll) elAll.innerText = countAll;
    if (elUser) elUser.innerText = countUser;
    if (elTeacher) elTeacher.innerText = countTeacher;
    if (elAdmin) elAdmin.innerText = countAdmin;
  }

  function fetchCertHistory() {
    const role = localStorage.getItem("userRole");
    let tambon = localStorage.getItem("userTambon");
    const filterEl = document.getElementById('user-mgmt-tambon-filter');
    if (role === 'admin') tambon = (filterEl && filterEl.value) ? filterEl.value : "ทั้งหมด";

    const container = document.getElementById('user-mgmt-list');
    container.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    apiGet('getCertIssuanceHistory', withAuthParams({ tambon: normalizeTambon(tambon) }))
      .then(function(res) {
        if (res && res.status === 'success') {
          fullCertHistory = res.data || res.items || [];
          renderCertHistory(fullCertHistory);
        } else {
          container.innerHTML = '<div class="text-center text-muted py-8">' + ((res && res.message) ? res.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล') + '</div>';
        }
      }).catch(function() {
        container.innerHTML = '<div class="text-center text-muted py-8">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
      });
  }

  function renderUserMgmtList(users) {
    const container = document.getElementById('user-mgmt-list');
    const countEl = document.getElementById('user-mgmt-count');
    
    // กรองตาม Tab สภาพงาน
    let filtered = users;
    if (currentUserMgmtTab === 'approve') {
      filtered = users.filter(function(u) { return u.imageStatus === 'Pending'; });
    }

    // กรองตาม Role Tab (แยกประเภทผู้เรียน / ครูประจำตำบล / แอดมิน)
    if (currentUserRoleFilter && currentUserRoleFilter !== 'all') {
      filtered = filtered.filter(function(u) {
        return String(u.role || 'user').toLowerCase() === currentUserRoleFilter;
      });
    }
    
    countEl.innerText = filtered.length + " คน";

    if (filtered.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-8">ไม่พบรายชื่อสมาชิก</div>';
      return;
    }

    let html = '';
    filtered.forEach(function(u) {
      const isPending = u.imageStatus === 'Pending';
      const statusText = isPending ? 'รออนุมัติ' : (u.imageStatus === 'Rejected' ? 'ไม่อนุมัติ' : 'อนุมัติแล้ว');
      const statusColor = isPending ? 'var(--gold)' : (u.imageStatus === 'Rejected' ? '#ef4444' : '#10b981');
      const statusBorderColor = isPending ? 'rgba(245,158,11,0.3)' : (u.imageStatus === 'Rejected' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)');
      const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
      const rawImg = typeof getValidImageUrl === 'function' ? getValidImageUrl(u.profileImage || '') : (u.profileImage || '');
      const imgUrl = isLoftAssetUrl(rawImg) ? rawImg : placeholderImg;
      const userScore = u.score != null ? u.score : 0;
      const roleValue = String(u.role || 'user').toLowerCase();
      const roleLabel = roleValue === 'admin' ? 'Admin' : (roleValue === 'teacher' ? 'Teacher' : 'User');

      const categoryText = u.userCategory || 'ประชาชนทั่วไป';
      const ageText = u.ageGroup ? ' · ' + u.ageGroup : '';

      html += '<div class="user-mgmt-card" style="--status-color:' + statusColor + '; --status-border:' + statusBorderColor + ';">' +
                '<div class="user-mgmt-card-header">' +
                  '<div class="user-mgmt-avatar-wrapper">' +
                    '<img src="' + imgUrl + '" class="user-mgmt-avatar" style="cursor:pointer;" onclick="if(isLoftAssetUrl(\'' + escapeJS(imgUrl) + '\')){ document.getElementById(\'full-image-display\').src=\'' + escapeJS(imgUrl) + '\'; document.getElementById(\'image-viewer\').style.display=\'flex\'; }">' +
                  '</div>' +
                  '<div class="user-mgmt-info">' +
                    '<div class="user-mgmt-name" title="' + escapeHtml(u.fullName) + '">' + escapeHtml(u.fullName) + '</div>' +
                    '<div class="user-mgmt-sub">' +
                      '<span>เบอร์โทร: ' + escapeHtml(u.username) + '</span>' +
                      '<span>พื้นที่: ' + formatTambon(u.tambon) + '</span>' +
                      '<span style="color:var(--primary); font-weight:700;"><i class="fas fa-tag mr-1"></i>' + escapeHtml(categoryText) + escapeHtml(ageText) + '</span>' +
                    '</div>' +
                  '</div>' +
                  '<div class="user-mgmt-badges">' +
                    '<div class="user-mgmt-role-badge role-' + escapeHtml(roleValue) + '">' + roleLabel + '</div>' +
                    '<div class="user-mgmt-badge">' + statusText + '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="user-mgmt-details">' +
                  '<span class="text-muted"><i class="fas fa-trophy mr-1"></i>คะแนนสะสม</span>' +
                  '<span class="user-mgmt-score">' + userScore + ' แต้ม</span>' +
                '</div>';
      
      if (currentUserMgmtTab === 'approve') {
        html += '<div class="user-mgmt-actions">' +
                  '<button class="user-mgmt-btn user-mgmt-btn-reject" onclick="approveUserImage(\'' + u.username + '\', \'Rejected\')">' +
                    '<i class="fas fa-times"></i> ไม่อนุมัติรูป' +
                  '</button>' +
                  '<button class="user-mgmt-btn user-mgmt-btn-approve" onclick="approveUserImage(\'' + u.username + '\', \'Approved\')">' +
                    '<i class="fas fa-check"></i> อนุมัติรูป' +
                  '</button>' +
                '</div>';
      } else {
        const actorRole = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
        const actorTambon = String(localStorage.getItem("userTambon") || "").trim();
        const canReset = actorRole === 'admin' || (actorRole === 'teacher' && roleValue === 'user' && cleanTambonForCompare(u.tambon) === cleanTambonForCompare(actorTambon));

        html += '<div class="user-mgmt-actions">' +
                  '<button class="user-mgmt-btn user-mgmt-btn-edit" onclick="openEditUserModal(\'' + u.username + '\', \'' + escapeJS(u.fullName) + '\', \'' + escapeJS(u.profileImage || '') + '\', \'' + escapeJS(roleValue) + '\', \'' + escapeJS(u.tambon || '') + '\', \'' + escapeJS(categoryText) + '\', \'' + escapeJS(u.ageGroup || '') + '\', \'' + escapeJS(u.occupation || '') + '\')">' +
                    '<i class="fas fa-edit"></i> แก้ไข' +
                  '</button>' +
                  (canReset ? ('<button class="user-mgmt-btn" style="background:rgba(245,158,11,0.15); color:var(--gold); border:1px solid rgba(245,158,11,0.3);" onclick="openResetUserPasswordModal(\'' + u.username + '\', \'' + escapeJS(u.fullName) + '\')">' +
                    '<i class="fas fa-key"></i> รีเซ็ตรหัสผ่าน' +
                  '</button>') : '') +
                  '<button class="user-mgmt-btn user-mgmt-btn-delete" onclick="deleteUser(\'' + u.username + '\')">' +
                    '<i class="fas fa-trash-alt"></i> ลบ' +
                  '</button>' +
                '</div>';
      }
      
      html += '</div>';
    });
    container.innerHTML = html;
  }

  function renderCertHistory(items) {
    const container = document.getElementById('user-mgmt-list');
    const countEl = document.getElementById('user-mgmt-count');
    countEl.innerText = (items || []).length + " รายการ";

    if (!items || items.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-8">ยังไม่มีประวัติการออกใบเกียรติบัตร</div>';
      return;
    }

    let html = '';
    items.forEach(function(it) {
      const whenText = it.issuedAt ? it.issuedAt : '-';
      const who = it.fullName ? it.fullName : it.userId;
      const area = it.tambon ? it.tambon : '-';
      const rawScore = (it.score != null && it.score !== '') ? String(it.score) : '-';
      const scoreText = (rawScore.includes('%') || rawScore.includes('ผ่าน') || rawScore === '-') ? rawScore : (rawScore + ' คะแนน');
      const src = it.sourceName ? it.sourceName : '-';
      const link = it.certUrl ? it.certUrl : '';

      html += '<div class="user-cert-card">' +
                '<div class="user-cert-header">' +
                  '<div class="user-cert-icon-wrapper">' +
                    '<i class="fas fa-award"></i>' +
                  '</div>' +
                  '<div class="user-cert-info">' +
                    '<div class="user-cert-name" title="' + escapeHtml(who) + '">' + escapeHtml(who) + '</div>' +
                    '<div class="text-[10px] text-muted">' + escapeHtml(it.userId || '-') + ' • ' + escapeHtml(area) + '</div>' +
                  '</div>' +
                  '<div class="user-cert-date">' + escapeHtml(whenText) + '</div>' +
                '</div>' +
                '<div class="user-cert-meta">' +
                  '<div><strong class="text-theme-inv">เนื้อหา:</strong> <span class="text-muted">' + escapeHtml(src) + '</span></div>' +
                  '<div><strong class="text-theme-inv">คะแนนทดสอบ:</strong> <span class="text-muted">' + escapeHtml(scoreText) + '</span></div>' +
                '</div>' +
                (link ? ('<button class="user-cert-btn" onclick="window.open(\'' + link + '\', \'_blank\')">' +
                          '<i class="fas fa-external-link-alt"></i> เปิดใบเกียรติบัตร' +
                        '</button>') : '') +
              '</div>';
    });

    container.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function openEditUserModal(username, fullName, profileImage, role, tambon, category, ageGroup, occupation) {
    document.getElementById('edit-user-username').value = username;
    document.getElementById('edit-user-fullname').value = fullName;
    const instEl = document.getElementById('user-mgmt-institution-filter');
    const myInst = instEl ? instEl.value : (localStorage.getItem("userInstitution") || "INS_PHRAO");
    const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(myInst) : [];
    const tambonSelect = document.getElementById('edit-user-tambon');
    if (tambonSelect) {
      let optHtml = '<option value="">— เลือกสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.) —</option>';
      subUnits.forEach(function(u) {
        optHtml += '<option value="' + u + '">' + u + '</option>';
      });
      tambonSelect.innerHTML = optHtml;
    }
    setSelectTambonValue('edit-user-tambon', tambon || '');
    
    const catEl = document.getElementById('edit-user-category');
    if (catEl) catEl.value = category || 'ประชาชนทั่วไป';

    const ageEl = document.getElementById('edit-user-age-group');
    if (ageEl) ageEl.value = ageGroup || '';

    const occEl = document.getElementById('edit-user-occupation');
    if (occEl) occEl.value = occupation || '';

    const roleGroup = document.getElementById('edit-user-role-group');
    const roleEl = document.getElementById('edit-user-role');
    const isAdmin = String(localStorage.getItem("userRole") || "").trim().toLowerCase() === "admin";
    if (roleGroup) roleGroup.style.display = isAdmin ? 'block' : 'none';
    if (roleEl) {
      roleEl.value = role || 'user';
      roleEl.disabled = !isAdmin;
    }
    document.getElementById('edit-user-modal').style.display = 'flex';
  }

  function closeEditUserModal() {
    document.getElementById('edit-user-modal').style.display = 'none';
  }

  function handleEditUserImageUpload(input) {
    if (input.files && input.files[0]) {
      showLoading(true);
      const reader = new FileReader();
      reader.onload = function(e) {
        // ใช้ Cropper เพื่อปรับขนาดรูป
        currentCropContext = 'editUser';
        currentFileName = "profile_edit_" + document.getElementById('edit-user-username').value + ".jpg";
        openCropModal(input.files[0]);
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  function submitEditUser() {
    const username = document.getElementById('edit-user-username').value;
    const fullName = document.getElementById('edit-user-fullname').value.trim();
    const profileImage = document.getElementById('edit-user-image').value.trim();
    const tambon = (document.getElementById('edit-user-tambon').value || '').trim();
    const userCategory = (document.getElementById('edit-user-category').value || 'ประชาชนทั่วไป').trim();
    const ageGroup = (document.getElementById('edit-user-age-group').value || '').trim();
    const occupation = (document.getElementById('edit-user-occupation').value || '').trim();
    const roleEl = document.getElementById('edit-user-role');
    const isAdmin = String(localStorage.getItem("userRole") || "").trim().toLowerCase() === "admin";
    const role = roleEl && isAdmin ? roleEl.value : undefined;

    if (!fullName) return showCustomAlert("กรุณากรอกชื่อ-นามสกุล", "warning");

    showLoading(true);
    apiPost('updateUserDetails', withAuthParams({
      targetUserId: username,
      fullName: fullName,
      profileImage: profileImage,
      tambon: tambon,
      userCategory: userCategory,
      ageGroup: ageGroup,
      occupation: occupation,
      role: role
    })).then(function(res) {
      showLoading(false);
      if (res.status === 'success') {
        showCustomAlert("แก้ไขข้อมูลสำเร็จ", "success");
        closeEditUserModal();
        fetchUserMgmtList();
      } else {
        showCustomAlert(res.message, "error");
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    });
  }

  function openResetUserPasswordModal(username, fullName) {
    document.getElementById('reset-user-password-username').value = username;
    document.getElementById('reset-user-password-target-name').innerText = "กำลังรีเซ็ตรหัสผ่านให้: " + fullName + " (" + username + ")";
    document.getElementById('reset-user-password-input').value = "123456";
    document.getElementById('reset-user-password-modal').style.display = 'flex';
  }
  window.openResetUserPasswordModal = openResetUserPasswordModal;

  function closeResetUserPasswordModal() {
    document.getElementById('reset-user-password-modal').style.display = 'none';
  }
  window.closeResetUserPasswordModal = closeResetUserPasswordModal;

  function submitResetUserPassword() {
    const username = document.getElementById('reset-user-password-username').value;
    const newPassword = (document.getElementById('reset-user-password-input').value || '').trim();

    if (!newPassword || newPassword.length < 6) {
      return showCustomAlert("กรุณากำหนดรหัสผ่านชั่วคราวอย่างน้อย 6 ตัวอักษร", "warning");
    }

    showLoading(true);
    apiPost('resetUserPasswordByAdmin', withAuthParams({
      targetUserId: username,
      newPassword: newPassword
    })).then(function(res) {
      showLoading(false);
      if (res.status === 'success') {
        showCustomAlert("รีเซ็ตรหัสผ่านชั่วคราวเป็น [" + newPassword + "] เรียบร้อยแล้ว สมาชิกจะถูกบังคับเปลี่ยนรหัสผ่านทันทีเมื่อเข้าสู่ระบบ", "success");
        closeResetUserPasswordModal();
      } else {
        showCustomAlert(res.message || "เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน", "error");
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    });
  }
  window.submitResetUserPassword = submitResetUserPassword;

  function checkMustChangePassword(user) {
    if (!user) return false;
    if (user.mustChangePassword || user.passwordResetRequired) {
      const modalEl = document.getElementById('force-change-password-modal');
      if (modalEl) modalEl.style.display = 'flex';
      return true;
    }
    return false;
  }
  window.checkMustChangePassword = checkMustChangePassword;

  function submitForceChangePassword() {
    const newPassword = (document.getElementById('force-new-password').value || '').trim();
    const confirmPassword = (document.getElementById('force-confirm-password').value || '').trim();

    if (!newPassword || newPassword.length < 6) {
      return showCustomAlert("กรุณากรอกรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร", "warning");
    }
    if (newPassword !== confirmPassword) {
      return showCustomAlert("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน", "warning");
    }

    showLoading(true);
    apiPost('forceChangePassword', withAuthParams({
      newPassword: newPassword,
      confirmPassword: confirmPassword
    })).then(function(res) {
      showLoading(false);
      if (res.status === 'success') {
        showCustomAlert("ตั้งรหัสผ่านใหม่สำเร็จ ยินดีต้อนรับสู่ระบบ", "success");
        const modalEl = document.getElementById('force-change-password-modal');
        if (modalEl) modalEl.style.display = 'none';
        if (res.user) {
          localStorage.setItem("userData", JSON.stringify(res.user));
        }
        showPage('home-page');
      } else {
        showCustomAlert(res.message || "เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่", "error");
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    });
  }
  window.submitForceChangePassword = submitForceChangePassword;

    function deleteUser(username) {
    showCustomConfirm("คุณต้องการลบสมาชิกรายนี้ใช่หรือไม่? ข้อมูลจะถูกลบถาวร", function() {
      showLoading(true);
      apiPost('deleteUser', withAuthParams({ targetUserId: username }))
        .then(function(res) {
          showLoading(false);
          if (res.status === 'success') {
            showCustomAlert("ลบสมาชิกเรียบร้อย", "success");
            fetchUserMgmtList();
          } else {
            showCustomAlert(res.message, "error");
          }
        }).catch(function() {
          showLoading(false);
          showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        });
    });
  }

  function filterUserMgmtList() {
    const query = document.getElementById('user-mgmt-search').value.toLowerCase();
    if (currentUserMgmtTab === 'cert') {
      const filtered = fullCertHistory.filter(function(it) {
        return String(it.fullName || '').toLowerCase().includes(query) ||
               String(it.userId || '').toLowerCase().includes(query) ||
               String(it.sourceName || '').toLowerCase().includes(query);
      });
      renderCertHistory(filtered);
    } else {
      let filtered = fullUserList;
      if (currentUserRoleFilter && currentUserRoleFilter !== 'all') {
        filtered = filtered.filter(function(u) {
          return String(u.role || 'user').toLowerCase() === currentUserRoleFilter;
        });
      }
      if (query) {
        filtered = filtered.filter(function(u) {
          return u.fullName.toLowerCase().includes(query) || u.username.includes(query);
        });
      }
      renderUserMgmtList(filtered);
    }
  }

  function approveUserImage(userId, status) {
    showLoading(true);
    apiPost('approveProfileImage', withAuthParams({ targetUserId: userId, status: status }))
      .then(function(res) {
        showLoading(false);
        if (res.status === 'success') {
          showCustomAlert("ดำเนินการสำเร็จ", "success");
          fetchUserMgmtList();
        } else {
          showCustomAlert(res.message, "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function getLvlClass(levelStr) {
    const levelNumber = Number(levelStr);
    if (Number.isInteger(levelNumber) && levelNumber >= 1) {
      return 'lvl-' + Math.min(levelNumber, 6);
    }
    let lvl = String(levelStr || "").toUpperCase();
    if (lvl.indexOf("GLORIOUS") > -1 || lvl.indexOf("CONQUEROR") > -1) return 'lvl-6';
    if (lvl.indexOf("ต้นแบบ") > -1 || lvl.indexOf("MASTER") > -1) return 'lvl-5';
    if (lvl.indexOf("เชี่ยวชาญ") > -1 || lvl.indexOf("DIAMOND") > -1) return 'lvl-4';
    if (lvl.indexOf("ก้าวหน้า") > -1 || lvl.indexOf("PLATINUM") > -1) return 'lvl-3';
    if (lvl.indexOf("กลาง") > -1 || lvl.indexOf("GOLD") > -1) return 'lvl-2';
    if (lvl.indexOf("ต้น") > -1 || lvl.indexOf("SILVER") > -1) return 'lvl-1';
    return 'lvl-0';
  }

  let currentDashInstFilter = null;

  function onDashInstitutionChange() {
    const instEl = document.getElementById('dash-institution-filter');
    const tambonEl = document.getElementById('dash-tambon-filter');
    const instId = instEl ? instEl.value : 'ALL';
    currentDashInstFilter = instId;

    if (tambonEl) {
      const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(instId) : [];
      let label = (instId === 'INS_MAERIM' ? 'แม่ริมทั้งหมด' : (instId === 'INS_PHRAO' ? 'พร้าวทั้งหมด' : 'รวมทุกสถานศึกษา'));
      let html = '<option value="ทั้งหมด" selected>🌍 ดูผลรวมทุกตำบล/พื้นที่ (' + label + ')</option>';
      subUnits.forEach(function(u) {
        html += '<option value="' + u + '">' + u + '</option>';
      });
      tambonEl.innerHTML = html;
      tambonEl.value = "ทั้งหมด";
    }
    loadDashboard();
  }
  window.onDashInstitutionChange = onDashInstitutionChange;

  function loadDashboard() {
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const myTambon = localStorage.getItem("userTambon") || "";
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const instEl = document.getElementById('dash-institution-filter');
    const filterEl = document.getElementById('dash-tambon-filter');

    if (instEl && !instEl.getAttribute('data-init')) {
      instEl.setAttribute('data-init', 'true');
      if (userInst && userInst !== 'ALL' && userInst !== 'ทั้งหมด') {
        instEl.value = userInst;
      } else {
        instEl.value = 'ALL';
      }
      currentDashInstFilter = instEl.value;
      onDashInstitutionChange();
      return;
    }

    if (role === "teacher" && filterEl) {
      filterEl.value = myTambon;
      filterEl.disabled = true;
    } else if (filterEl) {
      filterEl.disabled = false;
    }

    const instId = instEl ? instEl.value : (currentDashInstFilter || userInst || 'ALL');
    const tambonFilter = filterEl ? normalizeTambon(filterEl.value) : "";
    document.getElementById('dash-ranking-container').innerHTML = '<div class="text-center text-muted my-4"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    apiGet('getDashboard', withAuthParams({ tambon: tambonFilter, institutionId: instId }))
      .then(function(dashData) {
        const ranking = Array.isArray(dashData.ranking) ? dashData.ranking : [];
        document.getElementById('dash-total-users').innerText = Number(dashData.totalLearners ?? dashData.userCount ?? 0);
        const container = document.getElementById('dash-ranking-container');
        if(ranking.length === 0) {
          container.innerHTML = '<div class="text-center text-muted py-6">ยังไม่มีข้อมูลนักเรียนรู้ในพื้นที่นี้</div>';
        } else {
          let html = '';
          ranking.forEach(function(user, index) {
            let rStyle = getRankStyle(user.level);
            let rawName = user.name || user.fullName || user.full_name || user.username || user.phone || 'ผู้เรียน';
            let displayName = (rawName === 'undefined' || !rawName) ? (user.username || user.phone || 'ผู้เรียน') : rawName;
            let defaultImg = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(displayName) + '&background=random&color=fff';
            let imgUrl = (user.image && String(user.image).trim() !== "" && user.image !== 'undefined') ? user.image : defaultImg;
            let lvlClass = getLvlClass(user.level);
            let learnerId = user.username || user.phone || '';
            let glowColor = rStyle.color === '#10b981' ? 'rgba(16, 185, 129, 0.4)' : 
                            rStyle.color === '#fbbf24' ? 'rgba(251, 191, 36, 0.4)' : 
                            rStyle.color === '#cbd5e1' ? 'rgba(203, 213, 225, 0.4)' : 
                            'rgba(16, 185, 129, 0.3)';
            html += '<div class="rank-card dashboard-learner-row" role="button" tabindex="0" onclick="openAdminLearnerDetail(\'' + escapeJS(learnerId) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openAdminLearnerDetail(\'' + escapeJS(learnerId) + '\')}" style="border-left: 6px solid ' + rStyle.color + '; background: linear-gradient(to right, white, #fcfcfc);">' +
                       '<div class="rank-number" style="color: ' + rStyle.color + '; width:50px; font-weight:900; font-size:1.3rem;">' + (index + 1) + '</div>' +
                       '<div class="avatar-ring-wrapper avatar-ring-sm" style="--avatar-border-color: ' + rStyle.color + '; --avatar-shadow-color: ' + glowColor + ';">' +
                         '<div class="profile-avatar-ring ' + lvlClass + '"></div>' +
                         '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="rank-img-sm">' +
                       '</div>' +
                       '<div class="rank-info">' +
                         '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                           '<span class="rank-name" style="font-size:1.1rem; color:#2d3436;">' + escapeHtml(displayName) + '</span>' +
                           '<span style="background:' + rStyle.color + '; color:white; font-size:0.65rem; padding:2px 8px; border-radius:10px; font-weight:bold; letter-spacing:0.5px;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title.toUpperCase() + '</span>' +
                         '</div>' +
                         '<div class="rank-score" style="margin-top:3px;">' +
                           '<span style="color:#7f8c8d; font-size:0.85rem;"><i class="fas fa-award"></i> ' + user.level + '</span>' +
                           ' | <b style="color:' + rStyle.color + '; font-size:1rem;">' + user.score + ' แต้ม</b>' +
                         '</div>' +
                         '<div style="font-size:0.7rem; color:#b2bec3; margin-top:2px;"><i class="fas fa-map-marker-alt mr-1"></i>' + formatTambon(user.tambon) + '</div>' +
                       '</div>' +
                     '</div>';
          });
          container.innerHTML = html;
        }
      }).catch(function() {
        document.getElementById('dash-ranking-container').innerHTML = '<div class="text-center text-muted">โหลดไม่สำเร็จ</div>';
      });
  }
  window.loadDashboard = loadDashboard;

  function getCurrentQuarterAndYear() {
    const now = new Date();
    return { quarter: Math.floor(now.getMonth() / 3) + 1, year: now.getFullYear() };
  }

  function formatThaiDate(input) {
    if (!input) return '';
    let d;
    if (input instanceof Date) {
      d = input;
    } else {
      const s = String(input).trim();
      if (!s) return '';
      d = new Date(s);
      if (isNaN(d.getTime())) {
        // fallback สำหรับรูปแบบ yyyy-mm-dd
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
          d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        } else {
          return s;
        }
      }
    }
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const day = d.getDate();
    const month = monthNames[d.getMonth()] || '';
    const yearBE = d.getFullYear() + 543;
    return 'วันที่ ' + day + ' เดือน' + month + ' ' + yearBE;
  }

  function openMapLink(mapLink, fallbackLocationName, latitude, longitude) {
    const pLat = parseFloat(latitude);
    const pLng = parseFloat(longitude);
    if (!isNaN(pLat) && !isNaN(pLng)) {
      return window.open('https://www.google.com/maps/search/?api=1&query=' + pLat + ',' + pLng, '_blank');
    }
    const link = String(mapLink == null ? '' : mapLink).trim();
    if (link && link.indexOf(',') > -1 && link.toLowerCase().indexOf('http') === -1) {
      const parts = link.split(',');
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return window.open('https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng, '_blank');
      }
    }
    if (link && link.toLowerCase().indexOf('http') === 0) return window.open(link, '_blank');
    const q = encodeURIComponent(String(fallbackLocationName || '').trim());
    if (!q) return showCustomAlert("ยังไม่พบข้อมูลนำทางของกิจกรรมนี้", "warning");
    window.open('https://www.google.com/maps/search/?api=1&query=' + q, '_blank');
  }

  function updateGlobalUserScore(newScore) {
    if (newScore !== undefined && newScore !== null && !isNaN(Number(newScore))) {
      localStorage.setItem("userScore", String(Number(newScore)));
    }
    const currentScore = Number(localStorage.getItem("userScore") || 0);
    const formatted = currentScore.toLocaleString();

    const homeScoreEl = document.getElementById('home-user-score');
    if (homeScoreEl) homeScoreEl.innerText = formatted;

    const profileScoreEl = document.getElementById('profile-score');
    if (profileScoreEl) profileScoreEl.innerText = formatted;

    const spinScoreEl = document.getElementById('spin-user-score');
    if (spinScoreEl) spinScoreEl.innerText = currentScore;
  }
  window.updateGlobalUserScore = updateGlobalUserScore;

  function loadHomeSummary(forceReload) {
    const role = String(localStorage.getItem("userRole") || "guest").trim().toLowerCase();
    const phone = localStorage.getItem("userPhone") || "";

    const summaryEl = document.getElementById('home-summary-container');
    if (summaryEl && (!cacheHomeSummary || forceReload)) {
      summaryEl.innerHTML = '<div class="loft-card home-profile-card" style="margin:0;"><div class="text-center text-muted py-3"><i class="fas fa-circle-notch fa-spin mr-1" style="color:var(--primary)"></i> กำลังโหลดข้อมูลของฉัน...</div></div>';
    }

    apiGet('getHomeSummary', withAuthParams({}))
      .then(function(res) {
        if (!res || res.status !== 'success') return renderHomeSummary(null);
        if (res.profile) {
          localStorage.setItem('userScore', String(Number(res.profile.score || 0)));
          updateGlobalUserScore(res.profile.score);
        }
        if (res.nfe) {
          localStorage.setItem('userNFEHours', String(Number(res.nfe.totalHours || 0)));
        }
        res.phone = phone;
        res.role = role;
        cacheHomeSummary = res;
        renderHomeSummary(res);
      })
      .catch(function() {
        renderHomeSummary(null);
      });
  }

  function renderHomeSummary(data) {
    const summaryEl = document.getElementById('home-summary-container');
    const missionEl = document.getElementById('home-mission-container');
    const recommendedEl = document.getElementById('home-recommended-container');
    const staffEl = document.getElementById('home-staff-tasks');
    if (!summaryEl || !missionEl || !recommendedEl) return;

    const p = data && data.profile ? data.profile : null;
    const role = String(localStorage.getItem("userRole") || (p && p.role) || "guest").toLowerCase();
    const isGuest = role === "guest" || !p;
    const displayName = p ? (p.displayName || p.nickname || p.fullName || p.username || "ผู้เรียน") : "ผู้เยี่ยมชม";
    const score = Number(localStorage.getItem("userScore") || (p ? p.score : 0));
    const nfe = data && data.nfe ? data.nfe : { totalHours: 0, remainingThisYear: 50 };
    const couponCount = data ? Number(data.couponCount || 0) : 0;
    const rawAvatarUrl = p && (p.image || p.profileImage) ? (p.image || p.profileImage) : '';
    const avatarUrl = typeof getValidImageUrl === 'function' ? getValidImageUrl(rawAvatarUrl) : rawAvatarUrl;
    const avatarStyle = avatarUrl ? "background-image:url('" + escapeHtml(avatarUrl) + "')" : "";

    const cosmetics = (p && p.cosmetics) ? p.cosmetics : { equipped: {} };
    const eq = cosmetics.equipped || {};
    const frameClass = (eq.frame && typeof getCosmeticCss === 'function') ? getCosmeticCss(eq.frame) : '';
    const glowClass = (eq.name_glow && typeof getCosmeticCss === 'function') ? getCosmeticCss(eq.name_glow) : '';
    const badgeSymbol = (eq.badge && typeof getCosmeticCss === 'function') ? getCosmeticCss(eq.badge) : '';

    summaryEl.innerHTML =
      '<div class="home-profile-row" style="display:flex; align-items:center; gap:12px; margin-bottom:20px; padding: 4px 16px;">' +
        '<div class="home-profile-avatar avatar-frame-wrap ' + frameClass + '" style="' + avatarStyle + '; width:52px; height:52px; border-radius:50%; box-shadow: 0 2px 8px rgba(18,89,57,0.1); background-size:cover; background-position:center; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' + 
          (p && p.image ? '' : '<i class="fas fa-user" style="color:var(--primary);"></i>') + 
        '</div>' +
        '<div class="home-profile-info" style="flex-grow:1;">' +
          '<div style="font-size:0.75rem; color:var(--text-soft); font-weight:700;">สวัสดีครับ</div>' +
          '<h2 style="font-size:1rem; font-weight:800; margin:0; line-height:1.2;" class="' + glowClass + '">' + 
            escapeHtml(displayName) + (badgeSymbol ? '<span class="cosmetics-badge-tag">' + badgeSymbol + '</span>' : '') +
          '</h2>' +
        '</div>' +
        (!isGuest ? 
          '<button onclick="openCosmeticsShopModal()" class="btn-primary" style="padding:6px 12px; font-size:0.75rem; border-radius:20px; background:linear-gradient(135deg,#f59e0b,#d97706); border:none; box-shadow:0 3px 10px rgba(245,158,11,0.3); flex-shrink:0;">' +
            '<i class="fas fa-magic mr-1"></i> ร้านค้าสกิล' +
          '</button>' : '') +
      '</div>' +
      
      '<div class="loft-card map-promo-card">' +
        '<div class="map-promo-copy">' +
          '<div class="map-promo-kicker"><i class="fas fa-location-dot"></i> เมืองแห่งการเรียนรู้</div>' +
          '<h3>แผนที่แหล่งเรียนรู้</h3>' +
          '<p>สำรวจฐานการเรียนรู้ในชุมชน เลือกพื้นที่ แล้วเริ่มเรียนจากหมุดใกล้ตัว</p>' +
          '<div class="map-promo-actions">' +
            '<button class="map-promo-primary" onclick="showPage(\'map-page\')"><i class="fas fa-map-location-dot"></i> เปิดแผนที่</button>' +
            '<span><i class="fas fa-route"></i> แสดงหมุดจริง</span>' +
          '</div>' +
        '</div>' +
        '<button class="map-promo-visual" onclick="showPage(\'map-page\')" aria-label="เปิดแผนที่แหล่งเรียนรู้">' +
          '<span class="map-mini-route route-a"></span>' +
          '<span class="map-mini-route route-b"></span>' +
          '<span class="map-mini-pin pin-a"><i class="fas fa-book-open"></i></span>' +
          '<span class="map-mini-pin pin-b"><i class="fas fa-seedling"></i></span>' +
          '<span class="map-mini-pin pin-c"><i class="fas fa-landmark"></i></span>' +
          '<span class="map-mini-compass"><i class="fas fa-location-arrow"></i></span>' +
        '</button>' +
      '</div>' +

      '<div class="grid grid-cols-2 gap-3 mb-4" style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; margin-bottom:16px;">' +
        '<div class="loft-card points-promo-card" style="margin: 0; padding: 14px 16px; background: #FAF7EE; border: 1px solid rgba(226,155,29,0.18); border-radius: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-card);">' +
          '<div>' +
            '<span class="text-[10px] text-muted block mb-0.5" style="display:block; font-size:0.65rem; color:var(--text-soft);">คะแนนของคุณ</span>' +
            '<div class="flex items-baseline gap-1" style="display:flex; align-items:baseline; gap:4px;">' +
              '<span class="font-black text-xl" id="home-user-score" style="color: var(--primary); font-size:1.4rem; font-weight:900;">' + score.toLocaleString() + '</span>' +
              '<span class="text-[10px] text-muted font-bold" style="font-size:0.65rem; color:var(--text-soft);">แต้ม</span>' +
            '</div>' +
          '</div>' +
          '<svg width="32" height="32" viewBox="0 0 48 48" style="flex-shrink:0;">' +
            '<circle cx="24" cy="24" r="20" fill="url(#coinGrad)" stroke="#d97706" stroke-width="1.5" />' +
            '<circle cx="24" cy="24" r="16" fill="none" stroke="#fef08a" stroke-width="1.5" stroke-dasharray="4 2" />' +
            '<polygon points="24,14 27,21 34,22 29,27 30,34 24,31 18,34 19,27 14,22 21,21" fill="#fef08a" stroke="#d97706" stroke-width="1" />' +
            '<defs>' +
              '<linearGradient id="coinGrad" x1="0" y1="0" x2="1" y2="1">' +
                '<stop offset="0%" stop-color="#fef08a" />' +
                '<stop offset="50%" stop-color="#fbbf24" />' +
                '<stop offset="100%" stop-color="#ca8a04" />' +
              '</linearGradient>' +
            '</defs>' +
          '</svg>' +
        '</div>' +
        
        '<div class="loft-card hours-promo-card" style="margin: 0; padding: 14px 16px; background: #F0F7F4; border: 1px solid rgba(18,89,57,0.12); border-radius: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-card); cursor:pointer;" onclick="showPage(\'profile-page\')">' +
          '<div>' +
            '<span class="text-[10px] text-muted block mb-0.5" style="display:block; font-size:0.65rem; color:var(--text-soft);">ชั่วโมง กพช.</span>' +
            '<div class="flex items-baseline gap-1" style="display:flex; align-items:baseline; gap:4px;">' +
              '<span class="font-black text-xl" id="home-nfe-hours" style="color: var(--primary); font-size:1.4rem; font-weight:900;">' + Number(nfe.totalHours || 0) + '</span>' +
              '<span class="text-[10px] text-muted font-bold" style="font-size:0.65rem; color:var(--text-soft);">ชม.</span>' +
            '</div>' +
          '</div>' +
          '<div style="color: var(--primary); font-size: 1.25rem; line-height: 1; display:flex; align-items:center; justify-content:center; width:32px; height:32px; background:rgba(18,89,57,0.06); border-radius:50%; flex-shrink:0;">' +
            '<i class="fas fa-clock"></i>' +
          '</div>' +
        '</div>' +
      '</div>' +
      
      (isGuest ? 
        '<div class="mb-4" style="padding:0 16px;">' +
          '<button class="btn-primary w-100" onclick="showPage(\'login-page\')">' +
            '<i class="fas fa-right-to-bracket mr-1"></i> เข้าสู่ระบบเพื่อสะสมแต้ม' +
          '</button>' +
        '</div>' : '');

    const missions = [];
    if (isGuest) {
      missions.push({ icon: 'fa-right-to-bracket', text: 'เข้าสู่ระบบเพื่อเก็บคะแนนและใบเกียรติบัตร', action: "showPage('login-page')" });
      missions.push({ icon: 'fa-map-location-dot', text: 'สำรวจแหล่งเรียนรู้ในชุมชน', action: "showPage('map-page')" });
    } else {
      missions.push({ icon: 'fa-book-open-reader', text: 'เลือกฐานการเรียนรู้ แล้วทำแบบทดสอบก่อนเรียน', action: "showPage('map-page')" });
      missions.push({ icon: 'fa-pen-to-square', text: 'บันทึกความรู้หรือกิจกรรมที่เรียนรู้วันนี้', action: "showPage('log-page')" });
      if (score >= 100) missions.push({ icon: 'fa-clock', text: 'นำคะแนนไปแลกชั่วโมง กพช.', action: "openNFERedeemModal()" });
      else missions.push({ icon: 'fa-coins', text: 'สะสมอีก ' + (100 - score) + ' คะแนน เพื่อแลกชั่วโมง กพช.', action: "showPage('map-page')" });
    }
    missionEl.innerHTML = missions.map(function(m) {
      return '<button class="home-mission-item" onclick="' + m.action + '">' +
              '<i class="fas ' + m.icon + '"></i>' +
              '<span>' + escapeHtml(m.text) + '</span>' +
              '<i class="fas fa-chevron-right"></i>' +
             '</button>';
    }).join('');

    const sources = data && data.recommendedSources ? data.recommendedSources : [];
    if (!sources.length) {
      recommendedEl.innerHTML = '<div class="text-center text-muted py-3">ยังไม่มีแหล่งเรียนรู้แนะนำ</div>';
    } else {
      recommendedEl.innerHTML = sources.map(function(s) {
        const img = s.image || 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&q=70';
        return '<button class="home-source-mini" onclick="openHomeRecommendedSource(\'' + escapeJS(s.sourceId) + '\')">' +
                '<div class="home-source-thumb" style="background-image:url(\'' + escapeHtml(img) + '\')"></div>' +
                '<div class="home-source-info">' +
                  '<b>' + escapeHtml(s.name || '-') + '</b>' +
                  '<span>' + escapeHtml(s.tambon || '-') + (s.creditHours ? ' | ' + s.creditHours + ' ชม.' : '') + '</span>' +
                '</div>' +
               '</button>';
      }).join('');
    }

    if (staffEl) {
      const tasks = data && data.staffTasks ? data.staffTasks : null;
      if (tasks) {
        staffEl.style.display = 'block';
        staffEl.innerHTML =
          '<div class="home-section-head"><div><h4 class="font-bold text-theme-inv">งานรอดำเนินการ</h4><p class="text-muted text-xs">สำหรับครูและผู้ดูแลระบบ</p></div><i class="fas fa-clipboard-check" style="color:var(--gold)"></i></div>' +
          '<div class="home-staff-grid">' +
            '<button onclick="showPage(\'approve-page\')"><b>' + Number(tasks.pendingLogs || 0) + '</b><span>งานรอตรวจ</span></button>' +
            '<button onclick="showPage(\'user-mgmt-page\')"><b>' + Number(tasks.pendingImages || 0) + '</b><span>รูปรออนุมัติ</span></button>' +
            '<button onclick="showPage(\'approve-page\')"><b>' + Number(tasks.pendingProposals || 0) + '</b><span>ข้อเสนอแนะ</span></button>' +
          '</div>';
      } else {
        staffEl.style.display = 'none';
      }
    }
  }

  function openHomeRecommendedSource(sourceId) {
    if (typeof openSourceDetail === 'function') {
      openSourceDetail(sourceId);
    } else {
      showPage('map-page');
    }
  }
  window.openHomeRecommendedSource = openHomeRecommendedSource;

  let _calendarCurrentDate = new Date();
  let _calendarSelectedDateStr = "";

  function loadHomePageData(forceReload, q, y) {
    loadHomeSummary(forceReload);
    
    // คำนวณ quarter และ year จากประวัติวันของปฏิทินปัจจุบัน
    const currentMonth = _calendarCurrentDate.getMonth();
    const currentYear = _calendarCurrentDate.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;
    
    const targetQ = q || currentQuarter;
    const targetY = y || currentYear;

    if (!forceReload && cacheHomeData && cacheHomeData.quarter === targetQ && cacheHomeData.year === targetY) {
      return renderHomePage(cacheHomeData);
    }
    
    document.getElementById('home-featured-container').innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-circle-notch fa-spin mr-1" style="color:var(--primary)"></i> กำลังโหลดกิจกรรมเด่น...</div>';
    
    apiGet('getHomeData', withAuthParams({ quarter: targetQ, year: targetY }))
      .then(function(res) {
        if (res.status !== "success") {
          document.getElementById('home-featured-container').innerHTML = '<div class="text-center text-muted py-3">โหลดข้อมูลไม่สำเร็จ</div>';
          return;
        }
        cacheHomeData = res;
        renderHomePage(res);
      }).catch(function() {
        document.getElementById('home-featured-container').innerHTML = '<div class="text-center text-muted py-3">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>';
      });
  }

  function changeCalendarMonth(delta) {
    // ปรับเดือนในปฏิทิน
    _calendarCurrentDate.setMonth(_calendarCurrentDate.getMonth() + delta);
    _calendarSelectedDateStr = ""; // ล้างค่าวันปัจจุบันที่ถูกเลือก
    
    const targetMonth = _calendarCurrentDate.getMonth();
    const targetYear = _calendarCurrentDate.getFullYear();
    const targetQuarter = Math.floor(targetMonth / 3) + 1;
    
    // ตรวจสอบว่าในแคชเดิมมีข้อมูลกิจกรรมของไตรมาสนี้ครอบคลุมหรือไม่ ถ้าไม่มีให้โหลดใหม่
    if (!cacheHomeData || cacheHomeData.quarter !== targetQuarter || cacheHomeData.year !== targetYear) {
      loadHomePageData(true, targetQuarter, targetYear);
    } else {
      renderHomeCalendar();
    }
  }
  window.changeCalendarMonth = changeCalendarMonth;

  function renderHomePage(data) {
    renderHomeFeatured(data.featured);
    renderHomeAreas(data.areas || []);
    renderHomeCalendar();
  }

  function renderHomeFeatured(featured) {
    const container = document.getElementById('home-featured-container');
    if (!featured) {
      container.innerHTML = '<div class="text-center text-muted py-3">ยังไม่มีกิจกรรมเด่นในระบบ</div>';
      return;
    }
    const img = featured.imageUrl || LOFT_PLACEHOLDER_IMAGE;
    let dateText = '';
    if (featured.startDate || featured.endDate) {
      const startThai = formatThaiDate(featured.startDate);
      const endThai = formatThaiDate(featured.endDate);
      if (startThai && endThai && startThai !== endThai) dateText = '<i class="fas fa-calendar-alt"></i> ' + startThai + ' - ' + endThai;
      else dateText = '<i class="fas fa-calendar-alt"></i> ' + (startThai || endThai || '-');
    }
    container.innerHTML =
      '<div class="home-featured-card">' +
        '<img src="' + img + '" loading="lazy" class="home-featured-img" alt="featured">' +
        '<div class="home-featured-body">' +
          '<h4 class="home-featured-title">' + (featured.title || '-') + '</h4>' +
          (dateText ? '<div class="home-featured-meta">' + dateText + '</div>' : '') +
          '<div class="home-featured-meta"><i class="fas fa-map-marker-alt mr-1"></i>' + (featured.locationName || '-') + '</div>' +
          (featured.shortDesc ? '<p class="home-featured-desc">' + featured.shortDesc + '</p>' : '') +
          '<button class="btn-primary w-100" onclick="openMapLink(\'' + escapeJS(featured.mapLink || '') + '\', \'' + escapeJS(featured.locationName || '') + '\', \'' + escapeJS(featured.latitude || '') + '\', \'' + escapeJS(featured.longitude || '') + '\')">' +
            '<i class="fas fa-route mr-1"></i>นำทางไปกิจกรรมเด่น' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function renderHomeAreas(areas) {
    const areaSelect = document.getElementById('home-area-filter');
    if (!areaSelect) return;
    let options = '<option value="">ทุกพื้นที่</option>';
    areas.forEach(function(a) {
      options += '<option value="' + a.areaCode + '">' + a.areaName + '</option>';
    });
    areaSelect.innerHTML = options;
  }

  function renderHomeCalendar() {
    const label = document.getElementById('calendar-month-year-label');
    const daysGrid = document.getElementById('calendar-days-grid');
    if (!label || !daysGrid) return;

    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const currentYear = _calendarCurrentDate.getFullYear();
    const currentMonth = _calendarCurrentDate.getMonth();
    
    label.textContent = monthNames[currentMonth] + ' ' + (currentYear + 543);

    // คำนวณหาวันแรกของเดือน และวันสุดท้ายของเดือน
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevTotalDays = new Date(currentYear, currentMonth, 0).getDate();

    // ดึงตัวกรองพื้นที่
    const areaSelect = document.getElementById('home-area-filter');
    const areaCode = areaSelect ? (areaSelect.value || '').trim() : '';

    const activities = cacheHomeData && cacheHomeData.activities ? cacheHomeData.activities : [];
    const areas = cacheHomeData && cacheHomeData.areas ? cacheHomeData.areas : [];

    let html = '';

    // 1. วาดวันส่วนเกินจากเดือนก่อน
    for (let x = firstDayIndex; x > 0; x--) {
      const dayNum = prevTotalDays - x + 1;
      html += `<div class="calendar-day-cell other-month">${dayNum}</div>`;
    }

    // 2. วาดวันทั้งหมดของเดือนปัจจุบัน
    const today = new Date();
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // กรองกิจกรรมที่มีการจัดในวันนั้นๆ
      const dayActivities = activities.filter(function(item) {
        if (!item.activityDate) return false;
        // จัดการ formatting เผื่อกรณี format วันต่างกัน
        const itemD = new Date(item.activityDate);
        if (isNaN(itemD.getTime())) return false;
        
        const itemDateStr = `${itemD.getFullYear()}-${String(itemD.getMonth() + 1).padStart(2, '0')}-${String(itemD.getDate()).padStart(2, '0')}`;
        const matchDate = itemDateStr === dateStr;
        const matchArea = !areaCode || String(item.areaCode) === areaCode;
        return matchDate && matchArea;
      });

      const hasActivity = dayActivities.length > 0;
      const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;
      const isSelected = _calendarSelectedDateStr === dateStr;

      let classes = 'calendar-day-cell';
      if (isToday) classes += ' today';
      if (isSelected) classes += ' active-selected';
      if (hasActivity) classes += ' has-activity';

      html += `<div class="${classes}" onclick="selectCalendarDay('${dateStr}')">${day}</div>`;
    }

    // 3. วาดวันส่วนเกินของเดือนถัดไปเพื่อให้เติมเต็ม 6 แถว (42 ช่อง)
    const totalCells = firstDayIndex + totalDays;
    const remainingCells = 42 - totalCells;
    for (let nextDay = 1; nextDay <= remainingCells; nextDay++) {
      html += `<div class="calendar-day-cell other-month">${nextDay}</div>`;
    }

    daysGrid.innerHTML = html;
    
    // โหลดรายละเอียดกิจกรรมสำหรับวันปัจจุบันที่เคยเลือกค้างอยู่ (ถ้ามี)
    if (_calendarSelectedDateStr) {
      selectCalendarDay(_calendarSelectedDateStr, true);
    } else {
      document.getElementById('calendar-selected-activities-container').innerHTML = `
        <div class="text-center text-muted py-4 text-xs" style="background:var(--bg2); border-radius:14px; border:1px solid var(--glass-border); margin-top:12px; padding: 20px 10px;">
          <i class="fas fa-hand-pointer mr-1" style="color:var(--primary)"></i> คลิกเลือกวันที่ในปฏิทินที่มีจุดสีแดงเพื่อแสดงรายละเอียดกิจกรรม
        </div>
      `;
    }
  }
  window.renderHomeCalendar = renderHomeCalendar;

  function selectCalendarDay(dateStr, skipRenderCalendar) {
    _calendarSelectedDateStr = dateStr;
    
    // อัปเดตการแสดงผลปฏิทินเพื่อไฮไลท์วันที่เลือก (ข้ามไปหากกำลังทำ recursive render)
    if (!skipRenderCalendar) {
      renderHomeCalendar();
      return;
    }

    const container = document.getElementById('calendar-selected-activities-container');
    if (!container) return;

    const areaSelect = document.getElementById('home-area-filter');
    const areaCode = areaSelect ? (areaSelect.value || '').trim() : '';

    const activities = cacheHomeData && cacheHomeData.activities ? cacheHomeData.activities : [];
    const areas = cacheHomeData && cacheHomeData.areas ? cacheHomeData.areas : [];

    const selectedDayActivities = activities.filter(function(item) {
      if (!item.activityDate) return false;
      const itemD = new Date(item.activityDate);
      if (isNaN(itemD.getTime())) return false;
      
      const itemDateStr = `${itemD.getFullYear()}-${String(itemD.getMonth() + 1).padStart(2, '0')}-${String(itemD.getDate()).padStart(2, '0')}`;
      const matchDate = itemDateStr === dateStr;
      const matchArea = !areaCode || String(item.areaCode) === areaCode;
      return matchDate && matchArea;
    });

    const parsedDate = new Date(dateStr);
    const dateLabel = formatThaiDate(dateStr);

    if (selectedDayActivities.length === 0) {
      container.innerHTML = `
        <div class="calendar-selected-activity-item text-center py-5 text-muted text-xs">
          <i class="fas fa-calendar-times mb-2 fa-2x d-block text-muted" style="opacity:0.6;"></i>
          ไม่มีกิจกรรมในวันที่ ${dateLabel}
        </div>
      `;
      return;
    }

    let html = `<div class="flex items-center gap-1.5 mt-3 mb-2 px-1 text-xs font-bold text-theme"><i class="fas fa-bullhorn"></i> กิจกรรมประจำวันที่ ${dateLabel} (พบ ${selectedDayActivities.length} กิจกรรม)</div>`;
    
    selectedDayActivities.forEach(function(item) {
      const area = areas.find(function(a) { return String(a.areaCode) === String(item.areaCode); });
      
      html += `
        <div class="calendar-selected-activity-item">
          <div class="flex items-center justify-between mb-2 pb-2" style="border-bottom: 1px solid var(--glass-border);">
            <h4 class="font-black text-theme-inv text-sm" style="color:var(--primary-soft);">${item.activityName || 'ไม่มีชื่อกิจกรรม'}</h4>
            <span class="user-badge" style="font-size: 0.65rem; padding: 2px 8px; background:var(--primary); color:white;">Q${item.quarter || '-'}/${item.year || '-'}</span>
          </div>
          
          <div class="text-xs text-muted space-y-1.5" style="line-height:1.5;">
            <div class="flex items-center gap-2"><i class="fas fa-map-marker-alt" style="color:var(--coral); width:16px;"></i><span>ศกร.ระดับตำบล: <strong>${area ? area.areaName : item.areaCode}</strong></span></div>
            <div class="flex items-center gap-2"><i class="fas fa-school" style="color:var(--primary); width:16px;"></i><span>สถานที่จัด: ${item.locationName || '-'}</span></div>
            <div class="flex items-center gap-2"><i class="fas fa-gift" style="color:var(--gold); width:16px;"></i><span>สิ่งที่จะได้รับ: ${item.benefit || '-'}</span></div>
            <div class="flex items-center gap-2"><i class="fas fa-users" style="color:#38bdf8; width:16px;"></i><span>รับจำนวนจำกัด: ${item.capacity || '-'} คน</span></div>
            <div class="flex items-center gap-2"><i class="fas fa-phone-alt" style="color:#f43f5e; width:16px;"></i><span>ผู้ประสานงาน: ${item.contactName || '-'} (${item.contactPhone || '-'})</span></div>
          </div>
          
          ${item.mapLink ? `
            <button class="btn-primary w-100 mt-3" style="background:linear-gradient(135deg, var(--primary), var(--primary-dk)); border:none; padding:10px; font-size:0.75rem;" 
                    onclick="openMapLink('${escapeJS(item.mapLink)}', '${escapeJS(item.locationName)}')">
              <i class="fas fa-route mr-1.5"></i>นำทางไปสถานที่จัดกิจกรรม
            </button>
          ` : ''}
        </div>
      `;
    });

    container.innerHTML = html;
  }
  window.selectCalendarDay = selectCalendarDay;

  function formatThaiDateShort(input) {
    if (!input) return '-';
    const d = new Date(input);
    if (isNaN(d.getTime())) return input;
    const day = d.getDate();
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return day + ' ' + monthNames[d.getMonth()];
  }

  function openHomeActivityDetail(activityId) {
    if (!cacheHomeData || !cacheHomeData.activities) return;
    const item = cacheHomeData.activities.find(function(a) { return String(a.activityId) === String(activityId); });
    if (!item) return;
    const areas = cacheHomeData.areas || [];
    const area = areas.find(function(a) { return String(a.areaCode) === String(item.areaCode); });
    let msg = '';
    msg += '<div style="text-align:left;">';
    msg += '<div style="font-weight:700;color:#fff;margin-bottom:8px;">' + (item.activityName || '-') + '</div>';
    msg += '<div style="margin-bottom:6px; display:flex; align-items:center; gap:8px;"><i class="fas fa-map-marker-alt" style="color:#34d399; width:20px; text-align:center;"></i><span>พื้นที่: ' + (area ? area.areaName : item.areaCode) + '</span></div>';
    msg += '<div style="margin-bottom:6px; display:flex; align-items:center; gap:8px;"><i class="fas fa-calendar-alt" style="color:#34d399; width:20px; text-align:center;"></i><span>วันที่: ' + (formatThaiDate(item.activityDate) || '-') + '</span></div>';
    msg += '<div style="margin-bottom:6px; display:flex; align-items:center; gap:8px;"><i class="fas fa-school" style="color:#34d399; width:20px; text-align:center;"></i><span>สถานที่: ' + (item.locationName || '-') + '</span></div>';
    msg += '<div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;"><i class="fas fa-award" style="color:#34d399; width:20px; text-align:center;"></i><span>สิ่งที่จะได้รับ: ' + (item.benefit || '-') + '</span></div>';
    msg += '<div style="margin-bottom:6px; display:flex; align-items:center; gap:8px;"><i class="fas fa-users" style="color:#34d399; width:20px; text-align:center;"></i><span>รับสมัคร: ' + (item.capacity || '-') + ' คน</span></div>';
    msg += '<div style="margin-bottom:8px; display:flex; align-items:center; gap:8px;"><i class="fas fa-phone-alt" style="color:#34d399; width:20px; text-align:center;"></i><span>ติดต่อ: ' + (item.contactName || '-') + ' ' + (item.contactPhone || '') + '</span></div>';
    if (item.mapLink || (item.latitude && item.longitude)) {
      msg += '<button class="btn-primary w-100 mt-2" style="background:linear-gradient(135deg,var(--primary),var(--primary-dk)); border:none;" onclick="openMapLink(\'' + escapeJS(item.mapLink || '') + '\', \'' + escapeJS(item.locationName || '') + '\', \'' + escapeJS(item.latitude || '') + '\', \'' + escapeJS(item.longitude || '') + '\')"><i class="fas fa-map-marked-alt mr-2"></i>นำทางด้วยแผนที่</button>';
    }
    msg += '</div>';
    showCustomAlert(msg, 'info', 'รายละเอียดกิจกรรม');
  }

  function onAdminQuarterInstitutionChange() {
    loadAdminHomeData();
  }
  window.onAdminQuarterInstitutionChange = onAdminQuarterInstitutionChange;

  function loadAdminHomeData() {
    const qy = getCurrentQuarterAndYear();
    const quarterInput = document.getElementById('admin-quarter-select');
    const yearInput = document.getElementById('admin-year-input');
    if (quarterInput && !quarterInput.value) quarterInput.value = String(qy.quarter);
    if (yearInput && !yearInput.value) yearInput.value = String(qy.year);

    const qVal = quarterInput ? quarterInput.value : qy.quarter;
    const yVal = yearInput ? yearInput.value : qy.year;

    const isSuper = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : false;
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";

    const quarterInstGroup = document.getElementById('admin-quarter-institution-filter')?.closest('.input-group');
    if (quarterInstGroup) {
      quarterInstGroup.style.display = isSuper ? 'block' : 'none';
    }

    const instSelect = document.getElementById('admin-quarter-institution-filter');
    const instId = isSuper ? (instSelect ? instSelect.value : 'ALL') : userInst;

    apiGet('getAdminHomeData', withAuthParams({ quarter: qVal, year: yVal, institutionId: instId }))
      .then(function(res) {
        if (res.status !== "success") return;
        adminHomeAreas = res.areas || [];
        adminHomeActivities = res.activitiesAdmin || [];
        populateAdminAreaOptions();
        fillAdminFeaturedForm(res.featured);
        renderAdminQuarterActivities();
      });
  }

  function populateAdminAreaOptions() {
    const select = document.getElementById('admin-area-code');
    if (!select) return;
    let html = '<option value="">— เลือกพื้นที่ —</option>';
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const myTambon = (localStorage.getItem("userTambon") || "").trim();
    
    let teacherAreaCode = "";
    adminHomeAreas.forEach(function(a) {
      html += '<option value="' + a.areaCode + '">' + a.areaName + ' (' + a.areaCode + ')</option>';
      if (role === "teacher" && !teacherAreaCode) teacherAreaCode = a.areaCode;
    });
    select.innerHTML = html;

    // ถ้าเป็นครู ให้เลือกพื้นที่ของตนเองให้อัตโนมัติ
    if (role === "teacher" && teacherAreaCode) {
      select.value = teacherAreaCode;
    }
  }

  function fillAdminFeaturedForm(featured) {
    const idEl = document.getElementById('admin-featured-id');
    if (idEl) idEl.value = featured ? (featured.featuredId || '') : '';
    const titleEl = document.getElementById('admin-featured-title');
    if (titleEl) titleEl.value = featured ? (featured.title || '') : '';
    const imgUrl = featured ? (featured.imageUrl || '') : '';
    const imgEl = document.getElementById('admin-featured-image');
    if (imgEl) imgEl.value = imgUrl;
    const preview = document.getElementById('admin-featured-preview');
    if (preview) {
      if (imgUrl) {
        preview.style.backgroundImage = "url('" + imgUrl + "')";
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    }
    const locEl = document.getElementById('admin-featured-location');
    if (locEl) locEl.value = featured ? (featured.locationName || '') : '';
    const mapEl = document.getElementById('admin-featured-maplink');
    if (mapEl) mapEl.value = featured ? (featured.mapLink || '') : '';
    const startEl = document.getElementById('admin-featured-startdate');
    if (startEl) startEl.value = featured ? (featured.startDate || '') : '';
    const endEl = document.getElementById('admin-featured-enddate');
    if (endEl) endEl.value = featured ? (featured.endDate || '') : '';
    const descEl = document.getElementById('admin-featured-desc');
    if (descEl) descEl.value = featured ? (featured.shortDesc || '') : '';
  }

  let cropper = null;
  let currentCropContext = null;
  let currentFileName = "";

















  function handleFeaturedImageUpload(input) {
    if (input.files && input.files[0]) {
      currentCropContext = 'featured';
      currentFileName = "featured_" + Date.now() + "_" + input.files[0].name;
      openCropModal(input.files[0]);
    }
  }

  function handleProductImageUpload(input) {
    if (input.files && input.files[0]) {
      currentCropContext = 'product';
      currentFileName = "product_" + Date.now() + "_" + input.files[0].name;
      window.currentCropImageIndex = -1; // Reset crop index to append mode
      openCropModal(input.files[0]);
    }
  }

  function openCropModal(source) {
    const cropImg = document.getElementById('crop-image');
    const modal = document.getElementById('crop-modal');
    
    if (modal) {
      if (currentCropContext === 'profile') {
        modal.classList.add('crop-circle-mask');
      } else {
        modal.classList.remove('crop-circle-mask');
      }
    }
    showLoading(true); // 🔄 แสดง Loading ระหว่างเตรียมรูป
    
    const startCropper = () => {
      modal.style.display = 'flex';
      if (cropper) cropper.destroy();
      
      const aspect = currentCropContext === 'profile' ? 1 : ((currentCropContext === 'certificateTemplate' || currentCropContext === 'activityCertificateTemplate') ? 1600 / 1131 : 16 / 9);
      
      setTimeout(function() {
        cropper = new Cropper(cropImg, {
          aspectRatio: aspect,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 1,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false,
          checkOrientation: true,
          crossOrigin: 'anonymous'
        });
        showLoading(false); // ✅ ปิด Loading เมื่อพร้อมใช้งาน
      }, 100);
    };

    if (typeof source === 'string') {
      // It's a URL
      cropImg.src = source;
      // สำหรับรูปจาก URL อาจต้องรอโหลดรูปสักครู่
      cropImg.onload = function() {
        startCropper();
        cropImg.onload = null;
      };
      cropImg.onerror = function() {
        showLoading(false);
        showCustomAlert("ไม่สามารถโหลดรูปภาพได้", "error");
      };
    } else {
      // It's a File
      const reader = new FileReader();
      reader.onload = function(e) {
        cropImg.src = e.target.result;
        startCropper();
      };
      reader.onerror = function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการอ่านไฟล์", "error");
      };
      reader.readAsDataURL(source);
    }
  }





















  function saveFeaturedActivity() {
    const idEl = document.getElementById('admin-featured-id');
    const titleEl = document.getElementById('admin-featured-title');
    const imgEl = document.getElementById('admin-featured-image');
    const locEl = document.getElementById('admin-featured-location');
    const mapEl = document.getElementById('admin-featured-maplink');
    const startEl = document.getElementById('admin-featured-startdate');
    const endEl = document.getElementById('admin-featured-enddate');
    const descEl = document.getElementById('admin-featured-desc');

    const payload = {
      featuredId: (idEl ? idEl.value : '').trim(),
      title: (titleEl ? titleEl.value : '').trim(),
      imageUrl: (imgEl ? imgEl.value : '').trim(),
      locationName: (locEl ? locEl.value : '').trim(),
      mapLink: (mapEl ? mapEl.value : '').trim(),
      startDate: startEl ? startEl.value : '',
      endDate: endEl ? endEl.value : '',
      shortDesc: (descEl ? descEl.value : '').trim()
    };
    showLoading(true);
    apiPost('saveFeaturedActivity', withAuthData(payload))
      .then(function(res) {
        showLoading(false);
        if (res.status === 'success') {
          showCustomAlert('บันทึกกิจกรรมเด่นเรียบร้อย', 'success');
          cacheHomeData = null;
          loadAdminHomeData();
        } else showCustomAlert(res.message || 'บันทึกไม่สำเร็จ', 'error');
      }).catch(function() {
        showLoading(false); showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
      });
  }

  function clearQuarterActivityForm() {
    document.getElementById('admin-quarter-activity-id').value = '';
    
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    if (role !== 'teacher') {
      document.getElementById('admin-area-code').value = '';
    }
    
    document.getElementById('admin-activity-name').value = '';
    document.getElementById('admin-activity-date').value = '';
    document.getElementById('admin-activity-location').value = '';
    document.getElementById('admin-activity-maplink').value = '';
    document.getElementById('admin-activity-benefit').value = '';
    document.getElementById('admin-activity-capacity').value = '';
    document.getElementById('admin-contact-name').value = '';
    document.getElementById('admin-contact-phone').value = '';
    document.getElementById('admin-activity-status').value = 'Active';
  }

  function saveQuarterActivity() {
    const activityDateVal = document.getElementById('admin-activity-date').value || '';
    if (!activityDateVal) return showCustomAlert("กรุณาเลือกวันที่จัดกิจกรรม", "warning");

    const d = new Date(activityDateVal);
    if (isNaN(d.getTime())) return showCustomAlert("รูปแบบวันที่ไม่ถูกต้อง", "warning");

    const quarter = Math.floor(d.getMonth() / 3) + 1;
    const year = d.getFullYear();

    const areaCode = (document.getElementById('admin-area-code').value || '').trim();
    const activityName = (document.getElementById('admin-activity-name').value || '').trim();

    if (!areaCode) return showCustomAlert("กรุณาเลือกพื้นที่", "warning");
    if (!activityName) return showCustomAlert("กรุณากรอกชื่อกิจกรรม", "warning");

    const payload = {
      mode: (document.getElementById('admin-quarter-activity-id').value || '').trim() ? 'edit' : 'create',
      activityId: (document.getElementById('admin-quarter-activity-id').value || '').trim(),
      quarter: quarter,
      year: year,
      areaCode: areaCode,
      activityName: activityName,
      activityDate: activityDateVal,
      locationName: (document.getElementById('admin-activity-location').value || '').trim(),
      mapLink: (document.getElementById('admin-activity-maplink').value || '').trim(),
      benefit: (document.getElementById('admin-activity-benefit').value || '').trim(),
      capacity: (document.getElementById('admin-activity-capacity').value || '').trim(),
      contactName: (document.getElementById('admin-contact-name').value || '').trim(),
      contactPhone: (document.getElementById('admin-contact-phone').value || '').trim(),
      status: (document.getElementById('admin-activity-status').value || 'Active').trim()
    };
    showLoading(true);
    apiPost('saveQuarterActivity', withAuthData(payload))
      .then(function(res) {
        showLoading(false);
        if (res.status === 'success') {
          showCustomAlert('บันทึกกิจกรรมเรียบร้อย', 'success');
          cacheHomeData = null;
          clearQuarterActivityForm();
          closeAdminQuarterActivityModal();
          loadAdminHomeData();
        } else showCustomAlert(res.message || 'บันทึกไม่สำเร็จ', 'error');
      }).catch(function() {
        showLoading(false); showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
      });
  }

  function renderAdminQuarterActivities() {
    const container = document.getElementById('admin-quarter-activities-list');
    if (!container) return;
    const key = (document.getElementById('admin-quarter-activity-search').value || '').trim().toLowerCase();
    let list = adminHomeActivities || [];
    if (key) {
      list = list.filter(function(a) {
        const area = (adminHomeAreas || []).find(function(x) { return String(x.areaCode) === String(a.areaCode); });
        const t = [a.activityName, a.areaCode, area ? area.areaName : '', a.contactName].join(' ').toLowerCase();
        return t.indexOf(key) > -1;
      });
    }
    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3">ไม่พบรายการกิจกรรม</div>';
      return;
    }
    let html = '';
    list.forEach(function(a) {
      const area = (adminHomeAreas || []).find(function(x) { return String(x.areaCode) === String(a.areaCode); });
      html += '<div class="admin-item">' +
                '<div class="admin-item-head">' +
                  '<div>' +
                    '<div class="admin-item-title">' + (a.activityName || '-') + '</div>' +
                    '<div class="admin-item-sub">Q' + (a.quarter || '-') + '/' + (a.year || '-') + ' | ' + (area ? area.areaName : a.areaCode) + ' <span style="font-size: 0.75rem; color: var(--text-soft); font-weight: normal; margin-left: 4px;">(' + formatTambon(area ? area.areaName : a.areaCode) + ')</span></div>' +
                  '</div>' +
                  '<div class="admin-item-actions">' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;" onclick="editQuarterActivity(\'' + escapeJS(a.activityId) + '\')"><i class="fas fa-pen"></i></button>' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="deleteQuarterActivity(\'' + escapeJS(a.activityId) + '\')"><i class="fas fa-trash"></i></button>' +
                  '</div>' +
                '</div>' +
              '</div>';
    });
    container.innerHTML = html;
  }

  function scrollAdminActivityEditor() {
    const panel = document.querySelector('#admin-tab-activities .admin-editor-panel');
    if (window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) {
      if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editQuarterActivity(activityId) {
    openAdminQuarterActivityModal(activityId);
  }

  function openAdminQuarterActivityModal(activityId) {
    populateAdminAreaOptions();
    const modal = document.getElementById('admin-quarter-editor-modal');
    if (!modal) return;

    if (!activityId) {
      document.getElementById('admin-quarter-modal-title').textContent = 'เพิ่มกิจกรรมรายไตรมาส';
      clearQuarterActivityForm();
    } else {
      document.getElementById('admin-quarter-modal-title').textContent = 'แก้ไขกิจกรรมรายไตรมาส';
      const item = (adminHomeActivities || []).find(function(a) { return String(a.activityId) === String(activityId); });
      if (item) {
        document.getElementById('admin-quarter-activity-id').value = item.activityId || '';
        document.getElementById('admin-area-code').value = item.areaCode || item.tambon || '';
        document.getElementById('admin-activity-name').value = item.activityName || '';
        document.getElementById('admin-activity-date').value = item.activityDate || '';
        document.getElementById('admin-activity-location').value = item.locationName || '';
        document.getElementById('admin-activity-maplink').value = item.mapLink || '';
        document.getElementById('admin-activity-benefit').value = item.benefit || '';
        document.getElementById('admin-activity-capacity').value = item.capacity || '';
        document.getElementById('admin-contact-name').value = item.contactName || '';
        document.getElementById('admin-contact-phone').value = item.contactPhone || '';
        document.getElementById('admin-activity-status').value = item.status || 'Active';
      }
    }
    modal.style.display = 'flex';
  }
  window.openAdminQuarterActivityModal = openAdminQuarterActivityModal;

  function closeAdminQuarterActivityModal() {
    const modal = document.getElementById('admin-quarter-editor-modal');
    if (modal) modal.style.display = 'none';
  }
  window.closeAdminQuarterActivityModal = closeAdminQuarterActivityModal;

  function deleteQuarterActivity(activityId) {
    if (!activityId) return;
    showCustomConfirm("ต้องการลบกิจกรรมนี้ใช่หรือไม่?", function() {
      showLoading(true);
      apiPost('deleteQuarterActivity', withAuthData({ activityId: activityId }))
        .then(function(res) {
          showLoading(false);
          if (res.status === 'success') {
            showCustomAlert('ลบกิจกรรมเรียบร้อย', 'success');
            cacheHomeData = null;
            loadAdminHomeData();
          } else showCustomAlert(res.message || 'ลบไม่สำเร็จ', 'error');
        }).catch(function() {
          showLoading(false); showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
        });
    });
  }

  function clearAdminForm() {
    document.getElementById('admin-source-id').value = '(ระบบสร้างอัตโนมัติ)';
    document.getElementById('admin-source-name').value = '';
    document.getElementById('admin-source-tambon').value = '';
    document.getElementById('admin-source-cover').value = '';
    var _ctEl = document.getElementById('admin-source-cert-template'); if (_ctEl) _ctEl.value = '';
    document.getElementById('admin-source-preview').style.display = 'none';
    document.getElementById('admin-source-coord').value = '';
    document.getElementById('admin-history').value = '';
    document.getElementById('admin-result').value = '';
    document.getElementById('admin-contact').value = '';
    document.getElementById('admin-gallery').value = '';
    document.getElementById('admin-external').value = '';
    document.getElementById('admin-source-subject').value = '';
    document.getElementById('admin-source-credits').value = 0;
    document.getElementById('admin-gps').value = '';
    var _typeEl = document.getElementById('admin-source-type'); if (_typeEl) _typeEl.value = '';
    document.getElementById('admin-edit-mode').value = 'create';
    document.getElementById('admin-original-source-id').value = '';
    if (typeof setAdminSourceCertificateTemplate === 'function') {
      setAdminSourceCertificateTemplate(null);
    }
  }



















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































  // ฟังก์ชันช่วยในการลบคำนำหน้าชื่อพื้นที่เพื่อการเปรียบเทียบที่ยืดหยุ่น











































































































































































































































































































































































































































































































  let currentLeaderboardInstFilter = null;

  function onLeaderboardInstitutionChange() {
    const filterEl = document.getElementById('leaderboard-institution-filter');
    if (filterEl) {
      currentLeaderboardInstFilter = filterEl.value;
    }
    cacheLeaderboard = null;
    loadLeaderboard(true);
  }
  window.onLeaderboardInstitutionChange = onLeaderboardInstitutionChange;

  function loadLeaderboard(force) {
    const filterEl = document.getElementById('leaderboard-institution-filter');
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    
    if (filterEl && !currentLeaderboardInstFilter) {
      if (userInst && userInst !== 'ALL' && userInst !== 'ทั้งหมด') {
        filterEl.value = userInst;
      } else {
        filterEl.value = 'ALL';
      }
      currentLeaderboardInstFilter = filterEl.value;
    }

    const instId = filterEl ? filterEl.value : (currentLeaderboardInstFilter || userInst);

    if (!force && cacheLeaderboard !== null && cacheLeaderboard._instId === instId) {
      return renderLeaderboard(cacheLeaderboard.data);
    }

    const container = document.getElementById('leaderboard-container');
    if (container) {
      container.innerHTML = '<div class="text-center mt-5"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary)"></i><p class="mt-2 text-muted text-sm">กำลังโหลดข้อมูลอันดับ...</p></div>';
    }

    apiGet('getLeaderboard', withAuthParams({ institutionId: instId }))
      .then(function(data) {
        const list = Array.isArray(data) ? data : [];
        cacheLeaderboard = { _instId: instId, data: list };
        renderLeaderboard(list);
      })
      .catch(function() {
        if (container) container.innerHTML = '<div class="text-center mt-5 text-muted">โหลดข้อมูลอันดับไม่สำเร็จ</div>';
      });
  }
  window.loadLeaderboard = loadLeaderboard;

function renderLeaderboard(data) {
    const container = document.getElementById('leaderboard-container');
    if(!data || data.length === 0) {
        container.innerHTML = '<div class="text-center mt-5">ยังไม่มีข้อมูลคะแนน</div>';
        return;
    }
    
    // ตัดข้อมูลเอาแค่ 10 อันดับแรก
    const top10 = data.slice(0, 10);
    const podiumData = top10.slice(0, 3); // อันดับ 1-3
    const listData = top10.slice(3);     // อันดับ 4-10

    let html = '';

    const resolveCosmeticCss = function(itemId) {
      if (!itemId) return '';
      if (typeof window.getCosmeticCss === 'function') return window.getCosmeticCss(itemId);
      if (typeof getCosmeticCss === 'function') return getCosmeticCss(itemId);
      const map = {
        'frame_gold': 'frame-gold', 'frame_cyber': 'frame-cyber', 'frame_fire': 'frame-fire',
        'frame_emerald': 'frame-emerald', 'frame_rainbow': 'frame-rainbow', 'frame_admin': 'frame-admin', 'frame_teacher': 'frame-teacher',
        'glow_gold': 'glow-gold', 'glow_neon': 'glow-neon', 'glow_rainbow': 'glow-rainbow',
        'glow_fire': 'glow-fire', 'glow_purple': 'glow-purple', 'glow_admin': 'glow-admin', 'glow_teacher': 'glow-teacher',
        'badge_crown': '👑 มกุฎราชกุมาร', 'badge_lightning': '⚡️ สายฟ้าแห่งปัญญา', 'badge_fire': '🔥 ผู้เรียนไฟแรง',
        'badge_diamond': '💎 ปราชญ์เพชรพร้าว', 'badge_rocket': '🚀 นักเรียนติดเทอร์โบ', 'badge_admin': '🛡️ ผู้ดูแลระบบ', 'badge_teacher': '🎓 ครูผู้สอน'
      };
      return map[itemId] || '';
    };

    // --- ส่วนที่ 1: แท่นรางวัล Podium V2 (อันดับ 1-3) ---
    html += '<div class="podium-container">';
    
    podiumData.forEach(function(user, index) {
      let rankNum = index + 1;
      let rStyle = getRankStyle(user.level); // ดึงสีมาแต่งขอบรูปและป้ายคะแนน
      let defaultImg = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random&color=fff';
      let rawImg = (user.image && String(user.image).trim() !== "") ? String(user.image).trim() : "";
      let imgUrl = defaultImg;
      if (rawImg) {
        if (rawImg.startsWith('http') || rawImg.startsWith('data:')) {
          imgUrl = rawImg;
        } else if (rawImg.startsWith('/')) {
          imgUrl = rawImg;
        } else {
          imgUrl = '/' + rawImg;
        }
      }
      let lvlClass = getLvlClass(user.level);
      let glowColor = rStyle.color === '#10b981' ? 'rgba(16, 185, 129, 0.4)' : 
                      rStyle.color === '#fbbf24' ? 'rgba(251, 191, 36, 0.4)' : 
                      rStyle.color === '#cbd5e1' ? 'rgba(203, 213, 225, 0.4)' : 
                      'rgba(16, 185, 129, 0.3)';
      
      let eq = (user.cosmetics && user.cosmetics.equipped) ? user.cosmetics.equipped : {};
      let frameClass = resolveCosmeticCss(eq.frame);
      let glowClass = resolveCosmeticCss(eq.name_glow);
      let badgeSymbol = resolveCosmeticCss(eq.badge);

      let scoreBadgeStyle = (rankNum === 1) ? '' : 'style="background:' + rStyle.color + ';"';
      let ringSizeClass = (rankNum === 1) ? 'avatar-ring-lg' : 'avatar-ring-md';
      
      html += '<div class="podium-item rank-' + rankNum + '" style="cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'" onclick="openEPortfolioModal(\'' + (user.phone || '') + '\')" title="คลิกเพื่อดูใบประกาศสะสมผลการเรียนรู้ของ ' + user.name + '">' +
                '<div class="podium-avatar-wrapper">' +
                  '<i class="fas fa-crown crown-icon"></i>' + 
                  '<div class="avatar-ring-wrapper avatar-frame-wrap ' + frameClass + ' ' + ringSizeClass + '" style="--avatar-border-color: ' + rStyle.color + '; --avatar-shadow-color: ' + glowColor + '; margin-bottom: 0;">' +
                    '<div class="profile-avatar-ring ' + lvlClass + '"></div>' +
                    '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="podium-img" style="border-color:' + rStyle.color + ';">' +
                  '</div>' +
                '</div>' +
                '<div class="podium-base">' + rankNum + '</div>' + 
                '<div class="podium-info">' +
                  '<div class="podium-name ' + glowClass + '">' + user.name + (badgeSymbol ? '<span class="cosmetics-badge-tag">' + badgeSymbol + '</span>' : '') + '</div>' +
                  '<div style="font-size: 0.65rem; color: var(--text-soft); margin-bottom: 4px;">' + formatTambon(user.tambon) + '</div>' +
                  '<div class="podium-score-badge countup-score" data-target="' + user.score + '" ' + scoreBadgeStyle + '>0 แต้ม</div>' +
                '</div>' +
              '</div>';
    });
    
    html += '</div>'; // ปิด podium-container

    // --- ส่วนที่ 2: รายการอันดับ List (อันดับ 4-10) ---
    html += '<div class="rank-list-container">';
    listData.forEach(function(user, index) {
      let rankNum = index + 4;
      let rStyle = getRankStyle(user.level); 
      let defaultImg = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random&color=fff';
      let rawImg = (user.image && String(user.image).trim() !== "") ? String(user.image).trim() : "";
      let imgUrl = defaultImg;
      if (rawImg) {
        if (rawImg.startsWith('http') || rawImg.startsWith('data:')) {
          imgUrl = rawImg;
        } else if (rawImg.startsWith('/')) {
          imgUrl = rawImg;
        } else {
          imgUrl = '/' + rawImg;
        }
      }
      let lvlClass = getLvlClass(user.level);
      let glowColor = rStyle.color === '#10b981' ? 'rgba(16, 185, 129, 0.4)' : 
                      rStyle.color === '#fbbf24' ? 'rgba(251, 191, 36, 0.4)' : 
                      rStyle.color === '#cbd5e1' ? 'rgba(203, 213, 225, 0.4)' : 
                      'rgba(16, 185, 129, 0.3)';

      let eq = (user.cosmetics && user.cosmetics.equipped) ? user.cosmetics.equipped : {};
      let frameClass = resolveCosmeticCss(eq.frame);
      let glowClass = resolveCosmeticCss(eq.name_glow);
      let badgeSymbol = resolveCosmeticCss(eq.badge);

      html += '<div class="rank-card" style="margin-bottom: 8px; padding: 10px 15px; border-left: 4px solid ' + rStyle.color + '; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'scale(1)\'" onclick="openEPortfolioModal(\'' + (user.phone || '') + '\')" title="คลิกเพื่อดูใบประกาศสะสมผลการเรียนรู้ของ ' + user.name + '">' +
                 '<div class="rank-number" style="font-size: 1.1rem; width: 30px; color: #7f8c8d;">' + rankNum + '</div>' +
                 '<div class="avatar-ring-wrapper avatar-frame-wrap ' + frameClass + ' avatar-ring-sm" style="--avatar-border-color: ' + rStyle.color + '; --avatar-shadow-color: ' + glowColor + '; margin: 0 10px;">' +
                   '<div class="profile-avatar-ring ' + lvlClass + '"></div>' +
                   '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="rank-img-sm">' +
                 '</div>' +
                 '<div class="rank-info">' +
                   '<div class="rank-name ' + glowClass + '" style="font-size: 0.95rem;">' + user.name + (badgeSymbol ? '<span class="cosmetics-badge-tag">' + badgeSymbol + '</span>' : '') + ' <span style="font-size: 0.75rem; color: var(--text-soft); font-weight: normal; margin-left: 4px;">(' + formatTambon(user.tambon) + ')</span></div>' +
                   '<div class="rank-score" style="font-size: 0.8rem;"><span class="countup-score" data-target="' + user.score + '">0</span> แต้ม</div>' +
                 '</div>' +
                 '<div style="background:' + rStyle.color + '; color:white; font-size:0.6rem; padding:2px 6px; border-radius:10px; font-weight:bold;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title + '</div>' +
               '</div>';
    });
    html += '</div>';

    container.innerHTML = html;

    // --- ส่วนที่ 3: เอนิเมชันตัวเลขนับวิ่งขึ้น (Count-Up Animation) ---
    var countupElements = container.querySelectorAll('.countup-score');
    countupElements.forEach(function(el) {
      var target = Number(el.getAttribute('data-target') || 0);
      if (isNaN(target)) return;
      var duration = 900; // วิ่งให้เสร็จภายใน 0.9 วินาที
      var startTime = null;

      function animateStep(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = timestamp - startTime;
        var curVal = Math.min(Math.round((progress / duration) * target), target);
        
        if (el.classList.contains('podium-score-badge')) {
          el.innerText = curVal.toLocaleString() + ' แต้ม';
        } else {
          el.innerText = curVal.toLocaleString();
        }

        if (progress < duration) {
          window.requestAnimationFrame(animateStep);
        } else {
          // สิ้นสุดเอนิเมชันให้ใช้ค่าเป้าหมายที่แท้จริง
          if (el.classList.contains('podium-score-badge')) {
            el.innerText = target.toLocaleString() + ' แต้ม';
          } else {
            el.innerText = target.toLocaleString();
          }
        }
      }
      window.requestAnimationFrame(animateStep);
    });
  }

































  function renderHistoryInitial() {
    const container = document.getElementById('cert-list-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-4">' +
                            '<button class="btn-primary" style="background:var(--glass); color:var(--text); border:1px solid var(--card-border); box-shadow:none;" onclick="loadUserCertificates()">' +
                              '<i class="fas fa-history mr-2"></i> กดดูประวัติเกียรติบัตร' +
                            '</button>' +
                          '</div>';
    const paginationControls = document.getElementById('cert-pagination-controls');
    if (paginationControls) paginationControls.style.display = 'none';
  }







































































































































































  function renderHistoryUI(history) {
      const container = document.getElementById('cert-list-container');
      const paginationControls = document.getElementById('cert-pagination-controls');
      
      if (!history || history.length === 0) {
          container.innerHTML = '<p class="text-center text-muted">สะสมคะแนนแบบทดสอบให้ถึง 80% เพื่อรับใบประกาศ</p>';
          if (paginationControls) paginationControls.style.display = 'none';
          return;
      }
      
      totalCertPages = Math.ceil(history.length / CERTS_PER_PAGE);
      if (currentCertPage > totalCertPages) currentCertPage = totalCertPages;
      if (currentCertPage < 1) currentCertPage = 1;

      const startIndex = (currentCertPage - 1) * CERTS_PER_PAGE;
      const paginatedHistory = history.slice(startIndex, startIndex + CERTS_PER_PAGE);
      
      let html = '';
      paginatedHistory.forEach(function(item) {
        const hasCert = item.certUrl && String(item.certUrl).trim() !== "" && item.certUrl !== "undefined";
        const safeSourceId = escapeJS(item.sourceId || '');
        const safeBaseId   = escapeJS(item.baseId   || '');
        const safeActivityId = escapeJS(item.activityId || '');
        const safeName     = escapeJS(item.sourceName || '');
        
        html += '<div class="rank-card" style="margin-bottom: 12px; border-left: 5px solid var(--gold); align-items:center;">' +
                   '<div style="flex-grow:1;">' +
                     '<div style="font-weight:bold; font-size:1rem;">' + item.sourceName + '</div>' +
                     '<div style="font-size:0.85rem; color:var(--primary);">สอบผ่าน (' + item.score + ')</div>' +
                   '</div>' +
                   '<div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">';
        
        if (hasCert) {
          // ดูใบประกาศ (เปิดตรง)
          html += '<a href="' + item.certUrl + '" target="_blank" class="btn-primary" style="padding: 7px 14px; width: auto; background-color: var(--primary); text-decoration:none; display:inline-flex; align-items:center; gap:6px; font-size:0.82rem;">' +
                    '<i class="fas fa-eye"></i> ดูใบประกาศ' +
                  '</a>';
          // ปุ่ม "สร้างใหม่" + "ยกเลิก" แถวเล็ก
          html += '<div style="display:flex; gap:6px;">' +
                    '<button class="btn-primary" style="padding: 5px 10px; width: auto; background:var(--glass); color:var(--text); box-shadow:none; border:1px solid var(--card-border); font-size:0.75rem;" ' +
                      'onclick="reGenerateCert(\'' + safeName + '\', \'' + escapeJS(item.score) + '\', \'' + safeSourceId + '\', \'' + safeBaseId + '\', \'' + safeActivityId + '\'); return false;">' +
                      '<i class="fas fa-redo-alt"></i> สร้างใหม่' +
                    '</button>' +
                  '</div>';
        } else {
          // ยังไม่มีใบ → กดสร้าง
          html += '<button class="btn-primary" style="padding: 8px 15px; width: auto; background-color: var(--primary-dk);" ' +
                    'onclick="handleCertClick(\'' + safeName + '\', \'' + escapeJS(item.score) + '\', \'\', \'' + safeSourceId + '\', \'' + safeBaseId + '\', \'' + safeActivityId + '\')">' +
                    '<i class="fas fa-file-pdf"></i> รับใบประกาศ' +
                  '</button>';
        }
        
        html += '</div></div>';
      });
      container.innerHTML = html;

      if (totalCertPages > 1 && paginationControls) {
          paginationControls.style.display = 'flex';
          document.getElementById('cert-page-info').innerText = 'หน้า ' + currentCertPage + ' / ' + totalCertPages;
          document.getElementById('btn-cert-prev').disabled = currentCertPage <= 1;
          document.getElementById('btn-cert-next').disabled = currentCertPage >= totalCertPages;
      } else if (paginationControls) {
          paginationControls.style.display = 'none';
      }
  }














































































































































































































































































































  let currentDetailProductId = "";
  let currentDetailProductName = "";










































































































































































































































  // --- Evaluation Logic ---
  function openEvaluation() {
    evalRating = 0;
    document.getElementById('eval-comment').value = '';
    document.querySelectorAll('.eval-star').forEach(s => s.classList.remove('active'));
    document.getElementById('evaluation-modal').style.display = 'flex';
  }

  function setEvalRating(rating) {
    evalRating = rating;
    document.querySelectorAll('.eval-star').forEach(function(s, index) {
      if (index < rating) s.classList.add('active');
      else s.classList.remove('active');
    });
  }

  function submitEvaluation() {
    if (evalRating === 0) return showCustomAlert("กรุณาให้คะแนนความพึงพอใจด้วยครับ", "warning");
    
    const comment = document.getElementById('eval-comment').value.trim();
    const phone = localStorage.getItem("userPhone");
    
    showLoading(true);
    apiPost('submitEvaluation', { 
      phone: phone, 
      sourceId: activeSourceId, 
      rating: evalRating, 
      comment: comment 
    }).then(function(res) {
      showLoading(false);
      closeEvaluation();
      showCustomAlert("ขอบคุณสำหรับความคิดเห็นครับ!", "success");
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการส่งข้อมูล", "error");
    });
  }

  function closeEvaluation() {
    document.getElementById('evaluation-modal').style.display = 'none';
  }

  // --- Proposal Logic ---
  function submitProposal() {
    const title = document.getElementById('proposal-title').value.trim();
    const desc = document.getElementById('proposal-desc').value.trim();
    
    if (!title) return showCustomAlert("กรุณาระบุหัวข้อที่ต้องการเสนอแนะ", "warning");
    
    const phone = localStorage.getItem("userPhone");
    showLoading(true);
    apiPost('submitProposal', {
      phone: phone,
      title: title,
      description: desc
    }).then(function(res) {
      showLoading(false);
      document.getElementById('proposal-title').value = '';
      document.getElementById('proposal-desc').value = '';
      showCustomAlert("ส่งข้อเสนอแนะสำเร็จ!", "success");
      loadUserProposals();
    }).catch(function() {
      showLoading(false);
      showCustomAlert("เกิดข้อผิดพลาดในการส่งข้อมูล", "error");
    });
  }

  function loadUserProposals() {
    const phone = localStorage.getItem("userPhone");
    const container = document.getElementById('proposal-list-container');
    container.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin"></i> กำลังโหลด...</div>';
    
    apiGet('getUserProposals', { phone: phone })
      .then(function(data) {
        cacheProposals = data;
        renderProposalList(data);
      }).catch(function() {
        container.innerHTML = '<div class="text-center py-4 text-muted">ไม่สามารถโหลดข้อมูลได้</div>';
      });
  }

  function renderProposalList(data) {
    const container = document.getElementById('proposal-list-container');
    
    // ตรวจสอบว่าข้อมูลที่ได้มาเป็น Array หรือไม่ (ถ้าเป็น Error Object จะได้ไม่พัง)
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-muted" style="background:var(--glass); border-radius:14px; border:1px dashed var(--card-border);">ยังไม่มีประวัติการเสนอแนะ</div>';
      return;
    }
    
    let html = '';
    data.forEach(function(item) {
      if (!item) return;
      
      const rawStatus = String(item.status || "Pending");
      const statusClass = 'status-' + rawStatus.toLowerCase();
      let statusThai = 'รอดำเนินการ';
      
      if (rawStatus === 'Approved') statusThai = 'รับเรื่องแล้ว';
      else if (rawStatus === 'Rejected') statusThai = 'ปฏิเสธ';
      
      html += '<div class="proposal-item">' +
                '<div class="flex justify-between items-start mb-2">' +
                  '<h5 class="font-bold text-white">' + (item.title || "ไม่มีหัวข้อ") + '</h5>' +
                  '<span class="proposal-status ' + statusClass + '">' + statusThai + '</span>' +
                '</div>' +
                '<p class="text-xs text-muted mb-2">' + (item.description || '-') + '</p>' +
                '<div class="text-xs" style="color:var(--text-soft); opacity:0.6;">' +
                  '<i class="far fa-clock mr-1"></i>' + (item.timestamp || '-') +
                '</div>' +
              '</div>';
    });
    container.innerHTML = html;
  }

  // ================= ระบบกระเป๋าคูปองและประวัติแต้ม (Wallet & Ledger Frontend) =================




























































































































































































































  // ================= ระบบหอเกียรติยศและเหรียญตราความสำเร็จ (Honorary Badges Shelf Frontend) =================

































































































































  // ================= ระบบวงล้อนำโชค OTOP (OTOP Lucky Spin Wheel Frontend) =================









































































































































































































































































































































































  let lightBlinkInterval = null;





























































































































































































  // ================= ระบบสแกน QR Code เช็กอินแหล่งเรียนรู้จริงและกิจกรรม (OTOP QR Check-in & Activities Frontend) =================

  let html5QrcodeScanner = null;

  function startQRScanner() {
    initAudioContext();
    const readerContainer = document.getElementById('reader-container');
    const startBtn = document.getElementById('btn-start-scanner');
    const stopBtn = document.getElementById('btn-stop-scanner');
    const laser = document.getElementById('scanner-laser');

    if (!readerContainer) return;

    if (html5QrcodeScanner) {
      stopQRScanner();
    }

    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    if (laser) laser.style.display = 'block';

    html5QrcodeScanner = new Html5Qrcode("reader");

    const config = { 
      fps: 10, 
      qrbox: function(width, height) {
        const size = Math.min(width, height) * 0.7;
        return { width: size, height: size };
      }
    };

    html5QrcodeScanner.start(
      { facingMode: "environment" }, 
      config,
      onQRScanSuccess,
      function(errorMessage) {
        // Quiet mode
      }
    ).catch(function(err) {
      console.warn("Camera start failed, trying fallback check", err);
      Html5Qrcode.getCameras().then(cameras => {
        if (cameras && cameras.length > 0) {
          html5QrcodeScanner.start(cameras[cameras.length - 1].id, config, onQRScanSuccess, () => {})
            .catch(e => {
              showCustomAlert("ไม่สามารถเปิดใช้งานกล้องถ่ายรูปได้ กรุณาใช้รหัสเช็กอินแมนนวลด้านล่างเป็นทางเลือกสำรอง", "warning");
              stopQRScanner();
            });
        } else {
          showCustomAlert("ไม่พบกล้องถ่ายรูปบนอุปกรณ์ของคุณ กรุณาใช้รหัสเช็กอินแมนนวลด้านล่างเป็นทางเลือกสำรอง", "warning");
          stopQRScanner();
        }
      }).catch(e => {
        showCustomAlert("ไม่สามารถระบุกล้องถ่ายรูปได้ กรุณาใช้รหัสเช็กอินแมนนวลด้านล่างเป็นทางเลือกสำรอง", "warning");
        stopQRScanner();
      });
    });
  }

  function stopQRScanner() {
    const startBtn = document.getElementById('btn-start-scanner');
    const stopBtn = document.getElementById('btn-stop-scanner');
    const laser = document.getElementById('scanner-laser');

    if (startBtn) startBtn.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
    if (laser) laser.style.display = 'none';

    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().then(function() {
        html5QrcodeScanner = null;
        const reader = document.getElementById('reader');
        if (reader) reader.innerHTML = "";
      }).catch(function(err) {
        console.error("Scanner stop error", err);
        html5QrcodeScanner = null;
      });
    }
  }

  function onQRScanSuccess(decodedText, decodedResult) {
    stopQRScanner();
    playSynthTick();

    const code = String(decodedText || '').trim();
    if (!code) return;

    if (code.startsWith("source:")) {
      const sourceId = code.substring(7).trim();
      processSourceCheckIn(sourceId);
    } else if (code.startsWith("activity:")) {
      const activityId = code.substring(9).trim();
      processActivityCheckIn(activityId);
    } else {
      if (code.startsWith("SRC")) {
        processSourceCheckIn(code);
      } else if (code.startsWith("ACT")) {
        processActivityCheckIn(code);
      } else {
        showCustomAlert("คิวอาร์โค้ดนี้ไม่มีรูปแบบที่ใช้ในการเช็กอินระบบ LOFT LEARN ได้", "error");
      }
    }
  }

  function checkInViaCodeInput() {
    const input = document.getElementById('scan-manual-code');
    if (!input) return;

    const code = String(input.value || '').trim();
    if (!code) {
      showCustomAlert("กรุณากรอกรหัสเช็กอินก่อนยืนยัน", "warning");
      return;
    }

    if (code.startsWith("SRC")) {
      processSourceCheckIn(code);
    } else if (code.startsWith("ACT")) {
      processActivityCheckIn(code);
    } else {
      showCustomAlert("รหัสเช็กอินไม่ถูกต้อง รหัสของแหล่งเรียนรู้ต้องขึ้นต้นด้วย SRC และกิจกรรมขึ้นต้นด้วย ACT", "warning");
    }
  }

  function processSourceCheckIn(sourceId) {
    if (localStorage.getItem("userRole") === "guest") {
      if (typeof openSourceDetail === "function") {
        openSourceDetail(sourceId);
      }
      return;
    }
    showLoading(true);
    apiPost('checkInSource', withAuthData({ sourceId: sourceId }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          playSynthFanfare();
          
          const message = `<div class="text-center py-2">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style="background:#fbbf2422; border:2px solid #fbbf24; box-shadow: 0 0 16px rgba(251,191,36,0.6); animation: goldPulse 2s infinite ease-in-out;">
              <i class="fas fa-camera text-3xl" style="color:#fbbf24"></i>
            </div>
            <h4 class="font-black text-xl mb-2 text-theme-inv">${res.sourceName}</h4>
            <p class="text-theme-inv font-semibold text-sm mb-4"><i class="fas fa-camera mr-1"></i> เช็กอินแหล่งเรียนรู้สำเร็จเรียบร้อย!</p>
            <div class="p-3 rounded-xl text-left text-xs mb-3" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.5;">
              คุณได้เดินทางมาถึงสถานที่จริง และสแกนสถิติเสร็จสิ้น ระบบมอบแต้มสะสมพิเศษเข้าโปรไฟล์คุณทันที
            </div>
            <div class="inline-block px-4 py-1.5 rounded-full font-black text-white" style="background: linear-gradient(135deg, #10b981, #059669); font-size:0.85rem; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
              ได้รับ +20 แต้มสะสม <i class="fas fa-coins ml-1" style="color:#fbbf24"></i>
            </div>
          </div>`;
          
          showCustomAlert(message, "success", "เช็กอินสำเร็จ 🎉");

          localStorage.setItem("userScore", res.newScore);
          const scoreEl = document.getElementById('profile-score');
          if (scoreEl) scoreEl.innerText = res.newScore;
          
          cacheProfile = null;
          cacheHistory = null;
          if (typeof clearApiCache === 'function') clearApiCache(['getUserPointsHistory','getUserBadges','getUserCertificates','getHomeData']);
          
        } else {
          showCustomAlert(res.message || "เกิดข้อผิดพลาดในการเช็กอิน", "error");
        }
      })
      .catch(function() {
        showLoading(false);
        showCustomAlert("ล้มเหลวในการเชื่อมต่อระบบเซิร์ฟเวอร์", "error");
      });
  }

  function processActivityCheckIn(activityId) {
    if (localStorage.getItem("userRole") === "guest") {
      showCustomConfirm("ฟีเจอร์เช็กอินกิจกรรมเฉพาะสมาชิกนักศึกษา กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อสะสมคะแนน", function() {
        if (typeof logoutNoConfirm === "function") logoutNoConfirm();
      });
      return;
    }
    showLoading(true);
    apiPost('checkInActivity', withAuthData({ activityId: activityId }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          playSynthFanfare();
          
          if (res.hasQuiz) {
            window.activeActivityQuizzes = res.quizzes;
            const scoreMsg = res.alreadyScanned 
              ? `คุณเคยสแกนรับคะแนนเช็กอินส่วนแรก (+${res.scanPoints} คะแนน) ไปแล้ว` 
              : `คุณได้รับคะแนนเช็กอินส่วนแรกสำเร็จ! +${res.scanPoints} คะแนน`;
            
            const message = `<div class="text-center py-2">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style="background:#a855f722; border:2px solid #a855f7; box-shadow: 0 0 16px rgba(168,85,247,0.6); animation: pulse 2s infinite ease-in-out;">
                <i class="fas fa-question-circle text-3xl" style="color:#a855f7"></i>
              </div>
              <h4 class="font-black text-xl mb-2 text-theme-inv">${escapeHtml(res.activityName)}</h4>
              <p class="text-theme-inv font-semibold text-sm mb-4">🎟️ สแกนกิจกรรมสำเร็จเรียบร้อย!</p>
              <div class="p-3 rounded-xl text-left text-xs mb-3" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.5;">
                ${scoreMsg} <br>กรุณาทำแบบทดสอบเกี่ยวกับกิจกรรมนี้เพื่อสะสมแต้มส่วนที่เหลืออีก <strong>สูงสุด +${res.quizPoints} คะแนน</strong>
              </div>
              <button class="btn-primary w-100 py-2.5 font-bold" style="background: linear-gradient(135deg, #a855f7, #7e22ce); border: none; border-radius:12px; box-shadow: 0 4px 12px rgba(168,85,247,0.35); color:white;" onclick="closeCustomAlert(true); window.startActivityQuiz('${activityId}', '${res.activityName.replace(/'/g, "\\'")}', ${res.quizPoints})">
                <i class="fas fa-pencil-alt mr-1"></i> เริ่มทำแบบทดสอบกิจกรรม
              </button>
            </div>`;
            
            showCustomAlert(message, "success", "เช็กอินกิจกรรมสำเร็จ 🎉");
          } else {
            const message = `<div class="text-center py-2">
              <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style="background:#fbbf2422; border:2px solid #fbbf24; box-shadow: 0 0 16px rgba(251,191,36,0.6); animation: goldPulse 2s infinite ease-in-out;">
                <i class="fas fa-qrcode text-3xl" style="color:#fbbf24"></i>
              </div>
              <h4 class="font-black text-xl mb-2 text-theme-inv">${escapeHtml(res.activityName)}</h4>
              <p class="text-theme-inv font-semibold text-sm mb-4">🎟️ สแกนเข้าร่วมกิจกรรมสำเร็จเรียบร้อย!</p>
              <div class="p-3 rounded-xl text-left text-xs mb-3" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.5;">
                ยินดีต้อนรับเข้าสู่งานกิจกรรมการเรียนรู้ของ สกร. ทางระบบบันทึกความร่วมมือและมอบคะแนนให้คุณแล้ว
              </div>
              <div class="inline-block px-4 py-1.5 rounded-full font-black text-white" style="background: linear-gradient(135deg, #fbbf24, #d97706); font-size:0.85rem; box-shadow: 0 4px 10px rgba(217,119,6,0.3);">
                ได้รับ +${res.scanPoints} แต้มสะสม <i class="fas fa-coins ml-1" style="color:#fbbf24"></i>
              </div>
            </div>`;
            
            showCustomAlert(message, "success", "เช็กอินกิจกรรม 🎉");
          }

          if (!res.alreadyScanned) {
            localStorage.setItem("userScore", res.newScore);
            const scoreEl = document.getElementById('profile-score');
            if (scoreEl) scoreEl.innerText = res.newScore;
          }
          
          cacheProfile = null;
          cacheHistory = null;
          if (typeof clearApiCache === 'function') clearApiCache(['getUserPointsHistory','getUserBadges','getUserCertificates','getHomeData']);

        } else {
          showCustomAlert(res.message || "เกิดข้อผิดพลาดในการเช็กอิน", "error");
        }
      })
      .catch(function() {
        showLoading(false);
        showCustomAlert("ล้มเหลวในการเชื่อมต่อระบบเซิร์ฟเวอร์", "error");
      });
  }

  // ================= แผงจัดการกิจกรรมของครู/ผู้ดูแลระบบ (Admin Activities Control Logic) =================

  function openAdminActivitiesPanel() {
    showPage('admin-activities-page');
    loadAdminActivities();
  }

  function loadAdminActivities() {
    const container = document.getElementById('admin-activities-list-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4 text-muted text-sm">' +
                            '<i class="fas fa-circle-notch fa-spin mr-2" style="color:var(--primary)"></i>กำลังโหลดกิจกรรม...' +
                          '</div>';

    apiGet('getActivities', withAuthParams())
      .then(function(res) {
        if (res.status === "success" && Array.isArray(res.activities)) {
          renderAdminActivitiesUI(res.activities);
        } else {
          container.innerHTML = '<div class="text-center py-4 text-danger text-sm">' +
                                  '<i class="fas fa-exclamation-triangle mr-2"></i>' + (res.message || 'ล้มเหลวในการดึงกิจกรรม') +
                                '</div>';
        }
      })
      .catch(function() {
        container.innerHTML = '<div class="text-center py-4 text-danger text-sm">' +
                                '<i class="fas fa-exclamation-triangle mr-2"></i>เกิดข้อผิดพลาดในการเชื่อมต่อ' +
                              '</div>';
      });
  }

  function renderAdminActivitiesUI(activities) {
    const container = document.getElementById('admin-activities-list-container');
    if (!container) return;

    if (activities.length === 0) {
      container.innerHTML = '<div class="text-center py-6 text-muted text-xs">' +
                              '<i class="fas fa-folder-open text-2xl mb-2 opacity-50 block"></i>' +
                              'ไม่มีกิจกรรมใด ๆ ในระบบตอนนี้แอดมินสามารถสร้างเพิ่มด้านบนได้ทันที!' +
                            '</div>';
      return;
    }

    let html = '';
    activities.forEach(function(act) {
      const escapedName = escapeJS(act.name);
      const escapedDetails = escapeJS(act.details || '');
      const escapedCode = String(act.activityId).trim();
      
      html += `
        <div class="p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all"
             style="background: var(--glass); border: 1px solid var(--glass-border);">
          <div class="min-w-0 text-left md:max-w-[65%]">
            <h5 class="font-bold text-sm text-theme-inv mb-0.5 truncate">${act.name}</h5>
            <p class="text-xxs text-muted mb-1 truncate" style="margin: 0 0 4px;">${act.details || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="user-badge" style="padding: 2px 6px; font-size: 0.65rem; background: linear-gradient(135deg, rgba(251,191,36,0.15), rgba(217,119,6,0.15)); border-color: rgba(251,191,36,0.3); color:#fbbf24;">
                รหัส: ${act.activityId}
              </span>
              <span class="user-badge" style="padding: 2px 6px; font-size: 0.65rem; background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.15)); border-color: rgba(16,185,129,0.3); color:#10b981;">
                +${act.points} แต้ม <i class="fas fa-coins ml-0.5"></i>
              </span>
            </div>
          </div>
          
          <div class="flex flex-wrap gap-1.5 justify-start md:justify-end">
            <button class="btn-primary" style="padding: 6px 8px; font-size: 0.75rem; border-radius: 8px; background: linear-gradient(135deg, var(--primary), var(--primary-dk));"
                    onclick="showActivityQRModal('${escapedCode}', '${escapedName}', ${act.points})">
              <i class="fas fa-qrcode"></i> QR
            </button>
            <button class="btn-primary" style="padding: 6px 8px; font-size: 0.75rem; border-radius: 8px; background: linear-gradient(135deg, #a855f7, #7e22ce);"
                    onclick="openActivityQuizEditor('${escapedCode}', '${escapedName}')">
              <i class="fas fa-question-circle"></i> ข้อสอบ
            </button>
            <button class="btn-primary" style="padding: 6px 8px; font-size: 0.75rem; border-radius: 8px; background: linear-gradient(135deg, #fbbf24, #d97706);"
                    onclick="openActivityCertEditor('${escapedCode}', '${escapedName}')">
              <i class="fas fa-certificate"></i> เกียรติบัตร
            </button>
            <button class="btn-primary" style="padding: 6px 8px; font-size: 0.75rem; border-radius: 8px; background: linear-gradient(135deg, #0284c7, #0369a1);"
                    onclick="startEditActivity('${escapedCode}', '${escapedName}', '${escapedDetails}', ${act.points})">
              <i class="fas fa-edit"></i> แก้ไข
            </button>
            <button class="btn-primary" style="padding: 6px 8px; font-size: 0.75rem; border-radius: 8px; background: linear-gradient(135deg, #ef4444, #dc2626);"
                    onclick="deleteActivity('${escapedCode}')">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function submitCreateActivity() {
    const nameInput = document.getElementById('act-form-name');
    const detailsInput = document.getElementById('act-form-details');
    const pointsInput = document.getElementById('act-form-points');

    if (!nameInput || !detailsInput || !pointsInput) return;

    const name = String(nameInput.value || '').trim();
    const details = String(detailsInput.value || '').trim();
    const points = parseInt(pointsInput.value) || 0;

    if (!name || points <= 0) {
      showCustomAlert("กรุณาระบุชื่อกิจกรรมและคะแนนแต้มสะสมให้ถูกต้อง (คะแนนต้องมากกว่า 0)", "warning");
      return;
    }

    showLoading(true);
    apiPost('createActivity', withAuthData({ name: name, details: details, points: points }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          playSynthFanfare();
          showCustomAlert("สร้างกิจกรรมเช็กอินและออก QR Code รหัส " + res.activityId + " เรียบร้อยแล้ว!", "success");
          
          // Reset
          nameInput.value = '';
          detailsInput.value = '';
          pointsInput.value = '';

          loadAdminActivities();
        } else {
          showCustomAlert(res.message || "เกิดข้อผิดพลาดในการสร้างกิจกรรม", "error");
        }
      })
      .catch(function() {
        showLoading(false);
        showCustomAlert("ล้มเหลวในการเชื่อมต่อระบบเซิร์ฟเวอร์", "error");
      });
  }

  function deleteActivity(activityId) {
    showCustomConfirm("ต้องการลบกิจกรรมรหัส " + activityId + " หรือไม่? (ประวัติการเช็กอินแต้มสะสมเดิมจะไม่ถูกลบเพื่อความปลอดภัยข้อมูล)", function() {
      showLoading(true);
      apiPost('deleteActivity', withAuthData({ activityId: activityId }))
        .then(function(res) {
          showLoading(false);
          if (res.status === "success") {
            playSynthTick();
            showCustomAlert("ลบกิจกรรมดังกล่าวเรียบร้อยแล้ว", "success");
            loadAdminActivities();
          } else {
            showCustomAlert(res.message || "เกิดข้อผิดพลาดในการลบกิจกรรม", "error");
          }
        })
        .catch(function() {
          showLoading(false);
          showCustomAlert("ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์", "error");
        });
    });
  }

  function showActivityQRModal(activityId, name, points) {
    const modal = document.getElementById('qr-viewer-modal');
    const title = document.getElementById('qr-viewer-title');
    const pointsEl = document.getElementById('qr-viewer-points');
    const img = document.getElementById('qr-viewer-img');
    const code = document.getElementById('qr-viewer-code');

    if (!modal || !img) return;

    title.innerText = name;
    pointsEl.innerText = "เช็กอินเพื่อรับ +" + points + " คะแนน 🪙";
    code.innerText = activityId;

    const qrData = "activity:" + activityId;
    img.src = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(qrData);

    modal.style.display = 'flex';
  }

  function closeQRViewerModal() {
    const modal = document.getElementById('qr-viewer-modal');
    if (modal) modal.style.display = 'none';
  }

  let activeAdminActivityId = '';
  let activeAdminActivityName = '';
  let activityQuizDrafts = [];
  window.activeActivityQuizzes = null;
  let editingAdminActivityId = '';

  function startEditActivity(activityId, name, details, points) {
    editingAdminActivityId = activityId;

    const nameInput = document.getElementById('act-form-name');
    const detailsInput = document.getElementById('act-form-details');
    const pointsInput = document.getElementById('act-form-points');
    const titleEl = document.getElementById('act-form-title');
    const buttonsContainer = document.getElementById('act-form-buttons');

    if (nameInput) nameInput.value = name;
    if (detailsInput) detailsInput.value = details;
    if (pointsInput) pointsInput.value = points;

    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-edit mr-1" style="color:var(--gold)"></i>แก้ไขข้อมูลกิจกรรม`;
    }

    if (buttonsContainer) {
      buttonsContainer.innerHTML = `
        <div class="flex gap-2">
          <button class="btn-primary" style="background:var(--glass); color:var(--text); border:1px solid var(--card-border); box-shadow:none; padding:10px 16px; font-size:0.9rem; border-radius:var(--r-btn); flex:1;" onclick="cancelEditActivity()">
            ยกเลิก
          </button>
          <button class="btn-primary" style="background:linear-gradient(135deg, var(--primary), var(--primary-dk)); padding:10px 24px; font-size:0.9rem; border-radius:var(--r-btn); flex:2;" onclick="submitUpdateActivity()">
            <i class="fas fa-save mr-1"></i>บันทึกการแก้ไข
          </button>
        </div>
      `;
    }

    const nameInputGroup = document.getElementById('act-form-name');
    if (nameInputGroup) {
      const formCard = nameInputGroup.closest('.loft-card');
      if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
  window.startEditActivity = startEditActivity;

  function cancelEditActivity() {
    editingAdminActivityId = '';

    const nameInput = document.getElementById('act-form-name');
    const detailsInput = document.getElementById('act-form-details');
    const pointsInput = document.getElementById('act-form-points');
    const titleEl = document.getElementById('act-form-title');
    const buttonsContainer = document.getElementById('act-form-buttons');

    if (nameInput) nameInput.value = '';
    if (detailsInput) detailsInput.value = '';
    if (pointsInput) pointsInput.value = '';

    if (titleEl) {
      titleEl.innerHTML = `<i class="fas fa-plus-circle mr-1" style="color:var(--primary)"></i>สร้างกิจกรรมแจกคะแนนใหม่`;
    }

    if (buttonsContainer) {
      buttonsContainer.innerHTML = `
        <button class="btn-primary w-100" onclick="submitCreateActivity()">
          <i class="fas fa-qrcode mr-1"></i>สร้างกิจกรรมและรับ QR Code
        </button>
      `;
    }
  }
  window.cancelEditActivity = cancelEditActivity;

  function submitUpdateActivity() {
    if (!editingAdminActivityId) return;

    const nameInput = document.getElementById('act-form-name');
    const detailsInput = document.getElementById('act-form-details');
    const pointsInput = document.getElementById('act-form-points');

    if (!nameInput || !detailsInput || !pointsInput) return;

    const name = String(nameInput.value || '').trim();
    const details = String(detailsInput.value || '').trim();
    const points = parseInt(pointsInput.value) || 0;

    if (!name || points <= 0) {
      showCustomAlert("กรุณาระบุชื่อกิจกรรมและคะแนนแต้มสะสมให้ถูกต้อง (คะแนนต้องมากกว่า 0)", "warning");
      return;
    }

    showLoading(true);
    apiPost('updateActivity', withAuthData({ activityId: editingAdminActivityId, name: name, details: details, points: points }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          playSynthFanfare();
          showCustomAlert("บันทึกการแก้ไขข้อมูลกิจกรรมเรียบร้อยแล้ว!", "success");
          cancelEditActivity();
          loadAdminActivities();
        } else {
          showCustomAlert(res.message || "เกิดข้อผิดพลาดในการบันทึกกิจกรรม", "error");
        }
      })
      .catch(function() {
        showLoading(false);
        showCustomAlert("ล้มเหลวในการเชื่อมต่อระบบเซิร์ฟเวอร์", "error");
      });
  }
  window.submitUpdateActivity = submitUpdateActivity;

  function openActivityQuizEditor(activityId, activityName) {
    activeAdminActivityId = activityId;
    activeAdminActivityName = activityName;
    activityQuizDrafts = [];
    
    const subtitle = document.getElementById('act-quiz-modal-subtitle');
    if (subtitle) subtitle.innerText = "กิจกรรม: " + activityName + " (รหัส: " + activityId + ")";
    
    const container = document.getElementById('act-quiz-form-list');
    if (container) {
      container.innerHTML = '<div class="text-center py-6 text-muted text-sm"><i class="fas fa-circle-notch fa-spin mr-2"></i>กำลังโหลดข้อสอบ...</div>';
    }
    
    const modal = document.getElementById('admin-activity-quiz-modal');
    if (modal) modal.style.display = 'flex';
    
    apiGet('getActivityQuizzes', withAuthParams({ activityId: activityId }))
      .then(function(res) {
        if (res.status === "success") {
          activityQuizDrafts = (res.quizzes || []).map(function(q) {
            return {
              quizId: q.quizId || '',
              question: q.question || '',
              choiceA: q.choices ? q.choices[0] || '' : (q.choiceA || ''),
              choiceB: q.choices ? q.choices[1] || '' : (q.choiceB || ''),
              choiceC: q.choices ? q.choices[2] || '' : (q.choiceC || ''),
              choiceD: q.choices ? q.choices[3] || '' : (q.choiceD || ''),
              answer: q.answer || 'A'
            };
          });
          if (activityQuizDrafts.length === 0) {
            activityQuizDrafts = [createActivityQuizDraftItem()];
          }
          renderActivityQuizForm();
        } else {
          showCustomAlert(res.message || "ไม่สามารถโหลดข้อมูลข้อสอบได้", "error");
          closeActivityQuizModal();
        }
      })
      .catch(function() {
        showCustomAlert("ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์", "error");
        closeActivityQuizModal();
      });
  }
  window.openActivityQuizEditor = openActivityQuizEditor;

  function closeActivityQuizModal() {
    const modal = document.getElementById('admin-activity-quiz-modal');
    if (modal) modal.style.display = 'none';
  }
  window.closeActivityQuizModal = closeActivityQuizModal;

  function createActivityQuizDraftItem() {
    return {
      quizId: "Q-ACT-" + Date.now() + "-" + Math.floor(Math.random() * 10000),
      question: '',
      choiceA: '',
      choiceB: '',
      choiceC: '',
      choiceD: '',
      answer: 'A'
    };
  }

  function renderActivityQuizForm() {
    const container = document.getElementById('act-quiz-form-list');
    if (!container) return;

    let html = '';
    activityQuizDrafts.forEach(function(q, idx) {
      const group = 'act-quiz-answer-' + idx;
      const choices = [
        ['A', 'choiceA'],
        ['B', 'choiceB'],
        ['C', 'choiceC'],
        ['D', 'choiceD']
      ];
      
      html += `
        <div class="admin-quiz-form-card" data-index="${idx}" data-quiz-id="${escapeJS(q.quizId || '')}" style="background: rgba(0,0,0,0.15); border: 1px solid var(--glass-border); padding: 16px; border-radius: 16px; margin-bottom: 12px;">
          <div class="admin-quiz-form-head flex justify-between items-center mb-3">
            <div class="admin-quiz-form-title font-bold text-sm text-theme-inv">ข้อ ${idx + 1}</div>
            <div class="admin-item-actions flex gap-1">
              <button type="button" class="icon-btn" onclick="moveActivityQuizQuestionRow(${idx}, -1)" title="เลื่อนขึ้น" style="background:none;border:1px solid var(--glass-border);border-radius:4px;cursor:pointer;color:var(--text);padding:2px 6px;"><i class="fas fa-arrow-up text-xs"></i></button>
              <button type="button" class="icon-btn" onclick="moveActivityQuizQuestionRow(${idx}, 1)" title="เลื่อนลง" style="background:none;border:1px solid var(--glass-border);border-radius:4px;cursor:pointer;color:var(--text);padding:2px 6px;"><i class="fas fa-arrow-down text-xs"></i></button>
              <button type="button" class="icon-btn" onclick="removeActivityQuizQuestionRow(${idx})" title="ลบข้อ" style="background:none;border:1px solid var(--glass-border);border-radius:4px;cursor:pointer;color:#ef4444;padding:2px 6px;"><i class="fas fa-trash text-xs"></i></button>
            </div>
          </div>
          <textarea data-field="question" rows="2" placeholder="คำถาม" style="width:100%; padding:10px; border:1.5px solid var(--input-border); border-radius:10px; font-size:14px; outline:none; background:var(--bg2); color:var(--text); font-family:\'Prompt\',sans-serif; resize:none; margin-bottom:10px;">${escapeHtml(q.question || '')}</textarea>
          <div class="admin-quiz-form-options flex flex-col gap-2">`;
          
      choices.forEach(function(choice) {
        const letter = choice[0];
        const field = choice[1];
        html += `
            <label class="admin-quiz-option-row flex items-center gap-2" style="cursor:pointer;">
              <input type="radio" name="${group}" value="${letter}" ${((q.answer || 'A') === letter ? 'checked' : '')} style="accent-color:var(--primary); width:16px; height:16px; cursor:pointer;">
              <span class="admin-quiz-option-letter font-bold text-xs w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">${letter}</span>
              <input type="text" data-field="${field}" placeholder="ตัวเลือก ${letter}" value="${escapeHtml(q[field] || '')}" style="flex:1; padding:8px 12px; border:1.5px solid var(--input-border); border-radius:8px; font-size:13px; outline:none; background:var(--bg2); color:var(--text); font-family:\'Prompt\',sans-serif;">
            </label>`;
      });
      
      html += `
          </div>
        </div>`;
    });
    
    container.innerHTML = html;
  }

  function syncActivityQuizDraftsFromForm() {
    const container = document.getElementById('act-quiz-form-list');
    if (!container) return [];
    
    const cards = container.querySelectorAll('.admin-quiz-form-card');
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
    activityQuizDrafts = drafts;
    return drafts;
  }

  function addActivityQuizQuestionRow() {
    syncActivityQuizDraftsFromForm();
    activityQuizDrafts.push(createActivityQuizDraftItem());
    renderActivityQuizForm();
    
    setTimeout(function() {
      const container = document.getElementById('act-quiz-form-list');
      if (container) container.scrollTop = container.scrollHeight;
    }, 100);
  }
  window.addActivityQuizQuestionRow = addActivityQuizQuestionRow;

  function removeActivityQuizQuestionRow(index) {
    syncActivityQuizDraftsFromForm();
    if (activityQuizDrafts.length <= 1) {
      activityQuizDrafts = [createActivityQuizDraftItem()];
    } else {
      activityQuizDrafts.splice(index, 1);
    }
    renderActivityQuizForm();
  }
  window.removeActivityQuizQuestionRow = removeActivityQuizQuestionRow;

  function moveActivityQuizQuestionRow(index, delta) {
    syncActivityQuizDraftsFromForm();
    const next = index + delta;
    if (next < 0 || next >= activityQuizDrafts.length) return;
    const moved = activityQuizDrafts.splice(index, 1)[0];
    activityQuizDrafts.splice(next, 0, moved);
    renderActivityQuizForm();
  }
  window.moveActivityQuizQuestionRow = moveActivityQuizQuestionRow;

  function saveActivityQuizzes() {
    if (!activeAdminActivityId) return;
    
    syncActivityQuizDraftsFromForm();
    
    const sanitized = [];
    for (let i = 0; i < activityQuizDrafts.length; i++) {
      const q = activityQuizDrafts[i];
      const isBlank = !q.question.trim() && !q.choiceA.trim() && !q.choiceB.trim() && !q.choiceC.trim() && !q.choiceD.trim();
      if (isBlank) continue;
      
      if (!q.question.trim() || !q.choiceA.trim() || !q.choiceB.trim() || !q.choiceC.trim() || !q.choiceD.trim()) {
        showCustomAlert("กรุณากรอกข้อ " + (i + 1) + " ให้ครบถ้วน ทั้งคำถามและตัวเลือกทั้งหมด หรือเว้นว่างหากต้องการลบข้อสอบนี้", "warning");
        return;
      }
      sanitized.push(q);
    }
    
    showLoading(true);
    apiPost('saveActivityQuizzes', withAuthData({ activityId: activeAdminActivityId, quizzes: sanitized }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert("บันทึกข้อสอบกิจกรรมทั้งหมดเรียบร้อยแล้ว!", "success");
          closeActivityQuizModal();
          loadAdminActivities();
        } else {
          showCustomAlert(res.message || "เกิดข้อผิดพลาดในการบันทึกข้อสอบ", "error");
        }
      })
      .catch(function() {
        showLoading(false);
        showCustomAlert("ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์", "error");
      });
  }
  window.saveActivityQuizzes = saveActivityQuizzes;

  function exitQuiz() {
    if (window.currentQuizActivityId) {
      showCustomConfirm("ต้องการออกจากแบบทดสอบกิจกรรมหรือไม่? คะแนนส่วนแบบทดสอบในครั้งนี้จะไม่ถูกบันทึก", function() {
        window.currentQuizActivityId = null;
        window.currentQuizActivityName = null;
        window.currentQuizActivityPoints = null;
        window.stopSpeaking();
        showPage('home-page');
      });
    } else {
      window.stopSpeaking();
      showPage('detail-page');
    }
  }
  window.exitQuiz = exitQuiz;

  function startActivityQuiz(activityId, activityName, quizPoints) {
    window.currentQuizActivityId = activityId;
    window.currentQuizActivityName = activityName;
    window.currentQuizActivityPoints = quizPoints;
    currentQuizMode = "posttest";
    currentQuizData = window.activeActivityQuizzes || [];
    currentQuestionIndex = 0;
    userScore = 0;
    quizAnswers = {};
    document.getElementById('total-q-num').innerText = currentQuizData.length;
    showPage('quiz-page');
    loadQuestion();
  }
  window.startActivityQuiz = startActivityQuiz;

  // ================= แผงควบคุมการสแกนและตัดสิทธิ์คูปองร้านค้าชุมชนสำหรับครู/ผู้ดูแลระบบ (Admin Coupon Redemption Frontend Logic) =================

  function openAdminCouponsPanel() {
    showPage('admin-coupons-page');
    const input = document.getElementById('coupon-search-code');
    if (input) input.value = '';
    const container = document.getElementById('coupon-detail-container');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-10 px-4 text-muted text-xs" style="background:var(--glass); border:1px dashed var(--glass-border); border-radius:16px;">
          <i class="fas fa-qrcode text-3xl mb-2 opacity-50 block" style="color:var(--gold)"></i>
          กรุณาป้อนรหัสคูปองด้านบนเพื่อตรวจสอบข้อมูลสิทธิ์ส่วนลด
        </div>
      `;
    }
  }

  function verifyCouponAdmin() {
    const input = document.getElementById('coupon-search-code');
    if (!input) return;

    const code = String(input.value || '').trim().toUpperCase();
    if (!code) {
      showCustomAlert("กรุณากรอกรหัสคูปองก่อนทำการตรวจสอบ", "warning");
      return;
    }

    const container = document.getElementById('coupon-detail-container');
    if (!container) return;

    container.innerHTML = `
      <div class="text-center py-8 text-muted text-sm">
        <i class="fas fa-circle-notch fa-spin mr-2" style="color:var(--primary)"></i>กำลังตรวจสอบรหัสคูปอง...
      </div>
    `;

    apiPost('verifyCouponAdmin', withAuthData({ couponCode: code }))
      .then(function(res) {
        if (res.status === 'success' && res.coupon) {
          renderCouponDetailAdminUI(res.coupon);
        } else {
          container.innerHTML = `
            <div class="text-center py-8 px-4 text-danger text-sm" style="background:var(--glass); border:1px solid rgba(239,68,68,0.2); border-radius:16px;">
              <i class="fas fa-exclamation-triangle text-2xl mb-2 block"></i>
              ${res.message || 'ไม่พบข้อมูลรหัสคูปองนี้ในระบบ'}
            </div>
          `;
        }
      })
      .catch(function(err) {
        console.error("Failed to verify coupon", err);
        container.innerHTML = `
          <div class="text-center py-8 px-4 text-danger text-sm" style="background:var(--glass); border:1px solid rgba(239,68,68,0.2); border-radius:16px;">
            <i class="fas fa-exclamation-triangle text-2xl mb-2 block"></i>
            เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์
          </div>
        `;
      });
  }

  function renderCouponDetailAdminUI(coupon) {
    const container = document.getElementById('coupon-detail-container');
    if (!container) return;

    const isActive = coupon.status === 'Active';
    const statusText = isActive ? '🎟️ คูปองพร้อมใช้งาน (ยังไม่ถูกใช้)' : (coupon.status === 'Used' ? '✔️ คูปองนี้ถูกใช้งานไปแล้ว' : '❌ คูปองนี้ถูกยกเลิกแล้ว');
    const statusClass = isActive ? 'background: rgba(16,185,129,0.15); color:#10b981; border: 1px solid rgba(16,185,129,0.3);' : 'background: rgba(239,68,68,0.15); color:#ef4444; border: 1px solid rgba(239,68,68,0.3);';

    let html = `
      <div class="flex flex-col gap-4 mt-2">
        <!-- Status Badge Banner -->
        <div class="p-3 rounded-xl text-center text-xs font-bold" style="${statusClass}">
          ${statusText}
        </div>

        <!-- Coupon Info Grid -->
        <div class="p-4 rounded-2xl flex flex-col gap-3" style="background:rgba(0,0,0,0.15); border:1px solid var(--glass-border);">
          <div class="flex justify-between items-center text-xs" style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <span style="color:var(--text-soft)">รหัสคูปอง:</span>
            <strong class="font-mono text-theme-inv tracking-wider" style="font-size:0.85rem;">${coupon.code}</strong>
          </div>
          <div class="flex justify-between items-center text-xs" style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <span style="color:var(--text-soft)">ชื่อนักศึกษาผู้ถือสิทธิ์:</span>
            <strong class="text-theme-inv">${coupon.studentName}</strong>
          </div>
          <div class="flex justify-between items-center text-xs" style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <span style="color:var(--text-soft)">เบอร์โทรผู้ใช้:</span>
            <strong class="text-theme-inv">${coupon.username}</strong>
          </div>
          <div class="flex justify-between items-center text-xs" style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <span style="color:var(--text-soft)">สินค้าส่วนลด OTOP:</span>
            <strong class="text-theme-inv text-right max-w-[60%] truncate">${coupon.productName}</strong>
          </div>
          <div class="flex justify-between items-center text-xs" style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <span style="color:var(--text-soft)">มูลค่าส่วนลดสินค้า:</span>
            <strong class="text-base text-theme-inv" style="color:var(--gold)">฿${coupon.discountAmount}</strong>
          </div>
          <div class="flex justify-between items-center text-xs" style="border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
            <span style="color:var(--text-soft)">แต้มที่ใช้แลกซื้อ:</span>
            <strong class="text-theme-inv">${coupon.pointsUsed} แต้ม <i class="fas fa-coins ml-0.5" style="color:#fbbf24"></i></strong>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span style="color:var(--text-soft)">วันเวลาที่แลกซื้อ:</span>
            <strong class="text-theme-inv">${coupon.redeemedAt}</strong>
          </div>
        </div>

        <!-- Action Button -->
        ${isActive ? `
          <button class="btn-primary w-100 py-3" style="background:linear-gradient(135deg, #10b981, #059669); box-shadow: 0 4px 14px rgba(16,185,129,0.3); font-size: 0.85rem;" onclick="useCouponAdminConfirm('${coupon.code}')">
            <i class="fas fa-ticket-alt mr-1"></i> บันทึกการใช้คูปอง (ตัดสิทธิ์ส่วนลด)
          </button>
        ` : `
          <div class="p-3.5 rounded-xl text-center text-xs text-muted" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.4;">
            <i class="fas fa-lock mr-1"></i> คูปองนี้ถูกทำเครื่องหมายว่าใช้งานหรือยกเลิกแล้วในตารางหลังบ้าน จึงไม่สามารถตัดสิทธิ์ซ้ำซ้อนได้อีกเพื่อความปลอดภัยของข้อมูล
          </div>
        `}
      </div>
    `;

    container.innerHTML = html;
  }

  function useCouponAdminConfirm(code) {
    showCustomConfirm("ต้องการยืนยันบันทึกรหัสคูปอง '" + code + "' เป็นสถานะ 'ใช้งานแล้ว' หรือไม่? (ระบบจะลงบันทึกถาวรทันที)", function() {
      showLoading(true);
      apiPost('useCouponAdmin', withAuthData({ couponCode: code }))
        .then(function(res) {
          showLoading(false);
          if (res.status === 'success') {
            playSynthFanfare();
            showCustomAlert(res.message || "บันทึกตัดสิทธิ์การใช้งานคูปองสำเร็จแล้ว!", "success", "ตัดยอดสำเร็จ 🎟️");
            // รีเฟรชหน้าจอข้อมูลคูปองเพื่อเปลี่ยนเป็นสีเทาทันที
            verifyCouponAdmin();
          } else {
            showCustomAlert(res.message || "เกิดข้อผิดพลาดในการทำรายการ", "error");
          }
        })
        .catch(function(err) {
          showLoading(false);
          console.error("Failed to redeem coupon via admin", err);
          showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
        });
    });
  }

  window.ensureMarketLoaded = ensureMarketLoaded;
  window.updateNavByRole = updateNavByRole;
  window.handleProductImageUpload = handleProductImageUpload;
  window.handleFeaturedImageUpload = handleFeaturedImageUpload;
  window.handleEditUserImageUpload = handleEditUserImageUpload;

  window.openAdminCouponsPanel = openAdminCouponsPanel;
  window.verifyCouponAdmin = verifyCouponAdmin;
  window.useCouponAdminConfirm = useCouponAdminConfirm;

  window.startQRScanner = startQRScanner;
  window.stopQRScanner = stopQRScanner;
  window.onQRScanSuccess = onQRScanSuccess;
  window.checkInViaCodeInput = checkInViaCodeInput;
  window.openAdminActivitiesPanel = openAdminActivitiesPanel;
  window.loadAdminActivities = loadAdminActivities;
  window.submitCreateActivity = submitCreateActivity;
  window.deleteActivity = deleteActivity;
  window.showActivityQRModal = showActivityQRModal;
  window.closeQRViewerModal = closeQRViewerModal;

  window.onload = function() {
    if (window.startLightsAnimation) window.startLightsAnimation();
    applyFirebaseFreeModeUI();

    // Restore Theme Colors
    const savedPrimary = localStorage.getItem('appPrimaryColor');
    const savedBg = localStorage.getItem('appBgColor');
    const savedTheme = localStorage.getItem('appTheme');
    
    if (savedPrimary) {
      applyAppTheme(savedPrimary, savedBg, savedTheme === 'dark');
    } else {
      // Default to Light Mode if no saved theme
      applyAppTheme('#10b981', '#f8fafc', false);
    }

    // Restore Font Size
    const savedFontSize = localStorage.getItem('loft_font_size') || 'md';
    changeFontSize(savedFontSize);

    let savedPhone = localStorage.getItem("userPhone");
    const savedRole = String(localStorage.getItem("userRole") || "").trim().toLowerCase();

    // การย้าย/นำเข้าฐานข้อมูลจะเพิกถอน token เดิมทั้งหมด ห้ามฟื้นสถานะ
    // ผู้ใช้จากแค่ phone/role ใน localStorage เพราะ API ฝั่ง Laravel ต้องใช้ Bearer token
    if (savedPhone && savedPhone !== "guest" && savedRole !== "guest" &&
        (typeof hasAuthenticatedSession !== "function" || !hasAuthenticatedSession())) {
      if (typeof clearStoredAuthSession === "function") clearStoredAuthSession();
      savedPhone = "";
    }
    
    if (savedPhone) {
      const headerUser = document.getElementById('header-user-name');
      if (headerUser) {
        headerUser.innerText = localStorage.getItem("userName") || "User";
      }
      updateNavByRole();
      
      // Load getHomeData on startup and delay getSources loading (Lazy Load)
      showLoading(true);
      const qy = getCurrentQuarterAndYear();
      apiGet('getHomeData', { quarter: qy.quarter, year: qy.year })
        .then(function(homeRes) {
          showLoading(false);
          if (homeRes.status === "success") {
            cacheHomeData = homeRes;
          }
          showPage('home-page');
        })
        .catch(function() {
          showLoading(false);
          showPage('home-page');
        });
    } else {
      showPage('login-page');
    }
  };

  // ════════════════════════════════════════════════════════════
  //  NFE (กพช.) HOURS EXCHANGE — USER SIDE
  // ════════════════════════════════════════════════════════════

  var _nfeSelectedPoints = 0;
  var _nfeModalData = {};
  var _nfeAdminPage = 1;
  var _nfeAdminTotalPages = 1;
  var _nfeAdminData = [];

  function openNFERedeemModal() {
    var score = Number(localStorage.getItem('userScore') || 0);
    var nfeHours = Number(localStorage.getItem('userNFEHours') || 0);
    _nfeSelectedPoints = 0;

    // Reset UI
    var el = document.getElementById('nfe-modal-score');
    if (el) el.innerText = score + ' แต้ม';
    var elH = document.getElementById('nfe-modal-total-hours');
    if (elH) elH.innerText = nfeHours + ' ชม.';

    // Fetch live NFE history to get year quota
    apiGet('getNFEHistory', withAuthParams({ page: 1 }))
      .then(function(res) {
        if (res && res.status === 'success') {
          var used = Number(res.usedThisYear) || 0;
          var remain = Number(res.remainingThisYear) || 0;
          var max = Number(res.maxPerYear) || 50;
          var pct = Math.min((used / max) * 100, 100);
          _nfeModalData = { used: used, remain: remain, max: max, totalHours: res.totalNFEHours || 0 };
          var elUsed = document.getElementById('nfe-modal-used-year');
          if (elUsed) elUsed.innerText = used + ' / ' + max + ' ชม.';
          var elProgress = document.getElementById('nfe-modal-progress');
          if (elProgress) elProgress.style.width = pct + '%';
          var elTH = document.getElementById('nfe-modal-total-hours');
          if (elTH) elTH.innerText = (res.totalNFEHours || nfeHours) + ' ชม.';
        }
      })
      .catch(function() {});

    // Deselect options
    [100, 500, 1000].forEach(function(pts) {
      var btn = document.getElementById('nfe-opt-' + pts);
      if (btn) btn.classList.remove('selected');
    });
    var confirmBtn = document.getElementById('btn-nfe-confirm');
    if (confirmBtn) {
      confirmBtn.style.opacity = '0.4';
      confirmBtn.style.pointerEvents = 'none';
    }
    var lbl = document.getElementById('nfe-confirm-label');
    if (lbl) lbl.innerText = '—';

    document.getElementById('nfe-redeem-modal').style.display = 'block';
  }
  window.openNFERedeemModal = openNFERedeemModal;

  function closeNFERedeemModal() {
    document.getElementById('nfe-redeem-modal').style.display = 'none';
  }
  window.closeNFERedeemModal = closeNFERedeemModal;

  function selectNFEOption(points) {
    _nfeSelectedPoints = points;
    var score = Number(localStorage.getItem('userScore') || 0);
    var hours = points / 100;

    [100, 500, 1000].forEach(function(pts) {
      var btn = document.getElementById('nfe-opt-' + pts);
      if (btn) btn.classList.toggle('selected', pts === points);
    });

    var confirmBtn = document.getElementById('btn-nfe-confirm');
    var lbl = document.getElementById('nfe-confirm-label');
    if (confirmBtn && lbl) {
      if (score < points) {
        lbl.innerText = '(คะแนนไม่พอ)';
        confirmBtn.style.opacity = '0.4';
        confirmBtn.style.pointerEvents = 'none';
      } else if (_nfeModalData.remain !== undefined && hours > _nfeModalData.remain) {
        lbl.innerText = '(เกินโควต้าปีนี้)';
        confirmBtn.style.opacity = '0.4';
        confirmBtn.style.pointerEvents = 'none';
      } else {
        lbl.innerText = points + ' แต้ม → ' + hours + ' ชม.';
        confirmBtn.style.opacity = '1';
        confirmBtn.style.pointerEvents = 'auto';
      }
    }
  }
  window.selectNFEOption = selectNFEOption;

  function confirmNFERedeem() {
    if (!_nfeSelectedPoints) return;
    var confirmBtn = document.getElementById('btn-nfe-confirm');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i>กำลังดำเนินการ...';
    }
    apiPost('redeemNFEHours', withAuthData({ points: _nfeSelectedPoints }))
      .then(function(res) {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>ยืนยันแลก <span id="nfe-confirm-label">' + _nfeSelectedPoints + ' แต้ม → ' + (_nfeSelectedPoints/100) + ' ชม.</span>';
        }
        if (res && res.status === 'success') {
          closeNFERedeemModal();
          showCustomAlert(res.message || 'แลกชั่วโมง กพช. สำเร็จ!', 'success');
          // Update local score
          if (res.newScore !== undefined) {
            localStorage.setItem('userScore', res.newScore);
            var scoreEl = document.getElementById('profile-score');
            if (scoreEl) scoreEl.innerText = res.newScore;
            var scoreBadge = document.getElementById('market-user-score-badge');
            if (scoreBadge) scoreBadge.innerText = 'มี ' + res.newScore + ' แต้ม';
          }
          // Update NFE hours display
          if (res.totalNFEHours !== undefined) {
            localStorage.setItem('userNFEHours', res.totalNFEHours);
            var nfeEl = document.getElementById('profile-nfe-hours');
            if (nfeEl) nfeEl.innerText = res.totalNFEHours + ' ชม.';
          }
          // Reload history
          loadNFEHistory();
        } else {
          showCustomAlert(res && res.message ? res.message : 'เกิดข้อผิดพลาด', 'error');
        }
      })
      .catch(function(err) {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>ยืนยันแลก <span id="nfe-confirm-label"></span>';
        }
        showCustomAlert('เกิดข้อผิดพลาด: ' + (err.message || err), 'error');
      });
  }
  window.confirmNFERedeem = confirmNFERedeem;

  // ─── NFE History (Profile page) ─────────────────────────────

  function renderNFEHistoryUI(res, container, quotaBar) {
    if (quotaBar) quotaBar.style.display = 'block';
    var usedEl = document.getElementById('nfe-used-year');
    var remainEl = document.getElementById('nfe-remain-year');
    var fillEl = document.getElementById('nfe-progress-fill');
    var used = Number(res.usedThisYear) || 0;
    var remain = Number(res.remainingThisYear) || 0;
    var max = Number(res.maxPerYear) || 50;
    if (usedEl) usedEl.innerText = used;
    if (remainEl) remainEl.innerText = remain;
    if (fillEl) fillEl.style.width = Math.min((used / max) * 100, 100) + '%';

    var totalHours = Number(res.totalNFEHours) || 0;
    localStorage.setItem('userNFEHours', totalHours);
    var nfeEl = document.getElementById('profile-nfe-hours');
    if (nfeEl) nfeEl.innerText = totalHours + ' ชม.';

    if (!res.data || res.data.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-muted text-sm"><i class="fas fa-clock mr-1"></i>ยังไม่มีประวัติการแลกชั่วโมง กพช.</div>';
      return;
    }

    var html = '';
    res.data.forEach(function(r) {
      html += '<div class="nfe-history-item">' +
        '<div class="nfe-history-icon"><i class="fas fa-clock"></i></div>' +
        '<div class="nfe-history-detail">' +
        '<div class="flex items-center gap-2"><span class="nfe-history-hours">' + r.hoursGranted + ' ชม.</span>' +
        '<span style="font-size:0.7rem;color:var(--text-soft);">' + r.createdAt + '</span></div>' +
        '<div class="text-xs" style="color:var(--text-soft);">ใช้ไป ' + r.pointsUsed + ' แต้ม · <span style="color:#059669;font-weight:700;">' + r.status + '</span></div>' +
        '</div></div>';
    });
    container.innerHTML = html;
  }

  function loadNFEHistory(forceFresh) {
    if (forceFresh) window.cacheNFEHistoryData = null;
    var container = document.getElementById('nfe-history-container');
    var quotaBar = document.getElementById('nfe-quota-bar-wrap');
    if (!container) return;

    if (window.cacheNFEHistoryData) {
      renderNFEHistoryUI(window.cacheNFEHistoryData, container, quotaBar);
      return;
    }

    container.innerHTML = '<div class="text-center py-3 text-muted text-sm"><i class="fas fa-circle-notch fa-spin mr-1" style="color:#3b82f6"></i> กำลังโหลด…</div>';

    apiGet('getNFEHistory', withAuthParams({ page: 1 }))
      .then(function(res) {
        if (!res || res.status !== 'success') {
          container.innerHTML = '<div class="text-center py-4 text-muted text-sm"><i class="fas fa-clock mr-1"></i>ยังไม่มีประวัติการแลกชั่วโมง กพช.</div>';
          return;
        }
        window.cacheNFEHistoryData = res;
        renderNFEHistoryUI(res, container, quotaBar);
      })
      .catch(function() {
        container.innerHTML = '<div class="text-center py-4 text-muted text-sm"><i class="fas fa-clock mr-1"></i>ยังไม่มีประวัติการแลกชั่วโมง กพช.</div>';
      });
  }
  window.loadNFEHistory = loadNFEHistory;

  // ─── NFE Admin Report ─────────────────────────────────────────

  function loadNFEAdminReport() {
    var filterEl = document.getElementById('nfe-admin-tambon-filter');
    var tambon = filterEl ? filterEl.value : 'ทั้งหมด';
    var tbody = document.getElementById('nfe-admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px;"><i class="fas fa-circle-notch fa-spin mr-1"></i> กำลังโหลด…</td></tr>';

    apiGet('getNFEAdminReport', withAuthParams({ tambon: tambon, page: _nfeAdminPage }))
      .then(function(res) {
        if (!res || res.status !== 'success') {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">โหลดไม่สำเร็จ</td></tr>';
          return;
        }

        // Summary
        var s = res.summary || {};
        var elTH = document.getElementById('nfe-admin-total-hours');
        var elUU = document.getElementById('nfe-admin-unique-users');
        var elTR = document.getElementById('nfe-admin-total-records');
        if (elTH) elTH.innerText = s.totalHours || 0;
        if (elUU) elUU.innerText = s.uniqueUsers || 0;
        if (elTR) elTR.innerText = s.totalRecords || 0;

        _nfeAdminTotalPages = res.totalPages || 1;
        _nfeAdminData = res.data || [];

        // Table rows
        if (!res.data || res.data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">ยังไม่มีรายการ</td></tr>';
          return;
        }
        var rows = '';
        res.data.forEach(function(r) {
          var statusText = r.status === 'Used' ? 'ใช้งานแล้ว' : 'ยังไม่ใช้งาน';
          var statusClass = r.status === 'Used' ? 'badge-used' : 'badge-active';
          
          var actionBtn = '';
          if (r.status === 'Active') {
            actionBtn = '<button class="btn-primary" style="padding:4px 10px; font-size:0.72rem; border-radius:6px; background:#ef4444; border:none; box-shadow:none; white-space:nowrap;" onclick="useNFEHoursAdmin(\'' + r.redemptionId + '\', \'' + escapeJS(r.fullName || r.username) + '\', ' + r.hoursGranted + ')"><i class="fas fa-check-double mr-1"></i>หักชั่วโมง</button>';
          } else {
            actionBtn = '<button class="btn-primary" style="padding:4px 10px; font-size:0.72rem; border-radius:6px; background:var(--card-border); color:var(--text-soft); border:none; box-shadow:none; cursor:not-allowed; white-space:nowrap;" disabled>หักแล้ว</button>';
          }

          rows += '<tr>' +
            '<td>' + (r.fullName || r.username) + '</td>' +
            '<td>' + (r.tambon || '-') + '</td>' +
            '<td style="text-align:center;"><span class="nfe-badge-hours"><i class="fas fa-clock mr-1"></i>' + r.hoursGranted + '</span></td>' +
            '<td style="text-align:center;">' + r.pointsUsed + '</td>' +
            '<td>' + r.createdAt + '</td>' +
            '<td style="text-align:center;"><span class="nfe-status-badge ' + statusClass + '">' + statusText + '</span></td>' +
            '<td style="text-align:center;">' + actionBtn + '</td>' +
            '</tr>';
        });
        tbody.innerHTML = rows;

        // Pagination
        var pag = document.getElementById('nfe-admin-pagination');
        var info = document.getElementById('nfe-admin-page-info');
        if (pag) pag.style.display = _nfeAdminTotalPages > 1 ? 'flex' : 'none';
        if (info) info.innerText = 'หน้า ' + _nfeAdminPage + '/' + _nfeAdminTotalPages;
        var prev = document.getElementById('btn-nfe-prev');
        var next = document.getElementById('btn-nfe-next');
        if (prev) prev.disabled = _nfeAdminPage <= 1;
        if (next) next.disabled = _nfeAdminPage >= _nfeAdminTotalPages;
      })
      .catch(function() {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px;">โหลดไม่สำเร็จ</td></tr>';
      });
  }
  window.loadNFEAdminReport = loadNFEAdminReport;

  function changeNFEPage(dir) {
    _nfeAdminPage = Math.max(1, Math.min(_nfeAdminTotalPages, _nfeAdminPage + dir));
    loadNFEAdminReport();
  }
  window.changeNFEPage = changeNFEPage;

  function exportNFEReportCsv() {
    var filterEl = document.getElementById('nfe-admin-tambon-filter');
    var tambon = filterEl ? filterEl.value : 'ทั้งหมด';
    // Re-fetch all data for export (page large)
    apiGet('getNFEAdminReport', withAuthParams({ tambon: tambon, page: 1 }))
      .then(function(res) {
        if (!res || res.status !== 'success' || !res.data || res.data.length === 0) {
          showCustomAlert('ไม่มีข้อมูลสำหรับส่งออก', 'warning');
          return;
        }
        var bom = '\uFEFF';
        var header = 'ชื่อ-นามสกุล,ตำบล,ชั่วโมง กพช.,แต้มที่ใช้,วันที่แลก\n';
        var rows = res.data.map(function(r) {
          return '"' + (r.fullName || r.username) + '","' + (r.tambon || '') + '",' + r.hoursGranted + ',' + r.pointsUsed + ',"' + r.createdAt + '"';
        }).join('\n');
        var blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'NFE_Hours_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(function() {
        showCustomAlert('เกิดข้อผิดพลาดในการส่งออก', 'error');
      });
  }
  window.exportNFEReportCsv = exportNFEReportCsv;

  function useNFEHoursAdmin(redemptionId, studentName, hours) {
    showCustomConfirm('ยืนยันบันทึกการใช้ชั่วโมง กพช. ของ "' + studentName + '" จำนวน ' + hours + ' ชั่วโมง?<br><br><span style="color:#ef4444;font-weight:700;">⚠️ การดำเนินการนี้จะหักจำนวนชั่วโมงสะสมออกจากบัญชีผู้เรียนและไม่สามารถย้อนคืนได้</span>', function() {
      showLoading(true);
      apiPost('useNFEHours', withAuthData({ redemptionId: redemptionId }))
        .then(function(res) {
          showLoading(false);
          if (res && res.status === 'success') {
            showCustomAlert('บันทึกการหักชั่วโมง กพช. สำเร็จแล้ว!', 'success');
            loadNFEAdminReport();
          } else {
            showCustomAlert('เกิดข้อผิดพลาด: ' + (res.message || 'ไม่สามารถทำรายการได้'), 'error');
          }
        })
        .catch(function() {
          showLoading(false);
          showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        });
    });
  }
  window.useNFEHoursAdmin = useNFEHoursAdmin;

  function openCreditBankManual() {
    const modal = document.getElementById('credit-bank-manual-modal');
    if (modal) modal.style.display = 'flex';
  }
  function closeCreditBankManual() {
    const modal = document.getElementById('credit-bank-manual-modal');
    if (modal) modal.style.display = 'none';
  }
  window.openCreditBankManual = openCreditBankManual;
  window.closeCreditBankManual = closeCreditBankManual;

  // ===== MULTI-TENANT INSTITUTION & CSV IMPORT MODAL ACTIONS =====
  function openInstitutionModal(instId) {
    const modal = document.getElementById('modal-institution-form');
    if (!modal) return;

    const idInput = document.getElementById('inst-input-id');
    const nameInput = document.getElementById('inst-input-name');
    const districtInput = document.getElementById('inst-input-district');
    const provinceInput = document.getElementById('inst-input-province');
    const codeInput = document.getElementById('inst-input-code');
    const colorInput = document.getElementById('inst-input-color');
    const subUnitsInput = document.getElementById('inst-input-sub-units');
    const titleEl = document.getElementById('inst-modal-title');
    const subEl = document.getElementById('inst-modal-sub');
    const submitBtn = document.getElementById('inst-submit-btn');

    if (instId) {
      const list = window._cachedInstitutionsList || [];
      const inst = list.find(function(i) { return String(i.id) === String(instId); });
      if (inst) {
        if (idInput) idInput.value = inst.id || '';
        if (nameInput) nameInput.value = inst.name || '';
        if (districtInput) districtInput.value = inst.district || '';
        if (provinceInput) provinceInput.value = inst.province || 'เชียงใหม่';
        if (codeInput) codeInput.value = inst.code || '';
        if (colorInput) colorInput.value = inst.themeColor || '#059669';
        if (subUnitsInput) subUnitsInput.value = (inst.subUnits || inst.sub_units || []).join('\n');
        if (titleEl) titleEl.innerText = '🏛️ จัดการสถานศึกษาในสังกัด';
        if (subEl) subEl.innerText = 'แก้ไขข้อมูลและรายชื่อสถานศึกษาในสังกัด (ศกร.ตำบล / ศศช.)';
        if (submitBtn) submitBtn.innerText = '💾 บันทึกการเปลี่ยนแปลง';
      }
    } else {
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (districtInput) districtInput.value = '';
      if (provinceInput) provinceInput.value = 'เชียงใหม่';
      if (codeInput) codeInput.value = '';
      if (colorInput) colorInput.value = '#059669';
      if (subUnitsInput) subUnitsInput.value = '';
      if (titleEl) titleEl.innerText = '🏫 เพิ่มสถานศึกษาใหม่ (Multi-Tenant)';
      if (subEl) subEl.innerText = 'กางระบบรองรับ สกร.อำเภอ หรือโรงเรียนใหม่ในเซิร์ฟเวอร์เดียว';
      if (submitBtn) submitBtn.innerText = '💾 บันทึกและสร้างสถานศึกษาใหม่';
    }

    modal.style.display = 'flex';
  }
  function closeInstitutionModal() {
    const modal = document.getElementById('modal-institution-form');
    if (modal) modal.style.display = 'none';
  }
  window.openInstitutionModal = openInstitutionModal;
  window.closeInstitutionModal = closeInstitutionModal;

  function submitCreateInstitutionAction() {
    const id = (document.getElementById('inst-input-id')?.value || '').trim();
    const name = (document.getElementById('inst-input-name')?.value || '').trim();
    const district = (document.getElementById('inst-input-district')?.value || '').trim();
    const province = (document.getElementById('inst-input-province')?.value || '').trim() || 'เชียงใหม่';
    const code = (document.getElementById('inst-input-code')?.value || '').trim();
    const themeColor = document.getElementById('inst-input-color')?.value || '#059669';
    const subUnits = (document.getElementById('inst-input-sub-units')?.value || '').trim();

    if (!name) {
      showCustomAlert('กรุณากรอกชื่อสถานศึกษา', 'warning');
      return;
    }

    showLoading(true);
    apiPost('createOrUpdateInstitution', withAuthData({
      id: id,
      name: name,
      district: district,
      province: province,
      code: code,
      themeColor: themeColor,
      subUnits: subUnits
    })).then(function(res) {
      showLoading(false);
      if (res && res.status === 'success') {
        showCustomAlert(id ? 'บันทึกข้อมูลสถานศึกษาเรียบร้อยแล้ว!' : 'เพิ่มสถานศึกษาใหม่สำเร็จเรียบร้อยแล้ว!', 'success');
        closeInstitutionModal();
        if (typeof loadAdminInstitutions === 'function') loadAdminInstitutions(true);
        if (typeof renderSettingsTabInstitutions === 'function') renderSettingsTabInstitutions();
        if (typeof loadAdminStats === 'function') loadAdminStats();
      } else {
        showCustomAlert(res.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    });
  }
  window.submitCreateInstitutionAction = submitCreateInstitutionAction;

  function openImportSourcesModal() {
    const modal = document.getElementById('modal-import-sources-form');
    if (modal) modal.style.display = 'flex';
  }
  function closeImportSourcesModal() {
    const modal = document.getElementById('modal-import-sources-form');
    if (modal) modal.style.display = 'none';
  }
  window.openImportSourcesModal = openImportSourcesModal;
  window.closeImportSourcesModal = closeImportSourcesModal;

  function submitImportSourcesCsvAction() {
    const instId = document.getElementById('import-sources-inst-select')?.value || 'INS_PHRAO';
    const fileInput = document.getElementById('import-sources-file-input');
    const textArea = document.getElementById('import-sources-text-area');

    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = function(e) {
        const text = e.target.result;
        executeSourcesCsvUpload(instId, text);
      };
      reader.readAsText(file);
    } else if (textArea && textArea.value.trim()) {
      executeSourcesCsvUpload(instId, textArea.value.trim());
    } else {
      showCustomAlert('กรุณาเลือกไฟล์ .csv หรือกรอกเนื้อหา CSV ข้อมูลฐานเรียนรู้', 'warning');
    }
  }
  window.submitImportSourcesCsvAction = submitImportSourcesCsvAction;

  function executeSourcesCsvUpload(instId, csvText) {
    showLoading(true);
    apiPost('importSourcesCsv', withAuthData({
      institutionId: instId,
      csvContent: csvText
    })).then(function(res) {
      showLoading(false);
      if (res && res.status === 'success') {
        showCustomAlert(res.message || 'นำเข้าข้อมูลฐานเรียนรู้สำเร็จเรียบร้อยแล้ว!', 'success');
        closeImportSourcesModal();
        if (typeof fetchAdminSources === 'function') fetchAdminSources();
      } else {
        showCustomAlert(res.message || 'เกิดข้อผิดพลาดในการนำเข้าไฟล์', 'error');
      }
    }).catch(function() {
      showLoading(false);
      showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    });
  }
  window.openCreditBankManual = openCreditBankManual;
  window.closeCreditBankManual = closeCreditBankManual;

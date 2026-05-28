const API_URL = 'https://script.google.com/macros/s/AKfycby5vSJSJZiL9qu6GPJgwVXNOIJvuHRc0JIqhf2TLp8j3kXcniD9HqShiIDt3-PUKjLA/exec';



function apiGet(action, params) {
  var url = new URL(API_URL);
  url.searchParams.set('action', action);
  if (params) {
    Object.keys(params).forEach(function(k) {
      if (params[k] !== null && params[k] !== undefined && String(params[k]) !== '') {
        url.searchParams.set(k, String(params[k]));
      }
    });
  }
  return fetch(url.toString()).then(function(r) { return r.json(); });
}

function apiPost(action, data) {
  return fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: action, data: data || {} }),
    redirect: 'follow'
  }).then(function(r) { return r.json(); });
}

function getAuthContext() {
  var role = localStorage.getItem("userRole") || "user";
  return {
    phone: localStorage.getItem("userPhone") || "",
    role: String(role || "user").trim().toLowerCase(),
    tambon: localStorage.getItem("userTambon") || ""
  };
}

function withAuthParams(params) {
  var auth = getAuthContext();
  var out = Object.assign({}, params || {});
  if (!out.phone && auth.phone) out.phone = auth.phone;
  if (!out.username && auth.phone) out.username = auth.phone;
  if (!out.role && auth.role) out.role = auth.role;
  if (!out.tambon && auth.tambon) out.tambon = auth.tambon;
  return out;
}

function withAuthData(data) {
  return withAuthParams(data || {});
}


  function escapeJS(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, " ").replace(/\r/g, "");
  }

  let currentUserProfileUrl = "";
  let currentQuizData = [];   
  let currentQuestionIndex = 0; 
  let userScore = 0;          
  let selectedAnswer = "";    
  let activeSourceId = "";    
  let activeBaseId = "";
  let activeSourceDetailData = null;
  let learningViewMode = "list"; // 'list' หรือ 'content'

  let cacheSources = null;
  let cacheMapSources = null;
  let cacheLeaderboard = null;
  let cacheProfile = null;
  let cacheHistory = null;
  let cacheHomeData = null;
  let evalRating = 0;
  let cacheProposals = null;
  let allMarketProducts = [];
  let cacheMarketProducts = null;
  
  let districtMap = null;
  let mapMarkers = [];
  let mapPicker = null;
  let mapPickerMarker = null;
  let confirmCallback = null;

  let currentLogPage = 1;
  let totalLogPages = 1;
  let adminSourcesCache = [];
  let adminBasesCache = [];
  let adminBasesCacheMap = {};
  let adminQuizzesCache = [];
  let adminDraggedQuizId = null;
  let adminDraggedBaseId = null;
  let adminHomeAreas = [];
  let adminHomeActivities = [];

  // เพิ่มตัวแปรสำหรับแบ่งหน้าประวัติเกียรติบัตร
  let currentCertPage = 1;
  let totalCertPages = 1;
  const CERTS_PER_PAGE = 5;

  // 🌟 ฟังก์ชันตัวช่วย: กำหนดสีและไอคอนตามระดับ Rank (Emerald Palette)
  function getRankStyle(levelStr) {
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
    type = type || 'info';
    title = title || 'แจ้งเตือน';
    const modal = document.getElementById('custom-alert-modal');
    const icon = document.getElementById('custom-alert-icon');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');
    const cancelBtn = document.getElementById('custom-alert-cancel');
    
    msgEl.innerHTML = message; titleEl.innerText = title;
    cancelBtn.style.display = 'none'; confirmCallback = null;

    if (type === 'success') { icon.innerHTML = '<i class="fas fa-check-circle" style="color: #10b981;"></i>'; }
    else if (type === 'error') { icon.innerHTML = '<i class="fas fa-times-circle" style="color: #ef4444;"></i>'; titleEl.innerText = 'เกิดข้อผิดพลาด';}
    else if (type === 'warning') { icon.innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i>'; }
    else { icon.innerHTML = '<i class="fas fa-info-circle" style="color: #10b981;"></i>'; }

    modal.style.display = 'flex';
  }

  function showCustomConfirm(message, callback) {
    showCustomAlert(message, 'warning', 'ยืนยันการทำรายการ');
    document.getElementById('custom-alert-cancel').style.display = 'block'; 
    confirmCallback = callback;
  }

  function closeCustomAlert(isOk) {
    document.getElementById('custom-alert-modal').style.display = 'none';
    if (isOk && confirmCallback) confirmCallback(); 
  }

  function updateNavByRole() {
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    
    const logNav = document.getElementById('nav-log');
    if (logNav) logNav.style.display = (role === "user") ? "flex" : "none";
    
    const isStaff = (role === "teacher" || role === "admin");
    const manageNav = document.getElementById('nav-manage');
    if (manageNav) manageNav.style.display = isStaff ? "flex" : "none";
    
    const dashNav = document.getElementById('nav-dashboard');
    if (dashNav) dashNav.style.display = isStaff ? "flex" : "none";
  }

  function showPage(pageId) {
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
    const sysActions = document.getElementById('system-top-right-actions'); 
    
    if (['login-page', 'register-page', 'quiz-page', 'result-page'].includes(pageId)) {
      if(bottomNav) bottomNav.style.display = 'none';
      if(sysActions && (pageId === 'login-page' || pageId === 'register-page')) sysActions.style.display = 'none';
    } else {
      if(bottomNav) bottomNav.style.display = 'flex';
      if(sysActions) sysActions.style.display = 'flex';
      
      const navItems = document.querySelectorAll('.bottom-nav .nav-item');
      navItems.forEach(function(item) { item.classList.remove('active'); });
      
      const setNavActive = (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
      };

      if(pageId === 'home-page' || pageId === 'detail-page') { setNavActive('nav-home'); if(pageId === 'home-page') loadHomePageData(); }
      if(pageId === 'map-page') { setNavActive('nav-map'); loadDistrictMap(); }
      if(pageId === 'leaderboard-page') { setNavActive('nav-leaderboard'); loadLeaderboard(); }
      if(pageId === 'profile-page') { setNavActive('nav-profile'); loadProfileData(); }
      if(pageId === 'scan-page') { setNavActive('nav-scan'); }
      
      if(pageId === 'log-page') { setNavActive('nav-log'); loadMyLogs(1); }
      if(pageId === 'manage-page') { setNavActive('nav-manage'); }
      if(pageId === 'approve-page') { setNavActive('nav-manage'); loadPendingLogs(); }
      if(pageId === 'user-mgmt-page') { setNavActive('nav-manage'); loadUserMgmt(); }
      if(pageId === 'dashboard-page') { setNavActive('nav-dashboard'); loadDashboard(); }
      if(pageId === 'proposal-page') { loadUserProposals(); }
      if(pageId === 'market-page') { setNavActive('nav-market'); loadMarketData(); }
      if(pageId === 'admin-page') {
        const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
        if (role !== "admin" && role !== "teacher") {
          showCustomAlert("หน้านี้สำหรับผู้ดูแลระบบ/ครูประจำตำบลเท่านั้น", "warning");
          return showPage('home-page');
        }
        setNavActive('nav-manage');
        
        // Reset to first tab when entering admin page
        switchAdminTab('stats');

        const badge = document.querySelector('#admin-page .header-bar .user-badge');
        if (badge) {
          if (role === "admin") badge.innerText = "Admin";
          else badge.innerText = "Teacher";
        }
        const featuredWrapper = document.getElementById('admin-featured-wrapper');
        if (featuredWrapper) featuredWrapper.style.display = (role === "admin" || role === "teacher") ? "block" : "none";
        const srcTambonSelect = document.getElementById('admin-source-tambon');
        if (srcTambonSelect) {
          srcTambonSelect.disabled = false;
          if (role === "teacher" && !srcTambonSelect.value) {
            srcTambonSelect.value = localStorage.getItem("userTambon") || "";
          }
        }
        loadAdminSources();
        loadAdminHomeData();
      }
    }
  }

  function switchAdminTab(tabId) {
    // Update buttons
    document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('onclick').indexOf("'" + tabId + "'") > -1) btn.classList.add('active');
    });
    // Update content
    document.querySelectorAll('.admin-tab-content').forEach(function(content) {
      content.classList.remove('active');
    });
    const target = document.getElementById('admin-tab-' + tabId);
    if (target) target.classList.add('active');

    // Load data based on tab
    if (tabId === 'stats') loadAdminStats();
    else if (tabId === 'sources') loadAdminSources();
  }

  function loadAdminStats() {
    const areaList = document.getElementById('admin-top-areas-list');
    const filterEl = document.getElementById('admin-stats-tambon-filter');
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    
    // จัดการ Dropdown ตามสิทธิ์
    if (role === "teacher") {
       filterEl.value = localStorage.getItem("userTambon") || "";
       filterEl.disabled = true;
       document.getElementById('admin-stats-filter-container').style.display = 'none';
    } else {
       filterEl.disabled = false;
       document.getElementById('admin-stats-filter-container').style.display = 'block';
    }

    const tambonFilter = filterEl.value || "ทั้งหมด";
    areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs"><i class="fas fa-circle-notch fa-spin mr-1"></i> กำลังโหลด...</div>';

    apiGet('getAdminDashboardStats', withAuthParams({ tambon: tambonFilter }))
      .then(function(res) {
        if (res.status !== "success") {
          areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs">โหลดข้อมูลไม่สำเร็จ</div>';
          return;
        }
        
        document.getElementById('stat-total-users').innerText = res.totalUsers || 0;
        document.getElementById('stat-total-certs').innerText = res.totalCerts || 0;
        document.getElementById('stat-avg-satisfaction').innerText = res.avgSatisfaction || "0.0";
        document.getElementById('stat-rating-count').innerText = "จาก " + (res.totalRatings || 0) + " การประเมิน";
        document.getElementById('stat-pending-proposals').innerText = res.pendingProposals || 0;
        
        if (res.topAreas && res.topAreas.length > 0) {
          let html = '';
          const maxCount = res.topAreas[0].count;
          res.topAreas.forEach(function(area) {
            const pct = (area.count / maxCount * 100).toFixed(0);
            html += '<div class="space-y-1">' +
                      '<div class="flex justify-between text-xs">' +
                        '<span class="text-theme-inv font-semibold">' + area.name + '</span>' +
                        '<span class="text-muted">' + area.count + ' เรื่อง</span>' +
                      '</div>' +
                      '<div class="w-full bg-black/5 rounded-full h-1.5 overflow-hidden" style="background:rgba(0,0,0,0.05);">' +
                        '<div class="bg-primary h-full" style="width:' + pct + '%; background:var(--primary);"></div>' +
                      '</div>' +
                    '</div>';
          });
          areaList.innerHTML = html;
        } else {
          // ถ้าเป็นครู อาจจะแสดงข้อความอื่น
          const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
          if (role === "teacher") {
             areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs">แสดงเฉพาะสถิติในพื้นที่รับผิดชอบของคุณ</div>';
          } else {
             areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs">ยังไม่มีข้อมูลสถิติ</div>';
          }
        }
      }).catch(function() {
        areaList.innerHTML = '<div class="text-center text-muted py-4 text-xs">เกิดข้อผิดพลาด</div>';
      });
  }

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
      // For light mode, make nav-bg slightly translucent white if background is light
      if (!isDark) {
        root.style.setProperty('--nav-bg', 'rgba(255,255,255,0.95)');
      } else {
        root.style.setProperty('--nav-bg', bgColor);
      }
    }
    
    localStorage.setItem('appPrimaryColor', primaryColor);
    if (bgColor) localStorage.setItem('appBgColor', bgColor);
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light');
    
    document.getElementById('custom-color-picker').value = primaryColor;
  }

  function applyCustomTheme(hexColor) {
    // Generate a background based on primary color
    // If it's very dark, we assume they want dark mode, else light mode
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
      bgColor = '#f8fafc'; // Default soft light bg
    }
    
    applyAppTheme(hexColor, bgColor, isDark);
  }

  function handleRegister() {
    const fullName = (document.getElementById('reg-fullname').value || '').trim();
    const phone = (document.getElementById('reg-phone').value || '').trim();
    const tambon = (document.getElementById('reg-tambon').value || '').trim();
    const password = document.getElementById('reg-password').value || '';
    if(!fullName || !phone || !tambon || !password) return showCustomAlert("กรุณากรอกข้อมูลและเลือกตำบลให้ครบถ้วน", "warning");

    showLoading(true);
    apiPost('register', withAuthData({ fullName: fullName, phone: phone, tambon: tambon, password: password }))
      .then(function(res) {
        showLoading(false);
        if(res.status === "success") { showCustomAlert("สมัครสมาชิกสำเร็จ!", "success"); showPage('login-page'); }
        else { showCustomAlert(res.message, "error"); }
      }).catch(function() { showLoading(false); showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
  }

  function handleLogin() {
    const phone = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    if(!phone || !password) return showCustomAlert("กรุณากรอกเบอร์โทรและรหัสผ่านให้ครบครับ", "warning");

    showLoading(true);
    apiPost('login', { phone: phone, password: password })
      .then(function(res) {
        showLoading(false);
        if(res.status === "success") {
          localStorage.setItem("userPhone", res.user.phone);
          localStorage.setItem("userName", res.user.fullName);
          localStorage.setItem("userRole", String(res.user.role || "user").trim().toLowerCase());
          localStorage.setItem("userTambon", res.user.tambon);
          localStorage.setItem("userScore", res.user.score || "0");
          document.getElementById('header-user-name').innerText = res.user.fullName;
          updateNavByRole();
          showPage('home-page');
        } else { showCustomAlert(res.message, "error"); }
      }).catch(function() { showLoading(false); showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
  }

  function logout() {
    showCustomConfirm("คุณต้องการออกจากระบบใช่หรือไม่?", function() {
      localStorage.removeItem("userPhone");
      localStorage.removeItem("userName");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userTambon");
      // Clear frontend caches
      cacheSources = null;
      cacheMapSources = null;
      cacheLeaderboard = null;
      cacheProfile = null;
      cacheHistory = null;
      cacheHomeData = null;
      cacheProposals = null;
      allMarketProducts = [];
      cacheMarketProducts = null;
      showPage('login-page');
    });
  }

  function submitLog() {
    const activity = document.getElementById('log-activity-name').value;
    const desc = document.getElementById('log-description').value;
    if(!activity || !desc) return showCustomAlert("กรุณากรอกชื่อกิจกรรมและรายละเอียดให้ครบถ้วน", "warning");

    showLoading(true);
    const data = {
      phone: localStorage.getItem("userPhone"),
      tambon: localStorage.getItem("userTambon"),
      activityName: activity,
      description: desc
    };

    apiPost('submitLog', withAuthData(data))
      .then(function(res) {
        showLoading(false);
        if(res.status === "success") {
          showCustomAlert(res.message, "success");
          document.getElementById('log-activity-name').value = '';
          document.getElementById('log-description').value = '';
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
                 
      if (log.note) { html += '<div class="mt-2 p-2" style="background:var(--bg2); border-radius:5px; font-size:0.85rem; border-left:3px solid var(--primary); color: var(--text);"><b>💬 ข้อเสนอแนะจากครู:</b> ' + log.note + '</div>'; }
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
    
    // Reset to first tab
    switchApproveTab('logs');
  }

  function switchApproveTab(tabName) {
    document.querySelectorAll('.approve-tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('#approve-page .admin-tab-btn').forEach(b => b.classList.remove('active'));
    
    if (tabName === 'logs') {
      document.getElementById('approve-tab-logs').style.display = 'block';
      document.querySelector('#approve-page .admin-tab-btn:nth-child(1)').classList.add('active');
      fetchPendingLogs();
    } else if (tabName === 'proposals') {
      document.getElementById('approve-tab-proposals').style.display = 'block';
      document.querySelector('#approve-page .admin-tab-btn:nth-child(2)').classList.add('active');
      loadPendingProposals();
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
                       '<i class="fas fa-map-marker-alt"></i> ' + areaTag + ' | 📅 ' + log.date + 
                     '</div>' +
                     '<div class="log-desc mb-3" style="-webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden;">' + log.description + '</div>' +
                     '<button class="btn-primary w-100" style="background-color: var(--primary-color);" onclick="openReviewModal(\'' + escapeJS(log.logId) + '\', \'' + escapeJS(log.phone) + '\', \'' + escapeJS(log.activityName) + '\', \'' + escapeJS(log.fullName || 'ไม่ระบุชื่อ') + '\', \'' + escapeJS(areaTag) + '\')">' +
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
                       '<i class="fas fa-map-marker-alt"></i> ' + areaTag + ' | 📅 ' + item.timestamp + 
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

  function openReviewModal(logId, phone, activity, fullName, area) {
    document.getElementById('review-log-id').value = logId;
    document.getElementById('review-phone').innerText = (fullName || 'ไม่ระบุชื่อ') + ' (' + phone + ')';
    document.getElementById('review-area').innerText = area;
    document.getElementById('review-activity').innerText = activity;
    document.getElementById('review-score').value = 50; 
    document.getElementById('review-note').value = '';
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

  function loadUserMgmt() {
    const role = localStorage.getItem("userRole");
    const tambon = localStorage.getItem("userTambon") || "ไม่ระบุ";
    const badge = document.getElementById('user-mgmt-tambon-badge');
    const filterContainer = document.getElementById('admin-user-filter-container');
    const filterEl = document.getElementById('user-mgmt-tambon-filter');

    if (role === 'admin') {
      badge.innerText = "ทุกพื้นที่ (Admin)";
      filterContainer.style.display = 'block';
    } else {
      badge.innerText = formatTambon(tambon);
      filterContainer.style.display = 'none';
      filterEl.value = tambon;
    }

    fetchUserMgmtList();
  }

  let currentUserMgmtTab = 'approve';
  function switchUserMgmtTab(tabId) {
    currentUserMgmtTab = tabId;
    document.getElementById('tab-btn-approve-img').classList.toggle('active', tabId === 'approve');
    document.getElementById('tab-btn-all-users').classList.toggle('active', tabId === 'all');
    const certBtn = document.getElementById('tab-btn-cert-history');
    if (certBtn) certBtn.classList.toggle('active', tabId === 'cert');

    const titleEl = document.getElementById('user-mgmt-title');
    if (titleEl) {
      titleEl.innerText = tabId === 'cert' ? 'ประวัติการออกใบเกียรติบัตร' : 'รายชื่อสมาชิก';
    }

    if (tabId === 'cert') {
      fetchCertHistory();
    } else {
      renderUserMgmtList(fullUserList);
    }
  }

  let fullUserList = [];
  let fullCertHistory = [];

  function onUserMgmtTambonFilterChange() {
    if (currentUserMgmtTab === 'cert') fetchCertHistory();
    else fetchUserMgmtList();
  }

  function fetchUserMgmtList() {
    const role = localStorage.getItem("userRole");
    let tambon = localStorage.getItem("userTambon");
    const filterEl = document.getElementById('user-mgmt-tambon-filter');
    
    if (role === 'admin') tambon = filterEl.value || "ทั้งหมด";

    const container = document.getElementById('user-mgmt-list');
    container.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    apiGet('getUsersByTambon', withAuthParams({ tambon: tambon }))
      .then(function(users) {
        fullUserList = users || [];
        if (currentUserMgmtTab !== 'cert') renderUserMgmtList(fullUserList);
      }).catch(function() {
        container.innerHTML = '<div class="text-center text-muted py-8">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
      });
  }

  function fetchCertHistory() {
    const role = localStorage.getItem("userRole");
    let tambon = localStorage.getItem("userTambon");
    const filterEl = document.getElementById('user-mgmt-tambon-filter');
    if (role === 'admin') tambon = filterEl.value || "ทั้งหมด";

    const container = document.getElementById('user-mgmt-list');
    container.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    apiGet('getCertIssuanceHistory', withAuthParams({ tambon: tambon }))
      .then(function(res) {
        if (res && res.status === 'success') {
          fullCertHistory = res.items || [];
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
    
    // กรองตาม Tab
    let filtered = users;
    if (currentUserMgmtTab === 'approve') {
      filtered = users.filter(function(u) { return u.imageStatus === 'Pending'; });
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
      const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
      const imgUrl = (u.profileImage && u.profileImage.startsWith('http')) ? u.profileImage : placeholderImg;

      html += '<div class="rank-card" style="margin-bottom:12px; align-items:flex-start; padding:15px; flex-direction:column; gap:12px;">' +
                '<div class="flex items-center w-full gap-3">' +
                  '<img src="' + imgUrl + '" class="w-12 h-12 rounded-full object-cover border-2" style="border-color:' + statusColor + '">' +
                  '<div class="flex-grow">' +
                    '<div class="font-bold text-theme-inv">' + u.fullName + '</div>' +
                    '<div class="text-[10px] text-muted">' + u.username + ' • ' + formatTambon(u.tambon) + '</div>' +
                  '</div>' +
                  '<div class="text-[10px] font-bold px-2 py-1 rounded" style="background:var(--glass); color:' + statusColor + '">' + statusText + '</div>' +
                '</div>';
      
      if (currentUserMgmtTab === 'approve') {
        // Tab อนุมัติรูป: โชว์แค่ปุ่มอนุมัติ/ไม่อนุมัติ
        if (u.profileImage && u.profileImage.startsWith('http')) {
          html += '<div class="flex gap-2 w-full">' +
                    '<button class="btn-primary flex-1" style="padding:6px; font-size:0.75rem; background:#ef4444;" onclick="approveUserImage(\'' + u.username + '\', \'Rejected\')">' +
                      '<i class="fas fa-times mr-1"></i> ไม่อนุมัติรูป' +
                    '</button>' +
                    '<button class="btn-primary flex-1" style="padding:6px; font-size:0.75rem; background:#10b981;" onclick="approveUserImage(\'' + u.username + '\', \'Approved\')">' +
                      '<i class="fas fa-check mr-1"></i> อนุมัติรูป' +
                    '</button>' +
                  '</div>';
        }
      } else {
        // Tab จัดการทั้งหมด: โชว์ปุ่มแก้ไข และ ลบ
        html += '<div class="flex gap-2 w-full">' +
                  '<button class="btn-primary flex-1" style="padding:6px; font-size:0.75rem; background:var(--glass); color:var(--text); border:1px solid var(--card-border);" onclick="openEditUserModal(\'' + u.username + '\', \'' + escapeJS(u.fullName) + '\', \'' + (u.profileImage || '') + '\')">' +
                    '<i class="fas fa-edit mr-1"></i> แก้ไข' +
                  '</button>' +
                  '<button class="btn-primary flex-1" style="padding:6px; font-size:0.75rem; background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid #ef4444;" onclick="deleteUser(\'' + u.username + '\')">' +
                    '<i class="fas fa-trash-alt mr-1"></i> ลบ' +
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
      const score = it.score ? it.score : '-';
      const src = it.sourceName ? it.sourceName : '-';
      const link = it.certUrl ? it.certUrl : '';

      html += '<div class="rank-card" style="margin-bottom:12px; align-items:flex-start; padding:15px; flex-direction:column; gap:10px;">' +
                '<div class="flex items-start w-full gap-3">' +
                  '<div class="w-10 h-10 rounded-full flex items-center justify-center" style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.35); color:var(--gold); flex-shrink:0;">' +
                    '<i class="fas fa-award"></i>' +
                  '</div>' +
                  '<div class="flex-grow">' +
                    '<div class="font-bold text-theme-inv">' + escapeHtml(who) + '</div>' +
                    '<div class="text-[10px] text-muted">' + escapeHtml(it.userId || '-') + ' • ' + escapeHtml(area) + '</div>' +
                  '</div>' +
                  '<div class="text-[10px] font-bold px-2 py-1 rounded" style="background:var(--glass); color:var(--text); border:1px solid var(--card-border);">' + escapeHtml(whenText) + '</div>' +
                '</div>' +
                '<div class="text-xs" style="color:var(--text-soft)">' +
                  '<div><span style="color:var(--text)">เนื้อหา:</span> ' + escapeHtml(src) + '</div>' +
                  '<div><span style="color:var(--text)">คะแนน:</span> ' + escapeHtml(score) + '</div>' +
                '</div>' +
                (link ? ('<a href="' + link + '" target="_blank" class="btn-primary" style="padding:7px 12px; width:auto; font-size:0.75rem; background:var(--primary); text-decoration:none; display:inline-flex; align-items:center; gap:8px;">' +
                          '<i class="fas fa-eye"></i> เปิดใบเกียรติบัตร' +
                        '</a>') : '') +
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

  function openEditUserModal(username, fullName, profileImage) {
    document.getElementById('edit-user-username').value = username;
    document.getElementById('edit-user-fullname').value = fullName;
    document.getElementById('edit-user-image').value = profileImage;
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

    if (!fullName) return showCustomAlert("กรุณากรอกชื่อ-นามสกุล", "warning");

    showLoading(true);
    apiPost('updateUserDetails', withAuthParams({ targetUserId: username, fullName: fullName, profileImage: profileImage }))
      .then(function(res) {
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

  function deleteUser(username) {
    showCustomAlert("คุณต้องการลบสมาชิกรายนี้ใช่หรือไม่? ข้อมูลจะถูกลบถาวร", "warning", true, function(confirm) {
      if (confirm) {
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
      }
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
      const filtered = fullUserList.filter(function(u) {
        return u.fullName.toLowerCase().includes(query) || u.username.includes(query);
      });
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
    let lvl = String(levelStr || "").toUpperCase();
    if (lvl.indexOf("GLORIOUS") > -1 || lvl.indexOf("CONQUEROR") > -1) return 'lvl-6';
    if (lvl.indexOf("ต้นแบบ") > -1 || lvl.indexOf("MASTER") > -1) return 'lvl-5';
    if (lvl.indexOf("เชี่ยวชาญ") > -1 || lvl.indexOf("DIAMOND") > -1) return 'lvl-4';
    if (lvl.indexOf("ก้าวหน้า") > -1 || lvl.indexOf("PLATINUM") > -1) return 'lvl-3';
    if (lvl.indexOf("กลาง") > -1 || lvl.indexOf("GOLD") > -1) return 'lvl-2';
    if (lvl.indexOf("ต้น") > -1 || lvl.indexOf("SILVER") > -1) return 'lvl-1';
    return 'lvl-0';
  }

  function loadDashboard() {
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const myTambon = localStorage.getItem("userTambon") || "";
    const filterEl = document.getElementById('dash-tambon-filter');
    if (role === "teacher" && filterEl) {
      filterEl.value = myTambon;
      filterEl.disabled = true;
    } else if (filterEl) {
      filterEl.disabled = false;
    }
    const tambonFilter = filterEl ? filterEl.value : "";
    document.getElementById('dash-ranking-container').innerHTML = '<div class="text-center text-muted my-4"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    
    apiGet('getDashboard', withAuthParams({ tambon: tambonFilter }))
      .then(function(dashData) {
        document.getElementById('dash-total-users').innerText = dashData.totalLearners;
        const container = document.getElementById('dash-ranking-container');
        if(dashData.ranking.length === 0) {
          container.innerHTML = '<div class="text-center text-muted">ยังไม่มีข้อมูลนักเรียนรู้</div>';
        } else {
          let html = '';
          dashData.ranking.forEach(function(user, index) {
            let rStyle = getRankStyle(user.level);
            let defaultImg = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random&color=fff';
            let imgUrl = (user.image && String(user.image).trim() !== "") ? user.image : defaultImg;
            let lvlClass = getLvlClass(user.level);
            let glowColor = rStyle.color === '#10b981' ? 'rgba(16, 185, 129, 0.4)' : 
                            rStyle.color === '#fbbf24' ? 'rgba(251, 191, 36, 0.4)' : 
                            rStyle.color === '#cbd5e1' ? 'rgba(203, 213, 225, 0.4)' : 
                            'rgba(16, 185, 129, 0.3)';
            html += '<div class="rank-card" style="border-left: 6px solid ' + rStyle.color + '; background: linear-gradient(to right, white, #fcfcfc);">' +
                       '<div class="rank-number" style="color: ' + rStyle.color + '; width:50px; font-weight:900; font-size:1.3rem;">' + (index + 1) + '</div>' +
                       '<div class="avatar-ring-wrapper avatar-ring-sm" style="--avatar-border-color: ' + rStyle.color + '; --avatar-shadow-color: ' + glowColor + ';">' +
                         '<div class="profile-avatar-ring ' + lvlClass + '"></div>' +
                         '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="rank-img-sm">' +
                       '</div>' +
                       '<div class="rank-info">' +
                         '<div style="display:flex; justify-content:space-between; align-items:center;">' +
                           '<span class="rank-name" style="font-size:1.1rem; color:#2d3436;">' + user.name + '</span>' +
                           '<span style="background:' + rStyle.color + '; color:white; font-size:0.65rem; padding:2px 8px; border-radius:10px; font-weight:bold; letter-spacing:0.5px;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title.toUpperCase() + '</span>' +
                         '</div>' +
                         '<div class="rank-score" style="margin-top:3px;">' +
                           '<span style="color:#7f8c8d; font-size:0.85rem;"><i class="fas fa-award"></i> ' + user.level + '</span>' +
                           ' | <b style="color:' + rStyle.color + '; font-size:1rem;">' + user.score + ' แต้ม</b>' +
                         '</div>' +
                         '<div style="font-size:0.7rem; color:#b2bec3; margin-top:2px;">📍 ' + formatTambon(user.tambon) + '</div>' +
                       '</div>' +
                     '</div>';
          });
          container.innerHTML = html;
        }
      }).catch(function() {
        document.getElementById('dash-ranking-container').innerHTML = '<div class="text-center text-muted">โหลดไม่สำเร็จ</div>';
      });
  }

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

  function openMapLink(mapLink, fallbackLocationName) {
    const link = String(mapLink == null ? '' : mapLink).trim();
    if (link && link.toLowerCase().indexOf('http') === 0) return window.open(link, '_blank');
    const q = encodeURIComponent(String(fallbackLocationName || '').trim());
    if (!q) return showCustomAlert("ยังไม่พบข้อมูลนำทางของกิจกรรมนี้", "warning");
    window.open('https://www.google.com/maps/search/?api=1&query=' + q, '_blank');
  }

  function loadHomePageData(forceReload, q, y) {
    const qy = (q && y) ? { quarter: q, year: y } : getCurrentQuarterAndYear();
    if (!forceReload && cacheHomeData && cacheHomeData.quarter === qy.quarter && cacheHomeData.year === qy.year) {
      return renderHomePage(cacheHomeData);
    }
    
    document.getElementById('home-featured-container').innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-circle-notch fa-spin mr-1" style="color:var(--primary)"></i> กำลังโหลดกิจกรรมเด่น...</div>';
    document.getElementById('home-activities-container').innerHTML = '<div class="text-center text-muted py-3"><i class="fas fa-circle-notch fa-spin mr-1" style="color:var(--primary)"></i> กำลังโหลดกิจกรรม...</div>';
    
    apiGet('getHomeData', { quarter: qy.quarter, year: qy.year })
      .then(function(res) {
        if (res.status !== "success") {
          document.getElementById('home-featured-container').innerHTML = '<div class="text-center text-muted py-3">โหลดข้อมูลไม่สำเร็จ</div>';
          document.getElementById('home-activities-container').innerHTML = '<div class="text-center text-muted py-3">โหลดข้อมูลไม่สำเร็จ</div>';
          return;
        }
        cacheHomeData = res;
        renderHomePage(res);
      }).catch(function() {
        document.getElementById('home-featured-container').innerHTML = '<div class="text-center text-muted py-3">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>';
        document.getElementById('home-activities-container').innerHTML = '<div class="text-center text-muted py-3">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>';
      });
  }

  function onHomeFilterChange() {
    const monthVal = document.getElementById('home-month-filter').value;
    if (monthVal === "") {
      document.getElementById('home-activities-container').innerHTML = '<div class="text-center text-muted py-5">กรุณาเลือกเดือนเพื่อดูข้อมูลกิจกรรม</div>';
      return;
    }
    
    const month = parseInt(monthVal);
    const now = new Date();
    const targetYear = now.getFullYear();
    const targetQuarter = Math.floor(month / 3) + 1;

    if (!cacheHomeData || cacheHomeData.quarter !== targetQuarter || cacheHomeData.year !== targetYear) {
      loadHomePageData(true, targetQuarter, targetYear);
    } else {
      renderHomeActivities();
    }
  }

  function renderHomePage(data) {
    const quarterLabel = document.getElementById('home-quarter-label');
    const monthFilter = document.getElementById('home-month-filter');
    
    // ไม่ตั้งค่าเริ่มต้น เพื่อให้ผู้ใช้เลือกเองตามความต้องการ
    
    if (quarterLabel) {
      const monthNames = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const monthVal = monthFilter ? monthFilter.value : "";
      if (monthVal !== "") {
        const monthThai = monthNames[parseInt(monthVal)] || '-';
        const yearBE = (data.year || new Date().getFullYear()) + 543;
        quarterLabel.innerText = 'กิจกรรมเดือน' + monthThai + ' ' + yearBE;
        quarterLabel.style.display = 'inline-block';
      } else {
        quarterLabel.innerText = 'เลือกเดือน';
        quarterLabel.style.display = 'none'; // ซ่อนไว้ก่อนจนกว่าจะเลือก
      }
    }
    renderHomeFeatured(data.featured);
    renderHomeAreas(data.areas || []);
    renderHomeActivities();
  }

  function renderHomeFeatured(featured) {
    const container = document.getElementById('home-featured-container');
    if (!featured) {
      container.innerHTML = '<div class="text-center text-muted py-3">ยังไม่มีกิจกรรมเด่นในระบบ</div>';
      return;
    }
    const img = featured.imageUrl || 'https://via.placeholder.com/600x300?text=Featured+Activity';
    let dateText = '';
    if (featured.startDate || featured.endDate) {
      const startThai = formatThaiDate(featured.startDate);
      const endThai = formatThaiDate(featured.endDate);
      if (startThai && endThai && startThai !== endThai) dateText = '📅 ' + startThai + ' - ' + endThai;
      else dateText = '📅 ' + (startThai || endThai || '-');
    }
    container.innerHTML =
      '<div class="home-featured-card">' +
        '<img src="' + img + '" loading="lazy" class="home-featured-img" alt="featured">' +
        '<div class="home-featured-body">' +
          '<h4 class="home-featured-title">' + (featured.title || '-') + '</h4>' +
          (dateText ? '<div class="home-featured-meta">' + dateText + '</div>' : '') +
          '<div class="home-featured-meta">📍 ' + (featured.locationName || '-') + '</div>' +
          (featured.shortDesc ? '<p class="home-featured-desc">' + featured.shortDesc + '</p>' : '') +
          '<button class="btn-primary w-100" onclick="openMapLink(\'' + escapeJS(featured.mapLink || '') + '\', \'' + escapeJS(featured.locationName || '') + '\')">' +
            '<i class="fas fa-route mr-1"></i>นำทางไปกิจกรรมเด่น' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function renderHomeAreas(areas) {
    const areaSelect = document.getElementById('home-area-filter');
    let options = '<option value="">ทุกพื้นที่</option>';
    areas.forEach(function(a) {
      options += '<option value="' + a.areaCode + '">' + a.areaName + '</option>';
    });
    areaSelect.innerHTML = options;
  }

  function renderHomeActivities() {
    const container = document.getElementById('home-activities-container');
    const areaCode = (document.getElementById('home-area-filter').value || '').trim();
    const monthVal = document.getElementById('home-month-filter').value;
    
    if (monthVal === "") {
      container.innerHTML = '<div class="text-center text-muted py-5">กรุณาเลือกเดือนเพื่อดูข้อมูลกิจกรรม</div>';
      return;
    }

    const all = cacheHomeData && cacheHomeData.activities ? cacheHomeData.activities : [];
    const areas = cacheHomeData && cacheHomeData.areas ? cacheHomeData.areas : [];
    
    const selectedMonth = parseInt(monthVal);
    const selectedYear = cacheHomeData ? cacheHomeData.year : new Date().getFullYear();

    let list = all.filter(function(item) {
      if (!item.activityDate) return false;
      const d = new Date(item.activityDate);
      return !isNaN(d.getTime()) && d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    if (areaCode) list = list.filter(function(item) { return String(item.areaCode) === areaCode; });
    
    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3">ไม่มีกิจกรรมที่จัดขึ้นในเงื่อนไขที่เลือก</div>';
      return;
    }

    let html = '';
    list.forEach(function(item) {
      const area = areas.find(function(a) { return String(a.areaCode) === String(item.areaCode); });
      html += '<div class="home-activity-row" onclick="openHomeActivityDetail(\'' + escapeJS(item.activityId) + '\')">' +
                '<div class="home-activity-main">' +
                  '<div class="home-activity-name">' + (item.activityName || '-') + '</div>' +
                  '<div class="home-activity-sub">📍 ' + (area ? area.areaName : item.areaCode) + '</div>' +
                '</div>' +
                '<div class="home-activity-date">' + formatThaiDateShort(item.activityDate) + '</div>' +
              '</div>';
    });
    container.innerHTML = html;
  }

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
    msg += '<div style="margin-bottom:4px;">📍 พื้นที่: ' + (area ? area.areaName : item.areaCode) + '</div>';
    msg += '<div style="margin-bottom:4px;">🗓️ วันที่: ' + (formatThaiDate(item.activityDate) || '-') + '</div>';
    msg += '<div style="margin-bottom:4px;">🏫 สถานที่: ' + (item.locationName || '-') + '</div>';
    msg += '<div style="margin-bottom:8px;">🎯 สิ่งที่จะได้รับ: ' + (item.benefit || '-') + '</div>';
    msg += '<div style="margin-bottom:4px;">👥 รับสมัคร: ' + (item.capacity || '-') + '</div>';
    msg += '<div style="margin-bottom:8px;">📞 ติดต่อ: ' + (item.contactName || '-') + ' ' + (item.contactPhone || '') + '</div>';
    msg += '</div>';
    showCustomAlert(msg, 'info', 'รายละเอียดกิจกรรม');
  }

  function loadAdminHomeData() {
    const qy = getCurrentQuarterAndYear();
    const quarterInput = document.getElementById('admin-quarter-select');
    const yearInput = document.getElementById('admin-year-input');
    if (quarterInput && !quarterInput.value) quarterInput.value = String(qy.quarter);
    if (yearInput && !yearInput.value) yearInput.value = String(qy.year);

    apiGet('getAdminHomeData', withAuthParams({ quarter: quarterInput.value || qy.quarter, year: yearInput.value || qy.year }))
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
    document.getElementById('admin-featured-id').value = featured ? (featured.featuredId || '') : '';
    document.getElementById('admin-featured-title').value = featured ? (featured.title || '') : '';
    const imgUrl = featured ? (featured.imageUrl || '') : '';
    document.getElementById('admin-featured-image').value = imgUrl;
    const preview = document.getElementById('admin-featured-preview');
    if (imgUrl) {
      preview.style.backgroundImage = "url('" + imgUrl + "')";
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
    document.getElementById('admin-featured-location').value = featured ? (featured.locationName || '') : '';
    document.getElementById('admin-featured-maplink').value = featured ? (featured.mapLink || '') : '';
    document.getElementById('admin-featured-startdate').value = featured ? (featured.startDate || '') : '';
    document.getElementById('admin-featured-enddate').value = featured ? (featured.endDate || '') : '';
    document.getElementById('admin-featured-desc').value = featured ? (featured.shortDesc || '') : '';
  }

  let cropper = null;
  let currentCropContext = null;
  let currentFileName = "";

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
      openCropModal(input.files[0]);
    }
  }

  function openCropModal(source) {
    const cropImg = document.getElementById('crop-image');
    const modal = document.getElementById('crop-modal');
    
    showLoading(true); // 🔄 แสดง Loading ระหว่างเตรียมรูป
    
    const startCropper = () => {
      modal.style.display = 'flex';
      if (cropper) cropper.destroy();
      
      const aspect = (currentCropContext === 'profile') ? 1 : 16/9;
      
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

  function adjustProfileImage() {
    const profileImg = document.getElementById('profile-preview');
    const picUrl = profileImg.getAttribute('data-url');
    if (picUrl && picUrl.startsWith('http')) {
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
  function saveFeaturedActivity() {
    const payload = {
      featuredId: (document.getElementById('admin-featured-id').value || '').trim(),
      title: (document.getElementById('admin-featured-title').value || '').trim(),
      imageUrl: (document.getElementById('admin-featured-image').value || '').trim(),
      locationName: (document.getElementById('admin-featured-location').value || '').trim(),
      mapLink: (document.getElementById('admin-featured-maplink').value || '').trim(),
      startDate: document.getElementById('admin-featured-startdate').value || '',
      endDate: document.getElementById('admin-featured-enddate').value || '',
      shortDesc: (document.getElementById('admin-featured-desc').value || '').trim()
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
    let quarter = Number(document.getElementById('admin-quarter-select').value || 0);
    let year = Number(document.getElementById('admin-year-input').value || 0);

    // ถ้ามีการเลือกวันที่ ให้คำนวณไตรมาสและปีอัตโนมัติเพื่อให้ข้อมูลตรงกับเดือนที่แสดงผลหน้าแรก
    if (activityDateVal) {
      const d = new Date(activityDateVal);
      if (!isNaN(d.getTime())) {
        quarter = Math.floor(d.getMonth() / 3) + 1;
        year = d.getFullYear();
      }
    }

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
                    '<div class="admin-item-sub">Q' + (a.quarter || '-') + '/' + (a.year || '-') + ' | ' + (area ? area.areaName : a.areaCode) + ' | ' + (a.activityDate || '-') + '</div>' +
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

  function editQuarterActivity(activityId) {
    const item = (adminHomeActivities || []).find(function(a) { return String(a.activityId) === String(activityId); });
    if (!item) return;
    document.getElementById('admin-quarter-activity-id').value = item.activityId || '';
    document.getElementById('admin-quarter-select').value = String(item.quarter || '');
    document.getElementById('admin-year-input').value = String(item.year || '');
    document.getElementById('admin-area-code').value = item.areaCode || '';
    document.getElementById('admin-activity-name').value = item.activityName || '';
    document.getElementById('admin-activity-date').value = item.activityDate || '';
    document.getElementById('admin-activity-location').value = item.locationName || '';
    document.getElementById('admin-activity-maplink').value = item.mapLink || '';
    document.getElementById('admin-activity-benefit').value = item.benefit || '';
    document.getElementById('admin-activity-capacity').value = item.capacity || '';
    document.getElementById('admin-contact-name').value = item.contactName || '';
    document.getElementById('admin-contact-phone').value = item.contactPhone || '';
    document.getElementById('admin-activity-status').value = item.status || 'Active';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
    document.getElementById('admin-source-cert-template').value = '';
    document.getElementById('admin-source-preview').style.display = 'none';
    document.getElementById('admin-source-coord').value = '';
    document.getElementById('admin-history').value = '';
    document.getElementById('admin-result').value = '';
    document.getElementById('admin-contact').value = '';
    document.getElementById('admin-gallery').value = '';
    document.getElementById('admin-external').value = '';
    document.getElementById('admin-gps').value = '';
    document.getElementById('admin-edit-mode').value = 'create';
    document.getElementById('admin-original-source-id').value = '';
  }

  function clearAdminQuizForm() {
    document.getElementById('admin-quiz-question').value = '';
    document.getElementById('admin-quiz-choice-a').value = '';
    document.getElementById('admin-quiz-choice-b').value = '';
    document.getElementById('admin-quiz-choice-c').value = '';
    document.getElementById('admin-quiz-choice-d').value = '';
    document.getElementById('admin-quiz-answer').value = 'A';
    document.getElementById('admin-quiz-mode').value = 'create';
    document.getElementById('admin-quiz-id').value = '';
  }

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
    const currentValue = sourceSelect.value || '';
    let options = '<option value="">— เลือกแหล่งเรียนรู้สำหรับจัดการฐาน —</option>';
    (adminSourcesCache || []).forEach(function(item) {
      options += '<option value="' + item.SourceID + '">' + item.SourceID + ' - ' + item.SourceName + ' (' + formatTambon(item.TambonName) + ')</option>';
    });
    sourceSelect.innerHTML = options;
    if (currentValue && (adminSourcesCache || []).some(function(s) { return String(s.SourceID) === String(currentValue); })) {
      sourceSelect.value = currentValue;
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
                    '<div class="admin-base-sub">รหัส: ' + (b.baseId || '-') + ' | ' + (b.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน') + '</div>' +
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
    document.getElementById('admin-base-gallery').value = item.gallery || '';
    document.getElementById('admin-base-external').value = item.external || '';
    document.getElementById('admin-base-gps').value = item.gps || '';
    document.getElementById('admin-base-mode').value = 'edit';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveAdminBase() {
    const sourceId = (document.getElementById('admin-base-source-id').value || '').trim();
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    const mode = document.getElementById('admin-base-mode').value || 'create';
    const data = {
      mode: mode,
      sourceId: sourceId,
      baseId: mode === 'edit' ? (document.getElementById('admin-base-id').value || '').trim() : '',
      baseName: (document.getElementById('admin-base-name').value || '').trim(),
      description: (document.getElementById('admin-base-description').value || '').trim(),
      coverImage: (document.getElementById('admin-base-cover').value || '').trim(),
      displayOrder: (document.getElementById('admin-base-order').value || '').trim(),
      isActive: document.getElementById('admin-base-active').checked,
      history: (document.getElementById('admin-base-history').value || '').trim(),
      result: (document.getElementById('admin-base-result').value || '').trim(),
      contact: (document.getElementById('admin-base-contact').value || '').trim(),
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

  function populateAdminQuizSourceOptions() {
    const sourceSelect = document.getElementById('admin-quiz-source-id');
    if (!sourceSelect) return;
    const currentValue = sourceSelect.value || '';
    let options = '<option value="">— เลือกแหล่งเรียนรู้สำหรับจัดการข้อสอบ —</option>';
    (adminSourcesCache || []).forEach(function(item) {
      options += '<option value="' + item.SourceID + '">' + item.SourceID + ' - ' + item.SourceName + ' (' + formatTambon(item.TambonName) + ')</option>';
    });
    sourceSelect.innerHTML = options;
    if (currentValue && (adminSourcesCache || []).some(function(s) { return String(s.SourceID) === String(currentValue); })) {
      sourceSelect.value = currentValue;
    }
  }

  function loadAdminSources() {
    const container = document.getElementById('admin-source-list-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center text-muted py-4"><i class="fas fa-circle-notch fa-spin"></i> กำลังโหลดข้อมูล...</div>';
    apiGet('getAdminSources', withAuthParams())
      .then(function(res) {
        if (res.status !== "success") {
          container.innerHTML = '<div class="text-center text-muted py-4">โหลดข้อมูลไม่สำเร็จ</div>';
          return;
        }
        adminSourcesCache = res.data || [];
        renderAdminSourceList();
        populateAdminQuizSourceOptions();
        populateAdminBaseSourceOptions();
      }).catch(function() {
        container.innerHTML = '<div class="text-center text-muted py-4">เกิดข้อผิดพลาดในการเชื่อมต่อ</div>';
      });
  }

  function renderAdminSourceList() {
    const container = document.getElementById('admin-source-list-container');
    if (!container) return;
    const keyword = (document.getElementById('admin-source-search').value || '').trim().toLowerCase();
    let list = adminSourcesCache || [];
    if (keyword) {
      list = list.filter(function(item) {
        const txt = [item.SourceID, item.SourceName, item.TambonName].join(' ').toLowerCase();
        return txt.indexOf(keyword) > -1;
      });
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-3">ไม่พบข้อมูลแหล่งเรียนรู้</div>';
      return;
    }

    let html = '';
    list.forEach(function(item) {
      html += '<div class="admin-item">' +
                '<div class="admin-item-head">' +
                  '<div>' +
                    '<div class="admin-item-title">' + (item.SourceName || 'ไม่ระบุชื่อ') + '</div>' +
                    '<div class="admin-item-sub">รหัส: ' + (item.SourceID || '-') + ' | ' + formatTambon(item.TambonName) + '</div>' +
                  '</div>' +
                  '<div class="admin-item-actions">' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;" onclick="editAdminSource(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-pen"></i></button>' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,var(--primary),var(--primary-dk));" onclick="focusAdminQuizManager(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-question"></i></button>' +
                    '<button class="btn-primary" style="padding:6px 10px;font-size:.78rem;background:linear-gradient(135deg,#ef4444,#dc2626);" onclick="deleteAdminSource(\'' + escapeJS(item.SourceID) + '\')"><i class="fas fa-trash"></i></button>' +
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
    document.getElementById('admin-source-tambon').value = item.TambonName || '';
    const imgUrl = item.CoverImageURL || '';
    document.getElementById('admin-source-cover').value = imgUrl;
    document.getElementById('admin-source-cert-template').value = item.CertTemplateID || '';
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
    document.getElementById('admin-gps').value = (item.info && item.info.gps) ? item.info.gps : '';
    document.getElementById('admin-edit-mode').value = 'edit';
    document.getElementById('admin-original-source-id').value = item.SourceID || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (coordinates && coordinates.split(',').length !== 2) {
      return showCustomAlert("รูปแบบพิกัดไม่ถูกต้อง กรุณากรอกแบบ lat, lng", "warning");
    }

    const data = {
      mode: mode,
      originalSourceId: (document.getElementById('admin-original-source-id').value || '').trim(),
      sourceId: sourceId,
      sourceName: sourceName,
      tambonName: tambonName,
      coverImageUrl: (document.getElementById('admin-source-cover').value || '').trim(),
      certTemplateId: (document.getElementById('admin-source-cert-template').value || '').trim(),
      coordinates: coordinates,
      history: (document.getElementById('admin-history').value || '').trim(),
      result: (document.getElementById('admin-result').value || '').trim(),
      contact: (document.getElementById('admin-contact').value || '').trim(),
      gallery: (document.getElementById('admin-gallery').value || '').trim(),
      external: (document.getElementById('admin-external').value || '').trim(),
      gps: (document.getElementById('admin-gps').value || '').trim()
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

  function focusAdminQuizManager(sourceId) {
    const sourceSelect = document.getElementById('admin-quiz-source-id');
    if (!sourceSelect) return;
    sourceSelect.value = sourceId;
    clearAdminQuizForm();
    loadAdminQuizzes();
    const quizQuestion = document.getElementById('admin-quiz-question');
    if (quizQuestion) quizQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function loadAdminQuizzes() {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    const baseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
    const container = document.getElementById('admin-quiz-list-container');
    if (!container) return;
    clearAdminQuizForm();
    adminQuizzesCache = [];

    if (!sourceId) {
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
      return apiGet('getAdminQuizBySource', withAuthParams({ sourceId: sourceId, baseId: finalBaseId }));
    }).then(function(res) {
      if (!res || res.status !== "success") {
        container.innerHTML = '<div class="text-center text-muted py-3">โหลดข้อสอบไม่สำเร็จ</div>';
        return;
      }
      adminQuizzesCache = res.data || [];
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
    document.getElementById('admin-quiz-question').value = item.question || '';
    document.getElementById('admin-quiz-choice-a').value = item.choiceA || '';
    document.getElementById('admin-quiz-choice-b').value = item.choiceB || '';
    document.getElementById('admin-quiz-choice-c').value = item.choiceC || '';
    document.getElementById('admin-quiz-choice-d').value = item.choiceD || '';
    document.getElementById('admin-quiz-answer').value = (item.answer || 'A').toUpperCase();
    document.getElementById('admin-quiz-mode').value = 'edit';
    document.getElementById('admin-quiz-id').value = item.quizId || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveAdminQuiz() {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    const baseId = (document.getElementById('admin-quiz-base-id').value || '').trim();
    const question = (document.getElementById('admin-quiz-question').value || '').trim();
    const choiceA = (document.getElementById('admin-quiz-choice-a').value || '').trim();
    const choiceB = (document.getElementById('admin-quiz-choice-b').value || '').trim();
    const choiceC = (document.getElementById('admin-quiz-choice-c').value || '').trim();
    const choiceD = (document.getElementById('admin-quiz-choice-d').value || '').trim();
    const answer = (document.getElementById('admin-quiz-answer').value || 'A').trim().toUpperCase();
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    if (!question || !choiceA || !choiceB || !choiceC || !choiceD) return showCustomAlert("กรุณากรอกคำถามและตัวเลือกให้ครบทั้ง 4 ข้อ", "warning");
    if (['A', 'B', 'C', 'D'].indexOf(answer) === -1) return showCustomAlert("เฉลยต้องเป็น A, B, C หรือ D", "warning");

    const payload = {
      mode: document.getElementById('admin-quiz-mode').value || 'create',
      quizId: document.getElementById('admin-quiz-id').value || '',
      sourceId: sourceId,
      baseId: baseId,
      question: question,
      choiceA: choiceA,
      choiceB: choiceB,
      choiceC: choiceC,
      choiceD: choiceD,
      answer: answer
    };

    showLoading(true);
    apiPost('saveAdminQuiz', withAuthData(payload))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert("บันทึกข้อสอบเรียบร้อย", "success");
          loadAdminQuizzes();
          cacheSources = null;
        } else {
          showCustomAlert(res.message || "บันทึกข้อสอบไม่สำเร็จ", "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function deleteAdminQuiz(quizId) {
    const sourceId = (document.getElementById('admin-quiz-source-id').value || '').trim();
    if (!quizId || !sourceId) return;
    showCustomConfirm("ต้องการลบข้อสอบนี้ใช่หรือไม่?", function() {
      showLoading(true);
      apiPost('deleteAdminQuiz', withAuthData({ quizId: quizId, sourceId: sourceId }))
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
    if (!adminQuizzesCache || adminQuizzesCache.length === 0) return showCustomAlert("ไม่มีข้อสอบให้จัดลำดับ", "warning");
    const quizIds = adminQuizzesCache.map(function(q) { return q.quizId; }).filter(Boolean);
    showLoading(true);
    apiPost('saveAdminQuizOrder', withAuthData({ sourceId: sourceId, baseId: baseId, quizIds: quizIds }))
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
    if (!sourceId) return showCustomAlert("กรุณาเลือกแหล่งเรียนรู้ก่อน", "warning");
    if (!adminQuizzesCache || adminQuizzesCache.length === 0) return showCustomAlert("ไม่มีข้อสอบให้ส่งออก", "warning");
    const header = ['quizId', 'question', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'answer'];
    let csv = header.join(',') + '\n';
    adminQuizzesCache.forEach(function(q) {
      const row = [
        escapeCsvValue(q.quizId || ''),
        escapeCsvValue(q.question || ''),
        escapeCsvValue(q.choiceA || ''),
        escapeCsvValue(q.choiceB || ''),
        escapeCsvValue(q.choiceC || ''),
        escapeCsvValue(q.choiceD || ''),
        escapeCsvValue((q.answer || '').toUpperCase())
      ];
      csv += row.join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
            choiceA: choiceA,
            choiceB: choiceB,
            choiceC: choiceC,
            choiceD: choiceD,
            answer: ['A', 'B', 'C', 'D'].indexOf(answer) > -1 ? answer : 'A'
          });
        }
        if (rows.length === 0) return showCustomAlert("ไม่พบข้อมูลข้อสอบที่ถูกต้องในไฟล์ CSV", "warning");
        showCustomConfirm("พบ " + rows.length + " ข้อ ต้องการแทนที่ข้อสอบเดิมทั้งหมดของแหล่งนี้หรือไม่? (กดตกลง = แทนที่ทั้งหมด, กดยกเลิก = ยกเลิกนำเข้า)", function() {
          showLoading(true);
          apiPost('importAdminQuizCsv', withAuthData({ sourceId: sourceId, baseId: baseId, rows: rows, replaceExisting: true }))
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

  function loadDistrictMap() {
    if (cacheMapSources) {
      renderDistrictMap();
      return;
    }
    
    // ถ้ามี cacheSources อยู่แล้ว (โหลดจากหน้าแรกมาแล้ว) ก็ใช้ได้เลย
    if (cacheSources) {
      cacheMapSources = cacheSources;
      renderDistrictMap();
      return;
    }

    // โหลดเฉพาะข้อมูลที่จำเป็นสำหรับแผนที่ (เร็วขึ้นมาก)
    showLoading(true);
    apiGet('getMapSources', withAuthParams())
      .then(function(sources) {
        showLoading(false);
        cacheMapSources = sources;
        renderDistrictMap();
      }).catch(function() { showLoading(false); });
  }

  function openMapPicker() {
    document.getElementById('map-picker-modal').style.display = 'flex';
    
    // ดึงค่าปัจจุบันจาก input (ถ้ามี)
    const currentCoord = document.getElementById('admin-source-coord').value.trim();
    let initialLat = 19.3653;
    let initialLng = 99.2016;
    
    if (currentCoord && currentCoord.indexOf(',') > -1) {
      const parts = currentCoord.split(',');
      const pLat = parseFloat(parts[0]);
      const pLng = parseFloat(parts[1]);
      if (!isNaN(pLat) && !isNaN(pLng)) {
        initialLat = pLat;
        initialLng = pLng;
      }
    }

    setTimeout(function() {
      if (!mapPicker) {
        mapPicker = L.map('map-picker-container').setView([initialLat, initialLng], 15);
        const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google Maps' });
        const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google Maps' });
        googleStreets.addTo(mapPicker);
        L.control.layers({ "แผนที่ถนน": googleStreets, "ดาวเทียม": googleSatellite }).addTo(mapPicker);
        
        const redIcon = new L.Icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        mapPickerMarker = L.marker([initialLat, initialLng], { icon: redIcon, draggable: true }).addTo(mapPicker);
        
        mapPicker.on('click', function(e) {
          mapPickerMarker.setLatLng(e.latlng);
        });
      } else {
        mapPicker.setView([initialLat, initialLng], 15);
        mapPickerMarker.setLatLng([initialLat, initialLng]);
        mapPicker.invalidateSize();
      }
    }, 200);
  }

  function confirmMapPicker() {
    if (mapPickerMarker) {
      const pos = mapPickerMarker.getLatLng();
      document.getElementById('admin-source-coord').value = pos.lat.toFixed(15) + ', ' + pos.lng.toFixed(15);
    }
    closeMapPicker();
  }

  function closeMapPicker() {
    document.getElementById('map-picker-modal').style.display = 'none';
  }

  // ฟังก์ชันช่วยในการลบคำนำหน้าชื่อพื้นที่เพื่อการเปรียบเทียบที่ยืดหยุ่น
  function normalizeTambon(v) {
    if (v == null) return '';
    let str = String(v).trim();
    return str.replace(/^((ต\.|ตำบล|ศศช\.|บ้าน|บ\.)\s*)+/g, '').trim();
  }

  function formatTambon(v) {
     const name = normalizeTambon(v);
     if (!name) return '';
     
     // รายชื่อ ศศช. ทั้ง 10 แห่ง
     const sashaMap = {
       "อาบอลาชา": "ศศช.บ้านอาบอลาชา",
       "อาบอเน": "ศศช.บ้านอาบอเน",
       "อาแย": "ศศช.บ้านอาแย",
       "ป่าหญ้าไทร": "ศศช.บ้านป่าหญ้าไทร",
       "ขอนม่วง": "ศศช.บ้านขอนม่วง",
       "แม่งัดน้อย": "ศศช.บ้านแม่งัดน้อย",
       "ห้วยทรายขาว": "ศศช.บ้านห้วยทรายขาว",
       "ห้วยกันใจ": "ศศช.บ้านห้วยกันใจ",
       "ปางตอย": "ศศช.บ้านปางตอย",
       "ปางฟาน": "ศศช.บ้านปางฟาน"
     };
     
     if (sashaMap[name]) return sashaMap[name];
     
     const cleaned = String(name).replace(/^((ต\.|ตำบล)\s*)+/g, '').trim();
     return "ต." + cleaned;
   }

  function getValidImageUrl(url) {
    if (!url) return 'https://via.placeholder.com/150?text=No+Image';
    let str = String(url).trim();
    if (str.indexOf('drive.google.com/file/d/') > -1) {
      const parts = str.split('/d/');
      if (parts.length > 1) {
        const id = parts[1].split('/')[0];
        return 'https://lh3.googleusercontent.com/d/' + id;
      }
    }
    if (str.indexOf('drive.google.com/open?id=') > -1) {
      const id = str.split('id=')[1].split('&')[0];
      return 'https://lh3.googleusercontent.com/d/' + id;
    }
    return str;
  }

  function renderDistrictMap() {
    if (!districtMap) {
      districtMap = L.map('overall-map').setView([19.3653, 99.2016], 11);
      const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google Maps' });
      const googleSatellite = L.tileLayer('https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', { maxZoom: 20, attribution: '© Google Maps' });
      googleStreets.addTo(districtMap);
      L.control.layers({ "แผนที่ถนน (Google)": googleStreets, "ดาวเทียม (Google)": googleSatellite }).addTo(districtMap);
    }

    // ล้างหมุดเดิม
    mapMarkers.forEach(m => districtMap.removeLayer(m));
    mapMarkers = [];

    const filterTambon = document.getElementById('map-tambon-filter').value;
    const listContainer = document.getElementById('map-list-container');
    let listHtml = '';

    if (cacheMapSources) {
       const bounds = []; 
       const redIcon = new L.Icon({
         iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
         shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
         iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
         className: 'marker-animate'
       });

       cacheMapSources.forEach(function(source) {
         // กรองตามตำบล
         if (filterTambon && normalizeTambon(source.TambonName) !== normalizeTambon(filterTambon)) return;

         // เพิ่มหมุดลงแผนที่
         if (source.Latitude && source.Longitude) {
           const lat = parseFloat(source.Latitude); const lng = parseFloat(source.Longitude);
           if(!isNaN(lat) && !isNaN(lng)) {
             bounds.push([lat, lng]);
             const marker = L.marker([lat, lng], {icon: redIcon}).addTo(districtMap);
             const popupHtml = '<div style="text-align:center; font-family: \'Prompt\', sans-serif;">' +
                                 '<b style="color:var(--primary); font-size:1.05rem;">' + source.SourceName + '</b><br>' +
                                 '<span style="color:#7f8c8d; font-size:0.85rem;">📍 ' + formatTambon(source.TambonName) + '</span><br>' +
                                 '<button onclick="openSourceDetail(\'' + escapeJS(source.SourceID) + '\')" style="margin-top:10px; padding:8px 10px; background:var(--primary-dk); color:white; border:none; border-radius:6px; cursor:pointer; width:100%; font-family: \'Prompt\', sans-serif;">เข้าสู่บทเรียน</button>' +
                               '</div>';
             marker.bindPopup(popupHtml);
             mapMarkers.push(marker);
           }
         }

         // สร้างรายการด้านล่าง (สไตล์หน้าอันดับ)
         let rawUrl = source.CoverImageURL;
         if (!rawUrl || rawUrl === 'undefined') rawUrl = source.CoverImage;
         if (!rawUrl || rawUrl === 'undefined') rawUrl = '';
         const imgUrl = getValidImageUrl(rawUrl);
         
         listHtml += '<div class="rank-card" onclick="focusOnSource(\'' + escapeJS(source.SourceID) + '\')" style="margin-bottom:10px; cursor:pointer; border-left:4px solid var(--primary);">' +
                        '<img src="' + imgUrl + '" loading="lazy" class="rank-img" style="border-radius:8px; width:50px; height:50px; object-fit:cover;">' +
                        '<div class="rank-info" style="margin-left:12px;">' +
                          '<div class="rank-name" style="font-size:0.9rem; font-weight:700; color:var(--text);">' + (source.SourceName || "ไม่มีชื่อ") + '</div>' +
                          '<div class="text-xs" style="color:var(--text-soft);">📍 ' + formatTambon(source.TambonName) + '</div>' +
                        '</div>' +
                        '<i class="fas fa-chevron-right text-muted" style="font-size:0.8rem;"></i>' +
                      '</div>';
       });

       if (listHtml === '') {
         listHtml = '<div class="text-center text-muted py-10">ไม่พบแหล่งเรียนรู้ในตำบลนี้</div>';
       }
       listContainer.innerHTML = listHtml;

       if(bounds.length > 0) {
         districtMap.fitBounds(bounds, { padding: [20, 20] }); 
       } else {
         districtMap.setView([19.3653, 99.2016], 11);
       }
    }
    setTimeout(function() { districtMap.invalidateSize(); }, 300);
  }

  function focusOnSource(sourceId) {
    if (!cacheMapSources) return;
    const source = cacheMapSources.find(s => s.SourceID === sourceId);
    if (source && source.Latitude && source.Longitude && districtMap) {
      const lat = parseFloat(source.Latitude);
      const lng = parseFloat(source.Longitude);
      districtMap.setView([lat, lng], 17);
      
      // หาหมุดที่ตรงกับตำแหน่งนี้และเปิด popup
      mapMarkers.forEach(m => {
        const pos = m.getLatLng();
        if (pos.lat === lat && pos.lng === lng) {
          m.openPopup();
        }
      });
    }
  }

  function loadSources() {
    if (cacheSources !== null) return;
    
    // โหลดข้อมูลแผนที่ก่อนเพื่อให้หน้าแผนที่พร้อมใช้งานเร็วขึ้น
    if (!cacheMapSources || (cacheMapSources.length > 0 && cacheMapSources[0].CoverImage === undefined)) {
      apiGet('getMapSources', withAuthParams())
        .then(function(sources) { 
          cacheMapSources = sources;
          if (document.getElementById('map-page').style.display !== 'none') {
            renderDistrictMap();
          }
        })
        .catch(function() {});
    }

    apiGet('getSources', withAuthParams())
      .then(function(sources) { 
        cacheSources = sources; 
        // ถ้าโหลดข้อมูลเต็มมาแล้ว ก็ให้ใช้เป็นข้อมูลแผนที่ได้ด้วย
        if (!cacheMapSources) cacheMapSources = sources;
      })
      .catch(function() {});
  }

  function openMap(lat, lng, gps) {
    const latStr = String(lat == null ? '' : lat).trim();
    const lngStr = String(lng == null ? '' : lng).trim();
    const gpsStr = String(gps == null ? '' : gps).trim();

    if (gpsStr && gpsStr.toLowerCase().indexOf('http') === 0) {
      return window.open(gpsStr, '_blank');
    }

    let finalLat = latStr;
    let finalLng = lngStr;
    if ((!finalLat || !finalLng || finalLat === "undefined" || finalLng === "undefined") && gpsStr.indexOf(',') > -1) {
      const parts = gpsStr.split(',');
      if (parts.length >= 2) {
        finalLat = String(parts[0]).trim();
        finalLng = String(parts[1]).trim();
      }
    }

    if (!finalLat || !finalLng || finalLat === "undefined" || finalLng === "undefined") {
      return showCustomAlert("แหล่งเรียนรู่นี้ยังไม่ได้ระบุพิกัดในระบบครับ", "warning");
    }
    window.open('https://www.google.com/maps/search/?api=1&query=' + finalLat + ',' + finalLng, '_blank');
  }

  function getLearningProgress(sourceId) {
    const key = 'learning_progress_' + sourceId;
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch(e) { return []; }
  }

  function saveLearningProgress(sourceId, baseId) {
    const key = 'learning_progress_' + sourceId;
    let progress = getLearningProgress(sourceId);
    if (!progress.includes(String(baseId))) {
      progress.push(String(baseId));
      localStorage.setItem(key, JSON.stringify(progress));
    }
  }

  function isBaseCompleted(sourceId, baseId) {
    return getLearningProgress(sourceId).includes(String(baseId));
  }

  function openSourceDetail(sourceId) {
    activeSourceId = sourceId; 
    learningViewMode = 'list';
    activeBaseId = '';

    const sourceData = cacheSources ? cacheSources.find(function(s) { return String(s.SourceID).trim() === String(sourceId).trim(); }) : null;
    
    if (sourceData && (sourceData.bases || sourceData.quizzes)) {
      activeSourceDetailData = sourceData;
      renderDetailAfterLoad();
    } else {
      showLoading(true);
      apiGet('getSources', withAuthParams())
        .then(function(sources) {
          showLoading(false);
          cacheSources = sources;
          const fullData = sources.find(function(s) { return String(s.SourceID).trim() === String(sourceId).trim(); });
          if (!fullData) return showCustomAlert("ไม่พบข้อมูลแหล่งเรียนรู่นี้", "error");
          activeSourceDetailData = fullData;
          renderDetailAfterLoad();
        }).catch(function() { showLoading(false); });
    }
  }

  function renderDetailAfterLoad() {
    const sourceData = activeSourceDetailData;
    let rawUrl = sourceData.CoverImageURL || sourceData.CoverImage || '';
    if (rawUrl === 'undefined') rawUrl = '';
    const validUrl = getValidImageUrl(rawUrl) !== 'https://via.placeholder.com/150?text=No+Image' ? getValidImageUrl(rawUrl) : 'https://via.placeholder.com/500x300';
    document.getElementById('detail-cover').style.backgroundImage = 'url(\'' + validUrl + '\')';
    document.getElementById('detail-tambon').innerText = formatTambon(sourceData.TambonName);
    document.getElementById('detail-title').innerText = sourceData.SourceName;

    showPage('detail-page');
    renderDetailSource();
  }

  function selectDetailBase(baseId) {
    if (!activeSourceDetailData || !activeSourceDetailData.bases) return;
    activeBaseId = String(baseId || '').trim();
    const b = (activeSourceDetailData.bases || []).find(function(x) { return String(x.baseId) === String(activeBaseId); });
    currentQuizData = (b && b.quizzes) ? b.quizzes : [];
    renderDetailSource();
  }

  function buildDetailInfoHtml(info, showGps = true) {
    let html = '';
    const formatText = function(text) { return text ? String(text).split('\n').join('<br>') : ''; };
    if (!info) {
      html += '<div class="text-center mt-4 mb-4" style="color: var(--text-soft);"><i class="fas fa-exclamation-circle"></i> แอดมินกำลังอัปเดตเนื้อหาเพิ่มเติมครับ</div>';
      return html;
    }
    if(info.history) html += '<div class="content-section"><h4><i class="fas fa-bullseye"></i> จุดประสงค์การเรียนรู้</h4><p>' + formatText(info.history) + '</p></div>';
    if(info.result) html += '<div class="content-section"><h4><i class="fas fa-file-alt"></i> เนื้อหา</h4><p>' + formatText(info.result) + '</p></div>';
    if(info.gallery || info.external) {
      html += '<div class="content-section"><h4><i class="fas fa-photo-video"></i> สื่อการเรียนรู้</h4><div style="display:flex; gap:10px; flex-wrap:wrap;">';
      if(info.gallery) html += '<a href="' + info.gallery + '" target="_blank" class="btn-primary" style="flex:1; text-align:center;"><i class="fas fa-images"></i> แกลอรีรูปภาพ</a>';
      if(info.external) html += '<a href="' + info.external + '" target="_blank" class="btn-primary" style="flex:1; text-align:center; background-color:#ef4444;"><i class="fab fa-youtube"></i> สื่อภายนอก</a>';
      html += '</div></div>';
    }
    if((info.gps && showGps) || info.contact) {
      html += '<div class="content-section"><h4><i class="fas fa-map-marker-alt"></i> ติดต่อสถานที่</h4>';
      if(info.contact) html += '<p>' + formatText(info.contact) + '</p>';
      if(info.gps && showGps) {
        let mapLink = String(info.gps).startsWith('http') ? info.gps : 'https://www.google.com/maps/search/?api=1&query=' + info.gps;
        html += '<p class="mt-3"><a href="' + mapLink + '" target="_blank" style="color:var(--primary);"><i class="fas fa-location-arrow"></i> เปิดพิกัดนำทางแผนที่</a></p>';
      }
      html += '</div>';
    }
    return html;
  }

  function renderDetailSource() {
    const container = document.getElementById('detail-content-container');
    if (!activeSourceDetailData) return;

    const sourceId = String(activeSourceDetailData.SourceID || '').trim();
    const bases = activeSourceDetailData.bases || [];
    let html = '';

    if (learningViewMode === 'list') {
      // หน้าแสดงรายการฐาน
      html += '<div class="learning-intro-section">';
      html += '<h3 class="mb-3" style="color: var(--text-inv); font-weight: 600;"><i class="fas fa-list-ol"></i> ลำดับฐานการเรียนรู้</h3>';
      html += '<p class="text-muted mb-4" style="font-size: 0.9rem;">กรุณาเรียนรู้ให้ครบทุกฐานเพื่อปลดล็อกแบบทดสอบสุดท้าย</p>';
      
      const progress = getLearningProgress(sourceId);
      let nextBaseToLearnFound = false;

      if (bases.length > 0) {
        html += '<div class="base-step-list">';
        bases.forEach(function(b, index) {
          const isDone = progress.includes(String(b.baseId));
          const isLocked = !isDone && nextBaseToLearnFound;
          const isNext = !isDone && !nextBaseToLearnFound;
          
          if (isNext) nextBaseToLearnFound = true;

          html += '<div class="base-step-card ' + (isDone ? 'completed' : (isLocked ? 'locked' : 'active')) + '">';
          html +=   '<div class="step-num">' + (index + 1) + '</div>';
          html +=   '<div class="step-info">';
          html +=     '<h4>' + (b.baseName || 'ฐานการเรียนรู้') + '</h4>';
          html +=     '<p>' + (b.description || '') + '</p>';
          html +=   '</div>';
          html +=   '<div class="step-action">';
          if (isDone) {
            html += '<button class="btn-step-done" onclick="startLearningBase(\'' + escapeJS(b.baseId) + '\')"><i class="fas fa-check-circle"></i> เรียนแล้ว (ดูซ้ำ)</button>';
          } else if (isLocked) {
            html += '<button class="btn-step-locked" disabled><i class="fas fa-lock"></i> ยังไม่เปิด</button>';
          } else {
            html += '<button class="btn-step-start" onclick="startLearningBase(\'' + escapeJS(b.baseId) + '\')">เริ่มบทเรียน <i class="fas fa-play-circle"></i></button>';
          }
          html +=   '</div>';
          html += '</div>';
        });
        html += '</div>';

        // ปุ่มแบบทดสอบสุดท้าย
        const allDone = bases.every(function(b) { return progress.includes(String(b.baseId)); });
        if (allDone) {
          html += '<div class="final-quiz-section mt-5" style="text-align: center; background: var(--bg2); padding: 30px; border-radius: 15px; border: 2px dashed var(--primary);">';
            html +=   '<div class="mb-3" style="font-size: 1.1rem; color: var(--primary); font-weight: bold;"><i class="fas fa-trophy"></i> ยอดเยี่ยม! คุณเรียนครบทุกฐานแล้ว</div>';
          html +=   '<button class="btn-quiz-final" onclick="startFinalQuiz()" style="width: 100%; max-width: 300px; padding: 15px; font-size: 1.1rem; border-radius: 50px; background: var(--primary); color: white; border: none; cursor: pointer; box-shadow: 0 4px 15px var(--primary-glow);"><i class="fas fa-file-signature"></i> ทำแบบทดสอบวัดความรู้รวม</button>';
          html += '</div>';
        }
      } else {
        // ไม่มีฐาน (โหมดปกติ)
        html += buildDetailInfoHtml(activeSourceDetailData.info);
        html += '<div class="btn-quiz" onclick="startFinalQuiz()"><i class="fas fa-pencil-alt"></i> ทำแบบทดสอบเพื่อเก็บคะแนน</div>';
      }
      html += '</div>';
    } else {
      // หน้าแสดงเนื้อหาฐาน
      const activeBase = (activeSourceDetailData.bases || []).find(function(b) { return String(b.baseId) === String(activeBaseId); });
      if (!activeBase) {
        learningViewMode = 'list';
        return renderDetailSource();
      }

      html += '<div class="learning-content-view">';
      html +=   '<button class="btn-back-to-list" onclick="learningViewMode=\'list\'; renderDetailSource();" style="background: none; border: 1px solid #ccc; padding: 5px 15px; border-radius: 20px; color: #666; cursor: pointer;"><i class="fas fa-arrow-left"></i> กลับไปรายการฐาน</button>';
      html +=   '<div class="content-header mt-3 mb-4">';
      html +=     '<h2 style="color: var(--text-inv);">' + (activeBase.baseName || 'ฐานการเรียนรู้') + '</h2>';
      html +=   '</div>';
      
      if (activeBase.description) {
        html += '<div class="content-section"><h4><i class="fas fa-info-circle"></i> รายละเอียด</h4><p>' + String(activeBase.description).split('\n').join('<br>') + '</p></div>';
      }
      html += buildDetailInfoHtml(activeBase.info, false);

      html += '<div class="content-footer mt-5" style="text-align: center;">';
      html +=   '<button class="btn-finish-base" onclick="finishLearningBase(\'' + escapeJS(activeBase.baseId) + '\')" style="background: var(--primary); color: white; border: none; padding: 15px 40px; border-radius: 50px; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 10px var(--primary-glow);">จบการเรียนรู้ฐานนี้ <i class="fas fa-chevron-right"></i></button>';
      html += '</div>';
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function startLearningBase(baseId) {
    activeBaseId = String(baseId);
    learningViewMode = 'content';
    renderDetailSource();
    window.scrollTo(0, 0);
  }

  function finishLearningBase(baseId) {
    saveLearningProgress(activeSourceId, baseId);
    learningViewMode = 'list';
    renderDetailSource();
    showCustomAlert("บันทึกความคืบหน้าแล้ว", "success");
    window.scrollTo(0, 0);
  }

  function startFinalQuiz() {
    if (!activeSourceDetailData) return;
    const sourceId = activeSourceId;
    
    // รวมข้อสอบจากทุกฐาน หรือใช้ข้อสอบของ Source
    let allQuizzes = [];
    if (activeSourceDetailData.bases && activeSourceDetailData.bases.length > 0) {
      activeSourceDetailData.bases.forEach(function(b) {
        if (b.quizzes && b.quizzes.length > 0) {
          allQuizzes = allQuizzes.concat(b.quizzes);
        }
      });
    }
    
    // ถ้าไม่มีข้อสอบในฐาน ให้ใช้ข้อสอบของ Source โดยตรง (ถ้ามี)
    if (allQuizzes.length === 0 && activeSourceDetailData.quizzes) {
      allQuizzes = activeSourceDetailData.quizzes;
    }

    if (allQuizzes.length === 0) return showCustomAlert("แอดมินยังไม่ได้เพิ่มแบบทดสอบครับ", "warning");

    currentQuizData = allQuizzes;
    activeBaseId = ''; // แบบทดสอบรวมไม่มี baseId เฉพาะ
    
    currentQuestionIndex = 0; userScore = 0;
    document.getElementById('total-q-num').innerText = currentQuizData.length;
    showPage('quiz-page');
    loadQuestion();
  }

  function startQuiz(sourceId, baseId) {
    activeSourceId = String(sourceId || activeSourceId || '').trim();
    activeBaseId = String(baseId || '').trim();
    if(currentQuizData.length === 0) return showCustomAlert("แอดมินยังไม่ได้เพิ่มแบบทดสอบสำหรับศูนย์นี้ครับ", "warning");
    currentQuestionIndex = 0; userScore = 0;
    document.getElementById('total-q-num').innerText = currentQuizData.length;
    showPage('quiz-page');
    loadQuestion();
  }

  function loadQuestion() {
    selectedAnswer = "";
    document.getElementById('btn-next-question').disabled = true;
    document.getElementById('btn-next-question').style.opacity = "0.5";
    document.getElementById('quiz-progress-bar').style.width = ((currentQuestionIndex) / currentQuizData.length) * 100 + '%';
    document.getElementById('current-q-num').innerText = currentQuestionIndex + 1;
    document.querySelectorAll('.choice-btn').forEach(function(btn) { btn.classList.remove('selected'); });
    
    const q = currentQuizData[currentQuestionIndex];
    document.getElementById('quiz-question').innerText = q.question;
    ['A', 'B', 'C', 'D'].forEach(function(choice, index) { document.getElementById('choice-' + choice).innerText = q.choices[index]; });
    document.getElementById('btn-next-question').innerText = (currentQuestionIndex === currentQuizData.length - 1) ? "ส่งคำตอบ" : "ถัดไป";
  }

  function selectChoice(choiceLetter, btnElement) {
    selectedAnswer = choiceLetter;
    document.querySelectorAll('.choice-btn').forEach(function(btn) { btn.classList.remove('selected'); });
    btnElement.classList.add('selected');
    document.getElementById('btn-next-question').disabled = false;
    document.getElementById('btn-next-question').style.opacity = "1";
  }

  function nextQuestion() {
    if (selectedAnswer === currentQuizData[currentQuestionIndex].answer) userScore++;
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizData.length) loadQuestion();
    else finishQuiz(); 
  }

  function finishQuiz() {
    cacheProfile = null; cacheHistory = null; cacheLeaderboard = null; 
    document.getElementById('quiz-progress-bar').style.width = '100%';
    const totalQ = currentQuizData.length;
    const isPass = (userScore / totalQ) >= 0.8 ? "Pass" : "Fail";
    
    const earnedPoints = userScore * 10;

    document.getElementById('result-score').parentNode.innerHTML = '<span id="result-score">' + userScore + '</span>/' + totalQ;

    const resultTitle = document.getElementById('result-title');
    const resultIcon = document.getElementById('result-icon');
    const btnRetry = document.getElementById('btn-retry');

    if (isPass === "Pass") {
      resultTitle.innerText = "ยอดเยี่ยม! คุณสอบผ่านเกณฑ์"; resultTitle.style.color = "var(--primary)"; 
      resultIcon.innerText = "🏆"; 
      document.getElementById('result-message').innerText = "คุณได้รับ " + earnedPoints + " แต้มสะสม";
      btnRetry.style.display = "none"; 
      
      // แสดงหน้าประเมินหลังจากผ่าน (ดีเลย์นิดหน่อยเพื่อให้ดูผลสอบก่อน)
      setTimeout(function() {
        openEvaluation();
      }, 2000);
    } else {
      resultTitle.innerText = "พยายามอีกนิดนะ!"; resultTitle.style.color = "#ef4444"; 
      resultIcon.innerText = "💪"; 
      document.getElementById('result-message').innerText = "คะแนนยังไม่ถึง 80% ลองใหม่นะ";
      btnRetry.style.display = "block"; 
    }
    showPage('result-page');

    const phone = localStorage.getItem("userPhone") || "0899999999";
    apiPost('submitQuiz', { phone: phone, sourceId: activeSourceId, baseId: activeBaseId, score: userScore + "/" + totalQ, status: isPass });
  }

  function loadLeaderboard() {
    if (cacheLeaderboard !== null) return renderLeaderboard(cacheLeaderboard);
    document.getElementById('leaderboard-container').innerHTML = '<div class="text-center mt-5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    apiGet('getLeaderboard')
      .then(function(data) { cacheLeaderboard = data; renderLeaderboard(data); })
      .catch(function() { document.getElementById('leaderboard-container').innerHTML = '<div class="text-center mt-5">โหลดไม่สำเร็จ</div>'; });
  }

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

    // --- ส่วนที่ 1: แท่นรางวัล Podium V2 (อันดับ 1-3) ---
    html += '<div class="podium-container">';
    
    podiumData.forEach(function(user, index) {
      let rankNum = index + 1;
      let rStyle = getRankStyle(user.level); // ดึงสีมาแต่งขอบรูปและป้ายคะแนน
      let defaultImg = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random&color=fff';
      let imgUrl = (user.image && String(user.image).trim() !== "") ? user.image : defaultImg;
      let lvlClass = getLvlClass(user.level);
      let glowColor = rStyle.color === '#10b981' ? 'rgba(16, 185, 129, 0.4)' : 
                      rStyle.color === '#fbbf24' ? 'rgba(251, 191, 36, 0.4)' : 
                      rStyle.color === '#cbd5e1' ? 'rgba(203, 213, 225, 0.4)' : 
                      'rgba(16, 185, 129, 0.3)';
      
      let scoreBadgeStyle = (rankNum === 1) ? '' : 'style="background:' + rStyle.color + ';"';
      let ringSizeClass = (rankNum === 1) ? 'avatar-ring-lg' : 'avatar-ring-md';
      
      html += '<div class="podium-item rank-' + rankNum + '">' +
                '<div class="podium-avatar-wrapper">' +
                  '<i class="fas fa-crown crown-icon"></i>' + 
                  '<div class="avatar-ring-wrapper ' + ringSizeClass + '" style="--avatar-border-color: ' + rStyle.color + '; --avatar-shadow-color: ' + glowColor + '; margin-bottom: 0;">' +
                    '<div class="profile-avatar-ring ' + lvlClass + '"></div>' +
                    '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="podium-img" style="border-color:' + rStyle.color + ';">' +
                  '</div>' +
                '</div>' +
                '<div class="podium-base">' + rankNum + '</div>' + 
                '<div class="podium-info">' +
                  '<div class="podium-name">' + user.name + '</div>' +
                  '<div class="podium-score-badge" ' + scoreBadgeStyle + '>' + user.score + ' แต้ม</div>' +
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
      let imgUrl = (user.image && String(user.image).trim() !== "") ? user.image : defaultImg;
      let lvlClass = getLvlClass(user.level);
      let glowColor = rStyle.color === '#10b981' ? 'rgba(16, 185, 129, 0.4)' : 
                      rStyle.color === '#fbbf24' ? 'rgba(251, 191, 36, 0.4)' : 
                      rStyle.color === '#cbd5e1' ? 'rgba(203, 213, 225, 0.4)' : 
                      'rgba(16, 185, 129, 0.3)';

      html += '<div class="rank-card" style="margin-bottom: 8px; padding: 10px 15px; border-left: 4px solid ' + rStyle.color + ';">' +
                 '<div class="rank-number" style="font-size: 1.1rem; width: 30px; color: #7f8c8d;">' + rankNum + '</div>' +
                 '<div class="avatar-ring-wrapper avatar-ring-sm" style="--avatar-border-color: ' + rStyle.color + '; --avatar-shadow-color: ' + glowColor + '; margin: 0 10px;">' +
                   '<div class="profile-avatar-ring ' + lvlClass + '"></div>' +
                   '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="rank-img-sm">' +
                 '</div>' +
                 '<div class="rank-info">' +
                   '<div class="rank-name" style="font-size: 0.95rem;">' + user.name + '</div>' +
                   '<div class="rank-score" style="font-size: 0.8rem;">' + user.score + ' แต้ม</div>' +
                 '</div>' +
                 '<div style="background:' + rStyle.color + '; color:white; font-size:0.6rem; padding:2px 6px; border-radius:10px; font-weight:bold;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title + '</div>' +
               '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function loadProfileData() {
    if (cacheProfile !== null) {
      renderProfileUI(cacheProfile); 
      if (cacheHistory === null) {
        renderHistoryInitial();
      } else {
        renderHistoryUI(cacheHistory);
      }
      loadUserBadges();
      return;
    }
    
    const myPhone = localStorage.getItem("userPhone") || "";
    document.getElementById('profile-phone').innerText = myPhone;
    showLoading(true);

    apiGet('getUserProfile', { phone: myPhone })
      .then(function(res) {
        showLoading(false);
        if (res.status === "success" && res.profile) {
          cacheProfile = res.profile;
          renderProfileUI(res.profile);
          renderHistoryInitial();
          loadUserBadges();
        } else {
          showCustomAlert("ไม่พบข้อมูลของคุณในระบบ", "error");
        }
      }).catch(function() { showLoading(false); showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
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

  function loadUserCertificates() {
    const myPhone = localStorage.getItem("userPhone") || "";
    const container = document.getElementById('cert-list-container');
    container.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-circle-notch fa-spin mr-2"></i> กำลังโหลดประวัติ...</div>';
    
    apiGet('getUserCertificates', { phone: myPhone })
      .then(function(res) {
        if (res.status === "success") {
          cacheHistory = res.history;
          renderHistoryUI(res.history);
        } else {
          showCustomAlert("ไม่สามารถโหลดประวัติได้", "error");
          renderHistoryInitial();
        }
      }).catch(function() {
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
        renderHistoryInitial();
      });
  }

  function updateAvatarRing(levelStr) {
    const ringEl = document.getElementById('profile-avatar-ring');
    const sparklesEl = document.getElementById('profile-avatar-sparkles');
    if (!ringEl) return;

    // Reset classes
    ringEl.className = 'profile-avatar-ring';
    if (sparklesEl) sparklesEl.innerHTML = '';

    let lvl = String(levelStr).toUpperCase();
    let lvlClass = 'lvl-0';
    let particleCount = 0;
    let particleColor = '';

    if (lvl.indexOf("GLORIOUS") > -1 || lvl.indexOf("CONQUEROR") > -1) {
      lvlClass = 'lvl-6';
      particleCount = 14;
      particleColor = '#fbbf24';
    } else if (lvl.indexOf("ต้นแบบ") > -1 || lvl.indexOf("MASTER") > -1) {
      lvlClass = 'lvl-5';
      particleCount = 9;
      particleColor = '#34d399';
    } else if (lvl.indexOf("เชี่ยวชาญ") > -1 || lvl.indexOf("DIAMOND") > -1) {
      lvlClass = 'lvl-4';
      particleCount = 6;
      particleColor = '#00f2fe';
    } else if (lvl.indexOf("ก้าวหน้า") > -1 || lvl.indexOf("PLATINUM") > -1) {
      lvlClass = 'lvl-3';
    } else if (lvl.indexOf("กลาง") > -1 || lvl.indexOf("GOLD") > -1) {
      lvlClass = 'lvl-2';
    } else if (lvl.indexOf("ต้น") > -1 || lvl.indexOf("SILVER") > -1) {
      lvlClass = 'lvl-1';
    }

    ringEl.classList.add(lvlClass);

    // Generate particles if needed
    if (particleCount > 0 && sparklesEl) {
      for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'avatar-particle';
        const delay = Math.random() * 2;
        const duration = 1.8 + Math.random() * 1.5;
        const size = 3 + Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        const radius = 62 + Math.random() * 14; // float outside the avatar
        
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        p.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          background: ${particleColor};
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 8px ${particleColor};
          opacity: 0;
          pointer-events: none;
          animation: floatParticle ${duration}s ease-in-out infinite;
          animation-delay: ${delay}s;
          --tx: ${x}px;
          --ty: ${y}px;
        `;
        
        // If glorious conqueror, occasionally make them gold stars
        if (lvlClass === 'lvl-6' && Math.random() > 0.6) {
          p.innerHTML = '<i class="fas fa-star" style="font-size: 7px; color: #fbbf24; text-shadow: 0 0 5px #fbbf24;"></i>';
          p.style.background = 'transparent';
          p.style.boxShadow = 'none';
        }

        sparklesEl.appendChild(p);
      }
    }
  }

  function renderProfileUI(me) {
      let rStyle = getRankStyle(me.level);
      
      // Set avatar ring and styles dynamically based on the level rank color
      const wrapperEl = document.querySelector('.avatar-ring-wrapper');
      if (wrapperEl) {
        wrapperEl.style.setProperty('--avatar-border-color', rStyle.color);
        wrapperEl.style.setProperty('--avatar-shadow-color', rStyle.color + '40');
      }
      updateAvatarRing(me.level);
      
      // สร้างป้ายสวยๆ ไว้เติมต่อท้ายชื่อ
      let badgeHtml = '<span style="background:' + rStyle.color + '; color:white; font-size:0.6rem; padding:3px 8px; border-radius:12px; vertical-align:middle; margin-left:8px; display:inline-block;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title + '</span>';
      
      // เซ็ตข้อมูลและใช้ data-rawname เก็บชื่อจริงเพื่อไม่ให้ป้ายติดไปโชว์ในเกียรติบัตร
      const nameEl = document.getElementById('profile-name');
      nameEl.innerHTML = (me.fullname || "ไม่ระบุชื่อ") + badgeHtml;
      nameEl.setAttribute('data-rawname', me.fullname || "ไม่ระบุชื่อ");

      document.getElementById('profile-tambon').innerText = me.tambon || "ไม่ระบุ";
      document.getElementById('profile-level').innerHTML = '<span style="color:' + rStyle.color + '; font-weight:bold;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title + '</span>';
      document.getElementById('profile-score').innerText = me.score || "0";
      localStorage.setItem("userScore", me.score || "0");
      
      const imgUrl = me.profileimage || "";
      const imgStatus = String(me.imagestatus || "Approved");
      const profileImg = document.getElementById('profile-preview');
      const adjustBtn = document.getElementById('btn-adjust-profile');
      const menuAdjust = document.getElementById('menu-adjust-profile');

      if (imgUrl && imgUrl.startsWith('http')) {
        if (imgStatus === 'Approved') {
          profileImg.style.backgroundImage = "url('" + imgUrl + "')";
          profileImg.setAttribute('data-url', imgUrl);
          if (adjustBtn) adjustBtn.style.display = 'inline-block';
          if (menuAdjust) menuAdjust.style.display = 'flex';
          
          const headerUser = document.getElementById('header-user-name');
          if (headerUser) headerUser.innerHTML = '<img src="' + imgUrl + '" style="width:25px; height:25px; border-radius:50%; vertical-align:middle; margin-right:5px; object-fit:cover;"> ' + me.fullname;
        } else {
          // ใช้ SVG แทน URL ภายนอกเพื่อป้องกัน ERR_CONNECTION_CLOSED
          const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
          profileImg.style.backgroundImage = "url('" + placeholderImg + "')";
          profileImg.removeAttribute('data-url');
          if (adjustBtn) adjustBtn.style.display = 'none';
          if (menuAdjust) menuAdjust.style.display = 'none';
          
          const statusText = imgStatus === 'Pending' ? '(รออนุมัติรูป)' : '(รูปไม่เหมาะสม)';
          const headerUser = document.getElementById('header-user-name');
          if (headerUser) headerUser.innerHTML = '<i class="fas fa-user-circle mr-1" style="color:var(--primary-soft)"></i> ' + me.fullname + ' <span style="font-size:10px; color:var(--gold)">' + statusText + '</span>';
          
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
        
        html += '<div class="rank-card" style="margin-bottom: 12px; border-left: 5px solid var(--gold); align-items:center;">' +
                   '<div style="flex-grow:1;">' +
                     '<div style="font-weight:bold; font-size:1rem;">' + item.sourceName + '</div>' +
                     '<div style="font-size:0.85rem; color:var(--primary);">สอบผ่าน (' + item.score + ')</div>' +
                   '</div>';
        
        if (hasCert) {
          // ถ้ามีใบประกาศแล้ว ใช้ลิงก์ตรง <a> เพื่อป้องกันการบล็อกป๊อปอัพ
          html += '<a href="' + item.certUrl + '" target="_blank" class="btn-primary" style="padding: 8px 15px; width: auto; background-color: var(--primary); text-decoration:none; display:inline-flex; align-items:center; gap:8px; justify-content:center;">' +
                    '<i class="fas fa-eye"></i> ดูใบประกาศ' +
                  '</a>';
        } else {
          // ถ้ายังไม่มี ให้กดเพื่อสร้าง
          html += '<button class="btn-primary" style="padding: 8px 15px; width: auto; background-color: var(--primary-dk);" ' +
                    'onclick="handleCertClick(\'' + escapeJS(item.sourceName) + '\', \'' + escapeJS(item.score) + '\', \'\', \'' + escapeJS(item.sourceId) + '\', \'' + escapeJS(item.baseId) + '\')">' +
                    '<i class="fas fa-file-pdf"></i> รับใบประกาศ' +
                  '</button>';
        }
        
        html += '</div>';
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

  function changeCertPage(direction) {
      currentCertPage += direction;
      renderHistoryUI(cacheHistory);
  }

  function handleCertClick(sourceName, score, existingUrl, sourceId, baseId) {
    if (existingUrl && existingUrl !== "undefined" && String(existingUrl).trim() !== "") {
      const win = window.open(existingUrl, '_blank');
      if (!win) {
        showCustomAlert('เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่<br><br><a href="' + existingUrl + '" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none;">คลิกที่นี่เพื่อดูใบประกาศ</a>', 'success', 'เปิดใบประกาศ');
      }
    } else {
      startGenerateCert(sourceName, score, sourceId, baseId);
    }
  }

  function startGenerateCert(sourceName, score, sourceId, baseId) {
    // 🌟 ดึงชื่อบริสุทธิ์จาก data-rawname แทนการใช้ innerText เพื่อป้องกันป้าย Rank ติดไปบนเกียรติบัตร
    const nameEl = document.getElementById('profile-name');
    const name = nameEl.getAttribute('data-rawname') || nameEl.innerText;
    
    const phone = localStorage.getItem("userPhone");
    if (!name || name === "ไม่ระบุชื่อ") return showCustomAlert("ระบบไม่พบชื่อของคุณ", "error");
    
    showLoading(true);
    apiPost('generateCert', { name: name, source: sourceName, score: score, phone: phone, sourceId: sourceId, baseId: baseId })
      .then(function(res) {
        showLoading(false);
        if(res.status === "success") { 
          cacheHistory = null; 
          loadProfileData(); 
          
          const win = window.open(res.url, '_blank');
          if (!win) {
             showCustomAlert('สร้างใบประกาศสำเร็จ!<br><br><a href="' + res.url + '" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none;">คลิกที่นี่เพื่อเปิดดู</a>', 'success', 'สำเร็จ');
          } else {
             showCustomAlert("สร้างใบประกาศสำเร็จ และเปิดในหน้าต่างใหม่แล้ว", "success");
          }
        }
        else { showCustomAlert("เกิดข้อผิดพลาด: " + res.message, "error"); }
      }).catch(function() { showLoading(false); showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
  }

  function openAvatarMenu() { document.getElementById('avatar-menu-modal').style.display = 'flex'; }
  function closeAvatarMenu() { document.getElementById('avatar-menu-modal').style.display = 'none'; }
  function triggerUpload() { document.getElementById('imageUpload').click(); closeAvatarMenu(); }
  function viewFullImage() {
    const picUrl = document.getElementById('profile-preview').getAttribute('data-url');
    if (picUrl && picUrl.startsWith('http')) { document.getElementById('full-image-display').src = picUrl; document.getElementById('image-viewer').style.display = 'flex'; }
    else { showCustomAlert("ยังไม่มีรูปโปรไฟล์ครับ", "warning"); }
    closeAvatarMenu();
  }

  function closeCropModal() {
    document.getElementById('crop-modal').style.display = 'none';
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    // Clear all file inputs
    const inputs = ['imageUpload', 'admin-source-cover-file', 'admin-base-cover-file', 'admin-featured-image-file', 'admin-product-image-file'];
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
    
    // ⏲️ ให้เวลาเบราว์เซอร์ Render Loading Overlay ก่อนเริ่มประมวลผลหนัก
    setTimeout(function() {
      try {
        const outputWidth = (currentCropContext === 'profile') ? 400 : 1280;
        const outputHeight = (currentCropContext === 'profile') ? 400 : 720;

        const canvas = cropper.getCroppedCanvas({
          width: outputWidth,
          height: outputHeight
        });
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        const phone = localStorage.getItem("userPhone");
        const action = (currentCropContext === 'profile') ? 'uploadImage' : 'uploadGeneralImage';
        
        apiPost(action, { 
          base64: base64, 
          fileName: currentFileName || ("upload_" + Date.now() + ".jpg"), 
          phone: phone 
        }).then(function(res) {
            showLoading(false);
            if (saveBtn) saveBtn.disabled = false;
            if(res.status === "success") {
              if (currentCropContext === 'profile') {
                // เมื่ออัปโหลดใหม่ สถานะจะเป็น Pending ทันที
                // เราจะไม่โชว์รูปที่อัปโหลดทันที แต่จะใช้ placeholder และแจ้งเตือน
                document.getElementById('profile-preview').style.backgroundImage = "url('https://via.placeholder.com/150')";
                document.getElementById('profile-preview').removeAttribute('data-url');
                
                const adjustBtn = document.getElementById('btn-adjust-profile');
                if (adjustBtn) adjustBtn.style.display = 'none';
                
                showCustomAlert("อัปโหลดรูปสำเร็จ! กรุณารอครูประจำตำบลตรวจสอบความเหมาะสมก่อนแสดงผล", "success"); 
                cacheLeaderboard = null; 
                cacheProfile = null;
                // รีโหลดข้อมูลโปรไฟล์เพื่ออัปเดตสถานะใน UI
                loadProfileData();
              } else if (currentCropContext === 'source') {
                document.getElementById('admin-source-cover').value = res.url;
                const preview = document.getElementById('admin-source-preview');
                preview.style.backgroundImage = "url('" + res.url + "')";
                preview.style.display = 'block';
                showCustomAlert("อัปโหลดรูปปกสำเร็จ", "success");
              } else if (currentCropContext === 'base') {
                document.getElementById('admin-base-cover').value = res.url;
                const preview = document.getElementById('admin-base-preview');
                preview.style.backgroundImage = "url('" + res.url + "')";
                preview.style.display = 'block';
                showCustomAlert("อัปโหลดรูปฐานสำเร็จ", "success");
              } else if (currentCropContext === 'featured') {
                document.getElementById('admin-featured-image').value = res.url;
                const preview = document.getElementById('admin-featured-preview');
                preview.style.backgroundImage = "url('" + res.url + "')";
                preview.style.display = 'block';
                showCustomAlert("อัปโหลดรูปกิจกรรมสำเร็จ", "success");
              } else if (currentCropContext === 'editUser') {
                document.getElementById('edit-user-image').value = res.url;
                showCustomAlert("อัปโหลดรูปสำเร็จ! อย่าลืมกดบันทึกการแก้ไข", "success");
              } else if (currentCropContext === 'product') {
                document.getElementById('admin-product-image').value = res.url;
                const preview = document.getElementById('admin-product-preview');
                if (preview) {
                  preview.style.backgroundImage = "url('" + res.url + "')";
                  preview.style.display = 'block';
                }
                showCustomAlert("อัปโหลดรูปสินค้าสำเร็จ", "success");
              }
              closeCropModal();
            } else { 
              showCustomAlert("Error: " + res.message, "error"); 
            }
          }).catch(function() { 
            showLoading(false); 
            if (saveBtn) saveBtn.disabled = false;
            showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); 
          });
      } catch (err) {
        showLoading(false);
        if (saveBtn) saveBtn.disabled = false;
        showCustomAlert("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ", "error");
      }
    }, 150);
  }

  function loadMarketData() {
    const grid = document.getElementById('market-products-grid');
    if (!grid) return;
    
    // แสดงปุ่ม "เพิ่มสินค้าใหม่" เฉพาะ ครู และ แอดมิน
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const addBtn = document.getElementById('btn-admin-add-product');
    if (addBtn) {
      addBtn.style.display = (role === "admin" || role === "teacher") ? "inline-block" : "none";
    }

    // ซิงก์แต้มสะสมของผู้ใช้ในเบื้องหลังแบบเรียลไทม์เพื่อไม่ให้แต้มหน้าคูปองไม่ตรง
    const myPhone = localStorage.getItem("userPhone") || "";
    if (myPhone) {
      apiGet('getUserProfile', { phone: myPhone })
        .then(function(res) {
          if (res.status === "success" && res.profile) {
            localStorage.setItem("userScore", res.profile.score || "0");
            
            // อัปเดตป้ายแต้มในหน้าผลิตภัณฑ์ถ้าเปิดโมดอลรายละเอียดค้างไว้
            const scoreBadge = document.getElementById('market-user-score-badge');
            if (scoreBadge) {
              scoreBadge.innerText = 'มี ' + (res.profile.score || "0") + ' แต้ม';
            }
            
            // อัปเดตหน้าโปรไฟล์ด้วย
            const profileScoreEl = document.getElementById('profile-score');
            if (profileScoreEl) {
              profileScoreEl.innerText = res.profile.score || "0";
            }
          }
        }).catch(function(err) {
          console.error("Failed to silently sync userScore:", err);
        });
    }

    if (cacheMarketProducts && Array.isArray(cacheMarketProducts)) {
      allMarketProducts = cacheMarketProducts;
      renderMarketProducts(allMarketProducts);
      return;
    }
    
    grid.innerHTML = '<div class="col-span-2 text-center py-12 text-muted text-sm"><i class="fas fa-circle-notch fa-spin fa-2x mb-2" style="color:var(--primary)"></i><p>กำลังโหลดสินค้าชุมชน...</p></div>';
    
    apiGet('getProducts')
      .then(function(res) {
        if (res.status === "success" && Array.isArray(res.data)) {
          cacheMarketProducts = res.data;
          allMarketProducts = res.data;
          renderMarketProducts(allMarketProducts);
        } else {
          grid.innerHTML = '<div class="col-span-2 text-center text-muted py-8">โหลดข้อมูลผลิตภัณฑ์ไม่สำเร็จ</div>';
        }
      }).catch(function() {
        grid.innerHTML = '<div class="col-span-2 text-center text-muted py-8">เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์</div>';
      });
  }

  function renderMarketProducts(products) {
    const grid = document.getElementById('market-products-grid');
    if (!grid) return;

    if (products.length === 0) {
      grid.innerHTML = '<div class="col-span-2 text-center text-muted py-12" style="background:var(--glass); border-radius:14px; border:1px dashed var(--card-border);"><i class="fas fa-shopping-basket fa-3x mb-3 text-muted" style="opacity:0.4;"></i><p class="font-bold">ยังไม่มีสินค้าในหมวดหมู่นี้</p><p class="text-xs text-muted mt-1">มาร่วมสนับสนุนภูมิปัญญาท้องถิ่นกันครับ</p></div>';
      return;
    }

    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const myTambon = normalizeTambon(localStorage.getItem("userTambon") || "");
    const canManageAll = (role === "admin");
    const canManageOwn = (role === "teacher");

    let html = '';
    products.forEach(function(item) {
      const isMyProduct = canManageAll || (canManageOwn && normalizeTambon(item.tambon) === myTambon);
      const categoryLabel = item.category === 'OTOP' ? 'สินค้า OTOP' : (item.category === 'Wisdom' ? 'ภูมิปัญญา' : (item.category === 'Agriculture' ? 'การเกษตร' : 'อื่น ๆ'));
      const priceText = item.price.toLowerCase().indexOf('บาท') > -1 ? item.price : item.price + ' บาท';
      
      let coverUrl = getValidImageUrl(item.image);
      if (coverUrl === 'https://via.placeholder.com/150?text=No+Image') {
        coverUrl = 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=300&auto=format&fit=crop';
      }

      html += '<div class="market-product-card" onclick="openProductDetail(\'' + escapeJS(item.productId) + '\')">';
      
      // Admin Actions inside Card
      if (isMyProduct) {
        html += '<div class="product-card-admin-actions" onclick="event.stopPropagation()">' +
                  '<button class="btn-product-edit" onclick="editProduct(\'' + escapeJS(item.productId) + '\')" title="แก้ไข"><i class="fas fa-pen"></i></button>' +
                  '<button class="btn-product-delete" onclick="deleteProduct(\'' + escapeJS(item.productId) + '\', event)" title="ลบ"><i class="fas fa-trash"></i></button>' +
                '</div>';
      }

      html +=   '<div class="product-card-img" style="background-image: url(\'' + coverUrl + '\');">' +
                  '<div class="product-card-overlay"></div>' +
                  '<div class="product-card-badges">' +
                    '<span class="tambon">' + formatTambon(item.tambon) + '</span>' +
                    '<span class="category">' + categoryLabel + '</span>' +
                  '</div>' +
                '</div>' +
                '<div class="product-card-body">' +
                  '<h4 class="product-card-title">' + item.name + '</h4>' +
                  '<p class="product-card-desc">' + (item.description || "ไม่มีรายละเอียดเพิ่มเติม") + '</p>' +
                  '<div class="product-card-price mt-auto">' + priceText + '</div>' +
                '</div>' +
              '</div>';
    });

    grid.innerHTML = html;
  }

  function filterMarketProducts() {
    const query = (document.getElementById('market-search').value || '').trim().toLowerCase();
    const tambonFilter = document.getElementById('market-tambon-filter').value;
    const catFilter = document.getElementById('market-category-filter').value;

    let filtered = allMarketProducts || [];

    if (query) {
      filtered = filtered.filter(function(item) {
        const text = [item.name, item.description, item.tambon, item.category].join(' ').toLowerCase();
        return text.indexOf(query) > -1;
      });
    }

    if (tambonFilter) {
      filtered = filtered.filter(function(item) {
        return normalizeTambon(item.tambon) === normalizeTambon(tambonFilter);
      });
    }

    if (catFilter) {
      filtered = filtered.filter(function(item) {
        return item.category === catFilter;
      });
    }

    renderMarketProducts(filtered);
  }

  let currentDetailProductId = "";
  let currentDetailProductName = "";

  function openProductDetail(productId) {
    const item = allMarketProducts.find(p => p.productId === productId);
    if (!item) return;

    // Reset redeemed coupon container
    const couponCont = document.getElementById('redeemed-coupon-container');
    if (couponCont) couponCont.style.display = 'none';

    // Store current product data for coupon redemption
    currentDetailProductId = item.productId;
    currentDetailProductName = item.name;

    // Update user score badge inside detail modal
    const userScore = Number(localStorage.getItem("userScore") || 0);
    const scoreBadge = document.getElementById('market-user-score-badge');
    if (scoreBadge) {
      scoreBadge.innerText = 'มี ' + userScore + ' แต้ม';
    }

    document.getElementById('product-detail-name').innerText = item.name;
    document.getElementById('product-detail-price').innerText = item.price.toLowerCase().indexOf('บาท') > -1 ? item.price : item.price + ' บาท';
    document.getElementById('product-detail-desc').innerText = item.description || "ไม่มีรายละเอียดเพิ่มเติม";
    document.getElementById('product-detail-tambon-badge').innerText = formatTambon(item.tambon);
    
    const catLabels = { 'OTOP': 'สินค้า OTOP', 'Wisdom': 'ภูมิปัญญาท้องถิ่น', 'Agriculture': 'เกษตรชุมชน', 'Other': 'อื่น ๆ' };
    document.getElementById('product-detail-cat-badge').innerText = catLabels[item.category] || "อื่น ๆ";
    document.getElementById('product-detail-contact').innerText = item.contact;
    
    let coverUrl = getValidImageUrl(item.image);
    if (coverUrl === 'https://via.placeholder.com/150?text=No+Image') {
      coverUrl = 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=600&auto=format&fit=crop';
    }
    document.getElementById('product-detail-cover').style.backgroundImage = "url('" + coverUrl + "')";

    document.getElementById('product-detail-modal').style.display = 'flex';
  }

  function redeemCouponUI(points, discount) {
    const userPhone = localStorage.getItem("userPhone") || "";
    if (!userPhone) {
      return showCustomAlert("กรุณาเข้าสู่ระบบเพื่อใช้สิทธิ์แต้มสะสม", "warning");
    }

    const userScore = Number(localStorage.getItem("userScore") || 0);
    if (userScore < points) {
      return showCustomAlert("แต้มสะสมของคุณไม่เพียงพอสำหรับการแลกส่วนลดนี้ (ต้องการ " + points + " แต้ม, คุณมี " + userScore + " แต้ม)", "warning");
    }

    showCustomConfirm("ยืนยันแลก " + points + " แต้ม เป็นคูปองส่วนลดมูลค่า " + discount + " บาท สำหรับซื้อสินค้าชิ้นนี้?", function() {
      showLoading(true);
      apiPost('redeemCoupon', withAuthData({
        points: points,
        discount: discount,
        productId: currentDetailProductId,
        productName: currentDetailProductName
      })).then(function(res) {
        showLoading(false);
        if (res.status === "success" && res.couponCode) {
          // Update score in local storage
          localStorage.setItem("userScore", res.newScore);
          
          // Update score badge inside modal
          const scoreBadge = document.getElementById('market-user-score-badge');
          if (scoreBadge) {
            scoreBadge.innerText = 'มี ' + res.newScore + ' แต้ม';
          }
          
          // Render coupon code in the display area
          const couponCodeEl = document.getElementById('redeemed-coupon-code');
          const couponDetailsEl = document.getElementById('redeemed-coupon-details');
          const couponContEl = document.getElementById('redeemed-coupon-container');
          
          if (couponCodeEl) couponCodeEl.innerText = res.couponCode;
          if (couponDetailsEl) couponDetailsEl.innerText = 'คูปองใช้เป็นส่วนลดมูลค่า ' + discount + ' บาท สำหรับผลิตภัณฑ์ ' + currentDetailProductName;
          if (couponContEl) couponContEl.style.display = 'block';
          
          showCustomAlert("แลกคูปองสำเร็จ! รหัสคูปองของคุณคือ " + res.couponCode, "success");
          
          // เคลียร์แคชโปรไฟล์และบอร์ดผู้รวบรวมแต้ม เพื่อให้โหลดค่าใหม่จากเซิร์ฟเวอร์เมื่อเปิดดูครั้งถัดไป
          cacheProfile = null;
          cacheLeaderboard = null;
          
          // Triggers user score update in profile tab if visible
          const profileScoreEl = document.getElementById('profile-score');
          if (profileScoreEl) profileScoreEl.innerText = res.newScore;
        } else {
          showCustomAlert(res.message || "เกิดข้อผิดพลาดในการแลกคูปอง", "error");
        }
      }).catch(function(err) {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
      });
    });
  }

  function closeProductDetailModal() {
    document.getElementById('product-detail-modal').style.display = 'none';
  }

  function openProductModal(mode, productId) {
    document.getElementById('product-edit-form').reset();
    document.getElementById('admin-product-preview').style.display = 'none';
    
    const titleEl = document.getElementById('product-form-title');
    const modeEl = document.getElementById('admin-product-mode');
    const idEl = document.getElementById('admin-product-id');
    const tambonSelect = document.getElementById('admin-product-tambon');
    
    modeEl.value = mode;
    
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const userTambon = (localStorage.getItem("userTambon") || "").trim();

    // ล็อคตำบลสำหรับ ครูประจำตำบล เพื่อป้องกันการข้ามเขต
    if (role === "teacher" && userTambon) {
      tambonSelect.value = formatTambon(userTambon);
      tambonSelect.disabled = true;
    } else {
      tambonSelect.disabled = false;
      tambonSelect.value = "";
    }

    if (mode === 'create') {
      titleEl.innerHTML = '<i class="fas fa-plus-circle mr-2" style="color:var(--primary)"></i>เพิ่มสินค้า OTOP ใหม่';
      idEl.value = '';
    } else if (mode === 'edit') {
      titleEl.innerHTML = '<i class="fas fa-edit mr-2" style="color:var(--primary)"></i>แก้ไขข้อมูลสินค้า';
      
      const item = allMarketProducts.find(p => p.productId === productId);
      if (!item) return;

      idEl.value = item.productId;
      document.getElementById('admin-product-name').value = item.name;
      document.getElementById('admin-product-category').value = item.category;
      document.getElementById('admin-product-price').value = item.price;
      
      // ตั้งค่าตำบลของครูหรือของผลิตภัณฑ์เก่า
      tambonSelect.value = formatTambon(item.tambon);
      
      document.getElementById('admin-product-desc').value = item.description;
      document.getElementById('admin-product-image').value = item.image;
      document.getElementById('admin-product-contact').value = item.contact;

      if (item.image) {
        const preview = document.getElementById('admin-product-preview');
        preview.style.backgroundImage = "url('" + getValidImageUrl(item.image) + "')";
        preview.style.display = 'block';
      }
    }

    document.getElementById('product-form-modal').style.display = 'flex';
  }

  function closeProductModal() {
    document.getElementById('product-form-modal').style.display = 'none';
  }

  function submitProductForm() {
    const mode = document.getElementById('admin-product-mode').value;
    const productId = document.getElementById('admin-product-id').value;
    const name = document.getElementById('admin-product-name').value.trim();
    const category = document.getElementById('admin-product-category').value;
    const price = document.getElementById('admin-product-price').value.trim();
    
    // ดึงค่าตำบล (ถ้าโดน disable ต้องเอาจากค่าที่ตั้งไว้)
    const tambonSelect = document.getElementById('admin-product-tambon');
    const tambon = tambonSelect.disabled ? (localStorage.getItem("userTambon") || "") : tambonSelect.value;
    
    const desc = document.getElementById('admin-product-desc').value.trim();
    const image = document.getElementById('admin-product-image').value.trim();
    const contact = document.getElementById('admin-product-contact').value.trim();

    if (!name || !category || !price || !tambon || !contact) {
      return showCustomAlert("กรุณากรอกข้อมูลสำคัญที่มีสัญลักษณ์ดอกจันให้ครบถ้วน", "warning");
    }

    const payload = {
      mode: mode,
      productId: productId,
      name: name,
      category: category,
      price: price,
      tambon: formatTambon(tambon),
      description: desc,
      image: image,
      contact: contact
    };

    showLoading(true);
    apiPost('saveProduct', withAuthData(payload))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          showCustomAlert(mode === 'create' ? "เพิ่มผลิตภัณฑ์ใหม่เรียบร้อยแล้ว!" : "แก้ไขข้อมูลผลิตภัณฑ์เรียบร้อยแล้ว!", "success");
          closeProductModal();
          cacheMarketProducts = null;
          loadMarketData();
        } else {
          showCustomAlert(res.message || "บันทึกผลิตภัณฑ์ล้มเหลว", "error");
        }
      }).catch(function() {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์", "error");
      });
  }

  function editProduct(productId) {
    openProductModal('edit', productId);
  }

  function deleteProduct(productId, event) {
    if (event) event.stopPropagation();
    if (!productId) return;

    showCustomConfirm("คุณแน่ใจใช่หรือไม่ว่าต้องการลบสินค้าภูมิปัญญาชุมชนชิ้นนี้?", function() {
      showLoading(true);
      apiPost('deleteProduct', withAuthData({ productId: productId }))
        .then(function(res) {
          showLoading(false);
          if (res.status === "success") {
            showCustomAlert("ลบผลิตภัณฑ์ชุมชนเรียบร้อยแล้ว", "success");
            cacheMarketProducts = null;
            loadMarketData();
          } else {
            showCustomAlert(res.message || "ลบผลิตภัณฑ์ล้มเหลว", "error");
          }
        }).catch(function() {
          showLoading(false);
          showCustomAlert("เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์", "error");
        });
    });
  }

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

  function openCouponWalletModal() {
    document.getElementById('coupon-wallet-modal').style.display = 'flex';
    switchWalletTab('coupons');
  }

  function closeCouponWalletModal() {
    document.getElementById('coupon-wallet-modal').style.display = 'none';
  }

  function switchWalletTab(tabName) {
    const tabCouponsBtn = document.getElementById('tab-wallet-coupons');
    const tabLedgerBtn = document.getElementById('tab-wallet-ledger');
    const couponsContent = document.getElementById('wallet-coupons-content');
    const ledgerContent = document.getElementById('wallet-ledger-content');

    if (tabName === 'coupons') {
      tabCouponsBtn.style.borderBottom = '3px solid var(--primary)';
      tabCouponsBtn.style.color = 'var(--primary)';
      tabLedgerBtn.style.borderBottom = '3px solid transparent';
      tabLedgerBtn.style.color = 'var(--text-soft)';
      
      couponsContent.style.display = 'block';
      ledgerContent.style.display = 'none';
      
      loadUserCoupons();
    } else {
      tabLedgerBtn.style.borderBottom = '3px solid var(--primary)';
      tabLedgerBtn.style.color = 'var(--primary)';
      tabCouponsBtn.style.borderBottom = '3px solid transparent';
      tabCouponsBtn.style.color = 'var(--text-soft)';
      
      couponsContent.style.display = 'none';
      ledgerContent.style.display = 'block';
      
      loadUserPointsHistory();
    }
  }

  function loadUserCoupons() {
    const container = document.getElementById('wallet-coupons-list');
    container.innerHTML = `
      <div class="text-center py-8 text-muted text-sm">
        <i class="fas fa-circle-notch fa-spin mr-2" style="color:var(--primary)"></i>กำลังดึงข้อมูลคูปองของคุณ...
      </div>
    `;

    const username = localStorage.getItem("userPhone");
    if (!username) {
      container.innerHTML = `<div class="text-center py-8 text-muted text-sm"><i class="fas fa-exclamation-circle mr-1"></i>ไม่พบเซสชันการเข้าสู่ระบบ</div>`;
      return;
    }

    apiGet('getUserCoupons', { username: username })
      .then(function(res) {
        if (res.status === 'success') {
          const list = res.data || [];
          if (list.length === 0) {
            container.innerHTML = `
              <div class="text-center py-10 px-4 text-muted text-sm loft-card" style="background:var(--glass); border:1px dashed var(--glass-border); margin-top: 10px;">
                <div class="text-4xl mb-3">🎟️</div>
                <div class="font-bold text-theme-inv mb-1">ยังไม่มีคูปองส่วนลด</div>
                <div style="color:var(--text-soft); font-size: 0.8rem; line-height: 1.4;">คุณยังไม่มีคูปองในกระเป๋า สะสมแต้มแล้วแลกคูปองที่ตลาดชุมชนกันเลย!</div>
              </div>
            `;
            return;
          }

          let html = '';
          list.forEach(function(item) {
            const isActive = item.status === 'Active';
            const cardBg = isActive 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(4, 120, 87, 0.04))' 
              : 'rgba(255, 255, 255, 0.02)';
            const borderColor = isActive ? 'var(--primary)' : 'var(--glass-border)';
            const statusLabel = isActive ? '🎟️ ใช้งานได้' : '✔️ ใช้งานแล้ว';
            
            html += `
              <div class="loft-card p-3 rounded-2xl flex flex-col gap-2 relative transition-all" style="background:${cardBg}; border:1px solid ${borderColor}; opacity: ${isActive ? '1' : '0.6'}; margin-top: 5px;">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full" style="background:${isActive ? 'var(--primary-light)' : 'var(--glass)'}; color:${isActive ? 'var(--primary)' : 'var(--text-soft)'};">
                    ${statusLabel}
                  </span>
                  <span class="text-xs text-muted" style="font-size:0.7rem;"><i class="far fa-clock mr-1"></i>${item.redeemedAt}</span>
                </div>
                <div class="flex flex-col mt-1">
                  <h4 class="font-black text-sm text-theme-inv" style="font-size:0.9rem; line-height:1.2;">${item.productName}</h4>
                  <div class="flex items-baseline gap-1 mt-1">
                    <span class="text-xs" style="color:var(--text-soft);">มูลค่าส่วนลด:</span>
                    <span class="text-base font-black text-theme-inv" style="color:var(--gold)">฿${item.discountAmount}</span>
                    <span class="text-xs text-muted" style="font-size:0.7rem;">(${item.pointsUsed} แต้ม)</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-2 pt-2" style="border-top:1px dashed var(--glass-border);">
                  <div class="flex-1 font-mono text-center font-bold tracking-widest text-sm p-1.5 rounded-lg text-theme-inv" style="background:rgba(0,0,0,0.25); border:1px solid var(--glass-border);">
                    ${item.code}
                  </div>
                  ${isActive ? `
                    <button class="btn-primary" style="padding:6px 12px; font-size:0.75rem; border-radius:var(--r-md); background:linear-gradient(135deg, var(--primary), var(--primary-dk));" onclick="copyCouponCode(this, '${item.code}')">
                      <i class="far fa-copy mr-1"></i>คัดลอกรหัส
                    </button>
                  ` : `
                    <button class="btn-primary" style="padding:6px 12px; font-size:0.75rem; border-radius:var(--r-md); background:var(--glass); color:var(--text-soft); border:1px solid var(--glass-border); box-shadow:none; cursor:default;" disabled>
                      ใช้แล้ว
                    </button>
                  `}
                </div>
              </div>
            `;
          });
          container.innerHTML = html;
        } else {
          container.innerHTML = `<div class="text-center py-8 text-sm text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>${res.message || 'เกิดข้อผิดพลาดในการโหลดคูปอง'}</div>`;
        }
      })
      .catch(function(err) {
        console.error(err);
        container.innerHTML = `<div class="text-center py-8 text-sm text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>ล้มเหลวในการดึงข้อมูล</div>`;
      });
  }

  function loadUserPointsHistory() {
    const container = document.getElementById('wallet-ledger-list');
    container.innerHTML = `
      <div class="text-center py-8 text-muted text-sm">
        <i class="fas fa-circle-notch fa-spin mr-2" style="color:var(--primary)"></i>กำลังดึงประวัติคะแนนสะสม...
      </div>
    `;

    const username = localStorage.getItem("userPhone");
    if (!username) {
      container.innerHTML = `<div class="text-center py-8 text-muted text-sm"><i class="fas fa-exclamation-circle mr-1"></i>ไม่พบเซสชันการเข้าสู่ระบบ</div>`;
      return;
    }

    apiGet('getUserPointsHistory', { username: username })
      .then(function(res) {
        if (res.status === 'success') {
          const history = res.history || [];
          if (history.length === 0) {
            container.innerHTML = `
              <div class="text-center py-10 px-4 text-muted text-sm loft-card" style="background:var(--glass); border:1px dashed var(--glass-border); margin-top: 10px;">
                <div class="text-4xl mb-3">📈</div>
                <div class="font-bold text-theme-inv mb-1">ยังไม่มีประวัติคะแนน</div>
                <div style="color:var(--text-soft); font-size: 0.8rem; line-height: 1.4;">เริ่มเรียนรู้ ทำแบบทดสอบ และส่งกิจกรรมเพื่อสะสมคะแนนกันเลย!</div>
              </div>
            `;
            return;
          }

          let html = '<div class="points-timeline flex flex-col gap-2 relative">';
          history.forEach(function(item) {
            const isPlus = item.points.startsWith('+');
            const color = isPlus ? '#10b981' : '#f97316';
            const icon = item.type === 'quiz' ? 'fa-pen-fancy' 
                         : item.type === 'log' ? 'fa-book-open' 
                         : 'fa-ticket-alt';
            
            html += `
              <div class="loft-card p-3 rounded-2xl flex items-center gap-3 transition-all" style="background:var(--glass); border:1px solid var(--glass-border); margin-top: 5px;">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0" style="background:${isPlus ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)'}; border:1px solid ${isPlus ? 'rgba(16,185,129,0.2)' : 'rgba(249,115,22,0.2)'}; color:${color}; font-size: 0.7rem;">
                  <i class="fas ${icon}"></i>
                </div>
                <div class="flex-1 flex flex-col min-w-0">
                  <span class="text-xs font-bold text-theme-inv leading-tight truncate" style="font-size:0.8rem;">${item.description}</span>
                  <span class="text-xxs text-muted mt-1" style="font-size:0.65rem;"><i class="far fa-clock mr-1"></i>${item.dateStr}</span>
                </div>
                <div class="font-black text-xs text-right shrink-0" style="color:${color}; font-size: 0.8rem;">
                  ${item.points} แต้ม
                </div>
              </div>
            `;
          });
          html += '</div>';
          container.innerHTML = html;
        } else {
          container.innerHTML = `<div class="text-center py-8 text-sm text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>${res.message || 'เกิดข้อผิดพลาดในการโหลดประวัติแต้ม'}</div>`;
        }
      })
      .catch(function(err) {
        console.error(err);
        container.innerHTML = `<div class="text-center py-8 text-sm text-red-500"><i class="fas fa-exclamation-circle mr-1"></i>ล้มเหลวในการดึงข้อมูล</div>`;
      });
  }

  function copyCouponCode(btn, code) {
    if (!navigator.clipboard) {
      const textArea = document.createElement("textarea");
      textArea.value = code;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        showCopySuccess(btn);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
      return;
    }
    
    navigator.clipboard.writeText(code).then(function() {
      showCopySuccess(btn);
    }, function(err) {
      console.error('Clipboard copy failed', err);
    });
  }

  function showCopySuccess(btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check mr-1"></i>คัดลอกแล้ว! ✔️';
    btn.style.background = 'linear-gradient(135deg, #10b981, #047857)';
    setTimeout(function() {
      btn.innerHTML = originalText;
      btn.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dk))';
    }, 2000);
  }

  // ================= ระบบหอเกียรติยศและเหรียญตราความสำเร็จ (Honorary Badges Shelf Frontend) =================

  function loadUserBadges() {
    const container = document.getElementById('badges-shelf-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4 text-muted text-sm col-span-4">' +
                            '<i class="fas fa-circle-notch fa-spin mr-2" style="color:var(--primary)"></i>กำลังโหลดเหรียญเกียรติยศ...' +
                          '</div>';

    const myPhone = localStorage.getItem("userPhone") || "";
    if (!myPhone) return;

    apiGet('getUserBadges', { phone: myPhone })
      .then(function(res) {
        if (res.status === "success" && Array.isArray(res.badges)) {
          renderBadgesUI(res.badges);
        } else {
          container.innerHTML = '<div class="text-center py-4 text-danger text-sm col-span-4">' +
                                  '<i class="fas fa-exclamation-triangle mr-2"></i>' + (res.message || 'ไม่สามารถโหลดเหรียญเกียรติยศได้') +
                                '</div>';
        }
      })
      .catch(function(err) {
        console.error("Failed to load user badges", err);
        container.innerHTML = '<div class="text-center py-4 text-danger text-sm col-span-4">' +
                                '<i class="fas fa-exclamation-triangle mr-2"></i>เกิดข้อผิดพลาดในการเชื่อมต่อ' +
                              '</div>';
      });
  }

  function renderBadgesUI(badges) {
    const container = document.getElementById('badges-shelf-container');
    if (!container) return;

    let html = '';
    badges.forEach(function(badge) {
      const escapedName = badge.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const escapedDesc = badge.description.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      const progressPercent = Math.min((badge.currentValue / badge.targetValue) * 100, 100);
      const orbClass = badge.unlocked ? 'badge-3d-gold' : 'badge-3d-locked';

      html += `
        <div class="flex flex-col items-center text-center p-2 rounded-xl transition-all duration-300 hover:scale-105 cursor-pointer"
             style="background: var(--glass); border: 1px solid var(--glass-border);"
             onclick="viewBadgeDetail('${escapedName}', '${escapedDesc}', ${badge.unlocked}, ${badge.currentValue}, ${badge.targetValue}, '${badge.color}', '${badge.icon}')">
          
          <!-- Premium 3D Gold / Locked Orb -->
          <div class="badge-3d-orb ${orbClass} mb-2">
            <i class="fas ${badge.icon} badge-3d-icon"></i>
            ${!badge.unlocked ? `
              <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center border border-gray-400 z-10" style="background:#374151; font-size:0.65rem; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                <i class="fas fa-lock text-white"></i>
              </div>
            ` : `
              <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border border-yellow-200 z-10" style="background:#fbbf24; font-size:0.65rem; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                <i class="fas fa-check text-amber-950 font-black"></i>
              </div>
            `}
          </div>

          <!-- Badge Name -->
          <span class="text-theme-inv font-bold mb-1 leading-tight text-center" style="font-size: 0.68rem; height: 26px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
            ${badge.name}
          </span>

          <!-- Progress / Target -->
          <div class="w-full mt-1">
            <div class="flex justify-between items-center text-muted mb-0.5" style="font-size: 0.58rem; font-weight: 600;">
              <span>${progressPercent >= 100 ? 'เสร็จสิ้น' : badge.unlocked ? 'ปลดล็อก' : 'ก้าวหน้า'}</span>
              <span>${badge.currentValue}/${badge.targetValue}</span>
            </div>
            <!-- Progress Bar -->
            <div class="w-full bg-gray-200 rounded-full" style="height: 4.5px; background: rgba(156,163,175,0.25); overflow:hidden;">
              <div class="h-full rounded-full transition-all duration-500" 
                   style="width: ${progressPercent}%; background: ${badge.unlocked ? 'linear-gradient(90deg, #facc15, #d97706)' : 'linear-gradient(90deg, #9ca3af, #6b7280)'};">
              </div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function viewBadgeDetail(name, desc, unlocked, current, target, color, icon) {
    let message = '';
    if (unlocked) {
      message = `<div class="text-center py-2">
        <div class="flex justify-center mb-4">
          <div class="badge-3d-orb badge-3d-gold w-20 h-20" style="transform: scale(1.15);">
            <i class="fas ${icon} badge-3d-icon" style="font-size: 2.2rem;"></i>
          </div>
        </div>
        <h4 class="font-black text-xl mb-2 text-theme-inv" style="background: linear-gradient(135deg, #fbbf24, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1));">${name}</h4>
        <p class="text-theme-inv font-semibold text-sm mb-4">🎉 ยินดีด้วย! คุณได้ปลดล็อกเหรียญเกียรติยศนี้เรียบร้อยแล้ว!</p>
        <div class="p-3 rounded-xl text-left text-xs mb-3" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.5;">
          <strong>รายละเอียดภารกิจ:</strong> ${desc}<br>
          <strong>สถิติการสะสม:</strong> ปลดล็อกแล้ว (${current}/${target})
        </div>
      </div>`;
      showCustomAlert(message, "success");
    } else {
      const remaining = target - current;
      const progressPercent = Math.min((current / target) * 100, 100).toFixed(0);
      message = `<div class="text-center py-2">
        <div class="flex justify-center mb-4">
          <div class="badge-3d-orb badge-3d-locked w-20 h-20" style="transform: scale(1.15);">
            <i class="fas ${icon} badge-3d-icon" style="font-size: 2rem;"></i>
          </div>
        </div>
        <h4 class="font-black text-xl mb-2 text-theme-inv">${name}</h4>
        <p class="text-muted text-sm mb-4">🔒 เหรียญรางวัลนี้กำลังรอการพิชิตของคุณ</p>
        <div class="p-3 rounded-xl text-left text-xs mb-4" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.5;">
          <strong>เงื่อนไขการปลดล็อก:</strong> ${desc}<br>
          <strong>ความคืบหน้าปัจจุบัน:</strong> ${current} / ${target} (${progressPercent}%)<br>
          <strong>ต้องการสะสมอีก:</strong> <span class="font-bold text-amber-500">${remaining} หน่วย</span> เพื่อพิชิตเหรียญรางวัลนี้!
        </div>
        <div class="w-full bg-gray-200 rounded-full mb-2" style="height: 8px; background: rgba(156,163,175,0.2); overflow:hidden;">
          <div class="h-full rounded-full transition-all duration-500" 
               style="width: ${progressPercent}%; background: linear-gradient(90deg, #9ca3af, #4b5563);">
          </div>
        </div>
      </div>`;
      showCustomAlert(message, "info");
    }
  }

  // ================= ระบบวงล้อนำโชค OTOP (OTOP Lucky Spin Wheel Frontend) =================

  let isSpinning = false;
  let currentWheelRotation = 0; // ในหน่วยเรเดียน
  const wheelSlices = [
    { label: "ลองใหม่นะ 🍀", type: "none", color: "#374151", textColor: "#ffffff" },
    { label: "5 แต้ม 🪙", type: "points", color: "#8b5cf6", textColor: "#ffffff" },
    { label: "10 แต้ม 💎", type: "points", color: "#3b82f6", textColor: "#ffffff" },
    { label: "ลองใหม่นะ 🍀", type: "none", color: "#374151", textColor: "#ffffff" },
    { label: "20 แต้ม 🌟", type: "points", color: "#f59e0b", textColor: "#ffffff" },
    { label: "คูปอง 20 บ. 🎟️", type: "coupon", color: "#10b981", textColor: "#ffffff" },
    { label: "50 แต้ม 🔥", type: "points", color: "#ef4444", textColor: "#ffffff" },
    { label: "คูปอง 50 บ. 👑", type: "coupon", color: "#e11d48", textColor: "#ffffff" }
  ];

  let audioCtx = null;
  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playSynthTick() {
    try {
      initAudioContext();
      if (!audioCtx || audioCtx.state === 'suspended') return;
      
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
      console.warn("Web Audio failed to play tick", e);
    }
  }

  function playSynthWin() {
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0, now + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.3);
      });
    } catch (e) {}
  }

  function playSynthFanfare() {
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const chords = [
        [261.63, 329.63, 392.00], // C4, E4, G4
        [329.63, 392.00, 523.25], // E4, G4, C5
        [392.00, 523.25, 659.25], // G4, C5, E5
        [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      ];
      chords.forEach((chord, chordIdx) => {
        chord.forEach((freq) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + chordIdx * 0.15);
          gain.gain.setValueAtTime(0, now + chordIdx * 0.15);
          gain.gain.linearRampToValueAtTime(0.06, now + chordIdx * 0.15 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + chordIdx * 0.15 + 0.4);
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start(now + chordIdx * 0.15);
          osc.stop(now + chordIdx * 0.15 + 0.45);
        });
      });
    } catch (e) {}
  }

  function playSynthLose() {
    try {
      initAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const notes = [392.00, 311.13]; // G4, Eb4
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);
        gain.gain.setValueAtTime(0.12, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.3);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.35);
      });
    } catch(e) {}
  }

  function openLuckySpinModal() {
    document.getElementById('lucky-spin-modal').style.display = 'flex';
    const userScore = localStorage.getItem("userScore") || "0";
    document.getElementById('spin-user-score').innerText = userScore;
    setTimeout(drawLuckyWheel, 100);
    initAudioContext();
  }

  function closeLuckySpinModal() {
    if (isSpinning) return;
    document.getElementById('lucky-spin-modal').style.display = 'none';
  }

  function drawLuckyWheel() {
    const canvas = document.getElementById('lucky-wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const center = width / 2;
    const radius = center - 16; // เผื่อพื้นที่ให้ขอบทองเหลืองนอกสุด
    const sliceAngle = (2 * Math.PI) / 8;
    
    ctx.clearRect(0, 0, width, height);
    
    // ================= 1. 3D OUTER SHADOW PLATE (ฐานเงาวงล้อลอยตัวจากพื้น) =================
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 11, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fill();
    ctx.restore();

    // ================= 2. ROTATING INNER WHEEL (ส่วนวงล้อหมุนที่แบ่งช่อง) =================
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(currentWheelRotation);
    
    // วาดแต่ละซี่สไลด์
    for (let i = 0; i < 8; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = (i + 1) * sliceAngle;
      const slice = wheelSlices[i];
      
      // วาดแผ่นหน้าของช่องพร้อมมิติหมุนลึก 3D
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();
      
      // พื้นสีของช่องรางวัล
      ctx.fillStyle = slice.color;
      ctx.fill();
      
      // มิติไล่ระดับแสงนูน 3D Depth (Pillowed Specular Overlay)
      const radGrad = ctx.createRadialGradient(0, 0, 16, 0, 0, radius);
      radGrad.addColorStop(0, "rgba(255,255,255,0.22)");
      radGrad.addColorStop(0.65, "rgba(0,0,0,0)");
      radGrad.addColorStop(0.9, "rgba(0,0,0,0.08)");
      radGrad.addColorStop(1, "rgba(0,0,0,0.48)"); // ขอบชะลอมืดสร้างมิติความโค้งงอ
      ctx.fillStyle = radGrad;
      ctx.fill();
      ctx.restore();
      
      // วาดซี่เหล็กโลหะนูนกั้นระหว่างช่อง (Metallic Divider Spokes)
      ctx.save();
      ctx.rotate(startAngle);
      // เส้นทึบสำหรับเงาด้านล่าง
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "rgba(0,0,0,0.38)";
      ctx.stroke();
      // เส้นไฮไลท์โลหะนูนขาวสะท้อนแสงด้านบน
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(radius, 0);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.stroke();
      ctx.restore();

      // วาดตัวอักษรรางวัลในช่อง
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      
      // เงาข้อความด้านล่างเพื่อมิติความลอยอักษร
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1.5;
      
      ctx.fillStyle = slice.textColor;
      // ใช้ฟอนต์หนาพรีเมียม
      ctx.font = "900 11px 'Outfit', 'Inter', sans-serif";
      
      const label = slice.label;
      ctx.fillText(label, radius - 18, 0);
      ctx.restore();
    }
    ctx.restore();

    // ================= 3. STATIC METALLIC GOLDEN OUTER RIM (วงขอบทองเหลือง 3D วาดทับแบบไม่หมุนตามล้อ) =================
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 11, 0, 2 * Math.PI);
    ctx.arc(center, center, radius - 2, 0, 2 * Math.PI, true); // สร้างวงแหวนโดนัทครอบขอบล้อ
    ctx.closePath();
    
    // ไล่ระดับเฉดโลหะทองคำขัดเงาสะท้อนระดับโลก
    const metalGrad = ctx.createLinearGradient(0, 0, width, height);
    metalGrad.addColorStop(0, "#b45309"); // น้ำตาลทองแดงเงาเข้ม
    metalGrad.addColorStop(0.2, "#fef08a"); // เหลืองสะท้อนแสงสูง
    metalGrad.addColorStop(0.4, "#92400e"); // บรอนซ์เข้ม
    metalGrad.addColorStop(0.65, "#fffbeb"); // แสงสะท้อนจ้าขอบบน
    metalGrad.addColorStop(0.85, "#b45309"); // น้ำตาลทองแดงเงา
    metalGrad.addColorStop(1, "#f59e0b"); // ทองคำเหลือง
    
    ctx.fillStyle = metalGrad;
    ctx.fill();
    
    // วาดเส้นนูนขอบนอกและขอบในเพื่อมิติ 3D Beveling
    ctx.beginPath();
    ctx.arc(center, center, radius + 11, 0, 2 * Math.PI);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(center, center, radius - 2, 0, 2 * Math.PI);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    ctx.restore();

    // ================= 4. STATIC LIGHT BULBS (ดวงไฟแก้ว 16 ดวงไม่หมุนตามวงล้อ) =================
    const numLights = 16;
    const lightRadius = 4.5;
    const lightsDist = radius + 4.5;
    const blinkState = Math.floor(Date.now() / 250) % 2 === 0;
    
    for (let i = 0; i < numLights; i++) {
      const angle = (i * (2 * Math.PI)) / numLights;
      const x = center + Math.cos(angle) * lightsDist;
      const y = center + Math.sin(angle) * lightsDist;
      
      ctx.save();
      const isEven = i % 2 === 0;
      const isOn = (isEven && blinkState) || (!isEven && !blinkState);
      
      if (isOn) {
        // หลอดไฟส่องสว่างเหลืองสว่างเจิดจ้ามีมิตินูนแก้ว (Luminous Neon Bulb)
        const lightGrad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, lightRadius);
        lightGrad.addColorStop(0, "#ffffff"); // แสงจ้าจุดศูนย์กลางสะท้อนกลม
        lightGrad.addColorStop(0.3, "#fef08a"); // ขอบเหลืองสว่าง
        lightGrad.addColorStop(1, "#d97706"); // สีส้มเข้มขอบฐานหลอด
        
        ctx.beginPath();
        ctx.arc(x, y, lightRadius, 0, 2 * Math.PI);
        ctx.fillStyle = lightGrad;
        
        // แสงเรืองรองโกลว์ (Bulb glow shadow)
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fill();
      } else {
        // หลอดไฟดับ: มิติลูกปัดแก้วรมควันสีเทามีไฮไลท์จิ๋วสะท้อนแสง (Frosted glass bead)
        const lightGrad = ctx.createRadialGradient(x - 1.2, y - 1.2, 0, x, y, lightRadius);
        lightGrad.addColorStop(0, "#d1d5db"); // จุดไฮไลท์สะท้อนสีเทา
        lightGrad.addColorStop(0.6, "#4b5563"); // สีเทากลาง
        lightGrad.addColorStop(1, "#1f2937"); // สีดำฐานหลอด
        
        ctx.beginPath();
        ctx.arc(x, y, lightRadius, 0, 2 * Math.PI);
        ctx.fillStyle = lightGrad;
        ctx.fill();
        
        // จุดประกายสะท้อนจิ๋วสีขาวเพิ่มความวาววับ (Tiny White Highlight)
        ctx.beginPath();
        ctx.arc(x - 1.2, y - 1.2, 0.8, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
      }
      ctx.restore();
    }

    // ================= 5. ULTRA-PREMIUM GOLDEN CENTER DOME (ดุมทองขอบเบเวลไม่หมุนตามล้อสำหรับรองปุ่มกด) =================
    // 5.1 ฐานเงารอบล่างสุด
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, 32, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3.5;
    ctx.fill();
    ctx.restore();

    // 5.2 ขอบแหวนทองเหลืองรอบนอกปุ่ม
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, 30, 0, 2 * Math.PI);
    const centerMetalGrad = ctx.createLinearGradient(center - 30, center - 30, center + 30, center + 30);
    centerMetalGrad.addColorStop(0, "#fffbeb");
    centerMetalGrad.addColorStop(0.3, "#f59e0b");
    centerMetalGrad.addColorStop(0.7, "#b45309");
    centerMetalGrad.addColorStop(1, "#fef08a");
    ctx.fillStyle = centerMetalGrad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.stroke();

    // 5.3 โดมทองคำ 3D โค้งนูนดึงดูดสายตา
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, 2 * Math.PI);
    const domeGrad = ctx.createRadialGradient(center - 6, center - 6, 0, center, center, 24);
    domeGrad.addColorStop(0, "#ffffff"); // แสงจ้าบนหน้าโค้งดุมทอง
    domeGrad.addColorStop(0.25, "#fffbeb"); // เหลืองอ่อนขัดเงา
    domeGrad.addColorStop(0.8, "#d97706"); // สีทองส้มเข้ม
    domeGrad.addColorStop(1, "#78350f"); // น้ำตาลขอบลึก
    ctx.fillStyle = domeGrad;
    ctx.fill();
    
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
    ctx.restore();

    // ================= 6. GLASS COVER DOME SHINE OVERLAY (แผ่นกระจกครอบใสโค้งสะท้อน แสงจ้าไม่หมุนตามล้อ) =================
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 11, 0, 2 * Math.PI);
    ctx.clip(); // ตรึงแสงสะท้อนจ้าให้อยู่ภายในวงกลมล้อเท่านั้น
    
    const glassGrad = ctx.createLinearGradient(center - radius, center - radius, center + radius, center + radius);
    glassGrad.addColorStop(0, "rgba(255,255,255,0.32)"); // แสงสะท้อนจ้าขอบบนซ้ายสุดชิค
    glassGrad.addColorStop(0.35, "rgba(255,255,255,0.08)");
    glassGrad.addColorStop(0.52, "rgba(255,255,255,0)"); // ไล่เฟดเงียบสนิทตรงกึ่งกลางบอร์ดล้อ
    glassGrad.addColorStop(0.85, "rgba(0,0,0,0)");
    glassGrad.addColorStop(1, "rgba(0,0,0,0.18)"); // เงาขอบล่างขวาเพิ่มความลึก 3D
    
    ctx.fillStyle = glassGrad;
    ctx.fill();
    ctx.restore();
  }

  let lightBlinkInterval = null;
  function startLightsAnimation() {
    if (lightBlinkInterval) clearInterval(lightBlinkInterval);
    lightBlinkInterval = setInterval(function() {
      if (!isSpinning && document.getElementById('lucky-spin-modal') && document.getElementById('lucky-spin-modal').style.display === 'flex') {
        drawLuckyWheel();
      }
    }, 250);
  }

  function triggerSpinWheel() {
    if (isSpinning) return;
    
    const userScore = Number(localStorage.getItem("userScore") || "0");
    if (userScore < 20) {
      showCustomAlert("คะแนนสะสมของคุณไม่เพียงพอสำหรับการหมุนวงล้อ (ใช้ 20 แต้ม, ปัจจุบันคุณมี " + userScore + " แต้ม)", "warning");
      return;
    }
    
    isSpinning = true;
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const spinBtn = document.getElementById('btn-spin-trigger');
    spinBtn.disabled = true;
    spinBtn.style.opacity = '0.6';
    spinBtn.style.cursor = 'default';
    
    // 1. เริ่มหมุนทันทีด้วยความเร็วคงที่เพื่อการตอบสนองที่รวดเร็วทันใจ (Instant Spin Loop)
    let lastTickCheck = currentWheelRotation;
    const sliceAngle = (2 * Math.PI) / 8;
    let baseSpeed = 0.22; // ความเร็วสูงสุดในการหมุนฟรี
    let spinPhase = "constant"; // สถานะ "constant" (หมุนฟรี), "decelerating" (กำลังเบรก), หรือ "error_braking" (เบรกฉุกเฉิน)
    
    let apiResolved = false;
    let apiError = false;
    let apiErrorMsg = "";
    let apiRes = null;
    
    // 2. ยิง API เบื้องหลังควบคู่ไปขณะที่วงล้อกำลังหมุนหมุนติ้วอย่างเริงร่า
    apiPost('spinLuckyWheel', withAuthData({}))
      .then(function(res) {
        if (res.status === 'success') {
          apiRes = res;
          apiResolved = true;
        } else {
          apiError = true;
          apiErrorMsg = res.message || "เกิดข้อผิดพลาดในการคำนวณแต้ม";
        }
      })
      .catch(function(err) {
        console.error(err);
        apiError = true;
        apiErrorMsg = "ล้มเหลวในการเชื่อมต่อระบบเซิร์ฟเวอร์";
      });
      
    // 3. ตัวลูปแอนิเมชันสำหรับอัปเดตองศาเฟรม (60 FPS Animation Frame Loop)
    let startDecelTime = 0;
    let startDecelRotation = 0;
    let decelDiff = 0;
    const decelDuration = 3500; // ระยะเวลาชะลอช้าลดความเร่ง (3.5 วินาที)
    
    function spinLoop(now) {
      if (spinPhase === "constant") {
        // หมุนฟรีด้วยความเร็วสม่ำเสมอ
        currentWheelRotation += baseSpeed;
        
        // เล่นเสียงปุ่มขอบเสียงติ๊ก
        const currentTickCheck = currentWheelRotation;
        const startSector = Math.floor(lastTickCheck / sliceAngle);
        const endSector = Math.floor(currentTickCheck / sliceAngle);
        if (startSector !== endSector) {
          playSynthTick();
          lastTickCheck = currentTickCheck;
        }
        
        drawLuckyWheel();
        
        if (apiResolved) {
          // ข้อมูลผลรางวัลมาถึงแล้ว เปลี่ยนมาเริ่มชะลอเพื่อหยุดนิ่ง (Deceleration Phase)
          spinPhase = "decelerating";
          startDecelTime = performance.now();
          startDecelRotation = currentWheelRotation;
          
          // คำนวณหาพิกัดองศาเป้าหมายตามช่องรางวัลที่แท้จริง
          const prizeIndex = apiRes.prizeIndex;
          const baseStopAngle = (1.5 * Math.PI) - (prizeIndex * sliceAngle) - (sliceAngle / 2);
          const randomOffset = (Math.random() - 0.5) * (sliceAngle * 0.6);
          const targetAngle = baseStopAngle + randomOffset;
          
          // หมุนเผื่อหน้าและชะลออย่างน้อยอีก 3 รอบเพื่อแอนิเมชันที่นุ่มนวลพรีเมียม
          const fullSpins = 3 + Math.floor(Math.random() * 2);
          const currentMod = startDecelRotation % (2 * Math.PI);
          let angleDiff = targetAngle - currentMod;
          if (angleDiff <= 0) {
            angleDiff += (2 * Math.PI);
          }
          const destinationRotation = startDecelRotation + (fullSpins * 2 * Math.PI) + angleDiff;
          decelDiff = destinationRotation - startDecelRotation;
        } else if (apiError) {
          // หากเบื้องหลังเกิดข้อผิดพลาดในการเรียกดึงแต้ม ให้เบรกวงล้ออย่างกระทันหัน (1 วินาที)
          spinPhase = "error_braking";
          startDecelTime = performance.now();
          startDecelRotation = currentWheelRotation;
          decelDiff = Math.PI * 2.5; // ค่อยๆชะลอหมุนต่ออีกไม่เกินรอบครึ่งแล้วเบรกสนิท
        }
        
        requestAnimationFrame(spinLoop);
        
      } else if (spinPhase === "decelerating") {
        // แฟคเตอร์ฟิสิกส์ชะลอความหนืด (Quintic Ease-Out Easing)
        const elapsed = now - startDecelTime;
        const t = Math.min(elapsed / decelDuration, 1);
        const ease = 1 - Math.pow(1 - t, 5);
        
        currentWheelRotation = startDecelRotation + decelDiff * ease;
        
        // เล่นเสียงติ๊กตามขอบช่องช้าลงตามอัตราหมุน
        const currentTickCheck = currentWheelRotation;
        const startSector = Math.floor(lastTickCheck / sliceAngle);
        const endSector = Math.floor(currentTickCheck / sliceAngle);
        if (startSector !== endSector) {
          playSynthTick();
          lastTickCheck = currentTickCheck;
        }
        
        drawLuckyWheel();
        
        if (t < 1) {
          requestAnimationFrame(spinLoop);
        } else {
          // หยุดนิ่งและประกาศผลรางวัลลุ้นระทึกอย่างสง่างาม
          currentWheelRotation = currentWheelRotation % (2 * Math.PI);
          isSpinning = false;
          spinBtn.disabled = false;
          spinBtn.style.opacity = '1';
          spinBtn.style.cursor = 'pointer';
          
          // ซิงก์คะแนนสุทธิหลังการใช้สอย
          localStorage.setItem("userScore", apiRes.newScore);
          document.getElementById('spin-user-score').innerText = apiRes.newScore;
          
          const profileScoreEl = document.getElementById('profile-score');
          if (profileScoreEl) profileScoreEl.innerText = apiRes.newScore;
          
          cacheProfile = null;
          cacheLeaderboard = null;
          
          const prizeLabel = apiRes.prizeLabel;
          const prizeType = apiRes.prizeType;
          
          if (prizeType === "points") {
            playSynthWin();
            showCustomAlert("🎉 ยินดีด้วย! คุณหมุนวงล้อได้รับแต้มสะสมเพิ่ม: " + prizeLabel, "success");
          } else if (prizeType === "coupon") {
            playSynthFanfare();
            showCustomAlert("👑 สุดยอดมาก! คุณหมุนวงล้อได้รับ: " + prizeLabel + "\nรหัสคูปองของคุณคือ: " + apiRes.couponCode + "\nคูปองของคุณถูกบันทึกในหน้ากระเป๋าเงินคูปองแล้ว!", "success");
          } else {
            playSynthLose();
            showCustomAlert("🍀 ขอบคุณที่ร่วมสนุกนะ! มาร่วมส่งกิจกรรมเรียนรู้เพื่อลุ้นรางวัลอีกครั้งหน้ากันเถอะ!", "info");
          }
        }
      } else if (spinPhase === "error_braking") {
        // การหยุดฉุกเฉินระดับเสี้ยววิในกรณีเกิดข้อผิดพลาดเน็ตหลุด/หรือแต้มไม่พอจริง
        const elapsed = now - startDecelTime;
        const t = Math.min(elapsed / 1000, 1);
        const ease = 1 - Math.pow(1 - t, 3); // Cubic Ease-Out เบรกด่วน
        
        currentWheelRotation = startDecelRotation + decelDiff * ease;
        drawLuckyWheel();
        
        if (t < 1) {
          requestAnimationFrame(spinLoop);
        } else {
          isSpinning = false;
          spinBtn.disabled = false;
          spinBtn.style.opacity = '1';
          spinBtn.style.cursor = 'pointer';
          showCustomAlert(apiErrorMsg, "error");
        }
      }
    }
    
    requestAnimationFrame(spinLoop);
  }

  window.openLuckySpinModal = openLuckySpinModal;
  window.closeLuckySpinModal = closeLuckySpinModal;
  window.triggerSpinWheel = triggerSpinWheel;
  window.drawLuckyWheel = drawLuckyWheel;
  window.startLightsAnimation = startLightsAnimation;

  window.openCouponWalletModal = openCouponWalletModal;
  window.closeCouponWalletModal = closeCouponWalletModal;
  window.switchWalletTab = switchWalletTab;
  window.loadUserCoupons = loadUserCoupons;
  window.loadUserPointsHistory = loadUserPointsHistory;
  window.copyCouponCode = copyCouponCode;

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
            <p class="text-theme-inv font-semibold text-sm mb-4">📸 เช็กอินแหล่งเรียนรู้สำเร็จเรียบร้อย!</p>
            <div class="p-3 rounded-xl text-left text-xs mb-3" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.5;">
              คุณได้เดินทางมาถึงสถานที่จริง และสแกนสถิติเสร็จสิ้น ระบบมอบแต้มสะสมพิเศษเข้าโปรไฟล์คุณทันที
            </div>
            <div class="inline-block px-4 py-1.5 rounded-full font-black text-white" style="background: linear-gradient(135deg, #10b981, #059669); font-size:0.85rem; box-shadow: 0 4px 10px rgba(16,185,129,0.3);">
              ได้รับ +20 แต้มสะสม 🪙
            </div>
          </div>`;
          
          showCustomAlert(message, "success", "เช็กอินสำเร็จ 🎖️");

          localStorage.setItem("userScore", res.newScore);
          const scoreEl = document.getElementById('profile-score');
          if (scoreEl) scoreEl.innerText = res.newScore;
          
          cacheProfile = null;
          cacheHistory = null;
          
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
    showLoading(true);
    apiPost('checkInActivity', withAuthData({ activityId: activityId }))
      .then(function(res) {
        showLoading(false);
        if (res.status === "success") {
          playSynthFanfare();
          
          const message = `<div class="text-center py-2">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style="background:#fbbf2422; border:2px solid #fbbf24; box-shadow: 0 0 16px rgba(251,191,36,0.6); animation: goldPulse 2s infinite ease-in-out;">
              <i class="fas fa-qrcode text-3xl" style="color:#fbbf24"></i>
            </div>
            <h4 class="font-black text-xl mb-2 text-theme-inv">${res.activityName}</h4>
            <p class="text-theme-inv font-semibold text-sm mb-4">🎟️ สแกนเข้าร่วมกิจกรรมสำเร็จเรียบร้อย!</p>
            <div class="p-3 rounded-xl text-left text-xs mb-3" style="background:var(--glass); border:1px solid var(--glass-border); line-height:1.5;">
              ยินดีต้อนรับเข้าสู่งานกิจกรรมการเรียนรู้ของ สกร. ทางระบบบันทึกความร่วมมือและมอบคะแนนให้คุณแล้ว
            </div>
            <div class="inline-block px-4 py-1.5 rounded-full font-black text-white" style="background: linear-gradient(135deg, #fbbf24, #d97706); font-size:0.85rem; box-shadow: 0 4px 10px rgba(217,119,6,0.3);">
              เช็กอินกิจกรรมสำเร็จ! 🪙
            </div>
          </div>`;
          
          showCustomAlert(message, "success", "เช็กอินกิจกรรม 🎖️");

          localStorage.setItem("userScore", res.newScore);
          const scoreEl = document.getElementById('profile-score');
          if (scoreEl) scoreEl.innerText = res.newScore;
          
          cacheProfile = null;
          cacheHistory = null;

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
      const escapedName = act.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const escapedCode = String(act.activityId).trim();
      
      html += `
        <div class="p-3 rounded-xl flex items-center justify-between transition-all"
             style="background: var(--glass); border: 1px solid var(--glass-border);">
          <div class="min-width:0; max-width:65%; text-align:left;">
            <h5 class="font-bold text-sm text-theme-inv mb-0.5 truncate">${act.name}</h5>
            <p class="text-xxs text-muted mb-1 truncate" style="margin: 0 0 4px;">${act.details || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
            <div class="flex items-center gap-1.5">
              <span class="user-badge" style="padding: 2px 6px; font-size: 0.65rem; background: linear-gradient(135deg, rgba(251,191,36,0.15), rgba(217,119,6,0.15)); border-color: rgba(251,191,36,0.3); color:#fbbf24;">
                รหัส: ${act.activityId}
              </span>
              <span class="user-badge" style="padding: 2px 6px; font-size: 0.65rem; background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.15)); border-color: rgba(16,185,129,0.3); color:#10b981;">
                +${act.points} แต้ม 🪙
              </span>
            </div>
          </div>
          
          <div class="flex gap-1.5">
            <button class="btn-primary" style="padding: 6px 8px; font-size: 0.75rem; border-radius: 8px; background: linear-gradient(135deg, var(--primary), var(--primary-dk));"
                    onclick="showActivityQRModal('${escapedCode}', '${escapedName}', ${act.points})">
              <i class="fas fa-qrcode"></i> QR
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
            <strong class="text-theme-inv">${coupon.pointsUsed} แต้ม 🪙</strong>
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

  window.loadUserBadges = loadUserBadges;
  window.viewBadgeDetail = viewBadgeDetail;

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
    startLightsAnimation();
    // โหลดหน้าแสดง OTOP Showcase & Wisdom Market (รองรับทั้งแบบฝังและแบบโหลด Asynchronous จากไฟล์แยก)
    const container = document.getElementById('market-page');
    if (container && !container.innerHTML.trim()) {
      fetch('market.html')
        .then(function(res) { return res.text(); })
        .then(function(html) {
          container.innerHTML = html;
        }).catch(function(err) { console.error('Failed to load OTOP market:', err); });
    }

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

    const savedPhone = localStorage.getItem("userPhone");
    
    if (savedPhone) {
      document.getElementById('header-user-name').innerText = localStorage.getItem("userName") || "User";
      updateNavByRole();
      
      // Parallel loading for better performance
      const qy = getCurrentQuarterAndYear();
      Promise.all([
        apiGet('getHomeData', { quarter: qy.quarter, year: qy.year }),
        apiGet('getSources', withAuthParams())
      ]).then(function(results) {
        const homeRes = results[0];
        const sourceRes = results[1];
        
        if (homeRes.status === "success") {
          cacheHomeData = homeRes;
        }
        if (Array.isArray(sourceRes)) {
          cacheSources = sourceRes;
        }
        
        // After pre-fetching, show page and render
        showPage('home-page');
      }).catch(function() {
        showPage('home-page');
      });
    } else {
      showPage('login-page');
    }
  };

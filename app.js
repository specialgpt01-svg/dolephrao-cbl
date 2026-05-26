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
    document.getElementById('nav-log').style.display = (role === "user") ? "flex" : "none";
    document.getElementById('nav-approve').style.display = (role === "teacher" || role === "admin") ? "flex" : "none";
    document.getElementById('nav-user-mgmt').style.display = (role === "teacher" || role === "admin") ? "flex" : "none";
    document.getElementById('nav-dashboard').style.display = (role === "teacher" || role === "admin") ? "flex" : "none";
    document.getElementById('nav-admin').style.display = (role === "admin" || role === "teacher") ? "flex" : "none";
  }

  function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(function(page) { page.style.display = 'none'; });
    document.getElementById(pageId).style.display = 'block';
    
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
      
      if(pageId === 'home-page' || pageId === 'detail-page') { document.getElementById('nav-home').classList.add('active'); if(pageId === 'home-page') loadHomePageData(); }
      if(pageId === 'map-page') { document.getElementById('nav-map').classList.add('active'); loadDistrictMap(); }
      if(pageId === 'leaderboard-page') { document.getElementById('nav-leaderboard').classList.add('active'); loadLeaderboard(); }
      if(pageId === 'profile-page') { document.getElementById('nav-profile').classList.add('active'); loadProfileData(); }
      
      if(pageId === 'log-page') { document.getElementById('nav-log').classList.add('active'); loadMyLogs(1); }
      if(pageId === 'approve-page') { document.getElementById('nav-approve').classList.add('active'); loadPendingLogs(); }
      if(pageId === 'user-mgmt-page') { document.getElementById('nav-user-mgmt').classList.add('active'); loadUserMgmt(); }
      if(pageId === 'dashboard-page') { document.getElementById('nav-dashboard').classList.add('active'); loadDashboard(); }
      if(pageId === 'proposal-page') { loadUserProposals(); }
      if(pageId === 'admin-page') {
        const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
        if (role !== "admin" && role !== "teacher") {
          showCustomAlert("หน้านี้สำหรับผู้ดูแลระบบ/ครูประจำตำบลเท่านั้น", "warning");
          return showPage('home-page');
        }
        document.getElementById('nav-admin').classList.add('active');
        
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
    renderUserMgmtList(fullUserList);
  }

  let fullUserList = [];
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
        renderUserMgmtList(fullUserList);
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
      const imgUrl = u.profileImage || 'https://via.placeholder.com/150';

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
    const filtered = fullUserList.filter(function(u) {
      return u.fullName.toLowerCase().includes(query) || u.username.includes(query);
    });
    renderUserMgmtList(filtered);
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
            html += '<div class="rank-card" style="border-left: 6px solid ' + rStyle.color + '; background: linear-gradient(to right, white, #fcfcfc);">' +
                       '<div class="rank-number" style="color: ' + rStyle.color + '; width:50px; font-weight:900; font-size:1.3rem;">' + (index + 1) + '</div>' +
                       '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="rank-img" style="border: 3px solid ' + rStyle.color + ';">' +
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
      options += '<option value="' + item.SourceID + '">' + item.SourceID + ' - ' + item.SourceName + ' (ต.' + item.TambonName + ')</option>';
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
      options += '<option value="' + item.SourceID + '">' + item.SourceID + ' - ' + item.SourceName + ' (ต.' + item.TambonName + ')</option>';
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
     
     // สำหรับตำบลทั่วไป ให้เติม ต. นำหน้า (ถ้ายังไม่มี)
     return "ต." + name;
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
    document.getElementById('detail-tambon').innerText = sourceData.TambonName;
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
      
      let scoreBadgeStyle = (rankNum === 1) ? '' : 'style="background:' + rStyle.color + ';"';
      
      html += '<div class="podium-item rank-' + rankNum + '">' +
                '<div class="podium-avatar-wrapper">' +
                  '<i class="fas fa-crown crown-icon"></i>' + 
                  '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="podium-img" style="border-color:' + rStyle.color + ';">' +
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

      html += '<div class="rank-card" style="margin-bottom: 8px; padding: 10px 15px; border-left: 4px solid ' + rStyle.color + ';">' +
                 '<div class="rank-number" style="font-size: 1.1rem; width: 30px; color: #7f8c8d;">' + rankNum + '</div>' +
                 '<img src="' + imgUrl + '" loading="lazy" onerror="this.onerror=null; this.src=\'' + defaultImg + '\';" class="rank-img" style="width: 40px; height: 40px; margin: 0 10px;">' +
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

  function renderProfileUI(me) {
      let rStyle = getRankStyle(me.level);
      
      // สร้างป้ายสวยๆ ไว้เติมต่อท้ายชื่อ
      let badgeHtml = '<span style="background:' + rStyle.color + '; color:white; font-size:0.6rem; padding:3px 8px; border-radius:12px; vertical-align:middle; margin-left:8px; display:inline-block;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title + '</span>';
      
      // เซ็ตข้อมูลและใช้ data-rawname เก็บชื่อจริงเพื่อไม่ให้ป้ายติดไปโชว์ในเกียรติบัตร
      const nameEl = document.getElementById('profile-name');
      nameEl.innerHTML = (me.fullname || "ไม่ระบุชื่อ") + badgeHtml;
      nameEl.setAttribute('data-rawname', me.fullname || "ไม่ระบุชื่อ");

      document.getElementById('profile-tambon').innerText = me.tambon || "ไม่ระบุ";
      document.getElementById('profile-level').innerHTML = '<span style="color:' + rStyle.color + '; font-weight:bold;"><i class="fas ' + rStyle.icon + '"></i> ' + rStyle.title + '</span>';
      document.getElementById('profile-score').innerText = me.totalscore || "0";
      
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
          // ถ้ายังไม่อนุมัติ หรือถูกปฏิเสธ ให้ใช้รูป Placeholder
          profileImg.style.backgroundImage = "url('https://via.placeholder.com/150')";
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
        profileImg.style.backgroundImage = "url('https://via.placeholder.com/150')";
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
    const inputs = ['imageUpload', 'admin-source-cover-file', 'admin-base-cover-file', 'admin-featured-image-file'];
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

  window.onload = function() {
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

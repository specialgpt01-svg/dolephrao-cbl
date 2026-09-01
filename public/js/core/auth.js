function handleRegister() {
  const fullName = (document.getElementById('reg-fullname').value || '').trim();
  const phone = (document.getElementById('reg-phone').value || '').trim();
  const tambon = (document.getElementById('reg-tambon').value || '').trim();
  const userCategoryEl = document.getElementById('reg-user-category');
  const userCategory = userCategoryEl ? (userCategoryEl.value || 'ประชาชนทั่วไป').trim() : 'ประชาชนทั่วไป';
  const ageGroupEl = document.getElementById('reg-age-group');
  const ageGroup = ageGroupEl ? (ageGroupEl.value || '').trim() : '';
  const occupationEl = document.getElementById('reg-occupation');
  const occupation = occupationEl ? (occupationEl.value || '').trim() : '';
  const password = document.getElementById('reg-password').value || '';

  const instEl = document.getElementById('reg-institution');
  const instId = instEl ? (instEl.value || 'INS_PHRAO').trim() : 'INS_PHRAO';

  if(!fullName || !phone || !tambon || !password) return showCustomAlert("กรุณากรอกข้อมูลและเลือกตำบลให้ครบถ้วน", "warning");

  showLoading(true);
  apiPost('register', withAuthData({
    fullName: fullName,
    phone: phone,
    tambon: tambon,
    userCategory: userCategory,
    ageGroup: ageGroup,
    occupation: occupation,
    password: password,
    institutionId: instId
  }))
    .then(function(res) {
      showLoading(false);
      if(res.status === "success") { showCustomAlert("สมัครสมาชิกสำเร็จ!", "success"); showPage('login-page'); }
      else { showCustomAlert(res.message, "error"); }
    }).catch(function() { showLoading(false); showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
}

function onRegInstitutionChange() {
  const instEl = document.getElementById('reg-institution');
  const tambonEl = document.getElementById('reg-tambon');
  const instId = instEl ? instEl.value : 'INS_PHRAO';

  if (tambonEl) {
    const subUnits = typeof getSubUnitsForInstitution === 'function' 
      ? getSubUnitsForInstitution(instId) 
      : (window.INSTITUTION_SUB_UNITS_MAP ? (window.INSTITUTION_SUB_UNITS_MAP[instId] || []) : []);
    
    let html = '<option value="">— เลือกสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.) —</option>';
    subUnits.forEach(function(u) {
      html += '<option value="' + u + '">' + u + '</option>';
    });
    tambonEl.innerHTML = html;
  }
}
window.onRegInstitutionChange = onRegInstitutionChange;

function handleLogin() {
  const loginInput = (document.getElementById('login-phone').value || '').trim();
  const password = (document.getElementById('login-password').value || '').trim();
  if(!loginInput || !password) return showCustomAlert("กรุณากรอกเบอร์โทรหรือชื่อผู้ใช้ และรหัสผ่านให้ครบครับ", "warning");

  showLoading(true);
  apiPost('login', { phone: loginInput, username: loginInput, password: password })
    .then(function(res) {
      showLoading(false);
      if(res.status === "success") {
        const token = res.token || "";
        const uPhone = res.user.phone || res.user.username || loginInput;
        const uName = res.user.fullName || res.user.name || res.user.full_name || "";
        const uRole = String(res.user.role || "user").trim().toLowerCase();
        const uTambon = res.user.tambon || "";
        const userInstVal = res.user.institutionId || res.user.institution_id || "INS_PHRAO";
        const uScore = String(res.user.score || "0");

        localStorage.setItem("authToken", token);
        localStorage.setItem("nfe_auth_token", token);
        localStorage.setItem("userPhone", uPhone);
        localStorage.setItem("userName", uName);
        localStorage.setItem("userRole", uRole);
        localStorage.setItem("userTambon", uTambon);
        localStorage.setItem("userInstitution", userInstVal);
        localStorage.setItem("userInstitutionId", userInstVal);
        localStorage.setItem("nfe_selected_institution", userInstVal);
        localStorage.setItem("nfe_user", JSON.stringify(res.user || {}));
        localStorage.setItem("userData", JSON.stringify(res.user || {}));
        localStorage.setItem("userScore", uScore);

        const headerUserName = document.getElementById('header-user-name');
        if (headerUserName) {
          headerUserName.innerText = uName || uPhone;
        }
        if (typeof updateNavByRole === 'function') updateNavByRole();
        if (typeof initResponsiveNav === 'function') initResponsiveNav();
        if (typeof applyRoleNavAdaptation === 'function') applyRoleNavAdaptation();
        
        if (typeof checkMustChangePassword === 'function' && (res.user.mustChangePassword || res.user.passwordResetRequired)) {
          checkMustChangePassword(res.user);
        } else {
          showPage('home-page');
        }
      } else { showCustomAlert((res && res.message) || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', "error"); }
    }).catch(function(err) { showLoading(false); showCustomAlert((err && err.message) || "เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); });
}

function isSuperAdminUser() {
  const role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
  const inst = String(localStorage.getItem("userInstitution") || "").trim().toUpperCase();
  const phone = String(localStorage.getItem("userPhone") || "").trim();
  return role === 'admin' && (inst === 'ALL' || inst === 'ทั้งหมด' || phone === '1');
}
window.isSuperAdminUser = isSuperAdminUser;

function clearAllAuthData() {
  try {
    apiPost('logout', {}).catch(function() {});
  } catch(e) {}

  const authKeys = [
    "userPhone", "authToken", "nfe_auth_token", "userName", "userRole",
    "userTambon", "userScore", "userNFEHours", "userInstitution",
    "userInstitutionId", "nfe_selected_institution", "nfe_user", "userData"
  ];
  authKeys.forEach(function(k) {
    try { localStorage.removeItem(k); } catch(e) {}
  });

  cacheSources = null;
  cacheMapSources = null;
  cacheLeaderboard = null;
  cacheProfile = null;
  cacheHistory = null;
  cacheHomeData = null;
  cacheProposals = null;
  allMarketProducts = [];
  cacheMarketProducts = null;

  if (typeof applyRoleNavAdaptation === "function") {
    applyRoleNavAdaptation();
  }
}
window.clearAllAuthData = clearAllAuthData;

function logout() {
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm({
      title: 'ออกจากระบบ',
      message: 'คุณต้องการออกจากระบบ ใช่หรือไม่?',
      type: 'logout',
      icon: 'fa-sign-out-alt',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก'
    }, function() {
      logoutNoConfirm();
    });
  } else if (confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
    logoutNoConfirm();
  }
}
window.logout = logout;

function enterAsGuest() {
  clearAllAuthData();

  localStorage.setItem("userPhone", "guest");
  localStorage.setItem("userName", "บุคคลทั่วไป");
  localStorage.setItem("userRole", "guest");
  localStorage.setItem("userTambon", "");
  localStorage.setItem("userScore", "0");
  localStorage.setItem("userNFEHours", "0");
  localStorage.setItem("userInstitution", "INS_PHRAO");
  localStorage.setItem("userInstitutionId", "INS_PHRAO");
  localStorage.setItem("nfe_selected_institution", "INS_PHRAO");
  
  const headerName = document.getElementById('header-user-name');
  if (headerName) {
    headerName.innerText = "บุคคลทั่วไป";
  }
  
  if (typeof updateNavByRole === "function") {
    updateNavByRole();
  }
  if (typeof applyRoleNavAdaptation === "function") {
    applyRoleNavAdaptation();
  }
  
  showLoading(true);
  const qy = typeof getCurrentQuarterAndYear === "function" ? getCurrentQuarterAndYear() : { quarter: 1, year: 2026 };
  apiGet('getHomeData', { quarter: qy.quarter, year: qy.year })
    .then(function(homeRes) {
      showLoading(false);
      if (homeRes && homeRes.status === "success") {
        cacheHomeData = homeRes;
      }
      showPage('home-page');
    })
    .catch(function() {
      showLoading(false);
      showPage('home-page');
    });
}

function logoutNoConfirm() {
  clearAllAuthData();
  const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase().split('?')[0].split('#')[0];
  if (currentFile === 'profile.html') {
    if (typeof loadUserProfile === 'function') {
      loadUserProfile();
    } else {
      window.location.reload();
    }
  } else {
    window.location.href = 'profile.html';
  }
}
window.logoutNoConfirm = logoutNoConfirm;

/**
 * ปรับเปลี่ยนเมนูและการนำทางตาม Role ของผู้ใช้งาน
 * - ผู้เรียน/บุคคลทั่วไป: แสดงเมนู "📷 สแกน" (scan.html)
 * - แอดมิน/ครู (Admin, Teacher, Staff): ซ่อนสแกน เปลี่ยนเป็น "🎯 กิจกรรม QR" (events-admin.html) เพื่อสร้างกิจกรรมและเปิด QR ให้ผู้เรียนเช็กอิน
 */
function applyRoleNavAdaptation() {
  try {
    const rawRole = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
    const isAdminOrTeacher = (rawRole === 'admin' || rawRole === 'teacher' || rawRole === 'staff');

    // 1. Mobile Bottom Navigation: เปลี่ยนปุ่มสแกน
    const bottomNavs = document.querySelectorAll('.fixed.bottom-0, .mobile-bottom-nav, div[class*="fixed bottom-0"]');
    bottomNavs.forEach(function(nav) {
      const scanLinks = nav.querySelectorAll('a[href*="scan.html"], a[data-nav="scan"], a[href*="events-admin.html"]');
      scanLinks.forEach(function(el) {
        if (isAdminOrTeacher) {
          el.href = 'events-admin.html';
          el.setAttribute('title', 'จัดการกิจกรรม & QR เช็กอิน');
          const span = el.querySelector('span');
          if (span) span.textContent = 'กิจกรรม QR';
          const icon = el.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-bullhorn text-base text-emerald-400';
          }
        } else {
          el.href = 'scan.html';
          el.setAttribute('title', 'สแกน QR Code');
          const span = el.querySelector('span');
          if (span) span.textContent = 'สแกน';
          const icon = el.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-qrcode text-base';
          }
        }
      });
    });

    // 2. Top Header Scan buttons (ปุ่มสแกนด่วนบนแถบหัวเว็บ)
    const headerScanBtns = document.querySelectorAll('header a[href*="scan.html"], header a[href*="events-admin.html"], .header-scan-btn');
    headerScanBtns.forEach(function(el) {
      if (isAdminOrTeacher) {
        el.href = 'events-admin.html';
        el.setAttribute('title', 'จัดการกิจกรรมและสร้าง QR เช็กอิน');
        const span = el.querySelector('span');
        if (span) span.textContent = 'กิจกรรม QR';
        const icon = el.querySelector('i');
        if (icon) icon.className = 'fas fa-bullhorn';
        el.classList.remove('bg-amber-500/20', 'text-amber-300', 'border-amber-500/30', 'border-amber-500/40');
        el.classList.add('bg-emerald-600/20', 'text-emerald-300', 'border-emerald-500/30');
      } else {
        el.href = 'scan.html';
        el.setAttribute('title', 'สแกน QR Code');
        const span = el.querySelector('span');
        if (span) span.textContent = 'สแกน';
        const icon = el.querySelector('i');
        if (icon) icon.className = 'fas fa-qrcode';
        el.classList.remove('bg-emerald-600/20', 'text-emerald-300', 'border-emerald-500/30');
        el.classList.add('bg-amber-500/20', 'text-amber-300', 'border-amber-500/30');
      }
    });

    // 3. Hero Scan Buttons (หน้าหลัก index.html)
    const heroScanBtns = document.querySelectorAll('.hero-scan-btn, a[href="scan.html"].hero-btn');
    heroScanBtns.forEach(function(el) {
      if (isAdminOrTeacher) {
        el.href = 'events-admin.html';
        el.innerHTML = '<i class="fas fa-bullhorn mr-1.5"></i> สร้างกิจกรรมเช็กอิน';
        el.classList.remove('bg-amber-500/20', 'text-amber-300', 'border-amber-500/40');
        el.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/40');
      }
    });

    // 4. แจ้งเตือนบนหน้า scan.html (หาก Admin/Teacher เข้ามา)
    const adminScanNotice = document.getElementById('admin-teacher-scan-banner');
    if (adminScanNotice) {
      if (isAdminOrTeacher) {
        adminScanNotice.style.display = 'flex';
      } else {
        adminScanNotice.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('applyRoleNavAdaptation error:', err);
  }
}
window.applyRoleNavAdaptation = applyRoleNavAdaptation;

// เรียกทำงานอัตโนมัติทันทีที่ DOM พร้อม
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyRoleNavAdaptation);
} else {
  applyRoleNavAdaptation();
}

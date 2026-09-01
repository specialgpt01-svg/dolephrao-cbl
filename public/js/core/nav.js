/**
 * PHRAO LEARNING DISTRICT - Global Responsive Navigation Engine
 * Provides Universal Desktop Left Sidebar, Mobile Bottom Navigation, Role Separation & Page Auth Guard.
 */

(function() {
  // Navigation Menu Definitions
  const NAV_GROUPS = [
    {
      heading: 'หลักสูตรและการเรียนรู้',
      items: [
        { href: 'index.html', icon: 'fa-home', label: 'หน้าแรก', badge: '' },
        { href: 'learning.html', icon: 'fa-book-open', label: 'แหล่งเรียนรู้ & กิจกรรม', badge: 'ผู้เรียน' },
        { href: 'map.html', icon: 'fa-map-marked-alt', label: 'แผนที่แหล่งเรียนรู้', badge: '' },
        { href: 'scan.html', icon: 'fa-qrcode', label: 'สแกน QR Code', badge: '' },
        { href: 'market.html', icon: 'fa-store', label: 'ตลาดสินค้าชุมชน OTOP', badge: '' },
        { href: 'upskill.html', icon: 'fa-graduation-cap', label: 'พัฒนาทักษะ Upskill', badge: '' },
        { href: 'profile.html', icon: 'fa-user-circle', label: 'โปรไฟล์ & เกียรติบัตร', badge: '' }
      ]
    },
    {
      heading: 'ระบบจัดการ (Admin & ครู)',
      adminOnly: true,
      items: [
        { href: 'sources.html', icon: 'fa-layer-group', label: 'จัดการหลักสูตร (ม.6)', badge: 'Admin' },
        { href: 'bases.html', icon: 'fa-cubes', label: 'จัดการฐานการเรียนรู้', badge: '' },
        { href: 'quizzes.html', icon: 'fa-clipboard-question', label: 'จัดการแบบทดสอบ', badge: '' },
        { href: 'activities-admin.html', icon: 'fa-award', label: 'ตรวจกิจกรรม & กพช.', badge: '' },
        { href: 'events-admin.html', icon: 'fa-calendar-days', label: 'ปฏิทินกิจกรรม', badge: '' },
        { href: 'market-admin.html', icon: 'fa-boxes-packing', label: 'จัดการตลาดสินค้า', badge: '' },
        { href: 'upskill-admin.html', icon: 'fa-chalkboard-user', label: 'จัดการคอร์ส Upskill', badge: '' },
        { href: 'users.html', icon: 'fa-users-gear', label: 'จัดการผู้ใช้งาน / นักศึกษา', badge: '' },
        { href: 'approvals.html', icon: 'fa-circle-check', label: 'ตรวจสอบและอนุมัติ', badge: '' },
        { href: 'cert-registry.html', icon: 'fa-file-signature', label: 'ทะเบียนคุมเกียรติบัตร', badge: 'ใหม่' },
        { href: 'cert-editor.html', icon: 'fa-certificate', label: 'ออกแบบเกียรติบัตร', badge: '' },
        { href: 'stats.html', icon: 'fa-chart-pie', label: 'รายงานสถิติภาพรวม', badge: '' },
        { href: 'institutions.html', icon: 'fa-school', label: 'สถานศึกษา / ศศช.', badge: '', superAdminOnly: true },
        { href: 'settings.html', icon: 'fa-sliders', label: 'ตั้งค่าระบบ', badge: '', superAdminOnly: true }
      ]
    }
  ];

  // Mobile Bottom Navigation items
  const MOBILE_NAV_ITEMS = [
    { href: 'index.html', icon: 'fa-home', label: 'หน้าแรก' },
    { href: 'map.html', icon: 'fa-map-marked-alt', label: 'แผนที่' },
    { href: 'learning.html', icon: 'fa-book-open', label: 'เรียนรู้' },
    { href: 'scan.html', icon: 'fa-qrcode', label: 'สแกน' },
    { href: 'market.html', icon: 'fa-store', label: 'ตลาด' },
    { href: 'profile.html', icon: 'fa-user', label: 'โปรไฟล์' }
  ];

  // Admin and Super Admin Protected Pages
  const ADMIN_PAGES = [
    'sources.html',
    'bases.html',
    'quizzes.html',
    'activities-admin.html',
    'events-admin.html',
    'market-admin.html',
    'upskill-admin.html',
    'users.html',
    'user-mgmt.html',
    'institutions.html',
    'approvals.html',
    'cert-registry.html',
    'cert-editor.html',
    'stats.html',
    'settings.html',
    'admin.html'
  ];

  const SUPER_ADMIN_ONLY_PAGES = [
    'settings.html',
    'institutions.html'
  ];

  // Injected CSS Styles for Universal Responsive Navigation & Auth Guards
  const SIDEBAR_CSS = `
    /* Desktop Sidebar Layout */
    .desktop-sidebar {
      width: 260px !important;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s ease;
    }
    .app-main-layout {
      transition: padding-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    body.sidebar-collapsed .desktop-sidebar .sidebar-label,
    body.sidebar-collapsed .desktop-sidebar .sidebar-heading,
    body.sidebar-collapsed .desktop-sidebar .sidebar-user-info,
    body.sidebar-collapsed .desktop-sidebar .sidebar-badge,
    body.sidebar-collapsed .desktop-sidebar .sidebar-brand-text,
    body.sidebar-collapsed .desktop-sidebar .sidebar-expanded-only {
      display: none !important;
    }
    body.sidebar-collapsed .desktop-sidebar .sidebar-collapsed-only {
      display: flex !important;
    }
    body:not(.sidebar-collapsed) .desktop-sidebar .sidebar-collapsed-only {
      display: none !important;
    }
    body.sidebar-collapsed .desktop-sidebar .sidebar-item {
      justify-content: center !important;
      padding-left: 0.5rem !important;
      padding-right: 0.5rem !important;
    }
    
    @media (min-width: 1024px) {
      body {
        padding-left: 260px !important;
        transition: padding-left 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      body.sidebar-collapsed {
        padding-left: 76px !important;
      }
      .app-main-layout {
        padding-left: 0 !important;
      }
      body.sidebar-collapsed .app-main-layout {
        padding-left: 0 !important;
      }
      body.sidebar-collapsed .desktop-sidebar {
        width: 76px !important;
      }
      #app-mobile-bottom-nav {
        display: none !important;
      }
      #app-desktop-sidebar {
        display: flex !important;
      }
    }
    @media (max-width: 1023px) {
      body {
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px)) !important;
      }
      body.sidebar-collapsed {
        padding-left: 0 !important;
      }
      .app-main-layout {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      body.sidebar-collapsed .app-main-layout {
        padding-left: 0 !important;
      }
      #app-desktop-sidebar {
        display: none !important;
      }
      #app-mobile-bottom-nav {
        display: flex !important;
      }
    }

    /* Auth Guard Overlay */
    .app-auth-guard-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: rgba(11, 19, 43, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
    }
    .app-auth-guard-card {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 1.75rem;
      padding: 2rem;
      max-width: 28rem;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      animation: authGuardPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes authGuardPop {
      0% { opacity: 0; transform: scale(0.92); }
      100% { opacity: 1; transform: scale(1); }
    }
  `;

  function injectFontAwesome() {
    if (!document.querySelector('link[href*="font-awesome"]') && !document.querySelector('link[href*="fontawesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }

  function injectSidebarStyles() {
    if (document.getElementById('phrao-nav-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'phrao-nav-styles';
    styleEl.innerHTML = SIDEBAR_CSS;
    document.head.appendChild(styleEl);
  }

  function getCurrentFilename() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
    return filename.toLowerCase().split('?')[0].split('#')[0];
  }

  function getUserInfo() {
    let userName = localStorage.getItem('userName') || 'ผู้เยี่ยมชม';
    let userRole = (localStorage.getItem('userRole') || 'guest').toLowerCase();
    let userPhone = localStorage.getItem('userPhone') || '';
    let userTambon = localStorage.getItem('userTambon') || '';
    let userInstitution = localStorage.getItem('userInstitution') || localStorage.getItem('userInstitutionId') || 'INS_PHRAO';
    let token = localStorage.getItem('authToken') || localStorage.getItem('nfe_auth_token') || '';

    try {
      const userData = JSON.parse(localStorage.getItem('userData') || localStorage.getItem('nfe_user') || '{}');
      if (userData.fullName || userData.name) userName = userData.fullName || userData.name;
      if (userData.role) userRole = String(userData.role).toLowerCase();
      if (userData.phone) userPhone = userData.phone;
      if (userData.tambon) userTambon = userData.tambon;
      if (userData.institutionId || userData.institution_id) userInstitution = userData.institutionId || userData.institution_id;
    } catch(e) {}

    // Normalize guest state if no valid token
    if (!token) {
      userRole = 'guest';
    }

    const isSuperAdmin = ['admin', 'superadmin', 'super_admin'].includes(userRole);
    const isTeacher = ['teacher', 'officer', 'staff'].includes(userRole);
    const isAdmin = isSuperAdmin || isTeacher;
    const isLearner = userRole === 'user';
    const isGuest = userRole === 'guest' || !token;

    return { userName, userRole, userPhone, userTambon, userInstitution, isAdmin, isSuperAdmin, isTeacher, isLearner, isGuest, token };
  }

  function renderDesktopSidebar() {
    const currentFile = getCurrentFilename();
    const user = getUserInfo();

    let sidebarEl = document.getElementById('app-desktop-sidebar');
    if (!sidebarEl) {
      sidebarEl = document.createElement('aside');
      sidebarEl.id = 'app-desktop-sidebar';
      sidebarEl.className = 'desktop-sidebar fixed top-0 left-0 bottom-0 z-40 bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-xl flex flex-col justify-between hidden lg:flex shadow-2xl custom-scrollbar overflow-y-auto overflow-x-hidden select-none';
      document.body.prepend(sidebarEl);
    }

    let navGroupsHtml = '';
    NAV_GROUPS.forEach(group => {
      // Hide admin group completely if user is NOT admin or teacher
      if (group.adminOnly && !user.isAdmin) return;

      let itemsHtml = '';
      group.items.forEach(item => {
        // Hide super admin only items from teachers
        if (item.superAdminOnly && !user.isSuperAdmin) return;

        const isActive = (item.href.toLowerCase() === currentFile) || 
                         (item.href === 'learning.html' && currentFile === 'learning.html') ||
                         (item.href === 'sources.html' && currentFile === 'sources.html');

        const activeClass = isActive 
          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm font-bold' 
          : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-medium';
        const iconBg = isActive ? 'bg-sky-500/30 text-sky-300' : 'bg-slate-800 text-slate-400 group-hover:text-sky-400 group-hover:bg-slate-700';

        itemsHtml += `
          <a href="${item.href}" class="sidebar-item flex items-center gap-3 px-3.5 py-2 rounded-2xl text-xs transition group ${activeClass}" title="${item.label}">
            <div class="w-7 h-7 rounded-xl ${iconBg} flex items-center justify-center text-xs shrink-0 transition">
              <i class="fas ${item.icon}"></i>
            </div>
            <span class="sidebar-label flex-1 truncate">${item.label}</span>
            ${isActive ? `<span class="sidebar-badge px-2 py-0.5 rounded-full text-[9px] font-black bg-sky-500 text-slate-950">Active</span>` : (item.badge ? `<span class="sidebar-badge px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">${item.badge}</span>` : '')}
          </a>
        `;
      });

      if (!itemsHtml) return;

      navGroupsHtml += `
        <div class="space-y-1">
          <div class="sidebar-heading px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
            ${group.heading}
          </div>
          <nav class="space-y-1">
            ${itemsHtml}
          </nav>
        </div>
      `;
    });

    let roleBadge = '👤 ผู้เยี่ยมชม (Guest)';
    if (user.isSuperAdmin) roleBadge = '👑 Super Admin';
    else if (user.isTeacher) roleBadge = '👨‍🏫 คุณครู (Teacher)';
    else if (user.isLearner) roleBadge = '🎓 ผู้เรียน (Learner)';

    sidebarEl.innerHTML = `
      <!-- Top Header & Brand -->
      <div>
        <div class="h-16 px-3 flex items-center justify-between border-b border-slate-800/80 shrink-0 relative">
          <!-- Expanded State -->
          <div class="sidebar-expanded-only flex items-center justify-between w-full min-w-0">
            <a href="index.html" class="flex items-center gap-2.5 min-w-0 group" title="กลับหน้าแรก">
              <div class="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 flex items-center justify-center text-white text-base shadow-md shadow-sky-500/25 shrink-0 group-hover:scale-105 transition-transform">
                <i class="fas fa-landmark"></i>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-black text-white truncate leading-tight tracking-wide">PHRAO DISTRICT</div>
                <div class="text-[10px] text-sky-400 font-bold truncate">สกร.อำเภอพร้าว</div>
              </div>
            </a>
            <button type="button" onclick="window.toggleDesktopSidebar()" id="sidebar-toggle-btn" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white flex items-center justify-center text-xs transition shrink-0 cursor-pointer shadow border border-slate-700 active:scale-95" title="ย่อแถบเมนู (Collapse Sidebar)">
              <i class="fas fa-chevron-left"></i>
            </button>
          </div>

          <!-- Collapsed State (Centered Expand Button) -->
          <div class="sidebar-collapsed-only w-full flex items-center justify-center">
            <button type="button" onclick="window.toggleDesktopSidebar()" class="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-800/90 hover:from-sky-600 hover:to-teal-600 text-sky-400 hover:text-white flex items-center justify-center text-base transition-all duration-200 cursor-pointer shadow-lg border border-slate-700 hover:border-sky-400 hover:scale-105 active:scale-95" title="ขยายแถบเมนู (Expand Sidebar)">
              <i class="fas fa-bars"></i>
            </button>
          </div>
        </div>

        <!-- Nav Links Menu -->
        <div class="p-2.5 space-y-3">
          ${navGroupsHtml}
        </div>
      </div>

      <!-- Bottom User Profile Footer -->
      <div class="p-2.5 border-t border-slate-800/80 bg-slate-950/60 shrink-0 space-y-1.5">
        <div class="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-slate-800/60 transition group">
          <a href="profile.html" class="flex items-center gap-2.5 flex-1 min-w-0 justify-center lg:justify-start" title="ดูโปรไฟล์ / เข้าสู่ระบบ">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-teal-500 text-slate-950 font-black flex items-center justify-center text-xs shrink-0 shadow">
              <i class="fas ${user.isAdmin ? 'fa-user-shield' : 'fa-user'}"></i>
            </div>
            <div class="sidebar-user-info min-w-0 flex-1">
              <div class="text-xs font-bold text-white truncate group-hover:text-sky-300 transition">${escapeHtml(user.userName)}</div>
              <div class="text-[10px] text-slate-400 truncate">${roleBadge}</div>
            </div>
          </a>
          ${user.token || (!user.isGuest && user.userPhone !== 'guest') ? `
            <button type="button" onclick="if(typeof logout==='function'){ logout(); } else if(typeof showCustomConfirm==='function'){ showCustomConfirm({ title: 'ออกจากระบบ', message: 'คุณต้องการออกจากระบบ ใช่หรือไม่?', type: 'logout' }, () => { clearAllAuthData(); window.location.href='profile.html'; }); } else { if(confirm('คุณต้องการออกจากระบบหรือไม่?')){ clearAllAuthData(); window.location.href='profile.html'; } }" class="sidebar-expanded-only w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 flex items-center justify-center text-xs transition shrink-0 cursor-pointer" title="ออกจากระบบ (Logout)">
              <i class="fas fa-sign-out-alt text-xs"></i>
            </button>
          ` : `
            <a href="profile.html" class="sidebar-expanded-only px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 text-[10px] font-bold transition shrink-0 flex items-center gap-1" title="เข้าสู่ระบบ">
              <i class="fas fa-sign-in-alt"></i> เข้าสู่ระบบ
            </a>
          `}
        </div>
      </div>
    `;
  }

  function renderMobileBottomNav() {
    const currentFile = getCurrentFilename();
    let mobileNavEl = document.getElementById('app-mobile-bottom-nav');
    if (!mobileNavEl) {
      mobileNavEl = document.createElement('nav');
      mobileNavEl.id = 'app-mobile-bottom-nav';
      mobileNavEl.className = 'fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 lg:hidden flex items-center justify-around py-2 px-1 text-[10px] font-bold text-slate-400 shadow-2xl';
      mobileNavEl.style.paddingBottom = 'calc(0.5rem + env(safe-area-inset-bottom, 0px))';
      document.body.appendChild(mobileNavEl);
    }

    let itemsHtml = '';
    MOBILE_NAV_ITEMS.forEach(item => {
      const isActive = item.href.toLowerCase() === currentFile || 
                      (item.href === 'learning.html' && (currentFile === 'sources.html' || currentFile === 'bases.html'));
      const activeClass = isActive ? 'text-sky-400 font-black' : 'hover:text-slate-200';

      itemsHtml += `
        <a href="${item.href}" class="flex flex-col items-center gap-1 transition ${activeClass}">
          <i class="fas ${item.icon} text-base"></i>
          <span>${item.label}</span>
        </a>
      `;
    });

    mobileNavEl.innerHTML = itemsHtml;
  }

  function wrapMainLayout() {
    let mainLayout = document.querySelector('.app-main-layout');
    if (!mainLayout) {
      const sidebar = document.getElementById('app-desktop-sidebar');
      const bottomNav = document.getElementById('app-mobile-bottom-nav');
      
      const wrapper = document.createElement('div');
      wrapper.className = 'app-main-layout w-full min-h-screen';
      
      const nodesToWrap = [];
      document.body.childNodes.forEach(node => {
        if (node !== sidebar && node !== bottomNav && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE' && !node.classList?.contains('app-auth-guard-overlay')) {
          nodesToWrap.push(node);
        }
      });
      
      nodesToWrap.forEach(node => wrapper.appendChild(node));
      document.body.appendChild(wrapper);
    }
  }

  function showAccessDeniedGuard(type) {
    if (document.getElementById('app-auth-guard-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'app-auth-guard-modal';
    overlay.className = 'app-auth-guard-overlay';

    let iconHtml = '<div class="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl mx-auto border border-amber-500/30 mb-3"><i class="fas fa-lock"></i></div>';
    let title = 'พื้นที่สำหรับครูและผู้ดูแลระบบ';
    let message = 'หน้านี้จำกัดสิทธิ์เฉพาะครูประจำตำบลและผู้ดูแลระบบ สกร. เท่านั้น';
    let bodyContent = `
      <form id="guard-quick-login-form" onsubmit="window.handleGuardQuickLogin(event)" class="space-y-3 text-left my-4">
        <div>
          <label class="block text-slate-400 text-[11px] font-bold mb-1">เบอร์โทรศัพท์ หรือ ชื่อผู้ใช้</label>
          <input type="text" id="guard-login-username" placeholder="เช่น 0890000003 หรือ admin หรือ 1" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500" required>
        </div>
        <div>
          <label class="block text-slate-400 text-[11px] font-bold mb-1">รหัสผ่าน</label>
          <input type="password" id="guard-login-password" placeholder="•••••••• (เช่น 123456)" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-500" required>
        </div>
        <div id="guard-login-error" class="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] font-bold hidden"></div>
        <button type="submit" id="guard-login-btn" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-orange-500/20 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
          <i class="fas fa-sign-in-alt"></i> เข้าสู่ระบบและใช้งานหน้านี้ทันที
        </button>
      </form>
      <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
        <a href="index.html" class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition flex items-center justify-center gap-1.5 text-[11px]">
          <i class="fas fa-home"></i> กลับหน้าหลัก
        </a>
      </div>
    `;

    if (type === 'learner') {
      iconHtml = '<div class="w-14 h-14 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-2xl mx-auto border border-rose-500/30 mb-3"><i class="fas fa-ban"></i></div>';
      title = 'สิทธิ์การใช้งานไม่เพียงพอ';
      message = 'บัญชีของคุณคือ <b>ผู้เรียนทั่วไป / นักศึกษา</b> ไม่มีสิทธิ์เข้าถึงศูนย์จัดการระบบนี้ หากต้องการแก้ไขข้อมูลกรุณาติดต่อครูประจำตำบล';
      bodyContent = `
        <div class="space-y-2.5 pt-4">
          <a href="learning.html" class="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-400 text-slate-950 font-black text-xs shadow-xl shadow-sky-500/25 transition active:scale-95 flex items-center justify-center gap-1.5">
            <i class="fas fa-book-open"></i> ไปยังหน้าแหล่งเรียนรู้
          </a>
          <a href="index.html" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5">
            <i class="fas fa-home"></i> กลับหน้าหลัก
          </a>
        </div>
      `;
    } else if (type === 'teacher_forbidden') {
      iconHtml = '<div class="w-14 h-14 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-2xl mx-auto border border-purple-500/30 mb-3"><i class="fas fa-shield-halved"></i></div>';
      title = 'เฉพาะผู้ดูแลระบบหลัก (Super Admin)';
      message = 'หน้านี้สงวนสิทธิ์เฉพาะผู้ดูแลระบบหลักของ สกร. เท่านั้น คุณครูสามารถจัดการข้อมูลในตำบลของตนเองได้ที่ศูนย์จัดการหลักสูตร';
      bodyContent = `
        <div class="space-y-2.5 pt-4">
          <a href="sources.html" class="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 text-white font-black text-xs shadow-xl shadow-purple-500/25 transition active:scale-95 flex items-center justify-center gap-1.5">
            <i class="fas fa-layer-group"></i> ไปที่ศูนย์จัดการหลักสูตร
          </a>
          <a href="index.html" class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5">
            <i class="fas fa-home"></i> กลับหน้าหลัก
          </a>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="app-auth-guard-card max-w-md w-full p-6 text-center">
        ${iconHtml}
        <h3 class="text-base sm:text-lg font-black text-white m-0 mb-1">${title}</h3>
        <p class="text-xs text-slate-400 leading-relaxed mb-1">${message}</p>
        ${bodyContent}
      </div>
    `;

    document.body.prepend(overlay);
  }

  window.handleGuardQuickLogin = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const u = (document.getElementById('guard-login-username')?.value || '').trim();
    const p = (document.getElementById('guard-login-password')?.value || '').trim();
    const btn = document.getElementById('guard-login-btn');
    const errEl = document.getElementById('guard-login-error');

    if (!u || !p) return;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-1"></i> กำลังตรวจสอบสิทธิ์...';
    }
    if (errEl) errEl.classList.add('hidden');

    fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', username: u, phone: u, password: p })
    })
    .then(res => res.json())
    .then(res => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt mr-1"></i> เข้าสู่ระบบและใช้งานหน้านี้ทันที';
      }
      if (res && res.status === 'success' && res.token) {
        const token = res.token || "";
        const userObj = res.user || res.profile || { username: u };
        const uPhone = userObj.phone || userObj.username || u;
        const uName = userObj.fullName || userObj.name || userObj.full_name || "";
        const uRole = String(userObj.role || "user").trim().toLowerCase();
        const uTambon = userObj.tambon || "";
        const userInstVal = userObj.institutionId || userObj.institution_id || "INS_PHRAO";
        const uScore = String(userObj.score || "0");

        localStorage.setItem('authToken', token);
        localStorage.setItem('nfe_auth_token', token);
        localStorage.setItem('userPhone', uPhone);
        localStorage.setItem('userName', uName);
        localStorage.setItem('userRole', uRole);
        localStorage.setItem('userTambon', uTambon);
        localStorage.setItem('userInstitution', userInstVal);
        localStorage.setItem('userInstitutionId', userInstVal);
        localStorage.setItem('nfe_selected_institution', userInstVal);
        localStorage.setItem('nfe_user', JSON.stringify(userObj));
        localStorage.setItem('userData', JSON.stringify(userObj));
        localStorage.setItem('userScore', uScore);

        const modal = document.getElementById('app-auth-guard-modal');
        if (modal) modal.remove();

        location.reload();
      } else {
        const msg = res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
        showToast(msg, 'error');
        if (errEl) {
          errEl.innerText = msg;
          errEl.classList.remove('hidden');
        }
      }
    })
    .catch(err => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt mr-1"></i> เข้าสู่ระบบและใช้งานหน้านี้ทันที';
      }
      const msg = 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง';
      showToast(msg, 'error');
      if (errEl) {
        errEl.innerText = msg;
        errEl.classList.remove('hidden');
      }
    });
  };

  function enforcePageAuthGuard() {
    const currentFile = getCurrentFilename();
    const user = getUserInfo();

    // Check Admin Pages
    if (ADMIN_PAGES.includes(currentFile)) {
      if (!user.isAdmin) {
        showAccessDeniedGuard(user.isGuest ? 'guest' : 'learner');
        return false;
      }

      // Check Super Admin Pages
      if (SUPER_ADMIN_ONLY_PAGES.includes(currentFile) && !user.isSuperAdmin) {
        showAccessDeniedGuard('teacher_forbidden');
        return false;
      }
    }
    return true;
  }

  function initResponsiveNav() {
    injectFontAwesome();
    injectSidebarStyles();
    
    // Restore collapsed preference
    const isCollapsed = localStorage.getItem('phrao_sidebar_collapsed') === 'true';
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }

    const isAllowed = enforcePageAuthGuard();
    renderDesktopSidebar();
    renderMobileBottomNav();
  }

  function toggleDesktopSidebar() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('phrao_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }
  window.toggleDesktopSidebar = toggleDesktopSidebar;

  function handleScreenResize() {
    const isDesktop = window.innerWidth >= 1024;
    const sidebar = document.getElementById('app-desktop-sidebar');
    const bottomNav = document.getElementById('app-mobile-bottom-nav');

    if (sidebar) {
      sidebar.style.display = isDesktop ? 'flex' : 'none';
    }
    if (bottomNav) {
      bottomNav.style.display = isDesktop ? 'none' : 'flex';
    }
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(message, type) {
    type = type || 'info';
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-5 right-4 sm:right-6 z-[999999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-2';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgMap = {
      success: 'bg-emerald-600/95 border-emerald-400/50 text-white shadow-emerald-950/50',
      error: 'bg-rose-600/95 border-rose-400/50 text-white shadow-rose-950/50',
      warning: 'bg-amber-500/95 border-amber-300/50 text-slate-950 shadow-amber-950/50',
      info: 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-black/60'
    };

    const iconMap = {
      success: 'fa-circle-check text-emerald-200',
      error: 'fa-circle-xmark text-rose-200',
      warning: 'fa-triangle-exclamation text-slate-900',
      info: 'fa-circle-info text-sky-400'
    };

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md text-xs font-bold pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 ${bgMap[type] || bgMap.info}`;
    toast.innerHTML = `
      <i class="fas ${iconMap[type] || iconMap.info} text-base shrink-0"></i>
      <span class="flex-1 leading-snug">${escapeHtml(message)}</span>
      <button type="button" class="text-white/60 hover:text-white shrink-0 ml-1 text-xs" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  }

  /**
   * Universal Modern Glassmorphism Confirmation Dialog
   * Supports both Promise (await showCustomConfirm(...)) and Callback (showCustomConfirm(..., onConfirm, onCancel))
   */
  function showCustomConfirm(options, onConfirm, onCancel) {
    return new Promise((resolve) => {
      let title = 'ยืนยันการดำเนินการ';
      let message = '';
      let type = 'question'; // 'question' | 'danger' | 'warning' | 'info' | 'logout'
      let icon = '';
      let confirmText = 'ตกลง';
      let cancelText = 'ยกเลิก';
      let isHtml = false;

      if (typeof options === 'string') {
        message = options;
        if (message.includes('ลบ') || message.includes('delete') || message.includes('ถาวร') || message.includes('ย้อนกลับ')) {
          type = 'danger';
          title = 'ยืนยันการลบข้อมูล';
          confirmText = 'ยืนยันการลบ';
        } else if (message.includes('ออกจากระบบ') || message.includes('logout')) {
          type = 'logout';
          title = 'ออกจากระบบ';
          confirmText = 'ออกจากระบบ';
          icon = 'fa-sign-out-alt';
        } else if (message.includes('ไม่อนุมัติ') || message.includes('ปฏิเสธ')) {
          type = 'danger';
          title = 'ยืนยันการปฏิเสธ';
          confirmText = 'ยืนยันปฏิเสธ';
        }
      } else if (typeof options === 'object' && options !== null) {
        title = options.title || title;
        message = options.message || options.text || '';
        type = options.type || type;
        icon = options.icon || '';
        confirmText = options.confirmText || options.confirmButtonText || confirmText;
        cancelText = options.cancelText || options.cancelButtonText || cancelText;
        isHtml = !!options.isHtml;
      }

      const typeConfig = {
        logout: {
          icon: icon || 'fa-sign-out-alt',
          iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-rose-500/30',
          confirmBtn: 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-600/30',
          glow: 'from-rose-500/15'
        },
        danger: {
          icon: icon || 'fa-triangle-exclamation',
          iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-rose-500/30',
          confirmBtn: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30',
          glow: 'from-rose-500/15'
        },
        warning: {
          icon: icon || 'fa-circle-exclamation',
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/30',
          confirmBtn: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-amber-500/30',
          glow: 'from-amber-500/15'
        },
        info: {
          icon: icon || 'fa-circle-info',
          iconBg: 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sky-500/30',
          confirmBtn: 'bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-slate-950 shadow-sky-500/30',
          glow: 'from-sky-500/15'
        },
        question: {
          icon: icon || 'fa-circle-question',
          iconBg: 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sky-500/30',
          confirmBtn: 'bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-slate-950 shadow-sky-500/30',
          glow: 'from-sky-500/15'
        }
      };

      const cfg = typeConfig[type] || typeConfig.question;
      const existing = document.getElementById('app-custom-confirm-modal');
      if (existing) existing.remove();

      const formattedMsg = isHtml ? message : escapeHtml(message).replace(/\n/g, '<br>');

      const modal = document.createElement('div');
      modal.id = 'app-custom-confirm-modal';
      modal.className = 'fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all duration-300 opacity-0';
      modal.innerHTML = `
        <div class="w-full max-w-sm sm:max-w-md bg-gradient-to-b ${cfg.glow} via-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl p-6 shadow-2xl shadow-black/80 flex flex-col items-center text-center relative overflow-hidden transform scale-95 transition-all duration-200" style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px -10px rgba(14, 165, 233, 0.15);">
          <!-- Top Ambient Glow -->
          <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-sky-500/20 to-transparent rounded-full blur-2xl pointer-events-none"></div>

          <!-- Animated Icon Badge -->
          <div class="w-16 h-16 rounded-2xl ${cfg.iconBg} border flex items-center justify-center text-2xl mb-3.5 shadow-lg relative z-10 transition-transform transform hover:scale-105">
            <i class="fas ${cfg.icon}"></i>
          </div>

          <!-- Content -->
          <div class="space-y-2 relative z-10 w-full mb-5">
            <h3 class="text-base sm:text-lg font-black text-white m-0 tracking-tight">${escapeHtml(title)}</h3>
            <div class="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium px-2">${formattedMsg}</div>
          </div>

          <!-- Buttons -->
          <div class="flex items-center gap-2.5 w-full relative z-10">
            <button type="button" id="app-confirm-cancel-btn" class="flex-1 py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700/80 active:scale-95 cursor-pointer">
              ${escapeHtml(cancelText)}
            </button>
            <button type="button" id="app-confirm-ok-btn" class="flex-1 py-2.5 px-4 rounded-xl ${cfg.confirmBtn} text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer">
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        const box = modal.querySelector('div');
        if (box) {
          box.classList.remove('scale-95');
          box.classList.add('scale-100');
        }
      });

      const cleanup = () => {
        modal.classList.add('opacity-0');
        const box = modal.querySelector('div');
        if (box) box.classList.add('scale-95');
        setTimeout(() => modal.remove(), 200);
        document.removeEventListener('keydown', keyHandler);
      };

      const handleOk = () => {
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        if (typeof onCancel === 'function') onCancel();
        resolve(false);
      };

      modal.querySelector('#app-confirm-ok-btn').onclick = handleOk;
      modal.querySelector('#app-confirm-cancel-btn').onclick = handleCancel;

      modal.onclick = (e) => {
        if (e.target === modal) handleCancel();
      };

      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleOk();
        }
      };
      document.addEventListener('keydown', keyHandler);
    });
  }

  /**
   * Universal Modern Glassmorphism Alert Dialog
   */
  function showCustomAlert(options, onOk) {
    return new Promise((resolve) => {
      let title = 'แจ้งเตือนระบบ';
      let message = '';
      let type = 'info'; // 'info' | 'success' | 'warning' | 'error'
      let okText = 'รับทราบ / ตกลง';
      let isHtml = false;

      if (typeof options === 'string') {
        message = options;
        if (message.includes('สำเร็จ') || message.includes('success') || message.includes('🎉')) {
          type = 'success';
          title = 'ดำเนินการสำเร็จ';
        } else if (message.includes('ผิดพลาด') || message.includes('error') || message.includes('ไม่สำเร็จ') || message.includes('❌')) {
          type = 'error';
          title = 'เกิดข้อผิดพลาด';
        } else if (message.includes('คำเตือน') || message.includes('⚠️')) {
          type = 'warning';
          title = 'ข้อความแจ้งเตือน';
        }
      } else if (typeof options === 'object' && options !== null) {
        title = options.title || title;
        message = options.message || options.text || '';
        type = options.type || type;
        okText = options.okText || options.confirmText || okText;
        isHtml = !!options.isHtml;
      }

      const typeConfig = {
        success: {
          icon: 'fa-circle-check',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/30',
          btnClass: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/30',
          glow: 'from-emerald-500/15'
        },
        error: {
          icon: 'fa-circle-xmark',
          iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-rose-500/30',
          btnClass: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30',
          glow: 'from-rose-500/15'
        },
        warning: {
          icon: 'fa-triangle-exclamation',
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/30',
          btnClass: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-amber-500/30',
          glow: 'from-amber-500/15'
        },
        info: {
          icon: 'fa-circle-info',
          iconBg: 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sky-500/30',
          btnClass: 'bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-slate-950 shadow-sky-500/30',
          glow: 'from-sky-500/15'
        }
      };

      const cfg = typeConfig[type] || typeConfig.info;
      const existing = document.getElementById('app-custom-alert-modal');
      if (existing) existing.remove();

      const formattedMsg = isHtml ? message : escapeHtml(message).replace(/\n/g, '<br>');

      const modal = document.createElement('div');
      modal.id = 'app-custom-alert-modal';
      modal.className = 'fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all duration-300 opacity-0';
      modal.innerHTML = `
        <div class="w-full max-w-sm bg-gradient-to-b ${cfg.glow} via-slate-900 to-slate-950 border border-slate-700/80 rounded-3xl p-6 shadow-2xl shadow-black/80 flex flex-col items-center text-center relative overflow-hidden transform scale-95 transition-all duration-200" style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px -10px rgba(14, 165, 233, 0.15);">
          <!-- Top Ambient Glow -->
          <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-sky-500/20 to-transparent rounded-full blur-2xl pointer-events-none"></div>

          <!-- Icon Badge -->
          <div class="w-16 h-16 rounded-2xl ${cfg.iconBg} border flex items-center justify-center text-2xl mb-3.5 shadow-lg relative z-10">
            <i class="fas ${cfg.icon}"></i>
          </div>

          <!-- Content -->
          <div class="space-y-2 relative z-10 w-full mb-5">
            <h3 class="text-base sm:text-lg font-black text-white m-0 tracking-tight">${escapeHtml(title)}</h3>
            <div class="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium px-2">${formattedMsg}</div>
          </div>

          <!-- Action Button -->
          <button type="button" id="app-alert-ok-btn" class="w-full py-2.5 px-4 rounded-xl ${cfg.btnClass} text-xs font-black shadow-lg transition-all active:scale-95 cursor-pointer relative z-10">
            ${escapeHtml(okText)}
          </button>
        </div>
      `;

      document.body.appendChild(modal);

      requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        const box = modal.querySelector('div');
        if (box) {
          box.classList.remove('scale-95');
          box.classList.add('scale-100');
        }
      });

      const handleClose = () => {
        modal.classList.add('opacity-0');
        const box = modal.querySelector('div');
        if (box) box.classList.add('scale-95');
        setTimeout(() => modal.remove(), 200);
        document.removeEventListener('keydown', keyHandler);
        if (typeof onOk === 'function') onOk();
        resolve(true);
      };

      modal.querySelector('#app-alert-ok-btn').onclick = handleClose;
      modal.onclick = (e) => {
        if (e.target === modal) handleClose();
      };

      const keyHandler = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          handleClose();
        }
      };
      document.addEventListener('keydown', keyHandler);
    });
  }

  function showSuccessModal(title, message, callback) {
    if (typeof title === 'object' && title !== null) {
      const msg = title.message || message || 'ดำเนินการสำเร็จเรียบร้อย';
      const heading = title.title || 'สำเร็จ';
      showCustomAlert({
        title: heading,
        message: msg,
        type: 'success',
        okText: 'ตกลง / ดำเนินการต่อ'
      }, typeof message === 'function' ? message : callback);
      return;
    }
    showCustomAlert({
      title: title || 'ดำเนินการสำเร็จ',
      message: message || '',
      type: 'success',
      okText: 'ตกลง / ดำเนินการต่อ'
    }, callback);
  }

  function updateGlobalUserScore(newScore) {
    const num = parseInt(newScore, 10) || 0;
    localStorage.setItem('userScore', String(num));
    const scoreEls = document.querySelectorAll('#nav-user-points-val, #modal-cosmetic-user-score, #spin-user-score, #home-user-score, #profile-points-count, .global-user-score-val');
    scoreEls.forEach(el => {
      if (el) el.innerText = num.toLocaleString();
    });
  }

  // Expose Global Functions
  window.showToast = showToast;
  window.showCustomConfirm = showCustomConfirm;
  window.showCustomAlert = showCustomAlert;
  window.showSuccessModal = showSuccessModal;
  window.initResponsiveNav = initResponsiveNav;
  window.toggleDesktopSidebar = toggleDesktopSidebar;
  window.handleScreenResize = handleScreenResize;
  window.getUserInfo = getUserInfo;
  window.updateGlobalUserScore = updateGlobalUserScore;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initResponsiveNav();
      handleScreenResize();
    });
  } else {
    initResponsiveNav();
    handleScreenResize();
  }

  window.addEventListener('resize', handleScreenResize);

})();

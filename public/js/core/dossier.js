/**
 * PHRAO LEARNING DISTRICT - Student Learning Dossier & Academic History Viewer
 * Provides comprehensive portfolio, quiz scores, check-in history, upskill logs, and print-ready dossier.
 */

(function() {
  let currentDossierData = null;
  let activeDossierTab = 'quizzes';

  function injectDossierModal() {
    if (document.getElementById('student-dossier-modal')) return;

    const modalHtml = `
      <div id="student-dossier-modal" class="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md" style="display:none;">
        <div class="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-pop text-slate-100 print:max-h-none print:shadow-none print:border-none print:bg-white print:text-slate-900">
          
          <!-- Modal Header -->
          <div class="p-4 sm:p-5 border-b border-slate-800 bg-slate-800/80 flex items-center justify-between gap-3 shrink-0 print:border-b-2 print:border-slate-300 print:bg-white">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center text-lg shadow-md shadow-amber-500/20 shrink-0 font-black print:hidden">
                <i class="fas fa-graduation-cap"></i>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm sm:text-base font-black text-white m-0 flex items-center gap-2 print:text-slate-900">
                    สมุดประวัติการเรียนรู้สะสม (Student Learning Dossier)
                  </h3>
                  <span class="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide print:hidden">
                    Academic Record
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 m-0 print:text-slate-600">ประวัติการทำแบบทดสอบ การเช็กอินกิจกรรม และเกียรติบัตรรายบุคคล</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 shrink-0 print:hidden">
              <button type="button" onclick="printStudentDossier()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer" title="พิมพ์รายงานสรุปผลการเรียนรู้">
                <i class="fas fa-print"></i> <span>พิมพ์รายงาน</span>
              </button>
              <button type="button" onclick="closeStudentDossierModal()" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition cursor-pointer">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <!-- Modal Body -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar print:overflow-visible print:p-0">
            
            <!-- Student Profile Summary Banner -->
            <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-700/70 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:border-slate-300 print:bg-slate-50 print:text-slate-900">
              <div class="flex items-center gap-4">
                <div class="relative shrink-0">
                  <img id="dossier-avatar" src="assets/loft-logo.svg" alt="Avatar" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover bg-slate-800 border-2 border-amber-500/50 shadow-md">
                  <span id="dossier-level-badge" class="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-slate-950 border border-slate-900 shadow">
                    LV.1
                  </span>
                </div>
                <div class="space-y-1 min-w-0">
                  <h4 id="dossier-fullname" class="text-base sm:text-lg font-black text-white m-0 truncate print:text-slate-900">กำลังโหลด...</h4>
                  <div class="flex items-center gap-2 flex-wrap text-xs text-slate-400 print:text-slate-600">
                    <span><i class="fas fa-phone mr-1 text-slate-500"></i><span id="dossier-phone">—</span></span>
                    <span>•</span>
                    <span><i class="fas fa-map-pin mr-1 text-rose-400"></i><span id="dossier-tambon">—</span></span>
                    <span>•</span>
                    <span><i class="fas fa-school mr-1 text-sky-400"></i><span id="dossier-institution">สกร.อำเภอพร้าว</span></span>
                  </div>
                  <div class="pt-1">
                    <span id="dossier-role-tag" class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      นักศึกษา
                    </span>
                  </div>
                </div>
              </div>

              <!-- 4 Stat Counters -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto shrink-0 print:border-t print:border-slate-300 print:pt-3">
                <div class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center min-w-[80px]">
                  <span class="text-[10px] text-slate-400 block">🪙 แต้มสะสม</span>
                  <span id="dossier-stat-score" class="text-sm sm:text-base font-black text-amber-400">0</span>
                </div>
                <div class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center min-w-[80px]">
                  <span class="text-[10px] text-slate-400 block">📝 สอบผ่าน</span>
                  <span id="dossier-stat-quizzes" class="text-sm sm:text-base font-black text-emerald-400">0</span>
                </div>
                <div class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center min-w-[80px]">
                  <span class="text-[10px] text-slate-400 block">📍 เช็กอิน</span>
                  <span id="dossier-stat-checkins" class="text-sm sm:text-base font-black text-sky-400">0</span>
                </div>
                <div class="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center min-w-[80px]">
                  <span class="text-[10px] text-slate-400 block">🏆 เกียรติบัตร</span>
                  <span id="dossier-stat-certs" class="text-sm sm:text-base font-black text-purple-400">0</span>
                </div>
              </div>
            </div>

            <!-- Tabs Navigation -->
            <div class="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto custom-scrollbar print:hidden">
              <button type="button" onclick="switchDossierTab('quizzes')" id="dossier-tab-btn-quizzes" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <i class="fas fa-clipboard-check"></i> <span>แบบทดสอบ</span> (<span id="tab-count-quizzes">0</span>)
              </button>
              <button type="button" onclick="switchDossierTab('checkins')" id="dossier-tab-btn-checkins" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/80">
                <i class="fas fa-qrcode"></i> <span>เช็กอิน & กิจกรรม</span> (<span id="tab-count-checkins">0</span>)
              </button>
              <button type="button" onclick="switchDossierTab('certs')" id="dossier-tab-btn-certs" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/80">
                <i class="fas fa-certificate"></i> <span>เกียรติบัตร</span> (<span id="tab-count-certs">0</span>)
              </button>
              <button type="button" onclick="switchDossierTab('upskills')" id="dossier-tab-btn-upskills" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/80">
                <i class="fas fa-play-circle"></i> <span>เรียนออนไลน์</span> (<span id="tab-count-upskills">0</span>)
              </button>
              <button type="button" onclick="switchDossierTab('points')" id="dossier-tab-btn-points" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/80">
                <i class="fas fa-coins"></i> <span>ประวัติแต้ม</span> (<span id="tab-count-points">0</span>)
              </button>
            </div>

            <!-- Tab 1: Quizzes -->
            <div id="dossier-tab-quizzes" class="dossier-tab-panel space-y-3">
              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 print:border-slate-300">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-800/90 text-slate-300 uppercase text-[10px] font-bold border-b border-slate-700/80 print:bg-slate-200 print:text-slate-800">
                    <tr>
                      <th class="p-3 text-center w-12">#</th>
                      <th class="p-3">ประเภท</th>
                      <th class="p-3">ชื่อวิชา / แหล่งเรียนรู้ / กิจกรรม</th>
                      <th class="p-3 text-center">คะแนนสอบ</th>
                      <th class="p-3 text-center">ผลการประเมิน</th>
                      <th class="p-3 text-center">เกียรติบัตรที่ได้รับ</th>
                      <th class="p-3 text-right">วันเวลาที่บันทึก</th>
                    </tr>
                  </thead>
                  <tbody id="dossier-quizzes-table-body" class="divide-y divide-slate-800/60 print:divide-slate-200">
                    <!-- Dynamic Rows -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tab 2: Check-ins & Activities -->
            <div id="dossier-tab-checkins" class="dossier-tab-panel space-y-3" style="display:none;">
              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 print:border-slate-300">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-800/80 text-slate-300 uppercase text-[10px] font-bold border-b border-slate-700/80 print:bg-slate-200 print:text-slate-800">
                    <tr>
                      <th class="p-3">ประเภท</th>
                      <th class="p-3">ชื่อกิจกรรม / แหล่งเรียนรู้</th>
                      <th class="p-3 text-center">แต้มที่ได้รับ</th>
                      <th class="p-3 text-right">วันเวลาที่เช็กอิน</th>
                    </tr>
                  </thead>
                  <tbody id="dossier-checkins-table-body" class="divide-y divide-slate-800/60 print:divide-slate-200">
                    <!-- Dynamic Rows -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tab 3: Certificates -->
            <div id="dossier-tab-certs" class="dossier-tab-panel space-y-3" style="display:none;">
              <div id="dossier-certs-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <!-- Dynamic Cert Cards -->
              </div>
            </div>

            <!-- Tab 4: Upskill Online Learning -->
            <div id="dossier-tab-upskills" class="dossier-tab-panel space-y-3" style="display:none;">
              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 print:border-slate-300">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-800/80 text-slate-300 uppercase text-[10px] font-bold border-b border-slate-700/80 print:bg-slate-200 print:text-slate-800">
                    <tr>
                      <th class="p-3">ชื่อบทเรียน / วิดีโอ</th>
                      <th class="p-3 text-center">ผลการประเมิน</th>
                      <th class="p-3">ข้อเสนอแนะครู</th>
                      <th class="p-3 text-right">วันเวลาที่เรียน</th>
                    </tr>
                  </thead>
                  <tbody id="dossier-upskills-table-body" class="divide-y divide-slate-800/60 print:divide-slate-200">
                    <!-- Dynamic Rows -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Tab 5: Points Transactions -->
            <div id="dossier-tab-points" class="dossier-tab-panel space-y-3" style="display:none;">
              <div class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 print:border-slate-300">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-800/80 text-slate-300 uppercase text-[10px] font-bold border-b border-slate-700/80 print:bg-slate-200 print:text-slate-800">
                    <tr>
                      <th class="p-3">รายการ / กิจกรรม</th>
                      <th class="p-3 text-center">ประเภท</th>
                      <th class="p-3 text-center">จำนวนแต้ม</th>
                      <th class="p-3 text-right">วันเวลาทำรายการ</th>
                    </tr>
                  </thead>
                  <tbody id="dossier-points-table-body" class="divide-y divide-slate-800/60 print:divide-slate-200">
                    <!-- Dynamic Rows -->
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- Modal Footer -->
          <div class="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-800/50 flex items-center justify-between text-xs text-slate-400 shrink-0 print:border-t-2 print:border-slate-300 print:bg-white">
            <div class="flex items-center gap-2">
              <i class="fas fa-shield-check text-emerald-400"></i>
              <span>ข้อมูลได้รับการบันทึกและตรวจสอบโดยระบบสารสนเทศ สกร.อำเภอพร้าว</span>
            </div>
            <button type="button" onclick="closeStudentDossierModal()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition print:hidden cursor-pointer">
              ปิดหน้าต่าง
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  function openStudentLearningDossier(targetIdentifier) {
    const userTarget = targetIdentifier || localStorage.getItem('userPhone') || localStorage.getItem('userName') || '';
    if (!userTarget) {
      if (typeof showToast === 'function') {
        showToast('กรุณาระบุรหัสผู้เรียนหรือเข้าสู่ระบบ', 'warning');
      } else {
        alert('กรุณาระบุรหัสผู้เรียน');
      }
      return;
    }

    injectDossierModal();
    const modal = document.getElementById('student-dossier-modal');
    modal.style.display = 'flex';

    // Reset fields to loading state
    document.getElementById('dossier-fullname').innerText = 'กำลังโหลดข้อมูลผู้เรียน...';
    document.getElementById('dossier-phone').innerText = userTarget;
    document.getElementById('dossier-quizzes-table-body').innerHTML = '<tr><td colspan="7" class="p-8 text-center text-slate-400"><i class="fas fa-circle-notch fa-spin text-2xl text-amber-500 mb-2"></i><p>กำลังดึงประวัติการเรียนรู้...</p></td></tr>';

    if (typeof apiGet === 'function') {
      apiGet('getEPortfolio', withAuthParams({ targetPhone: userTarget, targetUsername: userTarget }))
        .then(res => {
          if (res && res.status === 'success' && res.profile) {
            currentDossierData = res;
            renderDossierContent(res);
          } else {
            document.getElementById('dossier-fullname').innerText = 'ไม่พบข้อมูลผู้เรียน';
            if (typeof showToast === 'function') {
              showToast((res && res.message) || 'ไม่สามารถโหลดประวัติผู้เรียนได้', 'error');
            }
          }
        })
        .catch(err => {
          console.error("Dossier load error:", err);
          document.getElementById('dossier-fullname').innerText = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
        });
    }
  }

  function renderDossierContent(res) {
    const p = res.profile || {};
    const stats = res.stats || {};
    const quizzes = res.quizzes || [];
    const checkins = res.checkins || [];
    const certs = res.certificates || [];
    const upskills = res.upskills || [];
    const points = res.pointsHistory || [];

    // 1. Profile Banner
    const name = p.fullName || p.name || p.username || 'ผู้เรียน';
    document.getElementById('dossier-fullname').innerText = name;
    document.getElementById('dossier-phone').innerText = p.phone || p.username || '—';
    document.getElementById('dossier-tambon').innerText = p.tambon ? ('ต.' + p.tambon.replace(/^(ต\.|ตำบล|ศกร\.ระดับตำบล|ศกร\.ตำบล)\s*/, '')) : '—';
    document.getElementById('dossier-level-badge').innerText = 'LV.' + (p.level || 1);
    document.getElementById('dossier-role-tag').innerText = p.role === 'admin' ? 'ผู้ดูแลระบบ' : (p.role === 'teacher' ? 'ครูผู้สอน' : 'นักศึกษา / ผู้เรียน');
    
    const rawAvatar = p.profileImage || p.profile_image || p.avatar || p.image || p.photoURL || p.photoUrl || '';
    const avatarImg = document.getElementById('dossier-avatar');
    if (avatarImg) {
      avatarImg.onerror = function() {
        this.onerror = null;
        this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=fbbf24&bold=true`;
      };
      if (rawAvatar && String(rawAvatar).trim() !== '') {
        avatarImg.src = typeof getValidImageUrl === 'function' ? getValidImageUrl(rawAvatar) : rawAvatar;
      } else {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=fbbf24&bold=true`;
      }
    }

    // 2. Stats
    document.getElementById('dossier-stat-score').innerText = Number(stats.totalScore || p.score || 0).toLocaleString();
    document.getElementById('dossier-stat-quizzes').innerText = (stats.passedQuizzes || 0) + ' / ' + (stats.quizzesCount || quizzes.length);
    document.getElementById('dossier-stat-checkins').innerText = stats.checkInsCount || checkins.length;
    document.getElementById('dossier-stat-certs').innerText = stats.certificatesCount || certs.length;

    // 3. Tab Counts
    document.getElementById('tab-count-quizzes').innerText = quizzes.length;
    document.getElementById('tab-count-checkins').innerText = checkins.length;
    document.getElementById('tab-count-certs').innerText = certs.length;
    document.getElementById('tab-count-upskills').innerText = upskills.length;
    document.getElementById('tab-count-points').innerText = points.length;

    // 4. Render Quizzes (Detailed Academic Record)
    const qBody = document.getElementById('dossier-quizzes-table-body');
    if (quizzes.length === 0) {
      qBody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">ยังไม่มีประวัติการทำแบบทดสอบ</td></tr>';
    } else {
      qBody.innerHTML = quizzes.map((q, idx) => {
        const isPass = Boolean(q.isPass || String(q.status).toLowerCase() === 'pass' || q.score >= 80);
        const title = escapeHtml(q.title || q.sourceName || 'แบบทดสอบประเมินผล');
        const location = escapeHtml(q.location || (q.tambon ? `ศกร.ตำบล${q.tambon}` : 'สกร.ระดับอำเภอพร้าว'));
        const category = escapeHtml(q.category || (q.sourceId ? 'แหล่งเรียนรู้ ม.6' : (q.activityId ? 'กิจกรรมสถานศึกษา' : 'แบบทดสอบ')));
        
        let catBadge = '';
        if (category.includes('แหล่งเรียนรู้')) {
          catBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap"><i class="fas fa-landmark mr-1"></i>${category}</span>`;
        } else if (category.includes('กิจกรรม')) {
          catBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 whitespace-nowrap"><i class="fas fa-flag mr-1"></i>${category}</span>`;
        } else if (category.includes('ฐาน')) {
          catBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 whitespace-nowrap"><i class="fas fa-cubes mr-1"></i>${category}</span>`;
        } else {
          catBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap"><i class="fas fa-clipboard-list mr-1"></i>${category}</span>`;
        }

        let certHtml = '';
        if (isPass && (q.certNo || q.sourceId || q.activityId)) {
          const certCode = escapeHtml(q.certNo || 'CERT-NFE-2026');
          certHtml = `
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
              <span class="font-mono text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">${certCode}</span>
              ${typeof window.previewCertificateModal === 'function' ? `
                <button type="button" onclick="previewCertificateModal('${escapeJS(q.certId || '')}', '${escapeJS(title)}', '${escapeJS(certCode)}', '${escapeJS(q.sourceId || '')}', '${escapeJS(q.activityId || '')}')" class="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 text-[10px] font-bold border border-slate-700 transition cursor-pointer flex items-center gap-1 shadow-sm" title="ดูตัวอย่างเกียรติบัตร">
                  <i class="fas fa-eye text-[9px]"></i> ดูเกียรติบัตร
                </button>
              ` : ''}
            </div>
          `;
        } else if (isPass) {
          certHtml = `<span class="text-emerald-400 font-bold text-[11px]"><i class="fas fa-check-circle mr-1"></i>ผ่านเกณฑ์รับรอง</span>`;
        } else {
          certHtml = `<span class="text-slate-500 text-[11px]">—</span>`;
        }

        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="p-3 font-bold text-slate-400 text-center">${idx + 1}</td>
            <td class="p-3">${catBadge}</td>
            <td class="p-3">
              <div class="font-bold text-white text-xs sm:text-sm">${title}</div>
              <div class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <i class="fas fa-map-marker-alt text-rose-400 text-[10px]"></i>
                <span>${location}</span>
                ${q.baseId ? `<span class="text-teal-400 font-mono text-[10px]">(${escapeHtml(q.baseId)})</span>` : ''}
              </div>
            </td>
            <td class="p-3 text-center">
              <span class="font-black text-sm ${isPass ? 'text-amber-400' : 'text-slate-300'}">${escapeHtml(String(q.score))}%</span>
              <span class="block text-[9px] text-slate-400">เกณฑ์ผ่าน 80%</span>
            </td>
            <td class="p-3 text-center">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${isPass ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}">
                <i class="fas ${isPass ? 'fa-check' : 'fa-times'}"></i>
                ${isPass ? 'ผ่านเกณฑ์' : 'ไม่ผ่าน'}
              </span>
            </td>
            <td class="p-3 text-center">${certHtml}</td>
            <td class="p-3 text-right text-slate-400 font-mono text-[11px] whitespace-nowrap">${escapeHtml(q.date || '—')}</td>
          </tr>
        `;
      }).join('');
    }

    // 5. Render Check-ins
    const cBody = document.getElementById('dossier-checkins-table-body');
    if (checkins.length === 0) {
      cBody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500">ยังไม่มีประวัติการเช็กอินแหล่งเรียนรู้หรือกิจกรรม</td></tr>';
    } else {
      cBody.innerHTML = checkins.map(c => `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-3 font-bold">
            <span class="px-2 py-0.5 rounded-full text-[10px] ${c.type === 'แหล่งเรียนรู้ ม.6' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'}">
              ${escapeHtml(c.type || 'กิจกรรม')}
            </span>
          </td>
          <td class="p-3 font-bold text-white">${escapeHtml(c.name || 'กิจกรรม')}</td>
          <td class="p-3 text-center font-black text-amber-400">+${c.pointsEarned || 0} แต้ม</td>
          <td class="p-3 text-right text-slate-400">${escapeHtml(c.date || '—')}</td>
        </tr>
      `).join('');
    }

    // 6. Render Certificates
    const certGrid = document.getElementById('dossier-certs-grid');
    if (certs.length === 0) {
      certGrid.innerHTML = '<div class="col-span-full text-center py-8 text-slate-500 text-xs font-bold">ยังไม่มีเกียรติบัตรที่ได้รับ</div>';
    } else {
      certGrid.innerHTML = certs.map(cert => {
        const title = escapeHtml(cert.title || cert.sourceName || 'ใบประกาศนียบัตร');
        const certNo = escapeHtml(cert.certNo || 'CERT-NFE-2026');
        const tambon = escapeHtml(cert.tambon || 'สกร.ระดับอำเภอพร้าว');
        const cat = escapeHtml(cert.category || 'หลักสูตรสถานศึกษา');
        const srcId = escapeHtml(cert.sourceId || '');
        const actId = escapeHtml(cert.activityId || '');

        return `
          <div class="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-amber-500/30 flex flex-col justify-between space-y-3 hover:border-amber-400 transition shadow-lg relative overflow-hidden group">
            <div class="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-amber-500/5 group-hover:bg-amber-500/10 pointer-events-none transition"></div>
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ${cat}
                </span>
                <span class="text-[10px] text-slate-400 font-mono">${tambon}</span>
              </div>
              <h5 class="text-xs font-black text-white line-clamp-2 m-0">${title}</h5>
              <p class="text-[10px] text-amber-400/90 font-mono mt-1 m-0">เลขที่: ${certNo}</p>
            </div>
            <div class="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
              <span class="text-[10px] text-slate-400">วันที่: ${escapeHtml(cert.issuedAt || '—')}</span>
              ${typeof window.previewCertificateModal === 'function' ? `
                <button type="button" onclick="previewCertificateModal('${cert.id || ''}', '${escapeJS(title)}', '${certNo}', '${srcId}', '${actId}')" class="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-950 text-[10px] font-black shadow transition flex items-center gap-1 cursor-pointer" title="ดูและดาวน์โหลดเกียรติบัตร">
                  <i class="fas fa-image"></i> โหลดเกียรติบัตร
                </button>
              ` : (cert.certUrl ? `<a href="${escapeHtml(cert.certUrl)}" target="_blank" class="text-amber-400 text-xs font-bold hover:underline">ดูไฟล์</a>` : '<span class="text-emerald-400 text-[10px] font-bold">อนุมัติแล้ว</span>')}
            </div>
          </div>
        `;
      }).join('');
    }

    // 7. Render Upskills
    const uBody = document.getElementById('dossier-upskills-table-body');
    if (upskills.length === 0) {
      uBody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500">ยังไม่มีประวัติการเรียนสื่อออนไลน์</td></tr>';
    } else {
      uBody.innerHTML = upskills.map(u => `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-3 font-bold text-white">${escapeHtml(u.videoTitle || 'บทเรียน')}</td>
          <td class="p-3 text-center font-bold text-emerald-400">${u.grade ? `${u.grade} คะแนน` : 'ผ่านการศึกษา'}</td>
          <td class="p-3 text-slate-300">${escapeHtml(u.feedback || '—')}</td>
          <td class="p-3 text-right text-slate-400">${escapeHtml(u.date || '—')}</td>
        </tr>
      `).join('');
    }

    // 8. Render Points Ledger
    const pBody = document.getElementById('dossier-points-table-body');
    if (points.length === 0) {
      pBody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500">ยังไม่มีบันทึกแต้มสะสม</td></tr>';
    } else {
      pBody.innerHTML = points.map(pt => {
        const isPlus = (pt.points || 0) >= 0;
        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="p-3 font-bold text-white">${escapeHtml(pt.description || 'กิจกรรม')}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(pt.type || 'แต้ม')}</span></td>
            <td class="p-3 text-center font-black ${isPlus ? 'text-emerald-400' : 'text-rose-400'}">${isPlus ? '+' : ''}${pt.points} แต้ม</td>
            <td class="p-3 text-right text-slate-400">${escapeHtml(pt.date || '—')}</td>
          </tr>
        `;
      }).join('');
    }
  }

  function switchDossierTab(tabKey) {
    activeDossierTab = tabKey;
    ['quizzes', 'checkins', 'certs', 'upskills', 'points'].forEach(k => {
      const panel = document.getElementById(`dossier-tab-${k}`);
      const btn = document.getElementById(`dossier-tab-btn-${k}`);
      if (panel) panel.style.display = (k === tabKey) ? 'block' : 'none';
      if (btn) {
        if (k === tabKey) {
          btn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        } else {
          btn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800/80';
        }
      }
    });
  }

  function closeStudentDossierModal() {
    const modal = document.getElementById('student-dossier-modal');
    if (modal) modal.style.display = 'none';
  }

  function printStudentDossier() {
    if (!currentDossierData) {
      if (typeof showToast === 'function') showToast('ยังไม่มีข้อมูลสำหรับพิมพ์รายงาน', 'error');
      return;
    }

    const p = currentDossierData.profile || {};
    const stats = currentDossierData.stats || {};
    const quizzes = currentDossierData.quizzes || [];
    const checkins = currentDossierData.checkins || [];
    const certs = currentDossierData.certificates || [];

    const now = new Date();
    const thaiMonths = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const printDate = `${now.getDate()} ${thaiMonths[now.getMonth() + 1]} พ.ศ. ${now.getFullYear() + 543} เวลา ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;

    const name = escapeHtml(p.fullName || p.name || p.username || 'ผู้เรียน');
    const phone = escapeHtml(p.phone || p.username || '—');
    const rawTambon = p.tambon ? p.tambon.replace(/^(ต\.|ตำบล|ศกร\.ระดับตำบล|ศกร\.ตำบล)\s*/, '') : '—';
    const tambon = escapeHtml(rawTambon !== '—' ? 'ศกร.ตำบล' + rawTambon : 'สกร.ระดับอำเภอพร้าว');
    const role = p.role === 'admin' ? 'ผู้ดูแลระบบ' : (p.role === 'teacher' ? 'ครูผู้สอน' : 'นักศึกษา / ผู้เรียน');

    // Build Pristine Print-Ready HTML Document
    const printHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>สมุดประวัติการเรียนรู้สะสม_${name}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 12mm 12mm 12mm 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Sarabun', sans-serif;
            font-size: 12pt;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.4;
            padding: 4px;
          }
          .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; }
          .logo { height: 48px; margin-bottom: 4px; }
          .title-main { font-size: 15pt; font-weight: 800; color: #0f172a; line-height: 1.2; }
          .title-sub { font-size: 12.5pt; font-weight: 700; color: #1e293b; margin-top: 2px; }
          
          .profile-box {
            border: 1.5px solid #94a3b8;
            background: #f8fafc;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 14px;
            display: table;
            width: 100%;
          }
          .profile-row { display: table-row; }
          .profile-cell { display: table-cell; padding: 2px 6px; font-size: 11pt; }
          
          .section-title {
            font-size: 11.5pt;
            font-weight: 800;
            color: #0f172a;
            margin: 14px 0 6px 0;
            padding-bottom: 3px;
            border-bottom: 1.5px solid #64748b;
          }

          table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            page-break-inside: auto;
          }
          table.data-table tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          table.data-table th, table.data-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            font-size: 10pt;
            vertical-align: middle;
          }
          table.data-table th {
            background-color: #f1f5f9;
            font-weight: 700;
            text-align: center;
            color: #1e293b;
          }
          
          .badge {
            display: inline-block;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 8.5pt;
            font-weight: 700;
          }
          .badge-pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
          .badge-fail { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .badge-cat { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

          .sig-container {
            margin-top: 20px;
            page-break-inside: avoid;
            display: table;
            width: 100%;
          }
          .sig-col {
            display: table-cell;
            width: 50%;
            text-align: center;
            font-size: 10.5pt;
            vertical-align: top;
          }
          .footer-note {
            font-size: 8.5pt;
            color: #64748b;
            text-align: center;
            margin-top: 14px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="assets/loft-logo.svg" onerror="this.style.display='none'" class="logo">
          <div class="title-main">ศูนย์ส่งเสริมการเรียนรู้ระดับอำเภอพร้าว</div>
          <div class="title-sub">สมุดประวัติการเรียนรู้สะสมและผลการประเมินรายบุคคล (Student Learning Dossier)</div>
          <div style="font-size: 9.5pt; color: #64748b; margin-top: 2px;">กรมส่งเสริมการเรียนรู้ กระทรวงศึกษาธิการ</div>
        </div>

        <div class="profile-box">
          <div class="profile-row">
            <div class="profile-cell"><strong>ชื่อ-นามสกุล:</strong> ${name}</div>
            <div class="profile-cell"><strong>รหัส/เบอร์โทร:</strong> ${phone}</div>
          </div>
          <div class="profile-row">
            <div class="profile-cell"><strong>สังกัดสถานศึกษา:</strong> ${tambon} (สกร.ระดับอำเภอพร้าว)</div>
            <div class="profile-cell"><strong>สถานะผู้เรียน:</strong> ${role} (ระดับ LV.${p.level || 1})</div>
          </div>
          <div class="profile-row">
            <div class="profile-cell"><strong>แต้มสะสมทั้งหมด:</strong> ${Number(stats.totalScore || p.score || 0).toLocaleString()} แต้ม</div>
            <div class="profile-cell"><strong>ผลสรุปการประเมิน:</strong> ผ่านเกณฑ์ ${stats.passedQuizzes || 0} / ${stats.quizzesCount || quizzes.length} วิชา | ได้รับ ${stats.certificatesCount || certs.length} เกียรติบัตร</div>
          </div>
        </div>

        <!-- Section 1: Quizzes -->
        <div class="section-title">1. ประวัติการทดสอบและการประเมินผลการเรียนรู้ (Quizzes & Evaluations)</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 28px;">#</th>
              <th style="width: 105px;">ประเภท</th>
              <th>ชื่อวิชา / แหล่งเรียนรู้ / กิจกรรม</th>
              <th style="width: 130px;">สังกัด / สถานที่</th>
              <th style="width: 50px;">คะแนน</th>
              <th style="width: 70px;">ผลประเมิน</th>
              <th style="width: 140px;">รหัสเกียรติบัตร</th>
              <th style="width: 100px;">วันเวลาที่สอบ</th>
            </tr>
          </thead>
          <tbody>
            ${quizzes.length === 0 ? '<tr><td colspan="8" style="text-align:center; color:#64748b; padding:10px;">ไม่มีประวัติการทำแบบทดสอบ</td></tr>' : quizzes.map((q, i) => {
              const isPass = Boolean(q.isPass || String(q.status).toLowerCase() === 'pass' || q.score >= 80);
              return `
                <tr>
                  <td style="text-align:center;">${i + 1}</td>
                  <td style="text-align:center;"><span class="badge badge-cat">${escapeHtml(q.category || 'แบบทดสอบ')}</span></td>
                  <td><strong>${escapeHtml(q.title || q.sourceName || 'แบบทดสอบ')}</strong></td>
                  <td>${escapeHtml(q.location || q.tambon || 'สกร.ระดับอำเภอพร้าว')}</td>
                  <td style="text-align:center; font-weight:bold;">${escapeHtml(String(q.score))}%</td>
                  <td style="text-align:center;">
                    <span class="badge ${isPass ? 'badge-pass' : 'badge-fail'}">${isPass ? 'ผ่านเกณฑ์' : 'ไม่ผ่าน'}</span>
                  </td>
                  <td style="text-align:center; font-family: monospace; font-size: 8.5pt;">${q.certNo ? escapeHtml(q.certNo) : '—'}</td>
                  <td style="text-align:center; font-size: 9pt;">${escapeHtml(q.date || '—')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Section 2: Check-ins -->
        <div class="section-title">2. ประวัติการเช็กอินเข้าร่วมกิจกรรมและศึกษาแหล่งเรียนรู้ (Check-ins & Activities)</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 28px;">#</th>
              <th style="width: 120px;">ประเภท</th>
              <th>ชื่อกิจกรรม / แหล่งเรียนรู้</th>
              <th style="width: 80px;">แต้มที่ได้รับ</th>
              <th style="width: 110px;">วันเวลาที่เช็กอิน</th>
            </tr>
          </thead>
          <tbody>
            ${checkins.length === 0 ? '<tr><td colspan="5" style="text-align:center; color:#64748b; padding:10px;">ไม่มีประวัติการเช็กอิน</td></tr>' : checkins.map((c, i) => `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td style="text-align:center;"><span class="badge badge-cat">${escapeHtml(c.type || 'กิจกรรม')}</span></td>
                <td><strong>${escapeHtml(c.name || 'กิจกรรม')}</strong></td>
                <td style="text-align:center; font-weight:bold; color:#047857;">+${c.pointsEarned || 0} แต้ม</td>
                <td style="text-align:center; font-size: 9pt;">${escapeHtml(c.date || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Section 3: Certificates -->
        <div class="section-title">3. ทะเบียนใบประกาศนียบัตรที่ได้รับอนุมัติ (Certificates Registry)</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 28px;">#</th>
              <th>หลักสูตร / แหล่งเรียนรู้ / กิจกรรม</th>
              <th style="width: 110px;">ประเภท</th>
              <th style="width: 110px;">สังกัดตำบล</th>
              <th style="width: 150px;">เลขที่อ้างอิงเกียรติบัตร</th>
              <th style="width: 85px;">วันที่ออก</th>
            </tr>
          </thead>
          <tbody>
            ${certs.length === 0 ? '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:10px;">ยังไม่มีเกียรติบัตรที่ได้รับ</td></tr>' : certs.map((c, i) => `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td><strong>${escapeHtml(c.title || c.sourceName || 'ใบประกาศนียบัตร')}</strong></td>
                <td style="text-align:center;"><span class="badge badge-cat">${escapeHtml(c.category || 'หลักสูตร')}</span></td>
                <td>${escapeHtml(c.tambon || 'สกร.ระดับอำเภอพร้าว')}</td>
                <td style="text-align:center; font-family: monospace; font-size: 9pt; font-weight:bold;">${escapeHtml(c.certNo || 'CERT')}</td>
                <td style="text-align:center; font-size: 9pt;">${escapeHtml(c.issuedAt || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="sig-container">
          <div class="sig-col">
            <p>ลงชื่อ......................................................ผู้เรียน</p>
            <p style="margin-top: 4px;">( ${name} )</p>
            <p style="font-size: 9pt; color: #64748b; margin-top: 2px;">วันที่ ........ / ........ / ........</p>
          </div>
          <div class="sig-col">
            <p>ลงชื่อ......................................................นายทะเบียน/ผู้ตรวจสอบ</p>
            <p style="margin-top: 4px;">( นายประวิตร ประธรรมโย )</p>
            <p style="font-size: 9pt; color: #64748b; margin-top: 2px;">ผู้อำนวยการ สกร.ระดับอำเภอพร้าว</p>
          </div>
        </div>

        <div class="footer-note">
          พิมพ์เมื่อ: ${printDate} | เอกสารรับรองผลการเรียนรู้สะสมจากระบบสารสนเทศ สกร.ระดับอำเภอพร้าว (Phrao Learning District)
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=950,height=850');
    if (!printWin) {
      if (typeof showToast === 'function') showToast('กรุณาอนุญาต Pop-up บนเบราว์เซอร์เพื่อพิมพ์รายงาน', 'warning');
      return;
    }
    printWin.document.open();
    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  }

  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJS(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  // Export functions to global scope
  window.openStudentLearningDossier = openStudentLearningDossier;
  window.closeStudentDossierModal = closeStudentDossierModal;
  window.switchDossierTab = switchDossierTab;
  window.printStudentDossier = printStudentDossier;
})();

// LOFT LEARN - User Certificates Component
let currentCertPage = 1;
let totalCertPages = 1;
const CERTS_PER_PAGE = 5;

  function loadUserCertificates(forceFresh) {
    if (forceFresh) {
      cacheHistory = null;
      window.cacheCertificatesHistory = null;
    }
    const myPhone = localStorage.getItem("userPhone") || "";
    const container = document.getElementById('cert-list-container');
    
    if (window.cacheCertificatesHistory && Array.isArray(window.cacheCertificatesHistory)) {
      cacheHistory = window.cacheCertificatesHistory;
      renderHistoryUI(window.cacheCertificatesHistory);
      return;
    }

    if (container) {
      container.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-circle-notch fa-spin mr-2"></i> กำลังโหลดประวัติ...</div>';
    }
    
    apiGet('getUserCertificates', withAuthParams({ phone: myPhone }))
      .then(function(res) {
        if (res && res.status === "success") {
          const list = res.history || res.data || [];
          cacheHistory = list;
          window.cacheCertificatesHistory = list;
          renderHistoryUI(list);
        } else {
          renderHistoryInitial();
        }
      }).catch(function() {
        renderHistoryInitial();
      });
  }

  function changeCertPage(direction) {
      currentCertPage += direction;
      renderHistoryUI(cacheHistory);
  }

  function handleCertClick(sourceName, score, existingUrl, sourceId, baseId, activityId) {
    if (existingUrl && existingUrl !== "undefined" && String(existingUrl).trim() !== "") {
      const win = window.open(existingUrl, '_blank');
      if (!win) {
        showCustomAlert('เบราว์เซอร์บล็อกการเปิดหน้าต่างใหม่<br><br><a href="' + existingUrl + '" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none;">คลิกที่นี่เพื่อดูใบประกาศ</a>', 'success', 'เปิดใบประกาศ');
      }
    } else {
      startGenerateCert(sourceName, score, sourceId, baseId, activityId);
    }
  }

  function startGenerateCert(sourceName, score, sourceId, baseId, activityId) {
    // 🌟 ดึงชื่อบริสุทธิ์จาก data-rawname แทนการใช้ innerText เพื่อป้องกันป้าย Rank ติดไปบนเกียรติบัตร
    const nameEl = document.getElementById('profile-name');
    const name = nameEl.getAttribute('data-rawname') || nameEl.innerText;
    
    const phone = localStorage.getItem("userPhone");
    if (!name || name === "ไม่ระบุชื่อ") return showCustomAlert("ระบบไม่พบชื่อของคุณ", "error");
    
    showLoading(true);
    apiPost('generateCert', { name: name, source: sourceName, score: score, phone: phone, sourceId: sourceId, baseId: baseId, activityId: activityId })
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

  function revokeCertConfirm(sourceId, baseId, sourceName, activityId) {
    showCustomConfirm(
      'ยืนยันยกเลิกใบเกียรติบัตร "' + sourceName + '" ?<br><small class="text-muted">คุณยังสร้างใบใหม่ได้ตามแบบปัจจุบัน</small>',
      function() {
        var phone = localStorage.getItem("userPhone");
        showLoading(true);
        apiPost('revokeCert', { phone: phone, sourceId: sourceId, baseId: baseId, activityId: activityId })
          .then(function(res) {
            showLoading(false);
            if (res.status === 'success') {
              cacheHistory = null;
              loadProfileData();
              showCustomAlert('ยกเลิกใบเกียรติบัตรเรียบร้อย กดรับใบประกาศใหม่ได้เลย', 'success');
            } else {
              showCustomAlert('เกิดข้อผิดพลาด: ' + (res.message || ''), 'error');
            }
          }).catch(function() {
            showLoading(false);
            showCustomAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
          });
      }
    );
  }
  function reGenerateCert(sourceName, score, sourceId, baseId, activityId) {
    const nameEl = document.getElementById('profile-name');
    const name = nameEl ? (nameEl.getAttribute('data-rawname') || nameEl.innerText) : '';
    const phone = localStorage.getItem("userPhone");
    
    showLoading(true);
    apiPost('generateCert', { 
      name: name, 
      source: sourceName, 
      score: score, 
      phone: phone, 
      sourceId: sourceId, 
      baseId: baseId, 
      activityId: activityId,
      force: true
    }).then(function(res) {
      showLoading(false);
      if (res && res.status === "success") { 
        cacheHistory = null; 
        if (typeof loadProfileData === 'function') loadProfileData(); 
        
        const win = window.open(res.url, '_blank');
        if (!win) {
          showCustomAlert('สร้างใบประกาศฉบับใหม่สำเร็จ!<br><br><a href="' + res.url + '" target="_blank" class="btn-primary" style="display:inline-block; text-decoration:none;">คลิกที่นี่เพื่อเปิดดู</a>', 'success', 'สำเร็จ');
        } else {
          showCustomAlert("สร้างใบประกาศฉบับใหม่ด้วยแม่แบบล่าสุดสำเร็จแล้ว", "success");
        }
      } else { 
        showCustomAlert("เกิดข้อผิดพลาด: " + (res.message || "ไม่สามารถสร้างใบประกาศใหม่ได้"), "error"); 
      }
    }).catch(function() { 
      showLoading(false); 
      showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error"); 
    });
  }

  window.loadUserCertificates = loadUserCertificates;
  window.changeCertPage = changeCertPage;
  window.handleCertClick = handleCertClick;
  window.startGenerateCert = startGenerateCert;
  window.reGenerateCert = reGenerateCert;
  window.revokeCertConfirm = revokeCertConfirm;



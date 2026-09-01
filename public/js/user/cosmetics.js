/**
 * cosmetics.js — GAMIFIED COSMETICS SHOP & FITTING ROOM MODULE
 */
(function () {
  'use strict';

  let currentShopData = null;
  let activeTab = 'shop'; // 'shop' or 'inventory'

  function getCosmeticCss(itemId) {
    const map = {
      'frame_gold': 'frame-gold',
      'frame_cyber': 'frame-cyber',
      'frame_fire': 'frame-fire',
      'frame_emerald': 'frame-emerald',
      'frame_rainbow': 'frame-rainbow',
      'frame_admin': 'frame-admin',
      'frame_teacher': 'frame-teacher',

      'glow_gold': 'glow-gold',
      'glow_neon': 'glow-neon',
      'glow_rainbow': 'glow-rainbow',
      'glow_fire': 'glow-fire',
      'glow_purple': 'glow-purple',
      'glow_admin': 'glow-admin',
      'glow_teacher': 'glow-teacher',

      'badge_crown': '👑 มกุฎราชกุมาร',
      'badge_lightning': '⚡️ สายฟ้าแห่งปัญญา',
      'badge_fire': '🔥 ผู้เรียนไฟแรง',
      'badge_diamond': '💎 ปราชญ์เพชรพร้าว',
      'badge_rocket': '🚀 นักเรียนติดเทอร์โบ',
      'badge_admin': '🛡️ ผู้ดูแลระบบ',
      'badge_teacher': '🎓 ครูผู้สอน',
    };
    return map[itemId] || '';
  }

  function applyCosmeticsToElement(avatarEl, nameEl, cosmetics) {
    if (!cosmetics || !cosmetics.equipped) return;
    const eq = cosmetics.equipped || {};

    // 1. Frame
    if (avatarEl) {
      avatarEl.classList.remove('frame-gold', 'frame-cyber', 'frame-fire', 'frame-emerald', 'frame-rainbow', 'frame-admin', 'frame-teacher');
      if (eq.frame) {
        const frameClass = getCosmeticCss(eq.frame);
        if (frameClass) avatarEl.classList.add(frameClass);
      }
    }

    // 2. Name Glow & Badge
    if (nameEl) {
      nameEl.classList.remove('glow-gold', 'glow-neon', 'glow-rainbow', 'glow-fire', 'glow-purple', 'glow-admin', 'glow-teacher');
      if (eq.name_glow) {
        const glowClass = getCosmeticCss(eq.name_glow);
        if (glowClass) nameEl.classList.add(glowClass);
      }

      // Badge tag
      const existingBadge = nameEl.querySelector('.cosmetics-badge-tag');
      if (existingBadge) existingBadge.remove();

      if (eq.badge) {
        const badgeLabel = getCosmeticCss(eq.badge);
        if (badgeLabel) {
          const bSpan = document.createElement('span');
          bSpan.className = 'cosmetics-badge-tag';
          bSpan.innerText = badgeLabel;
          nameEl.appendChild(bSpan);
        }
      }
    }
  }

  function openCosmeticsShopModal() {
    let modal = document.getElementById('cosmetics-shop-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cosmetics-shop-modal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML =
      modal.innerHTML =
        '<div class="modal-box cosmetics-shop-modal-box p-0 overflow-hidden">' +
        '<div class="p-4" style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; display: flex; justify-content: space-between; align-items: center; flex-shrink:0;">' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
        '<div style="width:40px; height:40px; border-radius:12px; background:rgba(245,158,11,0.2); border:1px solid #f59e0b; display:flex; align-items:center; justify-content:center; color:#f59e0b; font-size:1.2rem; flex-shrink:0;">' +
        '<i class="fas fa-magic"></i>' +
        '</div>' +
        '<div>' +
        '<h3 style="margin:0; font-size:1.1rem; font-weight:800; color:white;">ร้านค้าตกแต่ง & คลังสกิล</h3>' +
        '<p style="margin:0; font-size:0.75rem; color:#94a3b8;">แลกซื้อกรอบรูปเรืองแสง ชื่อสไตล์เกม และยศสัญลักษณ์ด้วยแต้มสะสม</p>' +
        '</div>' +
        '</div>' +
        '<button onclick="closeCosmeticsShopModal()" style="background:rgba(255,255,255,0.1); border:none; color:white; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; cursor:pointer;" aria-label="ปิดหน้าร้านค้า"><i class="fas fa-times"></i></button>' +
        '</div>' +

        '<div class="p-3" style="background:var(--bg1); border-bottom:1px solid var(--card-border); display:flex; justify-content:space-between; align-items:center; gap:10px; flex-shrink:0; flex-wrap:wrap;">' +
        '<div style="display:flex; gap:8px;">' +
        '<button id="btn-cosmetic-tab-shop" class="btn-primary" style="padding:6px 14px; font-size:0.82rem; border-radius:30px; background:var(--primary);" onclick="switchCosmeticsTab(\'shop\')">' +
        '<i class="fas fa-store mr-1"></i> ร้านค้าแลกซื้อ' +
        '</button>' +
        '<button id="btn-cosmetic-tab-inv" class="btn-primary" style="padding:6px 14px; font-size:0.82rem; border-radius:30px; background:var(--glass); color:var(--text); box-shadow:none; border:1px solid var(--card-border);" onclick="switchCosmeticsTab(\'inventory\')">' +
        '<i class="fas fa-tshirt mr-1"></i> คลังสวมใส่ของฉัน' +
        '</button>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:6px; background:rgba(245,158,11,0.12); padding:5px 12px; border-radius:20px; border:1px solid rgba(245,158,11,0.3); font-weight:800; color:#d97706; font-size:0.85rem;">' +
        '<i class="fas fa-coins text-amber-500"></i> <span id="modal-cosmetic-user-score">0</span> แต้ม' +
        '</div>' +
        '</div>' +

        '<div id="cosmetics-modal-body" class="p-4" style="flex-grow:1; overflow-y: auto;">' +
        '<div class="text-center py-5 text-muted"><i class="fas fa-spinner fa-spin mr-2"></i> กำลังโหลดร้านค้า...</div>' +
        '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }

    modal.style.display = 'flex';
    fetchAndRenderCosmetics();
  }

  function closeCosmeticsShopModal() {
    const modal = document.getElementById('cosmetics-shop-modal');
    if (modal) modal.style.display = 'none';
  }

  function fetchAndRenderCosmetics() {
    const phone = localStorage.getItem("userPhone") || "";
    showLoading(true);
    apiGet('getCosmeticsCatalog', withAuthParams({ phone: phone }))
      .then(function (res) {
        showLoading(false);
        if (res && res.status === 'success') {
          currentShopData = res;
          if (res.userScore !== undefined && typeof updateGlobalUserScore === 'function') {
            updateGlobalUserScore(res.userScore);
          }
          const scoreEl = document.getElementById('modal-cosmetic-user-score');
          if (scoreEl) scoreEl.innerText = Number(res.userScore || 0).toLocaleString();

          renderCurrentTab();
        } else {
          showCustomAlert(res.message || "ไม่สามารถโหลดร้านค้าได้", "error");
        }
      }).catch(function () {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการโหลดร้านค้า", "error");
      });
  }

  function switchCosmeticsTab(tab) {
    activeTab = tab;
    const btnShop = document.getElementById('btn-cosmetic-tab-shop');
    const btnInv = document.getElementById('btn-cosmetic-tab-inv');

    if (tab === 'shop') {
      if (btnShop) { btnShop.style.background = 'var(--primary)'; btnShop.style.color = 'white'; }
      if (btnInv) { btnInv.style.background = 'var(--glass)'; btnInv.style.color = 'var(--text)'; }
    } else {
      if (btnShop) { btnShop.style.background = 'var(--glass)'; btnShop.style.color = 'var(--text)'; }
      if (btnInv) { btnInv.style.background = 'var(--primary)'; btnInv.style.color = 'white'; }
    }
    renderCurrentTab();
  }

  function renderCurrentTab() {
    const container = document.getElementById('cosmetics-modal-body');
    if (!container || !currentShopData) return;

    if (activeTab === 'shop') {
      renderShopContent(container);
    } else {
      renderInventoryContent(container);
    }
  }

  function renderShopContent(container) {
    const data = currentShopData;
    const owned = (data.cosmetics && data.cosmetics.owned) ? data.cosmetics.owned : [];
    const catalog = data.catalog || {};

    let html = '';

    // Header Live Preview
    html += buildLivePreviewCard(data);

    // Section 1: กรอบรูปโปรไฟล์
    html += '<h4 class="font-bold text-sm mb-3 mt-4" style="color:var(--primary); display:flex; align-items:center; gap:6px;"><i class="fas fa-crown"></i> กรอบรูปโปรไฟล์สไตล์เกม (Avatar Frames)</h4>';
    html += '<div class="cosmetics-items-grid" style="margin-bottom:20px;">';
    (catalog.frames || []).forEach(function (item) {
      const isOwned = owned.includes(item.id);
      html += buildShopItemCard(item, isOwned, 'frame');
    });
    html += '</div>';

    // Section 2: ชื่อเรืองแสง
    html += '<h4 class="font-bold text-sm mb-3" style="color:var(--primary); display:flex; align-items:center; gap:6px;"><i class="fas fa-magic"></i> เอฟเฟกต์ชื่อเรืองแสง (Name Glow Effects)</h4>';
    html += '<div class="cosmetics-items-grid" style="margin-bottom:20px;">';
    (catalog.name_glows || []).forEach(function (item) {
      const isOwned = owned.includes(item.id);
      html += buildShopItemCard(item, isOwned, 'name_glow');
    });
    html += '</div>';

    // Section 3: ยศสัญลักษณ์
    html += '<h4 class="font-bold text-sm mb-3" style="color:var(--primary); display:flex; align-items:center; gap:6px;"><i class="fas fa-certificate"></i> สัญลักษณ์ประจำตัว (Title Badges)</h4>';
    html += '<div class="cosmetics-items-grid" style="margin-bottom:10px;">';
    (catalog.badges || []).forEach(function (item) {
      const isOwned = owned.includes(item.id);
      html += buildShopItemCard(item, isOwned, 'badge');
    });
    html += '</div>';

    container.innerHTML = html;
  }

  function buildLivePreviewCard(data) {
    const p = data.profile || {};
    const cosmetics = data.cosmetics || { equipped: {} };
    const eq = cosmetics.equipped || {};

    const name = localStorage.getItem("userName") || "ผู้เรียน สกร.";
    const avatarUrl = localStorage.getItem("userAvatar") || "";

    const frameClass = getCosmeticCss(eq.frame);
    const glowClass = getCosmeticCss(eq.name_glow);
    const badgeSymbol = getCosmeticCss(eq.badge);

    let html = '';
    html += '<div style="background:var(--bg1); padding:16px; border-radius:18px; border:1px solid var(--card-border); margin-bottom:20px; display:flex; align-items:center; gap:16px;">';

    // Avatar with frame
    html += '<div class="avatar-frame-wrap ' + frameClass + '" style="width:64px; height:64px; flex-shrink:0;">';
    html += '<div style="width:100%; height:100%; border-radius:50%; background-image:url(\'' + avatarUrl + '\'); background-size:cover; background-position:center; background-color:var(--primary-soft); display:flex; align-items:center; justify-content:center;">';
    if (!avatarUrl) html += '<i class="fas fa-user text-xl text-emerald-600"></i>';
    html += '</div>';
    html += '</div>';

    // Name & Title Preview
    html += '<div>';
    html += '<div style="font-size:0.75rem; color:var(--text-soft);">พรีวิวการแสดงผลปัจจุบันของคุณ:</div>';
    html += '<div style="font-size:1.1rem; font-weight:800; display:flex; align-items:center; gap:6px;" class="' + glowClass + '">';
    html += escapeJS(name);
    if (badgeSymbol) {
      html += '<span class="cosmetics-badge-tag">' + badgeSymbol + '</span>';
    }
    html += '</div>';
    html += '<div style="font-size:0.75rem; color:var(--primary); font-weight:bold; margin-top:2px;">' + (eq.frame ? 'ติดตั้งกรอบรูปแล้ว' : 'ยังไม่ติดตั้งกรอบ') + '</div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function buildShopItemCard(item, isOwned, category) {
    const isStaff = currentShopData && (currentShopData.isStaff || currentShopData.userRole === 'admin' || currentShopData.userRole === 'teacher');
    const equipped = (currentShopData && currentShopData.cosmetics && currentShopData.cosmetics.equipped) ? currentShopData.cosmetics.equipped : {};
    const isEquipped = equipped[category] === item.id;

    let previewElement = '';
    if (category === 'frame') {
      previewElement = '<div class="avatar-frame-wrap ' + item.cssClass + '" style="width:48px; height:48px; margin:0 auto;"><div style="width:100%; height:100%; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-size:1.2rem;">' + item.icon + '</div></div>';
    } else if (category === 'name_glow') {
      previewElement = '<div class="' + item.cssClass + '" style="font-size:1.05rem; font-weight:800; text-align:center;">' + item.icon + ' ' + item.name + '</div>';
    } else {
      previewElement = '<div style="text-align:center;"><span class="cosmetics-badge-tag" style="font-size:0.9rem; padding:4px 12px;">' + item.symbol + ' ' + item.name + '</span></div>';
    }

    let buttonHtml = '';
    if (isEquipped) {
      buttonHtml = '<button class="btn-primary w-100" style="padding:6px; font-size:0.78rem; background:#ef4444; color:white; border:none;" onclick="equipCosmeticAction(\'\', \'' + category + '\')"><i class="fas fa-times-circle mr-1"></i> ถอดออก</button>';
    } else if (isStaff) {
      buttonHtml = '<button class="btn-primary w-100" style="padding:6px; font-size:0.78rem; background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; box-shadow:0 3px 10px rgba(16,185,129,0.3);" onclick="equipCosmeticAction(\'' + item.id + '\', \'' + category + '\')"><i class="fas fa-magic mr-1"></i> สวมใส่ฟรี (สิทธิ์ครู/แอดมิน)</button>';
    } else if (isOwned) {
      buttonHtml = '<button class="btn-primary w-100" style="padding:6px; font-size:0.78rem; background:var(--primary); color:white; border:none;" onclick="equipCosmeticAction(\'' + item.id + '\', \'' + category + '\')"><i class="fas fa-magic mr-1"></i> ติดตั้งสวมใส่</button>';
    } else {
      buttonHtml = '<button class="btn-primary w-100" style="padding:6px; font-size:0.78rem; background:linear-gradient(135deg, #f59e0b, #d97706); border:none;" onclick="buyCosmeticAction(\'' + item.id + '\')"><i class="fas fa-coins mr-1"></i> แลก ' + item.price + ' แต้ม</button>';
    }

    let roleBadge = '';
    if (item.exclusiveRole) {
      const rName = item.exclusiveRole === 'admin' ? 'ผู้ดูแลระบบ' : 'คุณครู';
      roleBadge = '<span style="font-size:0.65rem; background:rgba(2,132,199,0.15); border:1px solid rgba(2,132,199,0.3); color:#0284c7; padding:1px 6px; border-radius:8px; display:inline-block; margin-top:2px;">เฉพาะ ' + rName + '</span>';
    }

    let html = '';
    html += '<div style="background:var(--bg2); border:1px solid ' + (isEquipped ? 'var(--primary)' : 'var(--card-border)') + '; border-radius:16px; padding:14px; display:flex; flex-direction:column; justify-space-between; gap:10px;">';
    html += '<div style="min-height:50px; display:flex; align-items:center; justify-content:center;">' + previewElement + '</div>';
    html += '<div style="text-align:center;">';
    html += '<div style="font-weight:bold; font-size:0.85rem; color:var(--text);">' + item.name + '</div>';
    html += roleBadge;
    html += '<div style="font-size:0.7rem; color:var(--text-soft); margin-top:2px;">' + (isEquipped ? '🟢 กำลังใช้งาน' : item.description) + '</div>';
    html += '</div>';
    html += buttonHtml;
    html += '</div>';

    return html;
  }

  function renderInventoryContent(container) {
    const data = currentShopData;
    const owned = (data.cosmetics && data.cosmetics.owned) ? data.cosmetics.owned : [];
    const equipped = (data.cosmetics && data.cosmetics.equipped) ? data.cosmetics.equipped : {};
    const catalog = data.catalog || {};

    let html = '';
    html += buildLivePreviewCard(data);

    if (!owned || owned.length === 0) {
      html += '<div class="text-center py-5 text-muted">';
      html += '<i class="fas fa-box-open text-4xl mb-3 block opacity-40"></i>';
      html += 'คุณยังไม่มีไอเทมในคลัง สามารถไปที่ <strong>"ร้านค้าแลกซื้อ"</strong> เพื่อใช้แต้มแลกเอฟเฟกต์ตกแต่งได้เลย!';
      html += '</div>';
      container.innerHTML = html;
      return;
    }

    const allItems = [];
    Object.keys(catalog).forEach(function (key) {
      (catalog[key] || []).forEach(function (it) {
        if (owned.includes(it.id)) {
          allItems.push(it);
        }
      });
    });

    html += '<h4 class="font-bold text-sm mb-3" style="color:var(--primary);"><i class="fas fa-tshirt mr-1"></i> ไอเทมที่คุณครอบครอง (' + allItems.length + ' รายการ)</h4>';
    html += '<div class="cosmetics-items-grid">';

    allItems.forEach(function (item) {
      const cat = item.category;
      const isEquipped = equipped[cat] === item.id;

      let btn = '';
      if (isEquipped) {
        btn = '<button class="btn-primary w-100" style="padding:6px; font-size:0.78rem; background:#ef4444; color:white; border:none;" onclick="equipCosmeticAction(\'\', \'' + cat + '\')"><i class="fas fa-times-circle mr-1"></i> ถอดออก</button>';
      } else {
        btn = '<button class="btn-primary w-100" style="padding:6px; font-size:0.78rem; background:var(--primary); color:white; border:none;" onclick="equipCosmeticAction(\'' + item.id + '\', \'' + cat + '\')"><i class="fas fa-magic mr-1"></i> ติดตั้งสวมใส่</button>';
      }

      html += '<div style="background:var(--bg2); border:1px solid ' + (isEquipped ? 'var(--primary)' : 'var(--card-border)') + '; border-radius:16px; padding:14px; display:flex; flex-direction:column; justify-space-between; gap:10px;">';
      html += '<div style="text-align:center; font-size:1.5rem;">' + item.icon + '</div>';
      html += '<div>';
      html += '<div style="font-weight:bold; font-size:0.85rem; color:var(--text); text-align:center;">' + item.name + '</div>';
      html += '<div style="font-size:0.7rem; color:var(--text-soft); text-align:center; margin-top:2px;">' + (isEquipped ? '🟢 กำลังติดตั้งใช้งาน' : item.description) + '</div>';
      html += '</div>';
      html += btn;
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  function buyCosmeticAction(itemId) {
    const phone = localStorage.getItem("userPhone") || "";
    showLoading(true);
    apiPost('buyCosmetic', withAuthData({ phone: phone, itemId: itemId }))
      .then(function (res) {
        showLoading(false);
        if (res && res.status === 'success') {
          showCustomAlert(res.message, "success");
          if (res.newScore !== undefined && typeof updateGlobalUserScore === 'function') {
            updateGlobalUserScore(res.newScore);
          }
          fetchAndRenderCosmetics();
          refreshAppProfileCosmetics();
        } else {
          showCustomAlert(res.message || "ไม่สามารถแลกซื้อได้", "error");
        }
      }).catch(function () {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function equipCosmeticAction(itemId, category) {
    const phone = localStorage.getItem("userPhone") || "";
    showLoading(true);
    apiPost('equipCosmetic', withAuthData({ phone: phone, itemId: itemId, category: category }))
      .then(function (res) {
        showLoading(false);
        if (res && res.status === 'success') {
          showCustomAlert(res.message, "success");
          fetchAndRenderCosmetics();
          refreshAppProfileCosmetics();
        } else {
          showCustomAlert(res.message || "ไม่สามารถเปลี่ยนสวมใส่ได้", "error");
        }
      }).catch(function () {
        showLoading(false);
        showCustomAlert("เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
      });
  }

  function refreshAppProfileCosmetics() {
    window.cacheProfile = null;
    if (typeof cacheLeaderboard !== 'undefined') cacheLeaderboard = null;
    if (typeof loadProfileData === 'function') loadProfileData(true);
    if (typeof loadHomePageData === 'function') loadHomePageData(true);
    if (typeof loadLeaderboard === 'function') loadLeaderboard();
  }

  window.openCosmeticsShopModal = openCosmeticsShopModal;
  window.closeCosmeticsShopModal = closeCosmeticsShopModal;
  window.switchCosmeticsTab = switchCosmeticsTab;
  window.buyCosmeticAction = buyCosmeticAction;
  window.equipCosmeticAction = equipCosmeticAction;
  window.applyCosmeticsToElement = applyCosmeticsToElement;
  window.getCosmeticCss = getCosmeticCss;
})();

// LOFT LEARN - User Coupons, Badges, & Lucky Spin Component
window.currentProductImages = [];
window.currentCropImageIndex = -1;

function parseProductImages(imageVal) {
  if (!imageVal) return [];
  if (Array.isArray(imageVal)) return imageVal.filter(Boolean);
  const trimmed = String(imageVal).trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (e) {
      console.error("Failed to parse product image array:", e);
    }
  }
  return [trimmed];
}
window.parseProductImages = parseProductImages;

if (typeof window.cacheHistory === 'undefined') window.cacheHistory = null;
let evalRating = 0;
let cacheProposals = null;
let allMarketProducts = [];
let cacheMarketProducts = null;

// Audio context variables (initialized lazily)
let audioCtx = null;

// Lucky spin wheel state variables
let isSpinning = false;
let currentWheelRotation = 0; // In radians
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

  function loadMarketData(forceFresh) {
    if (forceFresh) {
      cacheMarketProducts = null;
    }
    const grid = document.getElementById('market-products-grid');
    if (!grid) return;

    if (typeof refreshInstitutionsGlobal === 'function') {
      refreshInstitutionsGlobal(function() {
        if (typeof onMarketDistrictFilterChange === 'function') {
          onMarketDistrictFilterChange();
        }
      });
    }
    
    // แสดงปุ่ม "เพิ่มสินค้าใหม่" เฉพาะ ครู และ แอดมิน
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const addBtn = document.getElementById('btn-admin-add-product');
    const manageBackBtn = document.getElementById('btn-market-manage-back');
    const isStaff = role === "admin" || role === "teacher";
    if (addBtn) {
      addBtn.style.display = isStaff ? "inline-block" : "none";
    }
    if (manageBackBtn) manageBackBtn.style.display = isStaff ? "inline-block" : "none";

    // หากมีข้อมูลสินค้าในแคชอยู่แล้ว ให้แสดงผลทันทีโดยไม่ต้องยิง API ซ้ำ (Instant Load < 10ms)
    if (cacheMarketProducts && Array.isArray(cacheMarketProducts) && cacheMarketProducts.length > 0) {
      allMarketProducts = cacheMarketProducts;
      renderMarketProducts(allMarketProducts);
      return;
    }
    
    grid.innerHTML = '<div class="col-span-2 text-center py-12 text-muted text-sm"><i class="fas fa-circle-notch fa-spin fa-2x mb-2" style="color:var(--primary)"></i><p>กำลังโหลดสินค้าชุมชน...</p></div>';
    
    apiGet('getProducts')
      .then(function(res) {
        if (res.status === "success" && Array.isArray(res.data)) {
          const products = res.data.map(function(item) {
            const images = Array.isArray(item.images) ? item.images : parseProductImages(item.image || item.imageUrl || '');
            return Object.assign({}, item, {
              productId: String(item.productId ?? item.id ?? ''),
              price: String(item.price ?? item.cost ?? ''),
              image: item.image || (images.length > 1 ? JSON.stringify(images) : (images[0] || '')),
              images: images,
            });
          });
          cacheMarketProducts = products;
          allMarketProducts = products;
          renderMarketProducts(products);
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
    const myInstitutionId = String(localStorage.getItem("userInstitution") || localStorage.getItem("userInstitutionId") || "INS_PHRAO").trim();
    const isSuperAdmin = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : (myInstitutionId === "ALL" || myInstitutionId === "ทั้งหมด");

    let html = '';
    products.forEach(function(item) {
      let isMyProduct = isSuperAdmin;
      if (!isMyProduct && (role === "admin" || role === "teacher")) {
        if ((myInstitutionId === "INS_MAERIM" || myInstitutionId === "MAERIM") && (item.district === "อำเภอแม่ริม" || item.district === "แม่ริม")) isMyProduct = true;
        else if ((myInstitutionId === "INS_PHRAO" || myInstitutionId === "PHRAO") && (item.district === "อำเภอพร้าว" || item.district === "พร้าว" || !item.district)) isMyProduct = true;
      }
      const categoryLabel = item.category === 'OTOP' ? 'สินค้า OTOP' : (item.category === 'Wisdom' ? 'ภูมิปัญญา' : (item.category === 'Agriculture' ? 'การเกษตร' : 'อื่น ๆ'));
      const price = String(item.price || '0');
      const priceText = /บาท|฿/.test(price) ? price : price + ' บาท';
      
      const parsedImgs = parseProductImages(item.image);
      const firstImg = parsedImgs.length > 0 ? parsedImgs[0] : '';
      let coverUrl = getValidImageUrl(firstImg);
      if (!coverUrl) coverUrl = LOFT_PLACEHOLDER_IMAGE;

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

  function onMarketDistrictFilterChange() {
    const districtEl = document.getElementById('market-district-filter');
    const tambonEl = document.getElementById('market-tambon-filter');
    const dVal = districtEl ? districtEl.value : '';

    if (tambonEl) {
      if (dVal && dVal !== 'all' && dVal !== 'ทั้งหมด') {
        const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(dVal) : [];
        let html = '<option value="" selected>🌍 ทุกสถานศึกษาในสังกัด (' + dVal + ')</option>';
        subUnits.forEach(function(u) {
          html += '<option value="' + u + '">' + u + '</option>';
        });
        tambonEl.innerHTML = html;
      } else {
        tambonEl.innerHTML = '<option value="" selected>🌍 ทุกสถานศึกษาในสังกัด (รวมทุกอำเภอ)</option>';
      }
      tambonEl.value = "";
    }
    filterMarketProducts();
  }
  window.onMarketDistrictFilterChange = onMarketDistrictFilterChange;

  function filterMarketProducts() {
    const query = (document.getElementById('market-search').value || '').trim().toLowerCase();
    const districtFilter = (document.getElementById('market-district-filter')?.value || '').trim();
    const tambonFilter = (document.getElementById('market-tambon-filter')?.value || '').trim();
    const catFilter = (document.getElementById('market-category-filter')?.value || '').trim();

    let filtered = allMarketProducts || [];

    if (query) {
      filtered = filtered.filter(function(item) {
        const text = [item.name, item.description, item.district, item.tambon, item.category].join(' ').toLowerCase();
        return text.indexOf(query) > -1;
      });
    }

    if (districtFilter && districtFilter !== 'all' && districtFilter !== 'ทั้งหมด') {
      filtered = filtered.filter(function(item) {
        return (item.district || 'อำเภอพร้าว') === districtFilter;
      });
    }

    if (tambonFilter && tambonFilter !== 'all' && tambonFilter !== 'ทั้งหมด') {
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
    const detailPrice = String(item.price || '0');
    document.getElementById('product-detail-price').innerText = /บาท|฿/.test(detailPrice) ? detailPrice : detailPrice + ' บาท';
    document.getElementById('product-detail-desc').innerText = item.description || "ไม่มีรายละเอียดเพิ่มเติม";
    document.getElementById('product-detail-tambon-badge').innerText = formatTambon(item.tambon);
    
    const catLabels = { 'OTOP': 'สินค้า OTOP', 'Wisdom': 'ภูมิปัญญาท้องถิ่น', 'Agriculture': 'เกษตรชุมชน', 'Other': 'อื่น ๆ' };
    document.getElementById('product-detail-cat-badge').innerText = catLabels[item.category] || "อื่น ๆ";
    document.getElementById('product-detail-contact').innerText = item.contact;
    
    const images = parseProductImages(item.image);
    const slidesCont = document.getElementById('product-detail-slides');
    const dotsCont = document.getElementById('product-detail-dots');
    
    if (slidesCont && dotsCont) {
      slidesCont.innerHTML = '';
      dotsCont.innerHTML = '';
      
      const displayImages = images.length > 0 ? images : [LOFT_PLACEHOLDER_IMAGE];
      
      displayImages.forEach((url, index) => {
        const slide = document.createElement('div');
        slide.className = 'w-full h-full flex-shrink-0 snap-start bg-cover bg-center';
        slide.style.backgroundImage = "url('" + getValidImageUrl(url) + "')";
        slide.style.minWidth = '100%';
        slidesCont.appendChild(slide);
        
        if (displayImages.length > 1) {
          const dot = document.createElement('span');
          dot.className = 'product-detail-dot w-2 h-2 rounded-full transition-all duration-300';
          dot.style.background = 'rgba(255,255,255,0.4)';
          dot.style.display = 'inline-block';
          if (index === 0) {
            dot.classList.add('active');
            dot.style.background = 'var(--primary)';
          }
          dot.setAttribute('data-index', index);
          dotsCont.appendChild(dot);
        }
      });
      
      if (displayImages.length > 1) {
        slidesCont.onscroll = function() {
          const width = slidesCont.offsetWidth || 1;
          const index = Math.round(slidesCont.scrollLeft / width);
          const dots = dotsCont.querySelectorAll('.product-detail-dot');
          dots.forEach((dot, idx) => {
            if (idx === index) {
              dot.classList.add('active');
              dot.style.background = 'var(--primary)';
            } else {
              dot.classList.remove('active');
              dot.style.background = 'rgba(255,255,255,0.4)';
            }
          });
        };
      } else {
        slidesCont.onscroll = null;
      }
    }

    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const myInstitutionId = String(localStorage.getItem("userInstitution") || localStorage.getItem("userInstitutionId") || "INS_PHRAO").trim();
    const isSuperAdmin = typeof isSuperAdminUser === 'function' ? isSuperAdminUser() : (myInstitutionId === "ALL" || myInstitutionId === "ทั้งหมด");
    let isMyProduct = isSuperAdmin;
    if (!isMyProduct && (role === "admin" || role === "teacher")) {
      if ((myInstitutionId === "INS_MAERIM" || myInstitutionId === "MAERIM") && (item.district === "อำเภอแม่ริม" || item.district === "แม่ริม")) isMyProduct = true;
      else if ((myInstitutionId === "INS_PHRAO" || myInstitutionId === "PHRAO") && (item.district === "อำเภอพร้าว" || item.district === "พร้าว" || !item.district)) isMyProduct = true;
    }
    const adminActionsEl = document.getElementById('product-detail-admin-actions');
    if (adminActionsEl) {
      adminActionsEl.style.display = isMyProduct ? 'flex' : 'none';
    }

    document.getElementById('product-detail-modal').style.display = 'flex';
  }

  function redeemCouponUI(points, discount) {
    const userPhone = localStorage.getItem("userPhone") || "";
    if (!userPhone || localStorage.getItem("userRole") === "guest") {
      showCustomConfirm("ฟีเจอร์แลกของรางวัลเฉพาะสมาชิกนักศึกษา กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อสะสมคะแนน", function() {
        if (typeof logoutNoConfirm === "function") logoutNoConfirm();
      });
      return;
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
    const previewEl = document.getElementById('admin-product-preview');
    if (previewEl) previewEl.style.display = 'none';
    
    const titleEl = document.getElementById('product-form-title');
    const modeEl = document.getElementById('admin-product-mode');
    const idEl = document.getElementById('admin-product-id');
    const tambonSelect = document.getElementById('admin-product-tambon');
    
    modeEl.value = mode;
    
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const userTambon = (localStorage.getItem("userTambon") || "").trim();
    const myInstitutionId = String(localStorage.getItem("userInstitution") || localStorage.getItem("userInstitutionId") || "INS_PHRAO").trim();
    
    let targetInst = myInstitutionId;
    if (mode === 'edit' && productId) {
      const item = allMarketProducts.find(p => String(p.productId) === String(productId));
      if (item && item.district) {
        targetInst = item.district;
      }
    }
    const subUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(targetInst) : [];
    let optHtml = '<option value="" disabled selected>— เลือกสถานศึกษาในสังกัด (ศกร.ระดับตำบล / ศศช.) —</option>';
    subUnits.forEach(function(u) {
      optHtml += '<option value="' + u + '">' + u + '</option>';
    });
    tambonSelect.innerHTML = optHtml;

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
      window.currentProductImages = [];
      renderProductFormThumbnails();
    } else if (mode === 'edit') {
      titleEl.innerHTML = '<i class="fas fa-edit mr-2" style="color:var(--primary)"></i>แก้ไขข้อมูลสินค้า';
      
      const item = allMarketProducts.find(p => String(p.productId) === String(productId));
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

      window.currentProductImages = parseProductImages(item.image);
      renderProductFormThumbnails();
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

    const myInst = String(localStorage.getItem("userInstitution") || localStorage.getItem("userInstitutionId") || "INS_PHRAO").trim();
    let prodDistrict = 'อำเภอพร้าว';
    if (myInst === 'INS_MAERIM' || myInst === 'MAERIM' || myInst === 'อำเภอแม่ริม') {
      prodDistrict = 'อำเภอแม่ริม';
    } else {
      const mrUnits = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution('INS_MAERIM') : [];
      if (mrUnits.includes(formatTambon(tambon))) {
        prodDistrict = 'อำเภอแม่ริม';
      }
    }

    const payload = {
      mode: mode,
      productId: productId,
      name: name,
      category: category,
      price: price,
      district: prodDistrict,
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
          loadMarketData(true);
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
            loadMarketData(true);
          } else {
            showCustomAlert(res.message || "ลบผลิตภัณฑ์ล้มเหลว", "error");
          }
        }).catch(function() {
          showLoading(false);
          showCustomAlert("เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์", "error");
        });
    });
  }

  function openCouponWalletModal() {
    const showModal = function() {
      const modal = document.getElementById('coupon-wallet-modal');
      if (modal) {
        modal.style.display = 'flex';
        switchWalletTab('coupons');
      } else {
        console.error("Coupon wallet modal element not found!");
        showCustomAlert("ไม่สามารถแสดงหน้าต่างคูปองได้ เนื่องจากไม่พบอ็อบเจกต์ในระบบ", "error");
      }
    };

    if (window.ensureMarketLoaded) {
      window.ensureMarketLoaded(showModal);
    } else {
      showModal();
    }
  }

  function openPointsHistoryModal() {
    const showModal = function() {
      const modal = document.getElementById('coupon-wallet-modal');
      if (modal) {
        modal.style.display = 'flex';
        switchWalletTab('ledger');
      } else {
        if (typeof showCustomAlert === 'function') {
          showCustomAlert("ไม่สามารถแสดงหน้าต่างประวัติคะแนนได้", "error");
        }
      }
    };

    if (window.ensureMarketLoaded) {
      window.ensureMarketLoaded(showModal);
    } else {
      showModal();
    }
  }

  function closeCouponWalletModal() {
    const modal = document.getElementById('coupon-wallet-modal');
    if (modal) {
      modal.style.display = 'none';
    }
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
            
            const redeemedAt = item.redeemedAt || item.createdAt || item.created_at || item.usedAt || '-';
            const discountAmount = (item.discountAmount !== undefined && item.discountAmount !== null) ? item.discountAmount : (item.cost || 0);
            const pointsUsed = (item.pointsUsed !== undefined && item.pointsUsed !== null) ? item.pointsUsed : (item.cost || 0);
            
            html += `
              <div class="loft-card p-3 rounded-2xl flex flex-col gap-2 relative transition-all" style="background:${cardBg}; border:1px solid ${borderColor}; opacity: ${isActive ? '1' : '0.6'}; margin-top: 5px;">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold px-2.5 py-0.5 rounded-full" style="background:${isActive ? 'var(--primary-light)' : 'var(--glass)'}; color:${isActive ? 'var(--primary)' : 'var(--text-soft)'};">
                    ${statusLabel}
                  </span>
                  <span class="text-xs text-muted" style="font-size:0.7rem;"><i class="far fa-clock mr-1"></i>${redeemedAt}</span>
                </div>
                <div class="flex flex-col mt-1">
                  <h4 class="font-black text-sm text-theme-inv" style="font-size:0.9rem; line-height:1.2;">${item.productName || 'คูปองส่วนลด OTOP'}</h4>
                  <div class="flex items-baseline gap-1 mt-1">
                    <span class="text-xs" style="color:var(--text-soft);">มูลค่าส่วนลด:</span>
                    <span class="text-base font-black text-theme-inv" style="color:var(--gold)">฿${discountAmount}</span>
                    <span class="text-xs text-muted" style="font-size:0.7rem;">(${pointsUsed} แต้ม)</span>
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
          const history = res.data || res.history || [];
          if (history.length === 0) {
            container.innerHTML = `
              <div class="text-center py-10 px-4 text-muted text-sm loft-card" style="background:var(--glass); border:1px dashed var(--glass-border); margin-top: 10px;">
                <div class="text-4xl mb-3">📈</div>
                <div class="font-bold text-theme-inv mb-1">ยังไม่มีประวัติคะแนน</div>
                <div style="color:var(--text-soft); font-size: 0.8rem; line-height: 1.4;">เริ่มเรียนรู้ ทำแบบทดสอบ หมุนวงล้อ และส่งกิจกรรมเพื่อสะสมคะแนนกันเลย!</div>
              </div>
            `;
            return;
          }

          let html = '<div class="points-timeline flex flex-col gap-2 relative">';
          history.forEach(function(item) {
            const rawPts = String(item.points || item.pointsNum || '0');
            const isPlus = rawPts.startsWith('+') || (typeof item.pointsNum === 'number' && item.pointsNum > 0);
            const color = isPlus ? '#10b981' : '#f97316';
            const displayPts = rawPts.startsWith('+') || rawPts.startsWith('-') ? rawPts : ((isPlus ? '+' : '') + rawPts);
            const dateDisplay = item.dateStr || item.date || '-';
            const icon = item.type === 'quiz' ? 'fa-pen-fancy' 
                         : (item.type === 'log' || item.type === 'upskill_log') ? 'fa-book-open' 
                         : item.type === 'spin' ? 'fa-dharmachakra'
                         : 'fa-ticket-alt';
            
            html += `
              <div class="loft-card p-3 rounded-2xl flex items-center gap-3 transition-all" style="background:var(--glass); border:1px solid var(--glass-border); margin-top: 5px;">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0" style="background:${isPlus ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.12)'}; border:1px solid ${isPlus ? 'rgba(16,185,129,0.2)' : 'rgba(249,115,22,0.2)'}; color:${color}; font-size: 0.7rem;">
                  <i class="fas ${icon}"></i>
                </div>
                <div class="flex-1 flex flex-col min-w-0">
                  <span class="text-xs font-bold text-theme-inv leading-tight truncate" style="font-size:0.8rem;">${item.description || 'รายการแต้ม'}</span>
                  <span class="text-xxs text-muted mt-1" style="font-size:0.65rem;"><i class="far fa-clock mr-1"></i>${dateDisplay}</span>
                </div>
                <div class="font-black text-xs text-right shrink-0" style="color:${color}; font-size: 0.8rem;">
                  ${displayPts} แต้ม
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

  function loadUserBadges(forceFresh) {
    if (forceFresh) window.cacheUserBadgesData = null;
    const container = document.getElementById('badges-shelf-container');
    if (!container) return;

    if (window.cacheUserBadgesData && Array.isArray(window.cacheUserBadgesData)) {
      renderBadgesUI(window.cacheUserBadgesData);
      return;
    }

    container.innerHTML = '<div class="text-center py-4 text-muted text-sm col-span-4">' +
                            '<i class="fas fa-circle-notch fa-spin mr-2" style="color:var(--primary)"></i>กำลังโหลดเหรียญเกียรติยศ...' +
                          '</div>';

    const myPhone = localStorage.getItem("userPhone") || "";

    apiGet('getUserBadges', myPhone ? { phone: myPhone } : {})
      .then(function(res) {
        const badges = Array.isArray(res.badges) ? res.badges : (Array.isArray(res.data) ? res.data : []);
        if (res.status === "success") {
          window.cacheUserBadgesData = badges;
          renderBadgesUI(badges);
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

    badges = (Array.isArray(badges) ? badges : []).map(function(badge, index) {
      const currentValue = Math.max(0, Number(badge && badge.currentValue) || 0);
      const targetValue = Math.max(1, Number(badge && badge.targetValue) || 1);
      return {
        id: String((badge && (badge.id || badge.badgeKey)) || ('badge-' + index)),
        name: String((badge && badge.name) || 'เหรียญเกียรติยศ'),
        description: String((badge && badge.description) || 'สะสมความก้าวหน้าเพื่อปลดล็อกเหรียญนี้'),
        icon: String((badge && badge.icon) || 'fa-award'),
        color: String((badge && badge.color) || '#d97706'),
        currentValue: currentValue,
        targetValue: targetValue,
        unlocked: Boolean(badge && badge.unlocked)
      };
    });

    if (!badges.length) {
      container.innerHTML = '<div class="text-center py-4 text-muted text-sm col-span-4">ยังไม่มีข้อมูลเหรียญเกียรติยศ</div>';
      return;
    }

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
    if (localStorage.getItem("userRole") === "guest") {
      showCustomConfirm("ฟีเจอร์วงล้อเสี่ยงโชคเฉพาะสมาชิกนักศึกษา กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อร่วมสนุก", function() {
        if (typeof logoutNoConfirm === "function") logoutNoConfirm();
      });
      return;
    }
    if (window.ensureMarketLoaded) {
      window.ensureMarketLoaded(function() {
        document.getElementById('lucky-spin-modal').style.display = 'flex';
        const userScore = localStorage.getItem("userScore") || "0";
        document.getElementById('spin-user-score').innerText = userScore;
        setTimeout(drawLuckyWheel, 100);
        initAudioContext();
      });
    } else {
      document.getElementById('lucky-spin-modal').style.display = 'flex';
      const userScore = localStorage.getItem("userScore") || "0";
      document.getElementById('spin-user-score').innerText = userScore;
      setTimeout(drawLuckyWheel, 100);
      initAudioContext();
    }
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
  window.openPointsHistoryModal = openPointsHistoryModal;
  window.closeCouponWalletModal = closeCouponWalletModal;
  window.switchWalletTab = switchWalletTab;
  window.loadUserCoupons = loadUserCoupons;
  window.loadUserPointsHistory = loadUserPointsHistory;
  window.copyCouponCode = copyCouponCode;
  window.loadUserBadges = loadUserBadges;
  window.viewBadgeDetail = viewBadgeDetail;

  function renderProductFormThumbnails() {
    const container = document.getElementById('admin-product-images-container');
    const addBtn = document.getElementById('btn-add-product-image');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!window.currentProductImages) {
      window.currentProductImages = [];
    }
    
    window.currentProductImages.forEach((url, index) => {
      const item = document.createElement('div');
      item.className = 'admin-product-thumb-item relative group rounded-xl overflow-hidden border border-white/10';
      item.style.width = '80px';
      item.style.height = '80px';
      item.style.backgroundImage = "url('" + getValidImageUrl(url) + "')";
      item.style.backgroundSize = 'cover';
      item.style.backgroundPosition = 'center';
      
      // Hover Overlay Actions
      item.innerHTML = `
        <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200">
          <button type="button" class="text-xs text-white hover:text-primary p-1" onclick="cropFormProductImage(${index})" title="ปรับสัดส่วน" style="background:none; border:none; cursor:pointer;">
            <i class="fas fa-crop-alt"></i>
          </button>
          <button type="button" class="text-xs text-white hover:text-red-500 p-1" onclick="removeFormProductImage(${index})" title="ลบ" style="background:none; border:none; cursor:pointer;">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
    
    // Update hidden input with current images state
    const hiddenInput = document.getElementById('admin-product-image');
    if (hiddenInput) {
      if (window.currentProductImages.length === 0) {
        hiddenInput.value = '';
      } else if (window.currentProductImages.length === 1) {
        hiddenInput.value = window.currentProductImages[0];
      } else {
        hiddenInput.value = JSON.stringify(window.currentProductImages);
      }
    }
    
    // Hide "Add" button if we have reached 5 images
    if (addBtn) {
      addBtn.style.display = window.currentProductImages.length >= 5 ? 'none' : 'block';
    }
  }

  function removeFormProductImage(index) {
    if (!window.currentProductImages) return;
    window.currentProductImages.splice(index, 1);
    renderProductFormThumbnails();
  }

  function cropFormProductImage(index) {
    if (!window.currentProductImages) return;
    const url = window.currentProductImages[index];
    if (url) {
      window.currentCropImageIndex = index;
      currentCropContext = 'product';
      currentFileName = "product_" + Date.now() + ".jpg";
      openCropModal(url);
    }
  }

  // Stubs for backwards compatibility
  function updateProductAdjustButton() {}
  function adjustProductImage() {}

  window.renderProductFormThumbnails = renderProductFormThumbnails;
  window.removeFormProductImage = removeFormProductImage;
  window.cropFormProductImage = cropFormProductImage;
  window.updateProductAdjustButton = updateProductAdjustButton;
  window.adjustProductImage = adjustProductImage;

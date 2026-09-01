// LOFT LEARN - User Learning & Quiz Flow Component
(function() {
  const markerStyles = `
.custom-icon-container {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
.custom-map-marker {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.marker-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 3px solid #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  position: relative;
  z-index: 10;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.custom-map-marker:hover .marker-circle {
  transform: scale(1.18);
  border-color: var(--primary, #10b981);
}
.marker-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32px;
  height: 32px;
  margin-top: -16px;
  margin-left: -16px;
  border-radius: 50%;
  background: var(--primary, #10b981);
  opacity: 0;
  z-index: 1;
  pointer-events: none;
  animation: marker-pulse 2.2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
}
.ripple-2 {
  animation-delay: 0.9s;
}
@keyframes marker-pulse {
  0% {
    transform: scale(1);
    opacity: 0.75;
  }
  100% {
    transform: scale(2.4);
    opacity: 0;
  }
}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = markerStyles;
  document.head.appendChild(styleEl);
})();
let currentQuizData = [];   
let currentQuestionIndex = 0; 
let userScore = 0;          
let selectedAnswer = "";    
let quizAnswers = {};
let activeSourceId = "";    
let activeBaseId = "";
let activeSourceDetailData = null;
let activeBaseTab = "pretest";
let currentQuizMode = "posttest";
let learningViewMode = "intro"; // 'intro', 'list' หรือ 'content'
let cacheSources = null;
let cacheSourceDetails = {};
let cacheMapSources = null;
let districtMap = null;
let mapMarkers = [];
let mapPicker = null;
let mapPickerMarker = null;
let currentMapPickerTarget = 'admin-source-coord';

  function updateMapTambonOptions(instId) {
    const filterSelect = document.getElementById('map-tambon-filter');
    if (!filterSelect) return;
    const tambons = typeof getSubUnitsForInstitution === 'function' ? getSubUnitsForInstitution(instId) : [];
    
    let html = '<option value="">📍 ทุกสถานศึกษาในสังกัด (ทั้งหมด)</option>';
    tambons.forEach(function(t) {
      html += '<option value="' + t + '">' + t + '</option>';
    });
    filterSelect.innerHTML = html;
  }

  function onMapInstitutionChange() {
    const instSelect = document.getElementById('map-institution-filter');
    const instId = instSelect ? instSelect.value : 'ALL';
    updateMapTambonOptions(instId);
    cacheMapSources = null; // เคลียร์แคชเพื่อโหลดข้อมูลอำเภอนั้นใหม่
    loadDistrictMap();
  }
  window.onMapInstitutionChange = onMapInstitutionChange;

  function loadDistrictMap() {
    const role = String(localStorage.getItem("userRole") || "user").trim().toLowerCase();
    const isTeacher = role === 'teacher';
    const isDistrictAdmin = role === 'admin' && typeof isSuperAdminUser === 'function' && !isSuperAdminUser();
    const userInst = localStorage.getItem("userInstitution") || "INS_PHRAO";
    const instSelect = document.getElementById('map-institution-filter');

    let instId = 'ALL';
    if (instSelect) {
      // ผู้เรียน, บุคคลทั่วไป, และ Super Admin สามารถเลือกดูได้ทุกอำเภอ
      instSelect.style.display = (isTeacher || isDistrictAdmin) ? 'none' : 'block';
      if (isTeacher || isDistrictAdmin) {
        instSelect.value = userInst;
        instId = userInst;
      } else {
        instId = instSelect.value || 'ALL';
      }
    }

    updateMapTambonOptions(instId);

    // โหลดข้อมูลสำหรับแผนที่ตามสถานศึกษา/อำเภอที่เลือก (หรือทั้งหมด)
    showLoading(true);
    apiGet('getMapSources', withAuthParams({ institutionId: instId }))
      .then(function(sources) {
        showLoading(false);
        cacheMapSources = sources;
        renderDistrictMap();
      }).catch(function() { showLoading(false); });
  }

  function openMapPicker(targetInputId) {
    currentMapPickerTarget = targetInputId || 'admin-source-coord';
    document.getElementById('map-picker-modal').style.display = 'flex';
    
    // ดึงค่าปัจจุบันจาก input (ถ้ามี)
    const currentCoord = document.getElementById(currentMapPickerTarget).value.trim();
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
      document.getElementById(currentMapPickerTarget).value = pos.lat.toFixed(15) + ', ' + pos.lng.toFixed(15);
    }
    closeMapPicker();
  }

  function closeMapPicker() {
    document.getElementById('map-picker-modal').style.display = 'none';
  }

  function toggleMapListPanel(forceOpen) {
    const page = document.getElementById('map-page');
    if (!page) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !page.classList.contains('map-list-open');
    page.classList.toggle('map-list-open', shouldOpen);
    setTimeout(function() {
      if (districtMap) districtMap.invalidateSize();
    }, 260);
  }
  window.toggleMapListPanel = toggleMapListPanel;

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

    const filterInst = (document.getElementById('map-institution-filter') || {}).value || '';
    const filterTambon = (document.getElementById('map-tambon-filter') || {}).value || '';
    const filterType = (document.getElementById('map-type-filter') || {}).value || '';
    const listContainer = document.getElementById('map-list-container');
    let listHtml = '';

    if (cacheMapSources) {
       const bounds = []; 

       cacheMapSources.forEach(function(source) {
         // กรองตามสถานศึกษา/อำเภอ
         if (filterInst && filterInst !== 'ALL' && filterInst !== 'ทั้งหมด') {
           const srcInst = source.institutionId || source.institution_id || 'INS_PHRAO';
           if (srcInst !== filterInst) return;
         }

         // กรองตามตำบล
         if (filterTambon && normalizeTambon(source.TambonName) !== normalizeTambon(filterTambon)) return;

         // กรองตามประเภทแหล่งเรียนรู้ (3 ประเภท)
         if (filterType) {
           const sType = String(source.sourceType || source.source_type || '').trim();
           if (filterType === 'บุคคล' || filterType === 'person') {
             if (sType !== 'บุคคล' && sType !== 'person') return;
           } else if (filterType === 'สื่อ' || filterType === 'media') {
             if (sType !== 'สื่อ' && sType !== 'media') return;
           } else if (filterType === 'สถานที่' || filterType === 'place') {
             if (sType !== 'สถานที่' && sType !== 'place' && sType !== '') return;
           }
         }

         // เพิ่มหมุดลงแผนที่
         if (source.Latitude && source.Longitude) {
           const lat = parseFloat(source.Latitude); const lng = parseFloat(source.Longitude);
           if(!isNaN(lat) && !isNaN(lng)) {
             bounds.push([lat, lng]);

             // ดึงภาพปกมาแสดงเป็นวงกลมหมุดแผนที่
             let rawUrl = source.CoverImageURL;
             if (!rawUrl || rawUrl === 'undefined') rawUrl = source.CoverImage;
             if (!rawUrl || rawUrl === 'undefined') rawUrl = '';
             const imgUrl = getValidImageUrl(rawUrl);

             // สร้างหมุดแบบวงกลมรูปปกพร้อมเอฟเฟคคลื่นกระจาย
             const customIcon = L.divIcon({
               className: 'custom-icon-container',
               html: '<div class="custom-map-marker">' +
                       '<div class="marker-ripple"></div>' +
                       '<div class="marker-ripple ripple-2"></div>' +
                       '<div class="marker-circle" style="background-image: url(\'' + imgUrl + '\');"></div>' +
                     '</div>',
               iconSize: [40, 40],
               iconAnchor: [20, 20],
               popupAnchor: [0, -20]
             });

             const marker = L.marker([lat, lng], {icon: customIcon}).addTo(districtMap);
             const descText = source.Description || "สัมผัสประสบการณ์การเรียนรู้และภูมิปัญญาท้องถิ่นในแหล่งเรียนรู้นี้";
             const viewsVal = Number(source.Views) || 0;
             const popupHtml = 
               '<div class="map-glass-popup">' +
                 (imgUrl ? '<div class="map-popup-img" style="background-image: url(\'' + imgUrl + '\');"></div>' : '') +
                 '<div class="map-popup-content-inner">' +
                   '<h4 class="map-popup-title">' + source.SourceName + '</h4>' +
                   '<div class="map-popup-meta">' +
                     '<span>📍 ' + formatTambon(source.TambonName) + '</span>' +
                     '<span class="map-popup-views"><i class="far fa-eye mr-1"></i><span id="views-count-' + source.SourceID + '">' + (viewsVal).toLocaleString() + ' ครั้ง</span></span>' +
                   '</div>' +
                   '<p class="map-popup-desc">' + descText + '</p>' +
                   '<button onclick="openSourceDetail(\'' + escapeJS(source.SourceID) + '\')" class="map-popup-btn">' +
                     '<i class="fas fa-book-open mr-1"></i> เข้าสู่บทเรียน' +
                   '</button>' +
                 '</div>' +
               '</div>';
             marker.bindPopup(popupHtml, { minWidth: 280, maxWidth: 280, autoPan: true });
             marker.on('click', function() {
               apiPost('viewSource', { sourceId: source.SourceID })
                 .then(function(res) {
                   if (res && res.status === 'success' && res.views !== undefined) {
                     const viewsEl = document.getElementById('views-count-' + source.SourceID);
                     if (viewsEl) {
                       viewsEl.innerText = Number(res.views).toLocaleString() + ' ครั้ง';
                     }
                     source.Views = res.views;
                   }
                 }).catch(function(e) {
                   console.error("Failed to increment views:", e);
                 });
             });
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
       listContainer.innerHTML = '<div class="map-list-panel-head">' +
           '<div><h4>แหล่งเรียนรู้</h4><p>เลือกจากรายการหรือแตะหมุดบนแผนที่</p></div>' +
           '<button onclick="toggleMapListPanel(false)" title="ปิดรายการ"><i class="fas fa-times"></i></button>' +
         '</div>' +
         '<div class="map-list-items">' + listHtml + '</div>';

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
      if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
        toggleMapListPanel(false);
      }
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

  function getBasePretestKey(sourceId, baseId) {
    const phone = localStorage.getItem("userPhone") || "guest";
    return "learning_pretest_done_" + phone + "_" + sourceId + "_" + baseId;
  }

  function hasBaseAnyQuizzes(base) {
    if (!base) return false;
    const pre = Array.isArray(base.pretestQuizzes) ? base.pretestQuizzes : [];
    const post = Array.isArray(base.quizzes) ? base.quizzes : [];
    return pre.length > 0 || post.length > 0;
  }

  function isBasePretestCompleted(sourceId, baseId) {
    const activeBase = (activeSourceDetailData && activeSourceDetailData.bases || []).find(function(b) {
      return String(b.baseId) === String(baseId);
    });
    // ถ้าฐานนี้ไม่มีแบบทดสอบเลย (ทั้งก่อนเรียนและหลังเรียน) ไม่ต้องล็อก
    if (activeBase && !hasBaseAnyQuizzes(activeBase)) {
      return true;
    }
    return localStorage.getItem(getBasePretestKey(sourceId, baseId)) === "1";
  }

  function saveBasePretestCompleted(sourceId, baseId) {
    if (!sourceId || !baseId) return;
    localStorage.setItem(getBasePretestKey(sourceId, baseId), "1");
  }

  function completeBaseWithoutQuiz(baseId) {
    saveBasePretestCompleted(activeSourceId, baseId);
    saveLearningProgress(activeSourceId, baseId);
    showCustomAlert("เรียนรู้ฐานนี้สำเร็จแล้ว! ปลดล็อกฐานถัดไปเรียบร้อย", "success");
    learningViewMode = 'list';
    renderDetailSource();
  }

  function getBaseLearningNoteKey(sourceId, baseId) {
    const phone = localStorage.getItem("userPhone") || "guest";
    return "learning_note_" + phone + "_" + sourceId + "_" + baseId;
  }

  function getBaseLearningNote(sourceId, baseId) {
    return localStorage.getItem(getBaseLearningNoteKey(sourceId, baseId)) || "";
  }

  function saveBaseLearningNote() {
    if (!activeSourceId || !activeBaseId) return;
    const el = document.getElementById("base-learning-note");
    if (!el) return;
    localStorage.setItem(getBaseLearningNoteKey(activeSourceId, activeBaseId), el.value || "");
    showCustomAlert("บันทึกความรู้แล้ว", "success");
  }

  function getExternalVideoEmbed(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";
    let embed = raw;
    const ytWatch = raw.match(/[?&]v=([^&]+)/);
    const ytShort = raw.match(/youtu\.be\/([^?&]+)/);
    if (ytWatch && ytWatch[1]) embed = "https://www.youtube.com/embed/" + ytWatch[1];
    else if (ytShort && ytShort[1]) embed = "https://www.youtube.com/embed/" + ytShort[1];
    if (/youtube\.com\/embed\//.test(embed)) {
      return '<div class="base-video-wrap"><iframe src="' + escapeHtml(embed) + '" title="Learning video" loading="lazy" allowfullscreen></iframe></div>';
    }
    return '<a class="btn-primary w-100" style="display:block;text-align:center;" href="' + escapeHtml(raw) + '" target="_blank"><i class="fas fa-video mr-1"></i>เปิดวิดีโอภายนอก</a>';
  }

  function setBaseTab(tabName) {
    const targetTab = tabName || "learn";
    if (targetTab === "posttest" && !isBasePretestCompleted(activeSourceId, activeBaseId)) {
      activeBaseTab = "pretest";
      renderDetailSource();
      return showCustomAlert("กรุณาทำแบบทดสอบก่อนเรียนให้เสร็จก่อน", "warning");
    }
    activeBaseTab = targetTab;
    renderDetailSource();
  }

  function getBaseQuizList(base, mode) {
    if (!base) return [];
    const pre = Array.isArray(base.pretestQuizzes) ? base.pretestQuizzes : [];
    const post = Array.isArray(base.quizzes) ? base.quizzes : [];

    if (mode === "pretest") {
      if (pre.length > 0) return pre;
      // หากมีแค่แบบทดสอบหลังเรียน ให้ดึงมาใช้เป็นก่อนเรียนโดยสลับลำดับข้อสอบ (reverse)
      return post.slice().reverse();
    } else {
      if (post.length > 0) return post;
      // หากมีแค่แบบทดสอบก่อนเรียน ให้ดึงมาใช้เป็นหลังเรียนโดยสลับลำดับข้อสอบ (reverse)
      return pre.slice().reverse();
    }
  }

  function formatLearningText(text) {
    return text ? escapeHtml(String(text)).split('\n').join('<br>') : '';
  }

  function buildBaseQuizTabHtml(base, mode) {
    const isPretest = mode === "pretest";
    const hasQuizzes = hasBaseAnyQuizzes(base);
    const quizzes = getBaseQuizList(base, mode);
    const isPosttestLocked = !isPretest && !isBasePretestCompleted(activeSourceId, base.baseId);
    let html = '<div class="content-section base-quiz-panel">';
    html += '<h4><i class="fas ' + (isPretest ? 'fa-clipboard-question' : 'fa-medal') + '"></i> ' + (isPretest ? 'แบบทดสอบก่อนเรียน' : 'แบบทดสอบหลังเรียน') + '</h4>';
    
    if (!hasQuizzes) {
      html += '<p style="color:var(--text-muted);"><i class="fas fa-check-circle text-emerald-500 mr-1"></i> ฐานการเรียนรู้นี้ไม่มีแบบทดสอบ ท่านสามารถศึกษาเนื้อหาและเรียนผ่านได้เลย</p>';
      html += '</div>';
      return html;
    }

    if (isPosttestLocked) {
      html += '<p>กรุณาทำแบบทดสอบก่อนเรียนให้เสร็จก่อน จึงจะเริ่มแบบทดสอบหลังเรียนได้</p>';
      html += '<button class="btn-primary w-100" onclick="setBaseTab(\'pretest\')"><i class="fas fa-lock"></i> ไปทำแบบทดสอบก่อนเรียน</button>';
      html += '</div>';
      return html;
    }

    html += '<p>' + (isPretest ? 'ทำเพื่อสำรวจความรู้ก่อนเรียน ระบบไม่บันทึกคะแนนส่วนนี้' : 'ทำหลังเรียนเพื่อบันทึกคะแนนสะสมของฐานนี้') + '</p>';
    html += '<button class="btn-primary w-100" onclick="startBaseQuiz(\'' + mode + '\', \'' + escapeJS(base.baseId) + '\')">';
    html += '<i class="fas fa-play-circle"></i> ' + (quizzes.length ? ('เริ่มทำแบบทดสอบ (' + quizzes.length + ' ข้อ)') : 'ยังไม่มีข้อสอบในแท็บนี้');
    html += '</button>';
    html += '</div>';
    return html;
  }

  function buildBaseLearningTabHtml(base) {
    const info = base.info || {};
    const videoUrl = base.videoUrl || info.videoUrl || '';
    const externalUrl = info.external || base.external || '';
    const hasQuizzes = hasBaseAnyQuizzes(base);
    let html = '';

    html += '<div class="content-section">';
    html += '<h4><i class="fas fa-video"></i> วิดีโอประกอบการเรียนรู้</h4>';
    html += videoUrl ? getExternalVideoEmbed(videoUrl) : '<p>ยังไม่มีลิงก์วิดีโอสำหรับฐานนี้</p>';
    html += '</div>';

    if (base.description) {
      html += '<div class="content-section"><h4><i class="fas fa-info-circle"></i> รายละเอียด</h4><p>' + formatLearningText(base.description) + '</p></div>';
    }
    if (info.history) {
      html += '<div class="content-section"><h4><i class="fas fa-bullseye"></i> จุดประสงค์การเรียนรู้</h4><p>' + formatLearningText(info.history) + '</p></div>';
    }
    html += '<div class="content-section"><h4><i class="fas fa-file-alt"></i> อ่านเนื้อหา</h4>';
    html += info.result ? '<p>' + formatLearningText(info.result) + '</p>' : '<p>ยังไม่มีเนื้อหาอ่านสำหรับฐานนี้</p>';
    html += '</div>';

    html += '<div class="content-section">';
    html += '<h4><i class="fas fa-link"></i> ศึกษาเพิ่มเติม</h4>';
    if (externalUrl) {
      html += '<a href="' + escapeHtml(externalUrl) + '" target="_blank" class="btn-primary w-100" style="display:block;text-align:center;"><i class="fas fa-arrow-up-right-from-square"></i> เปิดลิงก์ภายนอก</a>';
    } else {
      html += '<p>ยังไม่มีลิงก์สำหรับศึกษาเพิ่มเติม</p>';
    }
    html += '</div>';

    html += '<div class="content-section">';
    html += '<h4><i class="fas fa-book"></i> บันทึกความรู้</h4>';
    html += '<textarea id="base-learning-note" rows="6" placeholder="พิมพ์สิ่งที่ได้เรียนรู้จากฐานนี้...">' + escapeHtml(getBaseLearningNote(activeSourceId, base.baseId)) + '</textarea>';
    html += '<button class="btn-primary w-100 mt-3" onclick="saveBaseLearningNote()"><i class="fas fa-save"></i> บันทึกความรู้</button>';
    html += '</div>';

    html += '<div class="content-footer mt-5" style="text-align: center;">';
    if (hasQuizzes) {
      html += '<button class="btn-finish-base" onclick="setBaseTab(\'posttest\')" style="background: var(--primary); color: white; border: none; padding: 15px 40px; border-radius: 50px; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 10px var(--primary-glow);">ไปทำแบบทดสอบหลังเรียน <i class="fas fa-chevron-right"></i></button>';
    } else {
      html += '<button class="btn-finish-base" onclick="completeBaseWithoutQuiz(\'' + escapeJS(base.baseId) + '\')" style="background: linear-gradient(135deg,#059669,#047857); color: white; border: none; padding: 15px 40px; border-radius: 50px; font-size: 1.1rem; cursor: pointer; box-shadow: 0 4px 10px rgba(5,150,105,0.4);"><i class="fas fa-check-circle mr-1"></i> เรียนรู้สำเร็จแล้ว</button>';
    }
    html += '</div>';
    return html;
  }

  function buildActiveBaseLearningHtml(activeBase) {
    const tab = activeBaseTab || "pretest";
    const tabBtn = function(name, icon, label) {
      const locked = name === "posttest" && !isBasePretestCompleted(activeSourceId, activeBase.baseId);
      return '<button type="button" class="base-learning-tab ' + (tab === name ? 'active ' : '') + (locked ? 'locked' : '') + '" onclick="setBaseTab(\'' + name + '\')"><i class="fas ' + (locked ? 'fa-lock' : icon) + '"></i> ' + label + '</button>';
    };
    let html = '<div class="learning-content-view">';
    html += '<button class="btn-back-to-list" onclick="learningViewMode=\'list\'; renderDetailSource();" style="background: none; border: 1px solid #ccc; padding: 5px 15px; border-radius: 20px; color: #666; cursor: pointer;"><i class="fas fa-arrow-left"></i> กลับไปรายการฐาน</button>';
    html += '<div class="content-header mt-3 mb-4">';
    html += '<h2 style="color: var(--text-inv);">' + escapeHtml(activeBase.baseName || 'ฐานการเรียนรู้') + '</h2>';
    html += '</div>';
    html += '<div class="base-learning-tabs">';
    html += tabBtn('pretest', 'fa-clipboard-question', 'ก่อนเรียน');
    html += tabBtn('learn', 'fa-book-open', 'เรียนรู้');
    html += tabBtn('posttest', 'fa-medal', 'หลังเรียน');
    html += '</div>';

    if (tab === "pretest") {
      html += buildBaseQuizTabHtml(activeBase, "pretest");
    } else if (tab === "posttest") {
      html += buildBaseQuizTabHtml(activeBase, "posttest");
    } else {
      html += buildBaseLearningTabHtml(activeBase);
    }

    html += '</div>';
    return html;
  }

  function startBaseQuiz(mode, baseId) {
    if (localStorage.getItem("userRole") === "guest") {
      showCustomConfirm("ฟีเจอร์ทดสอบความรู้และเก็บแต้มเฉพาะสมาชิกนักศึกษา กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อดำเนินการ", function() {
        if (typeof logoutNoConfirm === "function") logoutNoConfirm();
      });
      return;
    }
    currentQuizMode = mode === "pretest" ? "pretest" : "posttest";
    activeBaseId = String(baseId || activeBaseId || '').trim();
    if (currentQuizMode === "posttest" && !isBasePretestCompleted(activeSourceId, activeBaseId)) {
      activeBaseTab = "pretest";
      renderDetailSource();
      return showCustomAlert("กรุณาทำแบบทดสอบก่อนเรียนให้เสร็จก่อน", "warning");
    }
    const activeBase = (activeSourceDetailData && activeSourceDetailData.bases || []).find(function(b) {
      return String(b.baseId) === String(activeBaseId);
    });
    const quizList = getBaseQuizList(activeBase, currentQuizMode);
    if (!quizList.length) {
      return showCustomAlert(currentQuizMode === "pretest" ? "ยังไม่มีแบบทดสอบก่อนเรียน" : "ยังไม่มีแบบทดสอบหลังเรียน", "warning");
    }
    currentQuizData = quizList;
    currentQuestionIndex = 0;
    userScore = 0;
    quizAnswers = {};
    document.getElementById('total-q-num').innerText = currentQuizData.length;
    showPage('quiz-page');
    loadQuestion();
  }

  function openSourceDetail(sourceId) {
    activeSourceId = sourceId; 
    learningViewMode = 'intro';
    activeBaseId = '';

    const sidForDetail = String(sourceId || '').trim();
    const cachedDetail = cacheSourceDetails[sidForDetail];
    if (cachedDetail && cachedDetail._detailLoaded) {
      activeSourceDetailData = cachedDetail;
      renderDetailAfterLoad();
      return;
    }

    showLoading(true);
    apiGet('getSourceDetail', withAuthParams({ sourceId: sidForDetail }))
      .then(function(res) {
        showLoading(false);
        const fullData = res && res.status === 'success' ? res.source : null;
        if (!fullData) return showCustomAlert("ไม่พบข้อมูลแหล่งเรียนรู้นี้", "error");
        fullData._detailLoaded = true;
        cacheSourceDetails[sidForDetail] = fullData;
        if (cacheSources) {
          const idx = cacheSources.findIndex(function(s) { return String(s.SourceID).trim() === sidForDetail; });
          if (idx > -1) cacheSources[idx] = Object.assign({}, cacheSources[idx], fullData);
        }
        activeSourceDetailData = fullData;
        renderDetailAfterLoad();
      })
      .catch(function() {
        showLoading(false);
        showCustomAlert("โหลดข้อมูลแหล่งเรียนรู้ไม่สำเร็จ", "error");
      });
    return;

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
    const validUrl = getValidImageUrl(rawUrl);
    document.getElementById('detail-cover').style.backgroundImage = 'url(\'' + validUrl + '\')';
    document.getElementById('detail-tambon').innerText = formatTambon(sourceData.TambonName);
    document.getElementById('detail-title').innerText = sourceData.SourceName;

    const typeEl = document.getElementById('detail-source-type');
    if (typeEl) {
      if (sourceData.sourceType) {
        typeEl.innerText = 'ประเภท' + sourceData.sourceType;
        typeEl.style.display = 'inline-block';
      } else {
        typeEl.style.display = 'none';
      }
    }

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

    // แสดงตราสัญลักษณ์รับรองมาตรฐาน สกร. มาตรา 6 (หากผ่านการประเมินแล้ว)
    const evaluation = activeSourceDetailData && activeSourceDetailData.evaluation;
    if (evaluation && evaluation.grade) {
      let badgeColor = '#ef4444';
      if (evaluation.grade === 'ดีมาก') badgeColor = '#10b981';
      else if (evaluation.grade === 'ดี') badgeColor = '#3b82f6';
      else if (evaluation.grade === 'พอใช้') badgeColor = '#f59e0b';
      else if (evaluation.grade === 'ควรปรับปรุง') badgeColor = '#f97316';

      html += '<div class="content-section" style="background:linear-gradient(135deg, rgba(217,119,6,0.08), rgba(217,119,6,0.02)); border:1px solid rgba(217,119,6,0.15); border-radius:18px; padding:16px;">' +
                '<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">' +
                  '<div style="width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,#f59e0b,#d97706); display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 10px rgba(245,158,11,0.25);">' +
                    '<i class="fas fa-award" style="color:white; font-size:1.2rem;"></i>' +
                  '</div>' +
                  '<div>' +
                    '<h4 style="margin:0; font-size:0.9rem; font-weight:bold; color:var(--text-inv);">ผ่านการรับรองมาตรฐานแหล่งเรียนรู้</h4>' +
                    '<p style="margin:2px 0 0; font-size:0.75rem; color:var(--text-soft);">ตาม พ.ร.บ. ส่งเสริมการเรียนรู้ พ.ศ. 2566 มาตรา 6</p>' +
                  '</div>' +
                '</div>' +
                
                '<div style="display:flex; justify-content:between; align-items:center; background:var(--bg-body); padding:10px 14px; border-radius:12px; border:1px solid var(--card-border); margin-bottom:12px;">' +
                  '<div>' +
                    '<span style="font-size:0.75rem; color:var(--text-soft);">ระดับคุณภาพ: </span>' +
                    '<span style="font-weight:900; font-size:0.85rem; color:' + badgeColor + ';">' + evaluation.grade + '</span>' +
                  '</div>' +
                  '<div style="text-align:right;">' +
                    '<span style="font-size:0.75rem; color:var(--text-soft);">คะแนนเฉลี่ย: </span>' +
                    '<span style="font-weight:900; font-size:0.85rem; color:var(--text-inv);">' + (evaluation.average_score || 0).toFixed(2) + ' / 5.0</span>' +
                  '</div>' +
                '</div>' +

                '<div style="text-align:center; display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">' +
                  '<button class="btn-primary" style="padding:6px 14px; font-size:0.75rem; background:none; border:1px solid var(--primary); color:var(--primary); box-shadow:none; border-radius:8px;" onclick="toggleEvaluationDetails()">' +
                    '<span id="eval-toggle-text"><i class="fas fa-info-circle mr-1"></i> ดูคะแนนประเมินรายด้าน</span>' +
                  '</button>' +
                  '<button class="btn-primary" style="padding:6px 14px; font-size:0.75rem; background:linear-gradient(135deg,#0ea5e9,#0284c7); color:white; border:none; border-radius:8px;" onclick="downloadSourceStandardCert(\'' + escapeJS(activeSourceDetailData.SourceID) + '\')">' +
                    '<i class="fas fa-certificate mr-1"></i> พิมพ์ใบประกาศมาตรฐาน (PDF)' +
                  '</button>' +
                '</div>' +

                '<div id="eval-details-panel" style="display:none; margin-top:14px; padding-top:14px; border-top:1px dashed rgba(var(--primary-rgb),0.15);" class="space-y-2.5">' +
                  '<div class="flex justify-between text-xs p-1.5 rounded" style="background:rgba(0,0,0,0.02);">' +
                    '<span style="color:var(--text-soft);">1. ด้านการจัดกระบวนการเรียนรู้</span>' +
                    '<span style="font-weight:bold; color:var(--text-inv);">' + (evaluation.scores.std1 || 0).toFixed(2) + ' / 5</span>' +
                  '</div>' +
                  '<div class="flex justify-between text-xs p-1.5 rounded" style="background:rgba(0,0,0,0.02);">' +
                    '<span style="color:var(--text-soft);">2. ด้านวิทยากร</span>' +
                    '<span style="font-weight:bold; color:var(--text-inv);">' + (evaluation.scores.std2 || 0).toFixed(2) + ' / 5</span>' +
                  '</div>' +
                  '<div class="flex justify-between text-xs p-1.5 rounded" style="background:rgba(0,0,0,0.02);">' +
                    '<span style="color:var(--text-soft);">3. ด้านการมีส่วนร่วมของภาคีเครือข่าย</span>' +
                    '<span style="font-weight:bold; color:var(--text-inv);">' + (evaluation.scores.std3 || 0).toFixed(2) + ' / 5</span>' +
                  '</div>' +
                  '<div class="flex justify-between text-xs p-1.5 rounded" style="background:rgba(0,0,0,0.02);">' +
                    '<span style="color:var(--text-soft);">4. ด้านการบริหารจัดการแหล่งเรียนรู้</span>' +
                    '<span style="font-weight:bold; color:var(--text-inv);">' + (evaluation.scores.std4 || 0).toFixed(2) + ' / 5</span>' +
                  '</div>' +
                  '<div class="flex justify-between text-xs p-1.5 rounded" style="background:rgba(0,0,0,0.02);">' +
                    '<span style="color:var(--text-soft);">5. ด้านการพัฒนาแหล่งเรียนรู้</span>' +
                    '<span style="font-weight:bold; color:var(--text-inv);">' + (evaluation.scores.std5 || 0).toFixed(2) + ' / 5</span>' +
                  '</div>' +
                  '<div class="flex justify-between text-xs p-1.5 rounded" style="background:rgba(0,0,0,0.02);">' +
                    '<span style="color:var(--text-soft);">6. ด้านการประเมินแหล่งเรียนรู้</span>' +
                    '<span style="font-weight:bold; color:var(--text-inv);">' + (evaluation.scores.std6 || 0).toFixed(2) + ' / 5</span>' +
                  '</div>' +
                  
                  (evaluation.comments ? 
                    '<div style="margin-top:10px; background:var(--bg2); padding:10px; border-radius:10px; font-size:0.75rem; border:1px solid var(--card-border);">' +
                      '<strong style="color:var(--text-inv); display:block; margin-bottom:4px;"><i class="fas fa-comment-dots text-primary mr-1"></i>บันทึกผู้ประเมินระดับอำเภอ:</strong>' +
                      '<p style="margin:0; line-height:1.4; color:var(--text-soft);">' + formatText(evaluation.comments) + '</p>' +
                    '</div>' : '') +

                  '<p style="text-align:right; font-size:0.65rem; color:var(--text-soft); margin-top:8px; opacity:0.8;">ประเมินโดย: ' + (evaluation.evaluator || 'ศกร. ระดับอำเภอ') + ' (' + (evaluation.evaluated_at || '-') + ')</p>' +
                '</div>' +
              '</div>';
    }

    if(info.history) html += '<div class="content-section"><h4><i class="fas fa-bullseye"></i> จุดประสงค์การเรียนรู้</h4><p>' + formatText(info.history) + '</p></div>';
    if(info.result) html += '<div class="content-section"><h4><i class="fas fa-file-alt"></i> เนื้อหา</h4><p>' + formatText(info.result) + '</p></div>';

    const fac = (info.facilities || (activeSourceDetailData && activeSourceDetailData.facilities)) || {};
    const soc = fac.social_media || {};
    const hasFac = fac.capacity_people || fac.parking_spaces || fac.restrooms || fac.tables_chairs || fac.travel_info || fac.main_road_distance;
    const hasSoc = soc.facebook || soc.line || soc.website || soc.tiktok;

    if (hasFac || hasSoc) {
      html += '<div class="content-section" style="background:var(--bg2); border:1px solid var(--card-border); border-radius:16px; padding:16px;">' +
                '<h4><i class="fas fa-bus text-primary"></i> สิ่งอำนวยความสะดวกและการเดินทาง</h4>';

      if (hasFac) {
        html += '<div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:12px; font-size:0.8rem;">';
        if (fac.capacity_people) html += '<div style="background:var(--bg-body); padding:8px 12px; border-radius:10px; border:1px solid var(--card-border);"><i class="fas fa-users text-primary mr-1"></i> รองรับได้: <strong>' + fac.capacity_people + ' คน</strong></div>';
        if (fac.parking_spaces) html += '<div style="background:var(--bg-body); padding:8px 12px; border-radius:10px; border:1px solid var(--card-border);"><i class="fas fa-car text-blue-500 mr-1"></i> ที่จอดรถ: <strong>' + fac.parking_spaces + ' คัน</strong></div>';
        if (fac.restrooms) html += '<div style="background:var(--bg-body); padding:8px 12px; border-radius:10px; border:1px solid var(--card-border);"><i class="fas fa-restroom text-indigo-500 mr-1"></i> ห้องน้ำ: <strong>' + fac.restrooms + ' ห้อง</strong></div>';
        if (fac.tables_chairs) html += '<div style="background:var(--bg-body); padding:8px 12px; border-radius:10px; border:1px solid var(--card-border);"><i class="fas fa-chair text-amber-500 mr-1"></i> โต๊ะ/เก้าอี้: <strong>' + fac.tables_chairs + ' ชุด</strong></div>';
        html += '</div>';

        if (fac.travel_info) html += '<p style="font-size:0.8rem; margin-bottom:6px;"><i class="fas fa-route text-primary mr-1"></i><strong>การเดินทาง:</strong> ' + formatText(fac.travel_info) + '</p>';
        if (fac.main_road_distance) html += '<p style="font-size:0.8rem; margin-bottom:6px;"><i class="fas fa-road text-emerald-500 mr-1"></i><strong>ระยะทางจากถนนหลัก:</strong> ' + e(fac.main_road_distance) + '</p>';
      }

      if (hasSoc) {
        html += '<div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--card-border); display:flex; gap:8px; flex-wrap:wrap; font-size:0.8rem;">';
        if (soc.facebook) html += '<a href="' + (soc.facebook.startsWith('http') ? soc.facebook : 'https://' + soc.facebook) + '" target="_blank" style="padding:4px 10px; background:#3b82f6; color:white; border-radius:6px; font-weight:bold; text-decoration:none;"><i class="fab fa-facebook mr-1"></i>Facebook</a>';
        if (soc.line) html += '<a href="' + (soc.line.startsWith('http') ? soc.line : 'https://line.me/' + soc.line) + '" target="_blank" style="padding:4px 10px; background:#10b981; color:white; border-radius:6px; font-weight:bold; text-decoration:none;"><i class="fab fa-line mr-1"></i>Line</a>';
        if (soc.website) html += '<a href="' + (soc.website.startsWith('http') ? soc.website : 'https://' + soc.website) + '" target="_blank" style="padding:4px 10px; background:#06b6d4; color:white; border-radius:6px; font-weight:bold; text-decoration:none;"><i class="fas fa-globe mr-1"></i>Website</a>';
        if (soc.tiktok) html += '<a href="' + (soc.tiktok.startsWith('http') ? soc.tiktok : 'https://tiktok.com/' + soc.tiktok) + '" target="_blank" style="padding:4px 10px; background:#1e293b; color:white; border-radius:6px; font-weight:bold; text-decoration:none;"><i class="fab fa-tiktok mr-1"></i>TikTok</a>';
        html += '</div>';
      }

      html += '</div>';
    }

    if(info.history) html += '<div class="content-section"><h4><i class="fas fa-bullseye"></i> จุดประสงค์การเรียนรู้</h4><p>' + formatText(info.history) + '</p></div>';
    if(info.result) html += '<div class="content-section"><h4><i class="fas fa-file-alt"></i> เนื้อหา</h4><p>' + formatText(info.result) + '</p></div>';
    if(info.gallery || info.external) {
      html += '<div class="content-section"><h4><i class="fas fa-photo-video"></i> สื่อการเรียนรู้</h4><div style="display:flex; gap:10px; flex-wrap:wrap;">';
      if(info.gallery) html += '<a href="' + info.gallery + '" target="_blank" class="btn-primary" style="flex:1; text-align:center;"><i class="fas fa-images"></i> แกลอรีรูปภาพ</a>';
      if(info.external) html += '<a href="' + info.external + '" target="_blank" class="btn-primary" style="flex:1; text-align:center; background-color:#ef4444;"><i class="fab fa-youtube"></i> สื่อภายนอก</a>';
      html += '</div></div>';
    }
    const gpsVal = info.gps || ((activeSourceDetailData && activeSourceDetailData.Latitude && activeSourceDetailData.Longitude) ? (activeSourceDetailData.Latitude + ',' + activeSourceDetailData.Longitude) : '');
    if((gpsVal && showGps) || info.contact) {
      html += '<div class="content-section"><h4><i class="fas fa-map-marker-alt"></i> ติดต่อสถานที่</h4>';
      if(info.contact) html += '<p>' + formatText(info.contact) + '</p>';
      if(gpsVal && showGps) {
        let mapLink = String(gpsVal).startsWith('http') ? gpsVal : 'https://www.google.com/maps/search/?api=1&query=' + gpsVal;
        html += '<p class="mt-3"><a href="' + mapLink + '" target="_blank" style="color:var(--primary);"><i class="fas fa-location-arrow"></i> เปิดพิกัดนำทางแผนที่</a></p>';
      }
      html += '</div>';
    }
    return html;
  }

  function toggleEvaluationDetails() {
    const panel = document.getElementById('eval-details-panel');
    const txt = document.getElementById('eval-toggle-text');
    if (!panel) return;
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      txt.innerHTML = '<i class="fas fa-chevron-up mr-1"></i> ซ่อนคะแนนประเมินรายด้าน';
    } else {
      panel.style.display = 'none';
      txt.innerHTML = '<i class="fas fa-info-circle mr-1"></i> ดูคะแนนประเมินรายด้าน';
    }
  }
  window.toggleEvaluationDetails = toggleEvaluationDetails;

  function renderDetailSource() {
    const container = document.getElementById('detail-content-container');
    if (!activeSourceDetailData) return;

    const sourceId = String(activeSourceDetailData.SourceID || '').trim();
    const bases = activeSourceDetailData.bases || [];
    let html = '';

    if (learningViewMode === 'intro') {
      // หน้าแสดงรายละเอียดทั่วไป/แนะนำแหล่งเรียนรู้
      html += '<div class="learning-intro-section">';
      html += buildDetailInfoHtml(activeSourceDetailData.info);
      if (bases.length > 0) {
        html += '<div class="btn-quiz" onclick="enterBasesList()" style="margin-top:20px; background:linear-gradient(135deg, var(--primary), var(--primary-dk)); color:white;"><i class="fas fa-play"></i> เริ่มการเรียนรู้</div>';
      } else {
        html += '<div class="btn-quiz" onclick="startFinalQuiz()"><i class="fas fa-pencil-alt"></i> ทำแบบทดสอบเพื่อเก็บคะแนน</div>';
      }
      html += '</div>';
    } else if (learningViewMode === 'list') {
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
          html +=   '<div class="mb-2" style="font-size: 1.1rem; color: var(--primary); font-weight: bold;"><i class="fas fa-trophy mr-1"></i> ยอดเยี่ยม! คุณเรียนครบทุกฐานแล้ว</div>';
          html +=   '<p class="mb-3" style="font-size: 0.85rem; color: var(--text-soft); max-width: 500px; margin-left: auto; margin-right: auto;">ทำแบบทดสอบประเมินผลการเรียนรู้ผ่านเกณฑ์ 80% ขึ้นไป เพื่อรับแต้มสะสมและรับใบเกียรติบัตรประจำแหล่งเรียนรู้ (สามารถรับและดาวน์โหลดได้ที่เมนู <strong>"โปรไฟล์" &rarr; "ประวัติเกียรติบัตร"</strong>)</p>';
          html +=   '<button class="btn-quiz-final" onclick="startFinalQuiz()" style="width: 100%; max-width: 320px; padding: 15px; font-size: 1.1rem; border-radius: 50px; background: var(--primary); color: white; border: none; cursor: pointer; box-shadow: 0 4px 15px var(--primary-glow);"><i class="fas fa-file-signature mr-2"></i>แบบทดสอบประเมินผลการเรียนรู้</button>';
          html += '</div>';
        }
      }
      html += '</div>';
    } else {
      // หน้าแสดงเนื้อหาฐาน
      const activeBase = (activeSourceDetailData.bases || []).find(function(b) { return String(b.baseId) === String(activeBaseId); });
      if (!activeBase) {
        learningViewMode = 'intro';
        return renderDetailSource();
      }

      html += buildActiveBaseLearningHtml(activeBase);
    }

    container.innerHTML = html;
  }

  function enterBasesList() {
    learningViewMode = 'list';
    renderDetailSource();
    window.scrollTo(0, 0);
  }
  window.enterBasesList = enterBasesList;

  function goBackFromDetail() {
    if (learningViewMode === 'list' && activeSourceDetailData && activeSourceDetailData.bases && activeSourceDetailData.bases.length > 0) {
      learningViewMode = 'intro';
      renderDetailSource();
    } else if (learningViewMode === 'content') {
      learningViewMode = 'list';
      renderDetailSource();
    } else {
      showPage('map-page');
    }
  }
  window.goBackFromDetail = goBackFromDetail;

  function startLearningBase(baseId) {
    activeBaseId = String(baseId);
    activeBaseTab = "pretest";
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
    if (localStorage.getItem("userRole") === "guest") {
      showCustomConfirm("ฟีเจอร์ทดสอบความรู้และเก็บแต้มเฉพาะสมาชิกนักศึกษา กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อดำเนินการ", function() {
        if (typeof logoutNoConfirm === "function") logoutNoConfirm();
      });
      return;
    }
    if (!activeSourceDetailData) return;
    const sourceId = activeSourceId;
    currentQuizMode = "posttest";
    
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
    
    currentQuestionIndex = 0; userScore = 0; quizAnswers = {};
    document.getElementById('total-q-num').innerText = currentQuizData.length;
    showPage('quiz-page');
    loadQuestion();
  }

  function startQuiz(sourceId, baseId) {
    if (localStorage.getItem("userRole") === "guest") {
      showCustomConfirm("ฟีเจอร์ทดสอบความรู้และเก็บแต้มเฉพาะสมาชิกนักศึกษา กรุณาเข้าสู่ระบบหรือสมัครสมาชิกเพื่อดำเนินการ", function() {
        if (typeof logoutNoConfirm === "function") logoutNoConfirm();
      });
      return;
    }
    activeSourceId = String(sourceId || activeSourceId || '').trim();
    activeBaseId = String(baseId || '').trim();
    currentQuizMode = "posttest";
    if(currentQuizData.length === 0) return showCustomAlert("แอดมินยังไม่ได้เพิ่มแบบทดสอบสำหรับศูนย์นี้ครับ", "warning");
    currentQuestionIndex = 0; userScore = 0; quizAnswers = {};
    document.getElementById('total-q-num').innerText = currentQuizData.length;
    showPage('quiz-page');
    loadQuestion();
  }

  function loadQuestion() {
    stopSpeaking();
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

  function speakCurrentQuestion() {
    if (!('speechSynthesis' in window)) {
      showCustomAlert("เบราว์เซอร์ของคุณไม่รองรับการอ่านออกเสียง", "warning");
      return;
    }
    
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setTTSBtnState(false);
      return;
    }
    
    const questionText = document.getElementById('quiz-question').innerText;
    if (!questionText) return;
    
    const choiceA = document.getElementById('choice-A').innerText.replace(/^ก\s*/, 'กอ ');
    const choiceB = document.getElementById('choice-B').innerText.replace(/^ข\s*/, 'ขอ ');
    const choiceC = document.getElementById('choice-C').innerText.replace(/^ค\s*/, 'คอ ');
    const choiceD = document.getElementById('choice-D').innerText.replace(/^ง\s*/, 'งอ ');
    
    const textToSpeak = questionText + " " + 
                        "ตัวเลือก กอ. " + choiceA + ", " +
                        "ตัวเลือก ขอ. " + choiceB + ", " +
                        "ตัวเลือก คอ. " + choiceC + ", " +
                        "ตัวเลือก งอ. " + choiceD;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'th-TH';
    
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(function(v) { return v.lang.startsWith('th'); });
    if (thaiVoice) utterance.voice = thaiVoice;
    
    utterance.onstart = function() {
      setTTSBtnState(true);
    };
    
    utterance.onend = function() {
      setTTSBtnState(false);
    };
    
    utterance.onerror = function() {
      setTTSBtnState(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }

  function setTTSBtnState(isSpeaking) {
    const btn = document.getElementById('btn-speak-question');
    if (!btn) return;
    if (isSpeaking) {
      btn.classList.add('speaking');
      btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
      btn.title = "หยุดอ่านออกเสียง";
    } else {
      btn.classList.remove('speaking');
      btn.innerHTML = '<i class="fas fa-volume-up"></i>';
      btn.title = "อ่านออกเสียงคำถาม";
    }
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setTTSBtnState(false);
    }
  }
  window.stopSpeaking = stopSpeaking;


  let learningQuizAutoNextTimer = null;

  function selectChoice(choiceLetter, btnElement) {
    selectedAnswer = choiceLetter;
    const question = currentQuizData[currentQuestionIndex] || {};
    const questionId = question.quizId || question.id || currentQuestionIndex;
    quizAnswers[String(questionId)] = choiceLetter;
    document.querySelectorAll('.choice-btn').forEach(function(btn) { btn.classList.remove('selected'); });
    btnElement.classList.add('selected');
    
    const nextBtn = document.getElementById('btn-next-question');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = "1";
    }

    // Auto-advance to next question smoothly after 280ms
    if (learningQuizAutoNextTimer) clearTimeout(learningQuizAutoNextTimer);
    if (currentQuestionIndex < currentQuizData.length - 1) {
      learningQuizAutoNextTimer = setTimeout(function() {
        nextQuestion();
      }, 280);
    }
  }

  function nextQuestion() {
    if (learningQuizAutoNextTimer) clearTimeout(learningQuizAutoNextTimer);
    if (selectedAnswer === currentQuizData[currentQuestionIndex].answer) userScore++;
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizData.length) loadQuestion();
    else finishQuiz(); 
  }

  function finishQuiz() {
    if (window.currentQuizActivityId) {
      cacheProfile = null; cacheHistory = null; cacheLeaderboard = null;
      if (typeof clearApiCache === 'function') clearApiCache(['getUserPointsHistory','getUserBadges','getUserCertificates','getHomeData','getLeaderboard']);
      document.getElementById('quiz-progress-bar').style.width = '100%';
      const totalQ = currentQuizData.length || 1;
      
      document.getElementById('result-score').parentNode.innerHTML = '<span id="result-score">' + userScore + '</span>/' + totalQ;
      
      const resultTitle = document.getElementById('result-title');
      const resultIcon = document.getElementById('result-icon');
      const btnRetry = document.getElementById('btn-retry');
      const backBtn = document.getElementById('result-back-btn');
      
      resultTitle.innerText = "ทำแบบทดสอบกิจกรรมเสร็จสิ้น";
      resultTitle.style.color = "var(--primary)";
      resultIcon.innerText = "🎉";
      document.getElementById('result-message').innerText = "กำลังส่งผลคะแนนแบบทดสอบ...";
      
      btnRetry.style.display = "block";
      btnRetry.innerHTML = '<i class="fas fa-redo mr-2"></i>ทำแบบทดสอบอีกครั้ง';
      btnRetry.onclick = function() {
        if (typeof startActivityQuiz === "function") {
          startActivityQuiz(window.currentQuizActivityId, window.currentQuizActivityName, window.currentQuizActivityPoints);
        }
      };
      
      if (backBtn) {
        backBtn.innerHTML = '<i class="fas fa-home mr-2"></i>กลับหน้าหลัก';
        backBtn.onclick = function() {
          window.currentQuizActivityId = null;
          window.currentQuizActivityName = null;
          window.currentQuizActivityPoints = null;
          showPage('home-page');
        };
      }
      
      showPage('result-page');
      
      const phone = localStorage.getItem("userPhone") || "0899999999";
      apiPost('submitActivityQuiz', { 
        phone: phone, 
        activityId: window.currentQuizActivityId, 
        answers: quizAnswers
      })
      .then(function(res) {
        if (res && res.status === "success") {
          let msg = "คุณได้คะแนนจากแบบทดสอบ " + res.earnedQuizPoints + " คะแนน (รวมทั้งหมด " + res.totalPointsWon + " คะแนน)";
          if ((userScore / totalQ) >= 0.8) {
            msg += "<br><span style='color:var(--gold); font-weight:bold;'><i class='fas fa-certificate mr-1'></i> คุณได้รับใบเกียรติบัตรกิจกรรมนี้แล้ว! สามารถรับได้ที่หน้าโปรไฟล์</span>";
          }
          document.getElementById('result-message').innerHTML = msg;
          if (res.newScore !== undefined) {
            localStorage.setItem("userScore", res.newScore);
            const scoreEl = document.getElementById('profile-score');
            if (scoreEl) {
              scoreEl.innerText = res.newScore;
            }
            if (typeof loadHomeSummary === "function") {
              loadHomeSummary(true);
            }
            if (typeof loadHomePageData === "function") {
              loadHomePageData(true);
            }
          }
        } else {
          document.getElementById('result-message').innerText = "บันทึกผลสอบล้มเหลว: " + (res.message || "เกิดข้อผิดพลาด");
        }
      })
      .catch(function(err) {
        document.getElementById('result-message').innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อ: " + err.toString();
      });
      return;
    }

    cacheProfile = null; cacheHistory = null; cacheLeaderboard = null;
    if (typeof clearApiCache === 'function') clearApiCache(['getUserPointsHistory','getUserBadges','getUserCertificates','getHomeData','getLeaderboard']);
    document.getElementById('quiz-progress-bar').style.width = '100%';
    const totalQ = currentQuizData.length;
    const isPretest = currentQuizMode === "pretest";
    const isPass = (userScore / totalQ) >= 0.8 ? "Pass" : "Fail";
    
    const earnedPoints = userScore * 10;

    document.getElementById('result-score').parentNode.innerHTML = '<span id="result-score">' + userScore + '</span>/' + totalQ;

    const resultTitle = document.getElementById('result-title');
    const resultIcon = document.getElementById('result-icon');
    const btnRetry = document.getElementById('btn-retry');

    if (isPretest) {
      resultTitle.innerText = "ทำแบบทดสอบก่อนเรียนเสร็จแล้ว";
      resultTitle.style.color = "var(--primary)";
      resultIcon.innerText = "📝";
      document.getElementById('result-message').innerText = "คะแนนส่วนนี้ใช้ประเมินตนเองเท่านั้น ระบบไม่บันทึกคะแนนสะสม";
      saveBasePretestCompleted(activeSourceId, activeBaseId);
      activeBaseTab = "learn";
      renderDetailSource();
      btnRetry.innerHTML = '<i class="fas fa-book-open mr-2"></i>ไปเรียนรู้เนื้อหา';
      btnRetry.style.display = "block";
      btnRetry.onclick = function() {
        if (activeBaseId) {
          learningViewMode = "content";
          renderDetailSource();
        }
        showPage('detail-page');
      };
      showPage('result-page');
      return;
    }

    const scorePct = totalQ > 0 ? Math.round((userScore / totalQ) * 100) : 0;

    if (isPass === "Pass") {
      resultTitle.innerText = "🎉 ยินดีด้วย! คุณสอบผ่านเกณฑ์ประเมินสำเร็จแล้ว"; 
      resultTitle.style.color = "var(--primary)"; 
      resultIcon.innerText = "🏆"; 
      
      let passMsg = 'คุณทำได้ <strong>' + scorePct + '%</strong> (' + userScore + '/' + totalQ + ' ข้อ) และได้รับ <strong>+' + earnedPoints + ' แต้มสะสม</strong>!<br><br>';
      passMsg += '<div class="p-3 rounded-xl text-left" style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:var(--text-inv); font-size:0.88rem; line-height:1.5;">';
      passMsg += '<i class="fas fa-award text-emerald-500 mr-2"></i><strong>ขอแสดงความยินดีในความสำเร็จของคุณ!</strong> คุณเป็นผู้เรียนที่มีความมุ่งมั่นตั้งใจอย่างแท้จริง สามารถไปกดรับและดาวน์โหลดใบเกียรติบัตรได้ที่เมนู <strong>"โปรไฟล์" &rarr; "ประวัติเกียรติบัตร"</strong> เพื่อเป็นหลักฐานแห่งความภาคภูมิใจ และขอให้สนุกกับการเรียนรู้ต่อในแหล่งเรียนรู้อื่นๆ ต่อไปครับ!';
      passMsg += '</div>';

      document.getElementById('result-message').innerHTML = passMsg;
      btnRetry.style.display = "none"; 
      
      // บันทึกความคืบหน้าการเรียนรู้หากสอบผ่านแบบทดสอบหลังเรียนของฐาน
      if (currentQuizMode === "posttest" && activeBaseId) {
        saveLearningProgress(activeSourceId, activeBaseId);
        learningViewMode = 'list';
        renderDetailSource();
      }

      // แสดงหน้าประเมินหลังจากผ่าน (ดีเลย์นิดหน่อยเพื่อให้ดูผลสอบก่อน)
      if (!LOFT_FIREBASE_FREE_MODE) {
        setTimeout(function() {
          openEvaluation();
        }, 3000);
      }
    } else {
      resultTitle.innerText = "💪 พยายามได้ดีมาก! อีกนิดเดียวเท่านั้น"; 
      resultTitle.style.color = "#ef4444"; 
      resultIcon.innerText = "🌟"; 
      
      let failMsg = 'คุณทำได้ <strong>' + scorePct + '%</strong> (' + userScore + '/' + totalQ + ' ข้อ) ซึ่งเกณฑ์การผ่านคือ 80% ขึ้นไป<br><br>';
      failMsg += '<div class="p-3 rounded-xl text-left" style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); color:var(--text-inv); font-size:0.88rem; line-height:1.5;">';
      failMsg += '<i class="fas fa-heart text-amber-500 mr-2"></i>อย่าเพิ่งท้อถอยนะ! การเรียนรู้คือเส้นทางของการเติบโต ลองกลับไปทบทวนเนื้อหาอีกนิด แล้วกลับมาทดสอบใหม่ได้เสมอ เชื่อมั่นว่าคุณทำได้อย่างแน่นอนครับ!';
      failMsg += '</div>';

      document.getElementById('result-message').innerHTML = failMsg;
      btnRetry.innerHTML = '<i class="fas fa-redo mr-2"></i>ทบทวนเนื้อหาอีกครั้ง';
      btnRetry.style.display = "block"; 
      btnRetry.onclick = function() {
        activeBaseTab = "learn";
        if (activeBaseId) {
          learningViewMode = "content";
        }
        renderDetailSource();
        showPage('detail-page');
      };
    }

    // ปรับปุ่มนำทางในหน้าสรุปผลสอบให้เหมาะสมตามความคืบหน้า
    const backBtn = document.getElementById('result-back-btn');
    if (backBtn) {
      if (activeBaseId) {
        backBtn.innerHTML = '<i class="fas fa-arrow-left mr-2"></i>กลับหน้ารายการฐานเรียนรู้';
        backBtn.onclick = function() { showPage('detail-page'); };
      } else {
        backBtn.innerHTML = '<i class="fas fa-home mr-2"></i>กลับหน้าหลัก';
        backBtn.onclick = function() { showPage('home-page'); };
      }
    }

    showPage('result-page');

    const phone = localStorage.getItem("userPhone") || "0899999999";
    apiPost('submitQuiz', {
      phone: phone,
      sourceId: activeSourceId,
      baseId: activeBaseId,
      mode: currentQuizMode,
      answers: quizAnswers
    }).then(function(res) {
      if (res && res.status === 'success' && res.newScore !== undefined) {
        if (typeof updateGlobalUserScore === 'function') {
          updateGlobalUserScore(res.newScore);
        } else {
          localStorage.setItem('userScore', res.newScore);
        }
      }
    });
  }

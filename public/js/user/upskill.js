
// ═══════════════════════════════════════════════════════════
//  UP SKILL MODULE  —  หน้าอัพสกิลวิดีโอ + นับเวลา
//  version: 20260612-upskill-v7
// ═══════════════════════════════════════════════════════════

/* ────────────────────────────────────────
   CONSTANTS & STATE
──────────────────────────────────────── */
let UPSKILL_CATEGORIES = [
  { id: 'construction', label: 'ช่างก่อสร้าง/ช่างกล', icon: 'fa-hard-hat', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { id: 'health',       label: 'สุขภาพ/อนามัย',       icon: 'fa-heart-pulse', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { id: 'buddhism',     label: 'พระพุทธศาสนา',         icon: 'fa-dharmachakra', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  { id: 'gardening',    label: 'เกษตร/จัดสวน',         icon: 'fa-seedling', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { id: 'cooking',      label: 'อาหาร/โภชนาการ',       icon: 'fa-utensils', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { id: 'tech',         label: 'เทคโนโลยี/คอมพิวเตอร์', icon: 'fa-laptop-code', color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
  { id: 'art',          label: 'ศิลปะ/ดนตรี',           icon: 'fa-palette', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  { id: 'community',    label: 'ชุมชน/สังคม',           icon: 'fa-people-group', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
];

function _hexToRgbA(hex, alpha) {
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
    c= hex.substring(1).split('');
    if(c.length== 3){
      c= [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c= '0x' + c.join('');
    return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
  }
  return 'rgba(18,89,57,0.12)';
}

const UPSKILL_GOAL_HOURS = 500;   // ชั่วโมงที่ต้องสะสมต่อหมวด

let _upskillVideos      = [];   // วิดีโอทั้งหมด
let _upskillFilter      = '';
let _upskillSearchQ     = '';

// Timer state
let _watchTimer         = null;
let _watchVideoId       = null;
let _watchSeconds       = 0;
let _watchSavedSeconds  = 0;
let _watchCategoryId    = null;
let _watchSaveInterval  = null;
let _ytPlayer           = null;   // YouTube IFrame Player instance
let _ytApiReady         = false;  // YT API loaded flag
let _timerPaused        = false;  // is timer manually paused by YT events

// User progress cache  { categoryId: totalSeconds }
let _userSkillProgress  = {};

// Current open video metadata (for learning log)
let _currentVideoId     = null;
let _currentVideo       = null;

/* ────────────────────────────────────────
   FIRESTORE HELPERS
──────────────────────────────────────── */
function _usid() {
  return localStorage.getItem('userPhone') || '';
}

let _upskillCacheProgress = null;
let _upskillCacheVideos = null;
let _cacheUpSkillCategories = null;
let _upskillPageLoaded = false;

async function _loadSkillProgress(forceFresh) {
  if (forceFresh) _upskillCacheProgress = null;
  if (_upskillCacheProgress) {
    _userSkillProgress = _upskillCacheProgress;
    return;
  }
  const uid = _usid();
  if (!uid || typeof hasAuthenticatedSession !== 'function' || !hasAuthenticatedSession()) return;
  try {
    const snap = await apiGet('getUpSkillProgress', { userId: uid });
    if (snap && snap.progress) {
      _userSkillProgress = snap.progress;
      _upskillCacheProgress = snap.progress;
    }
  } catch(e) {
    console.warn('[UpSkill] ไม่สามารถโหลด progress:', e);
  }
}

async function _saveWatchTime(videoId, categoryId, seconds) {
  const uid = _usid();
  if (!uid || seconds <= 0) return;
  try {
    await apiPost('saveUpSkillProgress', withAuthData({
      userId: uid,
      videoId: videoId,
      categoryId: categoryId,
      seconds: seconds,
    }));
  } catch(e) {
    console.warn('[UpSkill] บันทึกเวลาไม่สำเร็จ:', e);
  }
}

async function _loadUpSkillVideos(forceFresh) {
  if (forceFresh) _upskillCacheVideos = null;
  if (_upskillCacheVideos && Array.isArray(_upskillCacheVideos) && _upskillCacheVideos.length > 0) {
    _upskillVideos = _upskillCacheVideos;
    return;
  }
  try {
    const res = await apiGet('listUpSkillVideos', {});
    _upskillVideos = (res && Array.isArray(res.videos)) ? res.videos : [];
    _upskillCacheVideos = _upskillVideos;
  } catch(e) {
    console.warn('[UpSkill] โหลดวิดีโอไม่สำเร็จ:', e);
    _upskillVideos = [];
  }
}

/* ────────────────────────────────────────
   EMBED URL HELPERS
──────────────────────────────────────── */
function _getEmbedUrl(url) {
  if (!url) return '';
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return 'https://www.youtube.com/embed/' + ytMatch[1] + '?autoplay=1&rel=0';
  // YouTube shorts
  const ytShorts = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/);
  if (ytShorts) return 'https://www.youtube.com/embed/' + ytShorts[1] + '?autoplay=1&rel=0';
  // For TikTok/Facebook we can't embed directly — show external link
  return null;
}

function _getVideoThumbnail(url) {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return 'https://img.youtube.com/vi/' + ytMatch[1] + '/mqdefault.jpg';
  return '';
}

function _isYouTube(url) {
  return /youtu/.test(url || '');
}

function _isTikTok(url) {
  return /tiktok/.test(url || '');
}

function _isFacebook(url) {
  return /facebook|fb\.watch/.test(url || '');
}

function _getPlatformIcon(url) {
  if (_isYouTube(url)) return '<i class="fab fa-youtube" style="color:#ff0000;"></i>';
  if (_isTikTok(url))  return '<i class="fab fa-tiktok" style="color:#69c9d0;"></i>';
  if (_isFacebook(url)) return '<i class="fab fa-facebook" style="color:#1877f2;"></i>';
  return '<i class="fas fa-video"></i>';
}

/* ────────────────────────────────────────
   TIME TRACKING — WATCH TIMER
──────────────────────────────────────── */
/* ────────────────────────────────────────
   YOUTUBE IFRAME API
──────────────────────────────────────── */
function _loadYouTubeAPI() {
  if (window.YT && window.YT.Player) { _ytApiReady = true; return; }
  if (document.getElementById('yt-iframe-api-script')) return;
  const tag = document.createElement('script');
  tag.id  = 'yt-iframe-api-script';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

// Called by YouTube API when ready
window.onYouTubeIframeAPIReady = function() {
  _ytApiReady = true;
};

function _createYTPlayer(videoId, containerId) {
  if (_ytPlayer) {
    try { _ytPlayer.destroy(); } catch(e) {}
    _ytPlayer = null;
  }
  // Create a div placeholder inside the container
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div id="yt-player-inner"></div>';

  _ytPlayer = new window.YT.Player('yt-player-inner', {
    width: '100%',
    height: '100%',
    videoId: videoId,
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
    events: {
      onStateChange: _onYTStateChange,
      onError: function() { _resumeTimerInterval(); } // fallback on error
    }
  });
}

function _onYTStateChange(event) {
  const S = window.YT.PlayerState;
  if (event.data === S.PLAYING) {
    _timerPaused = false;
    _resumeTimerInterval();
    _setTimerDot(true);
  } else if (event.data === S.PAUSED || event.data === S.ENDED || event.data === S.BUFFERING) {
    _timerPaused = true;
    _pauseTimerInterval();
    _setTimerDot(false);
  }
}

function _pauseTimerInterval() {
  if (_watchTimer) { clearInterval(_watchTimer); _watchTimer = null; }
}

function _resumeTimerInterval() {
  if (_watchTimer || !_watchVideoId) return;
  _watchTimer = setInterval(function() {
    _watchSeconds++;
    _updateWatchDisplay();
    if (_watchSeconds % 60 === 0) {
      const delta = _watchSeconds - _watchSavedSeconds;
      _watchSavedSeconds = _watchSeconds;
      _saveWatchTime(_watchVideoId, _watchCategoryId, delta);
      _userSkillProgress[_watchCategoryId] = (_userSkillProgress[_watchCategoryId] || 0) + delta;
    }
  }, 1000);
}

function _setTimerDot(running) {
  const dot = document.getElementById('upskill-timer-dot');
  if (!dot) return;
  dot.style.background = running ? '#10b981' : '#f59e0b';
  dot.title = running ? 'กำลังนับเวลา' : 'หยุดชั่วคราว';
}

function _startWatchTimer(videoId, categoryId) {
  _stopWatchTimer();
  _watchVideoId    = videoId;
  _watchCategoryId = categoryId;
  _watchSeconds    = 0;
  _watchSavedSeconds = 0;
  _timerPaused     = false;
  // Timer will be started by YT onStateChange PLAYING event
  // For non-YT videos, start immediately
  document.addEventListener('visibilitychange', _onVisibilityChange);
}

function _startTimerImmediate(videoId, categoryId) {
  // Used for non-YouTube (TikTok/FB) where we can't detect play state
  _watchVideoId    = videoId;
  _watchCategoryId = categoryId;
  _timerPaused     = false;
  _resumeTimerInterval();
  _setTimerDot(true);
}

function _stopWatchTimer() {
  _pauseTimerInterval();
  document.removeEventListener('visibilitychange', _onVisibilityChange);

  // Capture values BEFORE resetting (avoid race condition with async save)
  const vidId  = _watchVideoId;
  const catId  = _watchCategoryId;
  const secs   = _watchSeconds;
  const unsavedSecs = Math.max(0, secs - _watchSavedSeconds);

  _watchVideoId   = null;
  _watchCategoryId= null;
  _watchSeconds   = 0;
  _watchSavedSeconds = 0;
  _timerPaused    = false;

  // Final save — only if watched at least 5 seconds
  if (vidId && unsavedSecs > 0) {
    _saveWatchTime(vidId, catId, unsavedSecs);
    _userSkillProgress[catId] = (_userSkillProgress[catId] || 0) + unsavedSecs;
  }
}

function _onVisibilityChange() {
  if (document.hidden) {
    // Tab hidden — pause timer
    _pauseTimerInterval();
    _setTimerDot(false);
  } else {
    // Tab visible — resume only if not paused by YT
    if (!_timerPaused && _watchVideoId) {
      _resumeTimerInterval();
      _setTimerDot(true);
    }
  }
}

function _updateWatchDisplay() {
  const el = document.getElementById('upskill-watch-seconds');
  if (el) el.textContent = _formatHMS(_watchSeconds);
}

function _formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return h + 'ชม. ' + m + 'นาที';
  return m + ':' + String(s).padStart(2, '0');
}

function _formatHoursMinutes(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h} ชม. ${m} นาที`;
  }
  return `${m} นาที`;
}

function _secondsToHours(sec) {
  return Math.round((sec / 3600) * 10) / 10;
}

/* ────────────────────────────────────────
   PAGE INIT
──────────────────────────────────────── */
async function loadUpSkillCategories(forceFresh) {
  if (forceFresh) _cacheUpSkillCategories = null;
  if (_cacheUpSkillCategories && Array.isArray(_cacheUpSkillCategories) && _cacheUpSkillCategories.length > 0) {
    UPSKILL_CATEGORIES = _cacheUpSkillCategories;
    return;
  }
  try {
    const res = await apiGet('listUpSkillCategories', {});
    if (res && Array.isArray(res.categories)) {
      UPSKILL_CATEGORIES = res.categories.map(cat => ({
        id: cat.id,
        label: cat.label,
        icon: cat.icon,
        color: cat.color,
        bg: _hexToRgbA(cat.color, 0.12)
      }));
      _cacheUpSkillCategories = UPSKILL_CATEGORIES;
    }
  } catch(e) {
    console.warn('[UpSkill] โหลดหมวดหมู่จากเซิร์ฟเวอร์ล้มเหลว:', e);
  }
}

async function initUpSkillPage(forceFresh) {
  if (forceFresh) {
    _upskillPageLoaded = false;
  }

  // หากข้อมูลโหลดครบในแคชอยู่แล้ว ให้แสดงผลทันทีแบบ Instant Load (< 10ms, 0 Network Calls)
  if (_upskillPageLoaded && _upskillVideos && _upskillVideos.length > 0) {
    _renderCategoryFilter();
    _renderProgressSummary();
    _renderVideoGrid();
    return;
  }

  _renderUpSkillSkeleton();

  await loadUpSkillCategories(forceFresh);

  _renderCategoryFilter();

  await Promise.all([_loadUpSkillVideos(forceFresh), _loadSkillProgress(forceFresh)]);

  _upskillPageLoaded = true;
  _renderProgressSummary();
  _renderVideoGrid();
}

/* ────────────────────────────────────────
   RENDER — CATEGORY FILTER TABS
──────────────────────────────────────── */
function _renderCategoryFilter() {
  const el = document.getElementById('upskill-category-tabs');
  if (!el) return;

  const allBtn = `
    <button class="upskill-tab-btn ${_upskillFilter === 'all' ? 'active' : ''}"
            onclick="filterUpSkill('all')" id="upskill-tab-all">
      <i class="fas fa-th-large"></i><span>ทั้งหมด</span>
    </button>`;

  const cats = UPSKILL_CATEGORIES.map(cat => `
    <button class="upskill-tab-btn ${_upskillFilter === cat.id ? 'active' : ''}"
            style="--cat-color:${cat.color};"
            onclick="filterUpSkill('${cat.id}')" id="upskill-tab-${cat.id}">
      <i class="fas ${cat.icon}"></i><span>${cat.label}</span>
    </button>`).join('');

  el.innerHTML = allBtn + cats;
}

/* ────────────────────────────────────────
   RENDER — PROGRESS SUMMARY CARDS
──────────────────────────────────────── */
function _renderProgressSummary() {
  const el = document.getElementById('upskill-progress-container');
  if (!el) return;

  let totalSecs = 0;

  const rows = UPSKILL_CATEGORIES.map(cat => {
    const secs  = _userSkillProgress[cat.id] || 0;
    totalSecs  += secs;
    const hours = _secondsToHours(secs);
    const pct   = Math.min(100, Math.round((hours / UPSKILL_GOAL_HOURS) * 100));
    const done  = pct >= 100;
    return `
      <div class="upskill-progress-card" style="border-left: 3px solid ${cat.color};">
        <div class="upskill-progress-head">
          <span><i class="fas ${cat.icon}" style="color:${cat.color}; margin-right:6px;"></i>${cat.label}</span>
          <span class="upskill-hours-badge" style="background:${cat.bg}; color:${cat.color};">
            ${hours} / ${UPSKILL_GOAL_HOURS} ชม.
          </span>
        </div>
        <div class="upskill-progress-bar-track">
          <div class="upskill-progress-bar-fill ${done ? 'done' : ''}"
               style="width:${pct}%; background:${cat.color};"></div>
        </div>
        ${done ? '<div class="upskill-complete-badge"><i class="fas fa-check-circle mr-1"></i>ผ่านเป้าหมาย 500 ชม.!</div>' : ''}
      </div>`;
  }).join('');

  el.innerHTML = rows || '<p class="text-muted text-center py-4">ยังไม่มีข้อมูลความก้าวหน้า</p>';

  // อัปเดตชั่วโมงเรียนสะสมรวมทั้งหมดลงใน Hero Card
  const totalHoursHero = document.getElementById('upskill-total-hours-hero');
  if (totalHoursHero) {
    const totalHoursVal = _secondsToHours(totalSecs);
    totalHoursHero.textContent = totalHoursVal + ' ชม.';
  }
}

function toggleUpskillProgressCollapse() {
  const wrapper = document.getElementById('upskill-progress-wrapper');
  const icon = document.getElementById('upskill-progress-collapse-icon');
  const textEl = document.getElementById('upskill-progress-collapse-text');
  if (!wrapper) return;

  const isHidden = wrapper.style.display === 'none';
  if (isHidden) {
    wrapper.style.display = 'block';
    if (icon) icon.style.transform = 'rotate(180deg)';
    if (textEl) textEl.textContent = 'ซ่อนรายละเอียด';
  } else {
    wrapper.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(0deg)';
    if (textEl) textEl.textContent = 'แสดงรายละเอียด';
  }
}
window.toggleUpskillProgressCollapse = toggleUpskillProgressCollapse;

/* ────────────────────────────────────────
   RENDER — SKELETON (loading)
──────────────────────────────────────── */
function _renderUpSkillSkeleton() {
  const el = document.getElementById('upskill-video-grid');
  if (!el) return;
  el.innerHTML = [1,2,3,4].map(() => `
    <div class="upskill-video-card skeleton-card">
      <div class="upskill-thumb-skeleton skeleton-anim"></div>
      <div class="upskill-card-body">
        <div class="skeleton-line skeleton-anim" style="width:80%;height:14px;margin-bottom:8px;"></div>
        <div class="skeleton-line skeleton-anim" style="width:50%;height:10px;"></div>
      </div>
    </div>`).join('');
}

/* ────────────────────────────────────────
   RENDER — VIDEO GRID
──────────────────────────────────────── */
function _renderVideoGrid() {
  const el = document.getElementById('upskill-video-grid');
  if (!el) return;

  if (!_upskillFilter) {
    el.innerHTML = `<div class="upskill-empty" style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; background: var(--glass); border-radius: 16px; border: 1px dashed var(--glass-border);">
      <i class="fas fa-hand-pointer" style="font-size:2.5rem; color:var(--primary); margin-bottom:12px; animation: bounce 2s infinite;"></i>
      <h4 class="font-bold text-theme-inv mb-1" style="font-size: 1rem;">เลือกหมวดหมู่ที่ต้องการเรียนรู้</h4>
      <p class="text-muted text-xs">กรุณากดเลือกหมวดหมู่เรียนรู้ด้านบน เพื่อแสดงรายการวิดีโออัพสกิล</p>
    </div>`;
    return;
  }

  let list = _upskillVideos.filter(v => {
    const matchCat = _upskillFilter === 'all' || v.category === _upskillFilter;
    const q = _upskillSearchQ.toLowerCase();
    const matchQ = !q || (v.title || '').toLowerCase().includes(q) || (v.category || '').includes(q);
    return matchCat && matchQ;
  });

  if (list.length === 0) {
    el.innerHTML = `<div class="upskill-empty">
      <i class="fas fa-video-slash" style="font-size:2.5rem; color:var(--text-soft); margin-bottom:10px;"></i>
      <p class="text-muted">ยังไม่มีวิดีโอในหมวดนี้</p>
    </div>`;
    return;
  }

  el.innerHTML = list.map(v => {
    const cat      = UPSKILL_CATEGORIES.find(c => c.id === v.category) || {};
    const thumb    = v.thumbnail || _getVideoThumbnail(v.url) || '';
    const platIcon = _getPlatformIcon(v.url);
    const secs     = (_userSkillProgress[v.category] || 0);
    const catTimeText = _formatHoursMinutes(secs);
    const isYT     = _isYouTube(v.url);

    return `
      <div class="upskill-video-card" onclick="openUpSkillVideo('${v.id}')" style="--cat-color:${cat.color || '#10b981'};">
        <div class="upskill-thumb-wrap">
          ${thumb
            ? `<img src="${thumb}" alt="${escapeHtml(v.title)}" class="upskill-thumb" loading="lazy">`
            : `<div class="upskill-thumb-placeholder"><i class="fas fa-play-circle"></i></div>`
          }
          <div class="upskill-play-overlay"><i class="fas fa-play"></i></div>
          <div class="upskill-platform-badge">${platIcon}</div>
          ${!isYT ? '<div class="upskill-external-badge"><i class="fas fa-external-link-alt"></i></div>' : ''}
        </div>
        <div class="upskill-card-body">
          <h4 class="upskill-card-title">${escapeHtml(v.title || 'ไม่มีชื่อ')}</h4>
          <div class="upskill-card-meta">
            <span class="upskill-cat-badge" style="background:${cat.bg || 'rgba(16,185,129,.12)'}; color:${cat.color || '#10b981'};">
              <i class="fas ${cat.icon || 'fa-video'} mr-1"></i>${cat.label || v.category}
            </span>
            <span class="upskill-time-badge" title="เวลาสะสมในหมวดหมู่นี้">
              <i class="fas fa-clock mr-1"></i>สะสม ${catTimeText}
            </span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ────────────────────────────────────────
   FILTER & SEARCH
──────────────────────────────────────── */
function filterUpSkill(catId) {
  _upskillFilter = catId;
  // update tab active state
  document.querySelectorAll('.upskill-tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeTab = document.getElementById('upskill-tab-' + catId);
  if (activeTab) activeTab.classList.add('active');
  _renderVideoGrid();

  // Scroll to grid smoothly
  const grid = document.getElementById('upskill-video-grid');
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.filterUpSkill = filterUpSkill;

function searchUpSkill(q) {
  _upskillSearchQ = q;
  _renderVideoGrid();
}
window.searchUpSkill = searchUpSkill;

/* ────────────────────────────────────────
   VIDEO PLAYER MODAL
──────────────────────────────────────── */
function openUpSkillVideo(videoId) {
  const video = _upskillVideos.find(v => v.id === videoId);
  if (!video) return;

  _currentVideoId = videoId;
  _currentVideo   = video;

  const cat    = UPSKILL_CATEGORIES.find(c => c.id === video.category) || {};
  const el     = document.getElementById('upskill-player-modal');
  if (el) el.dataset.videoId = videoId;
  const ytWrap = document.getElementById('upskill-player-yt-wrap');
  const frame  = document.getElementById('upskill-player-frame');
  const extDiv = document.getElementById('upskill-player-external');
  const titleEl= document.getElementById('upskill-player-title');
  const catEl  = document.getElementById('upskill-player-cat');
  const descEl = document.getElementById('upskill-player-desc');

  if (!el) return;

  titleEl && (titleEl.textContent = video.title || '');
  catEl   && (catEl.innerHTML = `<i class="fas ${cat.icon || 'fa-video'} mr-1"></i>${cat.label || video.category}`);
  descEl  && (descEl.textContent = video.description || '');

  const isYT = _isYouTube(video.url);

  if (isYT) {
    // Extract YouTube video ID
    const ytId = _extractYTId(video.url);
    // Hide plain iframe, show YT wrap
    if (frame)  { frame.src = ''; frame.style.display = 'none'; }
    if (extDiv) extDiv.style.display = 'none';
    if (ytWrap) ytWrap.style.display = 'block';

    if (_ytApiReady && ytId) {
      _createYTPlayer(ytId, 'upskill-player-yt-wrap');
    } else if (ytId) {
      // YT API not ready yet — fallback to iframe
      if (ytWrap) ytWrap.style.display = 'none';
      if (frame)  { frame.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`; frame.style.display = 'block'; }
      // Start timer immediately (no YT API events)
      _startTimerImmediate(videoId, video.category);
    }
    // Timer will be started by YT onStateChange
    _startWatchTimer(videoId, video.category);
  } else {
    // Non-YouTube: TikTok / Facebook — use plain fallback
    if (ytWrap) ytWrap.style.display = 'none';
    if (frame)  { frame.src = ''; frame.style.display = 'none'; }
    if (extDiv) {
      extDiv.style.display = 'flex';
      const extLink = document.getElementById('upskill-external-link');
      if (extLink) extLink.href = video.url;
    }
    // Start timer immediately (can't detect play state for external video)
    _startTimerImmediate(videoId, video.category);
  }

  el.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  _updateWatchDisplay();
  _setTimerDot(!_timerPaused);

  // Load existing learning log (if any)
  _loadLearningLog(videoId);
}
window.openUpSkillVideo = openUpSkillVideo;

function _extractYTId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function closeUpSkillVideo() {
  const el = document.getElementById('upskill-player-modal');

  // Stop YT player
  if (_ytPlayer) {
    try { _ytPlayer.stopVideo(); } catch(e) {}
    try { _ytPlayer.destroy(); } catch(e) {}
    _ytPlayer = null;
  }

  _stopWatchTimer();

  // Clear YT container
  const ytWrap = document.getElementById('upskill-player-yt-wrap');
  if (ytWrap) ytWrap.innerHTML = '';
  const frame = document.getElementById('upskill-player-frame');
  if (frame) frame.src = '';

  if (el) {
    el.style.display = 'none';
    delete el.dataset.videoId;
  }
  document.body.style.overflow = '';

  _currentVideoId = null;
  _currentVideo   = null;

  // Refresh progress display
  _renderProgressSummary();
  _renderVideoGrid();
}
window.closeUpSkillVideo = closeUpSkillVideo;

/* ────────────────────────────────────────
   LEARNING LOG
──────────────────────────────────────── */
async function _loadLearningLog(videoId) {
  const uid = _usid();
  if (!uid) return;

  // Reset UI
  const ta     = document.getElementById('upskill-log-notes');
  const status = document.getElementById('upskill-log-status');
  const submitBtn = document.getElementById('upskill-log-submit-btn');
  if (ta) ta.value = '';
  if (status) status.innerHTML = '';
  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ส่งให้ครูตรวจ ✈️'; }

  try {
    const res = await apiGet('getLearningLog', { userId: uid, videoId });
    if (res && res.log) {
      const log = res.log;
      if (ta) ta.value = log.notes || '';
      if (log.status === 'graded') {
        _renderLogGradedStatus(log, status);
        if (submitBtn) submitBtn.textContent = 'ส่งใหม่ (แก้ไข) ✈️';
      } else if (log.status === 'pending') {
        if (status) status.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:8px 12px;font-size:0.78rem;color:#f59e0b;">
            <i class="fas fa-clock"></i> ส่งแล้ว รอครูให้คะแนน...
          </div>`;
        if (submitBtn) submitBtn.textContent = 'ส่งใหม่ (แก้ไข) ✈️';
      }
    }
  } catch(e) {
    console.warn('[UpSkill] โหลด learning log ไม่สำเร็จ:', e);
  }
}

function _renderLogGradedStatus(log, container) {
  if (!container) return;
  const stars = '★'.repeat(log.score || 0) + '☆'.repeat(5 - (log.score || 0));
  container.innerHTML = `
    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:12px;font-size:0.78rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="color:#10b981;font-weight:700;"><i class="fas fa-check-circle mr-1"></i>ครูให้คะแนนแล้ว</span>
        <span style="color:#f59e0b;font-size:1rem;letter-spacing:2px;">${stars}</span>
      </div>
      ${log.feedback ? `<div style="color:rgba(255,255,255,0.7);border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;margin-top:4px;">💬 ${escapeHtml(log.feedback)}</div>` : ''}
    </div>`;
}

async function submitLearningLog() {
  const uid    = _usid();
  const videoId= _currentVideoId || document.getElementById('upskill-player-modal')?.dataset.videoId;
  const video  = _currentVideo   || _upskillVideos.find(v => v.id === videoId);
  if (!uid || !videoId || !video) {
    showCustomAlert('ไม่พบข้อมูลวิดีโอ', 'error');
    return;
  }

  const ta   = document.getElementById('upskill-log-notes');
  const notes= ta ? ta.value.trim() : '';
  if (!notes) {
    showCustomAlert('กรุณาเขียนสิ่งที่ได้เรียนรู้ก่อนส่ง', 'warning');
    return;
  }

  const submitBtn = document.getElementById('upskill-log-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>กำลังส่ง...'; }

  try {
    const res = await apiPost('saveLearningLog', withAuthData({
      userId: uid,
      videoId,
      videoTitle: video.title || '',
      categoryId: video.category || '',
      notes,
    }));

    if (!res || res.status !== 'success') {
      throw new Error((res && res.message) || 'ระบบเกิดข้อผิดพลาดในการบันทึก');
    }

    const status = document.getElementById('upskill-log-status');
    if (status) {
      status.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:8px 12px;font-size:0.78rem;color:#10b981;">
          <i class="fas fa-check-circle"></i> ส่งสำเร็จ! รอครูให้คะแนน
        </div>`;
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ส่งใหม่ (แก้ไข) ✈️'; }
    showCustomAlert('ส่งบันทึกการเรียนรู้สำเร็จ!', 'success');
  } catch(e) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ส่งให้ครูตรวจ ✈️'; }
    showCustomAlert('ส่งไม่สำเร็จ: ' + (e.message || e), 'error');
  }
}
window.submitLearningLog = submitLearningLog;

/* ────────────────────────────────────────
   ADMIN — จัดการวิดีโออัพสกิล
──────────────────────────────────────── */

let _adminUpSkillVideos = [];
let _adminUpSkillCats = [];

async function loadAdminUpSkillVideos() {
  // Always fetch categories first so they are fresh
  await loadUpSkillCategories();

  // Populate category filter dropdown for Admin
  const filterSelect = document.getElementById('admin-upskill-filter-cat');
  if (filterSelect) {
    const currentValue = filterSelect.value || '';
    let options = '<option value="">— เลือกหมวดหมู่เพื่อแสดงวิดีโอ —</option>';
    UPSKILL_CATEGORIES.forEach(cat => {
      options += `<option value="${cat.id}">${cat.label}</option>`;
    });
    filterSelect.innerHTML = options;
    filterSelect.value = currentValue;
  }

  const el = document.getElementById('admin-upskill-list');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</div>';

  try {
    const res = await apiGet('listUpSkillVideos', {});
    _adminUpSkillVideos = (res && Array.isArray(res.videos)) ? res.videos : [];
  } catch(e) {
    _adminUpSkillVideos = [];
  }
  _renderAdminUpSkillList();
}

function _renderAdminUpSkillList() {
  const el = document.getElementById('admin-upskill-list');
  if (!el) return;

  const filterSelect = document.getElementById('admin-upskill-filter-cat');
  const selectedCat = filterSelect ? filterSelect.value : '';

  if (!selectedCat) {
    el.innerHTML = `<div class="text-center py-8 text-muted" style="background: var(--glass); border-radius: 12px; border: 1px dashed var(--glass-border); padding: 30px 15px;">
      <i class="fas fa-hand-pointer mb-2" style="font-size:1.8rem; color:var(--primary); animation: bounce 2s infinite;"></i>
      <div class="font-bold text-theme-inv mb-1" style="font-size: 0.85rem;">เลือกหมวดหมู่เพื่อจัดการวิดีโอ</div>
      <p class="text-muted text-xxs">กรุณาเลือกหมวดหมู่ที่ต้องการจัดการวิดีโอด้านบน</p>
    </div>`;
    return;
  }

  const filteredVideos = _adminUpSkillVideos.filter(v => v.category === selectedCat);

  if (filteredVideos.length === 0) {
    el.innerHTML = '<div class="text-center py-8 text-muted"><i class="fas fa-video-slash fa-2x mb-3 d-block"></i>ยังไม่มีวิดีโอในหมวดหมู่นี้ กดปุ่ม "+ เพิ่มวิดีโอ" เพื่อเริ่มต้น</div>';
    return;
  }

  el.innerHTML = filteredVideos.map(v => {
    const cat   = UPSKILL_CATEGORIES.find(c => c.id === v.category) || { label: v.category, icon: 'fa-video', color: '#64748b' };
    const thumb = v.thumbnail || _getVideoThumbnail(v.url) || '';
    return `
      <div class="admin-upskill-item">
        <div class="admin-upskill-thumb">
          ${thumb
            ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-soft);"><i class="fas fa-film fa-2x"></i></div>`
          }
        </div>
        <div class="admin-upskill-info">
          <div class="admin-upskill-title">${escapeHtml(v.title || 'ไม่มีชื่อ')}</div>
          <div class="admin-upskill-cat" style="color:${cat.color};">
            <i class="fas ${cat.icon} mr-1"></i>${cat.label}
          </div>
          <div class="admin-upskill-url text-muted" style="font-size:0.7rem; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">
            ${escapeHtml(v.url || '')}
          </div>
        </div>
        <div class="admin-upskill-actions">
          <button class="btn-icon-sm" style="background:rgba(16,185,129,.15);color:#10b981;" 
                  onclick="openAdminUpSkillEdit('${v.id}')" title="แก้ไข">
            <i class="fas fa-pen"></i>
          </button>
          <button class="btn-icon-sm" style="background:rgba(239,68,68,.15);color:#ef4444;" 
                  onclick="deleteAdminUpSkillVideo('${v.id}')" title="ลบ">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

function filterAdminUpSkillVideos() {
  _renderAdminUpSkillList();
}
window.filterAdminUpSkillVideos = filterAdminUpSkillVideos;

function openAdminUpSkillModal(videoId) {
  const modal = document.getElementById('admin-upskill-modal');
  if (!modal) return;

  // Populate category selector options dynamically from our fresh category list
  const selectEl = document.getElementById('admin-upskill-cat');
  if (selectEl) {
    const options = UPSKILL_CATEGORIES.map(cat => `
      <option value="${cat.id}">${cat.label}</option>
    `).join('');
    selectEl.innerHTML = '<option value="">— เลือกหมวดหมู่ —</option>' + options;
  }

  const video = videoId ? _adminUpSkillVideos.find(v => v.id === videoId) : null;
  const filterSelect = document.getElementById('admin-upskill-filter-cat');
  const activeFilterCat = filterSelect ? filterSelect.value : '';

  document.getElementById('admin-upskill-modal-title').textContent = video ? 'แก้ไขวิดีโอ' : 'เพิ่มวิดีโอใหม่';
  document.getElementById('admin-upskill-id').value      = video ? video.id : '';
  document.getElementById('admin-upskill-title').value   = video ? (video.title || '') : '';
  document.getElementById('admin-upskill-url').value     = video ? (video.url || '') : '';
  document.getElementById('admin-upskill-desc').value    = video ? (video.description || '') : '';
  document.getElementById('admin-upskill-cat').value     = video ? (video.category || '') : activeFilterCat;

  // Preview
  _updateAdminUpSkillPreview(video ? video.url : '');

  modal.style.display = 'flex';
}
window.openAdminUpSkillModal = openAdminUpSkillModal;

function openAdminUpSkillEdit(videoId) {
  openAdminUpSkillModal(videoId);
}
window.openAdminUpSkillEdit = openAdminUpSkillEdit;

function closeAdminUpSkillModal() {
  const modal = document.getElementById('admin-upskill-modal');
  if (modal) modal.style.display = 'none';
}
window.closeAdminUpSkillModal = closeAdminUpSkillModal;

function _updateAdminUpSkillPreview(url) {
  const thumb = _getVideoThumbnail(url || '');
  const prev  = document.getElementById('admin-upskill-preview');
  if (!prev) return;
  if (thumb) {
    prev.innerHTML = `<img src="${thumb}" alt="preview" style="width:100%;border-radius:10px;max-height:140px;object-fit:cover;">`;
  } else if (url) {
    const icon = _isTikTok(url) ? 'fa-tiktok' : _isFacebook(url) ? 'fa-facebook' : 'fa-link';
    prev.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-soft);"><i class="fab ${icon} fa-3x mb-2 d-block"></i><small>ลิงก์: ${escapeHtml(url)}</small></div>`;
  } else {
    prev.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-soft);"><i class="fas fa-image fa-2x"></i></div>';
  }
}
window.onAdminUpSkillUrlChange = function() {
  const url = (document.getElementById('admin-upskill-url') || {}).value || '';
  _updateAdminUpSkillPreview(url);
};

async function saveAdminUpSkillVideo() {
  const id    = (document.getElementById('admin-upskill-id') || {}).value || '';
  const title = (document.getElementById('admin-upskill-title') || {}).value.trim();
  const url   = (document.getElementById('admin-upskill-url') || {}).value.trim();
  const desc  = (document.getElementById('admin-upskill-desc') || {}).value.trim();
  const cat   = (document.getElementById('admin-upskill-cat') || {}).value;

  if (!title || !url || !cat) {
    showCustomAlert('กรุณากรอกชื่อ, ลิงก์วิดีโอ และเลือกหมวดหมู่', 'warning');
    return;
  }

  const payload = { title, url, description: desc, category: cat };
  if (id) payload.id = id;

  try {
    showLoading(true);
    await apiPost('saveUpSkillVideo', withAuthData(payload));
    showLoading(false);
    closeAdminUpSkillModal();
    showCustomAlert(id ? 'อัพเดตวิดีโอสำเร็จ' : 'เพิ่มวิดีโอสำเร็จ', 'success');
    loadAdminUpSkillVideos();
  } catch(e) {
    showLoading(false);
    showCustomAlert('บันทึกไม่สำเร็จ: ' + (e.message || e), 'error');
  }
}
window.saveAdminUpSkillVideo = saveAdminUpSkillVideo;

async function deleteAdminUpSkillVideo(videoId) {
  showCustomConfirm('ต้องการลบวิดีโอนี้หรือไม่?', async function() {
    try {
      showLoading(true);
      await apiPost('deleteUpSkillVideo', withAuthData({ id: videoId }));
      showLoading(false);
      showCustomAlert('ลบวิดีโอสำเร็จ', 'success');
      loadAdminUpSkillVideos();
    } catch(e) {
      showLoading(false);
      showCustomAlert('ลบไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  });
}
window.deleteAdminUpSkillVideo = deleteAdminUpSkillVideo;


/* ────────────────────────────────────────
   ADMIN — จัดการหมวดหมู่ของวีดิโอ
──────────────────────────────────────── */

function switchAdminUpSkillSubTab(tabId) {
  const tabs = ['videos', 'cats'];
  tabs.forEach(t => {
    const btn     = document.getElementById(`admin-upskill-subtab-btn-${t}`);
    const content = document.getElementById(`admin-upskill-subtab-content-${t}`);
    if (btn)     btn.classList.toggle('active', t === tabId);
    if (content) content.style.display = (t === tabId) ? 'block' : 'none';
  });

  if (tabId === 'videos')  loadAdminUpSkillVideos();
  if (tabId === 'cats')    loadAdminUpSkillCategories();
}
window.switchAdminUpSkillSubTab = switchAdminUpSkillSubTab;


async function loadAdminUpSkillCategories() {
  const el = document.getElementById('admin-upskill-cat-list');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</div>';

  try {
    const res = await apiGet('listUpSkillCategories', {});
    _adminUpSkillCats = (res && Array.isArray(res.categories)) ? res.categories : [];
    // Synchronize global category list
    UPSKILL_CATEGORIES = _adminUpSkillCats.map(cat => ({
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      bg: _hexToRgbA(cat.color, 0.12)
    }));
  } catch(e) {
    _adminUpSkillCats = [];
  }
  _renderAdminUpSkillCatList();
}
window.loadAdminUpSkillCategories = loadAdminUpSkillCategories;

function _renderAdminUpSkillCatList() {
  const el = document.getElementById('admin-upskill-cat-list');
  if (!el) return;

  if (_adminUpSkillCats.length === 0) {
    el.innerHTML = '<div class="text-center py-8 text-muted"><i class="fas fa-tags fa-2x mb-3 d-block"></i>ยังไม่มีหมวดหมู่ กดปุ่ม "+ เพิ่มหมวดหมู่" เพื่อเริ่มต้น</div>';
    return;
  }

  el.innerHTML = _adminUpSkillCats.map(cat => `
    <div class="admin-upskill-item" style="border-left: 4px solid ${cat.color};">
      <div class="btn-icon-sm" style="background:${_hexToRgbA(cat.color, 0.15)};color:${cat.color};">
        <i class="fas ${cat.icon}"></i>
      </div>
      <div class="admin-upskill-info">
        <div class="admin-upskill-title" style="font-weight: 800;">${escapeHtml(cat.label || '')}</div>
        <div class="text-muted" style="font-size:0.7rem; margin-top:2px;">
          ID: ${escapeHtml(cat.id)} • ลำดับ: ${cat.order}
        </div>
      </div>
      <div class="admin-upskill-actions">
        <button class="btn-icon-sm" style="background:rgba(16,185,129,.15);color:#10b981;" 
                onclick="openAdminUpSkillCatModal('${cat.id}')" title="แก้ไข">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn-icon-sm" style="background:rgba(239,68,68,.15);color:#ef4444;" 
                onclick="deleteAdminUpSkillCategory('${cat.id}')" title="ลบ">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

function openAdminUpSkillCatModal(catId) {
  const modal = document.getElementById('admin-upskill-cat-modal');
  if (!modal) return;

  const cat = catId ? _adminUpSkillCats.find(c => c.id === catId) : null;

  document.getElementById('admin-upskill-cat-modal-title').textContent = cat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่';
  document.getElementById('admin-upskill-cat-id').value    = cat ? cat.id : '';
  document.getElementById('admin-upskill-cat-label').value = cat ? (cat.label || '') : '';
  document.getElementById('admin-upskill-cat-icon').value  = cat ? (cat.icon || '') : '';
  document.getElementById('admin-upskill-cat-color').value = cat ? (cat.color || '#10b981') : '#10b981';
  document.getElementById('admin-upskill-cat-order').value = cat ? (cat.order != null ? cat.order : '') : '';

  modal.style.display = 'flex';
}
window.openAdminUpSkillCatModal = openAdminUpSkillCatModal;

function closeAdminUpSkillCatModal() {
  const modal = document.getElementById('admin-upskill-cat-modal');
  if (modal) modal.style.display = 'none';
}
window.closeAdminUpSkillCatModal = closeAdminUpSkillCatModal;

async function saveAdminUpSkillCategory() {
  const id    = document.getElementById('admin-upskill-cat-id').value || '';
  const label = document.getElementById('admin-upskill-cat-label').value.trim();
  const icon  = document.getElementById('admin-upskill-cat-icon').value.trim();
  const color = document.getElementById('admin-upskill-cat-color').value;
  const order = document.getElementById('admin-upskill-cat-order').value;

  if (!label || !icon || !color) {
    showCustomAlert('กรุณากรอกชื่อหมวดหมู่, ไอคอน และเลือกสี', 'warning');
    return;
  }

  const payload = { label, icon, color };
  if (id) payload.id = id;
  if (order !== '') payload.order = Number(order);

  try {
    showLoading(true);
    await apiPost('saveUpSkillCategory', withAuthData(payload));
    showLoading(false);
    closeAdminUpSkillCatModal();
    showCustomAlert(id ? 'อัปเดตหมวดหมู่สำเร็จ' : 'เพิ่มหมวดหมู่สำเร็จ', 'success');
    loadAdminUpSkillCategories();
  } catch(e) {
    showLoading(false);
    showCustomAlert('บันทึกหมวดหมู่ไม่สำเร็จ: ' + (e.message || e), 'error');
  }
}
window.saveAdminUpSkillCategory = saveAdminUpSkillCategory;

async function deleteAdminUpSkillCategory(catId) {
  showCustomConfirm('ต้องการลบหมวดหมู่นี้ใช่หรือไม่? (วิดีโอในหมวดหมู่นี้จะยังอยู่แต่ไม่มีการแสดงผล)', async function() {
    try {
      showLoading(true);
      await apiPost('deleteUpSkillCategory', withAuthData({ id: catId }));
      showLoading(false);
      showCustomAlert('ลบหมวดหมู่สำเร็จ', 'success');
      loadAdminUpSkillCategories();
    } catch(e) {
      showLoading(false);
      showCustomAlert('ลบไม่สำเร็จ: ' + (e.message || e), 'error');
    }
  });
}
window.deleteAdminUpSkillCategory = deleteAdminUpSkillCategory;


/* ────────────────────────────────────────
   ADMIN — บันทึกการเรียนรู้ (Learning Logs)
──────────────────────────────────────── */
let _adminLearningLogs    = [];
let _adminLogFilter       = 'all';
let _adminGradingLogId    = null;

async function loadAdminLearningLogs(filter) {
  if (filter !== undefined) _adminLogFilter = filter;
  const el = document.getElementById('admin-learning-log-list');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-4 text-muted"><i class="fas fa-spinner fa-spin mr-2"></i>กำลังโหลด...</div>';

  // Update filter tab active state
  document.querySelectorAll('.admin-log-filter-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('admin-log-filter-' + _adminLogFilter);
  if (activeBtn) activeBtn.classList.add('active');

  try {
    const res = await apiGet('listLearningLogs', withAuthData({ statusFilter: _adminLogFilter }));
    _adminLearningLogs = (res && Array.isArray(res.logs)) ? res.logs : [];
  } catch(e) {
    _adminLearningLogs = [];
  }
  _renderAdminLearningLogs();
}
window.loadAdminLearningLogs = loadAdminLearningLogs;

function _renderAdminLearningLogs() {
  const el = document.getElementById('admin-learning-log-list');
  if (!el) return;

  if (_adminLearningLogs.length === 0) {
    el.innerHTML = '<div class="text-center py-8 text-muted"><i class="fas fa-book-open fa-2x mb-3 d-block"></i>ยังไม่มีบันทึกการเรียนรู้</div>';
    return;
  }

  el.innerHTML = _adminLearningLogs.map(log => {
    const cat   = UPSKILL_CATEGORIES.find(c => c.id === log.categoryId) || { label: log.categoryId, color: '#64748b', icon: 'fa-video' };
    const stars = log.score ? '★'.repeat(log.score) + '☆'.repeat(5 - log.score) : '—';
    const badgeStyle = log.status === 'graded'
      ? 'background:rgba(16,185,129,0.12);color:#10b981;'
      : 'background:rgba(245,158,11,0.12);color:#f59e0b;';
    const badgeText = log.status === 'graded' ? '✓ ให้คะแนนแล้ว' : '⏳ รอให้คะแนน';
    const dt = log.submittedAt ? new Date(log.submittedAt).toLocaleDateString('th-TH') : '';

    return `
      <div class="admin-upskill-item" style="flex-direction:column;align-items:flex-start;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:0.9rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(log.videoTitle || log.videoId)}</div>
            <div style="font-size:0.72rem;color:${cat.color};margin-top:2px;"><i class="fas ${cat.icon} mr-1"></i>${cat.label}</div>
            <div style="font-size:0.68rem;color:var(--text-soft);margin-top:2px;">ผู้เรียน: ${escapeHtml(log.userId)} • ${dt}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-left:10px;">
            <span style="font-size:0.68rem;padding:3px 8px;border-radius:20px;${badgeStyle}">${badgeText}</span>
            ${log.score ? `<span style="color:#f59e0b;font-size:0.85rem;">${stars}</span>` : ''}
          </div>
        </div>
        <div style="font-size:0.78rem;color:var(--text-soft);background:var(--bg2);border-radius:8px;padding:8px 10px;width:100%;line-height:1.5;max-height:80px;overflow:hidden;">${escapeHtml(log.notes).substring(0, 200)}${log.notes.length > 200 ? '...' : ''}</div>
        <div style="display:flex;gap:6px;align-self:flex-end;">
          <button class="btn-icon-sm" style="background:rgba(99,102,241,.15);color:#6366f1;padding:4px 10px;font-size:0.75rem;border-radius:8px;" 
                  onclick="openAdminGradeModal('${log.id}')">
            <i class="fas fa-star mr-1"></i>${log.status === 'graded' ? 'แก้คะแนน' : 'ให้คะแนน'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function openAdminGradeModal(logId) {
  const log = _adminLearningLogs.find(l => l.id === logId);
  if (!log) return;
  _adminGradingLogId = logId;

  const modal = document.getElementById('admin-grade-log-modal');
  if (!modal) return;

  document.getElementById('admin-grade-video-title').textContent = log.videoTitle || log.videoId;
  document.getElementById('admin-grade-user-id').textContent = log.userId;
  document.getElementById('admin-grade-notes').textContent = log.notes;
  document.getElementById('admin-grade-score').value = log.score || '';
  document.getElementById('admin-grade-feedback').value = log.feedback || '';

  // Set star rating UI
  _setAdminStarRating(log.score || 0);

  modal.style.display = 'flex';
}
window.openAdminGradeModal = openAdminGradeModal;

function _setAdminStarRating(score) {
  document.querySelectorAll('.admin-grade-star').forEach((star, i) => {
    star.classList.toggle('active', i < score);
  });
  const inp = document.getElementById('admin-grade-score');
  if (inp) inp.value = score || '';
}
window._setAdminStarRating = _setAdminStarRating;

function selectAdminStar(score) {
  _setAdminStarRating(score);
}
window.selectAdminStar = selectAdminStar;

function closeAdminGradeModal() {
  const modal = document.getElementById('admin-grade-log-modal');
  if (modal) modal.style.display = 'none';
  _adminGradingLogId = null;
}
window.closeAdminGradeModal = closeAdminGradeModal;

async function saveAdminGrade() {
  const logId    = _adminGradingLogId;
  const score    = document.getElementById('admin-grade-score').value;
  const feedback = document.getElementById('admin-grade-feedback').value.trim();

  if (!logId || !score) {
    showCustomAlert('กรุณาเลือกคะแนน 1-5 ดาวก่อน', 'warning');
    return;
  }

  try {
    showLoading(true);
    await apiPost('gradeLearningLog', withAuthData({ logId, score: Number(score), feedback }));
    showLoading(false);
    closeAdminGradeModal();
    showCustomAlert('ให้คะแนนสำเร็จ!', 'success');
    loadAdminLearningLogs();
  } catch(e) {
    showLoading(false);
    showCustomAlert('บันทึกคะแนนไม่สำเร็จ: ' + (e.message || e), 'error');
  }
}
window.saveAdminGrade = saveAdminGrade;

/* ────────────────────────────────────────
   INIT YouTube API on module load
──────────────────────────────────────── */
_loadYouTubeAPI();

/* ────────────────────────────────────────
   EXPORT to window for app.js
──────────────────────────────────────── */
window.initUpSkillPage        = initUpSkillPage;
window.loadAdminUpSkillVideos = loadAdminUpSkillVideos;

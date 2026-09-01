const LEGACY_APPS_SCRIPT_API_URL = 'https://script.google.com/macros/s/AKfycby5vSJSJZiL9qu6GPJgwVXNOIJvuHRc0JIqhf2TLp8j3kXcniD9HqShiIDt3-PUKjLA/exec';
const LOFT_BASE_PATH = (function() {
  if (typeof window === 'undefined' || location.protocol === 'file:') return '';
  const path = window.location.pathname || '';
  const lastSlash = path.lastIndexOf('/');
  const dir = lastSlash >= 0 ? path.substring(0, lastSlash) : '';
  return (dir && dir !== '/' ? dir : '');
})();
const API_URL = window.LOFT_API_URL || (location.protocol === 'file:' ? LEGACY_APPS_SCRIPT_API_URL : LOFT_BASE_PATH + '/api');
const LOFT_FIREBASE_FREE_MODE = window.LOFT_FIREBASE_FREE_MODE === true;
const LOFT_PLACEHOLDER_IMAGE = LOFT_BASE_PATH + '/assets/placeholder-image.svg';
const LOFT_AUTH_STORAGE_KEYS = [
  'authToken', 'nfe_auth_token', 'nfe_user', 'userPhone', 'userName', 'userRole', 'userTambon',
  'userScore', 'userNFEHours'
];
let loftUnauthorizedHandled = false;

function hasAuthenticatedSession() {
  const phone = localStorage.getItem('userPhone') || '';
  const role = String(localStorage.getItem('userRole') || '').trim().toLowerCase();
  const token = localStorage.getItem('authToken') || localStorage.getItem('nfe_auth_token') || '';
  return Boolean(phone && phone !== 'guest' && role !== 'guest' && token);
}

function clearStoredAuthSession() {
  LOFT_AUTH_STORAGE_KEYS.forEach(function(key) {
    localStorage.removeItem(key);
  });
  sessionStorage.clear();
}

function handleUnauthorizedSession() {
  if (loftUnauthorizedHandled) return;
  loftUnauthorizedHandled = true;
  clearStoredAuthSession();
  if (typeof showCustomAlert === 'function') {
    showCustomAlert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง", "warning");
  }
}

const PUBLIC_EXEMPT_ACTIONS = new Set([
  'getHomeData',
  'getHomeSummary',
  'getSources',
  'getSourceDetail',
  'getMapSources',
  'getLeaderboard',
  'getProducts',
  'getMarketProducts',
  'getUserProfile',
  'listUpSkillVideos',
  'listUpskillVideos',
  'listUpSkillCategories',
  'listUpskillCategories',
  'getUpSkillProgress',
  'getUpskillProgress',
  'getLearningLog',
  'getGlobalSettings',
  'getAISummary',
  'getCertIssuanceHistory',
  'getCertificateRegistry',
  'exportCertificateRegistryWord',
  'getNFEAdminReport',
  'getInstitutions',
  'getUserCoupons',
  'getCoupons'
]);

const FIREBASE_FREE_EXEMPT_ACTIONS = new Set([
  'register',
  'login',
  'logout',
  'changePassword',
  'forceChangePassword',
  'getCosmeticsCatalog',
  'buyCosmetic',
  'equipCosmetic',
  'getHomeData',
  'getHomeSummary',
  'getSources',
  'getSourceDetail',
  'getMapSources',
  'getLeaderboard',
  'getUserProfile',
  'getProfile',
  'getProducts',
  'saveProduct',
  'deleteProduct',
  'redeemCoupon',
  'getUserCoupons',
  'getUserPointsHistory',
  'getUserBadges',
  'getCertificateRegistry',
  'exportCertificateRegistryWord',
  'spinLuckyWheel',
  'checkInSource',
  'checkInActivity',
  'getActivities',
  'createActivity',
  'updateActivity',
  'deleteActivity',
  'submitProposal',
  'reviewProposal',
  'getPendingProposals',
  'submitSurvey',
  'submitEvaluation',
  'redeemNFEHours',
  'getNFEHistory',
  'getNFEAdminReport',
  'useNFEHours',
  'getUserCertificates',
  'generateCert',
  'revokeCert',
  'getIDPlans',
  'generateAIDraft',
  'createOrUpdateIDPlan',
  'rePlanVisit',
  'getActivityCheckIns',
  'getActivityQuizzes',
  'saveActivityQuizzes',
  'saveActivityCertificateTemplate',
  'submitActivityQuiz',
  'getInstitutions',
  'createOrUpdateInstitution',
  'updateSubUnits',
  'deleteInstitution',
  'importSourcesCsv',
  'getAdminBasesBySource',
  'saveAdminBase',
  'deleteAdminBase',
  'saveAdminBaseOrder',
  'getAdminQuizBySource',
  'saveAdminQuiz',
  'saveAdminQuizBatch',
  'deleteAdminQuiz',
  'saveAdminQuizOrder',
  'importAdminQuizCsv',
  'saveSourceEvaluation',
  'generateSourceStandardCert',
  'listUpskillVideos',
  'listUpSkillVideos',
  'saveUpskillVideo',
  'saveUpSkillVideo',
  'deleteUpskillVideo',
  'deleteUpSkillVideo',
  'listUpskillCategories',
  'listUpSkillCategories',
  'saveUpskillCategory',
  'saveUpSkillCategory',
  'deleteUpskillCategory',
  'deleteUpSkillCategory',
  'getHomeAdminData',
  'getAdminHomeData',
  'saveQuarterActivity',
  'deleteQuarterActivity',
  'saveFeaturedActivity',
  'getPendingLogs',
  'getLearningLogs',
  'reviewLog',
  'gradeLearningLog',
  'getNfeReports',
  'completeUpskillVideo',
  'completeVideo'
]);

const DISABLED_FREE_MODE_PAGES = new Set([
  'market-page',
  'scan-page',
  'proposal-page',
  'admin-activities-page',
  'admin-coupons-page'
]);

function isFirebaseFreePageDisabled(pageId) {
  return LOFT_FIREBASE_FREE_MODE && DISABLED_FREE_MODE_PAGES.has(pageId);
}

const LOFT_API_CACHE_PREFIX = 'loft_api_cache_v2:';
const LOFT_API_CACHE_CONFIG = {
  getSources: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  getSourceDetail: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  getMapSources: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  // getGlobalSettings: ปิดการแคชเบราว์เซอร์ เพื่อให้ข้อมูลตั้งค่าระบบ/ลายเซ็น Real-time 100%
  getHomeData: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  getLeaderboard: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  getUserCertificates: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  getUserBadges: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  getNFEHistory: { ttl: 10 * 1000, store: 'session', skipStaff: true },
  getUserPointsHistory: { ttl: 10 * 1000, store: 'session', skipStaff: true }
};

const LOFT_API_CACHE_CLEAR_GROUPS = {
  learning: ['getSources', 'getSourceDetail', 'getMapSources', 'getHomeData'],
  globalSettings: ['getGlobalSettings'],
  leaderboard: ['getLeaderboard'],
  profile: ['getUserCertificates', 'getUserBadges', 'getNFEHistory', 'getUserPointsHistory'],
  home: ['getHomeData']
};

function featureDisabledResponse(action) {
  return Promise.resolve({
    status: 'disabled',
    message: 'ฟีเจอร์นี้ถูกปิดชั่วคราวเพื่อให้ระบบพร้อมย้ายไป Firebase แบบฟรี',
    action: action
  });
}

function parseApiResponse(response) {
  return response.text().then(function(text) {
    let data = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      throw new Error(text ? text.substring(0, 160) : 'Empty response');
    }

    if (!response.ok) {
      if (response.status === 401) handleUnauthorizedSession();
      const error = new Error((data && data.message) || ('HTTP ' + response.status));
      error.status = response.status;
      error.payload = data;
      throw error;
    }

    if (data && data.status === 'error' && response.status === 401) {
      handleUnauthorizedSession();
    }

    return data;
  });
}

function withAuthParams(params) {
  params = params || {};
  const phone = localStorage.getItem('userPhone') || localStorage.getItem('phone') || '';
  const token = localStorage.getItem('authToken') || localStorage.getItem('nfe_auth_token') || '';

  if (phone && phone !== 'guest' && !params.phone && !params.username) {
    params.username = phone;
  }
  if (token && !params.token) {
    params.token = token;
  }
  return params;
}

function getClientStorage(storeType) {
  try {
    return storeType === 'session' ? window.sessionStorage : window.localStorage;
  } catch (e) {
    return null;
  }
}

function isStaffSession() {
  const role = String(localStorage.getItem('userRole') || 'user').trim().toLowerCase();
  return role === 'admin' || role === 'teacher';
}

function getApiCacheKey(action, params) {
  return LOFT_API_CACHE_PREFIX + action + ':' + JSON.stringify(params || {});
}

function readClientApiCache(action, params) {
  const cfg = LOFT_API_CACHE_CONFIG[action];
  if (!cfg) return null;
  if (cfg.skipStaff && isStaffSession()) return null;

  const storage = getClientStorage(cfg.store);
  if (!storage) return null;

  try {
    const raw = storage.getItem(getApiCacheKey(action, params));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || !parsed.data) return null;
    if (Date.now() - parsed.timestamp > cfg.ttl) {
      storage.removeItem(getApiCacheKey(action, params));
      return null;
    }
    return parsed.data;
  } catch (e) {
    return null;
  }
}

function writeClientApiCache(action, params, data) {
  const cfg = LOFT_API_CACHE_CONFIG[action];
  if (!cfg || !data || data.status === 'error') return;
  if (cfg.skipStaff && isStaffSession()) return;

  const storage = getClientStorage(cfg.store);
  if (!storage) return;

  try {
    storage.setItem(getApiCacheKey(action, params), JSON.stringify({
      timestamp: Date.now(),
      data: data
    }));
  } catch (e) {}
}

function invalidateClientCache(groups) {
  if (!groups || !groups.length) return;
  if (typeof groups === 'string') groups = [groups];

  var actions = [];
  groups.forEach(function(group) {
    (LOFT_API_CACHE_CLEAR_GROUPS[group] || []).forEach(function(item) {
      if (actions.indexOf(item) === -1) actions.push(item);
    });
  });

  ['session', 'local'].forEach(function(storeType) {
    var storage = getClientStorage(storeType);
    if (!storage) return;
    try {
      var keysToRemove = [];
      for (var i = 0; i < storage.length; i++) {
        var key = storage.key(i);
        if (key && key.indexOf(LOFT_API_CACHE_PREFIX) === 0) {
          actions.forEach(function(act) {
            if (key.indexOf(LOFT_API_CACHE_PREFIX + act + ':') === 0) {
              keysToRemove.push(key);
            }
          });
        }
      }
      keysToRemove.forEach(function(k) { storage.removeItem(k); });
    } catch (e) {}
  });
}

function apiGet(action, params) {
  params = params || {};
  if (LOFT_FIREBASE_FREE_MODE && !FIREBASE_FREE_EXEMPT_ACTIONS.has(action)) {
    return featureDisabledResponse(action);
  }

  const cached = readClientApiCache(action, params);
  if (cached) return Promise.resolve(cached);

  const cleanParams = {};
  Object.keys(params).forEach(function(k) {
    if (params[k] !== null && params[k] !== undefined && String(params[k]) !== '') {
      cleanParams[k] = params[k];
    }
  });

  const queryStr = new URLSearchParams(cleanParams).toString();
  const url = API_URL + '?action=' + action + (queryStr ? '&' + queryStr : '');
  const headers = {};
  const token = localStorage.getItem('authToken') || localStorage.getItem('nfe_auth_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;

  return fetch(url, { method: 'GET', headers: headers })
    .then(parseApiResponse)
    .then(function(data) {
      writeClientApiCache(action, params, data);
      return data;
    });
}

function apiPost(action, data) {
  data = data || {};
  if (LOFT_FIREBASE_FREE_MODE && !FIREBASE_FREE_EXEMPT_ACTIONS.has(action)) {
    return featureDisabledResponse(action);
  }

  const bodyData = Object.assign({}, data, { action: action });
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('authToken') || localStorage.getItem('nfe_auth_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;

  if (action.indexOf('Source') > -1 || action.indexOf('Base') > -1 || action.indexOf('Quiz') > -1 || action === 'importAdminQuizCsv') {
    invalidateClientCache(['learning', 'home']);
  }
  if (action === 'saveGlobalSettings' || action === 'uploadGeneralImage') {
    invalidateClientCache(['globalSettings']);
  }
  if (['submitQuiz', 'logPointsTransaction', 'logSpinTransaction', 'redeemCoupon', 'spinLuckyWheel', 'redeemNFEHours', 'useNFEHours', 'approveProfileImage', 'updateUserDetails', 'deleteUser'].indexOf(action) > -1) {
    invalidateClientCache(['leaderboard', 'profile', 'home']);
  }
  if (['generateCert', 'saveCertUrl', 'revokeCert'].indexOf(action) > -1) {
    invalidateClientCache(['profile']);
  }
  if (['saveFeaturedActivity', 'saveQuarterActivity', 'deleteQuarterActivity', 'createActivity', 'updateActivity', 'deleteActivity', 'submitProposal', 'reviewProposal'].indexOf(action) > -1) {
    invalidateClientCache(['home']);
  }

  return fetch(API_URL, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(bodyData)
  }).then(parseApiResponse);
}

let INSTITUTION_SUB_UNITS_MAP = {
  'INS_PHRAO': [
    'ศกร.ระดับตำบลเวียง', 'ศกร.ระดับตำบลทุ่งหลวง', 'ศกร.ระดับตำบลป่าตุ้ม', 'ศกร.ระดับตำบลป่าไหน่',
    'ศกร.ระดับตำบลสันทราย', 'ศกร.ระดับตำบลบ้านโป่ง', 'ศกร.ระดับตำบลน้ำแพร่', 'ศกร.ระดับตำบลเขื่อนผาก',
    'ศกร.ระดับตำบลแม่แวน', 'ศกร.ระดับตำบลแม่ปั๋ง', 'ศกร.ระดับตำบลโหล่งขอด', 'ศศช.บ้านอาบอลาชา',
    'ศศช.บ้านอาบอเน', 'ศศช.บ้านอาแย', 'ศศช.บ้านป่าหญ้าไทร', 'ศศช.บ้านขอนม่วง',
    'ศศช.บ้านแม่งัดน้อย', 'ศศช.บ้านห้วยทรายขาว', 'ศศช.บ้านห้วยกันใจ', 'ศศช.บ้านปางตอย',
    'ศศช.บ้านปางฟาน'
  ],
  'INS_MAERIM': [
    'ศกร.ระดับตำบลแม่ริม', 'ศกร.ระดับตำบลโป่งแยง', 'ศกร.ระดับตำบลแม่แรม'
  ]
};

try {
  const cachedSubMap = localStorage.getItem('cachedInstitutionsSubUnits');
  if (cachedSubMap) {
    const parsed = JSON.parse(cachedSubMap);
    if (parsed && typeof parsed === 'object') {
      INSTITUTION_SUB_UNITS_MAP = Object.assign({}, INSTITUTION_SUB_UNITS_MAP, parsed);
    }
  }
} catch (e) {}

window.INSTITUTION_SUB_UNITS_MAP = INSTITUTION_SUB_UNITS_MAP;

function syncInstitutionsData(institutionsList) {
  if (!Array.isArray(institutionsList)) return;
  window._cachedInstitutionsList = institutionsList;
  const newMap = Object.assign({}, INSTITUTION_SUB_UNITS_MAP);
  
  institutionsList.forEach(function(inst) {
    let units = Array.isArray(inst.sub_units) ? inst.sub_units : (typeof inst.sub_units === 'string' ? JSON.parse(inst.sub_units || '[]') : []);
    if (!Array.isArray(units)) units = [];
    
    if (inst.id) newMap[inst.id] = units;
    if (inst.code) newMap[inst.code] = units;
    if (inst.district) newMap[inst.district] = units;
    if (inst.name) newMap[inst.name] = units;
  });

  INSTITUTION_SUB_UNITS_MAP = newMap;
  window.INSTITUTION_SUB_UNITS_MAP = newMap;
  try {
    localStorage.setItem('cachedInstitutionsSubUnits', JSON.stringify(newMap));
  } catch (e) {}
}
window.syncInstitutionsData = syncInstitutionsData;

function refreshInstitutionsGlobal(callback) {
  return apiGet('getInstitutions', {})
    .then(function(res) {
      if (res && res.status === 'success' && Array.isArray(res.institutions)) {
        syncInstitutionsData(res.institutions);
      }
      if (typeof callback === 'function') callback(res && res.institutions ? res.institutions : []);
      return res;
    }).catch(function(err) {
      if (typeof callback === 'function') callback([]);
      return err;
    });
}
window.refreshInstitutionsGlobal = refreshInstitutionsGlobal;

// Auto-refresh institutions on load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { refreshInstitutionsGlobal(); });
  } else {
    setTimeout(function() { refreshInstitutionsGlobal(); }, 0);
  }
}

function getSubUnitsForInstitution(instId) {
  const map = window.INSTITUTION_SUB_UNITS_MAP || INSTITUTION_SUB_UNITS_MAP;
  
  if (!instId || instId === 'ALL' || instId === 'ทั้งหมด') {
    const list = [];
    const set = new Set();
    if (Array.isArray(window._cachedInstitutionsList) && window._cachedInstitutionsList.length > 0) {
      window._cachedInstitutionsList.forEach(function(inst) {
        const units = Array.isArray(inst.sub_units) ? inst.sub_units : [];
        units.forEach(function(u) {
          if (!set.has(u)) { set.add(u); list.push(u); }
        });
      });
      if (list.length > 0) return list;
    }
    Object.keys(map).forEach(function(k) {
      if (k.startsWith('INS_')) {
        (map[k] || []).forEach(function(u) {
          if (!set.has(u)) { set.add(u); list.push(u); }
        });
      }
    });
    return list;
  }

  let cleanId = String(instId || '').trim();
  
  if (Array.isArray(window._cachedInstitutionsList)) {
    const found = window._cachedInstitutionsList.find(function(i) {
      return i.id === cleanId || i.code === cleanId || i.district === cleanId || i.name === cleanId;
    });
    if (found && Array.isArray(found.sub_units) && found.sub_units.length > 0) {
      return found.sub_units;
    }
  }

  if (map[cleanId] && Array.isArray(map[cleanId])) {
    return map[cleanId];
  }

  if (cleanId === 'MAERIM' || cleanId === 'แม่ริม' || cleanId === 'อำเภอแม่ริม') cleanId = 'INS_MAERIM';
  if (cleanId === 'PHRAO' || cleanId === 'พร้าว' || cleanId === 'อำเภอพร้าว') cleanId = 'INS_PHRAO';

  if (map[cleanId] && Array.isArray(map[cleanId])) {
    return map[cleanId];
  }

  return map['INS_PHRAO'] || [];
}
window.getSubUnitsForInstitution = getSubUnitsForInstitution;

function normalizeTambon(v) {
  if (v == null) return '';
  let str = String(v).trim();
  if (str === 'ทั้งหมด' || str.toLowerCase() === 'all') return 'all';

  const map = {
    'เวียง': 'ศกร.ระดับตำบลเวียง',
    'ทุ่งหลวง': 'ศกร.ระดับตำบลทุ่งหลวง',
    'ป่าตุ้ม': 'ศกร.ระดับตำบลป่าตุ้ม',
    'ป่าไหน่': 'ศกร.ระดับตำบลป่าไหน่',
    'สันทราย': 'ศกร.ระดับตำบลสันทราย',
    'บ้านโป่ง': 'ศกร.ระดับตำบลบ้านโป่ง',
    'น้ำแพร่': 'ศกร.ระดับตำบลน้ำแพร่',
    'เขื่อนผาก': 'ศกร.ระดับตำบลเขื่อนผาก',
    'แม่แวน': 'ศกร.ระดับตำบลแม่แวน',
    'แม่ปั๋ง': 'ศกร.ระดับตำบลแม่ปั๋ง',
    'โหล่งขอด': 'ศกร.ระดับตำบลโหล่งขอด',

    'บ้านอาบอลาชา': 'ศศช.บ้านอาบอลาชา',
    'บ้านอาบอเน': 'ศศช.บ้านอาบอเน',
    'บ้านอาแย': 'ศศช.บ้านอาแย',
    'บ้านป่าหญ้าไทร': 'ศศช.บ้านป่าหญ้าไทร',
    'บ้านขอนม่วง': 'ศศช.บ้านขอนม่วง',
    'บ้านแม่งัดน้อย': 'ศศช.บ้านแม่งัดน้อย',
    'บ้านห้วยทรายขาว': 'ศศช.บ้านห้วยทรายขาว',
    'บ้านห้วยกันใจ': 'ศศช.บ้านห้วยกันใจ',
    'บ้านปางตอย': 'ศศช.บ้านปางตอย',
    'บ้านปางฟาน': 'ศศช.บ้านปางฟาน',

    'แม่ริม': 'ศกร.ระดับตำบลแม่ริม',
    'โป่งแยง': 'ศกร.ระดับตำบลโป่งแยง',
    'ห้วยทราย': 'ศกร.ระดับตำบลห้วยทราย',
    'แม่แรม': 'ศกร.ระดับตำบลแม่แรม',
    'สะลวง': 'ศกร.ระดับตำบลสะลวง',
    'สันโป่ง': 'ศกร.ระดับตำบลสันโป่ง',
    'ขี้เหล็ก': 'ศกร.ระดับตำบลขี้เหล็ก',
    'ริมใต้': 'ศกร.ระดับตำบลริมใต้',
    'ริมเหนือ': 'ศกร.ระดับตำบลริมเหนือ',
    'แม่สา': 'ศกร.ระดับตำบลแม่สา',
    'ดอนแก้ว': 'ศกร.ระดับตำบลดอนแก้ว',
    'เหมืองแก้ว': 'ศกร.ระดับตำบลเหมืองแก้ว'
  };

  const validValues = Object.values(map);
  if (validValues.includes(str)) {
    return str;
  }

  let stripped = str.replace(/^((ศกร\.?|สกร\.?|ระดับตำบล|ต\.|ตำบล|ตำบลำบล|ตำบลตำบล|ศศช\.|บ้าน|บ\.)\s*)+/gu, '').replace(/^ำบล/gu, '').trim();
  if (map[stripped]) return map[stripped];
  if (map['บ้าน' + stripped]) return map['บ้าน' + stripped];

  return str;
}

function formatTambon(v) {
  const norm = normalizeTambon(v);
  if (!norm || norm === 'all') return 'ทุกพื้นที่';
  return norm;
}

function cleanTambonForCompare(name) {
  if (!name) return '';
  const clean = String(name).trim();
  return clean.replace(/^(?:ศกร\.ระดับตำบล|สกร\.ระดับตำบล|ศกร\.ตำบล|สกร\.ตำบล|ศศช\.บ้าน|ศศช\.|สกร\.|ศกร\.|ต\.|ตำบล|บ้าน|บ\.)\s*/u, '').trim();
}
window.cleanTambonForCompare = cleanTambonForCompare;

function setSelectTambonValue(selectId, tambonName) {
  const select = document.getElementById(selectId);
  if (!select) return;
  if (!tambonName) {
    select.value = "";
    return;
  }
  const cleanTarget = cleanTambonForCompare(tambonName);
  for (let i = 0; i < select.options.length; i++) {
    const opt = select.options[i];
    if (cleanTambonForCompare(opt.value) === cleanTarget) {
      select.value = opt.value;
      return;
    }
  }
  select.value = tambonName;
}
window.setSelectTambonValue = setSelectTambonValue;

function getValidImageUrl(url) {
  if (!url) return LOFT_PLACEHOLDER_IMAGE;
  if (Array.isArray(url)) {
    url = url.length > 0 ? url[0] : '';
  }
  let str = String(url).trim();
  if (!str || str === '[]' || str === '[' || str === 'null' || str === 'undefined') {
    return LOFT_PLACEHOLDER_IMAGE;
  }

  // Handle JSON array string
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return getValidImageUrl(parsed[0]);
      }
    } catch(e) {
      str = str.replace(/^[\["'`\s]+|[\]"'`\s]+$/g, '');
    }
  }

  // Strip accidental outer quotes or brackets
  str = str.replace(/^[\["'`\s]+|[\]"'`\s]+$/g, '');
  if (!str || str === '[') return LOFT_PLACEHOLDER_IMAGE;

  if (str.indexOf('/storage/') > -1 || str.indexOf('storage/uploads/') > -1 || str.indexOf('storage/firebase/') > -1 || str.startsWith('storage/')) {
    let sub = '';
    if (str.indexOf('/storage/') > -1) {
      sub = str.split('/storage/')[1] || '';
    } else {
      sub = str.replace(/^.*?storage\//, '');
    }
    const cleanSub = sub.replace(/[\]"'`\s]+$/g, '');
    return (LOFT_BASE_PATH ? LOFT_BASE_PATH : '') + '/storage/' + cleanSub;
  }

  if (str.startsWith('assets/') || str.startsWith('/assets/')) {
    const cleanAsset = str.replace(/^\/?assets\//, '');
    return (LOFT_BASE_PATH ? LOFT_BASE_PATH : '') + '/assets/' + cleanAsset;
  }

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

function escapeJS(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function withAuthData(params) {
  return withAuthParams(params);
}

window.apiGet = apiGet;
window.apiPost = apiPost;
window.withAuthParams = withAuthParams;
window.withAuthData = withAuthParams;
window.hasAuthenticatedSession = hasAuthenticatedSession;
window.clearStoredAuthSession = clearStoredAuthSession;
window.handleUnauthorizedSession = handleUnauthorizedSession;
window.isFirebaseFreePageDisabled = isFirebaseFreePageDisabled;
window.normalizeTambon = normalizeTambon;
window.formatTambon = formatTambon;
window.getValidImageUrl = getValidImageUrl;
window.invalidateClientCache = invalidateClientCache;
window.escapeJS = escapeJS;
window.escapeHtml = escapeHtml;

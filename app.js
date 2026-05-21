/**
 * ระบบส่งเสริมการเรียนรู้ตลอดชีวิต สกร.อำเภอพร้าว
 * Backend REST API (Google Apps Script Web App)
 *
 * วิธี Deploy:
 *   Extensions > Apps Script > Deploy > New Deployment
 *   Type: Web App | Execute as: Me | Access: Anyone
 *
 * API Base URL: https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
 *
 * GET  ?action=getSources
 * GET  ?action=getDashboard&tambon=...
 * GET  ?action=getLeaderboard
 * GET  ?action=getUserLogs&username=...&page=1&startDate=...&endDate=...  (phone= รองรับเดิม)
 * GET  ?action=getPendingLogs&tambon=...
 * GET  ?action=getUserProfile&username=...  (phone= รองรับเดิม)
 *
 * POST body (JSON, Content-Type: text/plain):
 *   { "action": "register",      "data": { ...fields } }
 *   { "action": "login",         "data": { "username": "", "password": "" } }  (phone รองรับเดิม)
 *   { "action": "submitLog",     "data": { ...fields } }
 *   { "action": "submitQuiz",    "data": { ...fields } }
 *   { "action": "reviewLog",     "data": { ...fields } }
 *   { "action": "uploadImage",   "data": { ...fields } }
 *   { "action": "generateCert",  "data": { ...fields } }
 *   { "action": "submitSurvey",  "data": { ...fields } }
 */

const CERT_TEMPLATE_ID = "1TcQubXJFfIVpoRQsMbIrb8TMeiQFWdiVallzCJl0oes";
const PDF_FOLDER_ID    = "1tjaLgeY77nnpO1MyzT4Ipv5s7ehI4j7j";
const FOLDER_ID        = "1tjaLgeY77nnpO1MyzT4Ipv5s7ehI4j7j";
const SS = SpreadsheetApp.getActiveSpreadsheet();

// ── Response Helper ───────────────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Global Cache for single request execution
const _G_CACHE = {
  sheets: {},
  actor: null
};

function getSheetValues(sheetName) {
  if (_G_CACHE.sheets[sheetName]) return _G_CACHE.sheets[sheetName];
  const sheet = SS.getSheetByName(sheetName);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  _G_CACHE.sheets[sheetName] = values;
  return values;
}

function normalizeTambon(v) {
  return String(v == null ? '' : v).trim();
}

function getUserAuthById(userId) {
  const uid = normalizeUsername(userId);
  if (!uid) return null;

  // 1. Try CacheService (Persistent across requests)
  const cache = CacheService.getScriptCache();
  const cached = cache.get("auth_" + uid);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch(e) {}
  }

  // 2. Read from Sheet
  const values = getSheetValues("Users");
  if (!values) return null;
  
  for (let i = 1; i < values.length; i++) {
    if (normalizeUsername(values[i][0]) === uid) {
      const auth = {
        username: uid,
        fullName: String(values[i][2] || ''),
        role: String(values[i][6] || 'user').trim().toLowerCase(),
        tambon: normalizeTambon(values[i][7]),
        verified: true
      };
      // Cache for 10 minutes
      cache.put("auth_" + uid, JSON.stringify(auth), 600);
      return auth;
    }
  }
  return null;
}

function buildRequestActor(input) {
  if (_G_CACHE.actor) return _G_CACHE.actor;
  const rawId = normalizeUsername((input && (input.username || input.phone || input.userId)) || '');
  const found = getUserAuthById(rawId);
  _G_CACHE.actor = found || {
    username: rawId,
    fullName: '',
    role: 'user',
    tambon: '',
    verified: false
  };
  return _G_CACHE.actor;
}

function isAdmin(actor) {
  return !!actor && actor.role === "admin";
}

function isTeacher(actor) {
  return !!actor && actor.role === "teacher";
}

function canManageSourceForActor(actor, tambonName) {
  if (isAdmin(actor)) return true;
  if (!isTeacher(actor)) return false;
  return normalizeTambon(tambonName) === normalizeTambon(actor.tambon);
}

function getSourceTambonById(sourceId) {
  const sId = String(sourceId || '').trim();
  if (!sId) return '';
  const values = getSheetValues("Sources");
  if (!values || values.length === 0) return '';
  const map = getHeaderMap(values[0]);
  const idIdx = pickHeaderIndex(map, ["SourceID"], 0);
  const tambonIdx = pickHeaderIndex(map, ["TambonName"], 1);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIdx] || '').trim() === sId) {
      return normalizeTambon(values[i][tambonIdx]);
    }
  }
  return '';
}

function canAccessSourceForActor(actor, sourceId) {
  if (isAdmin(actor)) return true;
  if (!isTeacher(actor)) return false;
  const srcTambon = getSourceTambonById(sourceId);
  return !!srcTambon && srcTambon === normalizeTambon(actor.tambon);
}

function getAreaTambonMap() {
  const areaSheet = SS.getSheetByName("AreaMaster");
  if (!areaSheet) return {};
  const values = areaSheet.getDataRange().getValues();
  if (values.length === 0) return {};
  const map = getHeaderMap(values[0]);
  const areaCodeIdx = pickHeaderIndex(map, ["AreaCode"], 0);
  const areaNameIdx = pickHeaderIndex(map, ["AreaName"], 2);
  const activeIdx = pickHeaderIndex(map, ["IsActive"], 4);
  const out = {};
  for (let i = 1; i < values.length; i++) {
    const isActive = activeIdx < 0 ? true : toBool(values[i][activeIdx]);
    if (!isActive) continue;
    const code = String(values[i][areaCodeIdx] || '').trim();
    const tambonName = normalizeTambon(values[i][areaNameIdx]);
    if (!code || !tambonName) continue;
    out[code] = tambonName;
  }
  return out;
}

function canManageAreaForActor(actor, areaCode, areaMap) {
  if (isAdmin(actor)) return true;
  if (!isTeacher(actor)) return false;
  const code = String(areaCode || '').trim();
  if (!code) return false;
  const targetTambon = normalizeTambon((areaMap || {})[code]);
  return !!targetTambon && targetTambon === normalizeTambon(actor.tambon);
}

// ── GET Router ────────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action;
    const actor = buildRequestActor(e.parameter || {});
    let result;
    switch (action) {
      case 'getSources':
        result = getSources(actor);
        break;
      case 'getMapSources':
        result = getMapSources(actor);
        break;
      case 'getDashboard':
        result = getDashboardData(e.parameter.tambon || "ทั้งหมด", actor);
        break;
      case 'getLeaderboard':
        result = getLeaderboard();
        break;
      case 'getUserLogs':
        result = getUserLearningLogs(
          e.parameter.username || e.parameter.phone,
          Number(e.parameter.page) || 1,
          e.parameter.startDate || null,
          e.parameter.endDate   || null
        );
        break;
      case 'getPendingLogs':
        result = getPendingLogsForTeacher(e.parameter.tambon, actor);
        break;
      case 'getUserProfile':
        result = getUserProfileFullData(e.parameter.username || e.parameter.phone);
        break;
      case 'getUserCertificates':
        result = { status: "success", history: getPassedHistory(e.parameter.username || e.parameter.phone) };
        break;
      case 'getAdminSources':
        result = getAdminSources(actor);
        break;
      case 'getAdminBasesBySource':
        result = getAdminBasesBySource(e.parameter.sourceId, actor);
        break;
      case 'getAdminQuizBySource':
        result = getAdminQuizBySource(e.parameter.sourceId, e.parameter.baseId, actor);
        break;
      case 'getHomeData':
        result = getHomeData(e.parameter.quarter, e.parameter.year);
        break;
      case 'getAdminHomeData':
        result = getAdminHomeData(e.parameter.quarter, e.parameter.year, actor);
        break;
      case 'getPendingProposals':
        result = getPendingProposals(actor);
        break;
      case 'getUserProposals':
        result = getUserProposals(e.parameter.phone || e.parameter.username);
        break;
      default:
        result = { status: 'error', message: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── POST Router ───────────────────────────────────────────────────────────────
// ใช้ Content-Type: text/plain จาก client เพื่อหลีกเลี่ยง CORS preflight
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    const data   = body.data || {};
    const actor  = buildRequestActor(data);
    let result;
    switch (action) {
      case 'register':      result = registerUser(data);                    break;
      case 'login':         result = loginUser(data.username || data.phone, data.password);  break;
      case 'submitLog':     result = submitLearningLog(data);               break;
      case 'submitQuiz':    result = submitQuiz(data);                      break;
      case 'reviewLog':     result = reviewLearningLog(data, actor);        break;
      case 'uploadImage':   result = uploadProfileImage(data);              break;
      case 'uploadGeneralImage': result = uploadGeneralImage(data);            break;
      case 'generateCert':  result = generateCertificate(data);             break;
      case 'submitSurvey':  result = submitSurvey(data);                    break;
      case 'submitEvaluation': result = submitEvaluation(data);                break;
      case 'submitProposal': result = submitProposal(data);                    break;
      case 'reviewProposal': result = reviewProposal(data, actor);            break;
      case 'getUserProposals': result = getUserProposals(data.phone || data.username); break;
      case 'saveAdminSource': result = saveAdminSource(data, actor);        break;
      case 'deleteAdminSource': result = deleteAdminSource(data, actor);    break;
      case 'saveAdminBase': result = saveAdminBase(data, actor);            break;
      case 'deleteAdminBase': result = deleteAdminBase(data, actor);        break;
      case 'saveAdminBaseOrder': result = saveAdminBaseOrder(data, actor);  break;
      case 'saveAdminQuiz': result = saveAdminQuiz(data, actor);            break;
      case 'deleteAdminQuiz': result = deleteAdminQuiz(data, actor);        break;
      case 'saveAdminQuizOrder': result = saveAdminQuizOrder(data, actor);  break;
      case 'importAdminQuizCsv': result = importAdminQuizCsv(data, actor);  break;
      case 'saveFeaturedActivity': result = saveFeaturedActivity(data, actor); break;
      case 'saveQuarterActivity': result = saveQuarterActivity(data, actor);       break;
      case 'deleteQuarterActivity': result = deleteQuarterActivity(data, actor);   break;
      default:              result = { status: 'error', message: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function setCellAsText(sheet, row, col) {
  sheet.getRange(row, col).setNumberFormat("@");
}

function normalizeUsername(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (s.charAt(0) === "'") s = s.slice(1).trim();
  return s.toLowerCase();
}

function normalizePhone(raw) {
  return String(raw == null ? '' : raw).trim();
}

function pickUserId(data) {
  if (!data) return '';
  return data.username != null && String(data.username).trim() !== ''
    ? data.username
    : (data.phone != null ? data.phone : '');
}

function ensureSheetWithHeaders(sheetName, headers) {
  let sheet = SS.getSheetByName(sheetName);
  if (!sheet) sheet = SS.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    let changed = false;
    headers.forEach((h, i) => {
      if (String(current[i] || '').trim() !== h) {
        current[i] = h;
        changed = true;
      }
    });
    if (changed) sheet.getRange(1, 1, 1, headers.length).setValues([current.slice(0, headers.length)]);
  }
  return sheet;
}

function ensureSheetHasHeader(sheetName, headers) {
  return ensureSheetWithHeaders(sheetName, headers);
}

function ensureColumn(sheet, headerName) {
  if (!sheet) return -1;
  const header = String(headerName || '').trim();
  if (!header) return -1;

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 1).setValues([[header]]);
    return 0;
  }

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const map = getHeaderMap(current);
  const found = pickHeaderIndex(map, [header], -1);
  if (found > -1) return found;

  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(header);
  return newCol - 1;
}

function toBool(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function getNowQuarterAndYear() {
  const now = new Date();
  return { quarter: Math.floor(now.getMonth() / 3) + 1, year: now.getFullYear() };
}

function getHomeSheets() {
  const featuredHeaders = ["FeaturedID", "Title", "ImageURL", "LocationName", "MapLink", "StartDate", "EndDate", "ShortDesc", "IsActive", "UpdatedAt"];
  const areaHeaders = ["AreaCode", "AreaType", "AreaName", "DisplayOrder", "IsActive"];
  const activityHeaders = ["ActivityID", "Quarter", "Year", "AreaCode", "ActivityName", "ActivityDate", "LocationName", "MapLink", "Benefit", "Capacity", "ContactName", "ContactPhone", "Status", "CreatedAt"];
  return {
    featured: ensureSheetWithHeaders("FeaturedActivity", featuredHeaders),
    area: ensureSheetWithHeaders("AreaMaster", areaHeaders),
    quarterActivity: ensureSheetWithHeaders("QuarterActivities", activityHeaders)
  };
}

function rowsToObjects(values) {
  if (!values || values.length === 0) return [];
  const headers = values[0].map(h => String(h || '').trim());
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    let obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    out.push(obj);
  }
  return out;
}

function getHomeData(quarterParam, yearParam) {
  try {
    const sheets = getHomeSheets();
    const qy = getNowQuarterAndYear();
    const quarter = Number(quarterParam) || qy.quarter;
    const year = Number(yearParam) || qy.year;

    const featuredRows = rowsToObjects(sheets.featured.getDataRange().getValues())
      .filter(r => toBool(r.IsActive))
      .sort((a, b) => new Date(b.UpdatedAt || 0) - new Date(a.UpdatedAt || 0));
    const featured = featuredRows.length > 0 ? featuredRows[0] : null;

    const areas = rowsToObjects(sheets.area.getDataRange().getValues())
      .filter(r => toBool(r.IsActive))
      .sort((a, b) => (Number(a.DisplayOrder) || 999) - (Number(b.DisplayOrder) || 999))
      .map(r => ({
        areaCode: String(r.AreaCode || ''),
        areaType: String(r.AreaType || ''),
        areaName: String(r.AreaName || '')
      }));

    const activities = rowsToObjects(sheets.quarterActivity.getDataRange().getValues())
      .filter(r => Number(r.Quarter) === quarter && Number(r.Year) === year && String(r.Status || 'Active').toLowerCase() !== 'cancelled')
      .sort((a, b) => new Date(a.ActivityDate || 0) - new Date(b.ActivityDate || 0))
      .map(r => ({
        activityId: String(r.ActivityID || ''),
        quarter: Number(r.Quarter) || quarter,
        year: Number(r.Year) || year,
        areaCode: String(r.AreaCode || ''),
        activityName: String(r.ActivityName || ''),
        activityDate: r.ActivityDate,
        locationName: String(r.LocationName || ''),
        mapLink: String(r.MapLink || ''),
        benefit: String(r.Benefit || ''),
        capacity: String(r.Capacity || ''),
        contactName: String(r.ContactName || ''),
        contactPhone: String(r.ContactPhone || '')
      }));

    return {
      status: "success",
      quarter: quarter,
      year: year,
      featured: featured ? {
        featuredId: String(featured.FeaturedID || ''),
        title: String(featured.Title || ''),
        imageUrl: String(featured.ImageURL || ''),
        locationName: String(featured.LocationName || ''),
        mapLink: String(featured.MapLink || ''),
        startDate: featured.StartDate || '',
        endDate: featured.EndDate || '',
        shortDesc: String(featured.ShortDesc || '')
      } : null,
      areas: areas,
      activities: activities
    };
  } catch (e) {
    return { status: "error", message: e.toString(), featured: null, areas: [], activities: [] };
  }
}

function getAdminHomeData(quarterParam, yearParam, actor) {
  if (!isAdmin(actor) && !isTeacher(actor)) {
    return { status: "error", message: "ไม่มีสิทธิ์เข้าถึงข้อมูลหลังบ้าน" };
  }

  const home = getHomeData(quarterParam, yearParam);
  if (home.status !== "success") return home;

  const areaMap = getAreaTambonMap();
  const allowedAreaCodes = {};
  if (isTeacher(actor)) {
    const myTambon = normalizeTambon(actor.tambon);
    Object.keys(areaMap).forEach(function(code) {
      if (normalizeTambon(areaMap[code]) === myTambon) allowedAreaCodes[code] = true;
    });
    home.areas = (home.areas || []).filter(function(a) {
      return !!allowedAreaCodes[String(a.areaCode || '').trim()];
    });
  }

  const sheets = getHomeSheets();
  const allActivities = rowsToObjects(sheets.quarterActivity.getDataRange().getValues())
    .filter(function(r) {
      if (!isTeacher(actor)) return true;
      const code = String(r.AreaCode || '').trim();
      return !!allowedAreaCodes[code];
    })
    .map(function(r) {
      return {
        activityId: String(r.ActivityID || ''),
        quarter: Number(r.Quarter) || '',
        year: Number(r.Year) || '',
        areaCode: String(r.AreaCode || ''),
        activityName: String(r.ActivityName || ''),
        activityDate: r.ActivityDate || '',
        locationName: String(r.LocationName || ''),
        mapLink: String(r.MapLink || ''),
        benefit: String(r.Benefit || ''),
        capacity: String(r.Capacity || ''),
        contactName: String(r.ContactName || ''),
        contactPhone: String(r.ContactPhone || ''),
        status: String(r.Status || 'Active')
      };
    });

  allActivities.sort((a, b) => new Date(b.activityDate || 0) - new Date(a.activityDate || 0));
  home.activitiesAdmin = allActivities;
  return home;
}

function saveFeaturedActivity(data, actor) {
  try {
    if (!isAdmin(actor)) return { status: "error", message: "เฉพาะผู้ดูแลระบบ (admin) เท่านั้นที่จัดการกิจกรรมเด่นได้" };
    const sheets = getHomeSheets();
    const featuredSheet = sheets.featured;
    const rows = featuredSheet.getDataRange().getValues();
    const headers = rows[0];
    const map = getHeaderMap(headers);
    const idIdx = pickHeaderIndex(map, ["FeaturedID"], 0);
    const titleIdx = pickHeaderIndex(map, ["Title"], 1);
    const imageIdx = pickHeaderIndex(map, ["ImageURL"], 2);
    const locIdx = pickHeaderIndex(map, ["LocationName"], 3);
    const mapIdx = pickHeaderIndex(map, ["MapLink"], 4);
    const startIdx = pickHeaderIndex(map, ["StartDate"], 5);
    const endIdx = pickHeaderIndex(map, ["EndDate"], 6);
    const descIdx = pickHeaderIndex(map, ["ShortDesc"], 7);
    const activeIdx = pickHeaderIndex(map, ["IsActive"], 8);
    const updatedIdx = pickHeaderIndex(map, ["UpdatedAt"], 9);

    const featuredId = String((data || {}).featuredId || '').trim() || ("F-" + new Date().getTime());
    const title = String((data || {}).title || '').trim();
    if (!title) return { status: "error", message: "กรุณากรอกชื่อกิจกรรมเด่น" };

    if (rows.length > 1) {
      const falseFlags = new Array(rows.length - 1).fill(null).map(function() { return [false]; });
      featuredSheet.getRange(2, activeIdx + 1, falseFlags.length, 1).setValues(falseFlags);
    }

    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][idIdx] || '').trim() === featuredId) {
        targetRow = i + 1;
        break;
      }
    }

    const rowData = targetRow > -1 ? rows[targetRow - 1].slice() : new Array(headers.length).fill("");
    rowData[idIdx] = featuredId;
    rowData[titleIdx] = title;
    rowData[imageIdx] = String((data || {}).imageUrl || '').trim();
    rowData[locIdx] = String((data || {}).locationName || '').trim();
    rowData[mapIdx] = String((data || {}).mapLink || '').trim();
    rowData[startIdx] = (data || {}).startDate || "";
    rowData[endIdx] = (data || {}).endDate || "";
    rowData[descIdx] = String((data || {}).shortDesc || '').trim();
    rowData[activeIdx] = true;
    rowData[updatedIdx] = new Date();

    if (targetRow > -1) featuredSheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
    else featuredSheet.appendRow(rowData);
    return { status: "success", featuredId: featuredId };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function saveQuarterActivity(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์จัดการกิจกรรมรายไตรมาส" };
    const sheets = getHomeSheets();
    const sheet = sheets.quarterActivity;
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const map = getHeaderMap(headers);
    const idx = {
      id: pickHeaderIndex(map, ["ActivityID"], 0),
      quarter: pickHeaderIndex(map, ["Quarter"], 1),
      year: pickHeaderIndex(map, ["Year"], 2),
      areaCode: pickHeaderIndex(map, ["AreaCode"], 3),
      name: pickHeaderIndex(map, ["ActivityName"], 4),
      date: pickHeaderIndex(map, ["ActivityDate"], 5),
      location: pickHeaderIndex(map, ["LocationName"], 6),
      mapLink: pickHeaderIndex(map, ["MapLink"], 7),
      benefit: pickHeaderIndex(map, ["Benefit"], 8),
      capacity: pickHeaderIndex(map, ["Capacity"], 9),
      contactName: pickHeaderIndex(map, ["ContactName"], 10),
      contactPhone: pickHeaderIndex(map, ["ContactPhone"], 11),
      status: pickHeaderIndex(map, ["Status"], 12),
      createdAt: pickHeaderIndex(map, ["CreatedAt"], 13)
    };

    const mode = String((data || {}).mode || 'create').toLowerCase();
    const activityId = String((data || {}).activityId || '').trim() || ("A-" + new Date().getTime());
    const areaCode = String((data || {}).areaCode || '').trim();
    const activityName = String((data || {}).activityName || '').trim();
    if (!areaCode || !activityName) return { status: "error", message: "กรุณาเลือกพื้นที่และชื่อกิจกรรม" };
    const areaMap = getAreaTambonMap();
    if (!areaMap[areaCode]) return { status: "error", message: "ไม่พบรหัสพื้นที่ในระบบ AreaMaster" };
    if (!canManageAreaForActor(actor, areaCode, areaMap)) {
      return { status: "error", message: "ครูประจำตำบลสามารถจัดการได้เฉพาะพื้นที่ของตำบลตนเอง" };
    }

    let targetRow = -1;
    if (mode === "edit") {
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][idx.id] || '').trim() === activityId) { targetRow = i + 1; break; }
      }
      if (targetRow === -1) return { status: "error", message: "ไม่พบกิจกรรมที่ต้องการแก้ไข" };
      const oldAreaCode = String(values[targetRow - 1][idx.areaCode] || '').trim();
      if (!canManageAreaForActor(actor, oldAreaCode, areaMap)) {
        return { status: "error", message: "ไม่มีสิทธิ์แก้ไขกิจกรรมเดิมข้ามพื้นที่" };
      }
    }

    const rowData = targetRow > -1 ? values[targetRow - 1].slice() : new Array(headers.length).fill("");
    rowData[idx.id] = activityId;
    rowData[idx.quarter] = Number((data || {}).quarter) || getNowQuarterAndYear().quarter;
    rowData[idx.year] = Number((data || {}).year) || getNowQuarterAndYear().year;
    rowData[idx.areaCode] = areaCode;
    rowData[idx.name] = activityName;
    rowData[idx.date] = (data || {}).activityDate || "";
    rowData[idx.location] = String((data || {}).locationName || '').trim();
    rowData[idx.mapLink] = String((data || {}).mapLink || '').trim();
    rowData[idx.benefit] = String((data || {}).benefit || '').trim();
    rowData[idx.capacity] = String((data || {}).capacity || '').trim();
    rowData[idx.contactName] = String((data || {}).contactName || '').trim();
    rowData[idx.contactPhone] = String((data || {}).contactPhone || '').trim();
    rowData[idx.status] = String((data || {}).status || 'Active').trim();
    if (!rowData[idx.createdAt]) rowData[idx.createdAt] = new Date();

    if (targetRow > -1) sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
    else sheet.appendRow(rowData);
    return { status: "success", activityId: activityId };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function deleteQuarterActivity(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์ลบกิจกรรมรายไตรมาส" };
    const activityId = String((data || {}).activityId || '').trim();
    if (!activityId) return { status: "error", message: "ไม่พบรหัสกิจกรรม" };
    const sheet = getHomeSheets().quarterActivity;
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const map = getHeaderMap(headers);
    const idIdx = pickHeaderIndex(map, ["ActivityID"], 0);
    const areaCodeIdx = pickHeaderIndex(map, ["AreaCode"], 3);
    const areaMap = getAreaTambonMap();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idIdx] || '').trim() === activityId) {
        const areaCode = String(values[i][areaCodeIdx] || '').trim();
        if (!canManageAreaForActor(actor, areaCode, areaMap)) {
          return { status: "error", message: "ไม่มีสิทธิ์ลบกิจกรรมของพื้นที่นี้" };
        }
        sheet.deleteRow(i + 1);
        return { status: "success" };
      }
    }
    return { status: "error", message: "ไม่พบกิจกรรมที่ต้องการลบ" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getHeaderMap(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    map[String(h).trim().toLowerCase()] = idx;
  });
  return map;
}

function pickHeaderIndex(map, candidates, fallback) {
  for (let i = 0; i < candidates.length; i++) {
    const key = String(candidates[i]).trim().toLowerCase();
    if (map.hasOwnProperty(key)) return map[key];
  }
  return fallback;
}

function findRowByValue(values, colIndex, value) {
  const target = String(value == null ? '' : value).trim();
  if (colIndex < 0 || !target) return -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][colIndex] == null ? '' : values[i][colIndex]).trim() === target) {
      return i + 1;
    }
  }
  return -1;
}

// ================= ระบบ Auth =================
function registerUser(data) {
  const sheet = SS.getSheetByName("Users");
  const values = sheet.getDataRange().getValues();
  const userStr = normalizeUsername(pickUserId(data));
  const fullName = String((data || {}).fullName || '').trim();
  const password = String((data || {}).password || '');
  const tambon = normalizeTambon((data || {}).tambon);
  if (!userStr) return { status: "error", message: "กรุณาระบุชื่อผู้ใช้" };
  if (!fullName || !password || !tambon) return { status: "error", message: "กรุณากรอกชื่อ รหัสผ่าน และตำบลให้ครบถ้วน" };

  const existingUsers = {};
  for (let i = 1; i < values.length; i++) {
    existingUsers[normalizeUsername(values[i][0])] = true;
  }
  if (existingUsers[userStr]) {
    return { status: "error", message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว" };
  }

  const encodedPassword = Utilities.base64Encode(password);
  const nextRow = sheet.getLastRow() + 1;
  sheet.appendRow(["'" + userStr, encodedPassword, fullName, "", 1, 0, "user", tambon, new Date()]);
  setCellAsText(sheet, nextRow, 1);
  return { status: "success", message: "สมัครสมาชิกสำเร็จ" };
}

function loginUser(username, password) {
  const sheet = SS.getSheetByName("Users");
  const values = sheet.getDataRange().getValues();
  const encodedPassword = Utilities.base64Encode(password);
  const userStr = normalizeUsername(username);

  for (let i = 1; i < values.length; i++) {
    if (normalizeUsername(values[i][0]) === userStr && values[i][1] === encodedPassword) {
      return {
        status: "success",
        user: {
          username: normalizeUsername(values[i][0]), 
          phone: normalizeUsername(values[i][0]),
          fullName: values[i][2], 
          profileImage: values[i][3],
          level: values[i][4], 
          score: values[i][5], 
          role: String(values[i][6] || "user").trim().toLowerCase(), 
          tambon: values[i][7] || ""
        }
      };
    }
  }
  return { status: "error", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
}

function getLearningBaseSheets() {
  const basesHeaders = ["BaseID", "SourceID", "BaseName", "Description", "CoverImage", "DisplayOrder", "IsActive", "UpdatedAt"];
  const contentsHeaders = ["SourceID", "BaseID", "History", "Result", "GalleryLinks", "ExternalLinks", "GPSLocation", "ContactInfo"];
  const quizzesHeaders = ["QuizID", "SourceID", "BaseID", "Question", "ChoiceA", "ChoiceB", "ChoiceC", "ChoiceD", "Answer"];

  let basesSheet = SS.getSheetByName("Bases");
  if (!basesSheet) basesSheet = ensureSheetWithHeaders("Bases", basesHeaders);
  else if (basesSheet.getLastRow() === 0) basesSheet.getRange(1, 1, 1, basesHeaders.length).setValues([basesHeaders]);
  else basesHeaders.forEach(function(h) { ensureColumn(basesSheet, h); });

  let contentsSheet = SS.getSheetByName("Contents");
  if (!contentsSheet) contentsSheet = ensureSheetWithHeaders("Contents", contentsHeaders);
  else if (contentsSheet.getLastRow() === 0) contentsSheet.getRange(1, 1, 1, contentsHeaders.length).setValues([contentsHeaders]);
  else contentsHeaders.forEach(function(h) { ensureColumn(contentsSheet, h); });

  let quizzesSheet = SS.getSheetByName("Quizzes");
  if (!quizzesSheet) quizzesSheet = ensureSheetWithHeaders("Quizzes", quizzesHeaders);
  else if (quizzesSheet.getLastRow() === 0) quizzesSheet.getRange(1, 1, 1, quizzesHeaders.length).setValues([quizzesHeaders]);
  else quizzesHeaders.forEach(function(h) { ensureColumn(quizzesSheet, h); });

  const logsSheet = SS.getSheetByName("Logs");
  if (logsSheet && logsSheet.getLastRow() > 0) ensureColumn(logsSheet, "BaseID");

  return { bases: basesSheet, contents: contentsSheet, quizzes: quizzesSheet, logs: logsSheet };
}

function generateBaseIdFromValues(values, idIdx) {
  let maxNo = 0;
  for (let i = 1; i < values.length; i++) {
    const raw = String(values[i][idIdx] || '').trim();
    const m = raw.match(/(\d+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (!isNaN(n) && n > maxNo) maxNo = n;
  }
  const next = maxNo + 1;
  return "BAS" + ("0000" + next).slice(-4);
}

function getBaseSourceIdByBaseId(baseId) {
  const bId = String(baseId || '').trim();
  if (!bId) return "";
  const sheet = SS.getSheetByName("Bases");
  if (!sheet) return "";
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return "";
  const map = getHeaderMap(values[0]);
  const baseIdIdx = pickHeaderIndex(map, ["BaseID"], 0);
  const sourceIdIdx = pickHeaderIndex(map, ["SourceID"], 1);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][baseIdIdx] || '').trim() === bId) return String(values[i][sourceIdIdx] || '').trim();
  }
  return "";
}

// ================= ระบบข้อมูลแหล่งเรียนรู้ =================
function getSources(actor) {
  try {
    const sourceValues = getSheetValues("Sources");
    if (!sourceValues || sourceValues.length === 0) return [];
    const sHeaders = sourceValues[0].map(h => String(h || '').trim());
    const sRows = sourceValues.slice(1);
    const sMap = getHeaderMap(sHeaders);
    const sIdIdx = pickHeaderIndex(sMap, ["SourceID", "SourceId", "ID"], 0);
    const sTambonIdx = pickHeaderIndex(sMap, ["TambonName", "Tambon", "SubDistrict"], 1);
    const sNameIdx = pickHeaderIndex(sMap, ["SourceName", "Name", "Title"], 2);
    const sCoverIdx = pickHeaderIndex(sMap, ["CoverImageURL", "CoverImage", "ImageURL"], 3);
    const sLatIdx = pickHeaderIndex(sMap, ["Latitude", "Lat"], 4);
    const sLngIdx = pickHeaderIndex(sMap, ["Longitude", "Lng", "Long"], 5);

    const contentValues = getSheetValues("Contents");
    const contentBySource = {};
    const contentByBase = {};
    if (contentValues && contentValues.length > 0) {
      const cHeaders = contentValues[0].map(h => String(h || '').trim());
      const cRows = contentValues.slice(1);
      const cMap = getHeaderMap(cHeaders);
      const cSourceIdx = pickHeaderIndex(cMap, ["SourceID", "SourceId", "ID"], 0);
      const cBaseIdx = pickHeaderIndex(cMap, ["BaseID", "BaseId"], -1);
      const cHistoryIdx = pickHeaderIndex(cMap, ["History", "HistoryText"], 1);
      const cResultIdx = pickHeaderIndex(cMap, ["Result", "ResultText"], 2);
      const cGalleryIdx = pickHeaderIndex(cMap, ["GalleryLinks", "Gallery", "GalleryURL"], 3);
      const cExternalIdx = pickHeaderIndex(cMap, ["ExternalLinks", "External", "ExternalURL"], 4);
      const cGpsIdx = pickHeaderIndex(cMap, ["GPSLocation", "GPS", "Location", "MapLink"], 5);
      const cContactIdx = pickHeaderIndex(cMap, ["ContactInfo", "Contact"], 6);
      cRows.forEach(function(row) {
        const sid = String(row[cSourceIdx] == null ? '' : row[cSourceIdx]).trim();
        if (!sid) return;
        const bid = cBaseIdx > -1 ? String(row[cBaseIdx] == null ? '' : row[cBaseIdx]).trim() : '';
        const payload = {
          history: String(row[cHistoryIdx] == null ? '' : row[cHistoryIdx]),
          result: String(row[cResultIdx] == null ? '' : row[cResultIdx]),
          gallery: String(row[cGalleryIdx] == null ? '' : row[cGalleryIdx]),
          external: String(row[cExternalIdx] == null ? '' : row[cExternalIdx]),
          gps: String(row[cGpsIdx] == null ? '' : row[cGpsIdx]),
          contact: String(row[cContactIdx] == null ? '' : row[cContactIdx])
        };
        if (bid) contentByBase[bid] = payload;
        else contentBySource[sid] = payload;
      });
    }

    const quizValues = getSheetValues("Quizzes");
    const quizzesBySource = {};
    const quizzesByBase = {};
    if (quizValues && quizValues.length > 1) {
      const qHeaders = quizValues[0];
      const qIdx = getQuizColumnIndexes(qHeaders);
      for (let i = 1; i < quizValues.length; i++) {
        const row = quizValues[i];
        const sid = String(row[qIdx.sourceIdIdx] == null ? '' : row[qIdx.sourceIdIdx]).trim();
        if (!sid) continue;
        const bid = qIdx.baseIdIdx > -1 ? String(row[qIdx.baseIdIdx] == null ? '' : row[qIdx.baseIdIdx]).trim() : '';
        const target = bid ? quizzesByBase : quizzesBySource;
        const key = bid || sid;
        if (!target[key]) target[key] = [];
        target[key].push({
          question: String(row[qIdx.questionIdx] == null ? '' : row[qIdx.questionIdx]),
          choices: [
            String(row[qIdx.choiceAIdx] == null ? '' : row[qIdx.choiceAIdx]),
            String(row[qIdx.choiceBIdx] == null ? '' : row[qIdx.choiceBIdx]),
            String(row[qIdx.choiceCIdx] == null ? '' : row[qIdx.choiceCIdx]),
            String(row[qIdx.choiceDIdx] == null ? '' : row[qIdx.choiceDIdx])
          ],
          answer: String(row[qIdx.answerIdx] == null ? '' : row[qIdx.answerIdx]).trim().toUpperCase()
        });
      }
    }

    const baseValues = getSheetValues("Bases");
    const basesBySource = {};
    if (baseValues && baseValues.length > 1) {
      const map = getHeaderMap(baseValues[0]);
      const idx = {
        baseId: pickHeaderIndex(map, ["BaseID"], 0),
        sourceId: pickHeaderIndex(map, ["SourceID"], 1),
        name: pickHeaderIndex(map, ["BaseName"], 2),
        desc: pickHeaderIndex(map, ["Description"], 3),
        cover: pickHeaderIndex(map, ["CoverImage"], 4),
        order: pickHeaderIndex(map, ["DisplayOrder"], 5),
        active: pickHeaderIndex(map, ["IsActive"], 6)
      };
      for (let i = 1; i < baseValues.length; i++) {
        const sid = String(baseValues[i][idx.sourceId] || '').trim();
        if (!sid) continue;
        const isActive = idx.active < 0 ? true : toBool(baseValues[i][idx.active]);
        if (!isActive) continue;
        const baseId = String(baseValues[i][idx.baseId] || '').trim();
        if (!baseId) continue;
        if (!basesBySource[sid]) basesBySource[sid] = [];
        basesBySource[sid].push({
          baseId: baseId,
          sourceId: sid,
          name: String(baseValues[i][idx.name] || ''),
          description: String(baseValues[i][idx.desc] || ''),
          coverImage: String(baseValues[i][idx.cover] || ''),
          displayOrder: Number(baseValues[i][idx.order] || 0)
        });
      }
    }

    const filteredRows = sRows.filter(function(row) {
      if (!isTeacher(actor)) return true;
      return normalizeTambon(row[sTambonIdx]) === normalizeTambon(actor.tambon);
    });

    return filteredRows.map(function(row) {
      const sid = String(row[sIdIdx] == null ? '' : row[sIdIdx]).trim();
      const bases = (basesBySource[sid] || []).map(function(b) {
        const q = (quizzesByBase[b.baseId] || []).slice().sort(() => 0.5 - Math.random()).slice(0, 10);
        return {
          baseId: b.baseId,
          baseName: b.baseName,
          description: b.description,
          coverImage: b.coverImage,
          displayOrder: b.displayOrder,
          info: contentByBase[b.baseId] || null,
          quizzes: q
        };
      });

      const quizList = (quizzesBySource[sid] || []).slice().sort(() => 0.5 - Math.random()).slice(0, 10);
      const out = {
        SourceID: sid,
        TambonName: String(row[sTambonIdx] == null ? '' : row[sTambonIdx]),
        SourceName: String(row[sNameIdx] == null ? '' : row[sNameIdx]),
        CoverImageURL: String(row[sCoverIdx] == null ? '' : row[sCoverIdx]),
        Latitude: String(row[sLatIdx] == null ? '' : row[sLatIdx]),
        Longitude: String(row[sLngIdx] == null ? '' : row[sLngIdx]),
        info: contentBySource[sid] || null,
        quizzes: quizList
      };
      if (bases.length > 0) out.bases = bases;
      return out;
    });
  } catch (e) { return []; }
}

function getMapSources(actor) {
  try {
    const sourceValues = SS.getSheetByName("Sources").getDataRange().getValues();
    if (sourceValues.length <= 1) return [];
    const sHeaders = sourceValues[0].map(h => String(h || '').trim());
    const sRows = sourceValues.slice(1);
    const sMap = getHeaderMap(sHeaders);
    const sIdIdx = pickHeaderIndex(sMap, ["SourceID", "SourceId", "ID"], 0);
    const sTambonIdx = pickHeaderIndex(sMap, ["TambonName", "Tambon", "SubDistrict"], 1);
    const sNameIdx = pickHeaderIndex(sMap, ["SourceName", "Name", "Title"], 2);
    const sCoverIdx = pickHeaderIndex(sMap, ["CoverImageURL", "CoverImage", "ImageURL"], 3);
    const sLatIdx = pickHeaderIndex(sMap, ["Latitude", "Lat"], 4);
    const sLngIdx = pickHeaderIndex(sMap, ["Longitude", "Lng", "Long"], 5);

    const filteredRows = sRows.filter(function(row) {
      if (!isTeacher(actor)) return true;
      return normalizeTambon(row[sTambonIdx]) === normalizeTambon(actor.tambon);
    });

    return filteredRows.map(function(row) {
      return {
        SourceID: String(row[sIdIdx] == null ? '' : row[sIdIdx]).trim(),
        TambonName: String(row[sTambonIdx] == null ? '' : row[sTambonIdx]),
        SourceName: String(row[sNameIdx] == null ? '' : row[sNameIdx]),
        CoverImage: String(row[sCoverIdx] == null ? '' : row[sCoverIdx]),
        Latitude: String(row[sLatIdx] == null ? '' : row[sLatIdx]),
        Longitude: String(row[sLngIdx] == null ? '' : row[sLngIdx])
      };
    });
  } catch (e) { return []; }
}

function getAdminSources(actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) {
      return { status: "error", message: "ไม่มีสิทธิ์เข้าถึงข้อมูลแหล่งเรียนรู้", data: [] };
    }
    const data = getSources(actor);
    data.sort((a, b) => String(a.SourceName || '').localeCompare(String(b.SourceName || '')));
    return { status: "success", data: data };
  } catch (e) {
    return { status: "error", message: e.toString(), data: [] };
  }
}

function getAdminBasesBySource(sourceId, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์เข้าถึงฐานการเรียนรู้", data: [] };
    const sId = String(sourceId || '').trim();
    if (!sId) return { status: "error", message: "กรุณาระบุรหัสแหล่งเรียนรู้", data: [] };
    if (!canAccessSourceForActor(actor, sId)) return { status: "error", message: "ไม่มีสิทธิ์เข้าถึงฐานการเรียนรู้ของแหล่งเรียนรู้นี้", data: [] };

    const sheets = getLearningBaseSheets();
    const values = sheets.bases.getDataRange().getValues();
    if (values.length === 0) return { status: "success", data: [] };
    const map = getHeaderMap(values[0]);
    const idx = {
      baseId: pickHeaderIndex(map, ["BaseID"], 0),
      sourceId: pickHeaderIndex(map, ["SourceID"], 1),
      name: pickHeaderIndex(map, ["BaseName"], 2),
      desc: pickHeaderIndex(map, ["Description"], 3),
      cover: pickHeaderIndex(map, ["CoverImage"], 4),
      order: pickHeaderIndex(map, ["DisplayOrder"], 5),
      active: pickHeaderIndex(map, ["IsActive"], 6)
    };

    const contentByBaseId = {};
    const cValues = sheets.contents.getDataRange().getValues();
    if (cValues.length > 1) {
      const cHeaders = cValues[0].map(h => String(h || '').trim());
      const cMap = getHeaderMap(cHeaders);
      const cIdx = {
        sourceId: pickHeaderIndex(cMap, ["SourceID"], 0),
        baseId: pickHeaderIndex(cMap, ["BaseID"], 1),
        history: pickHeaderIndex(cMap, ["History"], 2),
        result: pickHeaderIndex(cMap, ["Result"], 3),
        gallery: pickHeaderIndex(cMap, ["GalleryLinks"], 4),
        external: pickHeaderIndex(cMap, ["ExternalLinks"], 5),
        gps: pickHeaderIndex(cMap, ["GPSLocation"], 6),
        contact: pickHeaderIndex(cMap, ["ContactInfo"], 7)
      };
      for (let i = 1; i < cValues.length; i++) {
        if (String(cValues[i][cIdx.sourceId] || '').trim() !== sId) continue;
        const bId = String(cValues[i][cIdx.baseId] || '').trim();
        if (!bId) continue;
        contentByBaseId[bId] = {
          history: String(cValues[i][cIdx.history] || ''),
          result: String(cValues[i][cIdx.result] || ''),
          gallery: String(cValues[i][cIdx.gallery] || ''),
          external: String(cValues[i][cIdx.external] || ''),
          gps: String(cValues[i][cIdx.gps] || ''),
          contact: String(cValues[i][cIdx.contact] || '')
        };
      }
    }

    const out = [];
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idx.sourceId] || '').trim() !== sId) continue;
      const baseId = String(values[i][idx.baseId] || '').trim();
      const content = contentByBaseId[baseId] || {};
      out.push({
        baseId: baseId,
        sourceId: String(values[i][idx.sourceId] || ''),
        baseName: String(values[i][idx.name] || ''),
        description: String(values[i][idx.desc] || ''),
        coverImage: String(values[i][idx.cover] || ''),
        displayOrder: Number(values[i][idx.order]) || 999,
        isActive: idx.active < 0 ? true : toBool(values[i][idx.active]),
        history: String(content.history || ''),
        result: String(content.result || ''),
        gallery: String(content.gallery || ''),
        external: String(content.external || ''),
        gps: String(content.gps || ''),
        contact: String(content.contact || '')
      });
    }
    out.sort(function(a, b) {
      return (Number(a.displayOrder) || 999) - (Number(b.displayOrder) || 999);
    });
    return { status: "success", data: out };
  } catch (e) {
    return { status: "error", message: e.toString(), data: [] };
  }
}

function saveAdminBase(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์จัดการฐานการเรียนรู้" };
    const mode = String((data || {}).mode || 'create').trim().toLowerCase();
    const sourceId = String((data || {}).sourceId || '').trim();
    const baseName = String((data || {}).baseName || '').trim();
    const description = String((data || {}).description || '').trim();
    const coverImage = String((data || {}).coverImage || '').trim();
    const displayOrder = Number((data || {}).displayOrder);
    const isActive = (data || {}).isActive == null ? true : toBool((data || {}).isActive);
    const baseIdInput = String((data || {}).baseId || '').trim();

    if (!sourceId) return { status: "error", message: "กรุณาระบุรหัสแหล่งเรียนรู้" };
    if (!canAccessSourceForActor(actor, sourceId)) return { status: "error", message: "ไม่มีสิทธิ์จัดการฐานการเรียนรู้ของแหล่งเรียนรู้นี้" };
    if (!baseName) return { status: "error", message: "กรุณากรอกชื่อฐานการเรียนรู้" };

    const sheets = getLearningBaseSheets();
    const baseSheet = sheets.bases;
    const values = baseSheet.getDataRange().getValues();
    const headers = values[0];
    const map = getHeaderMap(headers);
    const idx = {
      baseId: pickHeaderIndex(map, ["BaseID"], 0),
      sourceId: pickHeaderIndex(map, ["SourceID"], 1),
      name: pickHeaderIndex(map, ["BaseName"], 2),
      desc: pickHeaderIndex(map, ["Description"], 3),
      cover: pickHeaderIndex(map, ["CoverImage"], 4),
      order: pickHeaderIndex(map, ["DisplayOrder"], 5),
      active: pickHeaderIndex(map, ["IsActive"], 6),
      updatedAt: pickHeaderIndex(map, ["UpdatedAt"], 7)
    };

    let baseId = baseIdInput;
    let targetRow = -1;
    if (mode === "edit") {
      if (!baseId) return { status: "error", message: "ไม่พบรหัสฐานการเรียนรู้" };
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][idx.baseId] || '').trim() === baseId) {
          targetRow = i + 1;
          break;
        }
      }
      if (targetRow === -1) return { status: "error", message: "ไม่พบฐานการเรียนรู้ที่ต้องการแก้ไข" };
      const existingSourceId = String(values[targetRow - 1][idx.sourceId] || '').trim();
      if (!canAccessSourceForActor(actor, existingSourceId)) return { status: "error", message: "ไม่มีสิทธิ์แก้ไขฐานการเรียนรู้ของแหล่งเรียนรู้นี้" };
    } else {
      baseId = baseId || generateBaseIdFromValues(values, idx.baseId);
    }

    const rowData = targetRow > -1 ? values[targetRow - 1].slice() : new Array(headers.length).fill("");
    rowData[idx.baseId] = baseId;
    rowData[idx.sourceId] = sourceId;
    rowData[idx.name] = baseName;
    rowData[idx.desc] = description;
    rowData[idx.cover] = coverImage;
    rowData[idx.order] = isNaN(displayOrder) ? "" : displayOrder;
    rowData[idx.active] = isActive;
    if (idx.updatedAt > -1) rowData[idx.updatedAt] = new Date();

    if (targetRow > -1) baseSheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
    else baseSheet.appendRow(rowData);

    const contentSheet = sheets.contents;
    const cValues = contentSheet.getDataRange().getValues();
    const cHeaders = cValues.length > 0 ? cValues[0].map(h => String(h || '').trim()) : [];
    const cMap = getHeaderMap(cHeaders);
    const cIdx = {
      sourceId: pickHeaderIndex(cMap, ["SourceID"], 0),
      baseId: pickHeaderIndex(cMap, ["BaseID"], 1),
      history: pickHeaderIndex(cMap, ["History"], 2),
      result: pickHeaderIndex(cMap, ["Result"], 3),
      gallery: pickHeaderIndex(cMap, ["GalleryLinks"], 4),
      external: pickHeaderIndex(cMap, ["ExternalLinks"], 5),
      gps: pickHeaderIndex(cMap, ["GPSLocation"], 6),
      contact: pickHeaderIndex(cMap, ["ContactInfo"], 7)
    };

    let cRow = -1;
    for (let i = 1; i < cValues.length; i++) {
      if (String(cValues[i][cIdx.sourceId] || '').trim() === sourceId && String(cValues[i][cIdx.baseId] || '').trim() === baseId) {
        cRow = i + 1;
        break;
      }
    }

    const contentRow = new Array(cHeaders.length).fill("");
    contentRow[cIdx.sourceId] = sourceId;
    contentRow[cIdx.baseId] = baseId;
    contentRow[cIdx.history] = String((data || {}).history || '');
    contentRow[cIdx.result] = String((data || {}).result || '');
    contentRow[cIdx.gallery] = String((data || {}).gallery || '');
    contentRow[cIdx.external] = String((data || {}).external || '');
    contentRow[cIdx.gps] = String((data || {}).gps || '');
    contentRow[cIdx.contact] = String((data || {}).contact || '');

    if (cRow > -1) contentSheet.getRange(cRow, 1, 1, cHeaders.length).setValues([contentRow]);
    else contentSheet.appendRow(contentRow);

    return { status: "success", baseId: baseId };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function deleteAdminBase(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์ลบฐานการเรียนรู้" };
    const baseId = String((data || {}).baseId || '').trim();
    if (!baseId) return { status: "error", message: "ไม่พบรหัสฐานการเรียนรู้" };

    const sheets = getLearningBaseSheets();
    const baseSheet = sheets.bases;
    const values = baseSheet.getDataRange().getValues();
    if (values.length < 2) return { status: "error", message: "ไม่พบข้อมูลในชีต Bases" };

    const map = getHeaderMap(values[0]);
    const baseIdIdx = pickHeaderIndex(map, ["BaseID"], 0);
    const sourceIdIdx = pickHeaderIndex(map, ["SourceID"], 1);

    let sourceId = "";
    let targetRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][baseIdIdx] || '').trim() === baseId) {
        sourceId = String(values[i][sourceIdIdx] || '').trim();
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) return { status: "error", message: "ไม่พบฐานการเรียนรู้ที่ต้องการลบ" };
    if (!canAccessSourceForActor(actor, sourceId)) return { status: "error", message: "ไม่มีสิทธิ์ลบฐานการเรียนรู้ของแหล่งเรียนรู้นี้" };

    baseSheet.deleteRow(targetRow);

    const contentSheet = sheets.contents;
    const cValues = contentSheet.getDataRange().getValues();
    const cMap = getHeaderMap((cValues[0] || []).map(h => String(h || '').trim()));
    const cBaseIdIdx = pickHeaderIndex(cMap, ["BaseID"], 1);
    for (let i = cValues.length - 1; i >= 1; i--) {
      if (String(cValues[i][cBaseIdIdx] || '').trim() === baseId) contentSheet.deleteRow(i + 1);
    }

    const quizSheet = sheets.quizzes;
    const qValues = quizSheet.getDataRange().getValues();
    const qIdx = getQuizColumnIndexes(qValues[0] || []);
    if (qIdx.baseIdIdx > -1) {
      for (let i = qValues.length - 1; i >= 1; i--) {
        if (String(qValues[i][qIdx.baseIdIdx] || '').trim() === baseId) quizSheet.deleteRow(i + 1);
      }
    }

    return { status: "success" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function saveAdminBaseOrder(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์จัดลำดับฐานการเรียนรู้" };
    const sourceId = String((data || {}).sourceId || '').trim();
    const baseIds = ((data || {}).baseIds || []).map(b => String(b || '').trim()).filter(Boolean);
    if (!sourceId) return { status: "error", message: "ไม่พบรหัสแหล่งเรียนรู้" };
    if (baseIds.length === 0) return { status: "error", message: "ไม่พบรายการฐานสำหรับจัดลำดับ" };
    if (!canAccessSourceForActor(actor, sourceId)) return { status: "error", message: "ไม่มีสิทธิ์จัดการฐานของแหล่งเรียนรู้นี้" };

    const sheets = getLearningBaseSheets();
    const sheet = sheets.bases;
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const map = getHeaderMap(headers);
    const idx = {
      baseId: pickHeaderIndex(map, ["BaseID"], 0),
      sourceId: pickHeaderIndex(map, ["SourceID"], 1),
      order: pickHeaderIndex(map, ["DisplayOrder"], 5)
    };

    const orderMap = {};
    baseIds.forEach(function(id, i) { orderMap[id] = i + 1; });

    let changed = false;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idx.sourceId] || '').trim() !== sourceId) continue;
      const bId = String(values[i][idx.baseId] || '').trim();
      if (!bId) continue;
      if (orderMap[bId] != null) {
        values[i][idx.order] = orderMap[bId];
        changed = true;
      }
    }

    if (changed && values.length > 1) sheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
    return { status: "success" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function updateLinkedSourceId(oldSourceId, newSourceId) {
  if (!oldSourceId || !newSourceId || oldSourceId === newSourceId) return;

  const basesSheet = SS.getSheetByName("Bases");
  if (basesSheet) {
    const values = basesSheet.getDataRange().getValues();
    if (values.length > 0) {
      const map = getHeaderMap(values[0]);
      const sourceIdIdx = pickHeaderIndex(map, ["SourceID"], 1);
      let changed = false;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][sourceIdIdx] || '').trim() === String(oldSourceId).trim()) {
          values[i][sourceIdIdx] = newSourceId;
          changed = true;
        }
      }
      if (changed && values.length > 1) basesSheet.getRange(2, 1, values.length - 1, values[0].length).setValues(values.slice(1));
    }
  }

  const contentsSheet = SS.getSheetByName("Contents");
  if (contentsSheet) {
    const values = contentsSheet.getDataRange().getValues();
    let changed = false;
    for (let i = 1; i < values.length; i++) {
      const headers = values[0] || [];
      const map = getHeaderMap(headers.map(h => String(h || '').trim()));
      const sourceIdIdx = pickHeaderIndex(map, ["SourceID"], 0);
      if (String(values[i][sourceIdIdx]).trim() === String(oldSourceId).trim()) {
        values[i][sourceIdIdx] = newSourceId;
        changed = true;
      }
    }
    if (changed && values.length > 1) {
      contentsSheet.getRange(2, 1, values.length - 1, values[0].length).setValues(values.slice(1));
    }
  }

  const quizzesSheet = SS.getSheetByName("Quizzes");
  if (quizzesSheet) {
    const values = quizzesSheet.getDataRange().getValues();
    const headers = values.length > 0 ? values[0] : [];
    const qIdx = getQuizColumnIndexes(headers);
    let changed = false;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][qIdx.sourceIdIdx]).trim() === String(oldSourceId).trim()) {
        values[i][qIdx.sourceIdIdx] = newSourceId;
        changed = true;
      }
    }
    if (changed && values.length > 1) {
      quizzesSheet.getRange(2, 1, values.length - 1, values[0].length).setValues(values.slice(1));
    }
  }

  const logsSheet = SS.getSheetByName("Logs");
  if (logsSheet) {
    const values = logsSheet.getDataRange().getValues();
    if (values.length > 0) {
      const headers = values[0].map(h => String(h).trim().toLowerCase());
      const sourceIdIdx = headers.indexOf("sourceid") > -1 ? headers.indexOf("sourceid") : 1;
      let changed = false;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][sourceIdIdx]).trim() === String(oldSourceId).trim()) {
          values[i][sourceIdIdx] = newSourceId;
          changed = true;
        }
      }
      if (changed && values.length > 1) {
        logsSheet.getRange(2, 1, values.length - 1, values[0].length).setValues(values.slice(1));
      }
    }
  }
}

function generateSourceIdFromValues(values, idIdx) {
  let maxNo = 0;
  for (let i = 1; i < values.length; i++) {
    const raw = String(values[i][idIdx] || '').trim();
    const m = raw.match(/(\d+)$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (!isNaN(n) && n > maxNo) maxNo = n;
  }
  const next = maxNo + 1;
  return "SRC" + ("0000" + next).slice(-4);
}

function parseCoordinateInput(coordText, fallbackLat, fallbackLng) {
  const c = String(coordText || '').trim();
  if (c) {
    const parts = c.split(',');
    if (parts.length === 2) {
      return {
        latitude: String(parts[0] || '').trim(),
        longitude: String(parts[1] || '').trim()
      };
    }
  }
  return {
    latitude: String(fallbackLat || '').trim(),
    longitude: String(fallbackLng || '').trim()
  };
}

function saveAdminSource(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์จัดการแหล่งเรียนรู้" };
    getLearningBaseSheets();
    const mode = String(data.mode || 'create').trim().toLowerCase();
    const sourceIdInput = String(data.sourceId || '').trim();
    const sourceName = String(data.sourceName || '').trim();
    const tambonName = String(data.tambonName || '').trim();
    const originalSourceId = String(data.originalSourceId || sourceIdInput).trim();
    if (!sourceName || !tambonName) {
      return { status: "error", message: "กรุณากรอกชื่อแหล่งเรียนรู้และตำบลให้ครบ" };
    }

    const sourceSheet = SS.getSheetByName("Sources");
    const sValues = sourceSheet.getDataRange().getValues();
    const sHeaders = sValues[0];
    const sMap = getHeaderMap(sHeaders);
    const idIdx = pickHeaderIndex(sMap, ["SourceID"], 0);
    const tambonIdx = pickHeaderIndex(sMap, ["TambonName"], 1);
    const nameIdx = pickHeaderIndex(sMap, ["SourceName"], 2);
    const coverIdx = pickHeaderIndex(sMap, ["CoverImageURL", "CoverImage"], 3);
    const latIdx = pickHeaderIndex(sMap, ["Latitude", "Lat"], 4);
    const lngIdx = pickHeaderIndex(sMap, ["Longitude", "Lng", "Long"], 5);

    let sourceId = sourceIdInput;
    if (mode === "create" && !sourceId) {
      sourceId = generateSourceIdFromValues(sValues, idIdx);
    }
    if (mode === "edit") {
      sourceId = sourceId || originalSourceId;
    }
    if (!sourceId) return { status: "error", message: "ไม่สามารถสร้างรหัสแหล่งเรียนรู้ได้" };

    const existingByOriginalRow = findRowByValue(sValues, idIdx, originalSourceId);
    const existingByNewIdRow = findRowByValue(sValues, idIdx, sourceId);
    const existingTambon = existingByOriginalRow > -1 ? normalizeTambon(sValues[existingByOriginalRow - 1][tambonIdx]) : '';

    if (mode === "create" && existingByNewIdRow > -1) {
      return { status: "error", message: "รหัสแหล่งเรียนรู้นี้มีอยู่แล้ว" };
    }
    if (mode === "edit" && existingByOriginalRow === -1) {
      return { status: "error", message: "ไม่พบแหล่งเรียนรู้ที่ต้องการแก้ไข" };
    }
    if (mode === "edit" && sourceId !== originalSourceId && existingByNewIdRow > -1) {
      return { status: "error", message: "ไม่สามารถเปลี่ยนรหัสได้ เพราะรหัสใหม่ซ้ำในระบบ" };
    }
    if (!canManageSourceForActor(actor, tambonName)) {
      return { status: "error", message: "สิทธิ์ครูประจำตำบลสามารถจัดการได้เฉพาะข้อมูลในตำบลของตนเอง" };
    }
    if (mode === "edit" && !canManageSourceForActor(actor, existingTambon)) {
      return { status: "error", message: "ไม่มีสิทธิ์แก้ไขแหล่งเรียนรู้ข้ามตำบล" };
    }
    if (isTeacher(actor) && mode === "edit" && existingTambon && normalizeTambon(tambonName) !== existingTambon) {
      return { status: "error", message: "ครูประจำตำบลไม่สามารถย้ายข้อมูลไปตำบลอื่นได้" };
    }

    const coord = parseCoordinateInput(data.coordinates, data.latitude, data.longitude);
    if ((coord.latitude && !coord.longitude) || (!coord.latitude && coord.longitude)) {
      return { status: "error", message: "กรุณากรอกพิกัดให้ครบทั้งละติจูดและลองจิจูดในรูปแบบ lat, lng" };
    }

    const targetRow = mode === "edit" ? existingByOriginalRow : -1;
    const rowData = targetRow > -1 ? sValues[targetRow - 1].slice() : new Array(sHeaders.length).fill("");
    rowData[idIdx] = sourceId;
    rowData[tambonIdx] = tambonName;
    rowData[nameIdx] = sourceName;
    if (coverIdx > -1) rowData[coverIdx] = data.coverImageUrl || "";
    if (latIdx > -1) rowData[latIdx] = coord.latitude || "";
    if (lngIdx > -1) rowData[lngIdx] = coord.longitude || "";

    if (targetRow > -1) sourceSheet.getRange(targetRow, 1, 1, sHeaders.length).setValues([rowData]);
    else sourceSheet.appendRow(rowData);

    if (mode === "edit" && originalSourceId !== sourceId) {
      updateLinkedSourceId(originalSourceId, sourceId);
    }

    const contentSheet = SS.getSheetByName("Contents");
    const cValues = contentSheet.getDataRange().getValues();
    const cHeaders = cValues.length > 0 ? cValues[0].map(h => String(h || '').trim()) : [];
    const cMap = getHeaderMap(cHeaders);
    const cIdx = {
      sourceId: pickHeaderIndex(cMap, ["SourceID"], 0),
      baseId: pickHeaderIndex(cMap, ["BaseID"], 1),
      history: pickHeaderIndex(cMap, ["History"], 2),
      result: pickHeaderIndex(cMap, ["Result"], 3),
      gallery: pickHeaderIndex(cMap, ["GalleryLinks"], 4),
      external: pickHeaderIndex(cMap, ["ExternalLinks"], 5),
      gps: pickHeaderIndex(cMap, ["GPSLocation"], 6),
      contact: pickHeaderIndex(cMap, ["ContactInfo"], 7)
    };

    let cRow = -1;
    for (let i = 1; i < cValues.length; i++) {
      if (String(cValues[i][cIdx.sourceId] || '').trim() === sourceId && String(cValues[i][cIdx.baseId] || '').trim() === '') {
        cRow = i + 1;
        break;
      }
    }

    const contentRow = new Array(cHeaders.length).fill("");
    contentRow[cIdx.sourceId] = sourceId;
    if (cIdx.baseId > -1) contentRow[cIdx.baseId] = "";
    contentRow[cIdx.history] = data.history || "";
    contentRow[cIdx.result] = data.result || "";
    contentRow[cIdx.gallery] = data.gallery || "";
    contentRow[cIdx.external] = data.external || "";
    contentRow[cIdx.gps] = data.gps || "";
    contentRow[cIdx.contact] = data.contact || "";

    if (cRow > -1) contentSheet.getRange(cRow, 1, 1, cHeaders.length).setValues([contentRow]);
    else contentSheet.appendRow(contentRow);

    return { status: "success", sourceId: sourceId };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function deleteRowsByColumnValue(sheet, colIndex, value) {
  if (!sheet || colIndex < 0) return;
  const values = sheet.getDataRange().getValues();
  const target = String(value == null ? '' : value).trim();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][colIndex] == null ? '' : values[i][colIndex]).trim() === target) {
      sheet.deleteRow(i + 1);
    }
  }
}

function deleteAdminSource(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์ลบข้อมูล" };
    const sourceId = String((data || {}).sourceId || '').trim();
    if (!sourceId) return { status: "error", message: "ไม่พบรหัสแหล่งเรียนรู้" };
    if (!canAccessSourceForActor(actor, sourceId)) {
      return { status: "error", message: "สิทธิ์ครูประจำตำบลสามารถลบได้เฉพาะข้อมูลในตำบลของตนเอง" };
    }

    const sourceSheet = SS.getSheetByName("Sources");
    const sValues = sourceSheet.getDataRange().getValues();
    const sHeaders = sValues[0];
    const sMap = getHeaderMap(sHeaders);
    const idIdx = pickHeaderIndex(sMap, ["SourceID"], 0);
    deleteRowsByColumnValue(sourceSheet, idIdx, sourceId);

    const basesSheet = SS.getSheetByName("Bases");
    if (basesSheet) {
      const bValues = basesSheet.getDataRange().getValues();
      if (bValues.length > 0) {
        const bMap = getHeaderMap(bValues[0]);
        const bSourceIdx = pickHeaderIndex(bMap, ["SourceID"], 1);
        deleteRowsByColumnValue(basesSheet, bSourceIdx, sourceId);
      }
    }

    const contentSheet = SS.getSheetByName("Contents");
    if (contentSheet) {
      const cValues = contentSheet.getDataRange().getValues();
      if (cValues.length > 0) {
        const cMap = getHeaderMap((cValues[0] || []).map(h => String(h || '').trim()));
        const cSourceIdx = pickHeaderIndex(cMap, ["SourceID"], 0);
        deleteRowsByColumnValue(contentSheet, cSourceIdx, sourceId);
      }
    }

    const quizzesSheet = SS.getSheetByName("Quizzes");
    const qValues = quizzesSheet.getDataRange().getValues();
    const qHeaders = qValues.length > 0 ? qValues[0] : [];
    const qIdx = getQuizColumnIndexes(qHeaders);
    deleteRowsByColumnValue(quizzesSheet, qIdx.sourceIdIdx, sourceId);

    return { status: "success" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function generateQuizId() {
  return "Q-" + new Date().getTime() + "-" + Math.floor(Math.random() * 10000);
}

function getQuizColumnIndexes(headers) {
  const map = getHeaderMap(headers);
  return {
    quizIdIdx: pickHeaderIndex(map, ["QuizID", "QuizId", "ID"], 0),
    sourceIdIdx: pickHeaderIndex(map, ["SourceID", "SourceId"], 1),
    baseIdIdx: pickHeaderIndex(map, ["BaseID", "BaseId"], -1),
    questionIdx: pickHeaderIndex(map, ["Question", "QuestionText"], 2),
    choiceAIdx: pickHeaderIndex(map, ["ChoiceA", "A", "OptionA"], 3),
    choiceBIdx: pickHeaderIndex(map, ["ChoiceB", "B", "OptionB"], 4),
    choiceCIdx: pickHeaderIndex(map, ["ChoiceC", "C", "OptionC"], 5),
    choiceDIdx: pickHeaderIndex(map, ["ChoiceD", "D", "OptionD"], 6),
    answerIdx: pickHeaderIndex(map, ["Answer", "CorrectAnswer"], 7)
  };
}

function findQuizRowById(values, quizIdIdx, quizId) {
  const target = String(quizId == null ? '' : quizId).trim();
  if (!target) return -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][quizIdIdx] == null ? '' : values[i][quizIdIdx]).trim() === target) return i + 1;
  }
  return -1;
}

function getAdminQuizBySource(sourceId, baseId, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์เข้าถึงข้อสอบ", data: [] };
    const sId = String(sourceId || '').trim();
    const bId = String(baseId || '').trim();
    if (!sId) return { status: "error", message: "กรุณาระบุรหัสแหล่งเรียนรู้", data: [] };
    if (!canAccessSourceForActor(actor, sId)) return { status: "error", message: "ไม่มีสิทธิ์เข้าถึงข้อสอบของแหล่งเรียนรู้นี้", data: [] };
    if (bId) {
      const foundSourceId = getBaseSourceIdByBaseId(bId);
      if (!foundSourceId) return { status: "error", message: "ไม่พบฐานการเรียนรู้ที่เลือก", data: [] };
      if (String(foundSourceId).trim() !== sId) return { status: "error", message: "ฐานการเรียนรู้ไม่อยู่ในแหล่งเรียนรู้นี้", data: [] };
    }

    const sheet = SS.getSheetByName("Quizzes");
    const values = sheet.getDataRange().getValues();
    if (values.length === 0) return { status: "success", data: [] };
    const headers = values[0];
    const idx = getQuizColumnIndexes(headers);

    const output = [];
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idx.sourceIdIdx]).trim() !== sId) continue;
      if (bId && idx.baseIdIdx > -1 && String(values[i][idx.baseIdIdx] || '').trim() !== bId) continue;
      if (!bId && idx.baseIdIdx > -1 && String(values[i][idx.baseIdIdx] || '').trim() !== '') continue;
      let quizId = String(values[i][idx.quizIdIdx] == null ? '' : values[i][idx.quizIdIdx]).trim();
      if (!quizId) {
        quizId = generateQuizId();
        sheet.getRange(i + 1, idx.quizIdIdx + 1).setValue(quizId);
      }
      output.push({
        quizId: quizId,
        sourceId: String(values[i][idx.sourceIdIdx] == null ? '' : values[i][idx.sourceIdIdx]),
        baseId: idx.baseIdIdx > -1 ? String(values[i][idx.baseIdIdx] || '') : "",
        question: String(values[i][idx.questionIdx] == null ? '' : values[i][idx.questionIdx]),
        choiceA: String(values[i][idx.choiceAIdx] == null ? '' : values[i][idx.choiceAIdx]),
        choiceB: String(values[i][idx.choiceBIdx] == null ? '' : values[i][idx.choiceBIdx]),
        choiceC: String(values[i][idx.choiceCIdx] == null ? '' : values[i][idx.choiceCIdx]),
        choiceD: String(values[i][idx.choiceDIdx] == null ? '' : values[i][idx.choiceDIdx]),
        answer: String(values[i][idx.answerIdx] == null ? '' : values[i][idx.answerIdx]).trim().toUpperCase()
      });
    }
    return { status: "success", data: output };
  } catch (e) {
    return { status: "error", message: e.toString(), data: [] };
  }
}

function saveAdminQuiz(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์จัดการข้อสอบ" };
    getLearningBaseSheets();
    const mode = String(data.mode || 'create').trim().toLowerCase();
    const sourceId = String(data.sourceId || '').trim();
    const baseId = String(data.baseId || '').trim();
    const question = String(data.question || '').trim();
    const choiceA = String(data.choiceA || '').trim();
    const choiceB = String(data.choiceB || '').trim();
    const choiceC = String(data.choiceC || '').trim();
    const choiceD = String(data.choiceD || '').trim();
    const answer = String(data.answer || '').trim().toUpperCase();
    const quizIdInput = String(data.quizId || '').trim();

    if (!sourceId) return { status: "error", message: "กรุณาระบุรหัสแหล่งเรียนรู้" };
    if (!canAccessSourceForActor(actor, sourceId)) return { status: "error", message: "ไม่มีสิทธิ์จัดการข้อสอบของแหล่งเรียนรู้นี้" };
    if (baseId) {
      const foundSourceId = getBaseSourceIdByBaseId(baseId);
      if (!foundSourceId) return { status: "error", message: "ไม่พบฐานการเรียนรู้ที่เลือก" };
      if (String(foundSourceId).trim() !== sourceId) return { status: "error", message: "ฐานการเรียนรู้ไม่อยู่ในแหล่งเรียนรู้นี้" };
    }
    if (!question || !choiceA || !choiceB || !choiceC || !choiceD) return { status: "error", message: "กรุณากรอกคำถามและตัวเลือกให้ครบถ้วน" };
    if (["A", "B", "C", "D"].indexOf(answer) === -1) return { status: "error", message: "เฉลยต้องเป็น A, B, C หรือ D" };

    const sheet = SS.getSheetByName("Quizzes");
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idx = getQuizColumnIndexes(headers);

    let targetRow = -1;
    let quizId = quizIdInput || generateQuizId();
    if (mode === "edit") {
      targetRow = findQuizRowById(values, idx.quizIdIdx, quizIdInput);
      if (targetRow === -1) return { status: "error", message: "ไม่พบข้อสอบที่ต้องการแก้ไข" };
      const existingSourceId = String(values[targetRow - 1][idx.sourceIdIdx] || '').trim();
      if (!canAccessSourceForActor(actor, existingSourceId)) {
        return { status: "error", message: "ไม่มีสิทธิ์แก้ไขข้อสอบของแหล่งเรียนรู้นี้" };
      }
    }

    const rowData = targetRow > -1 ? values[targetRow - 1].slice() : new Array(headers.length).fill("");
    rowData[idx.quizIdIdx] = quizId;
    rowData[idx.sourceIdIdx] = sourceId;
    if (idx.baseIdIdx > -1) rowData[idx.baseIdIdx] = baseId;
    rowData[idx.questionIdx] = question;
    rowData[idx.choiceAIdx] = choiceA;
    rowData[idx.choiceBIdx] = choiceB;
    rowData[idx.choiceCIdx] = choiceC;
    rowData[idx.choiceDIdx] = choiceD;
    rowData[idx.answerIdx] = answer;

    if (targetRow > -1) sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowData]);
    else sheet.appendRow(rowData);

    return { status: "success", quizId: quizId };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function deleteAdminQuiz(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์ลบข้อสอบ" };
    const sourceId = String((data || {}).sourceId || '').trim();
    const quizId = String((data || {}).quizId || '').trim();
    if (!quizId) return { status: "error", message: "ไม่พบรหัสข้อสอบ" };

    const sheet = SS.getSheetByName("Quizzes");
    const values = sheet.getDataRange().getValues();
    if (values.length === 0) return { status: "error", message: "ไม่พบข้อมูลข้อสอบ" };
    const headers = values[0];
    const idx = getQuizColumnIndexes(headers);

    const targetRow = findQuizRowById(values, idx.quizIdIdx, quizId);
    if (targetRow === -1) return { status: "error", message: "ไม่พบข้อสอบที่ต้องการลบ" };

    if (sourceId && String(values[targetRow - 1][idx.sourceIdIdx]).trim() !== sourceId) {
      return { status: "error", message: "รหัสแหล่งเรียนรู้ไม่ตรงกับข้อสอบที่เลือก" };
    }
    const targetSourceId = String(values[targetRow - 1][idx.sourceIdIdx] || '').trim();
    if (!canAccessSourceForActor(actor, targetSourceId)) return { status: "error", message: "ไม่มีสิทธิ์ลบข้อสอบของแหล่งเรียนรู้นี้" };

    sheet.deleteRow(targetRow);
    return { status: "success" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function saveAdminQuizOrder(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์จัดลำดับข้อสอบ" };
    const sourceId = String((data || {}).sourceId || '').trim();
    const baseId = String((data || {}).baseId || '').trim();
    const quizIds = ((data || {}).quizIds || []).map(q => String(q || '').trim()).filter(Boolean);
    if (!sourceId) return { status: "error", message: "ไม่พบรหัสแหล่งเรียนรู้" };
    if (quizIds.length === 0) return { status: "error", message: "ไม่พบรายการข้อสอบสำหรับจัดลำดับ" };
    if (!canAccessSourceForActor(actor, sourceId)) return { status: "error", message: "ไม่มีสิทธิ์จัดการข้อสอบของแหล่งเรียนรู้นี้" };
    if (baseId) {
      const foundSourceId = getBaseSourceIdByBaseId(baseId);
      if (!foundSourceId) return { status: "error", message: "ไม่พบฐานการเรียนรู้ที่เลือก" };
      if (String(foundSourceId).trim() !== sourceId) return { status: "error", message: "ฐานการเรียนรู้ไม่อยู่ในแหล่งเรียนรู้นี้" };
    }

    const sheet = SS.getSheetByName("Quizzes");
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { status: "error", message: "ยังไม่มีข้อมูลข้อสอบในระบบ" };
    const headers = values[0];
    const idx = getQuizColumnIndexes(headers);

    const sourceRows = [];
    const nonSourceRows = [];
    let firstSourceAt = -1;

    for (let i = 1; i < values.length; i++) {
      const sameSource = String(values[i][idx.sourceIdIdx]).trim() === sourceId;
      const sameBase = idx.baseIdIdx > -1
        ? (String(values[i][idx.baseIdIdx] || '').trim() === baseId)
        : (!baseId);
      if (sameSource && sameBase) {
        if (firstSourceAt === -1) firstSourceAt = nonSourceRows.length;
        sourceRows.push(values[i].slice());
      } else {
        nonSourceRows.push(values[i].slice());
      }
    }
    if (sourceRows.length === 0) return { status: "error", message: "ไม่พบข้อสอบของแหล่งเรียนรู้นี้" };

    const sourceMap = {};
    sourceRows.forEach(r => { sourceMap[String(r[idx.quizIdIdx]).trim()] = r; });
    const orderedSourceRows = [];
    quizIds.forEach(function(qid) {
      if (sourceMap[qid]) {
        orderedSourceRows.push(sourceMap[qid]);
        delete sourceMap[qid];
      }
    });
    Object.keys(sourceMap).forEach(function(k) { orderedSourceRows.push(sourceMap[k]); });

    const insertPos = firstSourceAt < 0 ? nonSourceRows.length : firstSourceAt;
    const rebuiltRows = nonSourceRows.slice(0, insertPos).concat(orderedSourceRows, nonSourceRows.slice(insertPos));

    sheet.getRange(2, 1, rebuiltRows.length, headers.length).setValues(rebuiltRows);
    return { status: "success" };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function importAdminQuizCsv(data, actor) {
  try {
    if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์นำเข้าข้อสอบ" };
    const sourceId = String((data || {}).sourceId || '').trim();
    const baseId = String((data || {}).baseId || '').trim();
    const rows = (data && data.rows && Array.isArray(data.rows)) ? data.rows : [];
    const replaceExisting = !!(data && data.replaceExisting);
    if (!sourceId) return { status: "error", message: "ไม่พบรหัสแหล่งเรียนรู้" };
    if (rows.length === 0) return { status: "error", message: "ไม่มีข้อมูล CSV สำหรับนำเข้า" };
    if (!canAccessSourceForActor(actor, sourceId)) return { status: "error", message: "ไม่มีสิทธิ์นำเข้าข้อสอบของแหล่งเรียนรู้นี้" };
    if (baseId) {
      const foundSourceId = getBaseSourceIdByBaseId(baseId);
      if (!foundSourceId) return { status: "error", message: "ไม่พบฐานการเรียนรู้ที่เลือก" };
      if (String(foundSourceId).trim() !== sourceId) return { status: "error", message: "ฐานการเรียนรู้ไม่อยู่ในแหล่งเรียนรู้นี้" };
    }

    const sheet = SS.getSheetByName("Quizzes");
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idx = getQuizColumnIndexes(headers);

    if (replaceExisting) {
      for (let i = values.length - 1; i >= 1; i--) {
        const sameSource = String(values[i][idx.sourceIdIdx]).trim() === sourceId;
        const sameBase = idx.baseIdIdx > -1
          ? (String(values[i][idx.baseIdIdx] || '').trim() === baseId)
          : (!baseId);
        if (sameSource && sameBase) {
          sheet.deleteRow(i + 1);
        }
      }
    }

    const cleanRows = [];
    rows.forEach(function(item) {
      const question = String((item || {}).question || '').trim();
      const choiceA = String((item || {}).choiceA || '').trim();
      const choiceB = String((item || {}).choiceB || '').trim();
      const choiceC = String((item || {}).choiceC || '').trim();
      const choiceD = String((item || {}).choiceD || '').trim();
      let answer = String((item || {}).answer || 'A').trim().toUpperCase();
      if (!question || !choiceA || !choiceB || !choiceC || !choiceD) return;
      if (["A", "B", "C", "D"].indexOf(answer) === -1) answer = "A";

      const row = new Array(headers.length).fill("");
      row[idx.quizIdIdx] = String((item || {}).quizId || '').trim() || generateQuizId();
      row[idx.sourceIdIdx] = sourceId;
      if (idx.baseIdIdx > -1) row[idx.baseIdIdx] = baseId || "";
      row[idx.questionIdx] = question;
      row[idx.choiceAIdx] = choiceA;
      row[idx.choiceBIdx] = choiceB;
      row[idx.choiceCIdx] = choiceC;
      row[idx.choiceDIdx] = choiceD;
      row[idx.answerIdx] = answer;
      cleanRows.push(row);
    });

    if (cleanRows.length === 0) return { status: "error", message: "ข้อมูลในไฟล์ CSV ไม่ถูกต้อง" };
    sheet.getRange(sheet.getLastRow() + 1, 1, cleanRows.length, headers.length).setValues(cleanRows);
    return { status: "success", count: cleanRows.length };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

// ================= ระบบบันทึกการเรียนรู้ =================
function submitLearningLog(data) {
  const sheet = SS.getSheetByName("LearningLogs");
  const nextRow = sheet.getLastRow() + 1;
  const logId = "L-" + new Date().getTime();
  const userStr = normalizeUsername(pickUserId(data));
  
  sheet.appendRow([logId, new Date(), "'" + userStr, data.tambon, data.activityName, data.description, "Pending", 0, "", ""]);
  setCellAsText(sheet, nextRow, 3);
  return { status: "success", message: "ส่งบันทึกการเรียนรู้สำเร็จ รอครูประจำตำบลอนุมัติ" };
}

// ================= ระบบแบบทดสอบ (Quiz) =================
function submitQuiz(data) {
  const logSheet = SS.getSheetByName("Logs");
  const userStr = normalizeUsername(pickUserId(data));
  const logsData = logSheet.getDataRange().getValues();
  let existingRowIndex = -1;
  const baseId = String((data || {}).baseId || '').trim();
  const headers = (logsData[0] || []).map(h => String(h || '').trim().toLowerCase());
  const phoneIdx = headers.indexOf("phone") > -1 ? headers.indexOf("phone") : 0;
  const sourceIdIdx = headers.indexOf("sourceid") > -1 ? headers.indexOf("sourceid") : 1;
  const scoreIdx = headers.indexOf("score") > -1 ? headers.indexOf("score") : 2;
  const statusIdx = headers.indexOf("status") > -1 ? headers.indexOf("status") : 3;
  const updatedAtIdx = headers.indexOf("updatedat") > -1 ? headers.indexOf("updatedat") : 4;
  const baseIdIdx = headers.indexOf("baseid");
  
  // ตรวจสอบว่าเคยทำแหล่งเรียนรู้นี้หรือยัง
  for (let i = 1; i < logsData.length; i++) {
    const sameUser = normalizeUsername(logsData[i][phoneIdx]) === userStr;
    const sameSource = String(logsData[i][sourceIdIdx]) === String(data.sourceId);
    const sameBase = baseIdIdx > -1 ? (String(logsData[i][baseIdIdx] || '').trim() === baseId) : true;
    if (sameUser && sameSource && sameBase) {
      existingRowIndex = i + 1;
      break;
    }
  }
  
  if (existingRowIndex > -1) {
    // หากเคยทำแล้ว อัปเดตคะแนนและสถานะใหม่ (ทับของเดิม) แบบ batch write
    const currentRow = logsData[existingRowIndex - 1].slice();
    currentRow[scoreIdx] = "'" + data.score;
    currentRow[statusIdx] = data.status;
    currentRow[updatedAtIdx] = new Date();
    if (baseIdIdx > -1) currentRow[baseIdIdx] = baseId;
    logSheet.getRange(existingRowIndex, 1, 1, currentRow.length).setValues([currentRow]);
  } else {
    // ถ้าไม่เคยทำ สร้างแถวใหม่
    const nextLogReqRow = logSheet.getLastRow() + 1;
    const row = new Array(headers.length).fill("");
    row[phoneIdx] = "'" + userStr;
    row[sourceIdIdx] = data.sourceId;
    row[scoreIdx] = "'" + data.score;
    row[statusIdx] = data.status;
    row[updatedAtIdx] = new Date();
    if (baseIdIdx > -1) row[baseIdIdx] = baseId;
    logSheet.appendRow(row);
    setCellAsText(logSheet, nextLogReqRow, 1);
  }
  
  if (data.status === "Pass") {
    updateUserStats(userStr); 
  }
  return { status: "success" };
}

// ================= ระบบคำนวณคะแนนรวม =================
// ================= ระบบคำนวณคะแนนรวม และระบบจัดอันดับสไตล์ ROV =================
function updateUserStats(userId) {
  const userStr = normalizeUsername(userId);
  
  // 1. คำนวณคะแนนรวมของคนที่ทำรายการ
  const history = getPassedHistory(userStr);
  let quizScore = 0;
  history.forEach(item => { quizScore += (parseInt(String(item.score).split('/')[0]) || 0) * 10; });
  
  const learningSheet = SS.getSheetByName("LearningLogs");
  let learningScore = 0;
  if (learningSheet) {
    const logData = learningSheet.getDataRange().getValues();
    for(let i = 1; i < logData.length; i++) {
       let logUser = normalizeUsername(logData[i][2]);
       if(logUser === userStr && logData[i][6] === "Approved") {
           learningScore += Number(logData[i][7]) || 0;
       }
    }
  }
  let totalScore = quizScore + learningScore;

  // 2. อ่านข้อมูล Users และอัปเดตคะแนนใน Array (ยังไม่เขียน Sheet)
  const userSheet = SS.getSheetByName("Users");
  let userData = userSheet.getDataRange().getValues();
  for (let i = 1; i < userData.length; i++) {
    if (normalizeUsername(userData[i][0]) === userStr) {
      userData[i][5] = totalScore; // อัปเดตใน Array สำหรับนำไปเรียงลำดับต่อ
      break;
    }
  }

  // 3. 🌟 ระบบจัดอันดับใหม่ทั้งเซิร์ฟเวอร์ (ROV Rank Logic)
  let learners = [];
  for (let i = 1; i < userData.length; i++) {
    if (userData[i][6] === "user") {
      learners.push({ dataIdx: i, score: Number(userData[i][5]) || 0, userId: normalizeUsername(userData[i][0]) });
    }
  }

  // เรียงลำดับคะแนนจากมากไปน้อย (Top Server)
  learners.sort((a, b) => b.score - a.score);

  let currentUserNewTitle = "ผู้เตรียมความพร้อม";

  // เตรียม Array สำหรับ Batch Write (เร็วกว่าเขียนทีละแถวมาก)
  const numDataRows = userData.length - 1;
  const levelCol = userData.slice(1).map(r => [r[4]]);
  const scoreCol = userData.slice(1).map(r => [r[5]]);

  for (let rankIndex = 0; rankIndex < learners.length; rankIndex++) {
    let u = learners[rankIndex];
    let title;

    if (rankIndex < 20 && u.score >= 1000) title = "Glorious Conqueror";
    else if (u.score >= 800) title = "นักเรียนรู้ต้นแบบ";
    else if (u.score >= 500) title = "นักเรียนรู้ระดับเชี่ยวชาญ";
    else if (u.score >= 300) title = "นักเรียนรู้ระดับก้าวหน้า";
    else if (u.score >= 150) title = "นักเรียนรู้ระดับกลาง";
    else if (u.score >= 50)  title = "นักเรียนรู้ระดับต้น";
    else title = "ผู้เตรียมความพร้อม";

    levelCol[u.dataIdx - 1] = [title];

    if (u.userId === userStr) {
      currentUserNewTitle = title;
    }
  }

  // เขียนลง Sheet ด้วย Batch เดียว (ลดจาก N ครั้งเหลือ 2 ครั้ง)
  if (numDataRows > 0) {
    userSheet.getRange(2, 5, numDataRows, 1).setValues(levelCol);
    userSheet.getRange(2, 6, numDataRows, 1).setValues(scoreCol);
  }

  return { totalScore: totalScore, title: currentUserNewTitle };
}

// ================= ระบบประเมินผล (ครูตรวจงาน) =================
function reviewLearningLog(data, actor) {
  if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์ตรวจงาน" };
  const { logId, status, score, note } = data;
  const logSheet = SS.getSheetByName("LearningLogs");
  const logData = logSheet.getDataRange().getValues();
  let logUserId = "";
  let found = false;

  for (let i = 1; i < logData.length; i++) {
    if (logData[i][0] === logId) {
      found = true;
      const logTambon = normalizeTambon(logData[i][3]);
      if (isTeacher(actor) && logTambon !== normalizeTambon(actor.tambon)) {
        return { status: "error", message: "ครูประจำตำบลมีสิทธิ์ตรวจเฉพาะงานในตำบลของตนเอง" };
      }
      logUserId = normalizeUsername(logData[i][2]);
      logSheet.getRange(i + 1, 7).setValue(status);
      logSheet.getRange(i + 1, 8).setValue(status === "Approved" ? Number(score) : 0);
      logSheet.getRange(i + 1, 9).setValue(note);
      logSheet.getRange(i + 1, 10).setValue(new Date());
      break;
    }
  }
  if (!found) return { status: "error", message: "ไม่พบงานที่ต้องการตรวจ" };

  if (status === "Approved" && logUserId) {
    updateUserStats(logUserId);
  }
  return { status: "success" };
}

// ================= ระบบ Dashboard & Leaderboard =================
function getDashboardData(tambonFilter = "ทั้งหมด", actor) {
  if (isTeacher(actor)) tambonFilter = normalizeTambon(actor.tambon) || "ทั้งหมด";
  const userData = SS.getSheetByName("Users").getDataRange().getValues();
  userData.shift();
  let learners = userData.filter(row => row[6] === "user");
  let dashboard = { totalLearners: 0, ranking: [] };

  learners.forEach(row => {
    let t = String(row[7]).trim() || "ไม่ระบุ";
    let s = Number(row[5]) || 0;
    if (tambonFilter === "ทั้งหมด" || tambonFilter === t) {
      dashboard.totalLearners++;
      dashboard.ranking.push({ name: row[2], score: s, tambon: t, image: row[3], level: row[4] });
    }
  });
  dashboard.ranking.sort((a, b) => b.score - a.score);
  dashboard.ranking = dashboard.ranking.slice(0, 10);
  return dashboard;
}

function getLeaderboard() {
  const data = SS.getSheetByName("Users").getDataRange().getValues();
  data.shift();
  const sorted = data.filter(r => r[6] === "user").sort((a, b) => b[5] - a[5]).slice(0, 10);
  return sorted.map(row => ({ name: row[2], image: row[3] || "", level: row[4], score: row[5] }));
}

function getUserLearningLogs(userId, page = 1, startDate = null, endDate = null) {
  const sheet = SS.getSheetByName("LearningLogs");
  let data = sheet.getDataRange().getValues();
  data.shift();
  const userStr = normalizeUsername(userId);
  let myLogs = data.filter(row => normalizeUsername(row[2]) === userStr);
  
  if (startDate && endDate) {
    const start = new Date(startDate); start.setHours(0,0,0,0);
    const end = new Date(endDate); end.setHours(23,59,59,999);
    myLogs = myLogs.filter(row => { const d = new Date(row[1]); return d >= start && d <= end; });
  }
  
  myLogs.sort((a, b) => new Date(b[1]) - new Date(a[1]));
  const itemsPerPage = 3;
  const totalPages = Math.ceil(myLogs.length / itemsPerPage);
  const startIdx = (page - 1) * itemsPerPage;
  const paginatedData = myLogs.slice(startIdx, startIdx + itemsPerPage);
  
  return { 
    data: paginatedData.map(row => ({ logId: row[0], date: Utilities.formatDate(new Date(row[1]), "GMT+7", "dd/MM/yyyy"), activityName: row[4], description: row[5], status: row[6], score: row[7], note: row[8] })),
    totalPages: totalPages, currentPage: page 
  };
}

function getPendingLogsForTeacher(tambon, actor) {
  if (!isAdmin(actor) && !isTeacher(actor)) return [];
  const targetTambon = isTeacher(actor) ? normalizeTambon(actor.tambon) : normalizeTambon(tambon);
  if (!targetTambon) return [];
  const sheet = SS.getSheetByName("LearningLogs");
  let data = sheet.getDataRange().getValues();
  data.shift();
  return data.filter(row => normalizeTambon(row[3]) === targetTambon && row[6] === "Pending").map(row => ({
    logId: row[0], date: Utilities.formatDate(new Date(row[1]), "GMT+7", "dd/MM/yyyy HH:mm"), username: normalizeUsername(row[2]), phone: normalizeUsername(row[2]), activityName: row[4], description: row[5]
  }));
}

function uploadGeneralImage(data) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const blob = Utilities.newBlob(Utilities.base64Decode(data.base64.split(",")[1]), data.base64.split(",")[0].split(":")[1].split(";")[0], data.fileName);
    const file = folder.createFile(blob);
    
    // พยายามตั้งค่าการแชร์ แต่ถ้าติดนโยบายองค์กร (Organization Policy) ให้ข้ามไป
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (sharingError) {
      console.log("Sharing error (ignored): " + sharingError.toString());
    }

    const fileUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
    return { status: "success", url: fileUrl };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function uploadProfileImage(data) { 
  try { 
    const folder = DriveApp.getFolderById(FOLDER_ID); 
    const blob = Utilities.newBlob(Utilities.base64Decode(data.base64.split(",")[1]), data.base64.split(",")[0].split(":")[1].split(";")[0], data.fileName); 
    const fileUrl = "https://lh3.googleusercontent.com/d/" + folder.createFile(blob).getId(); 
    const sheet = SS.getSheetByName("Users"); 
    const values = sheet.getDataRange().getValues(); 
    const userStr = normalizeUsername(pickUserId(data)); 
    for (let i = 1; i < values.length; i++) { 
      if (normalizeUsername(values[i][0]) === userStr) { 
        sheet.getRange(i + 1, 4).setValue(fileUrl); 
        return { status: "success", url: fileUrl }; 
      } 
    } 
    return { status: "error", message: "ไม่พบข้อมูล" }; 
  } catch (e) { return { status: "error", message: e.toString() }; } 
}

function getPassedHistory(userId) { 
  try { 
    const logSheet = SS.getSheetByName("Logs");
    const values = logSheet.getDataRange().getValues();
    if (!values || values.length === 0) return [];
    const headers = values[0].map(h => String(h || '').trim().toLowerCase());
    const phoneIdx = headers.indexOf("phone") > -1 ? headers.indexOf("phone") : 0;
    const sourceIdIdx = headers.indexOf("sourceid") > -1 ? headers.indexOf("sourceid") : 1;
    const scoreIdx = headers.indexOf("score") > -1 ? headers.indexOf("score") : 2;
    const statusIdx = headers.indexOf("status") > -1 ? headers.indexOf("status") : 3;
    const certUrlIdx = headers.indexOf("certurl") > -1 ? headers.indexOf("certurl") : 5;
    const baseIdIdx = headers.indexOf("baseid");

    const userStr = normalizeUsername(userId);
    const bestScores = {};

    for (let i = 1; i < values.length; i++) {
      if (normalizeUsername(values[i][phoneIdx]) !== userStr) continue;
      if (String(values[i][statusIdx] || '').trim().toLowerCase() !== "pass") continue;

      const sId = String(values[i][sourceIdIdx] || '').trim();
      if (!sId) continue;
      const bId = baseIdIdx > -1 ? String(values[i][baseIdIdx] || '').trim() : '';
      const key = bId ? (sId + "|" + bId) : sId;
      const scoreText = String(values[i][scoreIdx] || '');
      const scoreNum = parseInt(String(scoreText).split('/')[0]) || 0;

      if (!bestScores[key] || scoreNum > bestScores[key].scoreNum) {
        bestScores[key] = { sourceId: sId, baseId: bId, scoreText: scoreText, scoreNum: scoreNum, certUrl: values[i][certUrlIdx] || "" };
      }
    }

    const sourceData = SS.getSheetByName("Sources").getDataRange().getValues();
    sourceData.shift();
    const sourceMap = {};
    sourceData.forEach(function(s) { sourceMap[String(s[0]).trim()] = s; });

    const baseMap = {};
    const baseSheet = SS.getSheetByName("Bases");
    if (baseSheet && baseSheet.getLastRow() > 0) {
      const baseValues = baseSheet.getDataRange().getValues();
      if (baseValues.length > 1) {
        const map = getHeaderMap(baseValues[0]);
        const bIdIdx = pickHeaderIndex(map, ["BaseID"], 0);
        const bNameIdx = pickHeaderIndex(map, ["BaseName"], 2);
        for (let i = 1; i < baseValues.length; i++) {
          const bId = String(baseValues[i][bIdIdx] || '').trim();
          if (!bId) continue;
          baseMap[bId] = { baseName: String(baseValues[i][bNameIdx] || '') };
        }
      }
    }

    return Object.values(bestScores).map(function(item) {
      const sInfo = sourceMap[String(item.sourceId).trim()];
      const sourceName = sInfo ? String(sInfo[2] || "แหล่งเรียนรู้") : "แหล่งเรียนรู้";
      const baseName = item.baseId && baseMap[item.baseId] ? String(baseMap[item.baseId].baseName || '') : '';
      const label = baseName ? (baseName + " (" + sourceName + ")") : sourceName;
      return { sourceId: item.sourceId, baseId: item.baseId, sourceName: label, score: item.scoreText, certUrl: item.certUrl };
    }); 
  } catch (e) { return []; } 
}

// ================= ระบบออกเกียรติบัตร (ข้าม Error ได้) =================
// ================= ระบบออกเกียรติบัตร (ข้าม Error และแก้ปัญหา DriveApp) =================
function generateCertificate(data) {
  try {
    const { name, source, score, phone, username, sourceId, baseId } = data;
    const userIdRaw = username != null && String(username).trim() !== '' ? username : phone;
    const dateStr = Utilities.formatDate(new Date(), "GMT+7", "d MMMM yyyy");
    
    // สร้างรหัสอ้างอิงเกียรติบัตร (Format: LL-YYYYMMDD-Random4)
    const refCode = "LL-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd") + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();

    // 1. สร้างไฟล์ Slide ใหม่จากต้นฉบับ
    const newFile = DriveApp.getFileById(CERT_TEMPLATE_ID).makeCopy(`เกียรติบัตร_${name}`, DriveApp.getFolderById(PDF_FOLDER_ID));
    const newFileId = newFile.getId();
    
    // 2. เปิดไฟล์เพื่อแก้คำ
    const presentation = SlidesApp.openById(newFileId);
    presentation.getSlides().forEach(slide => {
      slide.replaceAllText("{{name}}", name);
      slide.replaceAllText("{{source}}", source);
      slide.replaceAllText("{{Score}}", score);
      slide.replaceAllText("{{date}}", dateStr);
      slide.replaceAllText("{{ref}}", refCode);
    });
    presentation.saveAndClose();
    
    // เผื่อเวลาให้ Google เซฟสไลด์ลงเซิร์ฟเวอร์
    Utilities.sleep(3000);

    // 3. ใช้เทคนิคดึงไฟล์ใหม่ด้วย ID เพื่อป้องกัน Error: ไม่ได้รับอนุญาตให้เข้าถึง DriveApp
    const pdfBlob = DriveApp.getFileById(newFileId).getAs(MimeType.PDF);
    const pdfFile = DriveApp.getFolderById(PDF_FOLDER_ID).createFile(pdfBlob);
    pdfFile.setName(`เกียรติบัตร_${name}_${source}.pdf`);
    
    // 4. พยายามแชร์ลิงก์และลบสไลด์ทิ้ง (ถ้าติด Error องค์กรจะครอบด้วย try..catch ไว้ไม่ให้ระบบค้าง)
    try { pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){ console.log("Sharing Error:", e); }
    try { DriveApp.getFileById(newFileId).setTrashed(true); } catch(e){ console.log("Trash Error:", e); }

    const finalUrl = pdfFile.getUrl();
    
    // 5. บันทึกลิงก์ลง Sheet "Logs"
    const logSheet = SS.getSheetByName("Logs");
    const logData = logSheet.getDataRange().getValues();
    
    // ดึง Header เพื่อหาตำแหน่งคอลัมน์แบบไดนามิก (ตามโค้ดที่คุณศึกษามา)
    const headers = logData[0].map(h => h.toString().toLowerCase().trim());
    // ป้องกันกรณีไม่เจอ Header ให้ใช้ Index เริ่มต้น
    const phoneIdx = headers.indexOf("phone") > -1 ? headers.indexOf("phone") : 0;
    const sourceIdIdx = headers.indexOf("sourceid") > -1 ? headers.indexOf("sourceid") : 1;
    const certUrlIdx = headers.indexOf("certurl") > -1 ? headers.indexOf("certurl") : 5;
    const baseIdIdx = headers.indexOf("baseid");

    const myUserId = normalizeUsername(userIdRaw);
    
    for (let i = 1; i < logData.length; i++) {
      let sheetUserId = normalizeUsername(logData[i][phoneIdx]);
      const sameBase = baseIdIdx > -1 ? (String(logData[i][baseIdIdx] || '').trim() === String(baseId || '').trim()) : true;
      if (sheetUserId === myUserId && String(logData[i][sourceIdIdx]) === String(sourceId) && sameBase) {
        logSheet.getRange(i + 1, certUrlIdx + 1).setValue(finalUrl);
        break;
      }
    }
    
    return { status: "success", url: finalUrl };
  } catch (e) { 
    return { status: "error", message: e.toString() }; 
  }
}

function submitSurvey(data) { 
  const sheet = SS.getSheetByName("Survey");
  const nextRow = sheet.getLastRow() + 1; 
  const userStr = normalizeUsername(pickUserId(data));
  sheet.appendRow([new Date(), "'" + userStr, data.rating, data.comment]); 
  setCellAsText(sheet, nextRow, 2); 
  return { status: "success" }; 
}

function submitEvaluation(data) {
  const headers = ["Timestamp", "Phone", "SourceID", "Rating", "Comment"];
  const sheet = SS.getSheetByName("Evaluations") || ensureSheetWithHeaders("Evaluations", headers);
  const nextRow = sheet.getLastRow() + 1;
  const userStr = normalizeUsername(pickUserId(data));
  sheet.appendRow([new Date(), "'" + userStr, data.sourceId, data.rating, data.comment]);
  setCellAsText(sheet, nextRow, 2);
  return { status: "success" };
}

function submitProposal(data) {
  const headers = ["Timestamp", "Phone", "Title", "Description", "Status"];
  const sheet = SS.getSheetByName("Proposals") || ensureSheetWithHeaders("Proposals", headers);
  const nextRow = sheet.getLastRow() + 1;
  const userStr = normalizeUsername(pickUserId(data));
  sheet.appendRow([new Date(), "'" + userStr, data.title, data.description, "Pending"]);
  setCellAsText(sheet, nextRow, 2);
  return { status: "success" };
}

function getUserProposals(userId) {
  try {
    const sheet = SS.getSheetByName("Proposals");
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    const userStr = normalizeUsername(userId);
    const results = [];
    for (let i = 1; i < values.length; i++) {
      if (normalizeUsername(values[i][1]) === userStr) {
        let ts = "";
        try {
          if (values[i][0] instanceof Date) {
            ts = Utilities.formatDate(values[i][0], "GMT+7", "yyyy-MM-dd HH:mm:ss");
          } else {
            ts = String(values[i][0]);
          }
        } catch(e) { ts = String(values[i][0]); }

        results.push({
          timestamp: ts,
          title: String(values[i][2] || "ไม่มีหัวข้อ"),
          description: String(values[i][3] || "-"),
          status: String(values[i][4] || "Pending")
        });
      }
    }
    // เรียงตามเวลาล่าสุด (ถ้าเป็น string จะเทียบตามตัวอักษรซึ่ง yyyy-MM-dd ใช้ได้พอดี)
    return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (e) { 
    console.log("Error in getUserProposals: " + e.toString());
    return []; 
  }
}

function getPendingProposals(actor) {
  if (!isAdmin(actor) && !isTeacher(actor)) return [];
  try {
    const sheet = SS.getSheetByName("Proposals");
    if (!sheet) return [];
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return [];
    
    const results = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i][4] === "Pending") {
        let ts = "";
        try {
          if (values[i][0] instanceof Date) {
            ts = Utilities.formatDate(values[i][0], "GMT+7", "yyyy-MM-dd HH:mm:ss");
          } else {
            ts = String(values[i][0]);
          }
        } catch(e) { ts = String(values[i][0]); }

        results.push({
          rowIdx: i + 1,
          timestamp: ts,
          phone: String(values[i][1]),
          title: String(values[i][2] || "ไม่มีหัวข้อ"),
          description: String(values[i][3] || "-"),
          status: String(values[i][4] || "Pending")
        });
      }
    }
    return results;
  } catch (e) { return []; }
}

function reviewProposal(data, actor) {
  if (!isAdmin(actor) && !isTeacher(actor)) return { status: "error", message: "ไม่มีสิทธิ์จัดการข้อเสนอแนะ" };
  try {
    const { rowIdx, status } = data;
    const sheet = SS.getSheetByName("Proposals");
    if (!sheet) return { status: "error", message: "ไม่พบข้อมูล" };
    
    sheet.getRange(rowIdx, 5).setValue(status); // Column E คือ Status
    return { status: "success" };
  } catch (e) { return { status: "error", message: e.toString() }; }
}

function getUsersDataForProfile() { 
  try { 
    const data = SS.getSheetByName("Users").getDataRange().getValues(); 
    const headers = data.shift().map(h => h.toString().trim().toLowerCase()); 
    return data.map(row => { 
      let obj = {}; 
      headers.forEach((h, i) => { 
        let v = row[i]; 
        if (h === 'phone' || h === 'username') {
          obj[h] = normalizeUsername(v); 
        } else {
          obj[h] = (v instanceof Date) ? Utilities.formatDate(v, "GMT+7", "yyyy-MM-dd HH:mm:ss") : String(v); 
        }
      }); 
      return obj; 
    }); 
  } catch (e) { return []; } 
}


// ================= ระบบดึงข้อมูลโปรไฟล์แบบรวบยอด (ลดเวลาโหลดหน้าเว็บ) =================
function getUserProfileFullData(userId) {
  try {
    const userStr = normalizeUsername(userId);

    // คะแนนและ Rank ถูกอัปเดตอัตโนมัติตอน submitQuiz / reviewLog แล้ว
    // ไม่จำเป็นต้องเรียก updateUserStats ซ้ำที่นี่ (ลดเวลาโหลดอย่างมาก)

    // ดึงเฉพาะข้อมูล Profile ของคนนี้คนเดียว
    const userSheet = SS.getSheetByName("Users");
    const userData = userSheet.getDataRange().getValues();
    const headers = userData.shift().map(h => h.toString().trim().toLowerCase());
    let myProfile = null;
    
    for (let i = 0; i < userData.length; i++) {
      if (normalizeUsername(userData[i][0]) === userStr) {
        myProfile = {};
        headers.forEach((h, index) => {
          let v = userData[i][index];
          myProfile[h] = (v instanceof Date) ? Utilities.formatDate(v, "GMT+7", "yyyy-MM-dd HH:mm:ss") : String(v);
        });
        break; // เจอแล้วหยุดหาเลย ประหยัดเวลา
      }
    }
    
    // 3. ไม่ต้องดึงประวัติเกียรติบัตรที่นี่แล้ว (ไปดึงแยกเมื่อกดปุ่มแทน)
    
    // ส่งกลับรวดเดียวจบ
    return { status: "success", profile: myProfile };
    
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

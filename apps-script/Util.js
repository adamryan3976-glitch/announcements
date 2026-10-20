/**
 * Small helpers shared by the server code.
 */

function ss_() {
  return SpreadsheetApp.getActive();
}

/** Returns the sheet, creating it with the given header row if missing. */
function sheet_(name, headers) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh && headers) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Reads a tab into an array of objects keyed by the header row. */
function readObjects_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.every(function (v) { return v === '' || v === null; })) continue;
    var o = { _row: i + 1 };
    headers.forEach(function (h, j) { if (h) o[h] = row[j]; });
    out.push(o);
  }
  return out;
}

/** Today's date as yyyy-MM-dd in the school's time zone. */
function todayStr_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/**
 * Normalizes a sheet value (Date, 'yyyy-MM-dd', 'M/D/YYYY') to yyyy-MM-dd.
 * Returns '' when it can't be read.
 */
function toDateStr_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + pad2_(m[1]) + '-' + pad2_(m[2]);
  return '';
}

function pad2_(n) {
  n = String(n);
  return n.length < 2 ? '0' + n : n;
}

/** Adds days to a yyyy-MM-dd string, returning yyyy-MM-dd. Noon avoids DST edges. */
function addDays_(dateStr, days) {
  var p = dateStr.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
  d.setUTCDate(d.getUTCDate() + days);
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}

/** Day of week for a yyyy-MM-dd string: 0 = Sunday. */
function weekday_(dateStr) {
  var p = dateStr.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay();
}

function daysBetween_(a, b) {
  var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
}

function isTrue_(v) {
  return v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'yes';
}

function cleanText_(v, max) {
  var s = String(v === null || v === undefined ? '' : v).replace(/\r\n/g, '\n').trim();
  return max ? s.slice(0, max) : s;
}

/** Only http(s) links are allowed through to pages. */
function cleanUrl_(v) {
  var s = cleanText_(v, 2000);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  if (!/^https?:\/\/[^\s<>"']+$/i.test(s)) throw new Error('That link doesn\'t look like a web address.');
  return s;
}

function newId_() {
  return Utilities.getUuid().slice(0, 8) + Date.now().toString(36);
}

/** Settings as a plain object, with defaults filled in. Cached for 60 seconds. */
function settings_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('settings');
  if (hit) return JSON.parse(hit);
  var out = {};
  Object.keys(SETTING_DEFAULTS).forEach(function (k) { out[k] = SETTING_DEFAULTS[k]; });
  readObjects_(SHEETS.settings).forEach(function (r) {
    var k = String(r.key || '').trim();
    if (k) out[k] = String(r.value === undefined ? '' : r.value).trim();
  });
  cache.put('settings', JSON.stringify(out), 60);
  return out;
}

function setSetting_(key, value) {
  var sh = sheet_(SHEETS.settings, ['key', 'value']);
  var rows = readObjects_(SHEETS.settings);
  var found = rows.filter(function (r) { return String(r.key).trim() === key; })[0];
  if (found) sh.getRange(found._row, 2).setValue(value);
  else sh.appendRow([key, value]);
  CacheService.getScriptCache().remove('settings');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

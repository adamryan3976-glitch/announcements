/**
 * Student lunchroom monitors, read from the principal's own spreadsheet
 * (Settings "lunchMonitorUrl"). That sheet stays the place where the
 * schedule is edited; this only reads it.
 *
 * Expected layout on the "Input" tab (Settings "lunchMonitorTab"):
 *   a header row with Monday … Friday, then one row per room:
 *   column A = room / where to go, each weekday cell = one name per line,
 *   with the duty in brackets: "Keaton (AM Recess)", "Ivy (AM/PM Recess)",
 *   "Nathan (Lunch)".
 */

var DUTY_ORDER = ['AM Recess', 'Lunch', 'PM Recess'];
var WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** The spreadsheet ID from a Google Sheets link (or a bare ID). */
function sheetIdFromUrl_(url) {
  var m = String(url || '').match(/\/spreadsheets\/d\/([\w-]{20,})/);
  if (m) return m[1];
  return /^[\w-]{20,}$/.test(String(url || '').trim()) ? String(url).trim() : '';
}

/** The whole week, cached for 5 minutes so the principal's edits show quickly. */
function lunchWeek_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('lunchWeek');
  if (hit) return JSON.parse(hit);

  var s = settings_();
  var id = sheetIdFromUrl_(s.lunchMonitorUrl);
  if (!id) return { error: 'No lunchroom monitor sheet is set in Settings.' };
  var week;
  try {
    var book = SpreadsheetApp.openById(id);
    var tabName = s.lunchMonitorTab || 'Input';
    var sh = book.getSheetByName(tabName);
    if (!sh) return { error: 'The lunchroom monitor sheet has no tab called "' + tabName + '".' };
    week = parseLunchWeek_(sh.getDataRange().getDisplayValues());
  } catch (e) {
    return { error: 'The lunchroom monitor sheet couldn’t be opened. Make sure the account that deployed this site can view it.' };
  }
  cache.put('lunchWeek', JSON.stringify(week), 300);
  return week;
}

/** { monday: [ {room, duties:[{duty, names}]} ], tuesday: … } */
function parseLunchWeek_(values) {
  var headerRow = -1, dayCols = {};
  for (var r = 0; r < values.length && headerRow === -1; r++) {
    values[r].forEach(function (v, c) {
      var key = String(v).toLowerCase().trim();
      if (WEEKDAY_NAMES.indexOf(key) !== -1) { dayCols[key] = c; headerRow = r; }
    });
  }
  if (headerRow === -1) return { error: 'The lunchroom monitor sheet has no Monday–Friday header row.' };

  var week = {};
  Object.keys(dayCols).forEach(function (day) { week[day] = []; });
  for (var i = headerRow + 1; i < values.length; i++) {
    var room = String(values[i][0] || '').trim();
    if (!room) continue;
    Object.keys(dayCols).forEach(function (day) {
      var duties = parseMonitorCell_(values[i][dayCols[day]]);
      if (duties.length) week[day].push({ room: room, duties: duties });
    });
  }
  return week;
}

/** "Keaton (AM Recess)\nIvy (AM/PM Recess)\nNathan (Lunch)" → duties in time order. */
function parseMonitorCell_(text) {
  var byDuty = {};
  String(text || '').split(/\r?\n|;/).forEach(function (line) {
    line = line.trim();
    if (!line) return;
    var m = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    var name = (m ? m[1] : line).replace(/\s+/g, ' ').trim();
    var dutyText = m ? m[2] : '';
    if (!name) return;
    dutiesFrom_(dutyText).forEach(function (d) {
      (byDuty[d] = byDuty[d] || []).push(name);
    });
  });
  return Object.keys(byDuty).sort(function (a, b) {
    var ia = DUTY_ORDER.indexOf(a), ib = DUTY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  }).map(function (d) { return { duty: d, names: byDuty[d] }; });
}

/** "AM/PM Recess" → ['AM Recess', 'PM Recess']; "lunch" → ['Lunch']. */
function dutiesFrom_(text) {
  var t = String(text || '').toLowerCase();
  var out = [];
  var recess = t.indexOf('recess') !== -1;
  if (recess && /\bam\b/.test(t)) out.push('AM Recess');
  if (t.indexOf('lunch') !== -1) out.push('Lunch');
  if (recess && /\bpm\b/.test(t)) out.push('PM Recess');
  if (recess && !/\b(am|pm)\b/.test(t)) out.push('Recess');
  if (!out.length) out.push(String(text || '').trim() || 'On duty');
  return out;
}

/** Monitors for one date: { rooms: [...] } or { error } or { rooms: [] } on weekends. */
function lunchMonitorsFor_(dateStr) {
  var week = lunchWeek_();
  if (week.error) return { error: week.error, rooms: [] };
  var day = WEEKDAY_NAMES[weekday_(dateStr)];
  return { rooms: week[day] || [] };
}

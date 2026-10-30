/**
 * One-time setup and repair. Safe to run again at any time:
 * it only adds what is missing and never deletes data.
 */

function setupSheet() {
  requireAdmin_();
  var ss = ss_();
  var report = [];

  // 1. Announcements tab, with date columns stored as plain text.
  var ann = sheet_(SHEETS.announcements, ANN_COLS);
  ensureColumns_(ann, ANN_COLS);
  ['startDate', 'endDate'].forEach(function (c) {
    var idx = ANN_COLS.indexOf(c) + 1;
    ann.getRange(2, idx, ann.getMaxRows() - 1, 1).setNumberFormat('@');
  });
  report.push('Announcements tab ready.');

  // 2. Settings tab with defaults; the owner is the first admin.
  var settingsSheet = sheet_(SHEETS.settings, ['key', 'value']);
  var existing = {};
  readObjects_(SHEETS.settings).forEach(function (r) { existing[String(r.key).trim()] = true; });
  Object.keys(SETTING_DEFAULTS).forEach(function (k) {
    if (!existing[k]) settingsSheet.appendRow([k, k === 'admins' ? ownerEmail_() : SETTING_DEFAULTS[k]]);
  });
  CacheService.getScriptCache().remove('settings');
  report.push('Settings tab ready.');

  // 3. Staff tab, seeded with everyone who has posted through the old form.
  var staffSheet = sheet_(SHEETS.staff, STAFF_COLS);
  var known = {};
  readObjects_(SHEETS.staff).forEach(function (r) { known[String(r.email).toLowerCase()] = true; });
  var seeded = 0;
  legacyAuthors_().forEach(function (a) {
    if (known[a.email]) return;
    staffSheet.appendRow([a.email, a.name, 'active', 'imported from Google Form', new Date()]);
    known[a.email] = true;
    seeded++;
  });
  report.push('Staff tab ready (' + seeded + ' staff added from past form submissions).');

  // 4. Cycle Days: show the day numbers as numbers, not dates.
  var cycle = ss.getSheetByName(SHEETS.cycleDays);
  if (cycle && cycle.getLastRow() > 1) {
    var range = cycle.getRange(2, 2, cycle.getLastRow() - 1, 1);
    // Only change cells that hold a day number; leave anything else as it is.
    var fixed = range.getValues().map(function (r) {
      var n = cycleNumber_(r[0]);
      return [n ? Number(n) : r[0]];
    });
    range.setValues(fixed);
    fixed.forEach(function (r, i) { if (typeof r[0] === 'number') range.getCell(i + 1, 1).setNumberFormat('0'); });
    CacheService.getScriptCache().remove('cycle');
    report.push('Cycle Days fixed to show 1–5.');
  }

  // 5. Birthdays: move to month + day only.
  var b = convertOldBirthdays_();
  if (b) report.push(b);

  // 6. Bring across the old form's announcements.
  var imp = importLegacy_();
  report.push('Copied ' + imp.imported + ' announcements from the old Google Form.');
  if (imp.repaired) report.push('Fixed the text of ' + imp.repaired + ' copied announcements.');

  try { SpreadsheetApp.getUi().alert(report.join('\n')); } catch (e) { Logger.log(report.join('\n')); }
  return report;
}

/** Adds any missing header columns at the end. */
function ensureColumns_(sh, cols) {
  var header = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  cols.forEach(function (c) {
    if (header.indexOf(c) === -1) {
      sh.getRange(1, header.length + 1).setValue(c).setFontWeight('bold');
      header.push(c);
    }
  });
}

/** Distinct email + most recent name from the old Google Form tab. */
function legacyAuthors_() {
  var values;
  try { values = legacyTable_(); } catch (e) { return []; }
  if (values.length < 2) return [];
  var h = values[0].map(function (x) { return String(x).toLowerCase(); });
  var cEmail = h.findIndex(function (x) { return x.indexOf('email') !== -1; });
  var cName = h.findIndex(function (x) { return x.indexOf('name') !== -1; });
  if (cEmail === -1) return [];
  var byEmail = {};
  values.slice(1).forEach(function (r) {
    var email = String(r[cEmail] || '').toLowerCase().trim();
    if (!email || email.indexOf('@') === -1) return;
    var name = cName === -1 ? '' : cleanText_(r[cName], 60);
    if (/testy/i.test(name)) name = '';
    byEmail[email] = name || byEmail[email] || '';
  });
  return Object.keys(byEmail).sort().map(function (e) { return { email: e, name: byEmail[e] }; });
}

/**
 * The old Birthdays tab stored full names and dates with the year changed
 * to the current year. Keep a backup and write the new month + day layout.
 */
function convertOldBirthdays_() {
  var sh = ss_().getSheetByName(SHEETS.birthdays);
  if (!sh) { sheet_(SHEETS.birthdays, BIRTHDAY_COLS); return 'Birthdays tab created (empty).'; }
  var header = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (header.slice(0, BIRTHDAY_COLS.length).join('|') === BIRTHDAY_COLS.join('|')) return '';
  var table = sh.getDataRange().getValues();
  var parsed;
  try { parsed = parseBirthdayTable_(table); } catch (e) { parsed = { ok: [] }; }
  sh.setName(SHEETS.birthdays + ' (old)');
  var fresh = sheet_(SHEETS.birthdays, BIRTHDAY_COLS);
  if (parsed.ok.length) {
    fresh.getRange(2, 1, parsed.ok.length, BIRTHDAY_COLS.length).setValues(parsed.ok.map(function (r) {
      return [r.name, r.month, r.day, r.grade, r.homeroom];
    }));
  }
  return 'Birthdays converted to month and day only (' + parsed.ok.length +
    ' students). The old tab was kept as "Birthdays (old)" — delete it once you have checked the new one.';
}

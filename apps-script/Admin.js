/**
 * Admin tools: staff access, admins, settings, birthdays, legacy import.
 */

/* ---------------- Staff access ---------------- */

function listStaff() {
  requireAdmin_();
  return readObjects_(SHEETS.staff).map(function (r) {
    return {
      email: String(r.email).toLowerCase(),
      name: String(r.name || ''),
      status: String(r.status || 'active').toLowerCase(),
      addedBy: String(r.addedBy || ''),
      addedAt: toDateStr_(r.addedAt)
    };
  }).sort(function (a, b) {
    var order = { active: 0, removed: 1 };
    return (order[a.status] - order[b.status]) || a.email.localeCompare(b.email);
  });
}

function addStaff(email, name) {
  var me = requireAdmin_();
  email = cleanText_(email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a full email address.');
  return withLock_(function () {
    var sh = sheet_(SHEETS.staff, STAFF_COLS);
    var row = staffRow_(email);
    if (row) {
      sh.getRange(row._row, 3).setValue('active');
      if (name) sh.getRange(row._row, 2).setValue(cleanText_(name, 60));
    } else {
      sh.appendRow([email, cleanText_(name, 60), 'active', me.email, new Date()]);
    }
    return listStaff();
  });
}

function setStaffStatus(email, status) {
  requireAdmin_();
  if (['active', 'removed'].indexOf(status) === -1) throw new Error('Unknown status.');
  return withLock_(function () {
    var row = staffRow_(String(email).toLowerCase());
    if (!row) throw new Error('No staff member with that email.');
    sheet_(SHEETS.staff, STAFF_COLS).getRange(row._row, 3).setValue(status);
    return listStaff();
  });
}

/* ---------------- Admins ---------------- */

function listAdmins() {
  requireAdmin_();
  return { admins: adminList_(), owner: ownerEmail_() };
}

function addAdmin(email) {
  requireAdmin_();
  email = cleanText_(email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a full email address.');
  var list = adminList_();
  if (list.indexOf(email) === -1) list.push(email);
  setSetting_('admins', list.filter(function (e) { return e !== ownerEmail_(); }).join(', '));
  return listAdmins();
}

function removeAdmin(email) {
  requireAdmin_();
  email = String(email).toLowerCase();
  if (email === ownerEmail_()) throw new Error('The site owner is always an admin.');
  var list = adminList_().filter(function (e) { return e !== email && e !== ownerEmail_(); });
  setSetting_('admins', list.join(', '));
  return listAdmins();
}

/* ---------------- Settings ---------------- */

var EDITABLE_SETTINGS = [
  'siteTitle', 'schoolName', 'logoUrl', 'landAcknowledgement', 'oCanadaVideoUrl',
  'openingSlidesUrl', 'lunchMonitorUrl', 'staffDomain', 'studentDomain', 'refreshMinutes', 'maxPhotos'
];

function getSettingsForAdmin() {
  requireAdmin_();
  var s = settings_();
  var out = {};
  EDITABLE_SETTINGS.forEach(function (k) { out[k] = s[k] || ''; });
  return out;
}

function saveSettings(values) {
  requireAdmin_();
  ['staffDomain', 'studentDomain'].forEach(function (k) {
    if (!values.hasOwnProperty(k)) return;
    values[k] = String(values[k]).toLowerCase().replace(/^@/, '').trim();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(values[k])) throw new Error('Enter a domain like ddsb.ca.');
  });
  ['logoUrl', 'oCanadaVideoUrl', 'openingSlidesUrl', 'lunchMonitorUrl'].forEach(function (k) {
    if (values[k]) values[k] = cleanUrl_(values[k]);
  });
  EDITABLE_SETTINGS.forEach(function (k) {
    if (values.hasOwnProperty(k)) setSetting_(k, cleanText_(values[k], 4000));
  });
  return getSettingsForAdmin();
}

/* ---------------- Birthdays ---------------- */

/**
 * Reads an Excel or CSV export of the class lists.
 * First call (commit=false) returns a preview and a token; the second call
 * with that token replaces the Birthdays tab. Only a display name
 * ("Colton E."), month, day, grade and homeroom are kept — no birth year.
 */
function importBirthdays(base64, fileName, commit, token) {
  requireAdmin_();
  var cache = CacheService.getScriptCache();
  var rows;
  if (commit && token) {
    var hit = cache.get('bday:' + token);
    if (!hit) throw new Error('That preview expired. Please upload the file again.');
    rows = JSON.parse(hit);
  } else {
    rows = parseBirthdayTable_(readUploadedTable_(base64, fileName));
  }
  if (!rows.ok.length) throw new Error('No names with birth dates were found. Check that the file has a name column and a birth date column.');

  if (!commit) {
    var t = Utilities.getUuid();
    cache.put('bday:' + t, JSON.stringify(rows), 900);
    return {
      token: t,
      count: rows.ok.length,
      skipped: rows.skipped,
      columns: rows.columns,
      sample: rows.ok.slice(0, 6)
    };
  }

  return withLock_(function () {
    var sh = sheet_(SHEETS.birthdays, BIRTHDAY_COLS);
    var header = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
    if (header.join('|') !== BIRTHDAY_COLS.join('|')) {
      // An older layout: keep it as a backup, start a clean tab.
      sh.setName(SHEETS.birthdays + ' (old ' + todayStr_() + ')');
      sh = sheet_(SHEETS.birthdays, BIRTHDAY_COLS);
    }
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    var values = rows.ok.map(function (r) { return [r.name, r.month, r.day, r.grade, r.homeroom]; });
    sh.getRange(2, 1, values.length, BIRTHDAY_COLS.length).setValues(values);
    setSetting_('birthdaysUpdated', todayStr_());
    return { saved: values.length };
  });
}

function birthdayStatus() {
  requireAdmin_();
  return { count: readObjects_(SHEETS.birthdays).filter(function (r) { return r.month; }).length,
           updated: settings_().birthdaysUpdated || '' };
}

function readUploadedTable_(base64, fileName) {
  var bytes = Utilities.base64Decode(String(base64 || ''));
  var name = String(fileName || '').toLowerCase();
  if (/\.csv$/.test(name) || /\.txt$/.test(name)) {
    return Utilities.parseCsv(Utilities.newBlob(bytes).getDataAsString());
  }
  if (!/\.xlsx?$/.test(name)) throw new Error('Upload an Excel (.xlsx) or CSV file.');
  var mime = /\.xls$/.test(name) ? 'application/vnd.ms-excel'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var blob = Utilities.newBlob(bytes, mime, fileName);
  var temp = Drive.Files.create({ name: 'temp birthday import', mimeType: 'application/vnd.google-apps.spreadsheet' }, blob);
  try {
    var sheet = SpreadsheetApp.openById(temp.id).getSheets()[0];
    return sheet.getDataRange().getValues();
  } finally {
    DriveApp.getFileById(temp.id).setTrashed(true);
  }
}

/** Finds the useful columns by their header words and builds clean rows. */
function parseBirthdayTable_(table) {
  var headerIdx = -1, cols = null;
  for (var i = 0; i < Math.min(table.length, 15); i++) {
    var c = findBirthdayColumns_(table[i]);
    if (c.birth !== -1 && (c.name !== -1 || c.first !== -1)) { headerIdx = i; cols = c; break; }
  }
  if (!cols) throw new Error('Couldn\'t find a name column and a birth date column in the first rows of the file.');
  var ok = [], skipped = 0, seen = {};
  for (var r = headerIdx + 1; r < table.length; r++) {
    var row = table[r];
    var md = monthDay_(row[cols.birth]);
    var name = displayName_(row, cols);
    if (!md || !name) { if (row.some(function (v) { return String(v).trim(); })) skipped++; continue; }
    var key = name + md.month + '-' + md.day;
    if (seen[key]) continue;
    seen[key] = true;
    ok.push({
      name: name, month: md.month, day: md.day,
      grade: cols.grade !== -1 ? String(row[cols.grade]).trim() : '',
      homeroom: cols.homeroom !== -1 ? String(row[cols.homeroom]).trim() : ''
    });
  }
  var headers = table[headerIdx].map(String);
  var used = {};
  Object.keys(cols).forEach(function (k) { if (cols[k] !== -1) used[k] = headers[cols[k]]; });
  return { ok: ok, skipped: skipped, columns: used };
}

function findBirthdayColumns_(row) {
  var h = row.map(function (v) { return String(v).toLowerCase().trim(); });
  var find = function (tests, avoid) {
    for (var i = 0; i < h.length; i++) {
      if (!h[i]) continue;
      if (avoid && avoid.some(function (a) { return h[i].indexOf(a) !== -1; })) continue;
      if (tests.some(function (t) { return t instanceof RegExp ? t.test(h[i]) : h[i].indexOf(t) !== -1; })) return i;
    }
    return -1;
  };
  return {
    preferred: find(['preferred', 'usual', 'known as']),
    first: find([/^first/, 'first name', 'given'], ['preferred', 'usual']),
    last: find([/^last/, 'last name', 'surname', 'family']),
    name: find([/^name$/, 'student name', 'full name', /^student$/]),
    birth: find(['birth', 'dob', 'bday']),
    grade: find([/^grade/, 'gr.']),
    homeroom: find(['homeroom', 'home room', 'teacher', 'class', 'room'])
  };
}

/** "Colton E." from whichever name columns exist. */
function displayName_(row, cols) {
  var first = '', last = '';
  if (cols.preferred !== -1) first = String(row[cols.preferred]).trim();
  if (!first && cols.first !== -1) first = String(row[cols.first]).trim();
  if (cols.last !== -1) last = String(row[cols.last]).trim();
  if ((!first || !last) && cols.name !== -1) {
    var full = String(row[cols.name]).trim();
    if (full.indexOf(',') !== -1) {          // "Last, First Middle"
      var parts = full.split(',');
      last = last || parts[0].trim();
      first = first || parts[1].trim().split(/\s+/)[0];
    } else if (full) {                       // "First Middle Last"
      var words = full.split(/\s+/);
      first = first || words[0];
      last = last || (words.length > 1 ? words[words.length - 1] : '');
    }
  }
  first = first.split(/\s+/)[0];
  if (!first) return '';
  return last ? first + ' ' + last.charAt(0).toUpperCase() + '.' : first;
}

/** Month and day from a Date or a date-like string. Year is dropped. */
function monthDay_(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    return { month: Number(Utilities.formatDate(v, TZ, 'M')), day: Number(Utilities.formatDate(v, TZ, 'd')) };
  }
  var s = String(v).trim(), m;
  if ((m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/))) return valid_(+m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/))) {
    var a = +m[1], b = +m[2];
    return a > 12 ? valid_(b, a) : valid_(a, b); // day/month only when the first number can't be a month
  }
  if (/^\d{5}$/.test(s)) { // an Excel serial number
    var d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5);
    return valid_(d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

function valid_(month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month: month, day: day };
}

/* ---------------- Legacy Google Form import ---------------- */

/**
 * Copies rows from the old Google Form's response tab into Announcements.
 * Safe to run repeatedly: rows already copied are skipped.
 */
function importLegacy() {
  requireAdmin_();
  return importLegacy_();
}

function importLegacy_() {
  var src = ss_().getSheetByName(SHEETS.legacyForm);
  if (!src || src.getLastRow() < 2) return { imported: 0, skipped: 0 };
  return withLock_(function () {
    var values = src.getRange(1, 1, src.getLastRow(), src.getLastColumn()).getValues();
    var h = values[0].map(function (x) { return String(x).toLowerCase(); });
    var col = function (word) { for (var i = 0; i < h.length; i++) if (h[i].indexOf(word) !== -1) return i; return -1; };
    var cTime = col('timestamp'), cEmail = col('email'), cName = col('name'),
        cStart = col('first date'), cEnd = col('last date'), cCat = col('category'), cText = col('announcement');
    if (cTime === -1 || cText === -1 || cStart === -1) throw new Error('The form response tab doesn\'t have the expected columns.');

    var sh = annSheet_();
    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var already = {};
    readObjects_(SHEETS.announcements).forEach(function (r) { if (r.legacyKey) already[r.legacyKey] = true; });

    var out = [], skipped = 0;
    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      var body = cleanText_(r[cText], LIMITS.body);
      var start = toDateStr_(r[cStart]);
      var ts = r[cTime];
      var key = (ts instanceof Date ? ts.toISOString() : String(ts)) + '|' + String(r[cEmail] || '').toLowerCase();
      if (already[key]) continue;
      if (!body || !start) { skipped++; continue; }
      var end = toDateStr_(r[cEnd]) || start;
      if (end < start) end = start;
      var grades = normalizeGrades_(r[cCat]);
      var obj = {
        id: newId_(), createdAt: ts instanceof Date ? ts : new Date(), updatedAt: new Date(),
        authorEmail: String(r[cEmail] || '').toLowerCase(), authorName: cleanText_(r[cName], 60),
        title: '', body: body, grades: (grades.length ? grades : ['all']).join(','),
        staffOnly: false, important: false, startDate: start, endDate: end, daysOfWeek: '',
        linkUrl: '', linkLabel: '', videoUrl: '', photoIds: '', status: 'active', legacyKey: key
      };
      out.push(header.map(function (k) { return obj.hasOwnProperty(k) ? obj[k] : ''; }));
      already[key] = true;
    }
    if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, header.length).setValues(out);
    return { imported: out.length, skipped: skipped };
  });
}

/** While the old Google Form is still open, copy each new response across. */
function onLegacyFormSubmit() {
  importLegacy_();
}

function installLegacyFormSync() {
  requireAdmin_();
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onLegacyFormSubmit'; });
  if (!exists) ScriptApp.newTrigger('onLegacyFormSubmit').forSpreadsheet(ss_()).onFormSubmit().create();
  return { installed: true };
}

function removeLegacyFormSync() {
  requireAdmin_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onLegacyFormSubmit') ScriptApp.deleteTrigger(t);
  });
  return { removed: true };
}

function legacySyncStatus() {
  requireAdmin_();
  return { installed: ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onLegacyFormSubmit'; }) };
}

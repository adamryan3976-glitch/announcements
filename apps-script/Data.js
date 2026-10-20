/**
 * Announcements: reading, saving, and building the Today payload.
 */

var GRADE_CODES = GRADES.map(function (g) { return g.code; });
var DAY_CODES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function annSheet_() {
  return sheet_(SHEETS.announcements, ANN_COLS);
}

/** Converts an Announcements row object into a clean client object. */
function toAnn_(r) {
  var start = toDateStr_(r.startDate);
  var end = toDateStr_(r.endDate) || start;
  return {
    id: String(r.id),
    row: r._row,
    createdAt: r.createdAt ? toDateStr_(r.createdAt) : '',
    updatedAt: r.updatedAt ? toDateStr_(r.updatedAt) : '',
    authorEmail: String(r.authorEmail || '').toLowerCase(),
    authorName: String(r.authorName || ''),
    title: String(r.title || ''),
    body: String(r.body || ''),
    grades: normalizeGrades_(r.grades),
    staffOnly: isTrue_(r.staffOnly),
    important: isTrue_(r.important),
    startDate: start,
    endDate: end,
    daysOfWeek: String(r.daysOfWeek || '').split(/[\s,]+/).filter(function (d) { return DAY_CODES.indexOf(d) !== -1; }),
    linkUrl: String(r.linkUrl || ''),
    linkLabel: String(r.linkLabel || ''),
    videoUrl: String(r.videoUrl || ''),
    photoIds: String(r.photoIds || '').split(/[\s,]+/).filter(String),
    status: String(r.status || 'active'),
    legacy: !!r.legacyKey
  };
}

/** Accepts '4-6, 7-8', 'All Grades', ['all'] … and returns ordered grade codes. */
function normalizeGrades_(v) {
  var parts = Array.isArray(v) ? v : String(v || '').split(',');
  var codes = [];
  parts.forEach(function (p) {
    var s = String(p).toLowerCase().replace(/grades?/g, '').replace(/[–—]/g, '-').replace(/\s+/g, '').replace(/:$/, '');
    if (s === 'all' || s === 'allgrades' || s === '') { if (String(p).trim()) codes.push('all'); return; }
    if (GRADE_CODES.indexOf(s) !== -1) codes.push(s);
  });
  if (codes.indexOf('all') !== -1) return ['all'];
  return GRADE_CODES.filter(function (c) { return codes.indexOf(c) !== -1; });
}

function allAnnouncements_() {
  return readObjects_(SHEETS.announcements).map(toAnn_).filter(function (a) { return a.id && a.body; });
}

/** Is the announcement on today's list? */
function isActiveOn_(a, dateStr) {
  if (a.status !== 'active') return false;
  if (!a.startDate || a.startDate > dateStr || a.endDate < dateStr) return false;
  if (a.daysOfWeek.length && a.daysOfWeek.indexOf(DAY_CODES[weekday_(dateStr)]) === -1) return false;
  return true;
}

function sortForDisplay_(list) {
  return list.sort(function (a, b) {
    if (a.important !== b.important) return a.important ? -1 : 1;
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1; // newest first
    return a.row - b.row;
  });
}

/** Strips fields that viewers (students) don't need. */
function publicAnn_(a) {
  return {
    id: a.id, title: a.title, body: a.body, grades: a.grades, important: a.important,
    staffOnly: a.staffOnly, startDate: a.startDate, endDate: a.endDate,
    authorName: a.authorName, linkUrl: a.linkUrl, linkLabel: a.linkLabel,
    videoUrl: a.videoUrl, videoEmbed: a.videoUrl ? videoEmbed_(a.videoUrl) : '',
    photoIds: a.photoIds, daysOfWeek: a.daysOfWeek
  };
}

/* ------------------------------------------------------------------ */
/* Lookups: cycle day, character trait, birthdays                      */
/* ------------------------------------------------------------------ */

/** Map of yyyy-MM-dd → cycle day ('' when there is no school). */
function cycleMap_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('cycle');
  if (hit) return JSON.parse(hit);
  var sh = ss_().getSheetByName(SHEETS.cycleDays);
  var map = {};
  if (sh && sh.getLastRow() > 1) {
    var values = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    values.forEach(function (r) {
      var d = toDateStr_(r[0]);
      if (!d) return;
      map[d] = cycleNumber_(r[1]);
    });
  }
  cache.put('cycle', JSON.stringify(map), 600);
  return map;
}

/**
 * The cycle day column was given a date format by mistake, so the numbers
 * 1–5 come back as 1899-12-31 … 1900-01-04. Turn either form into 1–5.
 */
function cycleNumber_(v) {
  if (v === '' || v === null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var serial = Math.round((v.getTime() - Date.UTC(1899, 11, 30)) / 864e5);
    return serial >= 1 && serial <= 10 ? String(serial) : '';
  }
  var n = parseInt(v, 10);
  return isNaN(n) ? '' : String(n);
}

function characterTrait_(dateStr) {
  var month = Number(dateStr.slice(5, 7));
  var rows = ss_().getSheetByName(SHEETS.characterEd);
  if (!rows || rows.getLastRow() < 1) return '';
  var values = rows.getRange(1, 1, rows.getLastRow(), 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (Number(values[i][0]) === month) return String(values[i][1] || '');
  }
  return '';
}

/**
 * Birthday names for today, plus any days since the last school day
 * (weekends and holidays), so Monday covers Saturday and Sunday.
 */
function birthdaysFor_(dateStr) {
  var cycle = cycleMap_();
  var days = [dateStr];
  for (var back = 1; back <= 4; back++) {
    var d = addDays_(dateStr, -back);
    var wd = weekday_(d);
    var noSchool = wd === 0 || wd === 6 || (cycle.hasOwnProperty(d) && cycle[d] === '');
    if (!noSchool) break;
    days.push(d);
  }
  var wanted = {};
  days.forEach(function (d) { wanted[Number(d.slice(5, 7)) + '-' + Number(d.slice(8, 10))] = d; });
  var today = [], earlier = [];
  readObjects_(SHEETS.birthdays).forEach(function (r) {
    var key = Number(r.month) + '-' + Number(r.day);
    if (!wanted[key] || !r.name) return;
    (wanted[key] === dateStr ? today : earlier).push(String(r.name));
  });
  return { today: today.sort(), earlier: earlier.sort() };
}

/* ------------------------------------------------------------------ */
/* Public entry points (called from the page with google.script.run)   */
/* ------------------------------------------------------------------ */

/** Everything the page needs on first load. */
function getBootstrap() {
  var me = whoAmI_();
  var s = settings_();
  return {
    me: me,
    appUrl: ScriptApp.getService().getUrl(),
    settings: {
      siteTitle: s.siteTitle,
      schoolName: s.schoolName,
      logoUrl: s.logoUrl,
      landAcknowledgement: s.landAcknowledgement,
      oCanadaVideoUrl: s.oCanadaVideoUrl,
      openingSlidesUrl: s.openingSlidesUrl,
      lunchMonitorUrl: s.lunchMonitorUrl,
      refreshMinutes: Number(s.refreshMinutes) || 5,
      maxPhotos: Number(s.maxPhotos) || 4
    },
    grades: GRADES,
    today: getToday()
  };
}

/** Today's announcements for the signed-in user. */
function getToday(dateStr) {
  var me = whoAmI_();
  var isStaff = me.role === 'staff' || me.role === 'admin';
  var date = (isStaff && dateStr) ? toDateStr_(dateStr) || todayStr_() : todayStr_();
  var active = sortForDisplay_(allAnnouncements_().filter(function (a) { return isActiveOn_(a, date); }));
  var forStudents = active.filter(function (a) { return !a.staffOnly; }).map(publicAnn_);
  var staffNotes = isStaff ? active.filter(function (a) { return a.staffOnly; }).map(publicAnn_) : [];
  return {
    date: date,
    isToday: date === todayStr_(),
    cycleDay: cycleMap_()[date] || '',
    trait: characterTrait_(date),
    birthdays: birthdaysFor_(date),
    announcements: forStudents,
    staffNotes: staffNotes
  };
}

/** The signed-in staff member's own announcements, newest first. */
function getMine() {
  var me = requireStaff_();
  return allAnnouncements_().filter(function (a) {
    return a.status === 'active' && a.authorEmail === me.email;
  }).sort(function (a, b) { return a.startDate < b.startDate ? 1 : -1; });
}

/** Every active announcement, newest first, for the archive. */
function getArchive() {
  requireStaff_();
  return allAnnouncements_().filter(function (a) { return a.status === 'active'; })
    .sort(function (a, b) { return a.startDate === b.startDate ? b.row - a.row : (a.startDate < b.startDate ? 1 : -1); })
    .map(function (a) {
      var p = publicAnn_(a);
      p.authorEmail = a.authorEmail;
      p.daysOfWeek = a.daysOfWeek;
      p.legacy = a.legacy;
      return p;
    });
}

function getAnnouncement(id) {
  var me = requireStaff_();
  var a = findAnn_(id);
  if (!a) throw new Error('That announcement no longer exists.');
  if (me.role !== 'admin' && a.authorEmail !== me.email) throw new Error('You can only edit your own announcements.');
  return a;
}

function findAnn_(id) {
  return allAnnouncements_().filter(function (a) { return a.id === String(id); })[0] || null;
}

/**
 * Creates or updates an announcement.
 * opts.confirmDuplicate = true saves even when a matching one exists.
 */
function saveAnnouncement(input, opts) {
  var me = requireStaff_();
  opts = opts || {};
  var a = validateAnn_(input);

  return withLock_(function () {
    var existing = input.id ? findAnn_(input.id) : null;
    if (input.id && !existing) throw new Error('That announcement no longer exists.');
    if (existing && me.role !== 'admin' && existing.authorEmail !== me.email) {
      throw new Error('You can only edit your own announcements.');
    }

    if (!opts.confirmDuplicate) {
      var dup = findDuplicate_(a, existing ? existing.id : null);
      if (dup) {
        return { warning: 'duplicate', duplicate: publicAnn_(dup) };
      }
    }

    var sh = annSheet_();
    var now = new Date();
    var rowValues = {
      id: existing ? existing.id : newId_(),
      createdAt: existing ? null : now,
      updatedAt: now,
      authorEmail: existing ? existing.authorEmail : me.email,
      authorName: existing ? existing.authorName : (input.authorName ? cleanText_(input.authorName, 60) : me.name),
      title: a.title,
      body: a.body,
      grades: a.grades.join(','),
      staffOnly: a.staffOnly,
      important: a.important,
      startDate: a.startDate,
      endDate: a.endDate,
      daysOfWeek: a.daysOfWeek.join(','),
      linkUrl: a.linkUrl,
      linkLabel: a.linkLabel,
      videoUrl: a.videoUrl,
      photoIds: a.photoIds.join(','),
      status: 'active',
      legacyKey: null
    };

    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (existing) {
      var range = sh.getRange(existing.row, 1, 1, header.length);
      var current = range.getValues()[0];
      var next = header.map(function (h, i) {
        var v = rowValues[h];
        return (v === null || v === undefined) ? current[i] : v;
      });
      range.setValues([next]);
    } else {
      sh.appendRow(header.map(function (h) {
        var v = rowValues[h];
        return (v === null || v === undefined) ? '' : v;
      }));
    }
    rememberName_(me, rowValues.authorName);
    return { saved: true, id: rowValues.id };
  });
}

function validateAnn_(input) {
  var body = cleanText_(input.body, LIMITS.body);
  if (!body) throw new Error('Please write the announcement.');
  var grades = normalizeGrades_(input.grades || []);
  if (!grades.length) throw new Error('Choose who the announcement is for.');
  var start = toDateStr_(input.startDate);
  if (!start) throw new Error('Choose a start date.');
  var end = toDateStr_(input.endDate) || start;
  if (end < start) throw new Error('The last day can\'t be before the first day.');
  if (daysBetween_(start, end) > LIMITS.maxDays) throw new Error('Announcements can run for at most ' + LIMITS.maxDays + ' days.');
  var days = (input.daysOfWeek || []).filter(function (d) { return DAY_CODES.indexOf(d) !== -1; });
  var maxPhotos = Number(settings_().maxPhotos) || 4;
  var photos = (input.photoIds || []).map(String).filter(function (id) { return /^[\w-]{10,}$/.test(id); });
  if (photos.length > maxPhotos) throw new Error('Up to ' + maxPhotos + ' photos per announcement.');
  var video = cleanUrl_(input.videoUrl);
  if (video && !videoEmbed_(video)) throw new Error('Videos must be YouTube or Google Drive links.');
  return {
    title: cleanText_(input.title, LIMITS.title),
    body: body,
    grades: grades,
    staffOnly: !!input.staffOnly,
    important: !!input.important,
    startDate: start,
    endDate: end,
    daysOfWeek: days,
    linkUrl: cleanUrl_(input.linkUrl),
    linkLabel: cleanText_(input.linkLabel, LIMITS.linkLabel),
    videoUrl: video,
    photoIds: photos
  };
}

/** Same text, overlapping dates, still active → probably a double submit. */
function findDuplicate_(a, ignoreId) {
  var norm = function (s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); };
  var body = norm(a.body);
  return allAnnouncements_().filter(function (b) {
    return b.id !== ignoreId && b.status === 'active' && norm(b.body) === body &&
      b.startDate <= a.endDate && b.endDate >= a.startDate;
  })[0] || null;
}

function deleteAnnouncement(id) {
  var me = requireStaff_();
  return withLock_(function () {
    var a = findAnn_(id);
    if (!a) return { deleted: true };
    if (me.role !== 'admin' && a.authorEmail !== me.email) throw new Error('You can only delete your own announcements.');
    var sh = annSheet_();
    var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    sh.getRange(a.row, header.indexOf('status') + 1).setValue('deleted');
    sh.getRange(a.row, header.indexOf('updatedAt') + 1).setValue(new Date());
    return { deleted: true };
  });
}

/** Saves the display name a staff member uses so it is filled in next time. */
function rememberName_(me, name) {
  if (!name || !me.email) return;
  var row = staffRow_(me.email);
  if (row && String(row.name) !== name) {
    sheet_(SHEETS.staff, STAFF_COLS).getRange(row._row, STAFF_COLS.indexOf('name') + 1).setValue(name);
  }
}

/** Returns an embeddable URL for YouTube or Drive videos, or '' if unsupported. */
function videoEmbed_(url) {
  var m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
  m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{20,})/i);
  if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
  return '';
}

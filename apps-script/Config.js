/**
 * Winchester P.S. Announcements — configuration.
 *
 * Everything that changes year to year lives in the Settings tab of the
 * spreadsheet, not here. This file only names the tabs and columns.
 */

var TZ = 'America/Toronto';

var SHEETS = {
  announcements: 'Announcements',
  staff: 'Staff',
  settings: 'Settings',
  birthdays: 'Birthdays',
  characterEd: 'Character Ed',
  cycleDays: 'Cycle Days',
  legacyForm: 'Form Responses 2'
};

/** Column order of the Announcements tab. Never reorder — only append. */
var ANN_COLS = [
  'id', 'createdAt', 'updatedAt', 'authorEmail', 'authorName',
  'title', 'body', 'grades', 'staffOnly', 'important',
  'startDate', 'endDate', 'daysOfWeek',
  'linkUrl', 'linkLabel', 'videoUrl', 'photoIds',
  'status', 'legacyKey'
];

var STAFF_COLS = ['email', 'name', 'status', 'addedBy', 'addedAt'];

var BIRTHDAY_COLS = ['name', 'month', 'day', 'grade', 'homeroom'];

/** Grade groups, in display order. */
var GRADES = [
  { code: 'all', label: 'All Grades' },
  { code: '1-3', label: 'Grades 1–3' },
  { code: '4-6', label: 'Grades 4–6' },
  { code: '7-8', label: 'Grades 7–8' }
];

/** Settings keys with their defaults. Missing keys are added by setup. */
var SETTING_DEFAULTS = {
  siteTitle: 'Winchester P.S. Announcements',
  schoolName: 'Winchester Public School',
  admins: '',
  staffDomain: 'ddsb.ca',
  studentDomain: 'ddsbstudent.ca',
  photoFolderId: '',
  logoUrl: 'https://raw.githubusercontent.com/adamryan3976-glitch/announcements/main/icons/logo-512.png',
  landAcknowledgement: '',
  oCanadaVideoUrl: '',
  openingSlidesUrl: 'https://docs.google.com/presentation/d/1Lqx9RY1sD-BVpJ2YF116hvLJPAls3pqaVOrp7pr6FJw/present',
  lunchMonitorTab: 'Input',
  lunchMonitorUrl: 'https://docs.google.com/spreadsheets/d/1i5qAMYkGx1_jPN5yLYWzYxU0JOQrd4XnTdT_dDZ-wps/edit',
  refreshMinutes: '5',
  maxPhotos: '4'
};

var LIMITS = {
  title: 120,
  body: 4000,
  linkLabel: 60,
  maxDays: 200
};

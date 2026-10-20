/**
 * Winchester P.S. Announcements — web app entry point.
 *
 * The script is bound to the Winchester Announcements spreadsheet.
 * Deploy as a web app: Execute as "Me", access "Anyone within ddsb.ca".
 */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.initialView = (e && e.parameter && e.parameter.view) || '';
  return t.evaluate()
    .setTitle(settings_().siteTitle || 'Announcements')
    .setFaviconUrl('https://raw.githubusercontent.com/adamryan3976-glitch/announcements/main/icons/favicon-32.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // lets the Google Site embed it
}

/** Pulls another HTML file into a template: <?!= include('Styles') ?> */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Spreadsheet menu for the owner. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Announcements')
    .addItem('Set up or repair the sheet', 'setupSheet')
    .addItem('Copy new Google Form responses', 'menuImportLegacy')
    .addToUi();
}

function menuImportLegacy() {
  var r = importLegacy();
  SpreadsheetApp.getUi().alert('Copied ' + r.imported + ' announcements from the old form. ' +
    (r.skipped ? r.skipped + ' rows were skipped because they had no text or start date.' : ''));
}

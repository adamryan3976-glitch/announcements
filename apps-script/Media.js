/**
 * Photo uploads. Photos are resized in the browser before they get here,
 * then stored in a Drive folder owned by the script owner and shared
 * view-only with anyone in the domain who has the link.
 */

var MAX_PHOTO_BYTES = 6 * 1024 * 1024;

function photoFolder_() {
  var id = settings_().photoFolderId;
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder gone: make a new one */ }
  }
  var folder = DriveApp.createFolder('Winchester Announcements Photos');
  try {
    folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Some domains block domain-wide sharing; photos then show to signed-in owners only.
  }
  setSetting_('photoFolderId', folder.getId());
  return folder;
}

/**
 * Saves one photo and returns its Drive file id.
 * @param {string} base64 image data without the data: prefix
 * @param {string} name original file name
 * @param {string} mimeType image/jpeg, image/png, image/webp or image/gif
 */
function uploadPhoto(base64, name, mimeType) {
  var me = requireStaff_();
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].indexOf(mimeType) === -1) {
    throw new Error('Photos must be JPEG, PNG, WebP or GIF.');
  }
  var bytes = Utilities.base64Decode(String(base64 || ''));
  if (!bytes.length) throw new Error('That photo was empty.');
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('That photo is too large (6 MB max).');
  var safeName = cleanText_(name, 80).replace(/[^\w.\- ]+/g, '_') || 'photo';
  var blob = Utilities.newBlob(bytes, mimeType, Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd') + ' ' + safeName);
  var file = photoFolder_().createFile(blob);
  file.setDescription('Uploaded by ' + me.email + ' for the announcements site');
  try {
    file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { /* inherits folder sharing */ }
  return { id: file.getId() };
}

/**
 * Returns a photo as a data: URL. The page loads photos this way so they
 * show for everyone who can open the app, whatever the Drive sharing rules
 * are. Only files inside the photo folder can be read.
 */
function getPhoto(id) {
  whoAmI_(); // any signed-in user
  if (!/^[\w-]{10,}$/.test(String(id))) throw new Error('Bad photo id.');
  var file = DriveApp.getFileById(id);
  var folderId = photoFolder_().getId();
  var parents = file.getParents(), inFolder = false;
  while (parents.hasNext()) { if (parents.next().getId() === folderId) { inFolder = true; break; } }
  if (!inFolder) throw new Error('That photo is not part of the announcements site.');
  var blob = file.getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

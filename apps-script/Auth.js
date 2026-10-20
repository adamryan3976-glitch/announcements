/**
 * Who is using the app and what they may do.
 *
 *   admin   — listed in Settings "admins" (the script owner is always admin)
 *   staff   — any @ddsb.ca account (Settings "staffDomain"), unless an admin
 *             has removed them on the Staff tab
 *   viewer  — @ddsbstudent.ca accounts (Settings "studentDomain"): Today only.
 *             Also anyone whose email Google doesn't share with the script,
 *             which happens for accounts outside the owner's domain.
 *   none    — a signed-in account from any other domain: nothing
 */

function currentEmail_() {
  return String(Session.getActiveUser().getEmail() || '').toLowerCase();
}

function ownerEmail_() {
  return String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
}

function adminList_() {
  var list = String(settings_().admins || '').toLowerCase().split(/[\s,;]+/).filter(String);
  var owner = ownerEmail_();
  if (owner && list.indexOf(owner) === -1) list.unshift(owner);
  return list;
}

function staffRow_(email) {
  if (!email) return null;
  return readObjects_(SHEETS.staff).filter(function (r) {
    return String(r.email).toLowerCase().trim() === email;
  })[0] || null;
}

/** Role and display name for the current user. */
function whoAmI_() {
  var email = currentEmail_();
  var s = settings_();
  var domain = email.split('@')[1] || '';
  var staffDomain = String(s.staffDomain || 'ddsb.ca').toLowerCase().trim();
  var studentDomain = String(s.studentDomain || 'ddsbstudent.ca').toLowerCase().trim();
  var row = staffRow_(email);
  var removed = !!(row && String(row.status).toLowerCase() === 'removed');
  var role;
  if (email && adminList_().indexOf(email) !== -1) role = 'admin';
  else if (domain === staffDomain) role = removed ? 'viewer' : 'staff';
  else if (!email || domain === studentDomain) role = 'viewer';
  else role = 'none';
  var name = row && row.name ? String(row.name) : '';
  return { email: email, role: role, name: name || guessName_(email) };
}

/** Anyone from the school board may see Today; other accounts may not. */
function requireViewer_() {
  var me = whoAmI_();
  if (me.role === 'none') throw new Error('Please sign in with your DDSB school account to see the announcements.');
  return me;
}

function guessName_(email) {
  return email ? email.split('@')[0] : '';
}

function requireStaff_() {
  var me = whoAmI_();
  if (me.role !== 'staff' && me.role !== 'admin') throw new Error('Only staff can do that.');
  return me;
}

function requireAdmin_() {
  var me = whoAmI_();
  if (me.role !== 'admin') throw new Error('Only an admin can do that.');
  return me;
}

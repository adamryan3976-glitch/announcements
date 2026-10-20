/**
 * Who is using the app and what they may do.
 *
 *   admin   — listed in Settings "admins" (the script owner is always admin)
 *   staff   — active row in the Staff tab, or matches Settings "staffEmailPattern"
 *   viewer  — everyone else signed in to the domain (students): Today page only
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
  var role = 'viewer';
  var name = '';
  var row = staffRow_(email);
  if (row && row.name) name = String(row.name);
  if (email && adminList_().indexOf(email) !== -1) {
    role = 'admin';
  } else if (row && String(row.status).toLowerCase() === 'active') {
    role = 'staff';
  } else {
    var pattern = settings_().staffEmailPattern;
    if (email && pattern) {
      try { if (new RegExp(pattern, 'i').test(email)) role = 'staff'; } catch (e) { /* bad pattern: ignore */ }
    }
  }
  var pending = !!(row && String(row.status).toLowerCase() === 'pending');
  return { email: email, role: role, name: name || guessName_(email), pending: pending };
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

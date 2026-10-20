# Winchester P.S. Announcements

The daily announcements site for Winchester Public School. Staff post announcements (with links, photos and videos); classrooms open **Today** or press **Present to class** to show them full screen.

It is a Google Apps Script web app bound to the **Winchester Announcements Sheet**, so all data stays in the school's Google Workspace. The code lives here and is pushed to Apps Script with [clasp](https://github.com/google/clasp).

## What's in it

| Page | Who sees it | What it does |
|---|---|---|
| Today | Everyone at ddsb.ca | Date, cycle day, character trait, birthdays, Land Acknowledgement / O Canada, and announcements grouped by grade. A grade filter is remembered per device. Refreshes every few minutes. |
| Present to class | Everyone | Full-screen slides: opening, a cover slide with the day's facts, then one announcement per slide. Arrow keys, space, or click to advance; Esc to close. |
| New announcement | Staff | One form with a live preview. Grades, first/last day (with "Today only", "Until Friday"), optional weekdays, important, staff only, website link, YouTube/Drive video, up to 4 photos (resized in the browser before upload). Warns about duplicates. |
| My announcements | Staff | Showing now / Upcoming / Past, with Edit, Duplicate and Delete. |
| All announcements | Staff | Search everything ever posted, by words, grade or author. |
| Admin | Admins | Approve staff, add or remove staff and admins, upload the birthday list from the LMS export, site settings, and copying from the old Google Form. |

Students only ever see Today and Present. Staff-only notes never reach a student's browser.

### Who is staff?
- Everyone who has posted through the old Google Form is added as staff by setup.
- An admin can add people on the Staff tab.
- Anyone else at ddsb.ca who is signed in sees a "Staff? Get access to post" link; their request waits on Admin until approved.
- Optionally, set **Treat these emails as staff** in Settings to a pattern that only matches staff addresses.

The sheet owner is always an admin and can invite more admins.

## Sheet tabs

Setup adds these and leaves the existing tabs in place:

- **Announcements**: one row per announcement. Dates are stored as text (`2026-10-20`) so they can't drift. Deleting from the site marks a row `deleted` rather than removing it.
- **Staff**: email, name, status (`active` / `pending` / `removed`).
- **Settings**: key/value pairs, edited from Admin → Settings.
- **Birthdays**: name shown as "First L.", month, day, grade, homeroom. No birth years are stored.
- **Cycle Days** and **Character Ed** are read as they are today.

## First-time setup

Do this on a **copy** of the sheet first and try it for a few days.

1. **Install clasp** (needs Node 18+):
   ```bash
   npm install -g @google/clasp
   clasp login            # sign in with your ddsb.ca account
   ```
   Turn on the Apps Script API at <https://script.google.com/home/usersettings>.
2. **Create the script project from the sheet**: open the sheet → Extensions → Apps Script. In Project Settings, copy the Script ID.
3. **Link this repo**: copy `.clasp.json.example` to `.clasp.json` and paste the Script ID into it.
4. **Push the code**:
   ```bash
   clasp push
   ```
5. **Run setup**: reload the sheet. In the new **Announcements** menu, choose **Set up or repair the sheet** and approve the permissions. It:
   - creates the new tabs;
   - fixes the Cycle Days numbers;
   - converts birthdays to month and day only, keeping the old tab as a backup;
   - copies every old form response into Announcements.
6. **Deploy**: in the Apps Script editor, Deploy → New deployment → Web app.
   - Execute as: **Me**
   - Who has access: **Anyone within DDSB**
7. **Add the site details**: open the web app URL → Admin → Settings. Paste the Knights logo link and the Land Acknowledgement text, and the O Canada video link if you want it in Present mode.
8. **Embed it in the Google Site**: on the Today page, Insert → Embed → By URL, then paste the web app URL. You can also link the URL straight from classroom bookmarks.

### While the old form is still in use
Admin → Old Google Form → **Copy automatically on each response** keeps new form submissions flowing into the site. Turn it off once everyone is posting through the new form.

### Updating the code later
```bash
git pull
clasp push
```
Then Deploy → Manage deployments → edit the existing deployment → Version: New version. This keeps the same URL.

## Birthdays
Export the class list from the LMS as Excel, including student name and birth date columns. Then go to Admin → Birthdays → choose the file → **Check the file**. Look over the preview, then click **Replace the birthday list**. Name columns are found automatically: "First name", "Last name", "Preferred name", "Student name", "Birth date", "DOB" and similar (a preferred name is used when there is one). Birthdays on weekends or other days without a cycle day show on the next school day.

## Previewing the design locally
```bash
python3 preview/build.py
open preview/index.html            # add ?role=viewer to see the student view
```
This uses sample data in `preview/mock.html`; nothing connects to Google.

## Files
- `apps-script/Code.js`: web app entry point and sheet menu.
- `apps-script/Data.js`: Today, saving, and the archive.
- `apps-script/Admin.js`: staff, admins, settings, birthdays, and the old-form import.
- `apps-script/Media.js`: photo uploads (kept in a Drive folder "Winchester Announcements Photos").
- `apps-script/Auth.js`: who is signed in and what they can do.
- `apps-script/Setup.js`: one-time setup and repair.
- `apps-script/Index.html`, `Styles.html`, `App.html`: the page.
- `index.html`: the earlier GitHub Pages prototype. Kept for reference only.

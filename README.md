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
The site goes by the email address people are signed in with:
- **@ddsb.ca** accounts are staff and can post.
- **@ddsbstudent.ca** accounts are students and see Today and Present only.
- Accounts from anywhere else are turned away.

An admin can stop a particular staff account from posting on Admin → Staff. The domains can be changed in Admin → Settings.

The sheet owner is always an admin and can invite more admins.

## Sheet tabs

Setup adds these and leaves the existing tabs in place:

- **Announcements**: one row per announcement. Dates are stored as text (`2026-10-20`) so they can't drift. Deleting from the site marks a row `deleted` rather than removing it.
- **Staff**: staff who have posted, with the name they use and a status (`active` / `removed`).
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
   - **Then check it with a student account.** If ddsbstudent.ca is part of the same Google Workspace as ddsb.ca, students will see Today and you're done. If a student gets "You need access", ddsbstudent.ca is a separate Workspace. In that case, change the setting to **Anyone with a Google account**. Staff are still recognised and need nothing extra. The catch is that Google doesn't tell the script who students from the other Workspace are, so it can't tell them apart from someone signed in with a personal Gmail. Anyone with the link who is signed in to Google could then see Today, including the birthday names (first name and last initial). Staff pages and staff-only notes stay protected either way.
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

## Web address (announcements.winchesterps.ca)
GitHub Pages serves `index.html` at **announcements.winchesterps.ca**. The page shows the Google web app full-screen, so the address bar keeps the school's address. The `CNAME` file holds the domain.

- **Setup:** DNS for winchesterps.ca needs a CNAME record from `announcements` to `adamryan3976-glitch.github.io`. In the repo's Settings → Pages, turn on **Enforce HTTPS**.
- **Changing the web app:** if you ever make a *new* deployment (rather than a new version of the existing one), its address changes. Update `APP_URL` in `index.html`.
- **Opening a page directly:** `?view=new` and the like are passed through, e.g. `announcements.winchesterps.ca/?view=new` opens the new-announcement form.
- **"Not loading? Open directly":** Google won't show its sign-in screen inside another page, and Safari can block sign-in there. Anyone who sees a blank page or keeps being asked to sign in can tap the button in the corner to open the app on Google's own address.

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
- `index.html`: GitHub Pages launcher. Gives the site its Knights favicon and home-screen icon, then opens the web app.
- `icons/`, `manifest.webmanifest`: favicon, app and home-screen icons.

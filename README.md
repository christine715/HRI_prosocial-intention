# Robot Assistance Study — Web Platform

A static, no-build web app for running the two-study HRI trust experiment
described in the IRB protocol. Deploys for free on GitHub Pages.

## What it does

1. Consent → demographics.
2. Randomly orders the two HRI settings (social-care, industrial).
3. For each setting: plays the context video once, then runs Study 1's
   three motivation conditions (order independently randomized) and
   Study 2's two orientation conditions (order independently randomized),
   each as **manipulation video → full 35-item questionnaire**.
4. 10 trials total per participant, each with its own survey.
5. At the end: downloads JSON + CSV, and (optionally) POSTs the data to a
   server you configure.

Condition labels (e.g. "empathy-driven", "egoistic") are **never shown**
to participants — only generic "Scenario n of 10" labels appear on
screen, to avoid tipping them off to the manipulation. The real condition
IDs are still recorded in the exported data.

## File structure

```
index.html          entry point
css/style.css        all styling
js/config.js          <- EDIT THIS: video paths, condition labels, questionnaire text
js/app.js             app logic (randomization, screens, data export) — shouldn't need edits
videos/               put your .mp4 files here (see videos/README.txt)
```

## 1. Add your videos

See `videos/README.txt` for the exact 12 filenames expected. Drop your
`.mp4` files straight into the `videos/` folder with those names, or
edit `js/config.js` if you'd rather keep your own naming.

## 2. Deploy to GitHub Pages

1. Create a new GitHub repo and push this folder's contents to it:
   ```
   git init
   git add .
   git commit -m "Robot trust study platform"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source → Deploy from a branch → main / (root)**.
3. Your study will be live at `https://<you>.github.io/<repo>/` within a
   few minutes. This is the link you send to participants.

If videos are large, GitHub Pages / repos aren't a great home for them —
see the note at the bottom of `videos/README.txt` about hosting video
files elsewhere and pointing the config at those URLs instead.

## 3. Collecting data centrally (optional but recommended)

GitHub Pages is a **static** host — there's no server to receive and
store submissions automatically. Two ways to actually collect data
across many participants:

**Option A — manual (default, zero setup)**
Each participant downloads a JSON and CSV file when they finish. You'd
need to ask participants to email these back to you, which is fine for
small in-person/lab-adjacent samples but not for anonymous online
recruitment.

**Option B — Google Sheet via Apps Script (recommended, free, ~10 min setup)**
1. Create a new Google Sheet.
2. Extensions → Apps Script. Paste:
   ```javascript
   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     sheet.appendRow([new Date(), e.postData.contents]);
     return ContentService.createTextOutput('ok');
   }
   ```
3. Deploy → New deployment → type **Web app** → execute as **Me**, access
   **Anyone**. Copy the deployment URL.
4. Paste that URL into `CONFIG.SUBMIT_URL` in `js/config.js`.
5. Each participant's full JSON payload will now also land as a new row
   in your sheet (in a single cell — use a formula or script to expand
   it into columns, or just re-parse the JSON column in R/Python/Excel
   at analysis time). Participants still get the local download too, so
   nothing is lost if the network call fails.

## Data format

`payload` per participant:
```json
{
  "participant_id": "P-...",
  "started_at": "...",
  "finished_at": "...",
  "demographics": { "age": "...", "gender": "...", ... },
  "trials": [
    {
      "trial_index": 1,
      "study": 1,
      "setting_id": "social_care",
      "condition_id": "empathy",
      "completed_at": "...",
      "answers": { "ti1": 6, "ti2": 7, ... }
    },
    ...
  ]
}
```

The downloaded CSV is long-format (one row per trial × questionnaire
item), with reverse-scored items (`ci2`) automatically recoded in a
`recoded_value` column alongside the raw response, for easy import into
SPSS/R/Python for the repeated-measures ANOVAs described in the
protocol.

## Item ↔ construct reference

| Section | Item IDs | Construct |
|---|---|---|
| Trust & Continued Interaction | ti1–ti3 | Behavioral Trust Intention |
| Trust & Continued Interaction | ci1–ci3 | Desire for Continued Interaction (ci2 reverse-scored) |
| Ability & Benevolence | ab1–ab6 | Ability (ABI) |
| Ability & Benevolence | bv1–bv5 | Benevolence (ABI) |
| Perceived Motivation | m1–m9 | Manipulation check (autonomous vs. controlled) |
| Perceived Altruism & Egoism | al1–al4 | Altruism |
| Perceived Altruism & Egoism | eg1–eg5 | Egoism |

## Local testing before deploying

Browsers block `file://` video/script loading in some cases, so serve it
locally instead of double-clicking `index.html`:
```
cd robot-trust-study
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

## Notes / things to double check before real data collection

- The protocol calls for N=70 (35/study) — this app doesn't route
  participants into "Study 1 only" vs "Study 2 only"; it runs a
  participant through **both** studies' conditions within each setting,
  matching the flow you described. If you actually want between-subjects
  study assignment instead, that's a small change to `buildSequence()`
  in `js/app.js` — ask and I can wire that in.
- No server-side attention/engagement checks are enforced beyond
  "video must finish playing once" and "all 35 items answered."
- Consider adding your full IRB-approved information sheet text into
  `CONFIG.CONSENT_TEXT` before going live.

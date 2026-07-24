/**
 * Vinterior Wars — shared leaderboard backend (Google Apps Script).
 *
 * Setup (one-off, ~5 minutes — full steps in README.md):
 *   1. Create a Google Sheet (this is where scores land).
 *   2. Extensions → Apps Script, replace the default code with this file, save.
 *   3. Deploy → New deployment → type "Web app":
 *        Execute as: Me · Who has access: Anyone
 *   4. Authorise when prompted, copy the Web app URL, and paste it into
 *      LEADERBOARD_URL near the top of index.html.
 *
 * The game POSTs {name, score, code} as JSON. The code is a checksum the game
 * computes from the name + score; scoreCode() below recomputes it, so casual
 * tampering (posting a made-up score with the wrong code) is rejected.
 */

const SHEET_NAME = 'Scores';

function doGet() {
  return json({ ok: true, top: topScores(10) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(5000);
  try {
    const d = JSON.parse(e.postData.contents);
    const name = String(d.name || '').trim().slice(0, 24);
    const score = Math.round(Number(d.score));
    const code = String(d.code || '').trim().toUpperCase();
    if (!name || !isFinite(score)) return json({ ok: false, error: 'Missing name or score.' });
    if (code !== scoreCode(name, score)) return json({ ok: false, error: 'Score code does not match.' });
    sheet().appendRow([new Date(), name, score, code]);
    return json({ ok: true, top: topScores(10) });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['When', 'Name', 'Score', 'Code']);
  }
  return sh;
}

// best score per person (case-insensitive name), highest first
function topScores(n) {
  const sh = sheet();
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, 3).getValues() : [];
  const best = {};
  for (const row of rows) {
    const name = String(row[1]);
    const score = Number(row[2]);
    const key = name.trim().toLowerCase();
    if (!(key in best) || score > best[key].score) best[key] = { name: name, score: score };
  }
  return Object.keys(best).map(k => best[k])
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---- must produce identical output to scoreCode() in index.html ---- */

function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function scoreCode(name, net) {
  return 'VW-' + (net < 0 ? 'N' : '') + Math.abs(net).toString(36).toUpperCase() +
    '-' + hashStr(name.trim().toLowerCase() + '|' + net + '|vinterior-wars-2026').toUpperCase();
}

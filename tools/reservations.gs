/**
 * Reservations for the wishlist ("Ich besorge das").
 *
 * Runs as a Google Apps Script web app attached to a Google Sheet; the sheet
 * keeps one row per reserved wish. Setup steps are in the README.
 *
 *   GET  ?action=list                         -> { ok, reservations: { key: { name, at } } }
 *   POST {action:"reserve", key, name, token} -> { ok } or { ok:false, error:"taken" }
 *   POST {action:"release", key, token}       -> { ok } or { ok:false, error:"not-yours" }
 *
 * The token is a random secret kept in the buyer's browser, so only the person
 * who reserved a wish can undo it. Tokens never leave this sheet.
 */

const SHEET = "Reservierungen";
const HEADER = ["Wunsch", "Name", "Datum", "Token"];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_() {
  const values = sheet_().getDataRange().getValues();
  return values.slice(1).map((r, i) => ({ row: i + 2, key: String(r[0]), name: String(r[1]), at: r[2], token: String(r[3]) }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function list_() {
  const reservations = {};
  rows_().forEach((r) => {
    if (r.key) reservations[r.key] = { name: r.name, at: r.at instanceof Date ? r.at.toISOString() : String(r.at) };
  });
  return { ok: true, reservations };
}

function doGet() {
  return json_(list_());
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "bad-request" });
  }
  const key = String(req.key || "");
  const token = String(req.token || "");
  if (!/^[\w:.-]{1,120}$/.test(key) || token.length < 16 || token.length > 100) {
    return json_({ ok: false, error: "bad-request" });
  }

  // One change at a time, so two people can't reserve the same wish at once.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = rows_().find((r) => r.key === key);
    if (req.action === "reserve") {
      if (existing) return json_({ ok: false, error: existing.token === token ? "already-yours" : "taken" });
      const name = String(req.name || "").replace(/[\r\n\t]/g, " ").trim().slice(0, 40);
      // A leading quote keeps names such as "=1+1" plain text in the sheet.
      sheet_().appendRow([key, name ? "'" + name : "", new Date(), token]);
      return json_({ ok: true });
    }
    if (req.action === "release") {
      if (!existing) return json_({ ok: true });
      if (existing.token !== token) return json_({ ok: false, error: "not-yours" });
      sheet_().deleteRow(existing.row);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: "bad-request" });
  } finally {
    lock.releaseLock();
  }
}

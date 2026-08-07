const https = require("https");
const XLSX = require("xlsx");

function parseGoogleSheetLink(link) {
  if (!link) {
    throw new Error("GOOGLE_SHEET_URL is not configured.");
  }

  let parsed;
  try {
    parsed = new URL(link);
  } catch {
    throw new Error("GOOGLE_SHEET_URL is not a valid URL.");
  }

  const match = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match) {
    throw new Error("GOOGLE_SHEET_URL must be a Google Sheets URL.");
  }

  const spreadsheetId = match[1];
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const gid = parsed.searchParams.get("gid") || hashParams.get("gid") || "0";

  return { spreadsheetId, gid };
}

function createCsvExportUrl(link) {
  const { spreadsheetId, gid } = parseGoogleSheetLink(link);
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

function downloadBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "lead-tracking-sync/1.0",
          Accept: "text/csv,application/octet-stream,*/*",
        },
        timeout: 30000,
      },
      (response) => {
        const status = response.statusCode || 0;

        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          if (!response.headers.location || redirectsLeft <= 0) {
            reject(new Error("Too many redirects while downloading Google Sheet."));
            return;
          }
          const nextUrl = new URL(response.headers.location, url).toString();
          resolve(downloadBuffer(nextUrl, redirectsLeft - 1));
          return;
        }

        if (status < 200 || status >= 300) {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8").slice(0, 300);
            reject(
              new Error(
                `Google Sheet download failed with HTTP ${status}. ` +
                  "Make sure the sheet is shared as 'Anyone with the link - Viewer'. " +
                  body
              )
            );
          });
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Google Sheet download timed out after 30 seconds."));
    });
    request.on("error", reject);
  });
}

async function fetchGoogleSheetRows(link) {
  const exportUrl = createCsvExportUrl(link);
  const buffer = await downloadBuffer(exportUrl);

  if (!buffer.length) {
    throw new Error("Google Sheet returned an empty response.");
  }

  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("No worksheet was found in the Google Sheet response.");
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: null,
    raw: false,
  });
}

module.exports = {
  parseGoogleSheetLink,
  createCsvExportUrl,
  fetchGoogleSheetRows,
};

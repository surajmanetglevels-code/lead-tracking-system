/**
 * Normalizes a phone value from EITHER side (MongoDB stores it as a clean
 * string like "9967352148"; Excel often stores it as a float like
 * 8431388535.0, sometimes with a leading 91/0 or formatting characters) down
 * to a plain 10-digit string, so both sides can be joined reliably.
 *
 * Returns null if the value can't be reduced to a usable 10-digit number.
 */
function normalizePhone(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  let s = String(raw).trim();
  s = s.replace(/\.0$/, ""); // Excel float artifact, e.g. "9876543210.0"
  s = s.replace(/[^\d]/g, ""); // strip +, spaces, dashes, parentheses
  if (s.length > 10) s = s.slice(-10); // drop country code (91) or leading 0
  if (s.length !== 10) return null;
  return s;
}

module.exports = { normalizePhone };

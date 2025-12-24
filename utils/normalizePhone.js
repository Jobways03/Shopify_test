module.exports = function normalizePhone(phone) {
  if (!phone) return null;

  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("+91")) {
    return cleaned;
  }

  return `+${cleaned}`;
};

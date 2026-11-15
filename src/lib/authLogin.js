// The app asks for a login; the platform's account identifier is an email address,
// so a login typed without a domain is completed with the company domain.
const DEFAULT_DOMAIN = "modustrade.kz";

export function toEmail(login) {
  const value = String(login ?? "").trim().toLowerCase();
  if (!value) return "";
  return value.includes("@") ? value : `${value}@${DEFAULT_DOMAIN}`;
}

export function isEmailLike(login) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(login ?? "").trim());
}

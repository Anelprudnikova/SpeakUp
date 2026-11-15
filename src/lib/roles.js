// Effective role for the UI: administrator, head of departments, employee
// or client manager. Legacy values are mapped onto the same four roles.
export function getStaffRole(user) {
  if (!user) return "employee";
  if (user.role === "admin") return "admin";
  const org = user.system_role || user.access_level;
  if (org === "admin") return "admin";
  if (org === "head" || user.access_level === "head") return "head";
  if (org === "client_manager" || user.staff_role === "client_manager") return "client_manager";
  if (user.staff_role === "chief" || user.staff_role === "manager") return "head";
  return "employee";
}

// The four organisation roles offered by the administrator in both selects.
export const ORG_ROLES = ["employee", "admin", "head", "client_manager"];

// Client accounts live in their own cabinet and never see the internal interface.
export function isClient(user) {
  return user?.account_type === "client";
}

export function isClientManager(user) {
  const role = getStaffRole(user);
  return role === "client_manager" || role === "admin";
}

// Client-facing request statuses, in the order a request moves through them.
export const CLIENT_STATUSES = [
  "received",
  "in_work",
  "clarification",
  "handed_off",
  "awaiting_internal",
  "answer_ready",
  "resolved",
  "closed",
];

export const CLIENT_STATUS_STYLES = {
  received: "bg-[#4263EB]/10 text-[#4263EB] border-[#4263EB]/20",
  in_work: "bg-[#7957E8]/10 text-[#7957E8] border-[#7957E8]/20",
  clarification: "bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/25",
  handed_off: "bg-slate-500/10 text-slate-600 border-slate-400/25",
  awaiting_internal: "bg-[#0EA5E9]/10 text-[#0369A1] border-[#0EA5E9]/20",
  answer_ready: "bg-[#20AFA4]/12 text-[#158078] border-[#20AFA4]/25",
  resolved: "bg-[#20AFA4]/12 text-[#158078] border-[#20AFA4]/25",
  closed: "bg-slate-500/10 text-slate-600 border-slate-400/25",
};

export const CLIENT_TYPES = ["question", "complaint", "suggestion", "gratitude", "other"];

// Full control over a request: review, assign, close, reject.
export function canManage(user) {
  const r = getStaffRole(user);
  return r === "head" || r === "admin";
}

export function isChief(user) {
  return getStaffRole(user) === "head";
}

// Statuses stored in the database (filters and badges), in workflow order.
export const STATUSES = ["new", "review", "inProgress", "implemented", "waiting", "rejected", "closed"];
// The working flow a request goes through, in order.
export const WORKFLOW_STATUSES = ["new", "review", "inProgress", "implemented", "waiting", "rejected", "closed"];

export const TYPES = ["improvement", "problem", "idea", "question", "gratitude", "other"];
export const PRIORITIES = ["low", "medium", "high"];
export const CATEGORY_KEYS = [
  "procurement",
  "sales",
  "design",
  "finance",
  "hr",
  "internal",
  "documents",
  "it",
  "conditions",
  "communications",
  "other",
];

export const STATUS_STYLES = {
  new: "bg-[#4263EB]/10 text-[#4263EB] border-[#4263EB]/20",
  review: "bg-[#7957E8]/10 text-[#7957E8] border-[#7957E8]/20",
  inProgress: "bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/25",
  waiting: "bg-[#0EA5E9]/10 text-[#0369A1] border-[#0EA5E9]/20",
  rework: "bg-[#F97316]/10 text-[#C2410C] border-[#F97316]/25",
  implemented: "bg-[#20AFA4]/12 text-[#158078] border-[#20AFA4]/25",
  rejected: "bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/20",
  closed: "bg-slate-500/10 text-slate-600 border-slate-400/25",
};

export const PRIORITY_STYLES = {
  low: "bg-slate-500/10 text-slate-600 border-slate-400/20",
  medium: "bg-[#4263EB]/10 text-[#4263EB] border-[#4263EB]/20",
  high: "bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/20",
};

// Category names are stored in three languages; show the chosen one with fallbacks.
// Accepts a stored category (name_ru…) and a serialized one ({ru, kk, en}).
export function categoryName(source, lang) {
  if (!source) return "—";
  return (
    source[`name_${lang}`] ||
    source[lang] ||
    source.name_ru ||
    source.ru ||
    source.name_en ||
    source.en ||
    source.name_kk ||
    source.kk ||
    "—"
  );
}

export function formatDate(value, lang) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-GB" : "ru-RU";
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Oral" });
}

// A person's short name: surname and given name, without the patronymic.
export function shortPersonName(value) {
  if (!value) return "";
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return parts.join(" ");
  return `${parts[0]} ${parts[1]}`;
}

export function formatDateTime(value, lang) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-GB" : "ru-RU";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Oral",
  });
}

// Server-only access rules for SpeakUp.
// Four roles: administrator, department head (one or several departments),
// employee and client manager. A request executor is a plain employee who was
// assigned a request — never a separate role.

export async function listAll(sb, entity, sort = "-created_date", limit = 500) {
  const res = await sb.entities[entity].list(sort, limit);
  return Array.isArray(res) ? res : res?.items ?? [];
}

export const ORG_ROLES = ["employee", "admin", "head", "client_manager"];

export function fullNameOf(record) {
  const composed = [record?.last_name, record?.first_name, record?.middle_name].filter(Boolean).join(" ").trim();
  return composed || record?.full_name || record?.email || "";
}

// The organisation role decides what a person may do inside the app.
function resolveRole(me, record) {
  if (me.role === "admin") return "admin";
  const org = record?.system_role || record?.access_level;
  if (org === "admin") return "admin";
  if (org === "head") return "head";
  if (org === "client_manager") return "client_manager";
  // Legacy values from the earlier access model.
  if (record?.staff_role === "chief" || record?.staff_role === "manager") return "head";
  if (record?.access_level === "head") return "head";
  return "employee";
}

export async function loadViewer(context) {
  const me = context.user;
  const sb = context.getBase44().asServiceRole;
  let record = null;
  let departments = [];
  try {
    const [res, depts] = await Promise.all([
      sb.entities.User.filter({ email: me.email }),
      listAll(sb, "Department", "created_date"),
    ]);
    record = Array.isArray(res) ? res[0] : res?.items?.[0];
    departments = depts;
  } catch {
    record = null;
  }
  const role = resolveRole(me, record);
  const headed = departments.filter(
    (d) =>
      (Array.isArray(d.manager_emails) && d.manager_emails.includes(me.email)) ||
      d.manager_email === me.email
  );
  const managedDepartmentIds = role === "admin" ? departments.map((d) => d.id) : headed.map((d) => d.id);
  const name = fullNameOf(record) || me.full_name || me.email;
  return {
    id: me.id,
    email: me.email,
    name,
    firstName: record?.first_name || "",
    lastName: record?.last_name || "",
    middleName: record?.middle_name || "",
    role,
    accountType: record?.account_type || "staff",
    departmentId: record?.department_id || "",
    managedDepartmentIds,
    // A department head is whoever runs a department — his system role stays as it is.
    managesDepartments: managedDepartmentIds.length > 0,
    position: record?.position || "",
    language: record?.language || "ru",
    accountStatus: record?.account_status || "active",
    isPlatformAdmin: me.role === "admin",
  };
}

export async function clientUsers(sb) {
  const users = await listAll(sb, "User", "created_date", 300);
  return users.filter((u) => u.account_status !== "blocked");
}

// Employees of one department — the only people a head may assign work to.
export async function departmentStaff(sb, departmentId) {
  if (!departmentId) return [];
  const users = await clientUsers(sb);
  return users.filter(
    (u) => u.account_type !== "client" && u.department_id === departmentId && u.role !== "admin"
  );
}

export function headsOfDepartment(department) {
  if (!department) return [];
  const list = Array.isArray(department.manager_emails) ? department.manager_emails : [];
  return [...new Set([...list, department.manager_email].filter(Boolean))];
}

export function isClosedStatus(status) {
  return ["implemented", "rejected", "closed"].includes(status);
}

export function isDeleted(req) {
  return !!req?.is_deleted;
}

// A deleted request disappears from every working list; only administrators see it.
export function isVisibleRequest(viewer, req) {
  if (!req) return false;
  if (!isDeleted(req)) return true;
  return viewer?.role === "admin";
}

// Author, executor, department head of the request's department, or administrator.
export function canViewRequest(viewer, req) {
  if (!viewer || !req) return false;
  if (viewer.role === "admin") return true;
  if (req.author_email && req.author_email === viewer.email) return true;
  if (req.assignee_email && req.assignee_email === viewer.email) return true;
  if (viewer.managesDepartments && req.department_id && viewer.managedDepartmentIds.includes(req.department_id)) {
    return true;
  }
  return false;
}

// Distribute, assign an executor, set deadlines, close or return for rework.
export function canManageRequest(viewer, req) {
  if (!viewer || !req) return false;
  if (viewer.role === "admin") return true;
  if (viewer.managesDepartments && req.department_id && viewer.managedDepartmentIds.includes(req.department_id)) {
    return true;
  }
  return false;
}

// Client requests: the client queue side, the author himself, and the head of the
// department the manager forwarded the request to (nobody else).
export function canViewClientRequest(viewer, item) {
  if (!viewer || !item) return false;
  if (viewer.role === "admin" || viewer.role === "client_manager") return true;
  if (item.author_email && item.author_email === viewer.email) return true;
  // The employee who was appointed to do the work reads the same card.
  if (item.assignee_email && item.assignee_email === viewer.email) return true;
  if (viewer.managesDepartments && item.department_id && viewer.managedDepartmentIds.includes(item.department_id)) {
    return true;
  }
  return false;
}

// The head distributes client work inside his own department; the administrator in all.
export function canManageClientItem(viewer, item) {
  if (!viewer || !item) return false;
  if (viewer.role === "admin") return true;
  if (viewer.managesDepartments && item.department_id && viewer.managedDepartmentIds.includes(item.department_id)) {
    return true;
  }
  return false;
}

// Who may write an answer on a client request: the client manager, the head of the
// department it was forwarded to, and the employee appointed to do the work.
export function canReplyClientItem(viewer, item) {
  if (!viewer || !item) return false;
  if (viewer.role === "admin" || viewer.role === "client_manager") return true;
  if (viewer.managesDepartments && item.department_id && viewer.managedDepartmentIds.includes(item.department_id)) {
    return true;
  }
  return !!item.assignee_email && item.assignee_email === viewer.email;
}

// The appointed employee works the client request while it is still open.
export function canWorkClientItem(viewer, item) {
  if (!viewer || !item) return false;
  if (!item.assignee_email || item.assignee_email !== viewer.email) return false;
  return !["resolved", "closed"].includes(item.status);
}

export function canManageDepartment(viewer, departmentId) {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  return !!departmentId && viewer.managedDepartmentIds.includes(departmentId);
}

// A head who took the request himself executes only this one request.
export function isSelfExecution(viewer, req) {
  if (!viewer || !req) return false;
  return (
    viewer.managesDepartments &&
    !!req.assignee_email &&
    req.assignee_email === viewer.email &&
    canManageRequest(viewer, req)
  );
}

// The executor works the request: working statuses and the implementation result.
export function canWorkRequest(viewer, req) {
  if (!viewer || !req) return false;
  // Administrators distribute; the executor is whoever is assigned, employee or head.
  if (viewer.role === "admin") return false;
  if (!req.assignee_email || req.assignee_email !== viewer.email) return false;
  // Implemented is handed back to the head for verification; closed is final.
  return !isClosedStatus(req.status) && req.status !== "implemented";
}

// A head who executes the request himself confirms his own work — no second review.
export function canSelfCloseRequest(viewer, req) {
  if (!viewer || !req) return false;
  if (!isSelfExecution(viewer, req)) return false;
  // Implemented is his own finishing step; closed and rejected are final.
  return !["closed", "rejected"].includes(req.status);
}

// A head may take the request himself only while nobody else is assigned to it.
export function canSelfExecuteRequest(viewer, req) {
  if (!viewer || !req) return false;
  if (!viewer.managesDepartments) return false;
  if (!canManageRequest(viewer, req)) return false;
  if (isClosedStatus(req.status)) return false;
  return !req.assignee_email || req.assignee_email === viewer.email;
}

// The executor may take a submitted request back from review while the head
// has not decided yet. Once the head closed or rejected it, nothing is changeable.
export function canWithdrawReview(viewer, req) {
  if (!viewer || !req) return false;
  if (!req.assignee_email || req.assignee_email !== viewer.email) return false;
  if (req.status !== "implemented") return false;
  // A head who executes himself confirms his own work below — he does not withdraw.
  return !isSelfExecution(viewer, req);
}

// Verification belongs to the head who did not execute the request himself.
export function canReviewRequest(viewer, req) {
  if (!viewer || !req) return false;
  if (!canManageRequest(viewer, req)) return false;
  if (isSelfExecution(viewer, req)) return false;
  return req.status === "implemented";
}

// Deletion is physical: administrator, head of the department, or the author
// before the work started. An executor never deletes the request handed to him.
export function canDeleteRequest(viewer, req) {
  if (!viewer || !req) return false;
  if (viewer.role === "admin") return true;
  if (req.assignee_email && req.assignee_email === viewer.email) return false;
  if (viewer.managesDepartments && req.department_id && viewer.managedDepartmentIds.includes(req.department_id)) {
    return true;
  }
  const byAuthor = !!req.author_email && req.author_email === viewer.email;
  if (byAuthor && isUntouched(req)) return true;
  return false;
}

// "Before processing started": nothing answered, nobody assigned, status fresh.
export function isUntouched(req) {
  if (!req) return false;
  return ["new", "review"].includes(req.status) && !req.first_response_at && !req.assignee_email;
}

export function canSeeAuthor(viewer, req) {
  if (!viewer || !req) return false;
  return canViewRequest(viewer, req);
}

export function computeDue(req) {
  if (!req?.due_date) return { isOverdue: false, isDueSoon: false };
  if (isClosedStatus(req.status)) return { isOverdue: false, isDueSoon: false };
  const due = new Date(req.due_date).getTime();
  const now = Date.now();
  const days = (due - now) / 86400000;
  return { isOverdue: due < now, isDueSoon: due >= now && days <= 3 };
}

// The first-response deadline of the administrator is missed when nobody answered in time.
export function isFirstResponseOverdue(req) {
  if (!req?.first_response_due || req.first_response_at) return false;
  if (isClosedStatus(req.status)) return false;
  return new Date(req.first_response_due).getTime() < Date.now();
}

export async function buildLookups(sb) {
  const [categories, departments] = await Promise.all([
    listAll(sb, "Category", "created_date"),
    listAll(sb, "Department", "created_date"),
  ]);
  const catsById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const deptsById = Object.fromEntries(departments.map((d) => [d.id, d]));
  return { categories, departments, catsById, deptsById };
}

export function serializeRequest(req, lookups, viewer) {
  const cat = lookups.catsById[req.category_id];
  const dept = lookups.deptsById[req.department_id];
  const due = computeDue(req);
  return {
    id: req.id,
    number: req.request_number,
    title: req.title,
    description: req.description,
    proposed_solution: req.proposed_solution || "",
    type: req.type,
    status: req.status,
    priority: req.priority,
    category_id: req.category_id || "",
    category_key: cat?.key || req.category_key || "",
    category_names: cat ? { ru: cat.name_ru, kk: cat.name_kk, en: cat.name_en } : null,
    department_id: req.department_id || "",
    department_name: dept?.name || "",
    author_name: req.author_name || "",
    author_email: req.author_email || "",
    manager_name: req.manager_name || "",
    manager_email: req.manager_email || "",
    assignee_name: req.assignee_name || "",
    assignee_email: req.assignee_email || "",
    due_date: req.due_date || null,
    first_response_due: req.first_response_due || null,
    first_response_at: req.first_response_at || null,
    completed_date: req.completed_date || null,
    decision: req.decision || "",
    decision_reason: req.decision_reason || "",
    planned_actions: req.planned_actions || "",
    actions_taken: req.actions_taken || "",
    result: req.result || "",
    related_issue_id: req.related_issue_id || "",
    source: req.source || "",
    created_date: req.created_date,
    is_deleted: !!req.is_deleted,
    deleted_by_name: req.deleted_by_name || "",
    can_manage: canManageRequest(viewer, req),
    can_work: canWorkRequest(viewer, req),
    can_delete: canDeleteRequest(viewer, req),
    is_assignee: !!req.assignee_email && req.assignee_email === viewer?.email,
    is_author: !!req.author_email && req.author_email === viewer?.email,
    is_overdue: due.isOverdue,
    is_due_soon: due.isDueSoon,
    is_first_response_overdue: isFirstResponseOverdue(req),
  };
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { mirrorAnswerToClient } from "@/lib/client-reply.server";
import {
  buildLookups,
  canDeleteRequest,
  canManageRequest,
  canReviewRequest,
  canSelfCloseRequest,
  canSelfExecuteRequest,
  canViewRequest,
  canWithdrawReview,
  canWorkRequest,
  clientUsers,
  computeDue,
  departmentStaff,
  fullNameOf,
  headsOfDepartment,
  isClosedStatus,
  isFirstResponseOverdue,
  isSelfExecution,
  isVisibleRequest,
  listAll,
  loadViewer,
  serializeRequest,
} from "@/lib/rbac.server";

const DAY = 86400000;

async function getSettings(sb) {
  const rows = await listAll(sb, "AppSettings");
  return rows[0] || { sla_first_response_days: 3, sla_resolution_days: 10 };
}

async function getCategoriesAndDepartments(sb) {
  const lookups = await buildLookups(sb);
  return {
    categories: lookups.categories.filter((c) => c.is_active !== false),
    departments: lookups.departments.filter((d) => d.is_active !== false),
  };
}

async function addHistory(sb, viewer, req, action, extra = {}) {
  await sb.entities.RequestHistory.create({
    request_id: req.id,
    request_number: req.request_number || "",
    user_name: viewer.name,
    user_email: viewer.email,
    action,
    ...extra,
  });
}

async function notify(sb, { email, event, request, message }) {
  if (!email) return;
  await sb.entities.Notification.create({
    recipient_email: email,
    event,
    message: message || "",
    request_id: request?.id || "",
    request_number: request?.request_number || "",
    is_read: false,
  });
}

async function adminEmails(sb) {
  try {
    const users = await listAll(sb, "User", "created_date", 300);
    return users
      .filter((u) => (u.role === "admin" || u.system_role === "admin") && u.account_status !== "blocked")
      .map((u) => u.email);
  } catch {
    return [];
  }
}

function sortItems(items, sort = "new") {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const statusRank = { new: 0, review: 1, inProgress: 2, implemented: 3, waiting: 4, rejected: 5, closed: 6 };
  return items.sort((a, b) => {
    if (sort === "old") return new Date(a.created_date) - new Date(b.created_date);
    if (sort === "priority") return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
    if (sort === "status") return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
    if (sort === "due")
      return (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity);
    return new Date(b.created_date) - new Date(a.created_date);
  });
}

// Marks missed first-response deadlines and tells the department head once.
async function flagOverdueFirstResponse(sb, requests, notifications) {
  const overdue = requests.filter((r) => !r.is_deleted && isFirstResponseOverdue(r)).slice(0, 40);
  if (!overdue.length) return;
  const told = new Set(notifications.filter((n) => n.event === "first_response_overdue").map((n) => n.request_id));
  for (const req of overdue) {
    if (!req.first_response_overdue) {
      await sb.entities.Request.update(req.id, { first_response_overdue: true });
    }
    if (told.has(req.id)) continue;
    const recipients = req.manager_email ? [req.manager_email] : await adminEmails(sb);
    for (const email of recipients) {
      await notify(sb, { email, event: "first_response_overdue", request: req });
    }
  }
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const [requests, notifications, lookups] = await Promise.all([
      listAll(sb, "Request"),
      listAll(sb, "Notification", "-created_date", 200),
      buildLookups(sb),
    ]);

    const allVisible = requests.filter((r) => canViewRequest(viewer, r));
    if (viewer.role === "admin" || viewer.managesDepartments) {
      await flagOverdueFirstResponse(sb, allVisible, notifications);
    }

    const visible = allVisible.filter((r) => isVisibleRequest(viewer, r));
    const mine = visible.filter((r) => r.author_email === viewer.email);
    const assigned = visible.filter((r) => r.assignee_email === viewer.email);
    // The queue of the departments this person runs, whatever his system role is.
    const departmentQueue = viewer.managesDepartments
      ? visible.filter((r) => r.department_id && viewer.managedDepartmentIds.includes(r.department_id))
      : [];
    const pool =
      viewer.role === "admin"
        ? visible
        : viewer.managesDepartments
          ? departmentQueue
          : [...new Map([...mine, ...assigned].map((r) => [r.id, r])).values()];

    const my = (status) => mine.filter((r) => r.status === status).length;
    const unresolved = visible.filter((r) => !isClosedStatus(r.status));
    const resolved = visible.filter((r) => ["implemented", "closed"].includes(r.status)).length;
    const overdue = pool.filter((r) => computeDue(r).isOverdue);
    const awaitingReview = pool.filter((r) => r.status === "review");
    const unassigned = pool.filter((r) => !r.assignee_email && !isClosedStatus(r.status));

    // Department heads receive client handoff notices about their own departments.
    const clientSide = ["client_manager", "admin", "head", "employee"].includes(viewer.role);
    const ownNotifications = notifications.filter(
      (n) => n.recipient_email === viewer.email && (n.scope !== "client" || clientSide)
    );

    const unread = ownNotifications.filter((n) => !n.is_read).length;

    return {
      viewer: {
        name: viewer.name,
        first_name: viewer.firstName,
        middle_name: viewer.middleName,
        last_name: viewer.lastName,
        role: viewer.role,
        email: viewer.email,
        department_id: viewer.departmentId,
        managed_department_ids: viewer.managedDepartmentIds,
      },
      stats: {
        mineTotal: mine.length,
        mineNew: my("new"),
        mineInProgress: my("inProgress") + my("waiting") + my("review"),
        mineResolved: my("implemented") + my("closed"),
        assignedOpen: assigned.filter((r) => !isClosedStatus(r.status)).length,
        departmentTotal: departmentQueue.length,
        unassigned: unassigned.length,
        awaitingReview: awaitingReview.length,
        total: visible.length,
        overdue: overdue.length,
        firstResponseOverdue: pool.filter((r) => isFirstResponseOverdue(r)).length,
        resolvedRate: visible.length ? Math.round((resolved / visible.length) * 100) : null,
        open: unresolved.length,
      },
      recent: sortItems(pool.slice()).slice(0, 5).map((r) => serializeRequest(r, lookups, viewer)),
      notifications: ownNotifications.slice(0, 5).map((n) => ({
        id: n.id,
        event: n.event,
        scope: n.scope || "internal",
        number: n.request_number,
        request_id: n.request_id,
        subject: n.subject || "",
        client_name: n.client_name || "",
        manager_name: n.manager_name || "",
        department_name: n.department_name || "",
        is_read: !!n.is_read,
        created_date: n.created_date,
      })),
      unread,
    };
  });

export const listRequests = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      scope: z.enum(["mine", "all", "attention", "overdue", "assigned", "review", "deleted"]).optional(),
      q: z.string().max(200).optional(),
      status: z.string().optional(),
      category_id: z.string().optional(),
      department_id: z.string().optional(),
      priority: z.string().optional(),
      type: z.string().optional(),
      assignee_email: z.string().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      sort: z.enum(["new", "old", "priority", "due", "status"]).optional(),
      limit: z.number().min(1).max(300).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const [requests, lookups] = await Promise.all([listAll(sb, "Request"), buildLookups(sb)]);

    // Access is decided by the request itself, never by the query alone.
    let items = requests.filter((r) => canViewRequest(viewer, r) && isVisibleRequest(viewer, r));
    if (data.scope === "deleted") {
      if (viewer.role !== "admin") throw Object.assign(new Error("Forbidden"), { status: 403 });
      items = requests.filter((r) => r.is_deleted);
    }

    if (data.scope === "mine") items = items.filter((r) => r.author_email === viewer.email);
    if (data.scope === "assigned") {
      // A department head receives the queue of the departments he runs, whatever his
      // system role is, plus everything addressed to him by name. Client requests keep
      // their own tab for the appointed employee.
      const addressedToMe = (r) =>
        r.recipient_id === viewer.id || r.manager_email === viewer.email || r.assignee_email === viewer.email;
      const inMyDepartment = (r) => !!r.department_id && viewer.managedDepartmentIds.includes(r.department_id);
      if (viewer.role === "admin") {
        // administrators keep every request they may see
      } else if (viewer.managesDepartments) {
        items = items.filter((r) => addressedToMe(r) || inMyDepartment(r));
      } else if (viewer.role === "client_manager") items = [];
      else items = items.filter((r) => addressedToMe(r) && r.source !== "client_request");
    }
    if (data.scope === "all" && viewer.role !== "admin") {
      if (viewer.managesDepartments) {
        items = items.filter((r) => r.department_id && viewer.managedDepartmentIds.includes(r.department_id));
      }
    }
    // Work the executors submitted waits here for the head's verification.
    if (data.scope === "review")
      items = items.filter((r) => r.status === "implemented" && canManageRequest(viewer, r));
    if (data.scope === "attention")
      items = items.filter((r) => canManageRequest(viewer, r) && ["new", "review", "waiting"].includes(r.status));
    if (data.scope === "overdue") items = items.filter((r) => computeDue(r).isOverdue);

    if (data.status) items = items.filter((r) => r.status === data.status);
    if (data.priority) items = items.filter((r) => r.priority === data.priority);
    if (data.type) items = items.filter((r) => r.type === data.type);
    if (data.category_id) items = items.filter((r) => r.category_id === data.category_id);
    if (data.department_id) items = items.filter((r) => r.department_id === data.department_id);
    if (data.assignee_email) items = items.filter((r) => r.assignee_email === data.assignee_email);
    if (data.date_from) items = items.filter((r) => new Date(r.created_date) >= new Date(data.date_from));
    if (data.date_to) items = items.filter((r) => new Date(r.created_date) <= new Date(`${data.date_to}T23:59:59`));

    if (data.q) {
      const q = data.q.trim().toLowerCase();
      // People are matched on their real account, then the request on its user ids.
      const people = await clientUsers(sb);
      const emails = new Set(
        people
          .filter((u) => [fullNameOf(u), u.email].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
          .map((u) => u.email)
      );
      items = items.filter((r) =>
        [r.request_number, r.title, r.description, r.author_name, r.assignee_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)) ||
        emails.has(r.assignee_email) ||
        emails.has(r.author_email)
      );
    }

    sortItems(items, data.sort);

    return {
      items: items.slice(0, data.limit || 100).map((r) => serializeRequest(r, lookups, viewer)),
      total: items.length,
      options: await getCategoriesAndDepartments(sb),
      viewer: { role: viewer.role, department_id: viewer.departmentId, email: viewer.email },
    };
  });

export const getRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const lookups = await buildLookups(sb);
    let req;
    try {
      req = await sb.entities.Request.get(data.id);
    } catch {
      return null;
    }
    // A deleted request stays in the database but leaves every working screen.
    if (!isVisibleRequest(viewer, req)) return null;
    if (!canViewRequest(viewer, req)) return { forbidden: true };

    const [comments, history, attachments, issues, links, departments] = await Promise.all([
      listAll(sb, "Comment", "-created_date", 500),
      listAll(sb, "RequestHistory", "-created_date", 500),
      listAll(sb, "Attachment", "created_date", 100),
      listAll(sb, "RelatedIssue", "-created_date", 100),
      listAll(sb, "RelatedIssueRequest", "created_date", 500),
      listAll(sb, "Department", "created_date"),
    ]);
    const manage = canManageRequest(viewer, req);
    const own = req.author_email === viewer.email;
    const assigned = !!req.assignee_email && req.assignee_email === viewer.email;
    const reqComments = comments
      .filter((c) => c.request_id === req.id)
      .filter((c) => (c.visibility === "internal" ? manage || assigned : manage || own || assigned))
      .map((c) => ({
        id: c.id,
        text: c.text,
        author_name: c.author_name,
        visibility: c.visibility,
        is_clarification: !!c.is_clarification,
        created_date: c.created_date,
        mine: c.author_email === viewer.email,
      }));
    const linkedIssueIds = links.filter((l) => l.request_id === req.id).map((l) => l.issue_id);
    const deptNames = Object.fromEntries(departments.map((d) => [d.id, d.name]));
    const department = lookups.deptsById[req.department_id];
    const staff = manage ? await departmentStaff(sb, req.department_id) : [];

    return {
      request: serializeRequest(req, lookups, viewer),
      viewer: {
        role: viewer.role,
        email: viewer.email,
        name: viewer.name,
        first_name: viewer.firstName,
        middle_name: viewer.middleName,
      },
      department: department
        ? { id: department.id, name: department.name, heads: headsOfDepartment(department) }
        : null,
      can_manage: manage,
      can_work: canWorkRequest(viewer, req),
      can_delete: canDeleteRequest(viewer, req),
      can_set_due: manage && !isClosedStatus(req.status),
      can_review: canReviewRequest(viewer, req),
      can_withdraw_review: canWithdrawReview(viewer, req),
      can_self_execute: canSelfExecuteRequest(viewer, req),
      can_self_close: canSelfCloseRequest(viewer, req),
      is_self_execution: isSelfExecution(viewer, req),
      is_author: own,
      is_assignee: assigned,
      // A head who executes the request himself stays selectable as its executor.
      assignees: manage
        ? [
            ...(isSelfExecution(viewer, req)
              ? [{ email: viewer.email, name: viewer.name, position: viewer.position, department_name: "" }]
              : []),
            ...staff
              .filter((u) => u.email !== viewer.email)
              .map((u) => ({
                email: u.email,
                name: fullNameOf(u) || u.email,
                position: u.position || "",
                department_name: deptNames[u.department_id] || "",
              })),
          ]
        : [],
      comments: reqComments,
      history: history
        .filter((h) => h.request_id === req.id)
        .map((h) => ({
          id: h.id,
          action: h.action,
          user_name: h.user_name,
          field: h.field,
          old_value: h.old_value,
          new_value: h.new_value,
          note: h.note,
          created_date: h.created_date,
        })),
      attachments: attachments
        .filter((a) => a.request_id === req.id)
        .map((a) => ({ id: a.id, file_name: a.file_name, file_uri: a.file_uri })),
      related_issues: issues.filter((i) => linkedIssueIds.includes(i.id) || i.id === req.related_issue_id),
      options: await getCategoriesAndDepartments(sb),
    };
  });

export const createRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      title: z.string().min(3).max(200),
      description: z.string().min(5).max(5000),
      proposed_solution: z.string().max(5000).optional(),
      type: z.enum(["improvement", "problem", "idea", "question", "gratitude", "other"]),
      category_id: z.string().min(1),
      priority: z.enum(["low", "medium", "high"]),
      attachments: z
        .array(z.object({ file_name: z.string(), file_uri: z.string(), file_size: z.number().optional() }))
        .max(5)
        .optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (viewer.accountStatus === "blocked") throw Object.assign(new Error("Blocked"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const [settings, lookups, requests] = await Promise.all([
      getSettings(sb),
      buildLookups(sb),
      listAll(sb, "Request"),
    ]);
    const category = lookups.catsById[data.category_id];
    if (!category) throw Object.assign(new Error("Unknown category"), { status: 400 });

    // The category decides the department; the department heads are the recipients.
    const department = category.department_id ? lookups.deptsById[category.department_id] : null;
    const heads = headsOfDepartment(department);
    const managerEmail = heads[0] || "";
    const managerUser = managerEmail
      ? (await listAll(sb, "User", "created_date", 300)).find((u) => u.email === managerEmail)
      : null;

    const used = new Set(requests.map((r) => r.request_number).filter(Boolean));
    let seq = 1;
    while (used.has(`SR-${String(seq).padStart(4, "0")}`)) seq += 1;
    const number = `SR-${String(seq).padStart(4, "0")}`;
    const now = Date.now();

    const created = await sb.entities.Request.create({
      request_number: number,
      title: data.title,
      description: data.description,
      proposed_solution: data.proposed_solution || "",
      type: data.type,
      category_id: category.id,
      category_key: category.key,
      department_id: department?.id || "",
      author_name: viewer.name,
      author_email: viewer.email,
      priority: data.priority,
      status: "new",
      manager_email: managerEmail,
      manager_name: managerUser ? fullNameOf(managerUser) : "",
      // The head of the target department is the recipient of the new request: his
      // account id keeps it in his «Назначено мне» whatever his system role is.
      recipient_id: managerUser?.id || "",
      assignee_email: "",
      assignee_name: "",
      first_response_due: new Date(now + (settings.sla_first_response_days ?? 3) * DAY).toISOString(),
      due_date: "",
      is_demo: false,
      source: "app",
    });

    if (data.attachments?.length) {
      await sb.entities.Attachment.bulkCreate(
        data.attachments.map((a) => ({
          request_id: created.id,
          file_name: a.file_name,
          file_uri: a.file_uri,
          file_size: a.file_size || 0,
        }))
      );
    }

    await addHistory(sb, viewer, created, "created");
    await notify(sb, { email: viewer.email, event: "request_created", request: created });

    if (heads.length) {
      for (const email of heads) {
        await notify(sb, { email, event: "new_request", request: created });
      }
    } else {
      // No department or no head: the request is stored and the administrator is told.
      await addHistory(sb, viewer, created, "routing_missing");
      for (const email of await adminEmails(sb)) {
        await notify(sb, { email, event: "needs_admin_attention", request: created });
      }
    }

    return { id: created.id, number: created.request_number, department: department?.name || "" };
  });

const patchSchema = z.object({
  id: z.string(),
  status: z
    .enum(["new", "review", "inProgress", "waiting", "implemented", "rejected", "closed"])
    .optional(),
  // The comment of a status change: kept in the history and read by the participants.
  comment: z.string().max(4000).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  assignee_email: z.string().max(200).optional(),
  assignee_name: z.string().max(200).optional(),
  due_date: z.string().optional(),
  decision: z.string().max(4000).optional(),
  decision_reason: z.string().max(4000).optional(),
  planned_actions: z.string().max(4000).optional(),
  actions_taken: z.string().max(4000).optional(),
  result: z.string().max(4000).optional(),
});

export const updateRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(patchSchema)
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const req = await sb.entities.Request.get(data.id);
    if (!isVisibleRequest(viewer, req)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const manage = canManageRequest(viewer, req);
    const works = canWorkRequest(viewer, req);
    // «Реализовано» no longer locks the executor out: he may take the request back
    // from review until the head decides.
    const withdraw = canWithdrawReview(viewer, req);
    if (!manage && !works && !withdraw) throw Object.assign(new Error("Forbidden"), { status: 403 });

    // The executor only reports progress; distribution stays with the department head.
    if (!manage) {
      if (
        data.priority !== undefined ||
        data.assignee_email !== undefined ||
        data.assignee_name !== undefined ||
        data.due_date !== undefined ||
        data.decision !== undefined ||
        data.decision_reason !== undefined ||
        data.planned_actions !== undefined
      ) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }
      // The executor sets only the working statuses; closing and rejecting belong to the head.
      if (data.status && !["inProgress", "waiting", "implemented"].includes(data.status)) {
        throw Object.assign(new Error("Forbidden"), { status: 403 });
      }
    }

    // «Новое» is assigned automatically and is never set by hand.
    if (data.status === "new" && req.status !== "new") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const patch = {};
    const changes = [];
    const track = (field, value, label, oldLabel) => {
      if (value === undefined || value === null) return;
      const oldValue = req[field] ?? "";
      if (String(oldValue) === String(value)) return;
      patch[field] = value;
      changes.push({ field, oldValue: oldLabel ?? oldValue, newValue: value, label });
    };

    // A head assigns only employees of the request's own department, or takes it himself.
    if (manage && data.assignee_email !== undefined && data.assignee_email !== req.assignee_email) {
      const previousName = req.assignee_name || req.assignee_email || "";
      if (data.assignee_email === viewer.email) {
        // Self-execution: the head becomes the executor of this very request.
        if (!canSelfExecuteRequest(viewer, req)) {
          throw Object.assign(new Error("Forbidden"), { status: 403 });
        }
        patch.assignee_email = viewer.email;
        patch.assignee_name = viewer.name;
        patch.assignee_id = viewer.id;
        changes.push({ field: "assignee", oldValue: previousName, newValue: viewer.name, label: "assignee" });
      } else if (data.assignee_email) {
        const staff = await departmentStaff(sb, req.department_id);
        const employee = staff.find((u) => u.email === data.assignee_email);
        if (!employee) throw Object.assign(new Error("Assignee is not in this department"), { status: 400 });
        patch.assignee_email = employee.email;
        patch.assignee_name = fullNameOf(employee);
        patch.assignee_id = employee.id;
        changes.push({
          field: "assignee",
          oldValue: previousName,
          newValue: fullNameOf(employee),
          label: "assignee",
        });
      } else {
        patch.assignee_email = "";
        patch.assignee_name = "";
        patch.assignee_id = "";
        changes.push({ field: "assignee", oldValue: previousName, newValue: "", label: "assignee" });
      }

      // Handing the request to an executor starts the work.
      if (patch.assignee_email && req.status === "new") {
        patch.status = "inProgress";
        changes.push({
          field: "status",
          oldValue: req.status,
          newValue: "inProgress",
          label: "status",
        });
      }
    }

    if (manage) {
      track("priority", data.priority, "priority");
      track("due_date", data.due_date, "due_date");
    }

    ["decision", "decision_reason", "planned_actions", "actions_taken", "result"].forEach((f) => {
      if (data[f] !== undefined) patch[f] = data[f];
    });

    const nextStatus = data.status || req.status;
    const statusChanged = nextStatus !== req.status;

    const comment = (data.comment || "").trim();

    if (data.status === "rejected" && !(data.decision_reason || comment || req.decision_reason)) {
      throw Object.assign(new Error("Rejection reason required"), { status: 400 });
    }
    // Closing always carries the head's comment; it is what the author reads.
    if (
      data.status === "closed" &&
      !(data.decision_reason || comment || req.decision_reason || data.result || req.result)
    ) {
      throw Object.assign(new Error("Closing comment required"), { status: 400 });
    }
    // A rejection or a closure keeps its comment on the request itself as the reason.
    if (comment && !data.decision_reason && ["rejected", "closed"].includes(data.status)) {
      patch.decision_reason = comment;
    }

    if (statusChanged) {
      patch.status = nextStatus;
      if (isClosedStatus(nextStatus)) {
        if (!req.completed_date) patch.completed_date = new Date().toISOString();
      } else {
        patch.completed_date = "";
      }
      changes.push({ field: "status", oldValue: req.status, newValue: nextStatus, label: "status" });
    }

    if (!req.first_response_at && data.status && data.status !== "new") {
      patch.first_response_at = new Date().toISOString();
    }
    if (!req.manager_email && manage) {
      patch.manager_email = viewer.email;
      patch.manager_name = viewer.name;
    }

    const updated = await sb.entities.Request.update(req.id, patch);

    for (const change of changes) {
      const action =
        change.label === "assignee" ? "assigned" : change.label === "status" ? "status_changed" : "updated";
      await addHistory(sb, viewer, updated, action, {
        field: change.label,
        old_value: String(change.oldValue ?? ""),
        new_value: String(change.newValue ?? ""),
        ...(change.label === "status" && comment ? { note: comment } : {}),
      });
    }
    if (data.status === "closed") {
      await addHistory(sb, viewer, updated, "closed", { note: comment || data.decision_reason || "" });
    }
    if (data.status === "rejected") {
      await addHistory(sb, viewer, updated, "rejected", { note: comment || data.decision_reason || "" });
    }
    // The executor hands the finished work to his head: the request becomes
    // «Реализовано» and waits for verification.
    if (!manage && data.status === "implemented") {
      await addHistory(sb, viewer, updated, "sent_for_review", { note: comment || updated.result || "" });
    }
    // The executor takes the submitted request back from review: it simply returns
    // to work with the same number, the same conversation and the whole history.
    if (!manage && req.status === "implemented" && updated.status === "inProgress") {
      await addHistory(sb, viewer, updated, "withdrawn_from_review", { note: comment });
    }
    // A new result never overwrites the previous one: the old one stays in the history.
    if (data.result !== undefined && data.result !== req.result) {
      await addHistory(sb, viewer, updated, "result_updated", {
        field: "result",
        old_value: req.result || "",
        new_value: data.result || "",
      });
    }
    if (!changes.length && (data.decision || data.result || data.actions_taken)) {
      await addHistory(sb, viewer, updated, "decision_made");
    }

    // A request forwarded from a client request keeps one conversation: an answer
    // written here by the head or the executor is mirrored to the client's card.
    const answerText =
      comment ||
      (data.result !== undefined && data.result !== req.result ? data.result.trim() : "") ||
      (data.decision_reason !== undefined && data.decision_reason !== req.decision_reason
        ? data.decision_reason.trim()
        : "");
    if (answerText) {
      await mirrorAnswerToClient(sb, updated, viewer, answerText);
    }

    const headEmail = updated.manager_email || "";
    const authorEmail = updated.author_email;
    const assigneeEmail = updated.assignee_email;

    if (changes.some((c) => c.label === "assignee") && assigneeEmail && assigneeEmail !== viewer.email) {
      await notify(sb, { email: assigneeEmail, event: "assigned_to_you", request: updated });
    }
    if (changes.some((c) => c.label === "assignee") && authorEmail && authorEmail !== viewer.email) {
      await notify(sb, { email: authorEmail, event: "assigned", request: updated });
    }

    // The head returns the implemented request to work — the executor is told again.
    if (manage && req.status === "implemented" && updated.status === "inProgress" && assigneeEmail) {
      await notify(sb, { email: assigneeEmail, event: "returned_for_rework", request: updated });
    }

    if (statusChanged) {
      // The executor submitted his work for verification: the head gets one dedicated notice.
      const submittedForReview = updated.status === "implemented" && !manage;
      const withdrawnFromReview = !manage && req.status === "implemented" && updated.status === "inProgress";
      const recipients = new Set([authorEmail, headEmail, assigneeEmail].filter(Boolean));
      recipients.delete(viewer.email);
      for (const email of recipients) {
        if ((submittedForReview || withdrawnFromReview) && email === headEmail) continue;
        if (email === authorEmail) {
          const event =
            updated.status === "closed"
              ? "closed_by_chief"
              : updated.status === "rejected"
                ? "rejected_by_chief"
                : "status_changed";
          await notify(sb, { email, event, request: updated, message: comment });
        } else if (email === assigneeEmail && ["closed", "rejected"].includes(updated.status)) {
          await notify(sb, {
            email,
            event: updated.status === "rejected" ? "rejected_by_chief" : "closed_by_chief",
            request: updated,
          });
        } else if (email !== authorEmail) {
          await notify(sb, { email, event: "status_changed", request: updated });
        }
      }
      if (submittedForReview && headEmail) {
        await notify(sb, { email: headEmail, event: "sent_for_review", request: updated });
      }
      if (withdrawnFromReview && headEmail) {
        await notify(sb, { email: headEmail, event: "review_withdrawn", request: updated });
      }
    }

    return { ok: true, status: updated.status };
  });

// Physical delete: the request and everything attached to it leaves the database.
// Only the audit entry survives, and it holds no copy of the request.
export const deleteRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    let req;
    try {
      req = await sb.entities.Request.get(data.id);
    } catch {
      throw Object.assign(new Error("Request not found"), { status: 404 });
    }
    if (!isVisibleRequest(viewer, req) || !canDeleteRequest(viewer, req)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    // The audit trail keeps the fact of the deletion, its author and its subject.
    await sb.entities.AuditLog.create({
      user_email: viewer.email,
      user_name: viewer.name,
      action: "request_deleted",
      details: `${[req.request_number, req.title].filter(Boolean).join(" · ")} · автор: ${
        req.author_name || req.author_email || "—"
      }`,
      entity_type: "Request",
      entity_id: req.id,
    });

    // Related records go first so nothing is left pointing at a missing request.
    await Promise.all([
      sb.entities.Comment.deleteMany({ request_id: req.id }),
      sb.entities.RequestHistory.deleteMany({ request_id: req.id }),
      sb.entities.Attachment.deleteMany({ request_id: req.id }),
      sb.entities.Notification.deleteMany({ request_id: req.id }),
      sb.entities.RelatedIssueRequest.deleteMany({ request_id: req.id }),
    ]);

    // Client requests keep their own record; only the reference to the deleted one is dropped.
    const clientRequests = await listAll(sb, "ClientRequest", "created_date", 500);
    for (const clientRequest of clientRequests.filter((c) => c.internal_request_id === req.id)) {
      await sb.entities.ClientRequest.update(clientRequest.id, {
        internal_request_id: "",
        internal_request_number: "",
      });
    }

    await sb.entities.Request.delete(req.id);
    return { ok: true, number: req.request_number || "" };
  });

export const getDistribution = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      status: z.string().optional(),
      category_id: z.string().optional(),
      department_id: z.string().optional(),
      priority: z.string().optional(),
      assignee_email: z.string().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      q: z.string().max(200).optional(),
      sort: z.enum(["new", "old", "priority", "due", "status"]).optional(),
      include_deleted: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (!viewer.managesDepartments && viewer.role !== "admin") {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    const sb = context.getBase44().asServiceRole;
    const [requests, lookups, users] = await Promise.all([
      listAll(sb, "Request"),
      buildLookups(sb),
      clientUsers(sb),
    ]);

    // Heads work only with their own departments, administrators with everything.
    const scope = requests.filter((r) => canViewRequest(viewer, r));
    const visible = scope.filter((r) => isVisibleRequest(viewer, r));
    const deletedScope = viewer.role === "admin" ? scope.filter((r) => r.is_deleted) : [];
    let items = data.include_deleted && viewer.role === "admin" ? deletedScope : visible;

    if (data.status) items = items.filter((r) => r.status === data.status);
    if (data.priority) items = items.filter((r) => r.priority === data.priority);
    if (data.category_id) items = items.filter((r) => r.category_id === data.category_id);
    if (data.department_id) items = items.filter((r) => r.department_id === data.department_id);
    if (data.assignee_email === "__none__") items = items.filter((r) => !r.assignee_email);
    else if (data.assignee_email) items = items.filter((r) => r.assignee_email === data.assignee_email);
    if (data.date_from) items = items.filter((r) => new Date(r.created_date) >= new Date(data.date_from));
    if (data.date_to) items = items.filter((r) => new Date(r.created_date) <= new Date(`${data.date_to}T23:59:59`));
    if (data.q) {
      const q = data.q.trim().toLowerCase();
      // The executor filter and the search both resolve to the user's account.
      const emails = new Set(
        users
          .filter((u) => [fullNameOf(u), u.email].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
          .map((u) => u.email)
      );
      items = items.filter((r) =>
        [r.request_number, r.title, r.description, r.author_name, r.assignee_name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)) ||
        emails.has(r.assignee_email) ||
        emails.has(r.author_email)
      );
    }

    const counts = {};
    visible.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });

    sortItems(items, data.sort);

    const departments =
      viewer.role === "admin"
        ? lookups.departments
        : lookups.departments.filter((d) => viewer.managedDepartmentIds.includes(d.id));
    const staff = users.filter((u) => u.account_type !== "client");
    const eligible = viewer.role === "admin" ? staff : staff.filter((u) => departments.some((d) => d.id === u.department_id));
    const deptNames = Object.fromEntries(lookups.departments.map((d) => [d.id, d.name]));

    return {
      items: items.slice(0, 200).map((r) => serializeRequest(r, lookups, viewer)),
      total: items.length,
      viewer: { role: viewer.role, email: viewer.email },
      counts: {
        ...counts,
        all: visible.length,
        deleted: deletedScope.length,
        unassigned: visible.filter((r) => !r.assignee_email && !isClosedStatus(r.status)).length,
        overdue: visible.filter((r) => computeDue(r).isOverdue).length,
        awaitingReview: visible.filter((r) => r.status === "review").length,
      },
      options: {
        categories: lookups.categories.filter((c) => c.is_active !== false),
        departments,
        users: eligible.map((u) => ({
          email: u.email,
          name: fullNameOf(u) || u.email,
          department_name: deptNames[u.department_id] || "",
        })),
      },
    };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      request_id: z.string(),
      text: z.string().min(1).max(4000),
      visibility: z.enum(["public", "internal"]),
      request_clarification: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const req = await sb.entities.Request.get(data.request_id);
    if (!isVisibleRequest(viewer, req) || !canViewRequest(viewer, req)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    const manage = canManageRequest(viewer, req);
    const own = req.author_email === viewer.email;
    const assigned = !!req.assignee_email && req.assignee_email === viewer.email;
    if (!manage && !own && !assigned) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (data.request_clarification && !manage) throw Object.assign(new Error("Forbidden"), { status: 403 });

    const comment = await sb.entities.Comment.create({
      request_id: req.id,
      request_number: req.request_number,
      text: data.text,
      author_name: viewer.name,
      author_email: viewer.email,
      visibility: (manage || assigned) && data.visibility === "internal" ? "internal" : "public",
      is_clarification: !!data.request_clarification,
    });

    await addHistory(sb, viewer, req, data.request_clarification ? "clarification_requested" : "comment_added", {
      note: data.text.slice(0, 200),
    });

    if (data.request_clarification) {
      await sb.entities.Request.update(req.id, {
        status: "waiting",
        first_response_at: req.first_response_at || new Date().toISOString(),
        manager_email: req.manager_email || viewer.email,
        manager_name: req.manager_name || viewer.name,
      });
      await notify(sb, { email: req.author_email, event: "clarification_requested", request: req });
      return { ok: true };
    }

    if (!manage) {
      if (own) {
        if (req.status === "waiting") {
          await sb.entities.Request.update(req.id, { status: "review" });
          await addHistory(sb, viewer, req, "clarification_answered");
          await notify(sb, { email: req.manager_email, event: "clarification_answered", request: req });
        } else if (req.manager_email) {
          await notify(sb, { email: req.manager_email, event: "comment_added", request: req });
        }
      } else if (req.manager_email) {
        await notify(sb, { email: req.manager_email, event: "comment_added", request: req });
      }
    } else {
      const recipients = new Set([req.author_email, req.assignee_email].filter(Boolean));
      recipients.delete(viewer.email);
      if (comment.visibility === "public") {
        for (const email of recipients) {
          await notify(sb, { email, event: "comment_added", request: req });
        }
      } else if (req.assignee_email && req.assignee_email !== viewer.email) {
        await notify(sb, { email: req.assignee_email, event: "comment_added", request: req });
      }
    }

    return { ok: true };
  });

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const all = await listAll(sb, "Notification", "-created_date", 200);
    // Client events stay with the client queue side and the heads they are addressed to.
    const clientSide = ["client_manager", "admin", "head", "employee"].includes(viewer.role);
    const mine = all.filter(
      (n) => n.recipient_email === viewer.email && (n.scope !== "client" || clientSide)
    );
    return {
      items: mine.map((n) => ({
        id: n.id,
        event: n.event,
        scope: n.scope || "internal",
        number: n.request_number,
        request_id: n.request_id,
        subject: n.subject || "",
        client_name: n.client_name || "",
        manager_name: n.manager_name || "",
        department_name: n.department_name || "",
        is_read: !!n.is_read,
        created_date: n.created_date,
      })),
      unread: mine.filter((n) => !n.is_read).length,
    };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().optional(), all: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    if (data.all) {
      await sb.entities.Notification.updateMany(
        { recipient_email: viewer.email, is_read: false },
        { $set: { is_read: true } }
      );
      return { ok: true };
    }
    if (!data.id) return { ok: false };
    const all = await listAll(sb, "Notification", "-created_date", 200);
    const target = all.find((n) => n.id === data.id);
    if (!target || target.recipient_email !== viewer.email) throw Object.assign(new Error("Forbidden"), { status: 403 });
    await sb.entities.Notification.update(target.id, { is_read: true });
    return { ok: true };
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const [departments, notificationSettings] = await Promise.all([
      listAll(sb, "Department", "created_date"),
      listAll(sb, "UserNotificationSettings", "created_date", 200),
    ]);
    const dept = departments.find((d) => d.id === viewer.departmentId);
    const ns = notificationSettings.find((s) => s.user_email === viewer.email);
    return {
      first_name: viewer.firstName,
      last_name: viewer.lastName,
      middle_name: viewer.middleName,
      name: viewer.name,
      email: viewer.email,
      role: viewer.role,
      position: viewer.position,
      department_name: dept?.name || "",
      language: viewer.language,
      settings: {
        internal_enabled: ns ? ns.internal_enabled !== false : true,
        email_enabled: !!ns?.email_enabled,
        push_enabled: !!ns?.push_enabled,
      },
    };
  });

// A person edits only their own name fields; role, department and email stay untouched.
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      first_name: z.string().max(80).optional(),
      last_name: z.string().max(80).optional(),
      middle_name: z.string().max(80).optional(),
      position: z.string().max(200).optional(),
      internal_enabled: z.boolean().optional(),
      email_enabled: z.boolean().optional(),
      push_enabled: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const users = await listAll(sb, "User", "created_date", 300);
    const record = users.find((u) => u.email === viewer.email);
    if (!record) throw Object.assign(new Error("Profile not found"), { status: 404 });

    const firstName = data.first_name !== undefined ? data.first_name.trim() : record.first_name || "";
    const lastName = data.last_name !== undefined ? data.last_name.trim() : record.last_name || "";
    const middleName = data.middle_name !== undefined ? data.middle_name.trim() : record.middle_name || "";
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(" ").trim();

    await sb.entities.User.update(record.id, {
      first_name: firstName,
      last_name: lastName,
      middle_name: middleName,
      full_name: fullName || record.full_name || record.email,
      ...(data.position !== undefined ? { position: data.position } : {}),
    });

    if (data.internal_enabled !== undefined || data.email_enabled !== undefined || data.push_enabled !== undefined) {
      const existing = (await listAll(sb, "UserNotificationSettings", "created_date", 200)).find(
        (s) => s.user_email === viewer.email
      );
      const payload = {
        user_email: viewer.email,
        internal_enabled: data.internal_enabled !== false,
        email_enabled: !!data.email_enabled,
        push_enabled: !!data.push_enabled,
      };
      if (existing) await sb.entities.UserNotificationSettings.update(existing.id, payload);
      else await sb.entities.UserNotificationSettings.create(payload);
    }

    return { ok: true, full_name: fullName };
  });

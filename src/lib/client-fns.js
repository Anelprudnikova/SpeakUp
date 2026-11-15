import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { postClientReply } from "@/lib/client-reply.server";
import { moveClientDepartment } from "@/lib/client-department.server";
import {
  canManageClientItem,
  canReplyClientItem,
  canViewClientRequest,
  canWorkClientItem,
  departmentStaff,
  fullNameOf,
  headsOfDepartment,
  listAll,
  loadViewer,
} from "@/lib/rbac.server";
import { CLIENT_STATUSES } from "@/lib/roles";

const DAY = 86400000;
const OPEN_CLIENT_STATUSES = ["received", "in_work", "clarification", "handed_off", "awaiting_internal", "answer_ready"];

function isManager(viewer) {
  return viewer.role === "client_manager" || viewer.role === "admin";
}

function isClient(viewer) {
  return viewer.accountType === "client";
}

async function clientManagers(sb) {
  const users = await listAll(sb, "User", "created_date", 300);
  return users.filter(
    (u) => u.account_status !== "blocked" && (u.system_role === "client_manager" || u.role === "admin")
  );
}

async function notify(sb, { email, event, item, message, subject, client_name, manager_name, department_name }) {
  if (!email) return;
  await sb.entities.Notification.create({
    recipient_email: email,
    event,
    scope: "client",
    message: message || "",
    subject: subject || "",
    client_name: client_name || "",
    manager_name: manager_name || "",
    department_name: department_name || "",
    request_id: item?.id || "",
    request_number: item?.client_number || "",
    is_read: false,
  });
}

async function logEvent(sb, item, viewer, text, isInternal = true) {
  await sb.entities.ClientMessage.create({
    client_request_id: item.id,
    client_number: item.client_number || "",
    text,
    author_email: viewer.email,
    author_name: viewer.name,
    from_role: "system",
    kind: "event",
    is_internal: isInternal,
    is_clarification: false,
  });
}

async function nextClientNumber(sb) {
  const rows = await listAll(sb, "ClientRequest", "-created_date", 500);
  const used = new Set(rows.map((r) => r.client_number).filter(Boolean));
  let seq = 1;
  while (used.has(`CL-${String(seq).padStart(4, "0")}`)) seq += 1;
  return `CL-${String(seq).padStart(4, "0")}`;
}

async function nextInternalNumber(sb) {
  const rows = await listAll(sb, "Request", "-created_date", 500);
  const used = new Set(rows.map((r) => r.request_number).filter(Boolean));
  let seq = 1;
  while (used.has(`SR-${String(seq).padStart(4, "0")}`)) seq += 1;
  return `SR-${String(seq).padStart(4, "0")}`;
}

function canClientDelete(item, viewer) {
  if (!viewer || !item || item.is_deleted) return false;
  if (viewer.role === "admin") return true;
  if (viewer.accountType === "client" && item.author_email === viewer.email) {
    return item.status === "received" && !item.manager_email;
  }
  return false;
}

// The executor of a handed-off client request is the executor of its internal twin.
async function clientExecutors(sb) {
  const rows = await listAll(sb, "Request", "-created_date", 500);
  const map = {};
  rows.forEach((r) => {
    if (r.assignee_email) map[r.id] = { email: r.assignee_email, name: r.assignee_name || r.assignee_email };
  });
  return map;
}

function withExecutor(item, executors) {
  const executor = item.internal_request_id ? executors[item.internal_request_id] : null;
  return { ...item, assignee_email: executor?.email || "", assignee_name: executor?.name || "" };
}

function serialize(item, viewer) {
  return {
    id: item.id,
    is_deleted: !!item.is_deleted,
    assignee_email: item.assignee_email || "",
    assignee_name: item.assignee_name || "",
    can_delete: canClientDelete(item, viewer),
    number: item.client_number || "",
    title: item.title,
    description: item.description,
    type: item.type,
    status: item.status,
    author_name: item.author_name || "",
    author_email: item.author_email || "",
    manager_name: item.manager_name || "",
    manager_email: item.manager_email || "",
    result: item.result || "",
    department_name: item.department_name || "",
    internal_request_id: item.internal_request_id || "",
    internal_request_number: item.internal_request_number || "",
    handoff_at: item.handoff_at || null,
    handoff_by_name: item.handoff_by_name || "",
    files: Array.isArray(item.files) ? item.files : [],
    created_date: item.created_date,
    updated_date: item.updated_date,
  };
}

// After the platform verified the emailed code, the account becomes a client profile.
export const completeClientSignup = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ first_name: z.string().min(1).max(80), last_name: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const sb = context.getBase44().asServiceRole;
    const fullName = `${data.first_name} ${data.last_name}`.trim();
    try {
      await context.getBase44().auth.updateMe({ full_name: fullName });
    } catch {
      // The profile row below still carries the name.
    }
    const users = await listAll(sb, "User", "created_date", 300);
    const me = users.find((u) => u.email === context.user.email);
    if (!me) throw Object.assign(new Error("User not found"), { status: 404 });
    await sb.entities.User.update(me.id, {
      account_type: "client",
      first_name: data.first_name,
      last_name: data.last_name,
      full_name: fullName,
    });
    return { ok: true };
  });

export const getClientHome = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    if (!isClient(viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const [requests, notifications] = await Promise.all([
      listAll(sb, "ClientRequest", "-created_date", 500),
      listAll(sb, "Notification", "-created_date", 200),
    ]);
    const mine = requests.filter((r) => r.author_email === viewer.email);
    const myNotifications = notifications.filter(
      (n) => n.recipient_email === viewer.email && n.scope === "client"
    );
    return {
      name: viewer.firstName || viewer.name,
      stats: {
        total: mine.length,
        open: mine.filter((r) => OPEN_CLIENT_STATUSES.includes(r.status)).length,
        resolved: mine.filter((r) => ["resolved", "closed"].includes(r.status)).length,
      },
      unread: myNotifications.filter((n) => !n.is_read).length,
      recent: mine.slice(0, 5).map(serialize),
    };
  });

export const createClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      type: z.enum(["question", "complaint", "suggestion", "gratitude", "other"]),
      title: z.string().min(3).max(200),
      description: z.string().min(5).max(5000),
      files: z
        .array(z.object({ file_name: z.string(), file_uri: z.string() }))
        .max(5)
        .optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (!isClient(viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const managers = await clientManagers(sb);
    const manager = managers[0] || null;
    const number = await nextClientNumber(sb);

    const created = await sb.entities.ClientRequest.create({
      client_number: number,
      title: data.title,
      description: data.description,
      type: data.type,
      status: "received",
      author_email: viewer.email,
      author_name: viewer.name,
      manager_email: manager?.email || "",
      manager_name: manager?.full_name || "",
      files: data.files || [],
    });

    await logEvent(sb, created, viewer, data.title, false);
    for (const m of managers) {
      await notify(sb, { email: m.email, event: "client_new", item: created });
    }
    return { id: created.id, number };
  });

export const listMyClientRequests = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    if (!isClient(viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const requests = await listAll(sb, "ClientRequest", "-created_date", 500);
    return {
      viewer: { name: viewer.name, email: viewer.email, first_name: viewer.firstName, last_name: viewer.lastName },
      items: requests
        .filter((r) => r.author_email === viewer.email && !r.is_deleted)
        .map((r) => serialize(r, viewer)),
    };
  });

export const getClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    let item;
    try {
      item = await sb.entities.ClientRequest.get(data.id);
    } catch {
      return null;
    }
    const manager = isManager(viewer);
    const [messages, executors] = await Promise.all([
      listAll(sb, "ClientMessage", "created_date", 500),
      clientExecutors(sb),
    ]);
    // The appointed executor works the same card as the head of the department.
    const view = withExecutor(item, executors);
    if (!canViewClientRequest(viewer, view)) return { forbidden: true };
    if (item.is_deleted && viewer.role !== "admin") return null;

    const manage = canManageClientItem(viewer, item);
    const staff = manage && item.department_id ? await departmentStaff(sb, item.department_id) : [];
    // Moving a forwarded request to another department changes the card itself:
    // no second request is created, its conversation and files stay in place.
    const canChangeDepartment = !!item.internal_request_id && !!item.department_id && (manager || manage);
    const departments = canChangeDepartment
      ? (await listAll(sb, "Department", "created_date"))
          .filter((d) => d.is_active !== false)
          .map((d) => ({ id: d.id, name: d.name, has_head: headsOfDepartment(d).length > 0 }))
      : [];
    return {
      item: serialize(view, viewer),
      manager,
      can_change_department: canChangeDepartment,
      departments,
      can_assign: manage && !!item.department_id,
      can_review: manage && !!view.assignee_email && !["resolved", "closed"].includes(item.status),
      can_work: canWorkClientItem(viewer, view),
      // The head of the department and the appointed executor answer the client here;
      // the client manager already has his own reply form.
      can_reply: !manager && canReplyClientItem(viewer, view),
      assignees: staff.map((u) => ({ email: u.email, name: fullNameOf(u) || u.email })),
      messages: messages
        .filter((m) => m.client_request_id === item.id)
        .filter((m) => (viewer.accountType === "client" ? !m.is_internal : true))
        .map((m) => ({
          id: m.id,
          text: m.text,
          author_name: m.author_name,
          from_role: m.from_role,
          kind: m.kind || "message",
          is_internal: !!m.is_internal,
          is_clarification: !!m.is_clarification,
          created_date: m.created_date,
        })),
      closed: ["resolved", "closed"].includes(item.status),
    };
  });

export const addClientMessage = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), text: z.string().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);
    const manager = isManager(viewer);
    if (!manager && item.author_email !== viewer.email) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    await sb.entities.ClientMessage.create({
      client_request_id: item.id,
      client_number: item.client_number,
      text: data.text,
      author_email: viewer.email,
      author_name: viewer.name,
      from_role: manager ? "manager" : "client",
      kind: "message",
      is_internal: false,
      is_clarification: false,
    });

    if (manager) {
      await notify(sb, { email: item.author_email, event: "client_reply", item });
    } else if (item.manager_email) {
      await notify(sb, { email: item.manager_email, event: "client_reply", item });
    }
    return { ok: true };
  });

// The head of the department or the appointed executor answers the client.
// A public answer lands in the client's own conversation; an internal one stays
// among the staff. Neither creates a new request.
export const replyClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      text: z.string().min(1).max(4000),
      visibility: z.enum(["public", "internal"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);
    const view = withExecutor(item, await clientExecutors(sb));
    if (!canReplyClientItem(viewer, view)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const message = await postClientReply(
      sb,
      item,
      viewer,
      data.text,
      data.visibility === "internal" ? "internal" : "public"
    );
    return { ok: true, id: message?.id || "" };
  });

export const getClientProfile = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    return { first_name: viewer.firstName, last_name: viewer.lastName, email: viewer.email };
  });

export const updateClientProfile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ first_name: z.string().min(1).max(80), last_name: z.string().min(1).max(80) }))
  .handler(async ({ data, context }) => {
    const sb = context.getBase44().asServiceRole;
    const users = await listAll(sb, "User", "created_date", 300);
    const me = users.find((u) => u.email === context.user.email);
    if (!me) throw Object.assign(new Error("User not found"), { status: 404 });
    const fullName = `${data.first_name} ${data.last_name}`.trim();
    await sb.entities.User.update(me.id, {
      first_name: data.first_name,
      last_name: data.last_name,
      full_name: fullName,
    });
    try {
      await context.getBase44().auth.updateMe({ full_name: fullName });
    } catch {
      // The stored profile row already holds the new name.
    }
    return { ok: true };
  });

export const getClientNotifications = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const all = await listAll(sb, "Notification", "-created_date", 200);
    const mine = all.filter((n) => n.recipient_email === viewer.email && n.scope === "client");
    return {
      items: mine.map((n) => ({
        id: n.id,
        event: n.event,
        number: n.request_number,
        request_id: n.request_id,
        is_read: !!n.is_read,
        created_date: n.created_date,
      })),
      unread: mine.filter((n) => !n.is_read).length,
    };
  });

export const markClientNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().optional(), all: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    if (data.all) {
      await sb.entities.Notification.updateMany(
        { recipient_email: viewer.email, scope: "client", is_read: false },
        { $set: { is_read: true } }
      );
      return { ok: true };
    }
    if (!data.id) return { ok: false };
    await sb.entities.Notification.update(data.id, { is_read: true });
    return { ok: true };
  });

// ---------------------------------------------------------------- manager side

export const listClientQueue = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ status: z.string().optional(), mine: z.boolean().optional() }).optional())
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const manager = isManager(viewer);
    // A head works his own departments; an employee only what was assigned to him.
    if (!manager && !["head", "employee"].includes(viewer.role)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    const sb = context.getBase44().asServiceRole;
    const [all, executors] = await Promise.all([
      listAll(sb, "ClientRequest", "-created_date", 500),
      clientExecutors(sb),
    ]);
    // Deleted client requests leave the queue; only an administrator may still see them.
    const live = all
      .filter((r) => !r.is_deleted || viewer.role === "admin")
      .map((r) => withExecutor(r, executors));
    const requests = manager
      ? live
      : viewer.managesDepartments
        ? live.filter((r) => !!r.department_id && viewer.managedDepartmentIds.includes(r.department_id))
        : live.filter((r) => !!r.assignee_email && r.assignee_email === viewer.email);
    let items = requests;
    if (data?.status) items = items.filter((r) => r.status === data.status);
    if (data?.mine) items = items.filter((r) => r.manager_email === viewer.email);

    const counts = {};
    CLIENT_STATUSES.forEach((status) => {
      counts[status] = requests.filter((r) => r.status === status).length;
    });

    return {
      items: items.map((r) => serialize(r, viewer)),
      counts: { ...counts, all: requests.length, open: requests.filter((r) => OPEN_CLIENT_STATUSES.includes(r.status)).length },
      viewer: {
        name: viewer.name,
        email: viewer.email,
        role: viewer.role,
        can_handoff: manager,
        can_assign: viewer.role === "admin" || viewer.managesDepartments,
      },
      statuses: CLIENT_STATUSES,
    };
  });

// Physical delete: a client may withdraw a request before a manager started working on it.
// The conversation and its notifications go with it; only the audit entry stays.
export const deleteClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    let item;
    try {
      item = await sb.entities.ClientRequest.get(data.id);
    } catch {
      throw Object.assign(new Error("Request not found"), { status: 404 });
    }
    if (!canClientDelete(item, viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });

    await sb.entities.AuditLog.create({
      user_email: viewer.email,
      user_name: viewer.name,
      action: "client_request_deleted",
      details: `${[item.client_number, item.title].filter(Boolean).join(" · ")} · автор: ${
        item.author_name || item.author_email || "—"
      }`,
      entity_type: "ClientRequest",
      entity_id: item.id,
    });

    await Promise.all([
      sb.entities.ClientMessage.deleteMany({ client_request_id: item.id }),
      sb.entities.Notification.deleteMany({ request_id: item.id }),
    ]);

    await sb.entities.ClientRequest.delete(item.id);
    return { ok: true };
  });

export const takeClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), status: z.enum(CLIENT_STATUSES).optional() }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (!isManager(viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);
    const patch = { manager_email: viewer.email, manager_name: viewer.name };
    if (data.status) patch.status = data.status;
    else if (item.status === "received") patch.status = "in_work";
    const updated = await sb.entities.ClientRequest.update(item.id, patch);
    await logEvent(sb, updated, viewer, viewer.name);
    if (updated.status === "in_work") {
      await notify(sb, { email: updated.author_email, event: "client_accepted", item: updated });
    }
    return { ok: true, status: updated.status };
  });

export const updateClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(CLIENT_STATUSES).optional(),
      result: z.string().max(4000).optional(),
      reply: z.string().max(4000).optional(),
      internal_note: z.string().max(4000).optional(),
      request_clarification: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (!isManager(viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);

    const patch = {};
    if (data.result !== undefined) patch.result = data.result;
    if (data.status && data.status !== item.status) patch.status = data.status;
    if (!item.manager_email) {
      patch.manager_email = viewer.email;
      patch.manager_name = viewer.name;
    }
    const updated = Object.keys(patch).length ? await sb.entities.ClientRequest.update(item.id, patch) : item;

    if (data.reply) {
      await sb.entities.ClientMessage.create({
        client_request_id: item.id,
        client_number: item.client_number,
        text: data.reply,
        author_email: viewer.email,
        author_name: viewer.name,
        from_role: "manager",
        kind: "message",
        is_internal: false,
        is_clarification: !!data.request_clarification,
      });
      await notify(sb, {
        email: item.author_email,
        event: data.request_clarification ? "client_clarification" : "client_reply",
        item: updated,
      });
    }

    if (data.internal_note) {
      await sb.entities.ClientMessage.create({
        client_request_id: item.id,
        client_number: item.client_number,
        text: data.internal_note,
        author_email: viewer.email,
        author_name: viewer.name,
        from_role: "manager",
        kind: "message",
        is_internal: true,
        is_clarification: false,
      });
    }

    if (data.request_clarification && !data.reply) {
      await notify(sb, { email: item.author_email, event: "client_clarification", item: updated });
    }

    if (patch.status) {
      await logEvent(sb, updated, viewer, patch.status);
      const event =
        updated.status === "closed"
          ? "client_closed"
          : updated.status === "answer_ready"
            ? "client_answer"
            : "client_status";
      await notify(sb, { email: item.author_email, event, item: updated });
    }

    return { ok: true, status: updated.status };
  });

// The head appoints an employee of his department. The internal twin gets the same
// executor, so the client request shows up in that employee's «Клиентские обращения».
export const assignClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), assignee_email: z.string().min(1).max(200) }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);
    if (!canManageClientItem(viewer, item)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    if (!item.internal_request_id) throw Object.assign(new Error("Not handed off"), { status: 400 });

    const staff = await departmentStaff(sb, item.department_id);
    const employee = staff.find((u) => u.email === data.assignee_email);
    if (!employee) throw Object.assign(new Error("Assignee is not in this department"), { status: 400 });

    let internal;
    try {
      internal = await sb.entities.Request.get(item.internal_request_id);
    } catch {
      throw Object.assign(new Error("Request not found"), { status: 404 });
    }

    const patch = {
      assignee_email: employee.email,
      assignee_name: fullNameOf(employee),
      assignee_id: employee.id,
    };
    // The appointment starts the work of a freshly handed request.
    if (internal.status === "new") patch.status = "inProgress";
    const updated = await sb.entities.Request.update(internal.id, patch);
    await sb.entities.RequestHistory.create({
      request_id: updated.id,
      request_number: updated.request_number || "",
      user_name: viewer.name,
      user_email: viewer.email,
      action: "assigned",
      field: "assignee",
      old_value: internal.assignee_name || "",
      new_value: fullNameOf(employee),
    });
    if (employee.email !== viewer.email) {
      await notify(sb, { email: employee.email, event: "client_assigned", item });
    }
    return { ok: true, assignee_name: fullNameOf(employee) };
  });

// The appointed employee works the client request and reports progress.
export const updateClientWork = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["in_work", "awaiting_internal", "answer_ready"]).optional(),
      comment: z.string().max(4000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);
    const view = withExecutor(item, await clientExecutors(sb));
    if (!canWorkClientItem(viewer, view)) throw Object.assign(new Error("Forbidden"), { status: 403 });

    const patch = {};
    if (data.status && data.status !== item.status) patch.status = data.status;
    const updated = Object.keys(patch).length ? await sb.entities.ClientRequest.update(item.id, patch) : item;

    if (data.comment?.trim()) {
      await sb.entities.ClientMessage.create({
        client_request_id: item.id,
        client_number: item.client_number,
        text: data.comment.trim(),
        author_email: viewer.email,
        author_name: viewer.name,
        from_role: "manager",
        kind: "message",
        is_internal: true,
        is_clarification: false,
      });
    }
    if (patch.status) await logEvent(sb, updated, viewer, patch.status);
    return { ok: true, status: updated.status };
  });

// The head verifies the work: he closes the client request or sends it back.
export const reviewClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      action: z.enum(["close", "return"]),
      result: z.string().max(4000).optional(),
      comment: z.string().max(4000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);
    if (!canManageClientItem(viewer, item)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const view = withExecutor(item, await clientExecutors(sb));
    const close = data.action === "close";

    const patch = { status: close ? "closed" : "in_work" };
    const result = (data.result || "").trim();
    if (close && result) patch.result = result;

    const updated = await sb.entities.ClientRequest.update(item.id, patch);
    if (data.comment?.trim()) {
      await sb.entities.ClientMessage.create({
        client_request_id: item.id,
        client_number: item.client_number,
        text: data.comment.trim(),
        author_email: viewer.email,
        author_name: viewer.name,
        from_role: "manager",
        kind: "message",
        is_internal: true,
        is_clarification: false,
      });
    }
    await logEvent(sb, updated, viewer, patch.status);
    if (close) {
      await notify(sb, { email: item.author_email, event: "client_closed", item: updated });
    } else if (view.assignee_email) {
      await notify(sb, { email: view.assignee_email, event: "client_returned", item: updated });
    }
    return { ok: true, status: updated.status };
  });

export const listHandoffOptions = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    if (!isManager(viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const [requests, departments] = await Promise.all([
      listAll(sb, "ClientRequest", "-created_date", 300),
      listAll(sb, "Department", "created_date"),
    ]);
    return {
      requests: requests
        .filter((r) => !r.internal_request_id && !["closed"].includes(r.status))
        .map((r) => ({ id: r.id, number: r.client_number, title: r.title })),
      // The manager picks a department only; its head and responsible people stay internal.
      departments: departments
        .filter((d) => d.is_active !== false)
        .map((d) => ({
          id: d.id,
          name: d.name,
          has_head: headsOfDepartment(d).length > 0,
        })),
    };
  });

export const handoffClientRequest = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), department_id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (!isManager(viewer)) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);
    if (item.internal_request_id) return { ok: false, reason: "already" };

    let department = null;
    try {
      department = await sb.entities.Department.get(data.department_id);
    } catch {
      return { ok: false, reason: "no_department" };
    }
    // Every head of the target department receives the handoff — and only they do.
    const heads = headsOfDepartment(department);
    if (!heads.length) {
      const users = await listAll(sb, "User", "created_date", 300);
      for (const admin of users.filter((u) => u.role === "admin")) {
        await notify(sb, { email: admin.email, event: "client_handoff_admin", item });
      }
      return { ok: false, reason: "no_head" };
    }
    const staff = await listAll(sb, "User", "created_date", 300);
    const headRecord = staff.find((u) => u.email === heads[0]);
    const headName = headRecord ? fullNameOf(headRecord) : department.manager_name || "";

    const settings = (await listAll(sb, "AppSettings", "created_date"))[0] || {
      sla_first_response_days: 3,
      sla_resolution_days: 10,
    };
    const typeMap = {
      complaint: "problem",
      suggestion: "idea",
      question: "question",
      gratitude: "gratitude",
      other: "other",
    };
    const now = Date.now();
    const internalNumber = await nextInternalNumber(sb);

    const internal = await sb.entities.Request.create({
      request_number: internalNumber,
      title: `${item.client_number} · ${item.title}`,
      description: item.description,
      proposed_solution: "",
      type: typeMap[item.type] || "other",
      category_id: "",
      category_key: "",
      department_id: department.id,
      author_name: item.author_name,
      author_email: item.author_email,
      priority: "medium",
      status: "new",
      manager_email: heads[0],
      manager_name: headName,
      recipient_id: headRecord?.id || "",
      assignee_email: "",
      assignee_name: "",
      first_response_due: new Date(now + (settings.sla_first_response_days ?? 3) * DAY).toISOString(),
      due_date: new Date(now + (settings.sla_resolution_days ?? 10) * DAY).toISOString(),
      is_demo: false,
      source: "client_request",
    });

    await sb.entities.RequestHistory.create({
      request_id: internal.id,
      request_number: internal.request_number,
      user_name: viewer.name,
      user_email: viewer.email,
      action: "created",
      note: `client_request:${item.client_number}`,
    });

    const updated = await sb.entities.ClientRequest.update(item.id, {
      status: "handed_off",
      department_id: department.id,
      department_name: department.name,
      internal_request_id: internal.id,
      internal_request_number: internal.request_number,
      handoff_by_email: viewer.email,
      handoff_by_name: viewer.name,
      handoff_at: new Date().toISOString(),
      manager_email: item.manager_email || viewer.email,
      manager_name: item.manager_name || viewer.name,
    });

    await logEvent(sb, updated, viewer, internal.request_number);
    await notify(sb, { email: item.author_email, event: "client_status", item: updated });

    // The handoff notice carries the subject, the client, the department and the
    // manager who actually forwarded it, and goes to the heads of the target
    // department only. The sender is the person who performed the action.
    const handoffDetails = {
      subject: item.title || "",
      client_name: item.author_name || item.author_email || "",
      manager_name: viewer.name || viewer.email,
      department_name: department.name || "",
    };
    for (const email of heads) {
      await notify(sb, { email, event: "client_handoff", item: updated, ...handoffDetails });
      // The same head also works the new request in the internal centre.
      await sb.entities.Notification.create({
        recipient_email: email,
        event: "new_request",
        scope: "internal",
        request_id: internal.id,
        request_number: internal.request_number,
        subject: handoffDetails.subject,
        client_name: handoffDetails.client_name,
        manager_name: handoffDetails.manager_name,
        department_name: handoffDetails.department_name,
        is_read: false,
      });
    }
    for (const chief of staff.filter((u) => u.staff_role === "chief" && u.account_status !== "blocked")) {
      await sb.entities.Notification.create({
        recipient_email: chief.email,
        event: "new_request",
        scope: "internal",
        request_id: internal.id,
        request_number: internal.request_number,
        is_read: false,
      });
    }
    return { ok: true, internal_number: internal.request_number };
  });

// The request moves to another department inside its own card: the number, the client,
// the conversation, the files and the history stay, only the receiving department and
// its head change. The internal twin moves with it, so the new head finds the same
// request in his «Назначено мне».
export const changeClientDepartment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string(), department_id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const item = await sb.entities.ClientRequest.get(data.id);

    // The client manager who leads the request, the head of its current department
    // and the administrator may move it; nobody else sees the control at all.
    if (!isManager(viewer) && !canManageClientItem(viewer, item)) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    return moveClientDepartment(sb, item, viewer, data.department_id);
  });

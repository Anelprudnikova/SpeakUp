// Staff answers on a client request: one public thread the client sees in his
// account, plus staff-only notes. Everything is stored on the client request
// itself, so a status change, a handoff or a reassignment never loses it.

import { headsOfDepartment, listAll } from "@/lib/rbac.server";

async function departmentHeadEmails(sb, departmentId) {
  if (!departmentId) return [];
  try {
    const department = await sb.entities.Department.get(departmentId);
    return headsOfDepartment(department);
  } catch {
    return [];
  }
}

// Saves the message on the client request and tells the people who must read it.
export async function postClientReply(sb, item, viewer, text, visibility = "public") {
  const internal = visibility === "internal";
  const body = (text || "").trim();
  if (!body) return null;

  const message = await sb.entities.ClientMessage.create({
    client_request_id: item.id,
    client_number: item.client_number || "",
    text: body,
    author_email: viewer.email,
    author_name: viewer.name,
    from_role: "manager",
    kind: "message",
    is_internal: internal,
    is_clarification: false,
  });

  const recipients = new Set();
  if (internal) {
    // A staff note stays among staff: the client manager and the department heads.
    if (item.manager_email) recipients.add(item.manager_email);
    for (const email of await departmentHeadEmails(sb, item.department_id)) recipients.add(email);
  } else {
    // A public answer reaches the client and the client manager who handles the request.
    if (item.author_email) recipients.add(item.author_email);
    if (item.manager_email) recipients.add(item.manager_email);
  }
  recipients.delete(viewer.email);

  for (const email of recipients) {
    await sb.entities.Notification.create({
      recipient_email: email,
      event: internal ? "client_internal_note" : email === item.author_email ? "client_reply" : "client_staff_reply",
      scope: "client",
      message: body.slice(0, 300),
      subject: item.title || "",
      client_name: item.author_name || item.author_email || "",
      manager_name: viewer.name || viewer.email,
      department_name: item.department_name || "",
      request_id: item.id,
      request_number: item.client_number || "",
      is_read: false,
    });
  }

  return message;
}

// A head or an executor answers inside the internal card of a handed-off client
// request: the answer is mirrored into the client's own conversation.
export async function mirrorAnswerToClient(sb, req, viewer, text) {
  if (!req || req.source !== "client_request") return null;
  const body = (text || "").trim();
  if (!body) return null;
  const rows = await listAll(sb, "ClientRequest", "-created_date", 500);
  const item = rows.find((r) => r.internal_request_id === req.id);
  if (!item) return null;
  return postClientReply(sb, item, viewer, body, "public");
}

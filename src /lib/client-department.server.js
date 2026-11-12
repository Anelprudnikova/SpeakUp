// Moving a forwarded client request to another department inside its own card.
// The request keeps its number, its client, its conversation and its files; only
// the receiving department and its head change, and the internal twin moves with it.

import { fullNameOf, headsOfDepartment, listAll } from "@/lib/rbac.server";

async function notify(sb, { email, event, item, details }) {
  if (!email) return;
  await sb.entities.Notification.create({
    recipient_email: email,
    event,
    scope: "client",
    message: "",
    subject: details.subject,
    client_name: details.client_name,
    manager_name: details.manager_name,
    department_name: details.department_name,
    request_id: item.id,
    request_number: item.client_number || "",
    is_read: false,
  });
}

export async function moveClientDepartment(sb, item, viewer, departmentId) {
  if (!item.internal_request_id || !item.department_id) return { ok: false, reason: "not_handed_off" };
  if (item.department_id === departmentId) return { ok: true, unchanged: true };

  let department;
  try {
    department = await sb.entities.Department.get(departmentId);
  } catch {
    return { ok: false, reason: "no_department" };
  }
  // A department without a head has nobody to receive the request.
  const heads = headsOfDepartment(department);
  if (!heads.length) return { ok: false, reason: "no_head" };

  // The previous department is resolved before the card is rewritten.
  let previousDepartment = null;
  try {
    previousDepartment = await sb.entities.Department.get(item.department_id);
  } catch {
    previousDepartment = null;
  }
  const previousHeads = headsOfDepartment(previousDepartment);

  const users = await listAll(sb, "User", "created_date", 300);
  const headRecord = users.find((u) => u.email === heads[0]);
  const headName = headRecord ? fullNameOf(headRecord) : department.manager_name || "";

  const updated = await sb.entities.ClientRequest.update(item.id, {
    department_id: department.id,
    department_name: department.name,
    handoff_by_email: viewer.email,
    handoff_by_name: viewer.name,
    handoff_at: new Date().toISOString(),
  });

  // The internal twin is the same request: its department and recipient change,
  // while the executor of the former department can no longer work it.
  let internal = null;
  try {
    internal = await sb.entities.Request.get(item.internal_request_id);
  } catch {
    internal = null;
  }
  let droppedAssignee = "";
  if (internal) {
    droppedAssignee = internal.assignee_email || "";
    const patch = {
      department_id: department.id,
      manager_email: heads[0],
      manager_name: headName,
      recipient_id: headRecord?.id || "",
    };
    if (droppedAssignee && !heads.includes(droppedAssignee)) {
      patch.assignee_email = "";
      patch.assignee_name = "";
      patch.assignee_id = "";
    }
    await sb.entities.Request.update(internal.id, patch);
    await sb.entities.RequestHistory.create({
      request_id: internal.id,
      request_number: internal.request_number || "",
      user_name: viewer.name,
      user_email: viewer.email,
      action: "department_changed",
      field: "department",
      old_value: previousDepartment?.name || item.department_name || "",
      new_value: department.name || "",
      note: droppedAssignee && droppedAssignee !== viewer.email ? `assignee:${droppedAssignee}` : "",
    });
  }

  // The move is a status-neutral event: the working status stays as it was.
  const details = {
    subject: item.title || "",
    client_name: item.author_name || item.author_email || "",
    manager_name: viewer.name || viewer.email,
    department_name: department.name || "",
  };
  for (const email of heads) {
    await notify(sb, { email, event: "client_reassigned", item: updated, details });
  }
  for (const email of previousHeads) {
    if (heads.includes(email)) continue;
    await notify(sb, { email, event: "client_department_left", item: updated, details });
  }
  if (droppedAssignee && !heads.includes(droppedAssignee) && !previousHeads.includes(droppedAssignee)) {
    await notify(sb, { email: droppedAssignee, event: "client_department_left", item: updated, details });
  }

  return {
    ok: true,
    department: department.name,
    internal_number: internal?.request_number || item.internal_request_number || "",
  };
}

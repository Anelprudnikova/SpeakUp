import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import {
  buildLookups,
  canManageRequest,
  canViewRequest,
  computeDue,
  isClosedStatus,
  listAll,
  loadViewer,
  serializeRequest,
} from "@/lib/rbac.server";

const STOP = new Set([
  "что","как","для","это","все","или","при","над","без","если","также","более","менее","нужно","надо","есть","быть",
  "который","которая","которые","чтобы","только","очень","сейчас","после","перед","между","через","также","своих",
  "обращение","обращения","предложение","проблема","вопрос","рабочих","работе","работы","данные","данных","employees",
  "request","about","which","there","their","would","could","should","these","those","with","from","have","this",
]);

function tokensOf(text) {
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .split(" ")
        .filter((w) => w.length > 4 && !STOP.has(w))
    )
  );
}

function monthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export const getAnalytics = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      months: z.number().min(3).max(12).optional(),
      department_id: z.string().optional(),
      category_id: z.string().optional(),
      status: z.string().optional(),
      priority: z.string().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (viewer.role === "employee") throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const [requests, lookups, history, links, issues] = await Promise.all([
      listAll(sb, "Request"),
      buildLookups(sb),
      listAll(sb, "RequestHistory", "-created_date", 1000),
      listAll(sb, "RelatedIssueRequest", "created_date", 500),
      listAll(sb, "RelatedIssue", "-created_date", 200),
    ]);

    let items = requests.filter((r) => canViewRequest(viewer, r));
    if (data.department_id) items = items.filter((r) => r.department_id === data.department_id);
    if (data.category_id) items = items.filter((r) => r.category_id === data.category_id);
    if (data.status) items = items.filter((r) => r.status === data.status);
    if (data.priority) items = items.filter((r) => r.priority === data.priority);

    const count = (arr, key) =>
      arr.reduce((acc, r) => {
        const k = r[key] || "none";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

    const byStatus = count(items, "status");
    const byPriority = count(items, "priority");

    const byCategory = Object.entries(count(items, "category_id"))
      .map(([id, value]) => {
        const cat = lookups.catsById[id];
        return { key: cat?.key || "", names: cat ? { ru: cat.name_ru, kk: cat.name_kk, en: cat.name_en } : null, value };
      })
      .sort((a, b) => b.value - a.value);

    const byDepartment = Object.entries(count(items, "department_id"))
      .map(([id, value]) => ({ name: lookups.deptsById[id]?.name || "—", value }))
      .sort((a, b) => b.value - a.value);

    const months = lastMonths(data.months || 6);
    const monthly = months.map((m) => ({
      month: m,
      created: items.filter((r) => monthKey(r.created_date) === m).length,
      closed: items.filter((r) => r.completed_date && monthKey(r.completed_date) === m).length,
    }));

    const withFirstResponse = items.filter((r) => r.first_response_at);
    const avgFirstResponseHours = withFirstResponse.length
      ? Math.round(
          (withFirstResponse.reduce(
            (sum, r) => sum + (new Date(r.first_response_at) - new Date(r.created_date)) / 3600000,
            0
          ) /
            withFirstResponse.length) *
            10
        ) / 10
      : null;

    const completed = items.filter((r) => r.completed_date);
    const avgResolutionDays = completed.length
      ? Math.round(
          (completed.reduce((sum, r) => sum + (new Date(r.completed_date) - new Date(r.created_date)) / 86400000, 0) /
            completed.length) *
            10
        ) / 10
      : null;

    const withDue = completed.filter((r) => r.due_date);
    const onTimeRate = withDue.length
      ? Math.round(
          (withDue.filter((r) => new Date(r.completed_date) <= new Date(r.due_date)).length / withDue.length) * 100
        )
      : null;

    const overdueCount = items.filter((r) => computeDue(r).isOverdue).length;
    const clarificationReturns = new Set(
      history.filter((h) => h.action === "clarification_requested").map((h) => h.request_id)
    );
    const implemented = items.filter((r) => ["implemented", "closed"].includes(r.status)).length;
    const visibleIds = new Set(items.map((i) => i.id));
    const issueCount = new Set(
      links.filter((l) => visibleIds.has(l.request_id)).map((l) => l.issue_id).concat(issues.map((i) => i.id))
    ).size;

    return {
      counts: {
        total: items.length,
        new: byStatus.new || 0,
        review: byStatus.review || 0,
        inProgress: byStatus.inProgress || 0,
        implemented: byStatus.implemented || 0,
        rejected: byStatus.rejected || 0,
        waiting: byStatus.waiting || 0,
        closed: byStatus.closed || 0,
        overdue: overdueCount,
        resolvedRate: items.length ? Math.round((implemented / items.length) * 100) : null,
        implementedRate: items.length ? Math.round((implemented / items.length) * 100) : null,
      },
      byPriority,
      byCategory,
      byDepartment,
      monthly,
      quality: {
        avgFirstResponseHours,
        avgResolutionDays,
        onTimeRate,
        clarificationReturns: clarificationReturns.size,
        recurringIssues: issueCount,
      },
      options: {
        departments: lookups.departments,
        categories: lookups.categories.filter((c) => c.is_active !== false),
      },
    };
  });

export const getRecurring = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    if (viewer.role === "employee") throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const [requests, lookups, issues, links] = await Promise.all([
      listAll(sb, "Request"),
      buildLookups(sb),
      listAll(sb, "RelatedIssue", "-created_date", 200),
      listAll(sb, "RelatedIssueRequest", "created_date", 500),
    ]);

    const visible = requests.filter((r) => canViewRequest(viewer, r) && canManageRequest(viewer, r));
    const byToken = new Map();
    visible.forEach((r) => {
      tokensOf(`${r.title} ${r.description}`).forEach((token) => {
        if (!byToken.has(token)) byToken.set(token, []);
        byToken.get(token).push(r);
      });
    });

    const used = new Set();
    const suggestions = [];
    Array.from(byToken.entries())
      .filter(([, group]) => group.length >= 2 && group.length <= 10)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([token, group]) => {
        const fresh = group.filter((r) => !used.has(r.id));
        if (fresh.length < 2) return;
        fresh.forEach((r) => used.add(r.id));
        suggestions.push({
          token,
          count: fresh.length,
          numbers: fresh.map((r) => r.request_number).filter(Boolean),
          request_ids: fresh.map((r) => r.id),
          category_names: fresh.map((r) => lookups.catsById[r.category_id]?.name_ru).filter(Boolean),
          departments: Array.from(new Set(fresh.map((r) => lookups.deptsById[r.department_id]?.name).filter(Boolean))),
          default_name: fresh[0]?.title || token,
        });
      });

    return {
      suggestions: suggestions.slice(0, 10),
      issues: issues.map((issue) => {
        const linked = links.filter((l) => l.issue_id === issue.id);
        const linkedRequests = linked
          .map((l) => requests.find((r) => r.id === l.request_id))
          .filter(Boolean)
          .map((r) => serializeRequest(r, lookups, viewer));
        return {
          id: issue.id,
          name: issue.name,
          description: issue.description || "",
          status: issue.status || "open",
          owner_email: issue.owner_email || "",
          actions: issue.actions || "",
          result: issue.result || "",
          created_date: issue.created_date,
          requests: linkedRequests.map((r) => ({
            id: r.id,
            number: r.number,
            title: r.title,
            status: r.status,
            department_name: r.department_name,
            created_date: r.created_date,
          })),
        };
      }),
    };
  });

export const createRelatedIssue = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      name: z.string().min(3).max(200),
      description: z.string().max(2000).optional(),
      request_ids: z.array(z.string()).min(1).max(50),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (viewer.role === "employee") throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const requests = await listAll(sb, "Request");
    const allowed = data.request_ids.filter((id) => {
      const req = requests.find((r) => r.id === id);
      return req && canManageRequest(viewer, req);
    });
    if (!allowed.length) throw Object.assign(new Error("Forbidden"), { status: 403 });

    const issue = await sb.entities.RelatedIssue.create({
      name: data.name,
      description: data.description || "",
      owner_email: viewer.email,
      status: "open",
    });
    await sb.entities.RelatedIssueRequest.bulkCreate(allowed.map((id) => ({ issue_id: issue.id, request_id: id })));
    await sb.entities.Request.updateMany({ id: { $in: allowed } }, { $set: { related_issue_id: issue.id } });
    await sb.entities.AuditLog.create({
      user_email: viewer.email,
      user_name: viewer.name,
      action: "related_issue_created",
      details: `Создана общая проблема «${data.name}» (${allowed.length} обращений)`,
      entity_type: "RelatedIssue",
      entity_id: issue.id,
    });
    return { id: issue.id };
  });

export const updateRelatedIssue = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string(),
      status: z.enum(["open", "in_progress", "resolved"]).optional(),
      actions: z.string().max(2000).optional(),
      result: z.string().max(2000).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await loadViewer(context);
    if (viewer.role === "employee") throw Object.assign(new Error("Forbidden"), { status: 403 });
    const sb = context.getBase44().asServiceRole;
    const patch = {};
    if (data.status) patch.status = data.status;
    if (data.actions !== undefined) patch.actions = data.actions;
    if (data.result !== undefined) patch.result = data.result;
    await sb.entities.RelatedIssue.update(data.id, patch);
    await sb.entities.AuditLog.create({
      user_email: viewer.email,
      user_name: viewer.name,
      action: "related_issue_updated",
      details: `Обновлена общая проблема (${data.status || "details"})`,
      entity_type: "RelatedIssue",
      entity_id: data.id,
    });
    return { ok: true, closed: isClosedStatus(data.status) };
  });

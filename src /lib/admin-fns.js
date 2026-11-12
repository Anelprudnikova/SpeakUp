import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "@/lib/auth-middleware";
import { fullNameOf, listAll, loadViewer } from "@/lib/rbac.server";
import demoDataset from "@/lib/demo-dataset.json";

const CATEGORY_SEED = [
  { key: "procurement", name_ru: "Закупки и снабжение", name_kk: "Сатып алу және жабдықтау", name_en: "Procurement & supply" },
  { key: "sales", name_ru: "Продажи", name_kk: "Сатылым", name_en: "Sales" },
  { key: "design", name_ru: "Проектирование", name_kk: "Жобалау", name_en: "Engineering & design" },
  { key: "finance", name_ru: "Бухгалтерия и финансы", name_kk: "Бухгалтерия және қаржы", name_en: "Accounting & finance" },
  { key: "hr", name_ru: "Персонал и обучение", name_kk: "Персонал және оқыту", name_en: "People & training" },
  { key: "internal", name_ru: "Внутренние процессы", name_kk: "Ішкі процестер", name_en: "Internal processes" },
  { key: "documents", name_ru: "Документооборот", name_kk: "Құжат айналымы", name_en: "Document flow" },
  { key: "it", name_ru: "IT и автоматизация", name_kk: "IT және автоматтандыру", name_en: "IT & automation" },
  { key: "conditions", name_ru: "Условия труда", name_kk: "Еңбек жағдайлары", name_en: "Work conditions" },
  { key: "communications", name_ru: "Коммуникации", name_kk: "Коммуникациялар", name_en: "Communications" },
  { key: "other", name_ru: "Другое", name_kk: "Басқа", name_en: "Other" },
];

const DEPARTMENT_SEED = [
  { key: "procurement", name: "Закупки и снабжение" },
  { key: "sales", name: "Продажи" },
  { key: "design", name: "Проектирование" },
  { key: "finance", name: "Бухгалтерия и финансы" },
  { key: "hr", name: "Персонал и обучение" },
  { key: "it", name: "IT и автоматизация" },
  { key: "internal", name: "Внутренние процессы" },
];

const CATEGORY_DEPARTMENT = {
  procurement: "procurement",
  sales: "sales",
  design: "design",
  finance: "finance",
  hr: "hr",
  it: "it",
  internal: "internal",
  documents: "internal",
  communications: "internal",
  conditions: "internal",
  other: "internal",
};

// The four roles of SpeakUp: employee, administrator, department head, client manager.
function orgRoleOf(user) {
  if (user?.role === "admin") return "admin";
  const value = user?.system_role || user?.access_level;
  if (["admin", "head", "client_manager"].includes(value)) return value;
  if (user?.staff_role === "chief" || user?.staff_role === "manager") return "head";
  return "employee";
}

async function requireAdmin(context) {
  const viewer = await loadViewer(context);
  if (viewer.role !== "admin") throw Object.assign(new Error("Forbidden"), { status: 403 });
  return viewer;
}

async function audit(sb, viewer, action, details, entityType = "", entityId = "") {
  await sb.entities.AuditLog.create({
    user_email: viewer.email,
    user_name: viewer.name,
    action,
    details,
    entity_type: entityType,
    entity_id: entityId,
  });
}

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const [users, departments] = await Promise.all([
      listAll(sb, "User", "created_date", 300),
      listAll(sb, "Department", "created_date"),
    ]);
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: fullNameOf(u) || "",
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        middle_name: u.middle_name || "",
        role: u.role || "user",
        // One canonical organisation role drives every screen.
        org_role: orgRoleOf(u),
        system_role: orgRoleOf(u),
        access_level: orgRoleOf(u),
        staff_role: u.staff_role || "employee",
        account_type: u.account_type || "staff",
        department_id: u.department_id || "",
        department_name: departments.find((d) => d.id === u.department_id)?.name || "",
        position: u.position || "",
        account_status: u.account_status || "active",
        language: u.language || "ru",
        created_date: u.created_date || "",
      })),
      departments,
    };
  });

export const updateUserAccess = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      email: z.string().email(),
      org_role: z.enum(["employee", "admin", "head", "client_manager"]).optional(),
      department_id: z.string().optional(),
      position: z.string().max(200).optional(),
      account_status: z.enum(["active", "blocked"]).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const users = await listAll(sb, "User", "created_date", 300);
    const target = users.find((u) => u.email === data.email);
    if (!target) throw Object.assign(new Error("User not found"), { status: 404 });

    const patch = {};
    // The role is stored in both selects and always resolves to the same four values.
    if (data.org_role) {
      patch.system_role = data.org_role;
      patch.access_level = data.org_role;
      patch.role = data.org_role === "admin" ? "admin" : "user";
      patch.account_type = "staff";
      patch.staff_role = data.org_role === "head" ? "manager" : "employee";
    }
    if (data.department_id !== undefined) patch.department_id = data.department_id;
    if (data.position !== undefined) patch.position = data.position;
    if (data.account_status) patch.account_status = data.account_status;
    await sb.entities.User.update(target.id, patch);

    // Only administrators bind people to departments; a head is bound as the head.
    if (data.department_id !== undefined || data.org_role) {
      const departments = await listAll(sb, "Department", "created_date");
      const role = data.org_role || orgRoleOf(target);
      const deptId = data.department_id !== undefined ? data.department_id : target.department_id;
      for (const department of departments) {
        const heads = Array.isArray(department.manager_emails) ? department.manager_emails : [];
        const shouldHead = role === "head" && department.id === deptId;
        const nextHeads = shouldHead
          ? [...new Set([...heads, data.email])]
          : heads.filter((email) => email !== data.email);
        const changed =
          nextHeads.length !== heads.length || nextHeads.some((email, i) => email !== heads[i]);
        if (!changed) continue;
        await sb.entities.Department.update(department.id, {
          manager_emails: nextHeads,
          manager_email: nextHeads[0] || "",
          manager_name: nextHeads[0]
            ? fullNameOf(users.find((u) => u.email === nextHeads[0])) || nextHeads[0]
            : "",
        });
      }
    }

    await audit(sb, viewer, "user_access_updated", `${data.email}: ${JSON.stringify(patch)}`, "User", target.id);
    return { ok: true };
  });

export const adminListDepartments = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const [items, users] = await Promise.all([
      listAll(sb, "Department", "created_date"),
      listAll(sb, "User", "created_date", 300),
    ]);
    const directory = users
      .filter((u) => u.account_status !== "blocked" && u.account_type !== "client")
      .map((u) => ({
        email: u.email,
        name: fullNameOf(u) || u.email,
        staff_role: u.staff_role || "employee",
        org_role: orgRoleOf(u),
      }));
    return {
      items,
      // Any registered person may head a department; the form splits them by role.
      people: directory.filter((u) => u.org_role !== "admin"),
      // Names of the people already linked to departments resolve through this list.
      users: directory,
    };
  });

export const saveDepartment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      name: z.string().min(2).max(120),
      description: z.string().max(500).optional(),
      manager_email: z.string().max(200).optional(),
      manager_emails: z.array(z.string().max(200)).max(20).optional(),
      is_active: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const users = await listAll(sb, "User", "created_date", 300);

    // A department may have one or several heads, all of them registered users.
    const requested = Array.isArray(data.manager_emails)
      ? data.manager_emails.filter(Boolean)
      : data.manager_email
        ? [data.manager_email]
        : [];
    // Heading a department is only this link: the person's role, rights and
    // access level stay exactly as the administrator set them.
    const heads = [];
    for (const email of [...new Set(requested)]) {
      const manager = users.find((u) => u.email === email);
      if (!manager) throw Object.assign(new Error("Manager not found"), { status: 400 });
      heads.push(manager.email);
    }

    const payload = {
      name: data.name,
      description: data.description || "",
      manager_emails: heads,
      manager_email: heads[0] || "",
      manager_name: heads[0] ? fullNameOf(users.find((u) => u.email === heads[0])) || heads[0] : "",
      is_active: data.is_active !== false,
    };
    if (data.id) await sb.entities.Department.update(data.id, payload);
    else await sb.entities.Department.create(payload);
    await audit(sb, viewer, "department_saved", data.name, "Department", data.id || "");
    return { ok: true };
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const requests = await listAll(sb, "Request");
    const used = requests.some((r) => r.department_id === data.id);
    if (used) {
      await sb.entities.Department.update(data.id, { is_active: false });
      await audit(sb, viewer, "department_deactivated", data.id, "Department", data.id);
      return { deactivated: true };
    }
    await sb.entities.Department.delete(data.id);
    await audit(sb, viewer, "department_deleted", data.id, "Department", data.id);
    return { deactivated: false };
  });

export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const [items, departments] = await Promise.all([
      listAll(sb, "Category", "created_date"),
      listAll(sb, "Department", "created_date"),
    ]);
    return { items, departments: departments.filter((d) => d.is_active !== false) };
  });

const CATEGORY_LANGS = ["ru", "kk", "en"];

// A readable technical key derived from the name, unique across categories.
function buildCategoryKey(name, taken) {
  const base = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stem = base.length >= 2 ? base : "category";
  let key = stem;
  let suffix = 2;
  while (taken.has(key)) {
    key = `${stem}-${suffix}`;
    suffix += 1;
  }
  return key;
}

// Detects the language of the entered name and prepares the other two.
// A failed translation never blocks saving the category.
async function translateCategory(context, name) {
  try {
    const result = await context.getBase44().asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Название категории обращений сотрудников компании: «${name}». Определи язык этого названия (ru, kk или en) и переведи его на русский, казахский и английский. Переводы — короткие названия раздела, без пояснений, кавычек и точек. Верни JSON.`,
      response_json_schema: {
        type: "object",
        properties: {
          language: { type: "string", enum: ["ru", "kk", "en"] },
          ru: { type: "string" },
          kk: { type: "string" },
          en: { type: "string" },
        },
        required: ["language", "ru", "kk", "en"],
      },
    });
    const parsed = typeof result === "string" ? JSON.parse(result) : result;
    const language = CATEGORY_LANGS.includes(parsed?.language) ? parsed.language : "ru";
    return {
      language,
      ru: parsed?.ru || name,
      kk: parsed?.kk || "",
      en: parsed?.en || "",
    };
  } catch {
    return { language: "ru", ru: name, kk: "", en: "" };
  }
}

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      name: z.string().max(120).optional(),
      name_ru: z.string().max(120).optional(),
      name_kk: z.string().max(120).optional(),
      name_en: z.string().max(120).optional(),
      description: z.string().max(500).optional(),
      department_id: z.string().max(80).optional(),
      is_active: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const existing = await listAll(sb, "Category", "created_date");

    if (data.id) {
      const current = existing.find((c) => c.id === data.id);
      if (!current) throw Object.assign(new Error("Category not found"), { status: 404 });
      const patch = {
        description: data.description ?? current.description ?? "",
        department_id: data.department_id ?? current.department_id ?? "",
        is_active: data.is_active !== false,
      };
      // A new main name is translated again; explicit per-language fields win.
      if (data.name && data.name.trim().length >= 2) {
        const translated = await translateCategory(context, data.name.trim());
        patch.name_ru = translated.ru;
        patch.name_kk = translated.kk;
        patch.name_en = translated.en;
      }
      CATEGORY_LANGS.forEach((code) => {
        if (data[`name_${code}`] !== undefined) patch[`name_${code}`] = data[`name_${code}`];
      });
      if (!patch.name_ru) patch.name_ru = current.name_ru;
      await sb.entities.Category.update(data.id, patch);
      await audit(sb, viewer, "category_saved", patch.name_ru, "Category", data.id);
      return { ok: true, item: { ...current, ...patch } };
    }

    const source = (data.name || data.name_ru || "").trim();
    if (source.length < 2) throw Object.assign(new Error("Name required"), { status: 400 });
    const translated = await translateCategory(context, source);
    const payload = {
      key: buildCategoryKey(source, new Set(existing.map((c) => c.key).filter(Boolean))),
      name_ru: data.name_ru || translated.ru || source,
      name_kk: data.name_kk ?? translated.kk ?? "",
      name_en: data.name_en ?? translated.en ?? "",
      description: data.description || "",
      department_id: data.department_id || "",
      is_active: true,
    };
    const created = await sb.entities.Category.create(payload);
    await audit(sb, viewer, "category_saved", payload.name_ru, "Category", created?.id || "");
    return { ok: true, item: created };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const requests = await listAll(sb, "Request");
    const used = requests.some((r) => r.category_id === data.id);
    if (used) {
      await sb.entities.Category.update(data.id, { is_active: false });
      await audit(sb, viewer, "category_deactivated", data.id, "Category", data.id);
      return { deactivated: true };
    }
    await sb.entities.Category.delete(data.id);
    await audit(sb, viewer, "category_deleted", data.id, "Category", data.id);
    return { deactivated: false };
  });

export const listRoutingRules = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const [rules, categories, departments, users] = await Promise.all([
      listAll(sb, "RoutingRule", "created_date"),
      listAll(sb, "Category", "created_date"),
      listAll(sb, "Department", "created_date"),
      listAll(sb, "User", "created_date", 300),
    ]);
    return {
      items: rules.map((r) => ({
        id: r.id,
        category_id: r.category_id,
        category_name: categories.find((c) => c.id === r.category_id)?.name_ru || "—",
        department_id: r.department_id || "",
        department_name: departments.find((d) => d.id === r.department_id)?.name || "—",
        responsible_email: r.responsible_email || "",
        is_active: r.is_active !== false,
      })),
      categories,
      departments,
      managers: users
        .filter((u) => u.staff_role === "manager" || u.role === "admin")
        .map((u) => ({ email: u.email, name: u.full_name || u.email })),
    };
  });

export const saveRoutingRule = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      id: z.string().optional(),
      category_id: z.string().min(1),
      department_id: z.string().optional(),
      responsible_email: z.string().max(200).optional(),
      is_active: z.boolean().optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const categories = await listAll(sb, "Category", "created_date");
    const category = categories.find((c) => c.id === data.category_id);
    const payload = {
      category_id: data.category_id,
      category_key: category?.key || "",
      department_id: data.department_id || "",
      responsible_email: data.responsible_email || "",
      is_active: data.is_active !== false,
    };
    if (data.id) await sb.entities.RoutingRule.update(data.id, payload);
    else await sb.entities.RoutingRule.create(payload);
    await audit(sb, viewer, "routing_rule_saved", category?.name_ru || data.category_id, "RoutingRule", data.id || "");
    return { ok: true };
  });

export const deleteRoutingRule = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    await sb.entities.RoutingRule.delete(data.id);
    await audit(sb, viewer, "routing_rule_deleted", data.id, "RoutingRule", data.id);
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const items = await listAll(sb, "AuditLog", "-created_date", 200);
    return { items };
  });

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const rows = await listAll(sb, "AppSettings", "created_date");
    return { settings: rows[0] || null };
  });

export const saveAppSettings = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(
    z.object({
      sla_first_response_days: z.number().min(1).max(60),
      sla_resolution_days: z.number().min(1).max(120),
      company_name: z.string().max(120).optional(),
    })
  )
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const rows = await listAll(sb, "AppSettings", "created_date");
    const payload = {
      sla_first_response_days: data.sla_first_response_days,
      sla_resolution_days: data.sla_resolution_days,
      company_name: data.company_name || "Модус Трейд",
    };
    if (rows[0]) await sb.entities.AppSettings.update(rows[0].id, payload);
    else await sb.entities.AppSettings.create(payload);
    await audit(sb, viewer, "settings_saved", JSON.stringify(payload), "AppSettings", rows[0]?.id || "");
    return { ok: true };
  });

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;

    const existingCategories = await listAll(sb, "Category", "created_date");
    const categoryIdByKey = {};
    for (const cat of CATEGORY_SEED) {
      const found = existingCategories.find((c) => c.key === cat.key);
      if (found) categoryIdByKey[cat.key] = found.id;
      else {
        const created = await sb.entities.Category.create({ ...cat, is_active: true });
        categoryIdByKey[cat.key] = created.id;
      }
    }

    const existingDepartments = await listAll(sb, "Department", "created_date");
    const departmentIdByKey = {};
    for (const dept of DEPARTMENT_SEED) {
      const found = existingDepartments.find((d) => d.name === dept.name);
      if (found) departmentIdByKey[dept.key] = found.id;
      else {
        const created = await sb.entities.Department.create({ name: dept.name, description: "", is_active: true });
        departmentIdByKey[dept.key] = created.id;
      }
    }

    const rules = await listAll(sb, "RoutingRule", "created_date", 200);
    for (const cat of CATEGORY_SEED) {
      if (rules.some((r) => r.category_id === categoryIdByKey[cat.key])) continue;
      await sb.entities.RoutingRule.create({
        category_id: categoryIdByKey[cat.key],
        category_key: cat.key,
        department_id: departmentIdByKey[CATEGORY_DEPARTMENT[cat.key]] || "",
        responsible_email: "",
        is_active: true,
      });
    }

    const settingsRows = await listAll(sb, "AppSettings", "created_date");
    if (!settingsRows.length) {
      await sb.entities.AppSettings.create({
        allow_confidential: true,
        sla_first_response_days: 3,
        sla_resolution_days: 10,
        company_name: "Модус Трейд",
      });
    }

    const existingRequests = await listAll(sb, "Request");
    const existingNumbers = new Set(existingRequests.map((r) => r.request_number));
    const toCreate = demoDataset
      .filter((item) => !existingNumbers.has(item.number))
      .map((item) => ({
        request_number: item.number,
        title: item.title,
        description: item.description,
        proposed_solution: item.proposed_solution || "",
        type: item.type,
        category_id: categoryIdByKey[item.category] || "",
        category_key: item.category,
        department_id: departmentIdByKey[CATEGORY_DEPARTMENT[item.category]] || "",
        author_name: "",
        author_email: "",
        privacy_mode: "normal",
        priority: item.priority,
        status: item.status,
        manager_email: "",
        manager_name: "",
        assignee_email: "",
        assignee_name: "",
        decision_reason: item.decision_reason || "",
        result: item.result || "",
        is_demo: true,
        source: "organizer_dataset",
      }));

    if (toCreate.length) {
      const created = await sb.entities.Request.bulkCreate(toCreate);
      const list = Array.isArray(created) ? created : created?.items || [];
      for (const req of list) {
        await sb.entities.RequestHistory.create({
          request_id: req.id,
          request_number: req.request_number,
          user_name: viewer.name,
          user_email: viewer.email,
          action: "imported",
          note: "Обращение из датасета организатора",
        });
      }
    }

    await audit(sb, viewer, "demo_dataset_loaded", `Добавлено ${toCreate.length} записей`, "Request", "");
    return { created: toCreate.length, total: existingNumbers.size + toCreate.length };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const requests = await listAll(sb, "Request");
    const demoIds = requests.filter((r) => r.is_demo).map((r) => r.id);
    if (demoIds.length) {
      await sb.entities.Comment.deleteMany({ request_id: { $in: demoIds } });
      await sb.entities.RequestHistory.deleteMany({ request_id: { $in: demoIds } });
      await sb.entities.Attachment.deleteMany({ request_id: { $in: demoIds } });
      await sb.entities.RelatedIssueRequest.deleteMany({ request_id: { $in: demoIds } });
      await sb.entities.Request.deleteMany({ id: { $in: demoIds } });
    }
    await audit(sb, viewer, "demo_dataset_cleared", `Удалено ${demoIds.length} записей`, "Request", "");
    return { deleted: demoIds.length };
  });

// Deactivation blocks the sign-in gate but keeps the account, its requests and history.
export const setUserAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ email: z.string().email(), status: z.enum(["active", "blocked"]) }))
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    const sb = context.getBase44().asServiceRole;
    const users = await listAll(sb, "User", "created_date", 300);
    const target = users.find((u) => u.email === data.email);
    if (!target) throw Object.assign(new Error("User not found"), { status: 404 });
    if (target.email === viewer.email) throw Object.assign(new Error("Cannot change own access"), { status: 400 });
    await sb.entities.User.update(target.id, { account_status: data.status });
    await audit(
      sb,
      viewer,
      data.status === "blocked" ? "user_deactivated" : "user_activated",
      data.email,
      "User",
      target.id
    );
    return { ok: true, status: data.status };
  });

// Deleting the profile row removes access while every request, comment and history
// entry keeps the author's name and email.
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data, context }) => {
    const viewer = await requireAdmin(context);
    if (data.email === viewer.email) throw Object.assign(new Error("Cannot delete own account"), { status: 400 });
    const sb = context.getBase44().asServiceRole;
    const users = await listAll(sb, "User", "created_date", 300);
    const target = users.find((u) => u.email === data.email);
    if (!target) throw Object.assign(new Error("User not found"), { status: 404 });

    const departments = await listAll(sb, "Department", "created_date");
    for (const department of departments.filter((d) => d.manager_email === data.email)) {
      await sb.entities.Department.update(department.id, { manager_email: "", manager_name: "" });
    }
    const settings = await listAll(sb, "UserNotificationSettings", "created_date", 300);
    for (const row of settings.filter((s) => s.user_email === data.email)) {
      await sb.entities.UserNotificationSettings.delete(row.id);
    }
    await sb.entities.User.delete(target.id);
    await audit(sb, viewer, "user_deleted", data.email, "User", target.id);
    return { ok: true };
  });

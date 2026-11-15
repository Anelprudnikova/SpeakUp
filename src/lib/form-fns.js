import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";
import { buildLookups, loadViewer } from "@/lib/rbac.server";

export const getFormOptions = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const viewer = await loadViewer(context);
    const sb = context.getBase44().asServiceRole;
    const lookups = await buildLookups(sb);
    return {
      categories: lookups.categories.filter((c) => c.is_active !== false),
      departments: lookups.departments.filter((d) => d.is_active !== false),
      viewer_department_id: viewer.departmentId || "",
    };
  });

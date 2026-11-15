import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, UserCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { categoryName, formatDate } from "@/lib/roles";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

export default function RequestCard({ request }) {
  const { t, lang } = useI18n();

  return (
    <div className="speakup-card p-4 transition-all duration-200 hover:shadow-lg hover:shadow-navy/5 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-muted-foreground">{request.number}</span>
            <StatusBadge value={request.status} />
            {request.is_assignee ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#20AFA4]/25 bg-[#20AFA4]/10 px-2 py-1 text-[11px] font-semibold text-[#158078]">
                <UserCheck className="h-3 w-3" /> {t("detail.assignee")}
              </span>
            ) : null}
          </div>
          <Link
            to="/requests/$requestId"
            params={{ requestId: request.id }}
            className="mt-2 block text-[15px] font-semibold leading-snug text-navy transition hover:text-primary"
          >
            {request.title}
          </Link>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{request.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>{categoryName(request.category_names, lang)}</span>
            {request.department_name ? <span>· {request.department_name}</span> : null}
            <span>· {formatDate(request.created_date, lang)}</span>
            {request.author_name ? <span>· {request.author_name}</span> : null}
            {request.assignee_name ? <span>· {t("dist.assignedTo", { name: request.assignee_name })}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <PriorityBadge value={request.priority} />
          {request.is_overdue ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
              <AlertTriangle className="h-3 w-3" /> {t("common.overdue")}
            </span>
          ) : null}
          {!request.is_overdue && request.is_due_soon ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309]">
              <Clock className="h-3 w-3" /> {t("common.dueSoon")}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

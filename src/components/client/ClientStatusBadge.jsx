import { CLIENT_STATUS_STYLES } from "@/lib/roles";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function ClientStatusBadge({ status }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        CLIENT_STATUS_STYLES[status] || "bg-muted text-muted-foreground border-border"
      )}
    >
      {t(`client.status.${status}`)}
    </span>
  );
}

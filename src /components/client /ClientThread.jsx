import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/roles";
import { cn } from "@/lib/utils";

export default function ClientThread({ messages, managerView }) {
  const { t, lang } = useI18n();
  if (!messages?.length) {
    return <p className="rounded-xl bg-muted/60 px-4 py-6 text-center text-xs text-muted-foreground">{t("client.messages")} — 0</p>;
  }
  return (
    <ul className="space-y-2.5">
      {messages.map((message) => {
        const staff = message.from_role === "manager" || message.from_role === "system";
        if (message.kind === "event") {
          return (
            <li key={message.id} className="text-center text-[11px] text-muted-foreground">
              {staff ? `${message.author_name} · ` : ""}
              {formatDateTime(message.created_date, lang)}
            </li>
          );
        }
        return (
          <li key={message.id} className={cn("flex", staff ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                message.is_internal
                  ? "border border-dashed border-[#7957E8]/40 bg-[#7957E8]/[0.06] text-navy"
                  : staff
                    ? "bg-muted text-navy"
                    : "bg-primary text-primary-foreground"
              )}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                {message.is_internal ? `${t("mgr.internalNote")} · ` : ""}
                {message.author_name} · {formatDateTime(message.created_date, lang)}
              </p>
              <p className="whitespace-pre-line leading-relaxed">{message.text}</p>
              {managerView && message.is_clarification ? (
                <p className="mt-1 text-[10px] font-medium text-[#B45309]">{t("client.status.clarification")}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

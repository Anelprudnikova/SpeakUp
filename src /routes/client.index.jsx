import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, PlusCircle } from "lucide-react";
import ClientStatusBadge from "@/components/client/ClientStatusBadge";
import { getClientHome } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

export const Route = createFileRoute("/client/")({
  head: () => ({ meta: [{ title: "SpeakUp — Кабинет клиента" }] }),
  component: ClientHomePage,
});

function ClientHomePage() {
  const { t, lang } = useI18n();
  const fetchHome = useServerFn(getClientHome);
  const { data, isLoading } = useQuery({ queryKey: ["client-home"], queryFn: () => fetchHome() });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  const stats = data?.stats || { total: 0, open: 0, resolved: 0 };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">
            {t("client.greeting", { name: data?.name || "" })}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("client.homeSub")}</p>
        </div>
        <Link
          to="/client/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
        >
          <PlusCircle className="h-4 w-4" /> {t("client.newRequest")}
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: t("client.myTotal"), value: stats.total },
          { label: t("client.inWork"), value: stats.open },
          { label: t("client.resolved"), value: stats.resolved },
        ].map((card) => (
          <div key={card.label} className="speakup-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-navy">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="speakup-card p-5">
        <h2 className="font-heading text-base font-semibold text-navy">{t("client.recent")}</h2>
        {data?.recent?.length ? (
          <ul className="mt-3 divide-y divide-border">
            {data.recent.map((item) => (
              <li key={item.id}>
                <Link
                  to="/client/requests/$clientRequestId"
                  params={{ clientRequestId: item.id }}
                  className="flex flex-wrap items-center gap-3 py-3 transition hover:text-primary"
                >
                  <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">{item.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy">{item.title}</span>
                  <ClientStatusBadge status={item.status} />
                  <span className="text-[11px] text-muted-foreground">{formatDate(item.created_date, lang)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl bg-muted/60 px-4 py-8 text-center">
            <FileText className="mx-auto h-6 w-6 text-muted-foreground/60" />
            <p className="mt-2 text-sm font-medium text-navy">{t("client.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("client.emptyHint")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

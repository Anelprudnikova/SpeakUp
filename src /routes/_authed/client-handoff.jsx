import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { handoffClientRequest, listHandoffOptions } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/client-handoff")({
  head: () => ({ meta: [{ title: "SpeakUp — Направить обращение" }] }),
  component: ClientHandoffPage,
});

function ClientHandoffPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchOptions = useServerFn(listHandoffOptions);
  const handoff = useServerFn(handoffClientRequest);
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-handoff-options"],
    queryFn: () => fetchOptions(),
    retry: false,
  });
  const [requestId, setRequestId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [notice, setNotice] = useState(null);

  const mutation = useMutation({
    mutationFn: () => handoff({ data: { id: requestId, department_id: departmentId } }),
    onSuccess: (result) => {
      if (result?.ok) {
        setNotice({ ok: true, text: t("mgr.handoffDone", { number: result.internal_number }) });
        setRequestId("");
        setDepartmentId("");
        queryClient.invalidateQueries({ queryKey: ["client-handoff-options"] });
        queryClient.invalidateQueries({ queryKey: ["client-queue"] });
      } else {
        setNotice({ ok: false, text: t("mgr.handoffNoHead") });
      }
    },
    onError: () => setNotice({ ok: false, text: t("common.error") }),
  });

  if (error) {
    return <p className="speakup-card p-6 text-sm text-muted-foreground">{t("mgr.forbidden")}</p>;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("mgr.handoffTitle")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("mgr.handoffSub")}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setNotice(null);
            if (requestId && departmentId) mutation.mutate();
          }}
          className="speakup-card space-y-4 p-5 sm:p-6"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("mgr.selectRequest")}</span>
            <select
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">{t("mgr.chooseRequest")}</option>
              {(data?.requests || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} · {item.title}
                </option>
              ))}
            </select>
            {!data?.requests?.length ? (
              <span className="mt-1 block text-[11px] text-muted-foreground">{t("mgr.noOpenRequests")}</span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("mgr.selectDepartment")}</span>
            <select
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            >
              <option value="">{t("mgr.chooseDepartment")}</option>
              {(data?.departments || []).map((department) => (
                <option key={department.id} value={department.id} disabled={!department.has_head}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          {notice ? (
            <p
              className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium ${
                notice.ok ? "bg-[#20AFA4]/10 text-[#158078]" : "bg-destructive/10 text-destructive"
              }`}
            >
              {notice.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {notice.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={mutation.isPending || !requestId || !departmentId}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {t("mgr.submitHandoff")}
          </button>
        </form>
      )}
    </div>
  );
}

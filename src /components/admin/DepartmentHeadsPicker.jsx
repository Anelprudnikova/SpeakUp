import { useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Any registered person may head a department: the tabs only narrow the list by role.
const TABS = [
  { key: "head", label: "admin.tabHeads" },
  { key: "employee", label: "admin.tabEmployees" },
  { key: "client_manager", label: "admin.tabManagers" },
];

export default function DepartmentHeadsPicker({ people = [], selected = [], onToggle, nameOf }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("head");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const options = people.filter(
    (person) =>
      person.org_role === tab &&
      !selected.includes(person.email) &&
      (!q || [person.name, person.email].some((value) => (value || "").toLowerCase().includes(q)))
  );

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("admin.heads")}
      </p>

      {selected.length ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary"
            >
              {nameOf(email)}
              <button type="button" onClick={() => onToggle(email)} aria-label={t("common.delete")}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition",
              tab === item.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
            )}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <label className="relative mt-2 block sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("admin.searchUsers")}
          className="w-full rounded-xl border border-input bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((person) => (
          <button
            key={person.email}
            type="button"
            onClick={() => onToggle(person.email)}
            className="rounded-xl border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            {person.name}
          </button>
        ))}
        {!options.length ? (
          <span className="text-[11px] text-muted-foreground">{q ? t("admin.noUsers") : t("admin.emptyTab")}</span>
        ) : null}
      </div>

      <p className="mt-1 text-[11px] text-muted-foreground">{t("admin.headsHint")}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{t("admin.headsRoleHint")}</p>
    </div>
  );
}

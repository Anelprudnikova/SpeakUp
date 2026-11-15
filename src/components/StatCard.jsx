import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-[#4263EB]/10 text-[#4263EB]",
  violet: "bg-[#7957E8]/10 text-[#7957E8]",
  teal: "bg-[#20AFA4]/12 text-[#158078]",
  muted: "bg-slate-500/10 text-slate-600",
  amber: "bg-[#F59E0B]/12 text-[#B45309]",
};

export default function StatCard({ icon: Icon, label, value, tone = "primary", hint, to }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 font-heading text-3xl font-semibold leading-none text-navy">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONES[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  if (to) {
    return (
      <a href={to} className="speakup-card block p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-navy/5">
        {body}
      </a>
    );
  }

  return <div className="speakup-card p-5">{body}</div>;
}

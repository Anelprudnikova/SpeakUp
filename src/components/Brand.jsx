import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The SpeakUp brand mark: the product name leads, «Модус Трейд» sits under it as a
// signature, the slogan below that. Blue, violet and teal are all part of the mark.
const SIZES = {
  sm: { mark: "h-9 w-9 rounded-[10px] text-[15px]", name: "text-[17px]", company: "text-[8px]", slogan: "text-[9px]" },
  md: { mark: "h-11 w-11 rounded-xl text-lg", name: "text-xl", company: "text-[9px]", slogan: "text-[10px]" },
  lg: { mark: "h-14 w-14 rounded-2xl text-2xl", name: "text-[32px]", company: "text-[11px]", slogan: "text-xs" },
};

export default function Brand({ size = "md", withSlogan = true, className }) {
  const { t } = useI18n();
  const s = SIZES[size] ?? SIZES.md;

  return (
    <div className={cn("select-none", className)}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "relative flex shrink-0 items-center justify-center bg-gradient-to-br from-[#4263EB] via-[#7957E8] to-[#20AFA4] font-heading font-extrabold text-white shadow-lg shadow-[#4263EB]/30",
            s.mark
          )}
          aria-hidden="true"
        >
          S
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#20AFA4]" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className={cn("block bg-gradient-to-r from-[#4263EB] via-[#7957E8] to-[#20AFA4] bg-clip-text font-heading font-extrabold tracking-tight text-transparent", s.name)}>
            SpeakUp
          </span>
          <span className={cn("mt-0.5 block font-semibold uppercase tracking-[0.16em] text-navy/70", s.company)}>
            Модус Трейд
          </span>
        </span>
      </div>
      {withSlogan ? (
        <p className={cn("mt-2 flex items-center gap-1.5 text-muted-foreground", s.slogan)}>
          <span className="h-1 w-1 shrink-0 rounded-full bg-[#20AFA4]" aria-hidden="true" />
          {t("app.tagline")}
        </p>
      ) : null}
    </div>
  );
}

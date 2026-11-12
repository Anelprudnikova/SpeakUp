import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LABELS = { ru: "RU", kk: "KZ", en: "EN" };

// Compact RU / KZ / EN switch. `onGradient` styles it for the auth screens.
export default function LangSwitch({ onGradient = false, className }) {
  const { lang, setLang, langs } = useI18n();

  return (
    <div
      role="group"
      aria-label="RU / KZ / EN"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-1",
        onGradient ? "bg-white/15 ring-1 ring-white/30 backdrop-blur" : "bg-muted ring-1 ring-border",
        className
      )}
    >
      {langs.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLang(item.code)}
          aria-pressed={lang === item.code}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition-colors duration-200",
            lang === item.code
              ? onGradient
                ? "bg-white text-[#172554] shadow-sm"
                : "bg-card text-primary shadow-sm"
              : onGradient
                ? "text-white/80 hover:text-white"
                : "text-muted-foreground hover:text-navy"
          )}
        >
          {LABELS[item.code] ?? item.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

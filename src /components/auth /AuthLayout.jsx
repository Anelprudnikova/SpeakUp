import Brand from "@/components/Brand";
import LangSwitch from "@/components/LangSwitch";

// Full-screen branded shell shared by the auth pages: blue → violet → teal gradient,
// a white card in the middle and the language switch available before signing in.
// The slogan is deliberately not shown on the sign-in and registration screens.
export function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#132354]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#172554] via-[#4263EB] to-[#20AFA4]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#7957E8]/55 via-transparent to-[#20AFA4]/35" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-[#20AFA4]/30 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-56 w-56 rounded-full bg-[#7957E8]/30 blur-3xl" />

      <div className="relative z-10 flex justify-end px-4 pt-5 sm:px-8">
        <LangSwitch onGradient />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-4 sm:pb-14">
        <div className="w-full max-w-[420px]">
          <div className="speakup-auth-surface rounded-[26px] bg-white p-6 text-foreground shadow-[0_34px_90px_-32px_rgba(6,14,40,0.75)] sm:p-8">
            <Brand size="md" withSlogan={false} className="mb-6" />
            <div className="text-center">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-navy">{title}</h1>
              {subtitle ? <p className="mx-auto mt-2 max-w-[280px] text-balance text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="mt-6">{children}</div>
          </div>
          {footer ? <p className="mt-5 text-center text-sm text-white/75">{footer}</p> : null}
        </div>
      </div>
    </div>
  );
}

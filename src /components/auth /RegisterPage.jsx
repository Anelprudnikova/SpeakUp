import { Eye, EyeOff, Lock, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { MfaFlow } from "@/components/auth/MfaFlow";
import { MfaScreen } from "@/components/auth/MfaParts";
import { AuthError, AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { safeReturnTo } from "@/lib/authReturnTo";
import { useI18n } from "@/lib/i18n";

const isAlreadyVerified = (err) => err?.status === 400 && /already verified/i.test(err?.message ?? "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * The /register page: name, login and password, then the platform's emailed code
 * (register → OTP → verifyOtp → setToken). Registration alone does not sign in.
 */
export function RegisterPage() {
  const { t, lang } = useI18n();
  const returnTo = safeReturnTo();
  const [fullName, setFullName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);

  async function register(e) {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 2) {
      setError(t("auth.nameRequired"));
      return;
    }
    const address = login.trim();
    if (!EMAIL_RE.test(address)) {
      setError(t("auth.emailInvalid"));
      return;
    }
    setBusy(true);
    try {
      await base44.auth.register({ email: address, password });
      setEmail(address);
      setStep("otp");
    } catch (err) {
      setError(err.message || t("auth.registerFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.mfa_required) {
        setMfaChallenge(result);
        return;
      }
      if (result?.access_token) base44.auth.setToken(result.access_token);
      // The profile carries the name typed at registration and the chosen language.
      try {
        await base44.auth.updateMe({ full_name: fullName.trim(), language: lang });
      } catch {
        // A failed name update must not block a verified sign-up; it is editable in the profile.
      }
      window.location.href = returnTo;
    } catch (err) {
      // Verified server-side but the answer never arrived: the code is spent and
      // there is no token, so the only way forward is a normal sign-in.
      if (isAlreadyVerified(err)) setStep("already_verified");
      else setError(err.message || t("auth.otpInvalid"));
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast(t("auth.otpResent"));
    } catch (err) {
      if (isAlreadyVerified(err)) setStep("already_verified");
      else setError(err.message || t("auth.otpResendFailed"));
    }
  }

  // The account is verified; the second sign-in step replaces the whole page and finishes signing in.
  if (mfaChallenge) return <MfaScreen><MfaFlow challenge={mfaChallenge} returnTo={returnTo} /></MfaScreen>;

  if (step === "already_verified") {
    return (
      <AuthLayout title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
        <p className="mb-4 text-sm text-muted-foreground">{t("auth.alreadyVerified", { email })}</p>
        <AuthLink
          to="/login"
          returnTo={returnTo}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("auth.signIn")}
        </AuthLink>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout title={t("auth.otpTitle")} subtitle={t("auth.otpSent", { email })}>
        <form onSubmit={verify}>
          <AuthError>{error}</AuthError>
          <div className="mb-6 flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <SubmitButton busy={busy} busyLabel={t("auth.verifying")} disabled={busy || otpCode.length < 6}>
            {t("auth.otpVerify")}
          </SubmitButton>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.otpNoCode")}{" "}
            <button type="button" onClick={resend} className="font-medium text-primary hover:underline">
              {t("auth.otpResend")}
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")}>
      <AuthError>{error}</AuthError>
      <form onSubmit={register} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="register-name">{t("auth.fullName")}</Label>
          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="register-name"
              type="text"
              autoComplete="name"
              autoFocus
              placeholder={t("auth.fullNamePlaceholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 pl-10"
              disabled={busy}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-login">{t("auth.login")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="register-login"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("auth.emailPlaceholder")}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="h-12 pl-10"
              disabled={busy}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-password">{t("auth.password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 pl-10 pr-11"
              disabled={busy}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition hover:text-navy"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("auth.passwordHint")}</p>
        </div>
        <SubmitButton busy={busy} busyLabel={t("auth.registering")}>
          {t("auth.register")}
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <AuthLink to="/login" returnTo={returnTo}>
          {t("auth.signIn")}
        </AuthLink>
      </p>
    </AuthLayout>
  );
}

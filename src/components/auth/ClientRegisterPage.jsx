import { useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useServerFn } from "@tanstack/react-start";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { MfaFlow } from "@/components/auth/MfaFlow";
import { MfaScreen } from "@/components/auth/MfaParts";
import { AuthError, AuthLink, SubmitButton } from "@/components/auth/parts";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { completeClientSignup } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";

const isAlreadyVerified = (err) => err?.status === 400 && /already verified/i.test(err?.message ?? "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Client sign-up: first name, last name, email and password, then the platform's
 * emailed code. After verification the account is marked as a client profile and
 * the visitor lands in the client cabinet.
 */
export function ClientRegisterPage() {
  const { t, lang } = useI18n();
  const finishSignup = useServerFn(completeClientSignup);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [otpCode, setOtpCode] = useState("");
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  async function register(event) {
    event.preventDefault();
    setError("");
    if (form.first_name.trim().length < 1 || form.last_name.trim().length < 1) {
      setError(t("client.nameRequired"));
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError(t("auth.emailInvalid"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("client.passwordHint"));
      return;
    }
    setBusy(true);
    try {
      await base44.auth.register({ email: form.email.trim(), password: form.password });
      setStep("otp");
    } catch (err) {
      setError(err.message || t("auth.registerFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await base44.auth.verifyOtp({ email: form.email.trim(), otpCode });
      if (result?.mfa_required) {
        setMfaChallenge(result);
        return;
      }
      if (result?.access_token) base44.auth.setToken(result.access_token);
      try {
        await finishSignup({ data: { first_name: form.first_name.trim(), last_name: form.last_name.trim() } });
      } catch {
        // The cabinet opens anyway; the profile page lets the client finish the details.
      }
      try {
        await base44.auth.updateMe({ language: lang });
      } catch {
        // Language stays local; it is switchable from the header.
      }
      window.location.href = "/client";
    } catch (err) {
      if (isAlreadyVerified(err)) setStep("already_verified");
      else setError(err.message || t("auth.otpInvalid"));
      setBusy(false);
    }
  }

  if (mfaChallenge) {
    return (
      <MfaScreen>
        <MfaFlow challenge={mfaChallenge} returnTo="/client" />
      </MfaScreen>
    );
  }

  if (step === "already_verified") {
    return (
      <AuthLayout title={t("client.registerTitle")} subtitle={t("client.registerSubtitle")}>
        <p className="mb-4 text-sm text-muted-foreground">{t("auth.alreadyVerified", { email: form.email })}</p>
        <AuthLink
          to="/login"
          returnTo="/client"
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("auth.signIn")}
        </AuthLink>
      </AuthLayout>
    );
  }

  if (step === "otp") {
    return (
      <AuthLayout title={t("auth.otpTitle")} subtitle={t("auth.otpSent", { email: form.email })}>
        <form onSubmit={verify}>
          <AuthError>{error}</AuthError>
          <div className="mb-6 flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <SubmitButton busy={busy} busyLabel={t("auth.verifying")} disabled={busy || otpCode.length < 6}>
            {t("auth.otpVerify")}
          </SubmitButton>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.otpNoCode")}{" "}
            <button
              type="button"
              onClick={async () => {
                try {
                  await base44.auth.resendOtp(form.email.trim());
                  toast(t("auth.otpResent"));
                } catch (err) {
                  setError(err.message || t("auth.otpResendFailed"));
                }
              }}
              className="font-medium text-primary hover:underline"
            >
              {t("auth.otpResend")}
            </button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("client.registerTitle")} subtitle={t("client.registerSubtitle")}>
      <AuthError>{error}</AuthError>
      <form onSubmit={register} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="client-first">{t("client.firstName")}</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="client-first" value={form.first_name} onChange={set("first_name")} className="h-12 pl-10" disabled={busy} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-last">{t("client.lastName")}</Label>
            <Input id="client-last" value={form.last_name} onChange={set("last_name")} className="h-12" disabled={busy} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-email">{t("auth.login")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="client-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t("auth.emailPlaceholder")}
              value={form.email}
              onChange={set("email")}
              className="h-12 pl-10"
              disabled={busy}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="client-password">{t("auth.password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="client-password"
              type="password"
              autoComplete="new-password"
              placeholder={t("auth.passwordPlaceholder")}
              value={form.password}
              onChange={set("password")}
              className="h-12 pl-10"
              disabled={busy}
              required
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("client.passwordHint")}</p>
        </div>
        <SubmitButton busy={busy} busyLabel={t("auth.registering")}>
          {t("client.createAccount")}
        </SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("client.haveAccount")}{" "}
        <AuthLink to="/login" returnTo="/client">
          {t("auth.signIn")}
        </AuthLink>
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        <AuthLink to="/register" returnTo="/">
          {t("client.staffLink")}
        </AuthLink>
      </p>
    </AuthLayout>
  );
}

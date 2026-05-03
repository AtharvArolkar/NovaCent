"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { appConfig } from "@/lib/app-config";
import { withApiActivity } from "@/lib/client/api-activity";
import { usePreferences } from "@/lib/client/preferences";

type FormState = "idle" | "submitting" | "success" | "error";

function readForm(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

function AuthCard({
  title,
  description,
  children,
  eyebrow = "Welcome back"
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  eyebrow?: string;
}) {
  const { tx } = usePreferences();
  return (
    <section className="auth-card" aria-labelledby="auth-title" aria-describedby="auth-description">
      <div className="auth-brand-panel" aria-label={tx("NovaCent secure finance workspace")}>
        <div className="auth-logo-lockup">
          <span className="auth-logo-mark" aria-hidden="true">{appConfig.logoMark}</span>
          <div>
            <strong>{appConfig.name}</strong>
            <span>{tx("Personal finance, neatly connected.")}</span>
          </div>
        </div>
        <div className="auth-brand-copy">
          <p className="eyebrow">{tx("Secure money workspace")}</p>
          <h2>{tx("Your money workspace, ready when you are.")}</h2>
          <p>{tx("Accounts, budgets, imports, parties, recurring expenses, and reports stay organized in one calm place.")}</p>
        </div>
        <dl className="auth-highlights" aria-label={tx("NovaCent highlights")}>
          <div>
            <dt>{tx("Account scoped")}</dt>
            <dd>{tx("Only your selected account data is shown.")}</dd>
          </div>
          <div>
            <dt>{tx("Offline ready")}</dt>
            <dd>{tx("Supported changes can wait safely for sync.")}</dd>
          </div>
          <div>
            <dt>{tx("Report friendly")}</dt>
            <dd>{tx("Every approved input feeds your charts.")}</dd>
          </div>
        </dl>
      </div>
      <div className="auth-form-panel">
        <div className="auth-mobile-lockup">
          <span className="auth-logo-mark" aria-hidden="true">{appConfig.logoMark}</span>
          <strong>{appConfig.name}</strong>
        </div>
        <div className="auth-form-heading">
          <p className="eyebrow">{tx(eyebrow)}</p>
          <h1 id="auth-title">{tx(title)}</h1>
          <p id="auth-description">{tx(description)}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { tx } = usePreferences();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = readForm(event.currentTarget);
    const result = await withApiActivity(() => signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false
    }), { message: "Signing in" });

    if (result?.error) {
      setState("error");
      setMessage(tx("Invalid email or password."));
      return;
    }

    setState("success");
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard title={`${tx("Sign in to")} ${appConfig.name}`} description="Use email/password or Google to open your account workspace.">
      <form onSubmit={onSubmit}>
        <label>{tx("Email")}<input name="email" type="email" autoComplete="email" required /></label>
        <label>{tx("Password")}<input name="password" type="password" autoComplete="current-password" required /></label>
        <button type="submit" disabled={state === "submitting"}>{state === "submitting" ? tx("Signing in") : tx("Sign in")}</button>
        <button className="secondary-button" type="button" onClick={() => void withApiActivity(() => signIn("google", { callbackUrl: "/" }), { message: "Signing in" })}>{tx("Continue with Google")}</button>
      </form>
      {message ? <p role="alert">{message}</p> : null}
      <div className="auth-links">
        <Link href="/register">{tx("Create an account")}</Link>
        <Link href="/forgot-password">{tx("Forgot password?")}</Link>
      </div>
    </AuthCard>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const { tx } = usePreferences();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = readForm(event.currentTarget);
    const response = await withApiActivity(() => fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    }), { message: "Creating account" });

    if (!response.ok) {
      setState("error");
      setMessage(tx("Unable to create account. The email may already be registered."));
      return;
    }

    await withApiActivity(() => signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false
    }), { message: "Signing in" });
    setState("success");
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard title="Create your account" description="A default INR account is created automatically after registration." eyebrow="Start your workspace">
      <form onSubmit={onSubmit}>
        <label>{tx("Name")}<input name="name" autoComplete="name" required /></label>
        <label>{tx("Email")}<input name="email" type="email" autoComplete="email" required /></label>
        <label>{tx("Password")}<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button type="submit" disabled={state === "submitting"}>{state === "submitting" ? tx("Creating account") : tx("Create account")}</button>
      </form>
      {message ? <p role="alert">{message}</p> : null}
      <div className="auth-links">
        <Link href="/login">{tx("Already have an account?")}</Link>
      </div>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const { tx } = usePreferences();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = readForm(event.currentTarget);
    const response = await withApiActivity(() => fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email })
    }), { message: "Preparing link" });
    const payload = await response.json();
    setState(response.ok ? "success" : "error");
    setMessage(payload.message ? tx(payload.message) : tx("If the email exists, a reset link has been prepared."));
    setDevelopmentResetUrl(payload.developmentResetUrl ?? "");
  }

  return (
    <AuthCard title="Reset password" description="We prepare a secure single-use reset token that expires after 30 minutes." eyebrow="Account recovery">
      <form onSubmit={onSubmit}>
        <label>{tx("Email")}<input name="email" type="email" autoComplete="email" required /></label>
        <button type="submit" disabled={state === "submitting"}>{state === "submitting" ? tx("Preparing link") : tx("Send reset link")}</button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      {developmentResetUrl ? <Link href={developmentResetUrl}>{tx("Open development reset link")}</Link> : null}
      <div className="auth-links">
        <Link href="/login">{tx("Back to sign in")}</Link>
      </div>
    </AuthCard>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { tx } = usePreferences();
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const form = readForm(event.currentTarget);
    const response = await withApiActivity(() => fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.password })
    }), { message: "Updating password" });

    if (!response.ok) {
      setState("error");
      setMessage(tx("Reset token is invalid or expired."));
      return;
    }

    setState("success");
    router.push("/login");
  }

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters. The reset token can only be used once." eyebrow="Password reset">
      <form onSubmit={onSubmit}>
        <label>{tx("New password")}<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button type="submit" disabled={state === "submitting"}>{state === "submitting" ? tx("Updating password") : tx("Update password")}</button>
      </form>
      {message ? <p role="alert">{message}</p> : null}
    </AuthCard>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { appConfig } from "@/lib/app-config";
import { usePreferences } from "@/lib/client/preferences";

type FormState = "idle" | "submitting" | "success" | "error";

function readForm(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

function AuthCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const { tx } = usePreferences();
  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <p className="eyebrow">{appConfig.logoMark}</p>
      <h1 id="auth-title">{tx(title)}</h1>
      <p>{tx(description)}</p>
      {children}
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
    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false
    });

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
        <button className="secondary-button" type="button" onClick={() => signIn("google", { callbackUrl: "/" })}>{tx("Continue with Google")}</button>
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
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setState("error");
      setMessage(tx("Unable to create account. The email may already be registered."));
      return;
    }

    await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false
    });
    setState("success");
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard title="Create your account" description="A default INR account is created automatically after registration.">
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
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email })
    });
    const payload = await response.json();
    setState(response.ok ? "success" : "error");
    setMessage(payload.message ? tx(payload.message) : tx("If the email exists, a reset link has been prepared."));
    setDevelopmentResetUrl(payload.developmentResetUrl ?? "");
  }

  return (
    <AuthCard title="Reset password" description="We prepare a secure single-use reset token that expires after 30 minutes.">
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
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.password })
    });

    if (!response.ok) {
      setState("error");
      setMessage(tx("Reset token is invalid or expired."));
      return;
    }

    setState("success");
    router.push("/login");
  }

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters. The reset token can only be used once.">
      <form onSubmit={onSubmit}>
        <label>{tx("New password")}<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <button type="submit" disabled={state === "submitting"}>{state === "submitting" ? tx("Updating password") : tx("Update password")}</button>
      </form>
      {message ? <p role="alert">{message}</p> : null}
    </AuthCard>
  );
}

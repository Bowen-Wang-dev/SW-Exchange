"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { AuthResponse } from "@/lib/auth";
import { useAuth } from "@/providers/auth-provider";

type Setup = { secret: string; provisioningUri: string; qrCodeDataUrl: string; expiresAt: string };
const button = "rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium text-[var(--foreground)] disabled:opacity-50";

export function TwoFactorSecurity() {
  const { user, acceptSession } = useAuth();
  const [available, setAvailable] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<{ enabled: boolean }>("/feature-flags/enable2FA").then((flag) => { if (active) setAvailable(flag.enabled); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!setup) return;
    const timer = setTimeout(() => { setSetup(null); setCode(""); setError("Setup expired. Start again for a new secret."); }, Math.max(0, Date.parse(setup.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [setup]);

  async function act(action: "setup" | "enable" | "disable" | "recovery-codes/regenerate") {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const purpose = action === "setup" ? "2fa-setup" : action === "enable" ? "2fa-enable" : action === "disable" ? "2fa-disable" : "2fa-recovery-regenerate";
      const { reauthToken } = await apiRequest<{ reauthToken: string }>("/auth/2fa/reauth", { method: "POST", body: { password, purpose } });
      setPassword("");
      if (action === "setup") {
        setSetup(await apiRequest<Setup>("/auth/2fa/setup", { method: "POST", body: { reauthToken } }));
        setRecoveryCodes([]);
      } else {
        const response = await apiRequest<AuthResponse & { recoveryCodes?: string[] }>(`/auth/2fa/${action}`, { method: "POST", body: { code: code.trim(), reauthToken } });
        acceptSession(response);
        setSetup(null);
        setRecoveryCodes(response.recoveryCodes ?? []);
        setSuccess(action === "disable" ? "Two-factor authentication disabled. Other sessions were signed out." : action === "enable" ? "Two-factor authentication enabled. Other sessions were signed out." : "Recovery codes replaced. Old codes no longer work.");
      }
      setCode("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update two-factor authentication."); }
    finally { setBusy(false); }
  }

  return <section className="panel rounded-3xl p-5 space-y-4" aria-label="Two-factor authentication">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-[var(--foreground)]">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-[var(--foreground-soft)]">{user?.twoFactorEnabled ? "Enabled — sign-in requires your password and an authenticator or recovery code." : "Add an authenticator app as a second step when signing in."}</p>
        {user?.twoFactorEnabledAt ? <p className="text-xs text-[var(--foreground-muted)]">Enabled {new Date(user.twoFactorEnabledAt).toLocaleString()}</p> : null}
      </div>
      <span className="text-sm font-semibold text-[var(--accent)]">{user?.twoFactorEnabled ? "ENABLED" : "DISABLED"}</span>
    </div>
    {!user?.twoFactorEnabled && !setup ? <>
      <label className="grid max-w-sm gap-1 text-sm text-[var(--foreground-soft)]">Confirm password to continue
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)]" />
      </label>
      <button className={button} disabled={busy || !available || !password} onClick={() => void act("setup")}>Set up authenticator</button>
      {!available ? <p className="text-sm text-[var(--foreground-muted)]">New enrollment is currently unavailable.</p> : null}
    </> : null}
    {setup ? <div className="space-y-3">
      <p className="text-sm text-[var(--foreground-soft)]">Scan in your authenticator app, or enter this setup key manually. Setup expires after 10 minutes. The key is shown only for this setup.</p>
      {/* QR generation is local; no provisioning data is sent to an image service. */}
      <img src={setup.qrCodeDataUrl} width={240} height={240} alt="Authenticator setup QR code" className="rounded-xl" />
      <code className="block break-all select-all text-[var(--foreground)]">{setup.secret}</code>
      <button className={button} disabled={busy} onClick={() => { setSetup(null); setCode(""); }}>Cancel setup</button>
    </div> : null}
    {setup || user?.twoFactorEnabled ? <form className="flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void act(setup ? "enable" : "recovery-codes/regenerate"); }}>
      <label className="grid gap-1 text-sm text-[var(--foreground-soft)]">Confirm password
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)]" />
      </label>
      <label className="grid gap-1 text-sm text-[var(--foreground-soft)]">{setup ? "New authenticator code" : "Fresh authenticator or unused recovery code"}
        <input autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={35} required className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)]" />
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <button type="submit" disabled={busy || !code.trim() || !password} className={button}>{busy ? "Verifying..." : setup ? "Enable 2FA" : "Regenerate recovery codes"}</button>
        {user?.twoFactorEnabled ? <button type="button" disabled={busy || !code.trim() || !password} className={button} onClick={() => { if (window.confirm("Disable two-factor authentication? Future sign-ins will use your password only.")) void act("disable"); }}>Disable 2FA</button> : null}
      </div>
      <p className="w-full text-xs text-[var(--foreground-muted)]">Each authenticator code can be accepted only once. Wait for a new code before another action. Regenerating recovery codes invalidates the previous set.</p>
    </form> : null}
    {error ? <p role="alert" className="text-sm text-[var(--notice-danger-text)]">{error}</p> : null}
    {success ? <p role="status" className="text-sm text-[var(--notice-success-text)]">{success}</p> : null}
    {recoveryCodes.length ? <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3">
      <p className="font-semibold text-[var(--foreground)]">Save your recovery codes now</p>
      <p className="text-sm text-[var(--foreground-soft)]">These codes are shown once. Store them safely outside this browser. Each code works once. Losing both your authenticator and these codes can lock you out.</p>
      <div className="grid gap-2 text-sm text-[var(--foreground)]">{recoveryCodes.map((value) => <code key={value} className="break-all select-all">{value}</code>)}</div>
      <button className={button} onClick={() => setRecoveryCodes([])}>I have saved my codes — dismiss</button>
    </div> : null}
  </section>;
}

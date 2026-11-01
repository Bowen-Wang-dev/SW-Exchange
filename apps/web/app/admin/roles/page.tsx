"use client";
import { useEffect, useState } from "react";
import type { AdminRoleKey, AdminPermission } from "@sw-exchange/shared";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { AdminNotice } from "@/components/admin/admin-notice";
import { AdminConfirmationDialog } from "@/components/admin/admin-confirmation-dialog";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { AdminUser } from "@/lib/api-types";
import { useAuth } from "@/providers/auth-provider";

type Role = { key: AdminRoleKey; description: string; permissions: AdminPermission[] };
const field = "rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-[var(--foreground)]";
export default function AdminRolesPage() {
  const { user, adminCapabilities, canAdmin } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [targetId, setTargetId] = useState("");
  const [selected, setSelected] = useState<AdminRoleKey[]>([]);
  const [beforeRoles, setBeforeRoles] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [loadedTarget, setLoadedTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canManage = canAdmin("admin_roles.manage");
  const target = users.find((u) => u.id === targetId);
  const changed = [...selected].sort().join(",") !== [...beforeRoles].sort().join(",") || (target?.role === "ADMIN" && selected.length === 0 && beforeRoles.length === 0);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let active = true;
    void Promise.all([apiRequest<{ roles: Role[] }>("/admin/roles"), apiRequest<{ permissions: AdminPermission[] }>("/admin/permissions"), apiRequest<AdminUser[]>("/admin/users")])
      .then(([r,p,u]) => { if (active) { setRoles(r.roles); setPermissions(p.permissions); setUsers(u); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Unable to load administrator roles."); });
    return () => { active = false; };
  }, [user?.id, user?.role]);
  useEffect(() => {
    setPassword(""); setCode(""); setConfirm(false); setSelected([]); setBeforeRoles([]); setLoadedTarget("");
    if (!targetId) return;
    let active = true; setLoadingTarget(true); setError(null); setSuccess(null);
    void apiRequest<{ roles: AdminRoleKey[] }>(`/admin/users/${targetId}/roles`).then((r) => {
      if (active) { setSelected(r.roles); setBeforeRoles(r.roles); setLoadedTarget(targetId); }
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Unable to load roles."); })
      .finally(() => { if (active) setLoadingTarget(false); });
    return () => { active = false; };
  }, [targetId]);
  async function save() {
    if (!target || !canManage || loadedTarget !== targetId) return;
    setBusy(true); setError(null); setSuccess(null);
    const freshPassword = password, freshCode = code;
    setPassword(""); setCode("");
    try {
      const proof = await apiRequest<{ reauthToken: string }>(`/admin/users/${target.id}/roles/reauth`, { method: "POST", body: { roles: selected, password: freshPassword, ...(freshCode ? { code: freshCode } : {}) } });
      const result = await apiRequest<{ roles: AdminRoleKey[] }>(`/admin/users/${target.id}/roles`, { method: "PUT", body: { roles: selected, reauthToken: proof.reauthToken } });
      setSelected(result.roles); setBeforeRoles(result.roles); setConfirm(false);
      setUsers(await apiRequest<AdminUser[]>("/admin/users"));
      setSuccess(`Roles updated for ${target.username}. Their previous sessions are revoked; they must log in again.`);
    } catch (e) { setConfirm(false); setError(e instanceof ApiError ? `${e.status}: ${e.message}` : "Unable to update roles."); }
    finally { setBusy(false); }
  }
  return <ProtectedRoute requireAdmin fallbackPath="/dashboard"><AppShell><div className="space-y-4">
    <PageHeader eyebrow="Administrative Security" title="Admin roles and permissions" description="Review authority and manage role assignments with fresh authentication. Backend checks remain authoritative." />
    <section className="panel rounded-3xl p-5 space-y-3">
      <h2 className="text-lg font-semibold">Your administrative capabilities</h2>
      <p>Roles: {adminCapabilities?.roles.join(", ") || "None assigned"}</p>
      <p className="text-sm text-[var(--foreground-soft)]">{adminCapabilities?.enforcementEnabled ? "Granular enforcement enabled." : "Legacy rollout mode: assigned roles remain enforced; unassigned legacy admins retain operational access. Role mutations always require explicit authority."}</p>
      <p className="break-words text-sm text-[var(--foreground-soft)]">{adminCapabilities?.effectivePermissions.join(" · ") || "Loading capabilities…"}</p>
    </section>
    {error && <AdminNotice tone="danger" message={error} />}{success && <AdminNotice tone="success" message={success} />}
    <section className="panel rounded-3xl p-5 space-y-4">
      <h2 className="text-lg font-semibold">User role assignments</h2>
      <label className="grid gap-2">Target account<select className={field} value={targetId} disabled={busy} onChange={(e) => setTargetId(e.target.value)}><option value="">Select an account</option>{users.map((u) => <option key={u.id} value={u.id}>{u.username} — {u.adminRoles?.join(", ") || u.role} ({u.status})</option>)}</select></label>
      {target && <>
        <p className="text-sm text-[var(--foreground-soft)]">{loadingTarget ? "Loading assignments…" : `Current roles: ${beforeRoles.join(", ") || "none"}`}</p>
        <fieldset disabled={!canManage || targetId === user?.id || busy || loadingTarget || loadedTarget !== targetId} className="space-y-3 disabled:opacity-60">
          {roles.map((r) => <label key={r.key} className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={selected.includes(r.key)} onChange={(e) => setSelected(e.target.checked ? [...selected,r.key] : selected.filter((key) => key !== r.key))} /><span><strong>{r.key}</strong><span className="block text-sm text-[var(--foreground-soft)]">{r.description}</span></span></label>)}
          {canManage && <>
            <label className="grid gap-2">Your current password<input className={field} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            {user?.twoFactorEnabled && <label className="grid gap-2">Fresh TOTP or unused recovery code<input className={field} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>}
            <p className="text-sm text-[var(--foreground-soft)]">Removing all roles removes administrator access. Existing wallet balances and history are preserved. You cannot change your own roles.</p>
            <button className="rounded-xl bg-[var(--accent)] px-4 py-3 font-semibold text-black disabled:opacity-50" disabled={!changed || !password || (user?.twoFactorEnabled && !code)} onClick={() => setConfirm(true)}>Review role change</button>
          </>}
        </fieldset>
        {!canManage && <AdminNotice tone="info" message="Read-only role visibility. Explicit admin_roles.manage permission is required to change assignments." />}
      </>}
    </section>
    <section className="grid gap-4 lg:grid-cols-3">{roles.map((r) => <article key={r.key} className="panel rounded-3xl p-5 space-y-3"><h2 className="font-semibold">{r.key}</h2><p className="text-sm text-[var(--foreground-soft)]">{r.description}</p><ul className="space-y-1 text-sm">{r.permissions.map((p) => <li key={p}>{p}</li>)}</ul></article>)}</section>
    <details className="panel rounded-3xl p-5"><summary>Available permission registry ({permissions.length})</summary><p className="mt-3 break-words text-sm">{permissions.join(" · ")}</p></details>
    <AdminConfirmationDialog isSubmitting={busy} onCancel={() => { if (!busy) { setConfirm(false); setPassword(""); setCode(""); } }} onConfirm={() => void save()} confirmation={confirm && target ? { eyebrow: "Confirm role change", title: `Change roles for ${target.username}?`, description: "This changes administrative authority and revokes the target account's sessions.", confirmLabel: "Confirm roles", tone: "danger", details: [{ label: "Current roles", value: beforeRoles.join(", ") || "none" }, { label: "New roles", value: selected.join(", ") || "none" }], warning: "The last active super-admin is protected. Fresh password and any enrolled second factor are verified by the API." } : null} />
  </div></AppShell></ProtectedRoute>;
}

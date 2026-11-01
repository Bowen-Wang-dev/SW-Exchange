# v1 Auth Security Plan

This document plans the security foundation that should exist before any chain money-movement feature is enabled.

As of `v1.0.4`, feature flags, security events, verified email, TOTP 2FA, purpose-bound reauthentication and backend administrative roles/permissions are implemented. Reauthentication protects 2FA management and administrative role replacement. Other sensitive-action enforcement remains planned-only.

Implemented prerequisite from this plan:

- database-backed backend-enforced feature flag foundation for `enable2FA`, `enableEmailVerification`, and `enableAdminRolePermissions`
- database-backed `security_events` foundation with current login/admin event capture and admin read visibility
- shared sensitive-action policy definitions for future re-auth, email verification, 2FA, admin RBAC, and funding controls
- verified/unverified user email state plus hashed single-use email verification tokens
- authenticated email-verification request flow and public token confirm flow
- console/dev mail delivery abstraction for verification links and tokens
- encrypted TOTP enrollment, replay-resistant two-step login and hashed one-time recovery codes
- purpose-bound password reauthentication for implemented 2FA management, backend throttling and retention cleanup

Still not implemented:

- general sensitive-action re-auth beyond implemented 2FA/role management
- security enforcement for the planned sensitive-action requirements

## Goals

- Add account-verification controls appropriate for sensitive exchange actions
- Harden user and admin authentication flows
- Add backend-enforced security checks for high-impact actions
- Create auditable operator controls before withdrawal or custody work

## Planned Scope

### Email Verification

- Verified/unverified email state is now implemented.
- Verification request and confirm flows are now implemented with hashed single-use tokens.
- Future milestones should require verified email for security-setting changes and future withdrawal eligibility.
- Verification state changes are now recorded in security logs.

### TOTP 2FA (implemented in v1.0.3)

- AES-256-GCM encrypted secrets, local QR provisioning, TOTP activation and hash-only recovery codes
- Password verification issues a five-minute login challenge rather than an access JWT for enabled users
- User-row locks serialize challenge/recovery/TOTP consumption; attempt limits and monotonic TOTP counters prevent reuse
- Five-minute, purpose-bound password reauthentication protects setup, enable, disable and recovery regeneration
- Disable and recovery regeneration additionally require a valid TOTP or unused recovery code
- Enable/disable increment authVersion and revoke outstanding reauthentication
- enable2FA gates new enrollment; turning it off never bypasses an enrolled user's second factor
- Plan admin-policy capability to require 2FA for admins before withdrawal approval rights

### Sensitive Action Re-auth

- Require recent password or active 2FA challenge for high-impact actions
- Expire re-auth windows after a short, explicit duration
- Apply checks server-side, not just in frontend modal flows

### Admin Role Permissions (implemented in v1.0.4)

- Explicit viewer/operator/super-admin registry and 20 permissions; global fail-closed policies on 34 routes.
- Role mutations always require live authority, recent password and any enrolled second factor, independent of feature flags.
- SHA-256 purpose binding includes target/exact replacement roles; five-minute proofs are hash-only and single-use.
- PostgreSQL advisory/user locks serialize role/status/recovery operations, enforce delegation ceilings and protect the final active super-admin.
- Role/status changes increment affected authVersion and revoke proofs/challenges; stale JWTs are rejected.
- Assigned roles remain constrained with rollout off; rollout on rejects unassigned administrators. No general flag editor.
- Critical role audits commit atomically; rejected authorization/escalation and offline recovery are logged.
- Mandatory admin MFA and multi-party approval remain future policies. See [runbook](./ADMIN_ROLE_PERMISSIONS.md).

### Security Logs

- Record security-setting changes, re-auth events, failed protected actions, and permissioned admin actions
- Keep logs queryable in admin tooling
- Avoid logging secrets, OTP seeds, backup codes, or raw credentials
- Current v1.0.4 coverage additionally records role changes, denied admin access/escalation, last-super-admin protection and reviewed bootstrap alongside login/email/TOTP events; credentials are excluded and sensitive metadata keys are redacted

### Withdrawal / Security Setting Verification

- Require verification checks before any future withdrawal request or withdrawal approval
- Require re-auth before email changes, 2FA changes, or chain-configuration edits

### Recovery Considerations

- One-time recovery codes are implemented; operator-assisted recovery for losing all factors remains future work
- Apply stricter review to recovery than to normal login
- Record recovery attempts and outcomes in security logs

### Implemented v1.0.3 authentication limits

- Password login: 100 attempts per socket IP per 15 minutes, plus 10 per identifier/IP pair; no identifier-only global lockout
- Password reauthentication: 10 attempts per authenticated user per 5 minutes
- Second factor: 30 attempts per user per 5 minutes; second-step login also has an IP limit of 100 per 5 minutes
- v1.0.4 second review: role-proof password/factor counters complete durably before user-row locking; every admitted role-proof request reserves the factor budget even for unenrolled or wrong-password attempts. Setup/enable flag reads reuse the existing transaction. Factor/proof single-use consumption, binding, expiration, session checks and sanitized events remain unchanged; pool size/timeouts are not increased.
- Setup: 10 attempts per user per 10 minutes; every login challenge independently allows at most 5 attempts
- Startup/hourly cleanup removes limiter windows older than 24 hours and reauthentication records expired more than 24 hours ago
- Arbitrary forwarding headers are ignored; a future shared reverse proxy requires an explicitly trusted topology
- See [verification evidence](./V1_0_3_VERIFICATION.md) for the 29 real PostgreSQL tests and full smoke results

### Future Rate Limiting Concept

- Add rate limiting for login, password reset, 2FA challenge, verification, and future withdrawal-related endpoints
- Differentiate user-facing limits from admin-sensitive limits

## Sensitive Actions Requiring Extra Verification

- enabling 2FA
- disabling 2FA
- changing email
- requesting withdrawal
- approving withdrawal
- changing withdraw fees
- enabling deposit features
- enabling withdraw features
- editing chain contract address
- admin status changes
- admin wallet operations

## Explicit Non-Goals For The Current Milestone

- No phone or SMS verification for now
- No built-in KYC for now
- No fiat workflow for now
- No chain gateway implementation in this phase

## Delivery Rule

`v1.0` should be treated as a prerequisite phase for later withdrawal-capable work, not as optional polish.

### v1.0.4 review remediation

The configured fee principal cannot lose its ADMIN identity through role replacement; authorized status suspension preserves fee receipt and invalidates human sessions. Complete-report reads now require each underlying data scope, delegation checks include effective legacy authority in the protected transaction, and centralized audit attribution trusts only the socket peer. These are implemented protections, not future controls. Mandatory admin MFA, broader financial-action step-up, future trusted proxy configuration and platform fee-principal separation remain future work. See [remediation evidence](./V1_0_4_REMEDIATION.md).

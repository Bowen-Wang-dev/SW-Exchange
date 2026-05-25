# v1 Auth Security Plan

This document plans the security foundation that should exist before any chain money-movement feature is enabled.

As of `v1.0.0`, the feature-flag portion of this foundation exists, but the security modules below remain unimplemented unless explicitly noted otherwise.

Implemented prerequisite from this plan:

- database-backed backend-enforced feature flag foundation for `enable2FA`, `enableEmailVerification`, and `enableAdminRolePermissions`

Still not implemented:

- email verification behavior
- TOTP 2FA behavior
- sensitive-action re-auth
- granular admin role permission checks
- dedicated security logs

## Goals

- Add account-verification controls appropriate for sensitive exchange actions
- Harden user and admin authentication flows
- Add backend-enforced security checks for high-impact actions
- Create auditable operator controls before withdrawal or custody work

## Planned Scope

### Email Verification

- Add verified/unverified email state
- Require verified email for security-setting changes and future withdrawal eligibility
- Record verification state changes in security logs

### TOTP 2FA

- Support TOTP-based 2FA enrollment and challenge flow
- Require fresh confirmation for enable/disable actions
- Plan admin-policy capability to require 2FA for admins before withdrawal approval rights

### Sensitive Action Re-auth

- Require recent password or active 2FA challenge for high-impact actions
- Expire re-auth windows after a short, explicit duration
- Apply checks server-side, not just in frontend modal flows

### Admin Role Permissions

- Move from broad admin access toward scoped admin permissions
- Separate configuration, security, wallet, and withdrawal authority
- Support approval-only roles versus execution-capable roles

### Security Logs

- Record security-setting changes, re-auth events, failed protected actions, and permissioned admin actions
- Keep logs queryable in admin tooling
- Avoid logging secrets, OTP seeds, backup codes, or raw credentials

### Withdrawal / Security Setting Verification

- Require verification checks before any future withdrawal request or withdrawal approval
- Require re-auth before email changes, 2FA changes, or chain-configuration edits

### Recovery Considerations

- Plan backup code or operator-assisted recovery flow for TOTP lockout
- Apply stricter review to recovery than to normal login
- Record recovery attempts and outcomes in security logs

### Rate Limiting Concept

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

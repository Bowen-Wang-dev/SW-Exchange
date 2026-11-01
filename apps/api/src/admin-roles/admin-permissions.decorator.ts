import { SetMetadata } from "@nestjs/common";
import type { AdminPermission } from "@sw-exchange/shared";
export const ADMIN_POLICY = "adminPermissionPolicy";
export type AdminPolicy = { permissions: AdminPermission[]; always: boolean };
export const RequireAdminPermissions = (...permissions: AdminPermission[]) => SetMetadata(ADMIN_POLICY, { permissions, always: false } satisfies AdminPolicy);
export const AlwaysRequireAdminPermissions = (...permissions: AdminPermission[]) => SetMetadata(ADMIN_POLICY, { permissions, always: true } satisfies AdminPolicy);

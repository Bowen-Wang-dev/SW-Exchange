import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants.js";
import { ROLES_KEY } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { extractRequestSecurityContext } from "../security/security-events.service.js";
import { ADMIN_POLICY, type AdminPolicy } from "./admin-permissions.decorator.js";
import { AdminRolesService } from "./admin-roles.service.js";

@Injectable()
export class AdminPermissionsGuard implements CanActivate {
  constructor(@Inject(JwtAuthGuard) private readonly jwt: JwtAuthGuard, @Inject(AdminRolesService) private readonly roles: AdminRolesService) {}
  async canActivate(context: ExecutionContext) {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, context.getClass());
    const roleMetadata: string[] = Reflect.getMetadata(ROLES_KEY, context.getHandler()) ?? Reflect.getMetadata(ROLES_KEY, context.getClass()) ?? [];
    const policy: AdminPolicy | undefined = Reflect.getMetadata(ADMIN_POLICY, context.getHandler());
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const adminPath = [controllerPath].flat().some((p) => typeof p === "string" && /^\/?admin(?:\/|$)/i.test(p));
    if (!adminPath && !roleMetadata.includes("ADMIN") && !policy && !/^\/(?:api\/)?admin(?:\/|$)/i.test(request.path)) return true;
    const routePath = String(request.route?.path ?? controllerPath ?? "admin");
    const operation = `${request.method} ${routePath}`;
    const targetId = routePath.includes("/users/:id/") ? request.params.id as string ?? null : null;
    // Invoke Passport directly: @Public metadata must never bypass this boundary.
    let authenticated;
    try { authenticated = await this.jwt.authenticateAdmin(context); }
    catch (error) {
      await this.roles.denied(null, targetId, "ADMIN_ACCESS_DENIED", "ADMIN_AUTHENTICATION_REJECTED", extractRequestSecurityContext(request), operation);
      throw error;
    }
    if (!authenticated) return false;
    const user = request.user;
    let reason: string | undefined;
    if (user.role !== "ADMIN" || user.isSystem || user.status !== "ACTIVE") reason = "Forbidden resource";
    else if (!policy || !policy.permissions.length) reason = "Administrative route has no explicit permission policy.";
    else {
      const capabilities = await this.roles.capabilities(user.sub);
      const permissions = policy.always ? capabilities.permissions : capabilities.effectivePermissions;
      if (policy.permissions.some((p) => !permissions.includes(p))) reason = "Required administrative permission is missing.";
    }
    if (reason) {
      await this.roles.denied(user.sub, targetId, "ADMIN_ACCESS_DENIED", reason, extractRequestSecurityContext(request), operation);
      throw new ForbiddenException(reason);
    }
    return true;
  }
}

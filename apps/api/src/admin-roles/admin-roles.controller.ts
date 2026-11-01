import { Body, Controller, Get, Header, Inject, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { ADMIN_PERMISSIONS, ADMIN_ROLE_KEYS } from "@sw-exchange/shared";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { extractRequestSecurityContext } from "../security/security-events.service.js";
import { AlwaysRequireAdminPermissions, RequireAdminPermissions } from "./admin-permissions.decorator.js";
import { AdminRolesService } from "./admin-roles.service.js";

class RolesDto {
  @IsArray() @ArrayUnique() @ArrayMaxSize(3) @IsIn(ADMIN_ROLE_KEYS, { each: true })
  roles!: string[];
}
class RoleReauthDto extends RolesDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsOptional() @IsString() @Matches(/^(?:\d{6}|[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{8}){3})$/) code?: string;
}
class SetRolesDto extends RolesDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) reauthToken!: string;
}
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin")
export class AdminRolesController {
  constructor(@Inject(AdminRolesService) private readonly roles: AdminRolesService) {}
  @Get("capabilities") @RequireAdminPermissions("admin_roles.read") @Header("Cache-Control", "no-store")
  capabilities(@Req() req: AuthenticatedRequest) { return this.roles.capabilities(req.user.sub); }
  @Get("roles") @RequireAdminPermissions("admin_roles.read") @Header("Cache-Control", "no-store")
  async listRoles() { return { roles: await this.roles.listRoles() }; }
  @Get("permissions") @RequireAdminPermissions("admin_roles.read")
  permissions() { return { permissions: ADMIN_PERMISSIONS }; }
  @Get("users/:id/roles") @RequireAdminPermissions("admin_roles.read") @Header("Cache-Control", "no-store")
  userRoles(@Param("id", ParseUUIDPipe) id: string) { return this.roles.userRoles(id); }
  @Post("users/:id/roles/reauth") @AlwaysRequireAdminPermissions("admin_roles.manage") @Header("Cache-Control", "no-store")
  reauth(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() dto: RoleReauthDto) {
    return this.roles.reauthenticate(req.user.sub, req.user.authVersion ?? 0, id, dto.roles, dto.password, dto.code, extractRequestSecurityContext(req));
  }
  @Put("users/:id/roles") @AlwaysRequireAdminPermissions("admin_roles.manage") @Header("Cache-Control", "no-store")
  setRoles(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() dto: SetRolesDto) {
    return this.roles.setRoles(req.user.sub, req.user.authVersion ?? 0, id, dto.roles, dto.reauthToken, extractRequestSecurityContext(req));
  }
}

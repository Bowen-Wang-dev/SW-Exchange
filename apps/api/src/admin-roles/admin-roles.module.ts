import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module.js";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module.js";
import { SecurityModule } from "../security/security.module.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { AdminRolesService } from "./admin-roles.service.js";
import { AdminRolesController } from "./admin-roles.controller.js";
import { AdminPermissionsGuard } from "./admin-permissions.guard.js";
@Global()
@Module({
  imports: [AuthModule, FeatureFlagsModule, SecurityModule],
  controllers: [AdminRolesController],
  providers: [AdminRolesService, JwtAuthGuard, { provide: APP_GUARD, useClass: AdminPermissionsGuard }],
  exports: [AdminRolesService],
})
export class AdminRolesModule {}

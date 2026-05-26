import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module.js";
import { AdminFeatureFlagsController } from "./admin-feature-flags.controller.js";
import { FeatureFlagsController } from "./feature-flags.controller.js";
import { FeatureFlagsService } from "./feature-flags.service.js";

@Module({
  imports: [SecurityModule],
  controllers: [FeatureFlagsController, AdminFeatureFlagsController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}

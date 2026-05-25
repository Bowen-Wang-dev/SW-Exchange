import { Controller, Get, Inject, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { FeatureFlagsService } from "./feature-flags.service.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin/feature-flags")
export class AdminFeatureFlagsController {
  constructor(@Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  async findAll() {
    return {
      flags: await this.featureFlagsService.getAllFlags(),
    };
  }

  @Get(":key")
  async findOne(@Param("key") key: string) {
    const featureFlag = await this.featureFlagsService.getFlag(key);

    if (!featureFlag) {
      throw new NotFoundException("Feature flag not found.");
    }

    return featureFlag;
  }
}

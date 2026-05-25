import { Controller, Get, Inject, NotFoundException, Param } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { FeatureFlagsService } from "./feature-flags.service.js";

@Controller("feature-flags")
export class FeatureFlagsController {
  constructor(@Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService) {}

  @Public()
  @Get()
  async findAll() {
    return {
      flags: await this.featureFlagsService.getAllFlags(),
    };
  }

  @Public()
  @Get(":key")
  async findOne(@Param("key") key: string) {
    const featureFlag = await this.featureFlagsService.getFlag(key);

    if (!featureFlag) {
      throw new NotFoundException("Feature flag not found.");
    }

    return featureFlag;
  }
}

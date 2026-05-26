import { Controller, Get, Inject, NotFoundException, Param, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { SecurityEventsService, extractRequestSecurityContext } from "../security/security-events.service.js";
import { FeatureFlagsService } from "./feature-flags.service.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin/feature-flags")
export class AdminFeatureFlagsController {
  constructor(
    @Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService,
    @Inject(SecurityEventsService) private readonly securityEventsService: SecurityEventsService,
  ) {}

  @Get()
  async findAll(@Req() request: AuthenticatedRequest) {
    const flags = await this.featureFlagsService.getAllFlags();
    const context = extractRequestSecurityContext(request);

    await this.securityEventsService.recordEvent({
      actorUserId: request.user.sub,
      actorRole: request.user.role,
      eventType: "FEATURE_FLAG_READ_ADMIN",
      severity: "INFO",
      targetType: "FEATURE_FLAG",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        scope: "ALL_FLAGS",
      },
    });

    return {
      flags,
    };
  }

  @Get(":key")
  async findOne(@Req() request: AuthenticatedRequest, @Param("key") key: string) {
    const featureFlag = await this.featureFlagsService.getFlag(key);

    if (!featureFlag) {
      throw new NotFoundException("Feature flag not found.");
    }

    const context = extractRequestSecurityContext(request);

    await this.securityEventsService.recordEvent({
      actorUserId: request.user.sub,
      actorRole: request.user.role,
      eventType: "FEATURE_FLAG_READ_ADMIN",
      severity: "INFO",
      targetType: "FEATURE_FLAG",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        scope: "SINGLE_FLAG",
        key,
      },
    });

    return featureFlag;
  }
}

import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { SENSITIVE_ACTION_DEFINITIONS } from "@sw-exchange/shared";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import { SecurityEventsService } from "./security-events.service.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin")
export class AdminSecurityController {
  constructor(@Inject(SecurityEventsService) private readonly securityEventsService: SecurityEventsService) {}

  @Get("security-events")
  async listSecurityEvents(
    @Query("eventType") eventType?: string,
    @Query("severity") severity?: string,
    @Query("actorUserId") actorUserId?: string,
    @Query("targetType") targetType?: string,
    @Query("search") search?: string,
    @Query("limit") limit?: string,
  ) {
    return {
      events: await this.securityEventsService.listEvents({
        eventType,
        severity,
        actorUserId,
        targetType,
        search,
        limit,
      }),
    };
  }

  @Get("security-events/:id")
  async getSecurityEvent(@Param("id", ParseUUIDPipe) id: string) {
    const event = await this.securityEventsService.getEventById(id);

    if (!event) {
      throw new NotFoundException("Security event not found.");
    }

    return event;
  }

  @Get("security-actions")
  listSensitiveActions() {
    return {
      actions: SENSITIVE_ACTION_DEFINITIONS,
    };
  }
}

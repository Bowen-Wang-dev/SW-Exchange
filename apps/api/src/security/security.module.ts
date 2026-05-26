import { Module } from "@nestjs/common";
import { AdminSecurityController } from "./admin-security.controller.js";
import { SecurityEventsService } from "./security-events.service.js";

@Module({
  controllers: [AdminSecurityController],
  providers: [SecurityEventsService],
  exports: [SecurityEventsService],
})
export class SecurityModule {}

import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { TradesService } from "./trades.service.js";

@UseGuards(JwtAuthGuard)
@Controller("trades")
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get()
  list() {
    return this.tradesService.listPlaceholder();
  }
}

import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { TradesService } from "./trades.service.js";

@Controller("trades")
export class TradesController {
  constructor(@Inject(TradesService) private readonly tradesService: TradesService) {}

  @Public()
  @Get("recent")
  listRecent(@Query("marketSymbol") marketSymbol?: string) {
    return this.tradesService.listRecent(marketSymbol);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  listMine(@Req() request: AuthenticatedRequest) {
    return this.tradesService.listMine(request.user.sub);
  }
}

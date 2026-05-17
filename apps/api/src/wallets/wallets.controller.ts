import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { WalletsService } from "./wallets.service.js";

@UseGuards(JwtAuthGuard)
@Controller("wallets")
export class WalletsController {
  constructor(@Inject(WalletsService) private readonly walletsService: WalletsService) {}

  @Get("me")
  findMine(@Req() request: AuthenticatedRequest) {
    return this.walletsService.findByUserId(request.user.sub);
  }

  @Get("me/valuation")
  getMyValuation(@Req() request: AuthenticatedRequest) {
    return this.walletsService.getValuationByUserId(request.user.sub);
  }
}

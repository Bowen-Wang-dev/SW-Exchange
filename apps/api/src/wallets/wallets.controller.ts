import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { WalletsService } from "./wallets.service.js";

@UseGuards(JwtAuthGuard)
@Controller("wallets")
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get("me")
  findMine(@Req() request: AuthenticatedRequest) {
    return this.walletsService.findByUserId(request.user.sub);
  }
}

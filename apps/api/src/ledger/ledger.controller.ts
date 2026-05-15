import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { LedgerService } from "./ledger.service.js";

@UseGuards(JwtAuthGuard)
@Controller("ledger")
export class LedgerController {
  constructor(@Inject(LedgerService) private readonly ledgerService: LedgerService) {}

  @Get("me")
  listMineV03(@Req() request: AuthenticatedRequest) {
    return this.ledgerService.listForUser(request.user.sub);
  }

  @Get()
  listMine(@Req() request: AuthenticatedRequest) {
    return this.ledgerService.listForUser(request.user.sub);
  }
}

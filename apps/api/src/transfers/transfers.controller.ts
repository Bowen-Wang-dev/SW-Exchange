import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { CreateTransferDto } from "./dto/create-transfer.dto.js";
import { TransfersService } from "./transfers.service.js";

@UseGuards(JwtAuthGuard)
@Controller("transfers")
export class TransfersController {
  constructor(@Inject(TransfersService) private readonly transfersService: TransfersService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(request.user.sub, dto);
  }

  @Get("me")
  listMine(@Req() request: AuthenticatedRequest) {
    return this.transfersService.listForUser(request.user.sub);
  }
}

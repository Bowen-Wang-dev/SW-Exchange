import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { TransfersService } from "./transfers.service.js";

@UseGuards(JwtAuthGuard)
@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  placeholder() {
    return this.transfersService.getPlaceholder();
  }
}

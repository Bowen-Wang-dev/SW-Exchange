import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { AssetsService } from "./assets.service.js";

@UseGuards(JwtAuthGuard)
@Controller("assets")
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assetsService: AssetsService) {}

  @Public()
  @Get()
  findAll() {
    return this.assetsService.findAll();
  }
}

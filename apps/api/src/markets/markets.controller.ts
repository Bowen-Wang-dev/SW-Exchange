import { Controller, Get } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { MarketsService } from "./markets.service.js";

@Controller("markets")
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Public()
  @Get()
  findAll() {
    return this.marketsService.findAll();
  }
}

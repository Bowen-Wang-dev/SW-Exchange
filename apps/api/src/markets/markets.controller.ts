import { Controller, Get, Inject, Query } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { MarketsService } from "./markets.service.js";

@Controller("markets")
export class MarketsController {
  constructor(@Inject(MarketsService) private readonly marketsService: MarketsService) {}

  @Public()
  @Get()
  findAll() {
    return this.marketsService.findAll();
  }

  @Public()
  @Get("ticker")
  getTicker(@Query("marketSymbol") marketSymbol?: string) {
    return this.marketsService.getTicker(marketSymbol);
  }

  @Public()
  @Get("candles")
  getCandles(
    @Query("marketSymbol") marketSymbol?: string,
    @Query("interval") interval?: string,
    @Query("limit") limit?: string,
  ) {
    return this.marketsService.getCandles(marketSymbol, interval, limit);
  }

  @Public()
  @Get("summary")
  getSummary() {
    return this.marketsService.getSummary();
  }
}

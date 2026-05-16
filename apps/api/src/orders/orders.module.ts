import { Module } from "@nestjs/common";
import { FeesModule } from "../fees/fees.module.js";
import { TradesModule } from "../trades/trades.module.js";
import { OrderBookController, OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [FeesModule, TradesModule],
  controllers: [OrdersController, OrderBookController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

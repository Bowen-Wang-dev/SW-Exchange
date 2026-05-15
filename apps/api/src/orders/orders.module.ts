import { Module } from "@nestjs/common";
import { TradesModule } from "../trades/trades.module.js";
import { OrderBookController, OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [TradesModule],
  controllers: [OrdersController, OrderBookController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

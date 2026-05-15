import { Module } from "@nestjs/common";
import { OrderBookController, OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  controllers: [OrdersController, OrderBookController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

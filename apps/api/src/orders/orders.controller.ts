import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { OrdersService } from "./orders.service.js";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list() {
    return this.ordersService.listPlaceholder();
  }
}

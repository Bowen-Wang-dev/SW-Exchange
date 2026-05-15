import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { OrdersService } from "./orders.service.js";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.createLimitOrder(request.user.sub, dto);
  }

  @Get("me")
  listMine(
    @Req() request: AuthenticatedRequest,
    @Query("status") status?: string,
    @Query("marketSymbol") marketSymbol?: string,
  ) {
    return this.ordersService.listForUser(request.user.sub, {
      status,
      marketSymbol,
    });
  }

  @Post(":id/cancel")
  cancel(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.ordersService.cancelOrder(request.user.sub, id);
  }
}

@Controller("order-book")
export class OrderBookController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Get()
  getOrderBook(@Query("marketSymbol") marketSymbol?: string) {
    return this.ordersService.getOrderBook(marketSymbol);
  }
}

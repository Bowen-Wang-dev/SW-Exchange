import { Body, Controller, Get, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { AirdropDto } from "./dto/airdrop.dto.js";
import { AdminService } from "./admin.service.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get()
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get("users")
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get("wallets")
  listWallets(
    @Query("userId") userId?: string,
    @Query("username") username?: string,
    @Query("email") email?: string,
    @Query("asset") asset?: string,
    @Query("assetSymbol") assetSymbol?: string,
  ) {
    return this.adminService.listWallets({
      userId,
      username,
      email,
      assetSymbol: assetSymbol ?? asset,
    });
  }

  @Post("airdrop")
  airdrop(@Req() request: AuthenticatedRequest, @Body() dto: AirdropDto) {
    return this.adminService.airdrop(request.user.sub, dto);
  }

  @Get("ledger")
  listLedger() {
    return this.adminService.listLedger();
  }

  @Get("transfers")
  listTransfers() {
    return this.adminService.listTransfers();
  }

  @Get("orders")
  listOrders() {
    return this.adminService.listOrders();
  }

  @Get("audit-logs")
  listAuditLogs() {
    return this.adminService.listAuditLogs();
  }
}

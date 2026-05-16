import { Body, Controller, Get, Inject, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { AdminWalletBucketTransferDto } from "./dto/admin-wallet-bucket-transfer.dto.js";
import { AirdropDto } from "./dto/airdrop.dto.js";
import { UpdateFeeSettingsDto } from "./dto/update-fee-settings.dto.js";
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

  @Get("wallet")
  getAdminWallet(@Req() request: AuthenticatedRequest) {
    return this.adminService.getAdminWallet(request.user.sub);
  }

  @Get("system-wallets")
  getAdminSystemWallets(@Req() request: AuthenticatedRequest) {
    return this.adminService.getAdminSystemWallets(request.user.sub);
  }

  @Post("wallet-buckets/transfer")
  transferAdminWalletBucket(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AdminWalletBucketTransferDto,
  ) {
    return this.adminService.transferAdminWalletBucket(request.user.sub, dto);
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

  @Get("trades")
  listTrades() {
    return this.adminService.listTrades();
  }

  @Get("fee-settings")
  getFeeSettings() {
    return this.adminService.getFeeSettings();
  }

  @Patch("fee-settings")
  updateFeeSettings(@Req() request: AuthenticatedRequest, @Body() dto: UpdateFeeSettingsDto) {
    return this.adminService.updateFeeSettings(request.user.sub, dto);
  }

  @Post("fee-settings")
  updateFeeSettingsViaPost(@Req() request: AuthenticatedRequest, @Body() dto: UpdateFeeSettingsDto) {
    return this.adminService.updateFeeSettings(request.user.sub, dto);
  }

  @Get("audit-logs")
  listAuditLogs() {
    return this.adminService.listAuditLogs();
  }
}

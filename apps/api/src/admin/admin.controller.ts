import { ADMIN_FEE_SETTINGS_READ_PERMISSIONS, ADMIN_REPORT_PERMISSIONS } from "@sw-exchange/shared";
import { RequireAdminPermissions } from "../admin-roles/admin-permissions.decorator.js";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { extractRequestSecurityContext } from "../security/security-events.service.js";
import { AdminWalletBucketTransferDto } from "./dto/admin-wallet-bucket-transfer.dto.js";
import { AirdropDto } from "./dto/airdrop.dto.js";
import { CreateAssetDto } from "./dto/create-asset.dto.js";
import { CreateMarketDto } from "./dto/create-market.dto.js";
import { UpdateAssetMetadataDto } from "./dto/update-asset-metadata.dto.js";
import { UpdateAssetStatusDto } from "./dto/update-asset-status.dto.js";
import { UpdateFeeSettingsDto } from "./dto/update-fee-settings.dto.js";
import { UpdateMarketStatusDto } from "./dto/update-market-status.dto.js";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto.js";
import { AdminService } from "./admin.service.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get()
  @RequireAdminPermissions("reports.read")
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get("reports/summary")
  @RequireAdminPermissions(...ADMIN_REPORT_PERMISSIONS)
  reportsSummary() {
    return this.adminService.reportsSummary();
  }

  @Get("users")
  @RequireAdminPermissions("users.read")
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch("users/:id/status")
  @RequireAdminPermissions("users.manage")
  updateUserStatus(
    @Req() request: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(
      request.user.sub,
      id,
      dto,
      extractRequestSecurityContext(request),
      request.user.authVersion,
    );
  }

  @Get("wallets")
  @RequireAdminPermissions("wallets.read")
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
  @RequireAdminPermissions("wallets.read")
  getAdminWallet(@Req() request: AuthenticatedRequest) {
    return this.adminService.getAdminWallet(request.user.sub);
  }

  @Get("system-wallets")
  @RequireAdminPermissions("wallets.read")
  getAdminSystemWallets(@Req() request: AuthenticatedRequest) {
    return this.adminService.getAdminSystemWallets(request.user.sub);
  }

  @Post("wallet-buckets/transfer")
  @RequireAdminPermissions("wallets.manage")
  transferAdminWalletBucket(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AdminWalletBucketTransferDto,
  ) {
    return this.adminService.transferAdminWalletBucket(
      request.user.sub,
      dto,
      extractRequestSecurityContext(request),
    );
  }

  @Post("airdrop")
  @RequireAdminPermissions("airdrops.execute")
  airdrop(@Req() request: AuthenticatedRequest, @Body() dto: AirdropDto) {
    return this.adminService.airdrop(request.user.sub, dto, extractRequestSecurityContext(request));
  }

  @Post("assets")
  @RequireAdminPermissions("assets.manage")
  createAsset(@Req() request: AuthenticatedRequest, @Body() dto: CreateAssetDto) {
    return this.adminService.createAsset(request.user.sub, dto);
  }

  @Get("ledger")
  @RequireAdminPermissions("ledger.read")
  listLedger() {
    return this.adminService.listLedger();
  }

  @Get("transfers")
  @RequireAdminPermissions("transfers.read")
  listTransfers() {
    return this.adminService.listTransfers();
  }

  @Patch("assets/:symbol/status")
  @RequireAdminPermissions("assets.manage")
  updateAssetStatus(
    @Req() request: AuthenticatedRequest,
    @Param("symbol") symbol: string,
    @Body() dto: UpdateAssetStatusDto,
  ) {
    return this.adminService.updateAssetStatus(
      request.user.sub,
      symbol,
      dto,
      extractRequestSecurityContext(request),
    );
  }

  @Patch("assets/:symbol/metadata")
  @RequireAdminPermissions("assets.manage")
  updateAssetMetadata(
    @Req() request: AuthenticatedRequest,
    @Param("symbol") symbol: string,
    @Body() dto: UpdateAssetMetadataDto,
  ) {
    return this.adminService.updateAssetMetadata(request.user.sub, symbol, dto);
  }

  @Patch("markets/:symbol/status")
  @RequireAdminPermissions("markets.manage")
  updateMarketStatus(
    @Req() request: AuthenticatedRequest,
    @Param("symbol") symbol: string,
    @Body() dto: UpdateMarketStatusDto,
  ) {
    return this.adminService.updateMarketStatus(
      request.user.sub,
      symbol,
      dto,
      extractRequestSecurityContext(request),
    );
  }

  @Post("markets")
  @RequireAdminPermissions("markets.manage")
  createMarket(@Req() request: AuthenticatedRequest, @Body() dto: CreateMarketDto) {
    return this.adminService.createMarket(request.user.sub, dto);
  }

  @Get("orders")
  @RequireAdminPermissions("orders.read")
  listOrders(
    @Query("status") status?: string,
    @Query("marketSymbol") marketSymbol?: string,
    @Query("user") user?: string,
  ) {
    return this.adminService.listOrders({ status, marketSymbol, user });
  }

  @Get("trades")
  @RequireAdminPermissions("trades.read")
  listTrades(@Query("marketSymbol") marketSymbol?: string, @Query("user") user?: string) {
    return this.adminService.listTrades({ marketSymbol, user });
  }

  @Get("fee-settings")
  @RequireAdminPermissions(...ADMIN_FEE_SETTINGS_READ_PERMISSIONS)
  getFeeSettings(@Query("marketSymbol") marketSymbol?: string) {
    return this.adminService.getFeeSettings(marketSymbol);
  }

  @Patch("fee-settings")
  @RequireAdminPermissions("fees.manage", ...ADMIN_FEE_SETTINGS_READ_PERMISSIONS)
  updateFeeSettings(@Req() request: AuthenticatedRequest, @Body() dto: UpdateFeeSettingsDto) {
    return this.adminService.updateFeeSettings(
      request.user.sub,
      dto,
      extractRequestSecurityContext(request),
    );
  }

  @Post("fee-settings")
  @RequireAdminPermissions("fees.manage", ...ADMIN_FEE_SETTINGS_READ_PERMISSIONS)
  updateFeeSettingsViaPost(@Req() request: AuthenticatedRequest, @Body() dto: UpdateFeeSettingsDto) {
    return this.adminService.updateFeeSettings(
      request.user.sub,
      dto,
      extractRequestSecurityContext(request),
    );
  }

  @Get("audit-logs")
  @RequireAdminPermissions("audit.read")
  listAuditLogs() {
    return this.adminService.listAuditLogs();
  }
}

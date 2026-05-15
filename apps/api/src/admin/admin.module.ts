import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { TradesModule } from "../trades/trades.module.js";
import { TransfersModule } from "../transfers/transfers.module.js";
import { WalletsModule } from "../wallets/wallets.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [LedgerModule, OrdersModule, TradesModule, TransfersModule, WalletsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

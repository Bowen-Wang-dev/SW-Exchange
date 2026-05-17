import { Module } from "@nestjs/common";
import { FeesModule } from "../fees/fees.module.js";
import { LedgerModule } from "../ledger/ledger.module.js";
import { MarketsModule } from "../markets/markets.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { TradesModule } from "../trades/trades.module.js";
import { TransfersModule } from "../transfers/transfers.module.js";
import { WalletsModule } from "../wallets/wallets.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [
    FeesModule,
    LedgerModule,
    MarketsModule,
    OrdersModule,
    TradesModule,
    TransfersModule,
    WalletsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

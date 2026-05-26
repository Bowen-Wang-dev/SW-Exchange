import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller.js";
import { AdminModule } from "./admin/admin.module.js";
import { AssetsModule } from "./assets/assets.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./db/database.module.js";
import { FeesModule } from "./fees/fees.module.js";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module.js";
import { LedgerModule } from "./ledger/ledger.module.js";
import { MarketsModule } from "./markets/markets.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { SecurityModule } from "./security/security.module.js";
import { TradesModule } from "./trades/trades.module.js";
import { TransfersModule } from "./transfers/transfers.module.js";
import { UsersModule } from "./users/users.module.js";
import { WalletsModule } from "./wallets/wallets.module.js";
import { validateEnv } from "./config/env.validation.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      validate: validateEnv,
    }),
    DatabaseModule,
    FeesModule,
    FeatureFlagsModule,
    AuthModule,
    UsersModule,
    AssetsModule,
    WalletsModule,
    LedgerModule,
    TransfersModule,
    MarketsModule,
    OrdersModule,
    SecurityModule,
    TradesModule,
    AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

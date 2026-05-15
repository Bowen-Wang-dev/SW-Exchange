import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module.js";
import { WalletsModule } from "../wallets/wallets.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [LedgerModule, WalletsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

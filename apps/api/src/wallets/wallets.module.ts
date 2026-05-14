import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module.js";
import { WalletsController } from "./wallets.controller.js";
import { WalletsService } from "./wallets.service.js";

@Module({
  imports: [AssetsModule],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}

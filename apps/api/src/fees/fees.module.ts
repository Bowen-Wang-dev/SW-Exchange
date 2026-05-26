import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module.js";
import { FeesService } from "./fees.service.js";

@Module({
  imports: [SecurityModule],
  providers: [FeesService],
  exports: [FeesService],
})
export class FeesModule {}

import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { walletTypeValues } from "../../db/schema/index.js";
import type { WalletType } from "../../db/schema/index.js";

export class AdminWalletBucketTransferDto {
  @IsString()
  @IsIn([...walletTypeValues])
  fromWalletType!: WalletType;

  @IsString()
  @IsIn([...walletTypeValues])
  toWalletType!: WalletType;

  @IsString()
  @IsIn(["SWC", "SWL"])
  assetSymbol!: "SWC" | "SWL";

  @IsString()
  @MaxLength(128)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

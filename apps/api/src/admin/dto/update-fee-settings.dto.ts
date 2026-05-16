import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateFeeSettingsDto {
  @IsString()
  @MaxLength(32)
  marketSymbol!: string;

  @IsString()
  @MaxLength(32)
  buyerFeeRatePercent!: string;

  @IsString()
  @MaxLength(32)
  sellerFeeRatePercent!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

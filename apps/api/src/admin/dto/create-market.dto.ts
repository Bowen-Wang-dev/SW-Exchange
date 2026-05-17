import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateMarketDto {
  @IsString()
  @MaxLength(16)
  baseAssetSymbol!: string;

  @IsString()
  @MaxLength(16)
  quoteAssetSymbol!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  symbol?: string;

  @IsOptional()
  @IsString()
  status?: "ACTIVE" | "PAUSED";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePrecision?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountPrecision?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  minOrderAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  minNotional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateOrderDto {
  @IsString()
  @MaxLength(32)
  marketSymbol!: string;

  @IsString()
  @IsIn(["BUY", "SELL"])
  side!: "BUY" | "SELL";

  @IsOptional()
  @IsString()
  @IsIn(["LIMIT", "MARKET"])
  type?: "LIMIT" | "MARKET";

  @IsOptional()
  @IsString()
  @MaxLength(128)
  price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  quoteAmount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  spendAmount?: string;
}

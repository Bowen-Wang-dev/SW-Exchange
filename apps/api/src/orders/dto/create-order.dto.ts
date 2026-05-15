import { IsIn, IsString, MaxLength } from "class-validator";

export class CreateOrderDto {
  @IsString()
  @MaxLength(32)
  marketSymbol!: string;

  @IsString()
  @IsIn(["BUY", "SELL"])
  side!: "BUY" | "SELL";

  @IsString()
  @MaxLength(128)
  price!: string;

  @IsString()
  @MaxLength(128)
  amount!: string;
}

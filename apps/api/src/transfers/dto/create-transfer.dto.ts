import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTransferDto {
  @IsString()
  @MaxLength(255)
  recipient!: string;

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

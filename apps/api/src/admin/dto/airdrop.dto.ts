import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class AirdropDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

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

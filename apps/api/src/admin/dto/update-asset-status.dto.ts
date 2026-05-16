import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAssetStatusDto {
  @IsOptional()
  @IsString()
  @IsIn(["ACTIVE", "PAUSED"])
  status?: "ACTIVE" | "PAUSED";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateMarketStatusDto {
  @IsString()
  @IsIn(["ACTIVE", "PAUSED"])
  status!: "ACTIVE" | "PAUSED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

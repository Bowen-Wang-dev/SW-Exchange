import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateAssetDto {
  @IsString()
  @MaxLength(16)
  symbol!: string;

  @IsString()
  @MaxLength(128)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string | null;

  @IsInt()
  @Min(0)
  decimals!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  iconUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number | null;

  @IsOptional()
  @IsString()
  status?: "ACTIVE" | "PAUSED";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

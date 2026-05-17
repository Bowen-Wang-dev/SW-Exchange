import { IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateAssetMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string | null;

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
}

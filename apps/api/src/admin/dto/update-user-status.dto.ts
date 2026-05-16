import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUserStatusDto {
  @IsString()
  @IsIn(["ACTIVE", "FROZEN", "BANNED"])
  status!: "ACTIVE" | "FROZEN" | "BANNED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

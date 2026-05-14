import { plainToInstance } from "class-transformer";
import { IsInt, IsOptional, IsString, Min, validateSync } from "class-validator";

class EnvironmentVariables {
  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsString()
  ADMIN_EMAIL!: string;

  @IsString()
  ADMIN_USERNAME!: string;

  @IsString()
  ADMIN_PASSWORD!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}

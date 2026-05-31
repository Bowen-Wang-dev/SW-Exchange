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

  @IsOptional()
  @IsString()
  WEB_APP_URL?: string;

  @IsOptional()
  @IsString()
  EMAIL_PROVIDER?: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  EMAIL_VERIFICATION_TOKEN_TTL_MINUTES?: number;

  @IsString()
  ADMIN_EMAIL!: string;

  @IsString()
  ADMIN_USERNAME!: string;

  @IsString()
  ADMIN_PASSWORD!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const normalizedConfig = {
    ...config,
    PORT: normalizeOptionalNumber(config.PORT),
    EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: normalizeOptionalNumber(
      config.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
    ),
  };

  const validatedConfig = plainToInstance(EnvironmentVariables, normalizedConfig, {
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

function normalizeOptionalNumber(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return undefined;
    }

    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
}

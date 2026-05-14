import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedCorsOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`), false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();

function isAllowedCorsOrigin(origin: string) {
  const configuredOrigins = parseConfiguredOrigins(process.env.CORS_ORIGIN);
  const allowedOrigins =
    process.env.NODE_ENV === "production"
      ? configuredOrigins
      : new Set([
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          ...configuredOrigins,
        ]);

  if (allowedOrigins.has(origin)) {
    return true;
  }

  return process.env.NODE_ENV !== "production" && /^https:\/\/.+\.app\.github\.dev$/.test(origin);
}

function parseConfiguredOrigins(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

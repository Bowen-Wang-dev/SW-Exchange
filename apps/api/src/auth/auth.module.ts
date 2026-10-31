import { TwoFactorService } from "./two-factor.service.js";
import { AuthRateLimitService } from "./auth-rate-limit.service.js";
import { FeatureFlagsModule } from "../feature-flags/feature-flags.module.js";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { MailModule } from "../mail/mail.module.js";
import { SecurityModule } from "../security/security.module.js";
import { UsersModule } from "../users/users.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { EmailVerificationService } from "./email-verification.service.js";
import { JwtStrategy } from "./jwt.strategy.js";

@Module({
  imports: [
    UsersModule,
    FeatureFlagsModule,
    MailModule,
    SecurityModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: (configService.get<string>("JWT_EXPIRES_IN") ?? "7d") as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [TwoFactorService, AuthRateLimitService, AuthService, EmailVerificationService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

import { Header, Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { extractRequestSecurityContext } from "../security/security-events.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { AuthService } from "./auth.service.js";
import { ConfirmEmailVerificationDto } from "./dto/confirm-email-verification.dto.js";
import { EmailVerificationService } from "./email-verification.service.js";

import { TwoFactorService } from "./two-factor.service.js";
import { TwoFactorActionDto, TwoFactorLoginDto, TwoFactorReauthDto, TwoFactorSetupDto } from "./dto/two-factor.dto.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(TwoFactorService) private readonly twoFactor: TwoFactorService,
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(EmailVerificationService)
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Public()
  @Header("Cache-Control", "no-store")
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Header("Cache-Control", "no-store")
  @Post("login")
  login(@Req() request: AuthenticatedRequest, @Body() dto: LoginDto) {
    return this.authService.login(dto, authContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Post("2fa/reauth")
  reauthenticate(@Req() request: AuthenticatedRequest, @Body() dto: TwoFactorReauthDto) {
    return this.twoFactor.reauthenticate(request.user.sub, request.user.authVersion ?? 0, dto.password, dto.purpose);
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Post("2fa/setup")
  setup(@Req() request: AuthenticatedRequest, @Body() dto: TwoFactorSetupDto) {
    return this.twoFactor.setup(request.user.sub, request.user.authVersion ?? 0, dto.reauthToken, authContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Post("2fa/enable")
  enable(@Req() request: AuthenticatedRequest, @Body() dto: TwoFactorActionDto) {
    return this.authService.enableTwoFactor(request.user.sub, request.user.authVersion ?? 0, dto.code, dto.reauthToken, authContext(request));
  }

  @Public()
  @Header("Cache-Control", "no-store")
  @Post("2fa/login")
  secondStep(@Req() request: Request, @Body() dto: TwoFactorLoginDto) {
    return this.authService.completeTwoFactorLogin(dto.challengeToken, dto.code, authContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Post("2fa/disable")
  disable(@Req() request: AuthenticatedRequest, @Body() dto: TwoFactorActionDto) {
    return this.authService.manageTwoFactor(request.user.sub, request.user.authVersion ?? 0, dto.code, dto.reauthToken, "disable", authContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Post("2fa/recovery-codes/regenerate")
  regenerate(@Req() request: AuthenticatedRequest, @Body() dto: TwoFactorActionDto) {
    return this.authService.manageTwoFactor(request.user.sub, request.user.authVersion ?? 0, dto.code, dto.reauthToken, "regenerate", authContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Post("logout")
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user, authContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  @Post("email-verification/request")
  requestEmailVerification(@Req() request: AuthenticatedRequest) {
    return this.emailVerificationService.requestVerification(
      request.user.sub,
      authContext(request),
    );
  }

  @Public()
  @Header("Cache-Control", "no-store")
  @Post("email-verification/confirm")
  confirmEmailVerification(
    @Req() request: Request,
    @Body() dto: ConfirmEmailVerificationDto,
  ) {
    return this.emailVerificationService.confirmVerification(
      dto.token,
      authContext(request),
    );
  }
}

function authContext(request: Request) {
  return { ...extractRequestSecurityContext(request), ipAddress: request.socket.remoteAddress ?? null };
}

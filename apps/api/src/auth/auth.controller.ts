import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
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

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(EmailVerificationService)
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  login(@Req() request: AuthenticatedRequest, @Body() dto: LoginDto) {
    return this.authService.login(dto, extractRequestSecurityContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user, extractRequestSecurityContext(request));
  }

  @UseGuards(JwtAuthGuard)
  @Post("email-verification/request")
  requestEmailVerification(@Req() request: AuthenticatedRequest) {
    return this.emailVerificationService.requestVerification(
      request.user.sub,
      extractRequestSecurityContext(request),
    );
  }

  @Public()
  @Post("email-verification/confirm")
  confirmEmailVerification(
    @Req() request: Request,
    @Body() dto: ConfirmEmailVerificationDto,
  ) {
    return this.emailVerificationService.confirmVerification(
      dto.token,
      extractRequestSecurityContext(request),
    );
  }
}

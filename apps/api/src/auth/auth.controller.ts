import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { extractRequestSecurityContext } from "../security/security-events.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

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
}

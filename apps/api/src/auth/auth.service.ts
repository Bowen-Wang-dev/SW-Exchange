import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { type UserRole } from "@sw-exchange/shared";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { SecurityEventsService } from "../security/security-events.service.js";
import { UsersService } from "../users/users.service.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(SecurityEventsService) private readonly securityEventsService: SecurityEventsService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmailOrUsername(dto.email, dto.username);

    if (existing) {
      throw new BadRequestException("Email or username already exists.");
    }

    const passwordHash = await hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      nickname: dto.nickname?.trim() || null,
      passwordHash,
      role: "USER",
    });

    const token = await this.signToken(user);

    return {
      user: this.usersService.toPublicUser(user),
      accessToken: token,
    };
  }

  async login(
    dto: LoginDto,
    context?: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    const identifier = dto.identifier.trim();
    const user = await this.usersService.findByIdentifier(identifier);

    if (!user) {
      await this.recordLoginFailure(null, null, identifier, "IDENTIFIER_NOT_FOUND", context);
      throw new UnauthorizedException("Invalid credentials.");
    }

    if (user.isSystem) {
      await this.recordLoginFailure(user.id, user.role, identifier, "SYSTEM_ACCOUNT", context);
      throw new UnauthorizedException("System accounts cannot log in.");
    }

    const isValidPassword = await compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      await this.recordLoginFailure(user.id, user.role, identifier, "INVALID_PASSWORD", context);
      throw new UnauthorizedException("Invalid credentials.");
    }

    if (user.status === "BANNED") {
      await this.recordLoginFailure(user.id, user.role, identifier, "USER_BANNED", context);
      throw new UnauthorizedException("USER_BANNED");
    }

    const token = await this.signToken(user);
    await this.securityEventsService.recordEvent({
      actorUserId: user.id,
      actorRole: user.role,
      eventType: "AUTH_LOGIN_SUCCESS",
      severity: "INFO",
      targetType: "USER",
      targetId: user.id,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {
        identifier,
        loginMethod: "PASSWORD",
        status: user.status,
      },
    });

    return {
      user: this.usersService.toPublicUser(user),
      accessToken: token,
    };
  }

  async logout(
    user: {
      sub: string;
      role: UserRole;
      status: string;
    },
    context?: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    await this.securityEventsService.recordEvent({
      actorUserId: user.sub,
      actorRole: user.role,
      eventType: "AUTH_LOGOUT",
      severity: "INFO",
      targetType: "USER",
      targetId: user.sub,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {
        logoutMethod: "CLIENT_REQUEST",
        status: user.status,
      },
    });

    return {
      success: true,
    };
  }

  private async signToken(user: Awaited<ReturnType<UsersService["findByIdentifier"]>>) {
    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      status: user.status,
      isSystem: user.isSystem,
    });
  }

  private async recordLoginFailure(
    actorUserId: string | null,
    actorRole: UserRole | null,
    identifier: string,
    reason: string,
    context?: {
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ) {
    await this.securityEventsService.recordEvent({
      actorUserId,
      actorRole,
      eventType: "AUTH_LOGIN_FAILED",
      severity: "WARNING",
      targetType: "USER",
      targetId: actorUserId,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      metadata: {
        identifier,
        loginMethod: "PASSWORD",
        reason,
      },
    });
  }
}

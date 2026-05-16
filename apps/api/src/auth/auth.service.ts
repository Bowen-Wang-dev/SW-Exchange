import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { UsersService } from "../users/users.service.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
    @Inject(JwtService) private readonly jwtService: JwtService,
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

  async login(dto: LoginDto) {
    const user = await this.usersService.findByIdentifier(dto.identifier);

    if (!user) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    if (user.isSystem) {
      throw new UnauthorizedException("System accounts cannot log in.");
    }

    const isValidPassword = await compare(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    if (user.status === "BANNED") {
      throw new UnauthorizedException("USER_BANNED");
    }

    const token = await this.signToken(user);

    return {
      user: this.usersService.toPublicUser(user),
      accessToken: token,
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
}

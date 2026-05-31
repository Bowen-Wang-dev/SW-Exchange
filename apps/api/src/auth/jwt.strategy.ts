import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../users/users.service.js";
import type { AuthenticatedUser } from "../common/interfaces/authenticated-request.interface.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: AuthenticatedUser) {
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.isSystem) {
      throw new UnauthorizedException("Invalid session.");
    }

    if (user.status === "BANNED") {
      throw new UnauthorizedException("USER_BANNED");
    }

    return {
      sub: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      status: user.status,
      isSystem: user.isSystem,
      emailVerified: Boolean(user.emailVerifiedAt),
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}

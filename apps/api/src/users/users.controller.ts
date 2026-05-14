import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import { RolesGuard } from "../common/guards/roles.guard.js";
import type { AuthenticatedRequest } from "../common/interfaces/authenticated-request.interface.js";
import { UsersService } from "./users.service.js";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get("me")
  me(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }

  @Roles("ADMIN")
  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map((user: Awaited<(typeof users)[number]>) => this.usersService.toPublicUser(user));
  }
}

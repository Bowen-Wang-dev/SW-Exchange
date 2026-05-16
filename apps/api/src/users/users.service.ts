import { Inject, Injectable } from "@nestjs/common";
import { eq, or } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { users } from "../db/schema/index.js";
import { WalletsService } from "../wallets/wallets.service.js";

type User = InferSelectModel<typeof users>;
type NewUser = InferInsertModel<typeof users>;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(WalletsService) private readonly walletsService: WalletsService,
  ) {}

  async create(
    data: Pick<NewUser, "email" | "username" | "nickname" | "passwordHash" | "role">,
  ) {
    const [user] = await this.db
      .insert(users)
      .values({
        ...data,
      })
      .returning();

    if (!user) {
      throw new Error("Failed to create user.");
    }

    await this.walletsService.ensureWalletsForUser(user.id);
    return user;
  }

  async findByIdentifier(identifier: string) {
    const normalizedIdentifier = identifier.trim();
    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.email, normalizedIdentifier), eq(users.username, normalizedIdentifier)))
      .limit(1);

    return (user as User | undefined) ?? null;
  }

  async findByEmailOrUsername(email: string, username: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    return (user as User | undefined) ?? null;
  }

  async findAll() {
    return this.db.select().from(users).where(eq(users.isSystem, false));
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
      status: user.status,
      isSystem: user.isSystem,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

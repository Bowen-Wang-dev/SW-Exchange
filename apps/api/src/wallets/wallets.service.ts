import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DEFAULT_ASSETS } from "@sw-exchange/shared";
import { formatMinimalUnitsToHuman } from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, users, wallets } from "../db/schema/index.js";

@Injectable()
export class WalletsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async ensureWalletsForUser(userId: string) {
    const activeSymbols = DEFAULT_ASSETS.map((asset) => asset.symbol);
    const assetRows = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.isActive, true), inArray(assets.symbol, activeSymbols)));

    for (const asset of assetRows) {
      await this.db
        .insert(wallets)
        .values({
          userId,
          assetId: asset.id,
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();
    }
  }

  async ensureWalletsForAllUsers() {
    const userRows = await this.db.select({ id: users.id }).from(users);

    for (const user of userRows) {
      await this.ensureWalletsForUser(user.id);
    }
  }

  async findByUserId(userId: string) {
    await this.ensureWalletsForUser(userId);

    const rows = await this.db
      .select({
        id: wallets.id,
        userId: wallets.userId,
        assetId: wallets.assetId,
        availableBalance: wallets.availableBalance,
        lockedBalance: wallets.lockedBalance,
        symbol: assets.symbol,
        name: assets.name,
        decimals: assets.decimals,
      })
      .from(wallets)
      .innerJoin(assets, eq(wallets.assetId, assets.id))
      .where(eq(wallets.userId, userId))
      .orderBy(asc(assets.symbol));

    return rows.map((wallet) => this.formatWalletRow(wallet));
  }

  formatWalletRow(wallet: {
    id?: string;
    userId?: string;
    assetId?: string;
    availableBalance: bigint;
    lockedBalance: bigint;
    symbol: string;
    name: string;
    decimals: number;
  }) {
    const total = wallet.availableBalance + wallet.lockedBalance;

    return {
      id: wallet.id,
      userId: wallet.userId,
      assetId: wallet.assetId,
      asset: wallet.symbol,
      symbol: wallet.symbol,
      name: wallet.name,
      decimals: wallet.decimals,
      available: formatMinimalUnitsToHuman(wallet.availableBalance, wallet.decimals),
      locked: formatMinimalUnitsToHuman(wallet.lockedBalance, wallet.decimals),
      total: formatMinimalUnitsToHuman(total, wallet.decimals),
      availableRaw: wallet.availableBalance.toString(),
      lockedRaw: wallet.lockedBalance.toString(),
      totalRaw: total.toString(),
    };
  }
}

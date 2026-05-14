import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DEFAULT_ASSETS } from "@sw-exchange/shared";
import { DRIZZLE_DB } from "../db/database.module.js";
import { assets, wallets } from "../db/schema/index.js";

@Injectable()
export class WalletsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: any) {}

  async ensureWalletsForUser(userId: string) {
    const assetRows = await this.db.select().from(assets);
    const fallbackSymbols = new Set(DEFAULT_ASSETS.map((asset) => asset.symbol));

    for (const asset of assetRows) {
      if (!fallbackSymbols.has(asset.symbol)) {
        continue;
      }

      const [wallet] = await this.db
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, userId), eq(wallets.assetId, asset.id)))
        .limit(1);

      if (!wallet) {
        await this.db.insert(wallets).values({
          userId,
          assetId: asset.id,
          availableBalance: 0n,
          lockedBalance: 0n,
        });
      }
    }
  }

  async findByUserId(userId: string) {
    return this.db
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
      .where(eq(wallets.userId, userId));
  }
}

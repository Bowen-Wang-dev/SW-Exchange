import { Inject, Injectable } from "@nestjs/common";
import { asc, eq, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { DEFAULT_ASSETS } from "@sw-exchange/shared";
import { DRIZZLE_DB } from "../db/database.module.js";
import { assets } from "../db/schema/index.js";

type Asset = InferSelectModel<typeof assets>;

@Injectable()
export class AssetsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: any) {}

  async findAll() {
    const rows = (await this.db
      .select()
      .from(assets)
      .orderBy(asc(assets.sortOrder), asc(assets.symbol))) as Asset[];

    return rows.map((asset) => this.formatAsset(asset));
  }

  async findBySymbol(symbol: string) {
    const [asset] = await this.db.select().from(assets).where(eq(assets.symbol, symbol)).limit(1);
    return asset ? this.formatAsset(asset as Asset) : null;
  }

  async ensureDefaultAssets() {
    for (const asset of DEFAULT_ASSETS) {
      const existing = await this.findBySymbol(asset.symbol);
      if (!existing) {
        await this.db.insert(assets).values(asset);
        continue;
      }

      await this.db
        .update(assets)
        .set({
          displayName: sql`COALESCE(${assets.displayName}, ${asset.displayName})`,
          iconSource: sql`COALESCE(${assets.iconSource}, ${asset.iconSource})`,
          sortOrder: sql`COALESCE(${assets.sortOrder}, ${asset.sortOrder})`,
          description: sql`COALESCE(${assets.description}, ${asset.description})`,
          updatedAt: new Date(),
        })
        .where(eq(assets.symbol, asset.symbol));
    }
  }

  formatAsset(asset: Asset) {
    return {
      ...asset,
      displayName: asset.displayName ?? asset.name,
      display_name: asset.displayName ?? asset.name,
      iconUrl: asset.iconUrl,
      icon_url: asset.iconUrl,
      iconSource: asset.iconSource ?? (asset.iconUrl ? "MANUAL" : "FALLBACK"),
      icon_source: asset.iconSource ?? (asset.iconUrl ? "MANUAL" : "FALLBACK"),
      sortOrder: asset.sortOrder,
      sort_order: asset.sortOrder,
      status: asset.isActive ? "ACTIVE" : "PAUSED",
      created_at: asset.createdAt,
      updated_at: asset.updatedAt,
    };
  }
}

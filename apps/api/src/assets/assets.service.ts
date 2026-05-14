import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { DEFAULT_ASSETS } from "@sw-exchange/shared";
import { DRIZZLE_DB } from "../db/database.module.js";
import { assets } from "../db/schema/index.js";

type Asset = InferSelectModel<typeof assets>;

@Injectable()
export class AssetsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: any) {}

  async findAll() {
    return (await this.db.select().from(assets)) as Asset[];
  }

  async findBySymbol(symbol: string) {
    const [asset] = await this.db.select().from(assets).where(eq(assets.symbol, symbol)).limit(1);
    return (asset as Asset | undefined) ?? null;
  }

  async ensureDefaultAssets() {
    for (const asset of DEFAULT_ASSETS) {
      const existing = await this.findBySymbol(asset.symbol);
      if (!existing) {
        await this.db.insert(assets).values(asset);
      }
    }
  }
}

import { config as loadEnv } from "dotenv";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DEFAULT_ASSETS, DEFAULT_MARKETS } from "@sw-exchange/shared";
import * as schema from "../db/schema/index.js";

loadEnv({ path: ".env" });
loadEnv({ path: "../../.env" });

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!databaseUrl || !adminEmail || !adminUsername || !adminPassword) {
    throw new Error("DATABASE_URL, ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD are required.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  for (const asset of DEFAULT_ASSETS) {
    const [existingAsset] = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.symbol, asset.symbol))
      .limit(1);

    if (!existingAsset) {
      await db.insert(schema.assets).values({
        symbol: asset.symbol,
        name: asset.name,
        decimals: asset.decimals,
        isActive: true,
      });
    }
  }

  let [adminUser] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, adminEmail))
    .limit(1);

  if (!adminUser) {
    const passwordHash = await hash(adminPassword, 12);
    [adminUser] = await db
      .insert(schema.users)
      .values({
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      })
      .returning();
  }

  if (!adminUser) {
    throw new Error("Failed to create or load the admin user during seed.");
  }

  const assetRows = await db.select().from(schema.assets);
  for (const asset of assetRows) {
    const [wallet] = await db
      .select()
      .from(schema.wallets)
      .where(and(eq(schema.wallets.userId, adminUser.id), eq(schema.wallets.assetId, asset.id)))
      .limit(1);

    if (!wallet) {
      await db.insert(schema.wallets).values({
        userId: adminUser.id,
        assetId: asset.id,
        availableBalance: 0n,
        lockedBalance: 0n,
      });
    }
  }

  for (const market of DEFAULT_MARKETS) {
    const [existingMarket] = await db
      .select()
      .from(schema.markets)
      .where(eq(schema.markets.symbol, market.symbol))
      .limit(1);

    if (existingMarket) {
      continue;
    }

    const [baseAsset] = assetRows.filter((asset) => asset.symbol === market.baseAssetSymbol);
    const [quoteAsset] = assetRows.filter((asset) => asset.symbol === market.quoteAssetSymbol);

    if (!baseAsset || !quoteAsset) {
      throw new Error(`Missing seeded assets for market ${market.symbol}.`);
    }

    await db.insert(schema.markets).values({
      symbol: market.symbol,
      baseAssetId: baseAsset.id,
      quoteAssetId: quoteAsset.id,
      status: "ACTIVE",
      priceDecimals: 18,
      amountDecimals: 18,
    });
  }

  await pool.end();
  console.log("Seed completed successfully.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

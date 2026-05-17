import { config as loadEnv } from "dotenv";
import { hash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DEFAULT_ASSETS, DEFAULT_MARKETS } from "@sw-exchange/shared";
import * as schema from "../db/schema/index.js";

const DEFAULT_FEE_RATE_BPS = 10;
const ADMIN_WALLET_TYPES = ["MAIN", "FEE", "TREASURY", "AIRDROP", "HOT"] as const;
const LEGACY_FEE_ACCOUNT_USERNAME = "FEE_ACCOUNT";
const LEGACY_FEE_ACCOUNT_EMAIL = "fee-account@system.sw-exchange.local";

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
        displayName: asset.displayName,
        decimals: asset.decimals,
        iconSource: asset.iconSource,
        sortOrder: asset.sortOrder,
        description: asset.description,
        isActive: true,
      });
      continue;
    }

    await db
      .update(schema.assets)
      .set({
        displayName: sql`COALESCE(${schema.assets.displayName}, ${asset.displayName})`,
        iconSource: sql`COALESCE(${schema.assets.iconSource}, ${asset.iconSource})`,
        sortOrder: sql`COALESCE(${schema.assets.sortOrder}, ${asset.sortOrder})`,
        description: sql`COALESCE(${schema.assets.description}, ${asset.description})`,
        updatedAt: new Date(),
      })
      .where(eq(schema.assets.id, existingAsset.id));
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

  if (
    adminUser.username !== adminUsername ||
    adminUser.role !== "ADMIN" ||
    adminUser.status !== "ACTIVE" ||
    adminUser.isSystem
  ) {
    [adminUser] = await db
      .update(schema.users)
      .set({
        username: adminUsername,
        role: "ADMIN",
        status: "ACTIVE",
        isSystem: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, adminUser.id))
      .returning();
  }

  if (!adminUser) {
    throw new Error("Failed to repair the admin user during seed.");
  }

  const assetRows = await db.select().from(schema.assets);
  for (const asset of assetRows) {
    for (const walletType of ADMIN_WALLET_TYPES) {
      await db
        .insert(schema.wallets)
        .values({
          userId: adminUser.id,
          assetId: asset.id,
          walletType,
          availableBalance: 0n,
          lockedBalance: 0n,
        })
        .onConflictDoNothing();
    }
  }

  const [legacyFeeAccount] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.isSystem, true),
        eq(schema.users.username, LEGACY_FEE_ACCOUNT_USERNAME),
      ),
    )
    .limit(1);

  let legacyFeeUser = legacyFeeAccount;
  if (!legacyFeeUser) {
    [legacyFeeUser] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.isSystem, true),
          eq(schema.users.email, LEGACY_FEE_ACCOUNT_EMAIL),
        ),
      )
      .limit(1);
  }

  if (legacyFeeUser) {
    for (const asset of assetRows.filter((asset) => asset.symbol === "SWC" || asset.symbol === "SWL")) {
      const [legacyWallet] = await db
        .select()
        .from(schema.wallets)
        .where(
          and(
            eq(schema.wallets.userId, legacyFeeUser.id),
            eq(schema.wallets.assetId, asset.id),
            eq(schema.wallets.walletType, "MAIN"),
          ),
        )
        .limit(1);

      if (
        legacyWallet &&
        (legacyWallet.availableBalance !== 0n || legacyWallet.lockedBalance !== 0n)
      ) {
        await db
          .insert(schema.wallets)
          .values({
            userId: adminUser.id,
            assetId: asset.id,
            walletType: "FEE",
            availableBalance: legacyWallet.availableBalance,
            lockedBalance: legacyWallet.lockedBalance,
          })
          .onConflictDoUpdate({
            target: [schema.wallets.userId, schema.wallets.assetId, schema.wallets.walletType],
            set: {
              availableBalance:
                sql`${schema.wallets.availableBalance} + ${legacyWallet.availableBalance}`,
              lockedBalance:
                sql`${schema.wallets.lockedBalance} + ${legacyWallet.lockedBalance}`,
              updatedAt: new Date(),
            },
          });

        await db
          .update(schema.wallets)
          .set({
            availableBalance: 0n,
            lockedBalance: 0n,
            updatedAt: new Date(),
          })
          .where(eq(schema.wallets.id, legacyWallet.id));
      }
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

  const [swlSwcMarket] = await db
    .select()
    .from(schema.markets)
    .where(eq(schema.markets.symbol, "SWL/SWC"))
    .limit(1);

  if (!swlSwcMarket) {
    throw new Error("Missing SWL/SWC market for default fee setting.");
  }

  const [existingFeeSetting] = await db
    .select()
    .from(schema.feeSettings)
    .where(eq(schema.feeSettings.marketSymbol, "SWL/SWC"))
    .limit(1);

  if (!existingFeeSetting) {
    await db.insert(schema.feeSettings).values({
      marketId: swlSwcMarket.id,
      marketSymbol: swlSwcMarket.symbol,
      buyerFeeRateBps: DEFAULT_FEE_RATE_BPS,
      sellerFeeRateBps: DEFAULT_FEE_RATE_BPS,
      isActive: true,
    });
  } else if (existingFeeSetting.marketId !== swlSwcMarket.id || !existingFeeSetting.isActive) {
    await db
      .update(schema.feeSettings)
      .set({
        marketId: swlSwcMarket.id,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.feeSettings.id, existingFeeSetting.id));
  }

  await pool.end();
  console.log("Seed completed successfully.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

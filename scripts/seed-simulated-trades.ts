import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../apps/api/src/db/schema/index.js";

loadEnv({ path: ".env" });

// Local demo helper only. This is intentionally not wired into db:seed because it
// creates synthetic settled trades for chart demos and manual UI review.
const HUMAN_SCALE = 10n ** 18n;
const MARKET_SYMBOLS = ["SWL/SWC", "SWD/SWC"] as const;
const BUYER_EMAIL = "sim-buyer@swexchange.local";
const SELLER_EMAIL = "sim-seller@swexchange.local";
const BUYER_USERNAME = "sim_buyer";
const SELLER_USERNAME = "sim_seller";
const PASSWORD_HASH = "simulated-trading-user";
const REQUIRED_OPT_IN = "local-demo-only";

function toUnits(value: number) {
  return BigInt(Math.round(value * 1_000_000)) * 10n ** 12n;
}

function seededNoise(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function priceFor(index: number, basePrice: number, salt: number) {
  const trend = Math.sin(index / 7 + salt) * basePrice * 0.035;
  const pulse = Math.sin(index / 3.5 + salt * 2) * basePrice * 0.012;
  const noise = (seededNoise(index, salt) - 0.5) * basePrice * 0.018;
  return Math.max(basePrice * 0.6, basePrice + trend + pulse + noise);
}

async function ensureUser(db: ReturnType<typeof drizzle<typeof schema>>, input: {
  email: string;
  username: string;
}) {
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, input.email))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(schema.users)
    .values({
      email: input.email,
      username: input.username,
      passwordHash: PASSWORD_HASH,
      role: "USER",
      status: "ACTIVE",
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create ${input.username}`);
  }

  return created;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  assertLocalDemoRun(databaseUrl);

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    const buyer = await ensureUser(db, { email: BUYER_EMAIL, username: BUYER_USERNAME });
    const seller = await ensureUser(db, { email: SELLER_EMAIL, username: SELLER_USERNAME });
    const assets = await db.select().from(schema.assets);

    for (const user of [buyer, seller]) {
      for (const asset of assets) {
        // Do not reset or overwrite existing balances. New helper users get
        // isolated demo wallets only when those wallets do not already exist.
        await db
          .insert(schema.wallets)
          .values({
            userId: user.id,
            assetId: asset.id,
            walletType: "MAIN",
            availableBalance: 10_000_000n * HUMAN_SCALE,
            lockedBalance: 0n,
          })
          .onConflictDoNothing();
      }
    }

    const now = Date.now();
    let insertedTrades = 0;

    for (const [marketIndex, marketSymbol] of MARKET_SYMBOLS.entries()) {
      const [market] = await db
        .select()
        .from(schema.markets)
        .where(eq(schema.markets.symbol, marketSymbol))
        .limit(1);

      if (!market) {
        throw new Error(`Market ${marketSymbol} was not found.`);
      }

      const basePrice = marketSymbol === "SWL/SWC" ? 8.6 : 0.42;
      const start = now - 48 * 60 * 60 * 1000;

      for (let i = 0; i < 192; i += 1) {
        const createdAt = new Date(start + i * 15 * 60 * 1000);
        const price = toUnits(priceFor(i, basePrice, marketIndex + 1));
        const amount = toUnits(35 + seededNoise(i, marketIndex + 11) * 180);
        const quoteAmount = (price * amount) / HUMAN_SCALE;

        const [existing] = await db
          .select({ id: schema.trades.id })
          .from(schema.trades)
          .where(and(eq(schema.trades.marketId, market.id), eq(schema.trades.createdAt, createdAt)))
          .limit(1);

        if (existing) {
          continue;
        }

        const [buyOrder] = await db
          .insert(schema.orders)
          .values({
            userId: buyer.id,
            marketId: market.id,
            side: "BUY",
            type: "LIMIT",
            status: "FILLED",
            price,
            amount,
            filledAmount: amount,
            remainingAmount: 0n,
            lockedAssetId: market.quoteAssetId,
            lockedAmount: quoteAmount,
            createdAt,
            updatedAt: createdAt,
          })
          .returning();

        const [sellOrder] = await db
          .insert(schema.orders)
          .values({
            userId: seller.id,
            marketId: market.id,
            side: "SELL",
            type: "LIMIT",
            status: "FILLED",
            price,
            amount,
            filledAmount: amount,
            remainingAmount: 0n,
            lockedAssetId: market.baseAssetId,
            lockedAmount: amount,
            createdAt,
            updatedAt: createdAt,
          })
          .returning();

        if (!buyOrder || !sellOrder) {
          throw new Error(`Failed to create simulated orders for ${marketSymbol}.`);
        }

        await db.insert(schema.trades).values({
          marketId: market.id,
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
          buyerId: buyer.id,
          sellerId: seller.id,
          price,
          amount,
          quoteAmount,
          buyerFee: 0n,
          sellerFee: 0n,
          buyerFeeAssetId: market.baseAssetId,
          sellerFeeAssetId: market.quoteAssetId,
          buyerFeeRateBps: 0,
          sellerFeeRateBps: 0,
          status: "SETTLED",
          createdAt,
        });
        insertedTrades += 1;
      }
    }

    console.log(`Inserted ${insertedTrades} simulated trades.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function assertLocalDemoRun(databaseUrl: string) {
  if (process.env.SW_EXCHANGE_ALLOW_SIMULATED_TRADES !== REQUIRED_OPT_IN) {
    throw new Error(
      `Refusing to seed simulated trades. Set SW_EXCHANGE_ALLOW_SIMULATED_TRADES=${REQUIRED_OPT_IN} for a local demo run.`,
    );
  }

  const host = readDatabaseHost(databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);

  if (!host || !localHosts.has(host)) {
    throw new Error(
      `Refusing to seed simulated trades for non-local database host "${host || "unknown"}".`,
    );
  }
}

function readDatabaseHost(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return null;
  }
}

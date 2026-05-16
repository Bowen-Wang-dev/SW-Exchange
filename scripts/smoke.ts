import { config as loadEnv } from "dotenv";
import { execFile } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Client } from "pg";

loadEnv({ path: ".env" });

const execFileAsync = promisify(execFile);
const apiBaseUrl = "http://127.0.0.1:3001/api";
const webBaseUrl = "http://127.0.0.1:3000";
const smokeNextDistDir = ".next-smoke";
const smokeNextDistPath = `apps/web/${smokeNextDistDir}`;
const webNextEnvPath = "apps/web/next-env.d.ts";
const webTsconfigPath = "apps/web/tsconfig.json";
const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_EMAIL;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!databaseUrl || !adminEmail || !adminUsername || !adminPassword) {
  throw new Error("DATABASE_URL, ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD are required.");
}

const testUsername = `smoke_${Date.now()}`;
const testEmail = `${testUsername}@example.com`;
const receiverUsername = `${testUsername}_receiver`;
const receiverEmail = `${receiverUsername}@example.com`;
const testPassword = "SmokeTest123!";
const publicWebRoutes = ["/", "/login", "/register", "/markets"];
const protectedWebRoutes = [
  "/dashboard",
  "/wallet",
  "/transfer",
  "/trade",
  "/orders",
  "/trades",
  "/ledger",
  "/admin",
  "/admin/users",
  "/admin/wallets",
  "/admin/airdrop",
  "/admin/transfers",
  "/admin/assets",
  "/admin/orders",
  "/admin/trades",
  "/admin/fees",
  "/admin/ledger",
  "/admin/audit-logs",
];

async function main() {
  console.log("Smoke test starting...");

  await testApiHealth();
  await testSeedData();
  const auth = await testAuthFlows();
  await testV03AirdropFlow(auth);
  await testV04TransferFlow(auth);
  await testV07FeeFlow(auth);
  await testV06OrderFlow(auth);
  await setFeeSettings(auth.adminAccessToken, "0.1", "0.1", "Smoke reset default v0.7 fees");
  await testWebRoutes();
  await testWebBuild();

  console.log("Smoke test completed successfully.");
}

async function testApiHealth() {
  const response = await fetch(`${apiBaseUrl}/health`);
  assertOk(response, "API health endpoint");
  const json = (await response.json()) as { status?: string };
  if (json.status !== "ok") {
    throw new Error(`API health check returned unexpected payload: ${JSON.stringify(json)}`);
  }
  console.log("PASS api health");
}

async function testSeedData() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const assets = await client.query<{ symbol: string }>(
      "select symbol from assets where symbol in ('SWC', 'SWL') order by symbol",
    );
    expectValues(
      assets.rows.map((row) => row.symbol),
      ["SWC", "SWL"],
      "seeded assets",
    );

    const markets = await client.query<{ symbol: string }>(
      "select symbol from markets where symbol = 'SWL/SWC'",
    );
    expectValues(
      markets.rows.map((row) => row.symbol),
      ["SWL/SWC"],
      "seeded markets",
    );

    const admins = await client.query<{ email: string; username: string; role: string }>(
      "select email, username, role from users where role = 'ADMIN' and email = $1 and username = $2",
      [adminEmail, adminUsername],
    );
    if (admins.rows.length !== 1) {
      throw new Error("Expected exactly one seeded ADMIN user matching env vars.");
    }

    const adminBuckets = await client.query<{ wallet_type: string; symbol: string }>(
      `
        select wallets.wallet_type, assets.symbol
        from wallets
        join users on users.id = wallets.user_id
        join assets on assets.id = wallets.asset_id
        where users.role = 'ADMIN'
          and users.email = $1
          and users.username = $2
          and wallets.wallet_type in ('MAIN', 'FEE', 'TREASURY', 'AIRDROP', 'HOT')
          and assets.symbol in ('SWC', 'SWL')
        order by wallets.wallet_type, assets.symbol
      `,
      [adminEmail, adminUsername],
    );
    if (adminBuckets.rows.length !== 10) {
      throw new Error("Expected seeded admin MAIN/FEE/TREASURY/AIRDROP/HOT wallets for SWC and SWL.");
    }

    const feeSettings = await client.query<{
      market_symbol: string;
      buyer_fee_rate_bps: number;
      seller_fee_rate_bps: number;
      is_active: boolean;
    }>("select market_symbol, buyer_fee_rate_bps, seller_fee_rate_bps, is_active from fee_settings where market_symbol = 'SWL/SWC'");
    if (feeSettings.rows.length !== 1 || feeSettings.rows[0]?.is_active !== true) {
      throw new Error("Expected one active SWL/SWC fee setting.");
    }
  } finally {
    await client.end();
  }

  console.log("PASS seeded data and admin wallet buckets");
}

async function testAuthFlows() {
  const sender = await registerUser(testEmail, testUsername, "Smoke Sender");
  const receiver = await registerUser(receiverEmail, receiverUsername, "Smoke Receiver");

  const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: { authorization: `Bearer ${sender.accessToken}` },
  });
  assertOk(meResponse, "load current user");
  const meJson = (await meResponse.json()) as { user?: { role?: string; email?: string } };
  if (meJson.user?.role !== "USER" || meJson.user?.email !== testEmail) {
    throw new Error(`Unexpected /auth/me payload: ${JSON.stringify(meJson)}`);
  }

  const adminLoginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: adminEmail, password: adminPassword }),
  });
  assertOk(adminLoginResponse, "login admin user");
  const adminLoginJson = (await adminLoginResponse.json()) as {
    accessToken?: string;
    user?: { role?: string; email?: string };
  };
  if (!adminLoginJson.accessToken || adminLoginJson.user?.role !== "ADMIN") {
    throw new Error(`Unexpected admin login payload: ${JSON.stringify(adminLoginJson)}`);
  }

  console.log("PASS auth flows");
  return {
    userAccessToken: sender.accessToken,
    receiverAccessToken: receiver.accessToken,
    adminAccessToken: adminLoginJson.accessToken,
    user: { email: testEmail, username: testUsername },
    receiver: { email: receiverEmail, username: receiverUsername },
  };
}

async function registerUser(email: string, username: string, nickname: string) {
  const response = await fetch(`${apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      username,
      nickname,
      password: testPassword,
    }),
  });
  assertOk(response, `register normal user ${username}`);
  const json = (await response.json()) as {
    accessToken?: string;
    user?: { role?: string; email?: string; username?: string };
  };
  if (!json.accessToken || json.user?.role !== "USER") {
    throw new Error(`Unexpected register payload: ${JSON.stringify(json)}`);
  }

  return {
    accessToken: json.accessToken,
    user: json.user,
  };
}

async function testV03AirdropFlow(auth: {
  userAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
}) {
  const beforeWallets = await walletSnapshot(auth.userAccessToken);
  const beforeSwc = findWallet(beforeWallets, "SWC");

  const airdropResponse = await airdrop(
    auth.adminAccessToken,
    auth.user.username,
    "SWC",
    "1000",
    "Smoke v0.4 airdrop",
  );

  const afterWallets = await walletSnapshot(auth.userAccessToken);
  const afterSwc = findWallet(afterWallets, "SWC");
  const expectedAvailable = BigInt(beforeSwc.availableRaw) + units("1000");
  if (BigInt(afterSwc.availableRaw) !== expectedAvailable) {
    throw new Error("User SWC wallet did not reflect the airdrop.");
  }

  const userLedger = await getJson<Array<{ id: string; type: string; asset: string }>>(
    `${apiBaseUrl}/ledger/me`,
    auth.userAccessToken,
    "load user ledger",
  );
  if (!userLedger.some((entry) => entry.type === "AIRDROP" && entry.asset === "SWC")) {
    throw new Error("User ledger did not include the expected AIRDROP entry.");
  }

  const adminLedger = await getJson<Array<{ id: string; type: string }>>(
    `${apiBaseUrl}/admin/ledger`,
    auth.adminAccessToken,
    "load admin ledger",
  );
  if (!adminLedger.some((entry) => entry.id === airdropResponse.ledgerEntryId && entry.type === "AIRDROP")) {
    throw new Error("Admin ledger did not include the expected AIRDROP entry.");
  }

  console.log("PASS airdrop, wallets, and ledger flow");
}

async function testV04TransferFlow(auth: {
  userAccessToken: string;
  receiverAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const senderWalletsBefore = await walletSnapshot(auth.userAccessToken);
  const receiverWalletsBefore = await walletSnapshot(auth.receiverAccessToken);
  const senderSwcBefore = findWallet(senderWalletsBefore, "SWC");
  const receiverSwcBefore = findWallet(receiverWalletsBefore, "SWC");

  const transferResponse = await fetch(`${apiBaseUrl}/transfers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.userAccessToken}`,
    },
    body: JSON.stringify({
      recipient: auth.receiver.email,
      assetSymbol: "SWC",
      amount: "100",
      note: "Smoke v0.4 transfer",
    }),
  });
  assertOk(transferResponse, "internal transfer");
  const transferJson = (await transferResponse.json()) as {
    id?: string;
    senderNewAvailableRaw?: string;
    recipientNewAvailableRaw?: string;
  };
  if (!transferJson.id) {
    throw new Error("Transfer response did not include an id.");
  }

  const expectedSenderAvailable = BigInt(senderSwcBefore.availableRaw) - units("100");
  const expectedReceiverAvailable = BigInt(receiverSwcBefore.availableRaw) + units("100");
  if (BigInt(transferJson.senderNewAvailableRaw ?? "0") !== expectedSenderAvailable) {
    throw new Error("Transfer response did not return the expected sender balance.");
  }
  if (BigInt(transferJson.recipientNewAvailableRaw ?? "0") !== expectedReceiverAvailable) {
    throw new Error("Transfer response did not return the expected receiver balance.");
  }

  console.log("PASS v0.4 internal transfer, balances, and ledger");
}

async function testV07FeeFlow(auth: {
  userAccessToken: string;
  receiverAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const marketSymbol = "SWL/SWC";

  const defaultSettings = await setFeeSettings(
    auth.adminAccessToken,
    "0.1",
    "0.1",
    "Smoke v0.7 default fee setup",
  );
  if (
    defaultSettings.buyerFeeRateHuman !== "0.1%" ||
    defaultSettings.sellerFeeRateHuman !== "0.1%"
  ) {
    throw new Error("Default v0.7 fee settings should be 0.1% for buyer and seller.");
  }

  await airdrop(auth.adminAccessToken, auth.user.username, "SWC", "1000", "Smoke v0.7 fee buyer funding");
  await airdrop(auth.adminAccessToken, auth.receiver.username, "SWL", "400", "Smoke v0.7 fee seller funding");

  const buyerBeforeA = await walletSnapshot(auth.userAccessToken);
  const sellerBeforeA = await walletSnapshot(auth.receiverAccessToken);
  const feeBeforeA = await feeSettings(auth.adminAccessToken);

  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "100");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "100");

  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(buyerBeforeA, "SWC").availableRaw) - quoteUnits("2", "100"),
  );
  await assertExactWallet(
    auth.userAccessToken,
    "SWL",
    BigInt(findWallet(buyerBeforeA, "SWL").availableRaw) + units("99.9"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWL",
    BigInt(findWallet(sellerBeforeA, "SWL").availableRaw) - units("100"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWC",
    BigInt(findWallet(sellerBeforeA, "SWC").availableRaw) + units("199.8"),
  );

  const feeAfterA = await feeSettings(auth.adminAccessToken);
  expectFeeWalletBalanceDelta(feeBeforeA, feeAfterA, "SWL", units("0.1"));
  expectFeeWalletBalanceDelta(feeBeforeA, feeAfterA, "SWC", units("0.2"));

  const tradesAfterA = await adminTrades(auth.adminAccessToken);
  const tradeA = tradesAfterA.find(
    (trade) =>
      trade.price === "2" &&
      trade.amount === "100" &&
      trade.buyer.username === auth.user.username &&
      trade.seller.username === auth.receiver.username,
  );
  if (!tradeA || tradeA.buyerFee !== "0.1" || tradeA.sellerFee !== "0.2") {
    throw new Error("Expected default fee trade to persist 0.1 SWL buyer fee and 0.2 SWC seller fee.");
  }

  await setFeeSettings(auth.adminAccessToken, "0.2", "0.3", "Smoke v0.7 fee change");
  const auditLogs = await getJson<Array<{ action: string }>>(
    `${apiBaseUrl}/admin/audit-logs`,
    auth.adminAccessToken,
    "load audit logs after fee update",
  );
  if (!auditLogs.some((entry) => entry.action === "UPDATE_FEE_SETTINGS")) {
    throw new Error("Fee settings update should create UPDATE_FEE_SETTINGS audit log.");
  }

  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "100");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "100");
  const tradesAfterB = await adminTrades(auth.adminAccessToken);
  const tradeB = tradesAfterB[0];
  if (!tradeB || tradeB.buyerFee !== "0.2" || tradeB.sellerFee !== "0.6") {
    throw new Error("Updated fee trade should persist 0.2 SWL buyer fee and 0.6 SWC seller fee.");
  }
  const historicalTradeA = tradesAfterB.find((trade) => trade.id === tradeA.id);
  if (!historicalTradeA || historicalTradeA.buyerFee !== "0.1" || historicalTradeA.sellerFee !== "0.2") {
    throw new Error("Historical trades should keep original persisted fee amounts after fee changes.");
  }

  await expectFeeSettingsRejected(auth.adminAccessToken, "-0.1", "0.1");
  await expectFeeSettingsRejected(auth.adminAccessToken, "50", "0.1");
  await expectFeeSettingsRejected(auth.adminAccessToken, "abc", "0.1");
  await expectFeeSettingsRejected(auth.adminAccessToken, "1e-3", "0.1");

  const zeroSettingsBefore = await setFeeSettings(
    auth.adminAccessToken,
    "0",
    "0",
    "Smoke v0.7 zero fee validation",
  );
  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "10");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "10");
  const zeroSettingsAfter = await feeSettings(auth.adminAccessToken);
  expectFeeWalletBalanceDelta(zeroSettingsBefore, zeroSettingsAfter, "SWL", 0n);
  expectFeeWalletBalanceDelta(zeroSettingsBefore, zeroSettingsAfter, "SWC", 0n);
  const zeroFeeTrade = (await adminTrades(auth.adminAccessToken))[0];
  if (!zeroFeeTrade || zeroFeeTrade.buyerFee !== "0" || zeroFeeTrade.sellerFee !== "0") {
    throw new Error("Zero fee trades should persist zero buyer and seller fees.");
  }

  console.log("PASS v0.7 admin fee settings, fee settlement, audit, and validation");
}

async function testV06OrderFlow(auth: {
  userAccessToken: string;
  receiverAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const marketSymbol = "SWL/SWC";
  const marketQuery = encodeURIComponent(marketSymbol);

  await airdrop(auth.adminAccessToken, auth.user.username, "SWC", "1000", "Smoke v0.6 buyer funding");
  await airdrop(auth.adminAccessToken, auth.receiver.username, "SWL", "200", "Smoke v0.6 seller funding");
  await airdrop(auth.adminAccessToken, adminUsername, "SWL", "200", "Smoke v0.6 admin seller funding");

  const fundedBuyer = await walletSnapshot(auth.userAccessToken);
  const fundedSeller = await walletSnapshot(auth.receiverAccessToken);
  const fundedAdmin = await walletSnapshot(auth.adminAccessToken);

  const buyerSwcFunded = findWallet(fundedBuyer, "SWC");
  const buyerSwlFunded = findWallet(fundedBuyer, "SWL");
  const sellerSwcFunded = findWallet(fundedSeller, "SWC");
  const sellerSwlFunded = findWallet(fundedSeller, "SWL");
  const adminSwlFunded = findWallet(fundedAdmin, "SWL");

  const sellA = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.15", "50");
  const buyA = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.30", "50");
  expectTradeResponse(buyA, "FILLED", "50", "0");
  await assertExactWallet(auth.userAccessToken, "SWC", BigInt(buyerSwcFunded.availableRaw) - quoteUnits("1.15", "50"));
  await assertExactWallet(auth.userAccessToken, "SWL", BigInt(buyerSwlFunded.availableRaw) + units("50"));
  await assertExactWallet(auth.receiverAccessToken, "SWL", BigInt(sellerSwlFunded.availableRaw) - units("50"));
  await assertExactWallet(auth.receiverAccessToken, "SWC", BigInt(sellerSwcFunded.availableRaw) + quoteUnits("1.15", "50"));
  await expectAdminOrderStatus(auth.adminAccessToken, sellA.id, "FILLED", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, buyA.id, "FILLED", "0");

  const recentA = await getJson<Array<{ price: string; amount: string; quoteAmount: string }>>(
    `${apiBaseUrl}/trades/recent?marketSymbol=${marketQuery}`,
    auth.userAccessToken,
    "load recent trades after scenario A",
  );
  if (!recentA.length || recentA[0]!.price !== "1.15" || recentA[0]!.quoteAmount !== "57.5") {
    throw new Error("Scenario A should execute at maker price 1.15 with 57.5 SWC quote amount.");
  }

  const buyerBeforeB = await walletSnapshot(auth.userAccessToken);
  const sellerBeforeB = await walletSnapshot(auth.receiverAccessToken);
  const buyerB = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.20", "50");
  const sellB = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.00", "50");
  expectOrderStatus(sellB, "FILLED");
  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(buyerBeforeB, "SWC").availableRaw) - quoteUnits("1.20", "50"),
  );
  await assertExactWallet(
    auth.userAccessToken,
    "SWL",
    BigInt(findWallet(buyerBeforeB, "SWL").availableRaw) + units("50"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWC",
    BigInt(findWallet(sellerBeforeB, "SWC").availableRaw) + quoteUnits("1.20", "50"),
  );
  await expectAdminOrderStatus(auth.adminAccessToken, buyerB.id, "FILLED", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellB.id, "FILLED", "0");

  const sellerC1 = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.10", "20");
  const sellerC2 = await createOrder(auth.adminAccessToken, marketSymbol, "SELL", "1.10", "30");
  const buyC = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.10", "25");
  expectTradeResponse(buyC, "FILLED", "25", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellerC1.id, "FILLED", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellerC2.id, "PARTIAL_FILLED", "25");
  await cancelOrder(auth.adminAccessToken, sellerC2.id);

  const sellerD1 = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.10", "10");
  const sellerD2 = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.15", "10");
  const sellerD3 = await createOrder(auth.adminAccessToken, marketSymbol, "SELL", "1.20", "10");
  const buyD = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.20", "25");
  expectTradeResponse(buyD, "FILLED", "25", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellerD1.id, "FILLED", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellerD2.id, "FILLED", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellerD3.id, "PARTIAL_FILLED", "5");
  const recentD = await getJson<Array<{ price: string; amount: string; quoteAmount: string }>>(
    `${apiBaseUrl}/trades/recent?marketSymbol=${marketQuery}`,
    auth.userAccessToken,
    "load recent trades after scenario D",
  );
  if (!recentD.some((trade) => trade.price === "1.2" && trade.amount === "5")) {
    throw new Error("Scenario D should surface the latest maker-price trade.");
  }
  await cancelOrder(auth.adminAccessToken, sellerD3.id);

  const buyerBeforeE = await walletSnapshot(auth.userAccessToken);
  const sellerE = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.10", "10");
  const buyE = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.10", "25");
  expectTradeResponse(buyE, "PARTIAL_FILLED", "10", "15");
  if (buyE.lockedAmount !== "16.5") {
    throw new Error(`Scenario E should keep 16.5 SWC locked, got ${buyE.lockedAmount}.`);
  }
  const buyerAfterCreateE = await walletSnapshot(auth.userAccessToken);
  if (
    BigInt(findWallet(buyerAfterCreateE, "SWC").lockedRaw) !==
    BigInt(findWallet(buyerBeforeE, "SWC").lockedRaw) + quoteUnits("1.10", "25") - quoteUnits("1.10", "10")
  ) {
    throw new Error("Partial fill should leave the remaining SWC locked.");
  }

  await cancelOrder(auth.userAccessToken, buyE.id);
  const buyerAfterCancelE = await walletSnapshot(auth.userAccessToken);
  if (
    BigInt(findWallet(buyerAfterCancelE, "SWC").lockedRaw) !==
    BigInt(findWallet(buyerBeforeE, "SWC").lockedRaw)
  ) {
    throw new Error("Cancel should unlock only the remaining locked SWC.");
  }

  await expectForbidden(`${apiBaseUrl}/admin/orders`, auth.userAccessToken, "normal user admin orders");
  await expectForbidden(`${apiBaseUrl}/admin/trades`, auth.userAccessToken, "normal user admin trades");
  await expectCreateOrderRejected(auth.userAccessToken, marketSymbol, "BUY", "1e-3", "1");

  const tradesBeforeSelfCross = await adminTrades(auth.adminAccessToken);
  const selfSell = await createOrder(auth.userAccessToken, marketSymbol, "SELL", "1.00", "1");
  const selfBuy = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.20", "1");
  expectOrderStatus(selfSell, "OPEN");
  expectOrderStatus(selfBuy, "OPEN");
  await expectAdminOrderStatus(auth.adminAccessToken, selfSell.id, "OPEN", "1");
  await expectAdminOrderStatus(auth.adminAccessToken, selfBuy.id, "OPEN", "1");
  const tradesAfterSelfCross = await adminTrades(auth.adminAccessToken);
  if (tradesAfterSelfCross.length !== tradesBeforeSelfCross.length) {
    throw new Error("Crossed orders from the same user should not self-trade.");
  }
  await cancelOrder(auth.userAccessToken, selfBuy.id);
  await cancelOrder(auth.userAccessToken, selfSell.id);

  const userTrades = await getJson<Array<{ side: string; price: string; amount: string; quoteAmount: string }>>(
    `${apiBaseUrl}/trades/me`,
    auth.userAccessToken,
    "load my trades",
  );
  if (!userTrades.length || !userTrades.some((trade) => trade.side === "BUY" || trade.side === "SELL")) {
    throw new Error("My trades endpoint should return user-side trades.");
  }

  const adminTradesList = await adminTrades(auth.adminAccessToken);
  if (!adminTradesList.length) {
    throw new Error("Admin trades endpoint should return settled trades.");
  }

  const adminOrdersFinal = await adminOrders(auth.adminAccessToken);
  if (adminOrdersFinal.some((order) => order.status === "OPEN" || order.status === "PARTIAL_FILLED")) {
    throw new Error("All scenario orders should be settled or cancelled before ending smoke.");
  }

  const orderBook = await getJson<{
    bids: Array<{ priceRaw: string; amountRaw: string }>;
    asks: Array<{ priceRaw: string; amountRaw: string }>;
  }>(`${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`, auth.userAccessToken, "load order book after matching");
  if (orderBook.bids.length !== 0 || orderBook.asks.length !== 0) {
    throw new Error("Order book should be empty after cleanup of all smoke orders.");
  }

  console.log("PASS v0.6 matching regression, partial fills, maker pricing, refunds, trades, and cancel flow");
}

async function testWebBuild() {
  const previousWebNextEnv = await readFile(webNextEnvPath, "utf8");
  const previousWebTsconfig = await readFile(webTsconfigPath, "utf8");

  await rm(smokeNextDistPath, { recursive: true, force: true });

  try {
    await execFileAsync("pnpm", ["--filter", "@sw-exchange/web", "build"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_DIST_DIR: smokeNextDistDir,
      },
      maxBuffer: 1024 * 1024 * 10,
    });
  } finally {
    await rm(smokeNextDistPath, { recursive: true, force: true });
    await writeFile(webNextEnvPath, previousWebNextEnv);
    await writeFile(webTsconfigPath, previousWebTsconfig);
  }

  console.log("PASS web build");
}

async function testWebRoutes() {
  for (const route of publicWebRoutes) {
    const response = await fetch(`${webBaseUrl}${route}`);
    assertOk(response, `public web route ${route}`);
  }

  for (const route of protectedWebRoutes) {
    const response = await fetch(`${webBaseUrl}${route}`, { redirect: "manual" });
    if (!response.ok && !isRedirectStatus(response.status)) {
      throw new Error(`protected web route ${route} failed with status ${response.status}`);
    }
  }

  console.log("PASS web routes");
}

function assertOk(response: Response, label: string) {
  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`);
  }
}

async function getJson<T>(url: string, accessToken: string, label: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assertOk(response, label);
  return (await response.json()) as T;
}

async function expectForbidden(url: string, accessToken: string, label: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (response.status !== 403) {
    throw new Error(`${label} should be forbidden, got status ${response.status}`);
  }
}

function expectValues(actual: string[], expected: string[], label: string) {
  const actualJoined = actual.join(",");
  const expectedJoined = expected.join(",");
  if (actualJoined !== expectedJoined) {
    throw new Error(`${label} mismatch. expected=${expectedJoined} actual=${actualJoined}`);
  }
}

function findWallet<T extends { asset: string; availableRaw: string; lockedRaw: string }>(
  wallets: T[],
  asset: string,
) {
  const wallet = wallets.find((entry) => entry.asset === asset);
  if (!wallet) {
    throw new Error(`Expected ${asset} wallet.`);
  }
  return wallet;
}

async function walletSnapshot(accessToken: string) {
  return getJson<Array<{ asset: string; availableRaw: string; lockedRaw: string }>>(
    `${apiBaseUrl}/wallets/me`,
    accessToken,
    "load wallet snapshot",
  );
}

async function airdrop(
  adminAccessToken: string,
  username: string,
  assetSymbol: string,
  amount: string,
  note: string,
) {
  const response = await fetch(`${apiBaseUrl}/admin/airdrop`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminAccessToken}`,
    },
    body: JSON.stringify({ username, assetSymbol, amount, note }),
  });
  assertOk(response, `airdrop ${assetSymbol} to ${username}`);
  return (await response.json()) as { ledgerEntryId?: string };
}

async function feeSettings(accessToken: string) {
  return getJson<{
    buyerFeeRateHuman: string;
    sellerFeeRateHuman: string;
    feeWallet: {
      balances: Array<{ asset: string; availableRaw: string }>;
    };
  }>(`${apiBaseUrl}/admin/fee-settings`, accessToken, "load fee settings");
}

async function setFeeSettings(
  accessToken: string,
  buyerFeeRatePercent: string,
  sellerFeeRatePercent: string,
  note: string,
) {
  const response = await fetch(`${apiBaseUrl}/admin/fee-settings`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      marketSymbol: "SWL/SWC",
      buyerFeeRatePercent,
      sellerFeeRatePercent,
      note,
    }),
  });
  assertOk(response, "update fee settings");
  return (await response.json()) as {
    buyerFeeRateHuman: string;
    sellerFeeRateHuman: string;
    feeWallet: {
      balances: Array<{ asset: string; availableRaw: string }>;
    };
  };
}

async function expectFeeSettingsRejected(
  accessToken: string,
  buyerFeeRatePercent: string,
  sellerFeeRatePercent: string,
) {
  const response = await fetch(`${apiBaseUrl}/admin/fee-settings`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      marketSymbol: "SWL/SWC",
      buyerFeeRatePercent,
      sellerFeeRatePercent,
      note: "Smoke invalid fee settings",
    }),
  });
  if (response.status < 400) {
    throw new Error(`Expected invalid fee settings to be rejected: ${buyerFeeRatePercent}/${sellerFeeRatePercent}.`);
  }
}

function expectFeeWalletBalanceDelta(
  before: FeeWalletSettings,
  after: FeeWalletSettings,
  asset: string,
  expectedDelta: bigint,
) {
  const beforeBalance = findFeeWalletBalance(before, asset);
  const afterBalance = findFeeWalletBalance(after, asset);
  const delta = BigInt(afterBalance.availableRaw) - BigInt(beforeBalance.availableRaw);
  if (delta !== expectedDelta) {
    throw new Error(
      `Admin Fee Wallet ${asset} expected delta ${expectedDelta.toString()}, got ${delta.toString()}.`,
    );
  }
}

type FeeWalletSettings = {
  feeWallet: {
    balances: Array<{ asset: string; availableRaw: string }>;
  };
};

function findFeeWalletBalance(settings: FeeWalletSettings, asset: string) {
  const balances = settings.feeWallet.balances;
  const balance = balances.find((entry) => entry.asset === asset);
  if (!balance) {
    throw new Error(`Expected admin Fee Wallet ${asset} balance.`);
  }
  return balance;
}

async function createOrder(
  accessToken: string,
  marketSymbol: string,
  side: "BUY" | "SELL",
  price: string,
  amount: string,
) {
  const response = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ marketSymbol, side, price, amount }),
  });
  assertOk(response, `create ${side} order`);
  return (await response.json()) as {
    id: string;
    status: string;
    side: string;
    price: string;
    amount: string;
    filledAmount: string;
    remainingAmount: string;
    lockedAssetSymbol: string;
    lockedAmount: string;
    marketSymbol: string;
  };
}

async function expectCreateOrderRejected(
  accessToken: string,
  marketSymbol: string,
  side: "BUY" | "SELL",
  price: string,
  amount: string,
) {
  const response = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ marketSymbol, side, price, amount }),
  });
  if (response.status < 400) {
    throw new Error(`Expected invalid ${side} order to be rejected.`);
  }
}

async function adminTrades(accessToken: string) {
  return getJson<
    Array<{
      id: string;
      price: string;
      amount: string;
      quoteAmount: string;
      buyerFee: string;
      sellerFee: string;
      seller: { username: string };
      buyer: { username: string };
    }>
  >(
    `${apiBaseUrl}/admin/trades`,
    accessToken,
    "load admin trades",
  );
}

async function adminOrders(accessToken: string) {
  return getJson<Array<{ id: string; status: string; remainingAmount: string }>>(
    `${apiBaseUrl}/admin/orders`,
    accessToken,
    "load admin orders",
  );
}

function expectOrderStatus(order: { status: string }, expectedStatus: string) {
  if (order.status !== expectedStatus) {
    throw new Error(`Expected order status ${expectedStatus}, got ${order.status}`);
  }
}

async function expectAdminOrderStatus(
  accessToken: string,
  orderId: string,
  expectedStatus: string,
  expectedRemainingAmount: string,
) {
  const orders = await adminOrders(accessToken);
  const order = orders.find((entry) => entry.id === orderId);
  if (!order) {
    throw new Error(`Expected admin orders to include order ${orderId}.`);
  }
  expectOrderStatus(order, expectedStatus);
  if (order.remainingAmount !== expectedRemainingAmount) {
    throw new Error(
      `Expected order remaining amount ${expectedRemainingAmount}, got ${order.remainingAmount}`,
    );
  }
}

function expectTradeResponse(
  order: { status: string; filledAmount: string; remainingAmount: string },
  expectedStatus: string,
  expectedFilled: string,
  expectedRemaining: string,
) {
  expectOrderStatus(order, expectedStatus);
  if (order.filledAmount !== expectedFilled || order.remainingAmount !== expectedRemaining) {
    throw new Error(
      `Unexpected order amounts: filled=${order.filledAmount} remaining=${order.remainingAmount}`,
    );
  }
}

async function assertExactWallet(accessToken: string, asset: string, expectedAvailableRaw: bigint) {
  const after = await walletSnapshot(accessToken);
  const wallet = findWallet(after, asset);
  if (BigInt(wallet.availableRaw) !== expectedAvailableRaw) {
    throw new Error(
      `Wallet ${asset} expected available ${expectedAvailableRaw.toString()}, got ${wallet.availableRaw}.`,
    );
  }
}

function units(value: string) {
  return parseDecimalToUnits(value);
}

function quoteUnits(price: string, amount: string) {
  const priceUnits = parseDecimalToUnits(price);
  const amountUnitsValue = parseDecimalToUnits(amount);
  return (priceUnits * amountUnitsValue) / 10n ** 18n;
}

function parseDecimalToUnits(value: string) {
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");
  return BigInt(`${whole}${fraction.padEnd(18, "0")}`);
}

async function cancelOrder(accessToken: string, orderId: string) {
  const response = await fetch(`${apiBaseUrl}/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assertOk(response, `cancel order ${orderId}`);
  return (await response.json()) as { status?: string; filledAmount?: string };
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

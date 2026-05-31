import { config as loadEnv } from "dotenv";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { Client } from "pg";
import { FEATURE_FLAG_DEFINITIONS } from "@sw-exchange/shared";

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
const smokeRunId = Date.now().toString(36).toUpperCase();
let smokeSymbolCounter = 0;

if (!databaseUrl || !adminEmail || !adminUsername || !adminPassword) {
  throw new Error("DATABASE_URL, ADMIN_EMAIL, ADMIN_USERNAME, and ADMIN_PASSWORD are required.");
}

const testUsername = `smoke_${Date.now()}`;
const testEmail = `${testUsername}@example.com`;
const receiverUsername = `${testUsername}_receiver`;
const receiverEmail = `${receiverUsername}@example.com`;
const testPassword = "SmokeTest123!";
const publicWebRoutes = ["/", "/login", "/register", "/assets", "/markets", "/verify-email"];
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
  "/admin/markets",
  "/admin/orders",
  "/admin/security-actions",
  "/admin/security-events",
  "/admin/trades",
  "/admin/fees",
  "/admin/feature-flags",
  "/admin/ledger",
  "/admin/audit-logs",
];

async function execPnpm(args: string[], options: Parameters<typeof execFileAsync>[2]) {
  try {
    return await execFileAsync("pnpm", args, options);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return execFileAsync("corepack", ["pnpm", ...args], options);
    }

    throw error;
  }
}

async function main() {
  console.log("Smoke test starting...");

  await testApiHealth();
  await testSeedData();
  const auth = await testAuthFlows();
  await testFeatureFlags(auth.adminAccessToken);
  await testV101SecurityFoundation(auth.adminAccessToken);
  await testV102EmailVerificationFoundation(auth);
  await resetV08OperationalControls(auth.adminAccessToken);
  await testV03AirdropFlow(auth);
  await testV071AdminWalletBucketTransfer(auth.adminAccessToken);
  await testV04TransferFlow(auth);
  await testV07FeeFlow(auth);
  const v06Context = await testV06OrderFlow(auth);
  await testV10MarketDataAndValuation(auth, v06Context);
  await testV08AdminControlsFlow(auth);
  const v13Context = await testV13AdminAssetAndMarketCreation(auth);
  await testV14CandleFlow(auth, v13Context);
  await resetV08OperationalControls(auth.adminAccessToken);
  await testV15MarketOrders(auth);
  await resetV08OperationalControls(auth.adminAccessToken);
  await testAuthLogoutFlow(auth.userAccessToken, auth.adminAccessToken);
  await testV101SecurityEventCoverage(auth.adminAccessToken);
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
      "select symbol from assets where symbol in ('SWC', 'SWL', 'SWD') order by symbol",
    );
    expectValues(
      assets.rows.map((row) => row.symbol),
      ["SWC", "SWD", "SWL"],
      "seeded assets",
    );

    const markets = await client.query<{ symbol: string }>(
      "select symbol from markets where symbol in ('SWL/SWC', 'SWD/SWC') order by symbol",
    );
    expectValues(
      markets.rows.map((row) => row.symbol),
      ["SWD/SWC", "SWL/SWC"],
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
          and assets.symbol in ('SWC', 'SWL', 'SWD')
        order by wallets.wallet_type, assets.symbol
      `,
      [adminEmail, adminUsername],
    );
    if (adminBuckets.rows.length !== 15) {
      throw new Error("Expected seeded admin MAIN/FEE/TREASURY/AIRDROP/HOT wallets for SWC, SWL, and SWD.");
    }

    const feeSettings = await client.query<{
      market_symbol: string;
      buyer_fee_rate_bps: number;
      seller_fee_rate_bps: number;
      is_active: boolean;
    }>(
      "select market_symbol, buyer_fee_rate_bps, seller_fee_rate_bps, is_active from fee_settings where market_symbol in ('SWL/SWC', 'SWD/SWC')",
    );
    if (feeSettings.rows.length !== 2 || feeSettings.rows.some((setting) => !setting.is_active)) {
      throw new Error("Expected active SWL/SWC and SWD/SWC fee settings.");
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
  const meJson = (await meResponse.json()) as {
    user?: { role?: string; email?: string; emailVerified?: boolean; emailVerifiedAt?: string | null };
  };
  if (
    meJson.user?.role !== "USER" ||
    meJson.user?.email !== testEmail ||
    meJson.user?.emailVerified !== false ||
    meJson.user?.emailVerifiedAt !== null
  ) {
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
    user: {
      id: sender.user?.id ?? "",
      email: testEmail,
      username: testUsername,
    },
    receiver: { email: receiverEmail, username: receiverUsername },
  };
}

async function testFeatureFlags(adminAccessToken: string) {
  const publicFlags = await fetchJson<{ flags?: Array<{ key: string; enabled: boolean }> }>(
    `${apiBaseUrl}/feature-flags`,
    "load public feature flags",
  );
  const adminFlags = await getJson<{ flags?: Array<{ key: string; enabled: boolean }> }>(
    `${apiBaseUrl}/admin/feature-flags`,
    adminAccessToken,
    "load admin feature flags",
  );

  if (!Array.isArray(publicFlags.flags) || publicFlags.flags.length !== FEATURE_FLAG_DEFINITIONS.length) {
    throw new Error("Public feature flags payload did not include the canonical flag set.");
  }

  if (!Array.isArray(adminFlags.flags) || adminFlags.flags.length !== FEATURE_FLAG_DEFINITIONS.length) {
    throw new Error("Admin feature flags payload did not include the canonical flag set.");
  }

  for (const definition of FEATURE_FLAG_DEFINITIONS) {
    const publicFlag = publicFlags.flags.find((flag) => flag.key === definition.key);
    const adminFlag = adminFlags.flags.find((flag) => flag.key === definition.key);

    if (!publicFlag || !adminFlag) {
      throw new Error(`Missing feature flag ${definition.key} in API responses.`);
    }

    if (publicFlag.enabled !== definition.defaultEnabled || adminFlag.enabled !== definition.defaultEnabled) {
      throw new Error(`Feature flag ${definition.key} did not match its seeded default state.`);
    }
  }

  if (publicFlags.flags.some((flag) => flag.enabled)) {
    throw new Error("All current feature flags should seed disabled in this milestone.");
  }

  const singleFlag = await fetchJson<{ key?: string; enabled?: boolean }>(
    `${apiBaseUrl}/feature-flags/enableChainGateway`,
    "load single feature flag",
  );
  if (singleFlag.key !== "enableChainGateway" || singleFlag.enabled !== false) {
    throw new Error("Single feature flag endpoint returned an unexpected payload.");
  }

  const unknownFlagResponse = await fetch(`${apiBaseUrl}/feature-flags/notARealFlag`);
  if (unknownFlagResponse.status !== 404) {
    throw new Error(`Unknown feature flag should return 404, got ${unknownFlagResponse.status}.`);
  }

  console.log("PASS feature flags foundation");
}

async function testV101SecurityFoundation(adminAccessToken: string) {
  await expectLoginRejected(adminEmail, "DefinitelyWrong123!", "security failed login capture");

  const securityActions = await getJson<{
    actions?: Array<{ key: string; requires2FA: boolean; requiresEmailVerification: boolean }>;
  }>(`${apiBaseUrl}/admin/security-actions`, adminAccessToken, "load sensitive actions matrix");
  if (
    !Array.isArray(securityActions.actions) ||
    !securityActions.actions.some((action) => action.key === "REQUEST_WITHDRAWAL") ||
    !securityActions.actions.some((action) => action.key === "ADMIN_AIRDROP")
  ) {
    throw new Error("Sensitive actions endpoint did not return the expected planned action keys.");
  }

  const securityEvents = await getJson<{
    events?: Array<{ eventType: string; metadata?: unknown }>;
  }>(`${apiBaseUrl}/admin/security-events?limit=100`, adminAccessToken, "load initial security events");
  const eventTypes = new Set((securityEvents.events ?? []).map((event) => event.eventType));
  if (!eventTypes.has("AUTH_LOGIN_SUCCESS") || !eventTypes.has("AUTH_LOGIN_FAILED")) {
    throw new Error("Expected security events to include login success and failed-login records.");
  }

  const serializedEvents = JSON.stringify(securityEvents.events ?? []);
  for (const forbidden of [testPassword, adminPassword, "Bearer "]) {
    if (serializedEvents.includes(forbidden)) {
      throw new Error(`Security events should not expose secret-looking value: ${forbidden}`);
    }
  }

  console.log("PASS v1.0.1 security foundation read endpoints and login event capture");
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
    user?: {
      id?: string;
      role?: string;
      email?: string;
      username?: string;
      emailVerified?: boolean;
      emailVerifiedAt?: string | null;
    };
  };
  if (
    !json.accessToken ||
    !json.user?.id ||
    json.user?.role !== "USER" ||
    json.user?.emailVerified !== false ||
    json.user?.emailVerifiedAt !== null
  ) {
    throw new Error(`Unexpected register payload: ${JSON.stringify(json)}`);
  }

  return {
    accessToken: json.accessToken,
    user: json.user,
  };
}

async function testV102EmailVerificationFoundation(auth: {
  userAccessToken: string;
  adminAccessToken: string;
  user: { id: string; email: string; username: string };
}) {
  const requestResponse = await postJson<{
    success?: boolean;
    alreadyVerified?: boolean;
    email?: string;
    emailVerified?: boolean;
    emailVerifiedAt?: string | null;
    deliveryProvider?: string | null;
    expiresAt?: string | null;
  }>(
    `${apiBaseUrl}/auth/email-verification/request`,
    auth.userAccessToken,
    {},
    "request email verification",
  );

  if (
    !requestResponse.success ||
    requestResponse.alreadyVerified !== false ||
    requestResponse.email !== auth.user.email ||
    requestResponse.emailVerified !== false ||
    requestResponse.emailVerifiedAt !== null ||
    requestResponse.deliveryProvider !== "console" ||
    !requestResponse.expiresAt
  ) {
    throw new Error(`Unexpected email verification request payload: ${JSON.stringify(requestResponse)}`);
  }

  const requestedTokenRow = await getLatestEmailVerificationTokenRow(auth.user.id);
  if (
    !requestedTokenRow ||
    requestedTokenRow.email !== auth.user.email ||
    requestedTokenRow.purpose !== "VERIFY_EMAIL" ||
    requestedTokenRow.usedAt !== null ||
    requestedTokenRow.tokenHash.length < 64
  ) {
    throw new Error("Expected a hashed pending email verification token after request.");
  }

  const invalidConfirmResponse = await fetch(`${apiBaseUrl}/auth/email-verification/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: `not-a-real-email-token-${smokeRunId}` }),
  });
  if (invalidConfirmResponse.status !== 400) {
    throw new Error(
      `Invalid email verification token should return 400, got ${invalidConfirmResponse.status}.`,
    );
  }

  const knownToken = `smoke-email-verify-${smokeRunId}-valid`;
  const knownTokenHash = hashEmailVerificationToken(knownToken);
  await insertEmailVerificationToken(auth.user.id, auth.user.email, knownToken, 60);

  const confirmResponse = await fetch(`${apiBaseUrl}/auth/email-verification/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: knownToken }),
  });
  assertOk(confirmResponse, "confirm email verification");
  const confirmJson = (await confirmResponse.json()) as {
    success?: boolean;
    email?: string;
    emailVerified?: boolean;
    emailVerifiedAt?: string;
  };
  if (
    !confirmJson.success ||
    confirmJson.email !== auth.user.email ||
    confirmJson.emailVerified !== true ||
    !confirmJson.emailVerifiedAt
  ) {
    throw new Error(`Unexpected email verification confirm payload: ${JSON.stringify(confirmJson)}`);
  }

  const meAfterConfirm = await getJson<{
    user?: { emailVerified?: boolean; emailVerifiedAt?: string | null };
  }>(`${apiBaseUrl}/auth/me`, auth.userAccessToken, "load verified auth session");
  if (meAfterConfirm.user?.emailVerified !== true || !meAfterConfirm.user?.emailVerifiedAt) {
    throw new Error("Expected /auth/me to reflect a verified email after confirmation.");
  }

  const reusedConfirmResponse = await fetch(`${apiBaseUrl}/auth/email-verification/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: knownToken }),
  });
  if (reusedConfirmResponse.status !== 400) {
    throw new Error(
      `Reused email verification token should return 400, got ${reusedConfirmResponse.status}.`,
    );
  }

  const expiredToken = `smoke-email-verify-${smokeRunId}-expired`;
  await insertEmailVerificationToken(auth.user.id, auth.user.email, expiredToken, -5);
  const expiredConfirmResponse = await fetch(`${apiBaseUrl}/auth/email-verification/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: expiredToken }),
  });
  if (expiredConfirmResponse.status !== 400) {
    throw new Error(
      `Expired email verification token should return 400, got ${expiredConfirmResponse.status}.`,
    );
  }

  const securityEvents = await getJson<{
    events?: Array<{ eventType: string; metadata?: unknown }>;
  }>(
    `${apiBaseUrl}/admin/security-events?search=EMAIL_VERIFICATION&limit=100`,
    auth.adminAccessToken,
    "load email verification security events",
  );
  const eventTypes = new Set((securityEvents.events ?? []).map((event) => event.eventType));
  for (const expectedEventType of [
    "EMAIL_VERIFICATION_REQUESTED",
    "EMAIL_VERIFICATION_SENT",
    "EMAIL_VERIFICATION_CONFIRMED",
    "EMAIL_VERIFICATION_FAILED",
    "EMAIL_VERIFICATION_TOKEN_EXPIRED",
    "EMAIL_VERIFICATION_TOKEN_REUSED",
  ]) {
    if (!eventTypes.has(expectedEventType)) {
      throw new Error(`Expected email verification security event ${expectedEventType}.`);
    }
  }

  const serializedEvents = JSON.stringify(securityEvents.events ?? []);
  for (const forbidden of [knownToken, knownTokenHash, expiredToken]) {
    if (forbidden && serializedEvents.includes(forbidden)) {
      throw new Error(`Email verification security events should not expose ${forbidden}.`);
    }
  }

  console.log("PASS v1.0.2 email verification foundation");
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

async function testV071AdminWalletBucketTransfer(adminAccessToken: string) {
  await airdrop(adminAccessToken, adminUsername, "SWC", "25", "Smoke v1.0.1 admin bucket funding");

  const toTreasury = await postJson<{
    assetSymbol: string;
    fromWalletType: string;
    toWalletType: string;
    amount: string;
  }>(`${apiBaseUrl}/admin/wallet-buckets/transfer`, adminAccessToken, {
    assetSymbol: "SWC",
    amount: "10",
    fromWalletType: "MAIN",
    toWalletType: "TREASURY",
    note: "Smoke v1.0.1 bucket move out",
  }, "move admin bucket funds to treasury");

  if (
    toTreasury.assetSymbol !== "SWC" ||
    toTreasury.fromWalletType !== "MAIN" ||
    toTreasury.toWalletType !== "TREASURY" ||
    toTreasury.amount !== "10"
  ) {
    throw new Error(`Unexpected admin bucket transfer payload: ${JSON.stringify(toTreasury)}`);
  }

  await postJson(
    `${apiBaseUrl}/admin/wallet-buckets/transfer`,
    adminAccessToken,
    {
      assetSymbol: "SWC",
      amount: "10",
      fromWalletType: "TREASURY",
      toWalletType: "MAIN",
      note: "Smoke v1.0.1 bucket move back",
    },
    "move admin bucket funds back to main",
  );

  console.log("PASS v1.0.1 admin wallet bucket transfer");
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
  const feeMarket = await createSmokeMarket(auth.adminAccessToken, {
    prefix: "F",
    name: "Smoke Fee Asset",
    description: "Smoke v0.17.1 fee isolation asset",
  });
  const { assetSymbol, marketSymbol } = feeMarket;

  const defaultSettings = await setFeeSettings(
    auth.adminAccessToken,
    marketSymbol,
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
  await airdrop(
    auth.adminAccessToken,
    auth.receiver.username,
    assetSymbol,
    "400",
    "Smoke v0.7 fee seller funding",
  );

  const buyerBeforeA = await walletSnapshot(auth.userAccessToken);
  const sellerBeforeA = await walletSnapshot(auth.receiverAccessToken);
  const feeBeforeA = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);

  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "100");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "100");

  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(buyerBeforeA, "SWC").availableRaw) - quoteUnits("2", "100"),
  );
  await assertExactWallet(
    auth.userAccessToken,
    assetSymbol,
    BigInt(findWallet(buyerBeforeA, assetSymbol).availableRaw) + units("99.9"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    assetSymbol,
    BigInt(findWallet(sellerBeforeA, assetSymbol).availableRaw) - units("100"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWC",
    BigInt(findWallet(sellerBeforeA, "SWC").availableRaw) + units("199.8"),
  );

  const feeAfterA = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);
  expectFeeWalletBalanceDelta(feeBeforeA, feeAfterA, assetSymbol, units("0.1"));
  expectFeeWalletBalanceDelta(feeBeforeA, feeAfterA, "SWC", units("0.2"));

  const tradesAfterA = await adminTradesByMarket(auth.adminAccessToken, marketSymbol);
  const tradeA = tradesAfterA.find(
    (trade) =>
      trade.price === "2" &&
      trade.amount === "100" &&
      trade.marketSymbol === marketSymbol &&
      trade.buyer.username === auth.user.username &&
      trade.seller.username === auth.receiver.username,
  );
  if (!tradeA || tradeA.buyerFee !== "0.1" || tradeA.sellerFee !== "0.2") {
    throw new Error(
      `Expected default fee trade to persist 0.1 ${assetSymbol} buyer fee and 0.2 SWC seller fee.`,
    );
  }

  await setFeeSettings(auth.adminAccessToken, marketSymbol, "0.2", "0.3", "Smoke v0.7 fee change");
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
  const tradesAfterB = await adminTradesByMarket(auth.adminAccessToken, marketSymbol);
  const tradeB = tradesAfterB.find(
    (trade) =>
      trade.id !== tradeA.id &&
      trade.price === "2" &&
      trade.amount === "100" &&
      trade.buyer.username === auth.user.username &&
      trade.seller.username === auth.receiver.username,
  );
  if (!tradeB || tradeB.buyerFee !== "0.2" || tradeB.sellerFee !== "0.6") {
    throw new Error(
      `Updated fee trade should persist 0.2 ${assetSymbol} buyer fee and 0.6 SWC seller fee.`,
    );
  }
  const historicalTradeA = tradesAfterB.find((trade) => trade.id === tradeA.id);
  if (!historicalTradeA || historicalTradeA.buyerFee !== "0.1" || historicalTradeA.sellerFee !== "0.2") {
    throw new Error("Historical trades should keep original persisted fee amounts after fee changes.");
  }

  await expectFeeSettingsRejected(auth.adminAccessToken, marketSymbol, "-0.1", "0.1");
  await expectFeeSettingsRejected(auth.adminAccessToken, marketSymbol, "50", "0.1");
  await expectFeeSettingsRejected(auth.adminAccessToken, marketSymbol, "abc", "0.1");
  await expectFeeSettingsRejected(auth.adminAccessToken, marketSymbol, "1e-3", "0.1");

  const zeroSettingsBefore = await setFeeSettings(
    auth.adminAccessToken,
    marketSymbol,
    "0",
    "0",
    "Smoke v0.7 zero fee validation",
  );
  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "10");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "10");
  const zeroSettingsAfter = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);
  expectFeeWalletBalanceDelta(zeroSettingsBefore, zeroSettingsAfter, assetSymbol, 0n);
  expectFeeWalletBalanceDelta(zeroSettingsBefore, zeroSettingsAfter, "SWC", 0n);
  const zeroFeeTrade = (await adminTradesByMarket(auth.adminAccessToken, marketSymbol)).find(
    (trade) =>
      trade.price === "2" &&
      trade.amount === "10" &&
      trade.buyer.username === auth.user.username &&
      trade.seller.username === auth.receiver.username,
  );
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
  const orderMarket = await createSmokeMarket(auth.adminAccessToken, {
    prefix: "L",
    name: "Smoke Limit Asset",
    description: "Smoke v0.17.1 limit order isolation asset",
  });
  const { assetSymbol, marketSymbol, marketQuery } = orderMarket;
  const trackedOrderIds: string[] = [];

  await setFeeSettings(auth.adminAccessToken, marketSymbol, "0", "0", "Smoke v0.6 zero fee setup");
  await airdrop(auth.adminAccessToken, auth.user.username, "SWC", "1000", "Smoke v0.6 buyer funding");
  await airdrop(
    auth.adminAccessToken,
    auth.receiver.username,
    assetSymbol,
    "200",
    "Smoke v0.6 seller funding",
  );
  await airdrop(
    auth.adminAccessToken,
    adminUsername,
    assetSymbol,
    "200",
    "Smoke v0.6 admin seller funding",
  );

  const fundedBuyer = await walletSnapshot(auth.userAccessToken);
  const fundedSeller = await walletSnapshot(auth.receiverAccessToken);
  const buyerSwcFunded = findWallet(fundedBuyer, "SWC");
  const buyerAssetFunded = findWallet(fundedBuyer, assetSymbol);
  const sellerSwcFunded = findWallet(fundedSeller, "SWC");
  const sellerAssetFunded = findWallet(fundedSeller, assetSymbol);

  const sellA = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.15", "50");
  trackedOrderIds.push(sellA.id);
  const buyA = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.30", "50");
  trackedOrderIds.push(buyA.id);
  expectTradeResponse(buyA, "FILLED", "50", "0");
  await assertExactWallet(auth.userAccessToken, "SWC", BigInt(buyerSwcFunded.availableRaw) - quoteUnits("1.15", "50"));
  await assertExactWallet(
    auth.userAccessToken,
    assetSymbol,
    BigInt(buyerAssetFunded.availableRaw) + units("50"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    assetSymbol,
    BigInt(sellerAssetFunded.availableRaw) - units("50"),
  );
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
  trackedOrderIds.push(buyerB.id);
  const sellB = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.00", "50");
  trackedOrderIds.push(sellB.id);
  expectOrderStatus(sellB, "FILLED");
  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(buyerBeforeB, "SWC").availableRaw) - quoteUnits("1.20", "50"),
  );
  await assertExactWallet(
    auth.userAccessToken,
    assetSymbol,
    BigInt(findWallet(buyerBeforeB, assetSymbol).availableRaw) + units("50"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWC",
    BigInt(findWallet(sellerBeforeB, "SWC").availableRaw) + quoteUnits("1.20", "50"),
  );
  await expectAdminOrderStatus(auth.adminAccessToken, buyerB.id, "FILLED", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellB.id, "FILLED", "0");

  const sellerC1 = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.10", "20");
  trackedOrderIds.push(sellerC1.id);
  const sellerC2 = await createOrder(auth.adminAccessToken, marketSymbol, "SELL", "1.10", "30");
  trackedOrderIds.push(sellerC2.id);
  const buyC = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.10", "25");
  trackedOrderIds.push(buyC.id);
  expectTradeResponse(buyC, "FILLED", "25", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellerC1.id, "FILLED", "0");
  await expectAdminOrderStatus(auth.adminAccessToken, sellerC2.id, "PARTIAL_FILLED", "25");
  await cancelOrder(auth.adminAccessToken, sellerC2.id);

  const sellerD1 = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.10", "10");
  trackedOrderIds.push(sellerD1.id);
  const sellerD2 = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "1.15", "10");
  trackedOrderIds.push(sellerD2.id);
  const sellerD3 = await createOrder(auth.adminAccessToken, marketSymbol, "SELL", "1.20", "10");
  trackedOrderIds.push(sellerD3.id);
  const buyD = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.20", "25");
  trackedOrderIds.push(buyD.id);
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
  trackedOrderIds.push(sellerE.id);
  const buyE = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.10", "25");
  trackedOrderIds.push(buyE.id);
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

  const tradesBeforeSelfCross = await adminTradesByMarket(auth.adminAccessToken, marketSymbol);
  const selfSell = await createOrder(auth.userAccessToken, marketSymbol, "SELL", "1.00", "1");
  trackedOrderIds.push(selfSell.id);
  const selfBuy = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "1.20", "1");
  trackedOrderIds.push(selfBuy.id);
  expectOrderStatus(selfSell, "OPEN");
  expectOrderStatus(selfBuy, "OPEN");
  await expectAdminOrderStatus(auth.adminAccessToken, selfSell.id, "OPEN", "1");
  await expectAdminOrderStatus(auth.adminAccessToken, selfBuy.id, "OPEN", "1");
  const tradesAfterSelfCross = await adminTradesByMarket(auth.adminAccessToken, marketSymbol);
  if (tradesAfterSelfCross.length !== tradesBeforeSelfCross.length) {
    throw new Error("Crossed orders from the same user should not self-trade.");
  }
  await cancelOrder(auth.userAccessToken, selfBuy.id);
  await cancelOrder(auth.userAccessToken, selfSell.id);

  const userTrades = await getJson<Array<{ side: string; price: string; amount: string; quoteAmount: string }>>(
    `${apiBaseUrl}/trades/me?marketSymbol=${marketQuery}`,
    auth.userAccessToken,
    "load my trades",
  );
  if (!userTrades.length || !userTrades.some((trade) => trade.side === "BUY" || trade.side === "SELL")) {
    throw new Error("My trades endpoint should return user-side trades.");
  }

  const adminTradesList = await adminTradesByMarket(auth.adminAccessToken, marketSymbol);
  if (!adminTradesList.length) {
    throw new Error("Admin trades endpoint should return settled trades.");
  }

  const adminOrdersFinal = await adminOrders(auth.adminAccessToken);
  const trackedOrdersFinal = adminOrdersFinal.filter((order) => trackedOrderIds.includes(order.id));
  if (trackedOrdersFinal.some((order) => order.status === "OPEN" || order.status === "PARTIAL_FILLED")) {
    throw new Error("All smoke-created v0.6 scenario orders should be settled or cancelled before ending smoke.");
  }

  const orderBook = await getJson<{
    bids: Array<{ priceRaw: string; amountRaw: string }>;
    asks: Array<{ priceRaw: string; amountRaw: string }>;
  }>(`${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`, auth.userAccessToken, "load order book after matching");
  if (orderBook.bids.length !== 0 || orderBook.asks.length !== 0) {
    throw new Error("Order book should be empty after cleanup of all smoke orders.");
  }

  console.log("PASS v0.6 matching regression, partial fills, maker pricing, refunds, trades, and cancel flow");

  return orderMarket;
}

async function testV08AdminControlsFlow(auth: {
  userAccessToken: string;
  receiverAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const marketSymbol = "SWL/SWC";
  const marketQuery = encodeURIComponent(marketSymbol);

  await resetV08OperationalControls(auth.adminAccessToken);
  await airdrop(auth.adminAccessToken, auth.receiver.username, "SWL", "2", "Smoke v0.8 cancel funding");
  const frozenOrder = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "999", "1");

  await setUserStatus(auth.adminAccessToken, auth.receiver.username, "FROZEN", "Smoke v0.8 freeze");
  await expectGetJsonOk(`${apiBaseUrl}/wallets/me`, auth.receiverAccessToken, "frozen wallet read");
  await expectGetJsonOk(`${apiBaseUrl}/ledger/me`, auth.receiverAccessToken, "frozen ledger read");
  await expectGetJsonOk(`${apiBaseUrl}/orders/me`, auth.receiverAccessToken, "frozen orders read");
  await expectGetJsonOk(`${apiBaseUrl}/trades/me`, auth.receiverAccessToken, "frozen trades read");
  await expectPostJsonRejected(
    `${apiBaseUrl}/transfers`,
    auth.receiverAccessToken,
    {
      recipient: auth.user.email,
      assetSymbol: "SWL",
      amount: "1",
      note: "Smoke v0.8 frozen transfer block",
    },
    403,
    "USER_NOT_ACTIVE",
    "frozen transfer block",
  );
  await expectPostJsonRejected(
    `${apiBaseUrl}/orders`,
    auth.receiverAccessToken,
    { marketSymbol, side: "SELL", price: "999", amount: "1" },
    403,
    "USER_NOT_ACTIVE",
    "frozen order block",
  );
  await expectPostJsonRejected(
    `${apiBaseUrl}/orders/${frozenOrder.id}/cancel`,
    auth.receiverAccessToken,
    {},
    403,
    "USER_NOT_ACTIVE",
    "frozen cancel block",
  );
  await setUserStatus(auth.adminAccessToken, auth.receiver.username, "ACTIVE", "Smoke v0.8 unfreeze");
  await cancelOrder(auth.receiverAccessToken, frozenOrder.id);

  await setUserStatus(auth.adminAccessToken, auth.receiver.username, "BANNED", "Smoke v0.8 ban");
  await expectLoginRejected(auth.receiver.email, testPassword, "banned user login");
  await expectGetRejected(
    `${apiBaseUrl}/wallets/me`,
    auth.receiverAccessToken,
    401,
    "banned existing token block",
  );
  await setUserStatus(auth.adminAccessToken, auth.receiver.username, "ACTIVE", "Smoke v0.8 unban");

  await setAssetStatus(auth.adminAccessToken, "SWL", "PAUSED", "Smoke v0.8 pause SWL");
  await expectPostJsonRejected(
    `${apiBaseUrl}/transfers`,
    auth.userAccessToken,
    {
      recipient: auth.receiver.email,
      assetSymbol: "SWL",
      amount: "1",
      note: "Smoke v0.8 paused asset transfer block",
    },
    400,
    "ASSET_PAUSED",
    "paused asset transfer block",
  );
  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/airdrop`,
    auth.adminAccessToken,
    {
      username: auth.user.username,
      assetSymbol: "SWL",
      amount: "1",
      note: "Smoke v0.8 paused asset airdrop block",
    },
    400,
    "ASSET_PAUSED",
    "paused asset airdrop block",
  );
  await expectPostJsonRejected(
    `${apiBaseUrl}/orders`,
    auth.userAccessToken,
    { marketSymbol, side: "BUY", price: "1", amount: "1" },
    400,
    "ASSET_PAUSED",
    "paused asset order block",
  );
  await setAssetStatus(auth.adminAccessToken, "SWL", "ACTIVE", "Smoke v0.8 resume SWL");

  await expectAdminControlRejectedForNonAdmin(
    auth.userAccessToken,
    auth.adminAccessToken,
    auth.receiver.username,
  );

  const cancellableOrder = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "0.01", "1");
  await setMarketStatus(auth.adminAccessToken, marketSymbol, "PAUSED", "Smoke v0.8 pause market");
  await expectPostJsonRejected(
    `${apiBaseUrl}/orders`,
    auth.userAccessToken,
    { marketSymbol, side: "BUY", price: "0.01", amount: "1" },
    400,
    "MARKET_PAUSED",
    "paused market order block",
  );
  await getJson(`${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`, auth.userAccessToken, "paused market order book");
  await cancelOrder(auth.userAccessToken, cancellableOrder.id);
  await setMarketStatus(auth.adminAccessToken, marketSymbol, "ACTIVE", "Smoke v0.8 resume market");

  const auditLogs = await getJson<Array<{ action: string }>>(
    `${apiBaseUrl}/admin/audit-logs`,
    auth.adminAccessToken,
    "load audit logs after v0.8 controls",
  );
  for (const action of ["UPDATE_USER_STATUS", "UPDATE_ASSET_STATUS", "UPDATE_MARKET_STATUS"]) {
    if (!auditLogs.some((entry) => entry.action === action)) {
      throw new Error(`Expected ${action} audit log.`);
    }
  }

  console.log("PASS v0.8 admin user, asset, and market controls");
}

async function testV10MarketDataAndValuation(
  auth: {
  userAccessToken: string;
  adminAccessToken: string;
  },
  context: {
    marketSymbol: string;
    assetSymbol: string;
  },
) {
  const marketQuery = encodeURIComponent(context.marketSymbol);
  const ticker = await getJson<{
    marketSymbol: string;
    baseAssetSymbol: string;
    quoteAssetSymbol: string;
    lastPrice: string | null;
    bestBid: string | null;
    bestAsk: string | null;
    high24h: string | null;
    low24h: string | null;
    volume24h: string;
    quoteVolume24h: string;
    change24h: string | null;
    change24hPercent: string | null;
    tradeCount24h: number;
  }>(
    `${apiBaseUrl}/markets/ticker?marketSymbol=${marketQuery}`,
    auth.userAccessToken,
    "load v0.10 market ticker",
  );

  if (
    ticker.marketSymbol !== context.marketSymbol ||
    ticker.baseAssetSymbol !== context.assetSymbol ||
    ticker.quoteAssetSymbol !== "SWC"
  ) {
    throw new Error(`Unexpected ticker market metadata: ${JSON.stringify(ticker)}`);
  }

  if (ticker.lastPrice === null || ticker.high24h === null || ticker.low24h === null) {
    throw new Error(`Ticker should use real settled trades, got ${JSON.stringify(ticker)}`);
  }

  if (BigInt(parseDecimalToUnits(ticker.volume24h)) <= 0n) {
    throw new Error(`Ticker 24h volume should be positive after smoke trades, got ${ticker.volume24h}.`);
  }

  const summary = await getJson<Array<{ marketSymbol: string; lastPrice: string | null; status: string }>>(
    `${apiBaseUrl}/markets/summary`,
    auth.userAccessToken,
    "load v0.10 market summary",
  );
  const tradedMarketSummary = summary.find((entry) => entry.marketSymbol === context.marketSymbol);
  if (!tradedMarketSummary || tradedMarketSummary.lastPrice !== ticker.lastPrice) {
    throw new Error(`Market summary should include ${context.marketSymbol} with the same last price as ticker.`);
  }
  const swdSwcSummary = summary.find((entry) => entry.marketSymbol === "SWD/SWC");
  if (!swdSwcSummary) {
    throw new Error("Market summary should include SWD/SWC for v0.12 multi-market support.");
  }

  const swdTicker = await getJson<{
    marketSymbol: string;
    baseAssetSymbol: string;
    quoteAssetSymbol: string;
    lastPrice: string | null;
    bestBid: string | null;
    bestAsk: string | null;
  }>(
    `${apiBaseUrl}/markets/ticker?marketSymbol=${encodeURIComponent("SWD/SWC")}`,
    auth.userAccessToken,
    "load v0.12 demo market ticker",
  );
  if (
    swdTicker.marketSymbol !== "SWD/SWC" ||
    swdTicker.baseAssetSymbol !== "SWD" ||
    swdTicker.quoteAssetSymbol !== "SWC"
  ) {
    throw new Error(`Unexpected SWD/SWC ticker payload: ${JSON.stringify(swdTicker)}`);
  }

  if (swdSwcSummary.lastPrice !== swdTicker.lastPrice) {
    throw new Error("SWD/SWC market summary should stay aligned with its ticker last price.");
  }

  const swdOrderBook = await getJson<{ marketSymbol: string; bids: unknown[]; asks: unknown[] }>(
    `${apiBaseUrl}/order-book?marketSymbol=${encodeURIComponent("SWD/SWC")}`,
    auth.userAccessToken,
    "load v0.12 demo market order book",
  );
  if (swdOrderBook.marketSymbol !== "SWD/SWC") {
    throw new Error(`Unexpected SWD/SWC order book payload: ${JSON.stringify(swdOrderBook)}`);
  }

  const valuation = await getJson<{
    quoteAssetSymbol: string;
    totalEquity: string;
    hasUnpricedAssets: boolean;
    assets: Array<{
      assetSymbol: string;
      total: string;
      priceInSWC: string | null;
      valueInSWC: string | null;
    }>;
  }>(`${apiBaseUrl}/wallets/me/valuation`, auth.userAccessToken, "load v0.10 wallet valuation");
  const swcValuation = valuation.assets.find((asset) => asset.assetSymbol === "SWC");
  const tradedAssetValuation = valuation.assets.find((asset) => asset.assetSymbol === context.assetSymbol);
  const swdValuation = valuation.assets.find((asset) => asset.assetSymbol === "SWD");

  if (valuation.quoteAssetSymbol !== "SWC" || !swcValuation || !tradedAssetValuation || !swdValuation) {
    throw new Error(`Unexpected valuation payload: ${JSON.stringify(valuation)}`);
  }

  if (swcValuation.priceInSWC !== "1") {
    throw new Error(`SWC valuation should be fixed at 1 SWC, got ${swcValuation.priceInSWC}.`);
  }

  if (tradedAssetValuation.priceInSWC !== ticker.lastPrice || tradedAssetValuation.valueInSWC === null) {
    throw new Error(
      `${context.assetSymbol} valuation should use the latest ${context.marketSymbol} last price after trades exist.`,
    );
  }

  const adminSummary = await getJson<{
    marketSummary?: { marketSymbol: string; totalTradeCount: number };
    marketSummaries?: Array<{ marketSymbol: string; totalTradeCount: number; lastPrice: string | null }>;
  }>(
    `${apiBaseUrl}/admin/reports/summary`,
    auth.adminAccessToken,
    "load v0.10 admin market summary",
  );
  if (
    !adminSummary.marketSummaries?.some(
      (entry) => entry.marketSymbol === context.marketSymbol && entry.totalTradeCount > 0,
    )
  ) {
    throw new Error(`Admin report summary should include ${context.marketSymbol} market data.`);
  }

  console.log("PASS v0.10 market ticker, summary, wallet valuation, and admin market data");
}

async function testV13AdminAssetAndMarketCreation(auth: {
  userAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const assetSymbol = nextSmokeSymbol("Q");
  const marketSymbol = `${assetSymbol}/SWC`;

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/assets`,
    auth.userAccessToken,
    {
      symbol: assetSymbol,
      name: "Blocked Asset",
      decimals: 18,
    },
    403,
    "Forbidden resource",
    "non-admin create asset",
  );

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/assets`,
    auth.adminAccessToken,
    {
      symbol: `${assetSymbol}BAD`,
      name: "Broken Asset",
      decimals: 19,
    },
    400,
    "decimals must be an integer between 0 and 18.",
    "invalid asset decimals",
  );

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/assets`,
    auth.adminAccessToken,
    {
      symbol: `${assetSymbol}I`,
      name: "Broken Icon",
      decimals: 18,
      iconUrl: "ftp://invalid.example/icon.png",
    },
    400,
    "iconUrl must use http or https.",
    "invalid asset icon url",
  );

  const createdAsset = await postJson<{
    symbol: string;
    name: string;
    displayName: string;
    decimals: number;
    iconUrl: string | null;
    status: string;
  }>(`${apiBaseUrl}/admin/assets`, auth.adminAccessToken, {
    symbol: assetSymbol.toLowerCase(),
    name: "Smoke QA Asset",
    displayName: "Smoke QA Asset",
    decimals: 18,
    iconUrl: "   ",
    status: "ACTIVE",
    description: "Smoke v0.13 asset",
  }, "create v0.13 asset");

  if (
    createdAsset.symbol !== assetSymbol ||
    createdAsset.name !== "Smoke QA Asset" ||
    createdAsset.iconUrl !== null ||
    createdAsset.status !== "ACTIVE"
  ) {
    throw new Error(`Unexpected created asset payload: ${JSON.stringify(createdAsset)}`);
  }

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/assets`,
    auth.adminAccessToken,
    {
      symbol: assetSymbol,
      name: "Duplicate Asset",
      decimals: 18,
    },
    400,
    `Asset ${assetSymbol} already exists.`,
    "duplicate asset symbol",
  );

  const publicAssets = await fetchJson<Array<{ symbol: string; status?: string }>>(
    `${apiBaseUrl}/assets`,
    "load public assets after v0.13 create asset",
  );
  if (!publicAssets.some((asset) => asset.symbol === assetSymbol)) {
    throw new Error(`Expected public assets to include ${assetSymbol}.`);
  }

  const adminAssetWallets = await getJson<Array<{ asset: string; walletType?: string }>>(
    `${apiBaseUrl}/admin/wallets?assetSymbol=${assetSymbol}`,
    auth.adminAccessToken,
    "load v0.13 asset wallets",
  );
  if (
    !adminAssetWallets.some((wallet) => wallet.asset === assetSymbol && wallet.walletType === "MAIN")
  ) {
    throw new Error(`Expected admin/user MAIN wallets for ${assetSymbol}.`);
  }

  const systemWallets = await getJson<Array<{ asset: string; walletType: string; availableRaw: string; lockedRaw: string }>>(
    `${apiBaseUrl}/admin/system-wallets`,
    auth.adminAccessToken,
    "load v0.13 system wallets",
  );
  for (const walletType of ["FEE", "TREASURY", "AIRDROP", "HOT"]) {
    const wallet = systemWallets.find(
      (entry) => entry.asset === assetSymbol && entry.walletType === walletType,
    );
    if (!wallet || wallet.availableRaw !== "0" || wallet.lockedRaw !== "0") {
      throw new Error(`Expected zero-balance ${walletType} wallet for ${assetSymbol}.`);
    }
  }

  const auditLogsAfterAsset = await getJson<Array<{ action: string; afterValue?: { symbol?: string } }>>(
    `${apiBaseUrl}/admin/audit-logs`,
    auth.adminAccessToken,
    "load audit logs after v0.13 create asset",
  );
  if (!auditLogsAfterAsset.some((entry) => entry.action === "CREATE_ASSET" && entry.afterValue?.symbol === assetSymbol)) {
    throw new Error(`Expected CREATE_ASSET audit log for ${assetSymbol}.`);
  }

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/markets`,
    auth.userAccessToken,
    {
      baseAssetSymbol: assetSymbol,
      quoteAssetSymbol: "SWC",
    },
    403,
    "Forbidden resource",
    "non-admin create market",
  );

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/markets`,
    auth.adminAccessToken,
    {
      baseAssetSymbol: assetSymbol,
      quoteAssetSymbol: assetSymbol,
    },
    400,
    "baseAssetSymbol and quoteAssetSymbol must be different.",
    "same-asset market rejection",
  );

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/markets`,
    auth.adminAccessToken,
    {
      baseAssetSymbol: assetSymbol,
      quoteAssetSymbol: "SWC",
      symbol: `${assetSymbol}-SWC`,
    },
    400,
    "symbol must look like BASE/QUOTE.",
    "market symbol format rejection",
  );

  const pausedAssetSymbol = nextSmokeSymbol("P");
  await postJson(
    `${apiBaseUrl}/admin/assets`,
    auth.adminAccessToken,
    {
      symbol: pausedAssetSymbol,
      name: "Smoke Paused Asset",
      decimals: 18,
      status: "PAUSED",
    },
    "create paused asset for v0.13",
  );

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/markets`,
    auth.adminAccessToken,
    {
      baseAssetSymbol: pausedAssetSymbol,
      quoteAssetSymbol: "SWC",
      status: "ACTIVE",
    },
    400,
    "Active markets require both base and quote assets to be ACTIVE. Create the market as PAUSED or resume the assets first.",
    "active market with paused asset rejection",
  );

  const pausedMarket = await postJson<{ symbol: string; status: string }>(
    `${apiBaseUrl}/admin/markets`,
    auth.adminAccessToken,
    {
      baseAssetSymbol: pausedAssetSymbol,
      quoteAssetSymbol: "SWC",
      status: "PAUSED",
    },
    "create paused market for paused asset",
  );
  if (pausedMarket.symbol !== `${pausedAssetSymbol}/SWC` || pausedMarket.status !== "PAUSED") {
    throw new Error(`Unexpected paused market payload: ${JSON.stringify(pausedMarket)}`);
  }

  const createdMarket = await postJson<{
    symbol: string;
    status: string;
    minOrderAmount: string;
    minNotional: string;
    feeSetting?: { marketSymbol: string; buyerFeeRateBps: number; sellerFeeRateBps: number };
  }>(`${apiBaseUrl}/admin/markets`, auth.adminAccessToken, {
    baseAssetSymbol: assetSymbol.toLowerCase(),
    quoteAssetSymbol: "swc",
    status: "ACTIVE",
    pricePrecision: 18,
    amountPrecision: 18,
    minOrderAmount: "0.1",
    minNotional: "1",
  }, "create v0.13 market");

  if (
    createdMarket.symbol !== marketSymbol ||
    createdMarket.status !== "ACTIVE" ||
    createdMarket.minOrderAmount !== "0.1" ||
    createdMarket.minNotional !== "1" ||
    createdMarket.feeSetting?.marketSymbol !== marketSymbol ||
    createdMarket.feeSetting?.buyerFeeRateBps !== 10 ||
    createdMarket.feeSetting?.sellerFeeRateBps !== 10
  ) {
    throw new Error(`Unexpected created market payload: ${JSON.stringify(createdMarket)}`);
  }

  await expectPostJsonRejected(
    `${apiBaseUrl}/admin/markets`,
    auth.adminAccessToken,
    {
      baseAssetSymbol: assetSymbol,
      quoteAssetSymbol: "SWC",
    },
    400,
    `Market ${marketSymbol} already exists.`,
    "duplicate market symbol",
  );

  const emptyTicker = await fetchJson<{
    marketSymbol: string;
    lastPrice: string | null;
    bestBid: string | null;
    bestAsk: string | null;
    tradeCount24h: number;
  }>(
    `${apiBaseUrl}/markets/ticker?marketSymbol=${encodeURIComponent(marketSymbol)}`,
    "load empty v0.13 market ticker",
  );
  if (
    emptyTicker.marketSymbol !== marketSymbol ||
    emptyTicker.lastPrice !== null ||
    emptyTicker.bestBid !== null ||
    emptyTicker.bestAsk !== null ||
    emptyTicker.tradeCount24h !== 0
  ) {
    throw new Error(`New market should start with empty ticker values, got ${JSON.stringify(emptyTicker)}`);
  }

  const emptyRecentTrades = await getJson<Array<{ marketSymbol: string }>>(
    `${apiBaseUrl}/trades/recent?marketSymbol=${encodeURIComponent(marketSymbol)}`,
    auth.userAccessToken,
    "load empty v0.13 recent trades",
  );
  if (emptyRecentTrades.length !== 0) {
    throw new Error("New market should not have seeded recent trades.");
  }

  const emptyOrderBook = await getJson<{ marketSymbol: string; bids: unknown[]; asks: unknown[] }>(
    `${apiBaseUrl}/order-book?marketSymbol=${encodeURIComponent(marketSymbol)}`,
    auth.userAccessToken,
    "load empty v0.13 order book",
  );
  if (
    emptyOrderBook.marketSymbol !== marketSymbol ||
    emptyOrderBook.bids.length !== 0 ||
    emptyOrderBook.asks.length !== 0
  ) {
    throw new Error("New market should start with an empty order book.");
  }

  const marketSummary = await fetchJson<Array<{ marketSymbol: string; status: string }>>(
    `${apiBaseUrl}/markets/summary`,
    "load v0.13 market summary",
  );
  if (!marketSummary.some((market) => market.marketSymbol === marketSymbol && market.status === "ACTIVE")) {
    throw new Error(`Expected market summary to include ${marketSymbol}.`);
  }
  if (!marketSummary.some((market) => market.marketSymbol === `${pausedAssetSymbol}/SWC` && market.status === "PAUSED")) {
    throw new Error(`Expected market summary to include paused market ${pausedAssetSymbol}/SWC.`);
  }

  const feeBeforeTrade = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);
  if (
    feeBeforeTrade.marketSymbol !== marketSymbol ||
    feeBeforeTrade.buyerFeeRatePercent !== "0.1" ||
    feeBeforeTrade.sellerFeeRatePercent !== "0.1"
  ) {
    throw new Error(`Unexpected v0.13 fee settings: ${JSON.stringify(feeBeforeTrade)}`);
  }

  await expectPostJsonRejected(
    `${apiBaseUrl}/orders`,
    auth.receiverAccessToken,
    {
      marketSymbol,
      side: "SELL",
      price: "2",
      amount: "0.01",
    },
    400,
    "Amount must be at least 0.1.",
    "min order amount enforcement",
  );

  await expectPostJsonRejected(
    `${apiBaseUrl}/orders`,
    auth.receiverAccessToken,
    {
      marketSymbol,
      side: "SELL",
      price: "2",
      amount: "0.2",
    },
    400,
    "Order notional must be at least 1.",
    "min notional enforcement",
  );

  await airdrop(auth.adminAccessToken, auth.receiver.username, assetSymbol, "100", "Smoke v0.13 seller funding");
  await airdrop(auth.adminAccessToken, auth.user.username, "SWC", "1000", "Smoke v0.13 buyer funding");

  const sellerBefore = await walletSnapshot(auth.receiverAccessToken);
  const buyerBefore = await walletSnapshot(auth.userAccessToken);
  const feeWalletBefore = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);

  const sellOrder = await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "10");
  const buyOrder = await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "10");
  expectTradeResponse(sellOrder, "OPEN", "0", "10");
  expectTradeResponse(buyOrder, "FILLED", "10", "0");

  await assertExactWallet(
    auth.userAccessToken,
    assetSymbol,
    BigInt(findWallet(buyerBefore, assetSymbol).availableRaw) + units("9.99"),
  );
  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(buyerBefore, "SWC").availableRaw) - quoteUnits("2", "10"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    assetSymbol,
    BigInt(findWallet(sellerBefore, assetSymbol).availableRaw) - units("10"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWC",
    BigInt(findWallet(sellerBefore, "SWC").availableRaw) + units("19.98"),
  );

  const feeWalletAfter = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);
  expectFeeWalletBalanceDelta(feeWalletBefore, feeWalletAfter, assetSymbol, units("0.01"));
  expectFeeWalletBalanceDelta(feeWalletBefore, feeWalletAfter, "SWC", units("0.02"));

  const v13Trades = await adminTradesByMarket(auth.adminAccessToken, marketSymbol);
  const v13Trade = v13Trades.find(
    (trade) =>
      trade.marketSymbol === marketSymbol &&
      trade.price === "2" &&
      trade.amount === "10" &&
      trade.buyer.username === auth.user.username &&
      trade.seller.username === auth.receiver.username,
  );
  if (!v13Trade || v13Trade.buyerFee !== "0.01" || v13Trade.sellerFee !== "0.02") {
    throw new Error(`Expected settled v0.13 trade with fees on ${marketSymbol}.`);
  }

  const swlTrades = await adminTradesByMarket(auth.adminAccessToken, "SWL/SWC");
  if (swlTrades.some((trade) => trade.id === v13Trade.id)) {
    throw new Error("SWL/SWC trades should not include the admin-created market trade.");
  }

  const swdTrades = await adminTradesByMarket(auth.adminAccessToken, "SWD/SWC");
  if (swdTrades.some((trade) => trade.id === v13Trade.id)) {
    throw new Error("SWD/SWC trades should not include the admin-created market trade.");
  }

  const orderBookAfterFill = await getJson<{ bids: unknown[]; asks: unknown[] }>(
    `${apiBaseUrl}/order-book?marketSymbol=${encodeURIComponent(marketSymbol)}`,
    auth.userAccessToken,
    "load v0.13 order book after fill",
  );
  if (orderBookAfterFill.bids.length !== 0 || orderBookAfterFill.asks.length !== 0) {
    throw new Error("Filled v0.13 market should have an empty order book.");
  }

  const postTradeTicker = await fetchJson<{
    marketSymbol: string;
    lastPrice: string | null;
    tradeCount24h: number;
  }>(
    `${apiBaseUrl}/markets/ticker?marketSymbol=${encodeURIComponent(marketSymbol)}`,
    "load filled v0.13 ticker",
  );
  if (
    postTradeTicker.marketSymbol !== marketSymbol ||
    postTradeTicker.lastPrice !== "2" ||
    postTradeTicker.tradeCount24h <= 0
  ) {
    throw new Error(`Unexpected post-trade ticker for ${marketSymbol}: ${JSON.stringify(postTradeTicker)}`);
  }

  const valuation = await getJson<{
    assets: Array<{ assetSymbol: string; total: string; priceInSWC: string | null; valueInSWC: string | null }>;
  }>(`${apiBaseUrl}/wallets/me/valuation`, auth.userAccessToken, "load v0.13 wallet valuation");
  const createdAssetValuation = valuation.assets.find((asset) => asset.assetSymbol === assetSymbol);
  if (
    !createdAssetValuation ||
    createdAssetValuation.priceInSWC !== "2" ||
    createdAssetValuation.valueInSWC === null
  ) {
    throw new Error(`Expected valuation for ${assetSymbol} after trade, got ${JSON.stringify(createdAssetValuation)}`);
  }

  const auditLogsAfterMarket = await getJson<Array<{ action: string; afterValue?: { symbol?: string } }>>(
    `${apiBaseUrl}/admin/audit-logs`,
    auth.adminAccessToken,
    "load audit logs after v0.13 create market",
  );
  if (!auditLogsAfterMarket.some((entry) => entry.action === "CREATE_MARKET" && entry.afterValue?.symbol === marketSymbol)) {
    throw new Error(`Expected CREATE_MARKET audit log for ${marketSymbol}.`);
  }

  console.log("PASS v0.13 admin asset creation, market creation, wallet coverage, and created-market trading flow");

  return {
    emptyMarketSymbol: `${pausedAssetSymbol}/SWC`,
  };
}

async function testV14CandleFlow(
  auth: {
    userAccessToken: string;
    receiverAccessToken: string;
    adminAccessToken: string;
    user: { email: string; username: string };
    receiver: { email: string; username: string };
  },
  context: { emptyMarketSymbol: string },
) {
  const assetSymbol = nextSmokeSymbol("K");
  const marketSymbol = `${assetSymbol}/SWC`;
  const marketQuery = encodeURIComponent(marketSymbol);

  await postJson(
    `${apiBaseUrl}/admin/assets`,
    auth.adminAccessToken,
    {
      symbol: assetSymbol,
      name: "Smoke Kline Asset",
      decimals: 18,
      status: "ACTIVE",
      description: "Smoke v0.14 candle asset",
    },
    "create v0.14 candle asset",
  );

  await postJson(
    `${apiBaseUrl}/admin/markets`,
    auth.adminAccessToken,
    {
      baseAssetSymbol: assetSymbol,
      quoteAssetSymbol: "SWC",
      status: "ACTIVE",
      pricePrecision: 18,
      amountPrecision: 18,
      minOrderAmount: "0.1",
      minNotional: "1",
    },
    "create v0.14 candle market",
  );

  const emptyCreatedMarketCandles = await fetchJson<unknown[]>(
    `${apiBaseUrl}/markets/candles?marketSymbol=${marketQuery}&interval=1m`,
    "load empty candles for new v0.14 market",
  );
  if (emptyCreatedMarketCandles.length !== 0) {
    throw new Error("New v0.14 market should start with empty candles.");
  }

  await airdrop(auth.adminAccessToken, auth.receiver.username, assetSymbol, "30", "Smoke v0.14 candle seller funding");
  await airdrop(auth.adminAccessToken, auth.user.username, "SWC", "100", "Smoke v0.14 candle buyer funding");

  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "3", "4");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "3", "4");
  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "4", "5");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "4", "5");

  const oneMinuteCandles = await getJson<
    Array<{
      marketSymbol: string;
      interval: string;
      startTime: string;
      endTime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      quoteVolume: string;
      tradeCount: number;
    }>
  >(
    `${apiBaseUrl}/markets/candles?marketSymbol=${marketQuery}&interval=1m`,
    auth.userAccessToken,
    "load v0.14 one-minute candles",
  );
  const latestOneMinuteCandle = oneMinuteCandles[oneMinuteCandles.length - 1];
  if (
    !latestOneMinuteCandle ||
    latestOneMinuteCandle.marketSymbol !== marketSymbol ||
    latestOneMinuteCandle.interval !== "1m" ||
    !latestOneMinuteCandle.startTime ||
    !latestOneMinuteCandle.endTime ||
    !latestOneMinuteCandle.open ||
    !latestOneMinuteCandle.high ||
    !latestOneMinuteCandle.low ||
    !latestOneMinuteCandle.close ||
    !latestOneMinuteCandle.volume ||
    !latestOneMinuteCandle.quoteVolume ||
    latestOneMinuteCandle.tradeCount <= 0
  ) {
    throw new Error(`Unexpected v0.14 one-minute candle payload: ${JSON.stringify(oneMinuteCandles)}`);
  }

  const dailyCandles = await getJson<
    Array<{
      marketSymbol: string;
      interval: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
      quoteVolume: string;
      tradeCount: number;
    }>
  >(
    `${apiBaseUrl}/markets/candles?marketSymbol=${marketQuery}&interval=1d&limit=10`,
    auth.userAccessToken,
    "load v0.14 daily candles",
  );
  const latestDailyCandle = dailyCandles[dailyCandles.length - 1];
  if (
    !latestDailyCandle ||
    latestDailyCandle.marketSymbol !== marketSymbol ||
    latestDailyCandle.interval !== "1d" ||
    latestDailyCandle.open !== "3" ||
    latestDailyCandle.high !== "4" ||
    latestDailyCandle.low !== "3" ||
    latestDailyCandle.close !== "4" ||
    latestDailyCandle.volume !== "9" ||
    latestDailyCandle.quoteVolume !== "32" ||
    latestDailyCandle.tradeCount !== 2
  ) {
    throw new Error(`Unexpected v0.14 daily candle aggregation: ${JSON.stringify(dailyCandles)}`);
  }

  const emptyMarketCandles = await getJson<unknown[]>(
    `${apiBaseUrl}/markets/candles?marketSymbol=${encodeURIComponent(context.emptyMarketSymbol)}&interval=1m`,
    auth.userAccessToken,
    "load v0.14 empty-market candles",
  );
  if (emptyMarketCandles.length !== 0) {
    throw new Error("Untraded market should not include candles from another market.");
  }

  await expectPublicGetRejected(
    `${apiBaseUrl}/markets/candles?marketSymbol=${marketQuery}&interval=2m`,
    400,
    "invalid v0.14 candle interval",
  );
  await expectPublicGetRejected(
    `${apiBaseUrl}/markets/candles?marketSymbol=${encodeURIComponent("NOPE/SWC")}&interval=1m`,
    404,
    "invalid v0.14 candle market",
  );

  console.log("PASS v0.14 candle endpoint validation, empty state, and aggregation");
}

async function testV15MarketOrders(auth: {
  userAccessToken: string;
  receiverAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const marketOrderMarket = await createSmokeMarket(auth.adminAccessToken, {
    prefix: "M",
    name: "Smoke Market Asset",
    description: "Smoke v0.17.1 market order isolation asset",
  });
  const { assetSymbol, marketSymbol, marketQuery } = marketOrderMarket;

  await airdrop(auth.adminAccessToken, auth.user.username, "SWC", "2000", "Smoke v0.15 market buyer SWC");
  await airdrop(
    auth.adminAccessToken,
    auth.receiver.username,
    assetSymbol,
    "300",
    "Smoke v0.15 market seller asset",
  );

  const buyFullFeeBefore = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);
  const buyFullBuyerBefore = await walletSnapshot(auth.userAccessToken);
  const buyFullSellerBefore = await walletSnapshot(auth.receiverAccessToken);
  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "10");
  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "3", "10");
  const buyFullPreview = await previewMarketOrder(auth.userAccessToken, marketSymbol, "BUY", {
    quoteAmount: "50",
  });
  if (
    buyFullPreview.liquidityStatus !== "FULL" ||
    buyFullPreview.estimatedTradeCount !== 2 ||
    buyFullPreview.estimatedAveragePrice !== "2.5"
  ) {
    throw new Error(`Unexpected full market buy preview: ${JSON.stringify(buyFullPreview)}`);
  }
  const buyFull = await createMarketOrder(auth.userAccessToken, marketSymbol, "BUY", {
    quoteAmount: "50",
  });
  expectMarketOrderResponse(buyFull, "FILLED", "20", "0", "50", "2.5", 2);
  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(buyFullBuyerBefore, "SWC").availableRaw) - units("50"),
  );
  await assertExactWallet(
    auth.userAccessToken,
    assetSymbol,
    BigInt(findWallet(buyFullBuyerBefore, assetSymbol).availableRaw) + units("19.98"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    assetSymbol,
    BigInt(findWallet(buyFullSellerBefore, assetSymbol).availableRaw) - units("20"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWC",
    BigInt(findWallet(buyFullSellerBefore, "SWC").availableRaw) + units("49.95"),
  );
  const buyFullFeeAfter = await feeSettingsForMarket(auth.adminAccessToken, marketSymbol);
  expectFeeWalletBalanceDelta(buyFullFeeBefore, buyFullFeeAfter, assetSymbol, units("0.02"));
  expectFeeWalletBalanceDelta(buyFullFeeBefore, buyFullFeeAfter, "SWC", units("0.05"));
  await expectOrderBookEmpty(auth.userAccessToken, marketQuery, "market buy full fill");

  const buyPartialBuyerBefore = await walletSnapshot(auth.userAccessToken);
  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "2", "5");
  const buyPartialPreview = await previewMarketOrder(auth.userAccessToken, marketSymbol, "BUY", {
    quoteAmount: "100",
  });
  if (buyPartialPreview.liquidityStatus !== "PARTIAL" || !buyPartialPreview.warning) {
    throw new Error(`Unexpected partial market buy preview: ${JSON.stringify(buyPartialPreview)}`);
  }
  const buyPartial = await createMarketOrder(auth.userAccessToken, marketSymbol, "BUY", {
    quoteAmount: "100",
  });
  expectMarketOrderResponse(buyPartial, "PARTIAL_FILLED_CANCELLED", "5", "0", "10", "2", 1);
  if (buyPartial.cancelledQuoteAmount !== "90" || !buyPartial.warning) {
    throw new Error(`Partial market buy should report cancelled quote remainder: ${JSON.stringify(buyPartial)}`);
  }
  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(buyPartialBuyerBefore, "SWC").availableRaw) - units("10"),
  );
  await expectOrderBookEmpty(auth.userAccessToken, marketQuery, "market buy partial fill");

  const sellFullBuyerBefore = await walletSnapshot(auth.userAccessToken);
  const sellFullSellerBefore = await walletSnapshot(auth.receiverAccessToken);
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "3", "10");
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "10");
  const sellFullPreview = await previewMarketOrder(auth.receiverAccessToken, marketSymbol, "SELL", {
    amount: "20",
  });
  if (
    sellFullPreview.liquidityStatus !== "FULL" ||
    sellFullPreview.estimatedTradeCount !== 2 ||
    sellFullPreview.estimatedAveragePrice !== "2.5"
  ) {
    throw new Error(`Unexpected full market sell preview: ${JSON.stringify(sellFullPreview)}`);
  }
  const sellFull = await createMarketOrder(auth.receiverAccessToken, marketSymbol, "SELL", {
    amount: "20",
  });
  expectMarketOrderResponse(sellFull, "FILLED", "20", "0", "50", "2.5", 2);
  if (sellFull.receivedQuoteAmount !== "49.95") {
    throw new Error(`Full market sell should report net received quote: ${JSON.stringify(sellFull)}`);
  }
  await assertExactWallet(
    auth.receiverAccessToken,
    assetSymbol,
    BigInt(findWallet(sellFullSellerBefore, assetSymbol).availableRaw) - units("20"),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    "SWC",
    BigInt(findWallet(sellFullSellerBefore, "SWC").availableRaw) + units("49.95"),
  );
  await assertExactWallet(
    auth.userAccessToken,
    assetSymbol,
    BigInt(findWallet(sellFullBuyerBefore, assetSymbol).availableRaw) + units("19.98"),
  );
  await expectOrderBookEmpty(auth.userAccessToken, marketQuery, "market sell full fill");

  const sellPartialSellerBefore = await walletSnapshot(auth.receiverAccessToken);
  await createOrder(auth.userAccessToken, marketSymbol, "BUY", "2", "5");
  const sellPartial = await createMarketOrder(auth.receiverAccessToken, marketSymbol, "SELL", {
    amount: "20",
  });
  expectMarketOrderResponse(sellPartial, "PARTIAL_FILLED_CANCELLED", "5", "15", "10", "2", 1);
  if (sellPartial.cancelledAmount !== "15" || !sellPartial.warning) {
    throw new Error(`Partial market sell should report cancelled base remainder: ${JSON.stringify(sellPartial)}`);
  }
  await assertExactWallet(
    auth.receiverAccessToken,
    assetSymbol,
    BigInt(findWallet(sellPartialSellerBefore, assetSymbol).availableRaw) - units("5"),
  );
  await expectOrderBookEmpty(auth.userAccessToken, marketQuery, "market sell partial fill");

  const isolatedMarket = await createSmokeMarket(auth.adminAccessToken, {
    prefix: "I",
    name: "Smoke Isolated Market Asset",
    description: "Smoke v0.17.1 isolated market asset",
  });
  const isolatedMarketSymbol = isolatedMarket.marketSymbol;
  const isolatedMarketQuery = isolatedMarket.marketQuery;
  await airdrop(
    auth.adminAccessToken,
    auth.receiver.username,
    isolatedMarket.assetSymbol,
    "20",
    "Smoke v0.15 isolated seller asset",
  );

  const noLiquidityBuyerBefore = await walletSnapshot(auth.userAccessToken);
  const noLiquiditySellerBefore = await walletSnapshot(auth.receiverAccessToken);
  const noLiquidityPreview = await previewMarketOrder(auth.userAccessToken, isolatedMarketSymbol, "BUY", {
    quoteAmount: "10",
  });
  if (noLiquidityPreview.liquidityStatus !== "NONE") {
    throw new Error(`Expected no-liquidity preview, got ${JSON.stringify(noLiquidityPreview)}`);
  }
  await expectMarketOrderRejected(auth.userAccessToken, isolatedMarketSymbol, "BUY", {
    quoteAmount: "10",
  });
  await expectMarketOrderRejected(auth.receiverAccessToken, isolatedMarketSymbol, "SELL", {
    amount: "1",
  });
  await assertExactWallet(
    auth.userAccessToken,
    "SWC",
    BigInt(findWallet(noLiquidityBuyerBefore, "SWC").availableRaw),
  );
  await assertExactWallet(
    auth.receiverAccessToken,
    isolatedMarket.assetSymbol,
    BigInt(findWallet(noLiquiditySellerBefore, isolatedMarket.assetSymbol).availableRaw),
  );

  const isolatedAsk = await createOrder(auth.receiverAccessToken, isolatedMarketSymbol, "SELL", "1", "5");
  await createOrder(auth.receiverAccessToken, marketSymbol, "SELL", "4", "1");
  const isolatedBookBefore = await getJson<{ asks: Array<{ amount: string }> }>(
    `${apiBaseUrl}/order-book?marketSymbol=${isolatedMarketQuery}`,
    auth.userAccessToken,
    "load isolated book before market isolation check",
  );
  if (isolatedBookBefore.asks.length !== 1) {
    throw new Error("Expected isolated market ask before market isolation check.");
  }
  const isolatedCheckBuy = await createMarketOrder(auth.userAccessToken, marketSymbol, "BUY", {
    quoteAmount: "4",
  });
  expectMarketOrderResponse(isolatedCheckBuy, "FILLED", "1", "0", "4", "4", 1);
  await expectAdminOrderStatus(auth.adminAccessToken, isolatedAsk.id, "OPEN", "5");
  const isolatedBookAfter = await getJson<{ asks: Array<{ amount: string }> }>(
    `${apiBaseUrl}/order-book?marketSymbol=${isolatedMarketQuery}`,
    auth.userAccessToken,
    "load isolated book after market isolation check",
  );
  if (isolatedBookAfter.asks.length !== 1 || isolatedBookAfter.asks[0]?.amount !== "5") {
    throw new Error("Market order in SWL/SWC should not consume isolated-market liquidity.");
  }
  await cancelOrder(auth.receiverAccessToken, isolatedAsk.id);

  const userOpenOrders = await getJson<Array<{ id: string; type: string }>>(
    `${apiBaseUrl}/orders/me?marketSymbol=${marketQuery}&status=OPEN`,
    auth.userAccessToken,
    "load v0.15 user open orders",
  );
  if (userOpenOrders.some((order) => order.type === "MARKET")) {
    throw new Error("Market orders should not appear as open user orders.");
  }

  console.log("PASS v0.15 market orders, taker flow, preview, partial cancel, no liquidity, and market isolation");
}

async function testAuthLogoutFlow(userAccessToken: string, adminAccessToken: string) {
  const response = await fetch(`${apiBaseUrl}/auth/logout`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${userAccessToken}`,
    },
  });
  assertOk(response, "auth logout");
  const json = (await response.json()) as { success?: boolean };
  if (!json.success) {
    throw new Error(`Unexpected logout payload: ${JSON.stringify(json)}`);
  }

  const securityEvents = await getJson<{ events?: Array<{ eventType: string }> }>(
    `${apiBaseUrl}/admin/security-events?eventType=AUTH_LOGOUT&limit=20`,
    adminAccessToken,
    "load logout security events",
  );
  if (!securityEvents.events?.some((event) => event.eventType === "AUTH_LOGOUT")) {
    throw new Error("Expected AUTH_LOGOUT security event after logout request.");
  }

  console.log("PASS v1.0.1 auth logout event");
}

async function testV101SecurityEventCoverage(adminAccessToken: string) {
  const response = await getJson<{
    events?: Array<{ eventType: string; metadata?: unknown }>;
  }>(`${apiBaseUrl}/admin/security-events?limit=250`, adminAccessToken, "load security event coverage");

  const eventTypes = new Set((response.events ?? []).map((event) => event.eventType));
  for (const expectedEventType of [
    "AUTH_LOGIN_SUCCESS",
    "AUTH_LOGIN_FAILED",
    "AUTH_LOGOUT",
    "EMAIL_VERIFICATION_REQUESTED",
    "EMAIL_VERIFICATION_SENT",
    "EMAIL_VERIFICATION_CONFIRMED",
    "EMAIL_VERIFICATION_FAILED",
    "EMAIL_VERIFICATION_TOKEN_EXPIRED",
    "EMAIL_VERIFICATION_TOKEN_REUSED",
    "FEATURE_FLAG_READ_ADMIN",
    "USER_STATUS_CHANGED",
    "ASSET_STATUS_CHANGED",
    "MARKET_STATUS_CHANGED",
    "FEE_SETTINGS_UPDATED",
    "ADMIN_AIRDROP_CREATED",
    "ADMIN_WALLET_TRANSFER_CREATED",
  ]) {
    if (!eventTypes.has(expectedEventType)) {
      throw new Error(`Expected security event coverage to include ${expectedEventType}.`);
    }
  }

  const serializedEvents = JSON.stringify(response.events ?? []);
  for (const forbidden of [testPassword, adminPassword, "passwordHash", "Bearer "]) {
    if (serializedEvents.includes(forbidden)) {
      throw new Error(`Security event responses should not expose forbidden value: ${forbidden}`);
    }
  }

  console.log("PASS v1.0.1 security event coverage");
}

async function testWebBuild() {
  const previousWebNextEnv = await readFile(webNextEnvPath, "utf8");
  const previousWebTsconfig = await readFile(webTsconfigPath, "utf8");

  await rm(smokeNextDistPath, { recursive: true, force: true });

  try {
    await execPnpm(["--filter", "@sw-exchange/web", "build"], {
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

async function getLatestEmailVerificationTokenRow(userId: string) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query<{
      email: string;
      token_hash: string;
      purpose: string;
      used_at: string | null;
    }>(
      `
        select email, token_hash, purpose, used_at
        from email_verification_tokens
        where user_id = $1
        order by created_at desc
        limit 1
      `,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      email: row.email,
      tokenHash: row.token_hash,
      purpose: row.purpose,
      usedAt: row.used_at,
    };
  } finally {
    await client.end();
  }
}

async function insertEmailVerificationToken(
  userId: string,
  email: string,
  rawToken: string,
  expiresInMinutes: number,
) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(
      `
        insert into email_verification_tokens (
          user_id,
          email,
          token_hash,
          purpose,
          expires_at,
          created_at
        )
        values ($1, $2, $3, 'VERIFY_EMAIL', now() + ($4 * interval '1 minute'), now())
      `,
      [userId, email, hashEmailVerificationToken(rawToken), expiresInMinutes],
    );
  } finally {
    await client.end();
  }
}

function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
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

async function fetchJson<T>(url: string, label: string) {
  const response = await fetch(url);
  assertOk(response, label);
  return (await response.json()) as T;
}

async function postJson<T>(url: string, accessToken: string, body: unknown, label: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  assertOk(response, label);
  return (await response.json()) as T;
}

async function expectGetJsonOk(url: string, accessToken: string, label: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assertOk(response, label);
  await response.json();
}

async function expectGetRejected(
  url: string,
  accessToken: string,
  expectedStatus: number,
  label: string,
) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${label} should fail with status ${expectedStatus}, got ${response.status}.`);
  }
}

async function expectPublicGetRejected(url: string, expectedStatus: number, label: string) {
  const response = await fetch(url);
  if (response.status !== expectedStatus) {
    throw new Error(`${label} should fail with status ${expectedStatus}, got ${response.status}.`);
  }

  const { hasStack } = await readErrorPayload(response);
  if (hasStack) {
    throw new Error(`${label} should not expose stack traces.`);
  }
}

async function expectPostJsonRejected(
  url: string,
  accessToken: string,
  body: unknown,
  expectedStatus: number,
  expectedMessage: string,
  label: string,
) {
  await expectJsonRejected("POST", url, accessToken, body, expectedStatus, expectedMessage, label);
}

async function expectPatchJsonRejected(
  url: string,
  accessToken: string,
  body: unknown,
  expectedStatus: number,
  expectedMessage: string,
  label: string,
) {
  await expectJsonRejected("PATCH", url, accessToken, body, expectedStatus, expectedMessage, label);
}

async function expectJsonRejected(
  method: "POST" | "PATCH",
  url: string,
  accessToken: string,
  body: unknown,
  expectedStatus: number,
  expectedMessage: string,
  label: string,
) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (response.status !== expectedStatus) {
    throw new Error(`${label} should fail with status ${expectedStatus}, got ${response.status}.`);
  }

  const { message, hasStack } = await readErrorPayload(response);
  if (message !== expectedMessage) {
    throw new Error(`${label} should return ${expectedMessage}, got ${message ?? "no message"}.`);
  }
  if (hasStack) {
    throw new Error(`${label} should not expose stack traces.`);
  }
}

async function expectLoginRejected(identifier: string, password: string, label: string) {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  if (response.status !== 401) {
    throw new Error(`${label} should fail with status 401, got ${response.status}.`);
  }
}

async function readErrorPayload(response: Response) {
  const text = await response.text();
  if (!text) {
    return { message: null, hasStack: false };
  }

  try {
    const payload = JSON.parse(text) as { message?: unknown; stack?: unknown };
    if (typeof payload.message === "string") {
      return { message: payload.message, hasStack: "stack" in payload };
    }

    if (Array.isArray(payload.message)) {
      return {
        message: payload.message.filter((item) => typeof item === "string").join(" "),
        hasStack: "stack" in payload,
      };
    }
  } catch {
    return { message: null, hasStack: false };
  }

  return { message: null, hasStack: false };
}

async function expectForbidden(url: string, accessToken: string, label: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (response.status !== 403) {
    throw new Error(`${label} should be forbidden, got status ${response.status}`);
  }
}

async function expectAdminControlRejectedForNonAdmin(
  userAccessToken: string,
  adminAccessToken: string,
  targetUsername: string,
) {
  await expectForbidden(`${apiBaseUrl}/admin/users`, userAccessToken, "non-admin list users");

  await expectPatchJsonRejected(
    `${apiBaseUrl}/admin/assets/SWL/status`,
    userAccessToken,
    { status: "PAUSED", note: "Smoke non-admin asset control rejection" },
    403,
    "Forbidden resource",
    "non-admin asset status update",
  );

  await expectPatchJsonRejected(
    `${apiBaseUrl}/admin/markets/${encodeURIComponent("SWL/SWC")}/status`,
    userAccessToken,
    { status: "PAUSED", note: "Smoke non-admin market control rejection" },
    403,
    "Forbidden resource",
    "non-admin market status update",
  );

  const adminUsersList = await getJson<Array<{ id: string; username: string; status: string }>>(
    `${apiBaseUrl}/admin/users`,
    adminAccessToken,
    `load admin users for ${targetUsername}`,
  );
  const targetUser = adminUsersList.find((user) => user.username === targetUsername);
  if (!targetUser) {
    throw new Error(`Expected admin users to include ${targetUsername}.`);
  }

  await expectPatchJsonRejected(
    `${apiBaseUrl}/admin/users/${targetUser.id}/status`,
    userAccessToken,
    { status: "FROZEN", note: "Smoke non-admin user control rejection" },
    403,
    "Forbidden resource",
    "non-admin user status update",
  );
}

async function resetV08OperationalControls(adminAccessToken: string) {
  await setAssetStatus(adminAccessToken, "SWC", "ACTIVE", "Smoke v0.8 reset SWC active");
  await setAssetStatus(adminAccessToken, "SWL", "ACTIVE", "Smoke v0.8 reset SWL active");
  await setMarketStatus(adminAccessToken, "SWL/SWC", "ACTIVE", "Smoke v0.8 reset market active");
}

async function setUserStatus(
  adminAccessToken: string,
  username: string,
  status: "ACTIVE" | "FROZEN" | "BANNED",
  note: string,
) {
  const adminUsersList = await getJson<Array<{ id: string; username: string; status: string }>>(
    `${apiBaseUrl}/admin/users`,
    adminAccessToken,
    `load admin users for ${username}`,
  );
  const targetUser = adminUsersList.find((user) => user.username === username);
  if (!targetUser) {
    throw new Error(`Expected admin users to include ${username}.`);
  }

  const response = await fetch(`${apiBaseUrl}/admin/users/${targetUser.id}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminAccessToken}`,
    },
    body: JSON.stringify({ status, note }),
  });
  assertOk(response, `update ${username} status to ${status}`);
}

async function setAssetStatus(
  adminAccessToken: string,
  symbol: "SWC" | "SWL",
  status: "ACTIVE" | "PAUSED",
  note: string,
) {
  const response = await fetch(`${apiBaseUrl}/admin/assets/${symbol}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminAccessToken}`,
    },
    body: JSON.stringify({ status, note }),
  });
  assertOk(response, `update ${symbol} status to ${status}`);
}

async function setMarketStatus(
  adminAccessToken: string,
  marketSymbol: "SWL/SWC",
  status: "ACTIVE" | "PAUSED",
  note: string,
) {
  const response = await fetch(`${apiBaseUrl}/admin/markets/${encodeURIComponent(marketSymbol)}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${adminAccessToken}`,
    },
    body: JSON.stringify({ status, note }),
  });
  assertOk(response, `update ${marketSymbol} status to ${status}`);
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

async function feeSettingsForMarket(accessToken: string, marketSymbol: string) {
  return getJson<{
    marketSymbol: string;
    buyerFeeRatePercent: string;
    sellerFeeRatePercent: string;
    feeWallet: {
      balances: Array<{ asset: string; availableRaw: string }>;
    };
  }>(
    `${apiBaseUrl}/admin/fee-settings?marketSymbol=${encodeURIComponent(marketSymbol)}`,
    accessToken,
    `load fee settings for ${marketSymbol}`,
  );
}

async function setFeeSettings(
  accessToken: string,
  marketSymbol: string,
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
      marketSymbol,
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
  marketSymbol: string,
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
      marketSymbol,
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

function nextSmokeSymbol(prefix: string) {
  smokeSymbolCounter += 1;
  const normalizedPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "S";
  const suffix = `${smokeRunId}${smokeSymbolCounter.toString(36).toUpperCase()}`.replace(/[^A-Z0-9]/g, "");
  return `${normalizedPrefix}${suffix}`.slice(0, 16);
}

async function createSmokeMarket(
  adminAccessToken: string,
  options: {
    prefix: string;
    name: string;
    description: string;
    minOrderAmount?: string;
    minNotional?: string;
  },
) {
  const assetSymbol = nextSmokeSymbol(options.prefix);
  const marketSymbol = `${assetSymbol}/SWC`;

  await postJson(
    `${apiBaseUrl}/admin/assets`,
    adminAccessToken,
    {
      symbol: assetSymbol,
      name: options.name,
      displayName: options.name,
      decimals: 18,
      status: "ACTIVE",
      description: options.description,
    },
    `create smoke asset ${assetSymbol}`,
  );

  await postJson(
    `${apiBaseUrl}/admin/markets`,
    adminAccessToken,
    {
      baseAssetSymbol: assetSymbol,
      quoteAssetSymbol: "SWC",
      status: "ACTIVE",
      pricePrecision: 18,
      amountPrecision: 18,
      minOrderAmount: options.minOrderAmount ?? "0.1",
      minNotional: options.minNotional ?? "1",
    },
    `create smoke market ${marketSymbol}`,
  );

  return {
    assetSymbol,
    marketSymbol,
    marketQuery: encodeURIComponent(marketSymbol),
  };
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

type MarketOrderSmokeResponse = {
  id: string;
  status: string;
  side: string;
  type: "MARKET";
  amount: string;
  filledAmount: string;
  remainingAmount: string;
  spentQuoteAmount: string;
  receivedQuoteAmount: string | null;
  cancelledQuoteAmount: string | null;
  cancelledAmount: string | null;
  averagePrice: string | null;
  tradeCount: number;
  warning: string | null;
};

async function createMarketOrder(
  accessToken: string,
  marketSymbol: string,
  side: "BUY" | "SELL",
  input: { quoteAmount?: string; amount?: string },
) {
  const response = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ marketSymbol, side, type: "MARKET", ...input }),
  });
  assertOk(response, `create ${side} market order`);
  return (await response.json()) as MarketOrderSmokeResponse;
}

async function previewMarketOrder(
  accessToken: string,
  marketSymbol: string,
  side: "BUY" | "SELL",
  input: { quoteAmount?: string; amount?: string },
) {
  const response = await fetch(`${apiBaseUrl}/orders/preview`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ marketSymbol, side, type: "MARKET", ...input }),
  });
  assertOk(response, `preview ${side} market order`);
  return (await response.json()) as {
    liquidityStatus: "FULL" | "PARTIAL" | "NONE";
    estimatedAveragePrice: string | null;
    estimatedTradeCount: number;
    warning: string | null;
  };
}

async function expectMarketOrderRejected(
  accessToken: string,
  marketSymbol: string,
  side: "BUY" | "SELL",
  input: { quoteAmount?: string; amount?: string },
) {
  const response = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ marketSymbol, side, type: "MARKET", ...input }),
  });
  if (response.status !== 400) {
    throw new Error(`Expected no-liquidity ${side} market order to be rejected with 400, got ${response.status}.`);
  }
  const { message, hasStack } = await readErrorPayload(response);
  if (message !== "NO_LIQUIDITY") {
    throw new Error(`Expected market order rejection message NO_LIQUIDITY, got ${message ?? "no message"}.`);
  }
  if (hasStack) {
    throw new Error("Market order rejection should not expose stack traces.");
  }
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

async function adminTradesByMarket(accessToken: string, marketSymbol: string) {
  return getJson<
    Array<{
      id: string;
      marketSymbol: string;
      price: string;
      amount: string;
      buyerFee: string;
      sellerFee: string;
      seller: { username: string };
      buyer: { username: string };
    }>
  >(
    `${apiBaseUrl}/admin/trades?marketSymbol=${encodeURIComponent(marketSymbol)}`,
    accessToken,
    `load admin trades for ${marketSymbol}`,
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

function expectMarketOrderResponse(
  order: MarketOrderSmokeResponse,
  expectedStatus: string,
  expectedFilled: string,
  expectedRemaining: string,
  expectedSpentQuote: string,
  expectedAveragePrice: string,
  expectedTradeCount: number,
) {
  expectTradeResponse(order, expectedStatus, expectedFilled, expectedRemaining);
  if (
    order.spentQuoteAmount !== expectedSpentQuote ||
    order.averagePrice !== expectedAveragePrice ||
    order.tradeCount !== expectedTradeCount
  ) {
    throw new Error(`Unexpected market order response: ${JSON.stringify(order)}`);
  }
}

async function expectOrderBookEmpty(accessToken: string, marketQuery: string, label: string) {
  const orderBook = await getJson<{
    bids: Array<{ priceRaw: string; amountRaw: string }>;
    asks: Array<{ priceRaw: string; amountRaw: string }>;
  }>(`${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`, accessToken, `load order book after ${label}`);
  if (orderBook.bids.length !== 0 || orderBook.asks.length !== 0) {
    throw new Error(`Order book should be empty after ${label}.`);
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

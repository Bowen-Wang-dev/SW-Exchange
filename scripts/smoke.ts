import { config as loadEnv } from "dotenv";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "pg";

loadEnv({ path: ".env" });

const execFileAsync = promisify(execFile);
const apiBaseUrl = "http://127.0.0.1:3001/api";
const webBaseUrl = "http://127.0.0.1:3000";
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

const publicWebRoutes = [
  "/",
  "/login",
  "/register",
  "/markets",
];

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
  await testV05OrderFlow(auth);
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

    const wallets = await client.query<{ symbol: string }>(
      `
        select a.symbol
        from wallets w
        join users u on u.id = w.user_id
        join assets a on a.id = w.asset_id
        where u.email = $1
        order by a.symbol
      `,
      [adminEmail],
    );
    expectValues(
      wallets.rows.map((row) => row.symbol),
      ["SWC", "SWL"],
      "admin wallets",
    );
  } finally {
    await client.end();
  }

  console.log("PASS seeded data");
}

async function testAuthFlows() {
  const sender = await registerUser(testEmail, testUsername, "Smoke Sender");
  const receiver = await registerUser(receiverEmail, receiverUsername, "Smoke Receiver");

  const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: {
      authorization: `Bearer ${sender.accessToken}`,
    },
  });
  assertOk(meResponse, "load current user");
  const meJson = (await meResponse.json()) as {
    user?: { role?: string; email?: string; username?: string };
  };
  if (meJson.user?.role !== "USER" || meJson.user?.email !== testEmail) {
    throw new Error(`Unexpected /auth/me payload: ${JSON.stringify(meJson)}`);
  }

  const userLoginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword,
    }),
  });
  assertOk(userLoginResponse, "login normal user");
  const userLoginJson = (await userLoginResponse.json()) as {
    accessToken?: string;
    user?: { role?: string };
  };
  if (!userLoginJson.accessToken || userLoginJson.user?.role !== "USER") {
    throw new Error(`Unexpected user login payload: ${JSON.stringify(userLoginJson)}`);
  }

  const receiverLoginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: receiverEmail,
      password: testPassword,
    }),
  });
  assertOk(receiverLoginResponse, "login receiver user");
  const receiverLoginJson = (await receiverLoginResponse.json()) as {
    accessToken?: string;
    user?: { role?: string };
  };
  if (!receiverLoginJson.accessToken || receiverLoginJson.user?.role !== "USER") {
    throw new Error(`Unexpected receiver login payload: ${JSON.stringify(receiverLoginJson)}`);
  }

  const adminLoginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: adminEmail,
      password: adminPassword,
    }),
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
    userAccessToken: userLoginJson.accessToken,
    receiverAccessToken: receiverLoginJson.accessToken,
    adminAccessToken: adminLoginJson.accessToken,
    user: {
      email: testEmail,
      username: testUsername,
    },
    receiver: {
      email: receiverEmail,
      username: receiverUsername,
    },
  };
}

async function registerUser(email: string, username: string, nickname: string) {
  const registerResponse = await fetch(`${apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      username,
      nickname,
      password: testPassword,
    }),
  });
  assertOk(registerResponse, `register normal user ${username}`);
  const registerJson = (await registerResponse.json()) as {
    accessToken?: string;
    user?: { role?: string; email?: string; username?: string };
  };
  if (!registerJson.accessToken || registerJson.user?.role !== "USER") {
    throw new Error(`Unexpected register payload: ${JSON.stringify(registerJson)}`);
  }

  return {
    accessToken: registerJson.accessToken,
    user: registerJson.user,
  };
}

async function testV03AirdropFlow(auth: {
  userAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
}) {
  const beforeWallets = await getJson<Array<{ asset: string; availableRaw: string }>>(
    `${apiBaseUrl}/wallets/me`,
    auth.userAccessToken,
    "load user wallets before airdrop",
  );
  const beforeSwc = beforeWallets.find((wallet) => wallet.asset === "SWC");
  if (!beforeSwc) {
    throw new Error("Expected normal user to have a SWC wallet before airdrop.");
  }

  const airdropResponse = await fetch(`${apiBaseUrl}/admin/airdrop`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.adminAccessToken}`,
    },
    body: JSON.stringify({
      username: auth.user.username,
      assetSymbol: "SWC",
      amount: "1000",
      note: "Smoke v0.4 airdrop",
    }),
  });
  assertOk(airdropResponse, "admin airdrop");
  const airdropJson = (await airdropResponse.json()) as {
    ledgerEntryId?: string;
    auditLogId?: string;
    newAvailableRaw?: string;
  };

  if (!airdropJson.ledgerEntryId || !airdropJson.auditLogId || !airdropJson.newAvailableRaw) {
    throw new Error(`Unexpected airdrop payload: ${JSON.stringify(airdropJson)}`);
  }

  const expectedDelta = 1000n * 10n ** 18n;
  const expectedAvailable = BigInt(beforeSwc.availableRaw) + expectedDelta;
  if (BigInt(airdropJson.newAvailableRaw) !== expectedAvailable) {
    throw new Error("Airdrop response did not return the expected new available balance.");
  }

  const afterWallets = await getJson<Array<{ asset: string; availableRaw: string }>>(
    `${apiBaseUrl}/wallets/me`,
    auth.userAccessToken,
    "load user wallets after airdrop",
  );
  const afterSwc = afterWallets.find((wallet) => wallet.asset === "SWC");
  if (!afterSwc || BigInt(afterSwc.availableRaw) !== expectedAvailable) {
    throw new Error("User SWC wallet did not reflect the airdrop.");
  }

  const userLedger = await getJson<Array<{ id: string; type: string; asset: string; amountRaw: string }>>(
    `${apiBaseUrl}/ledger/me`,
    auth.userAccessToken,
    "load user ledger",
  );
  const userAirdropEntry = userLedger.find((entry) => entry.id === airdropJson.ledgerEntryId);
  if (!userAirdropEntry || userAirdropEntry.type !== "AIRDROP" || userAirdropEntry.asset !== "SWC") {
    throw new Error("User ledger did not include the expected AIRDROP entry.");
  }

  const adminLedger = await getJson<Array<{ id: string; type: string }>>(
    `${apiBaseUrl}/admin/ledger`,
    auth.adminAccessToken,
    "load admin ledger",
  );
  if (!adminLedger.some((entry) => entry.id === airdropJson.ledgerEntryId && entry.type === "AIRDROP")) {
    throw new Error("Admin ledger did not include the expected AIRDROP entry.");
  }

  const auditLogs = await getJson<Array<{ id: string; action: string }>>(
    `${apiBaseUrl}/admin/audit-logs`,
    auth.adminAccessToken,
    "load admin audit logs",
  );
  if (!auditLogs.some((log) => log.id === airdropJson.auditLogId && log.action === "AIRDROP")) {
    throw new Error("Admin audit logs did not include the expected AIRDROP action.");
  }

  console.log("PASS airdrop, wallets, ledger, and audit flow");
}

async function testV04TransferFlow(auth: {
  userAccessToken: string;
  receiverAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const senderWalletsBefore = await getJson<Array<{ asset: string; availableRaw: string }>>(
    `${apiBaseUrl}/wallets/me`,
    auth.userAccessToken,
    "load sender wallets before transfer",
  );
  const receiverWalletsBefore = await getJson<Array<{ asset: string; availableRaw: string }>>(
    `${apiBaseUrl}/wallets/me`,
    auth.receiverAccessToken,
    "load receiver wallets before transfer",
  );

  const senderSwcBefore = senderWalletsBefore.find((wallet) => wallet.asset === "SWC");
  const receiverSwcBefore = receiverWalletsBefore.find((wallet) => wallet.asset === "SWC");
  if (!senderSwcBefore || !receiverSwcBefore) {
    throw new Error("Expected both transfer smoke users to have SWC wallets.");
  }

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
  if (!transferJson.id || !transferJson.senderNewAvailableRaw || !transferJson.recipientNewAvailableRaw) {
    throw new Error(`Unexpected transfer payload: ${JSON.stringify(transferJson)}`);
  }

  const transferAmount = 100n * 10n ** 18n;
  const expectedSenderAvailable = BigInt(senderSwcBefore.availableRaw) - transferAmount;
  const expectedReceiverAvailable = BigInt(receiverSwcBefore.availableRaw) + transferAmount;

  if (BigInt(transferJson.senderNewAvailableRaw) !== expectedSenderAvailable) {
    throw new Error("Transfer response did not return the expected sender balance.");
  }

  if (BigInt(transferJson.recipientNewAvailableRaw) !== expectedReceiverAvailable) {
    throw new Error("Transfer response did not return the expected receiver balance.");
  }

  const senderWalletsAfter = await getJson<Array<{ asset: string; availableRaw: string }>>(
    `${apiBaseUrl}/wallets/me`,
    auth.userAccessToken,
    "load sender wallets after transfer",
  );
  const receiverWalletsAfter = await getJson<Array<{ asset: string; availableRaw: string }>>(
    `${apiBaseUrl}/wallets/me`,
    auth.receiverAccessToken,
    "load receiver wallets after transfer",
  );

  const senderSwcAfter = senderWalletsAfter.find((wallet) => wallet.asset === "SWC");
  const receiverSwcAfter = receiverWalletsAfter.find((wallet) => wallet.asset === "SWC");
  if (!senderSwcAfter || BigInt(senderSwcAfter.availableRaw) !== expectedSenderAvailable) {
    throw new Error("Sender SWC wallet did not reflect the internal transfer.");
  }
  if (!receiverSwcAfter || BigInt(receiverSwcAfter.availableRaw) !== expectedReceiverAvailable) {
    throw new Error("Receiver SWC wallet did not reflect the internal transfer.");
  }

  const senderLedger = await getJson<Array<{ type: string; refId: string | null; amountRaw: string }>>(
    `${apiBaseUrl}/ledger/me`,
    auth.userAccessToken,
    "load sender ledger after transfer",
  );
  if (
    !senderLedger.some(
      (entry) =>
        entry.refId === transferJson.id &&
        entry.type === "TRANSFER_OUT" &&
        BigInt(entry.amountRaw) === -transferAmount,
    )
  ) {
    throw new Error("Sender ledger did not include the expected TRANSFER_OUT entry.");
  }

  const receiverLedger = await getJson<Array<{ type: string; refId: string | null; amountRaw: string }>>(
    `${apiBaseUrl}/ledger/me`,
    auth.receiverAccessToken,
    "load receiver ledger after transfer",
  );
  if (
    !receiverLedger.some(
      (entry) =>
        entry.refId === transferJson.id &&
        entry.type === "TRANSFER_IN" &&
        BigInt(entry.amountRaw) === transferAmount,
    )
  ) {
    throw new Error("Receiver ledger did not include the expected TRANSFER_IN entry.");
  }

  const adminTransfers = await getJson<Array<{ id: string; status: string }>>(
    `${apiBaseUrl}/admin/transfers`,
    auth.adminAccessToken,
    "load admin transfers",
  );
  if (!adminTransfers.some((transfer) => transfer.id === transferJson.id && transfer.status === "SUCCESS")) {
    throw new Error("Admin transfer list did not include the expected transfer.");
  }

  console.log("PASS v0.4 internal transfer, balances, ledger, and admin transfer list");
}

async function testV05OrderFlow(auth: {
  userAccessToken: string;
  receiverAccessToken: string;
  adminAccessToken: string;
  user: { email: string; username: string };
  receiver: { email: string; username: string };
}) {
  const unit = 10n ** 18n;
  const buyAmount = 10n * unit;
  const buyLock = 20n * unit;
  const sellAmount = 5n * unit;
  const marketSymbol = "SWL/SWC";
  const marketQuery = encodeURIComponent(marketSymbol);

  const receiverWalletsBeforeAirdrop = await getJson<
    Array<{ asset: string; availableRaw: string; lockedRaw: string }>
  >(`${apiBaseUrl}/wallets/me`, auth.receiverAccessToken, "load receiver wallets before SWL airdrop");
  const receiverSwlBeforeAirdrop = findWallet(receiverWalletsBeforeAirdrop, "SWL");

  const swlAirdropResponse = await fetch(`${apiBaseUrl}/admin/airdrop`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.adminAccessToken}`,
    },
    body: JSON.stringify({
      username: auth.receiver.username,
      assetSymbol: "SWL",
      amount: "100",
      note: "Smoke v0.5 sell funding",
    }),
  });
  assertOk(swlAirdropResponse, "admin SWL airdrop for order smoke");

  const senderWalletsBeforeBuy = await getJson<
    Array<{ asset: string; availableRaw: string; lockedRaw: string }>
  >(`${apiBaseUrl}/wallets/me`, auth.userAccessToken, "load sender wallets before buy order");
  const senderSwcBeforeBuy = findWallet(senderWalletsBeforeBuy, "SWC");
  const orderBookBeforeBuy = await getJson<{
    bids: Array<{ priceRaw: string; amountRaw: string }>;
    asks: Array<{ priceRaw: string; amountRaw: string }>;
  }>(`${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`, auth.userAccessToken, "load order book before buy");
  const bidAmountBeforeBuy = findBookAmount(orderBookBeforeBuy.bids, 2n * unit);

  const buyOrderResponse = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.userAccessToken}`,
    },
    body: JSON.stringify({
      marketSymbol,
      side: "BUY",
      price: "2",
      amount: "10",
    }),
  });
  assertOk(buyOrderResponse, "create BUY limit order");
  const buyOrder = (await buyOrderResponse.json()) as {
    id?: string;
    side?: string;
    status?: string;
    lockedAssetSymbol?: string;
    lockedAmountRaw?: string;
    remainingAmountRaw?: string;
  };

  if (
    !buyOrder.id ||
    buyOrder.side !== "BUY" ||
    buyOrder.status !== "OPEN" ||
    buyOrder.lockedAssetSymbol !== "SWC" ||
    BigInt(buyOrder.lockedAmountRaw ?? "0") !== buyLock ||
    BigInt(buyOrder.remainingAmountRaw ?? "0") !== buyAmount
  ) {
    throw new Error(`Unexpected BUY order payload: ${JSON.stringify(buyOrder)}`);
  }

  const senderWalletsAfterBuy = await getJson<
    Array<{ asset: string; availableRaw: string; lockedRaw: string }>
  >(`${apiBaseUrl}/wallets/me`, auth.userAccessToken, "load sender wallets after buy order");
  const senderSwcAfterBuy = findWallet(senderWalletsAfterBuy, "SWC");
  if (BigInt(senderSwcAfterBuy.availableRaw) !== BigInt(senderSwcBeforeBuy.availableRaw) - buyLock) {
    throw new Error("BUY order did not decrease sender SWC available balance by the locked total.");
  }
  if (BigInt(senderSwcAfterBuy.lockedRaw) !== BigInt(senderSwcBeforeBuy.lockedRaw) + buyLock) {
    throw new Error("BUY order did not increase sender SWC locked balance by the locked total.");
  }

  const orderBookAfterBuy = await getJson<{ bids: Array<{ priceRaw: string; amountRaw: string }> }>(
    `${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`,
    auth.userAccessToken,
    "load order book after buy",
  );
  if (findBookAmount(orderBookAfterBuy.bids, 2n * unit) !== bidAmountBeforeBuy + buyAmount) {
    throw new Error("Order book bid level did not include the BUY order amount.");
  }

  const senderOpenOrders = await getJson<Array<{ id: string; status: string }>>(
    `${apiBaseUrl}/orders/me?status=OPEN&marketSymbol=${marketQuery}`,
    auth.userAccessToken,
    "load sender open orders",
  );
  if (!senderOpenOrders.some((order) => order.id === buyOrder.id && order.status === "OPEN")) {
    throw new Error("GET /orders/me did not include the BUY order.");
  }

  const senderOrderLedger = await getJson<Array<{ type: string; refId: string | null; amountRaw: string }>>(
    `${apiBaseUrl}/ledger/me`,
    auth.userAccessToken,
    "load sender ledger after order lock",
  );
  if (
    !senderOrderLedger.some(
      (entry) =>
        entry.refId === buyOrder.id &&
        entry.type === "ORDER_LOCK" &&
        BigInt(entry.amountRaw) === -buyLock,
    )
  ) {
    throw new Error("Sender ledger did not include the expected ORDER_LOCK entry.");
  }

  const cancelBuyResponse = await fetch(`${apiBaseUrl}/orders/${buyOrder.id}/cancel`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth.userAccessToken}`,
    },
  });
  assertOk(cancelBuyResponse, "cancel BUY order");
  const cancelledBuy = (await cancelBuyResponse.json()) as { status?: string };
  if (cancelledBuy.status !== "CANCELLED") {
    throw new Error(`Unexpected cancelled BUY payload: ${JSON.stringify(cancelledBuy)}`);
  }

  const senderWalletsAfterCancel = await getJson<
    Array<{ asset: string; availableRaw: string; lockedRaw: string }>
  >(`${apiBaseUrl}/wallets/me`, auth.userAccessToken, "load sender wallets after buy cancel");
  const senderSwcAfterCancel = findWallet(senderWalletsAfterCancel, "SWC");
  if (BigInt(senderSwcAfterCancel.availableRaw) !== BigInt(senderSwcBeforeBuy.availableRaw)) {
    throw new Error("BUY cancel did not restore sender SWC available balance.");
  }
  if (BigInt(senderSwcAfterCancel.lockedRaw) !== BigInt(senderSwcBeforeBuy.lockedRaw)) {
    throw new Error("BUY cancel did not restore sender SWC locked balance.");
  }

  const orderBookAfterCancel = await getJson<{ bids: Array<{ priceRaw: string; amountRaw: string }> }>(
    `${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`,
    auth.userAccessToken,
    "load order book after buy cancel",
  );
  if (findBookAmount(orderBookAfterCancel.bids, 2n * unit) !== bidAmountBeforeBuy) {
    throw new Error("Order book bid level did not remove the cancelled BUY order.");
  }

  const senderLedgerAfterCancel = await getJson<Array<{ type: string; refId: string | null; amountRaw: string }>>(
    `${apiBaseUrl}/ledger/me`,
    auth.userAccessToken,
    "load sender ledger after order unlock",
  );
  if (
    !senderLedgerAfterCancel.some(
      (entry) =>
        entry.refId === buyOrder.id &&
        entry.type === "ORDER_UNLOCK" &&
        BigInt(entry.amountRaw) === buyLock,
    )
  ) {
    throw new Error("Sender ledger did not include the expected ORDER_UNLOCK entry.");
  }

  const receiverWalletsBeforeSell = await getJson<
    Array<{ asset: string; availableRaw: string; lockedRaw: string }>
  >(`${apiBaseUrl}/wallets/me`, auth.receiverAccessToken, "load receiver wallets before sell order");
  const receiverSwlBeforeSell = findWallet(receiverWalletsBeforeSell, "SWL");
  if (BigInt(receiverSwlBeforeSell.availableRaw) !== BigInt(receiverSwlBeforeAirdrop.availableRaw) + 100n * unit) {
    throw new Error("Receiver SWL airdrop did not fund the expected sell balance.");
  }

  const orderBookBeforeSell = await getJson<{ asks: Array<{ priceRaw: string; amountRaw: string }> }>(
    `${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`,
    auth.receiverAccessToken,
    "load order book before sell",
  );
  const askAmountBeforeSell = findBookAmount(orderBookBeforeSell.asks, 3n * unit);

  const sellOrderResponse = await fetch(`${apiBaseUrl}/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.receiverAccessToken}`,
    },
    body: JSON.stringify({
      marketSymbol,
      side: "SELL",
      price: "3",
      amount: "5",
    }),
  });
  assertOk(sellOrderResponse, "create SELL limit order");
  const sellOrder = (await sellOrderResponse.json()) as {
    id?: string;
    side?: string;
    status?: string;
    lockedAssetSymbol?: string;
    lockedAmountRaw?: string;
  };
  if (
    !sellOrder.id ||
    sellOrder.side !== "SELL" ||
    sellOrder.status !== "OPEN" ||
    sellOrder.lockedAssetSymbol !== "SWL" ||
    BigInt(sellOrder.lockedAmountRaw ?? "0") !== sellAmount
  ) {
    throw new Error(`Unexpected SELL order payload: ${JSON.stringify(sellOrder)}`);
  }

  const receiverWalletsAfterSell = await getJson<
    Array<{ asset: string; availableRaw: string; lockedRaw: string }>
  >(`${apiBaseUrl}/wallets/me`, auth.receiverAccessToken, "load receiver wallets after sell order");
  const receiverSwlAfterSell = findWallet(receiverWalletsAfterSell, "SWL");
  if (BigInt(receiverSwlAfterSell.availableRaw) !== BigInt(receiverSwlBeforeSell.availableRaw) - sellAmount) {
    throw new Error("SELL order did not decrease receiver SWL available balance.");
  }
  if (BigInt(receiverSwlAfterSell.lockedRaw) !== BigInt(receiverSwlBeforeSell.lockedRaw) + sellAmount) {
    throw new Error("SELL order did not increase receiver SWL locked balance.");
  }

  const orderBookAfterSell = await getJson<{ asks: Array<{ priceRaw: string; amountRaw: string }> }>(
    `${apiBaseUrl}/order-book?marketSymbol=${marketQuery}`,
    auth.receiverAccessToken,
    "load order book after sell",
  );
  if (findBookAmount(orderBookAfterSell.asks, 3n * unit) !== askAmountBeforeSell + sellAmount) {
    throw new Error("Order book ask level did not include the SELL order amount.");
  }

  const adminOrders = await getJson<Array<{ id: string; status: string }>>(
    `${apiBaseUrl}/admin/orders`,
    auth.adminAccessToken,
    "load admin orders",
  );
  if (!adminOrders.some((order) => order.id === buyOrder.id && order.status === "CANCELLED")) {
    throw new Error("Admin order list did not include the cancelled BUY order.");
  }
  if (!adminOrders.some((order) => order.id === sellOrder.id && order.status === "OPEN")) {
    throw new Error("Admin order list did not include the open SELL order.");
  }

  const adminLedger = await getJson<Array<{ type: string; refId: string | null }>>(
    `${apiBaseUrl}/admin/ledger`,
    auth.adminAccessToken,
    "load admin ledger after orders",
  );
  if (!adminLedger.some((entry) => entry.refId === buyOrder.id && entry.type === "ORDER_UNLOCK")) {
    throw new Error("Admin ledger did not include the BUY order unlock entry.");
  }
  if (!adminLedger.some((entry) => entry.refId === sellOrder.id && entry.type === "ORDER_LOCK")) {
    throw new Error("Admin ledger did not include the SELL order lock entry.");
  }

  await expectPostError(
    `${apiBaseUrl}/orders`,
    auth.userAccessToken,
    {
      marketSymbol,
      side: "BUY",
      price: "999999",
      amount: "999999",
    },
    400,
    "insufficient BUY order",
  );
  await expectPostError(
    `${apiBaseUrl}/orders`,
    auth.userAccessToken,
    {
      marketSymbol,
      side: "BUY",
      price: "0",
      amount: "1",
    },
    400,
    "zero price order",
  );
  await expectPostError(
    `${apiBaseUrl}/orders/${sellOrder.id}/cancel`,
    auth.userAccessToken,
    undefined,
    403,
    "cancel someone else's order",
  );

  const cancelSellResponse = await fetch(`${apiBaseUrl}/orders/${sellOrder.id}/cancel`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth.receiverAccessToken}`,
    },
  });
  assertOk(cancelSellResponse, "cancel SELL smoke order");
  await expectPostError(
    `${apiBaseUrl}/orders/${sellOrder.id}/cancel`,
    auth.receiverAccessToken,
    undefined,
    400,
    "cancel order twice",
  );

  console.log("PASS v0.5 limit order lock, cancel, order book, ledger, admin orders, and negatives");
}

async function testWebBuild() {
  await execFileAsync("pnpm", ["--filter", "@sw-exchange/web", "build"], {
    cwd: process.cwd(),
    maxBuffer: 1024 * 1024 * 10,
  });

  console.log("PASS web build");
}

async function testWebRoutes() {
  for (const route of publicWebRoutes) {
    const response = await fetch(`${webBaseUrl}${route}`);
    assertOk(response, `public web route ${route}`);
  }

  for (const route of protectedWebRoutes) {
    const response = await fetch(`${webBaseUrl}${route}`, {
      redirect: "manual",
    });

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
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  assertOk(response, label);
  return (await response.json()) as T;
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

function findBookAmount(levels: Array<{ priceRaw: string; amountRaw: string }>, priceRaw: bigint) {
  const level = levels.find((entry) => BigInt(entry.priceRaw) === priceRaw);
  return BigInt(level?.amountRaw ?? "0");
}

async function expectPostError(
  url: string,
  accessToken: string,
  body: unknown,
  expectedStatus: number,
  label: string,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      authorization: `Bearer ${accessToken}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status !== expectedStatus) {
    throw new Error(`${label} expected status ${expectedStatus}, got ${response.status}`);
  }
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

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

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: ".env" });

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
  await testAuthFlows();
  await testWebRoutes();

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
  const registerResponse = await fetch(`${apiBaseUrl}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      username: testUsername,
      nickname: "Smoke User",
      password: testPassword,
    }),
  });
  assertOk(registerResponse, "register normal user");
  const registerJson = (await registerResponse.json()) as {
    accessToken?: string;
    user?: { role?: string; email?: string; username?: string };
  };
  if (!registerJson.accessToken || registerJson.user?.role !== "USER") {
    throw new Error(`Unexpected register payload: ${JSON.stringify(registerJson)}`);
  }

  const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
    headers: {
      authorization: `Bearer ${registerJson.accessToken}`,
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

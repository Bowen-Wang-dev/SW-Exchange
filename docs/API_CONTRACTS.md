# API Contracts

Base prefix: `/api`

Auth note:

- Public endpoints are explicitly marked in code.
- Examples below focus on stable trading/admin contracts, not full auth flow.
- Numeric amounts and prices are request strings and response strings.

## Common Enums

- Order side: `BUY`, `SELL`
- Order type: `LIMIT`, `MARKET`
- Order status: `OPEN`, `PARTIAL_FILLED`, `FILLED`, `PARTIAL_FILLED_CANCELLED`, `CANCELLED`, `REJECTED`
- User status: `ACTIVE`, `FROZEN`, `BANNED`
- Asset / market status: `ACTIVE`, `PAUSED`
- Wallet type: `MAIN`, `FEE`, `TREASURY`, `AIRDROP`, `HOT`

## GET `/api/feature-flags`

Public.

Response shape:

```json
{
  "flags": [
    {
      "key": "enableDeposits",
      "displayName": "Deposits",
      "description": "Allows deposit-related UI and backend credit workflows.",
      "group": "FUNDING",
      "riskLevel": "CRITICAL",
      "plannedMilestone": "v1.x funding",
      "defaultEnabled": false,
      "enabled": false,
      "source": "database",
      "createdAt": "2026-05-25T00:00:00.000Z",
      "updatedAt": "2026-05-25T00:00:00.000Z"
    }
  ]
}
```

Notes:

- This endpoint exposes safe availability booleans and descriptive metadata only.
- Unknown keys are not listed.

## GET `/api/feature-flags/:key`

Public.

- Returns one flag by canonical key.
- Unknown keys return `404`.

## GET `/api/admin/feature-flags`

Requires admin JWT.

- Returns the same canonical flag set for admin review surfaces.
- Current `v1.0.1` behavior remains read-only; no mutation endpoint is exposed yet.

## GET `/api/admin/security-events`

Requires admin JWT.

Response shape:

```json
{
  "events": [
    {
      "id": "event_uuid",
      "createdAt": "2026-05-25T00:00:00.000Z",
      "actorUserId": "user_uuid",
      "actorRole": "ADMIN",
      "actorUser": {
        "id": "user_uuid",
        "email": "admin@example.com",
        "username": "admin"
      },
      "eventType": "USER_STATUS_CHANGED",
      "severity": "WARNING",
      "targetType": "USER",
      "targetId": "target_uuid",
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0",
      "metadata": {
        "beforeStatus": "ACTIVE",
        "afterStatus": "FROZEN",
        "note": "Manual review hold"
      }
    }
  ]
}
```

Supported simple filters:

- `eventType`
- `severity`
- `actorUserId`
- `targetType`
- `search`
- `limit`

Notes:

- Response metadata is sanitized and must not include raw passwords, JWTs, TOTP secrets, email-verification codes, private keys, or environment secrets.
- Current `v1.0.1` coverage focuses on login outcomes and selected admin actions.

## GET `/api/admin/security-events/:id`

Requires admin JWT.

- Returns one security event by UUID.
- Unknown IDs return `404`.

## GET `/api/admin/security-actions`

Requires admin JWT.

Response shape:

```json
{
  "actions": [
    {
      "key": "REQUEST_WITHDRAWAL",
      "displayName": "Request Withdrawal",
      "severity": "CRITICAL",
      "requiresPasswordReauth": true,
      "requiresEmailVerification": true,
      "requires2FA": true,
      "requiresAdminRole": false,
      "notes": "Planned-only in v1.0.1."
    }
  ]
}
```

Notes:

- This endpoint exposes the planned sensitive-action policy matrix only.
- It does not mean deposit, withdrawal, email verification, or TOTP enforcement is live.

## POST `/api/orders`

Requires JWT.

### LIMIT BUY

Request:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "LIMIT",
  "price": "1.25",
  "amount": "100"
}
```

Response shape:

```json
{
  "id": "order_uuid",
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "LIMIT",
  "status": "OPEN",
  "price": "1.25",
  "amount": "100",
  "filledAmount": "0",
  "remainingAmount": "100",
  "lockedAssetSymbol": "SWC",
  "lockedAmount": "125",
  "spentQuoteAmount": "0"
}
```

### LIMIT SELL

Request:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "SELL",
  "type": "LIMIT",
  "price": "1.40",
  "amount": "25"
}
```

Response shape:

```json
{
  "id": "order_uuid",
  "marketSymbol": "SWL/SWC",
  "side": "SELL",
  "type": "LIMIT",
  "status": "OPEN",
  "price": "1.40",
  "amount": "25",
  "remainingAmount": "25",
  "lockedAssetSymbol": "SWL",
  "lockedAmount": "25"
}
```

### MARKET BUY

Request:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "MARKET",
  "quoteAmount": "300"
}
```

`spendAmount` is also accepted for market BUY.

Response shape:

```json
{
  "id": "order_uuid",
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "MARKET",
  "status": "FILLED",
  "amount": "240",
  "filledAmount": "240",
  "requestedQuoteAmount": "300",
  "spentQuoteAmount": "300",
  "averagePrice": "1.25",
  "tradeCount": 2,
  "feeSummary": {
    "buyerFee": "0.24",
    "buyerFeeAssetSymbol": "SWL",
    "sellerFee": "0.3",
    "sellerFeeAssetSymbol": "SWC"
  },
  "warning": null
}
```

### MARKET SELL

Request:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "SELL",
  "type": "MARKET",
  "amount": "80"
}
```

Response shape:

```json
{
  "id": "order_uuid",
  "marketSymbol": "SWL/SWC",
  "side": "SELL",
  "type": "MARKET",
  "status": "PARTIAL_FILLED_CANCELLED",
  "amount": "80",
  "filledAmount": "50",
  "remainingAmount": "30",
  "spentQuoteAmount": "62.5",
  "receivedQuoteAmount": "62.4375",
  "averagePrice": "1.25",
  "cancelledAmount": "30",
  "tradeCount": 1,
  "warning": "Partially filled. Available liquidity was exhausted and the unfilled remainder was cancelled."
}
```

## POST `/api/orders/preview`

Requires JWT.

### LIMIT preview

Request:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "LIMIT",
  "price": "1.25",
  "amount": "100"
}
```

Response:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "LIMIT",
  "price": "1.25",
  "amount": "100",
  "total": "125",
  "estimatedFee": "0.1",
  "estimatedFeeAssetSymbol": "SWL",
  "mayMatchImmediately": true,
  "warning": "This limit order may immediately match against resting liquidity."
}
```

### MARKET preview

Request:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "MARKET",
  "quoteAmount": "300"
}
```

Response:

```json
{
  "marketSymbol": "SWL/SWC",
  "side": "BUY",
  "type": "MARKET",
  "estimatedFilledAmount": "240",
  "estimatedReceiveAmount": "239.76",
  "estimatedSpentQuote": "300",
  "estimatedAveragePrice": "1.25",
  "estimatedBuyerFee": "0.24",
  "estimatedSellerFee": "0.3",
  "estimatedTradeCount": 2,
  "liquidityStatus": "FULL",
  "warning": null
}
```

## GET `/api/order-book?marketSymbol=SWL/SWC`

Public.

Response:

```json
{
  "marketSymbol": "SWL/SWC",
  "bids": [
    { "price": "1.24", "amount": "120", "orderCount": 2 }
  ],
  "asks": [
    { "price": "1.25", "amount": "90", "orderCount": 1 }
  ]
}
```

## GET `/api/markets/summary`

Public.

Response item:

```json
{
  "marketSymbol": "SWL/SWC",
  "baseAssetSymbol": "SWL",
  "quoteAssetSymbol": "SWC",
  "lastPrice": "1.25",
  "bestBid": "1.24",
  "bestAsk": "1.25",
  "volume24h": "1000",
  "quoteVolume24h": "1250",
  "change24hPercent": "+3.5",
  "openOrderCount": 8,
  "totalTradeCount": 42,
  "status": "ACTIVE"
}
```

## GET `/api/markets/ticker?marketSymbol=SWL/SWC`

Public.

Response:

```json
{
  "marketSymbol": "SWL/SWC",
  "lastPrice": "1.25",
  "bestBid": "1.24",
  "bestAsk": "1.25",
  "high24h": "1.30",
  "low24h": "1.10",
  "volume24h": "1000",
  "quoteVolume24h": "1250",
  "change24h": "+0.05",
  "change24hPercent": "+4.16",
  "tradeCount24h": 12,
  "totalTradeCount": 42,
  "openOrderCount": 8,
  "status": "ACTIVE"
}
```

## GET `/api/markets/candles?marketSymbol=SWL/SWC&interval=1m&limit=100`

Public.

Supported intervals: `1m`, `5m`, `15m`, `1h`, `1d`

Response item:

```json
{
  "marketSymbol": "SWL/SWC",
  "interval": "1m",
  "startTime": "2026-05-25T10:00:00.000Z",
  "endTime": "2026-05-25T10:01:00.000Z",
  "open": "1.20",
  "high": "1.25",
  "low": "1.19",
  "close": "1.25",
  "volume": "250",
  "quoteVolume": "302.5",
  "tradeCount": 3
}
```

## POST `/api/admin/assets`

Requires admin JWT.

Request:

```json
{
  "symbol": "ABC",
  "name": "Alpha Beta Coin",
  "displayName": "ABC",
  "decimals": 18,
  "iconUrl": "https://example.com/abc.png",
  "description": "Internal simulation asset",
  "sortOrder": 40,
  "status": "ACTIVE"
}
```

Response shape:

```json
{
  "id": "asset_uuid",
  "symbol": "ABC",
  "name": "Alpha Beta Coin",
  "displayName": "ABC",
  "status": "ACTIVE",
  "isActive": true,
  "iconUrl": "https://example.com/abc.png"
}
```

## POST `/api/admin/markets`

Requires admin JWT.

Request:

```json
{
  "baseAssetSymbol": "ABC",
  "quoteAssetSymbol": "SWC",
  "symbol": "ABC/SWC",
  "status": "PAUSED",
  "pricePrecision": 18,
  "amountPrecision": 18,
  "minOrderAmount": "1",
  "minNotional": "10"
}
```

Response shape:

```json
{
  "id": "market_uuid",
  "symbol": "ABC/SWC",
  "status": "PAUSED",
  "baseAssetSymbol": "ABC",
  "quoteAssetSymbol": "SWC",
  "priceDecimals": 18,
  "amountDecimals": 18,
  "feeSetting": {
    "marketSymbol": "ABC/SWC",
    "buyerFeeRateBps": 10,
    "sellerFeeRateBps": 10,
    "isActive": true
  }
}
```

## PATCH `/api/admin/assets/:symbol/metadata`

Requires admin JWT.

Request:

```json
{
  "displayName": "Alpha Coin",
  "iconUrl": "https://example.com/alpha.png",
  "description": "Internal listed asset",
  "sortOrder": 50
}
```

## PATCH `/api/admin/users/:id/status`

Requires admin JWT.

Request:

```json
{
  "status": "FROZEN",
  "note": "Manual review"
}
```

## PATCH `/api/admin/assets/:symbol/status`

Requires admin JWT.

Request:

```json
{
  "status": "PAUSED",
  "note": "Operational pause"
}
```

## PATCH `/api/admin/markets/:symbol/status`

Requires admin JWT.

Request:

```json
{
  "status": "PAUSED",
  "note": "Maintenance"
}
```

## POST `/api/admin/airdrop`

Requires admin JWT.

Request:

```json
{
  "username": "alice",
  "assetSymbol": "SWC",
  "amount": "1000",
  "note": "Simulation funding"
}
```

Response shape:

```json
{
  "targetUser": {
    "username": "alice",
    "status": "ACTIVE"
  },
  "assetSymbol": "SWC",
  "amount": "1000",
  "newAvailable": "2500",
  "ledgerEntryId": "ledger_uuid",
  "auditLogId": "audit_uuid"
}
```

## POST `/api/transfers`

Requires JWT.

Current user-facing asset support: `SWC`, `SWL`

Request:

```json
{
  "recipient": "bob",
  "assetSymbol": "SWC",
  "amount": "25",
  "note": "Internal transfer"
}
```

Response shape:

```json
{
  "id": "transfer_uuid",
  "from": { "username": "alice", "status": "ACTIVE" },
  "to": { "username": "bob", "status": "ACTIVE" },
  "assetSymbol": "SWC",
  "amount": "25",
  "senderNewAvailable": "975",
  "recipientNewAvailable": "125",
  "createdAt": "2026-05-25T10:00:00.000Z"
}
```

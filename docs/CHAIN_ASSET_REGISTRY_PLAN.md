# Chain Asset Registry Plan

This document plans how current internal assets may optionally be linked to future chain token metadata.

Current `v0.x` assets remain internal off-chain accounting assets. Chain metadata is future `v1.x` only.

## Registry Purpose

- Keep the existing internal `Asset` model as the trading/accounting identity
- Add optional chain transport metadata without changing the current `v0.x` asset behavior
- Allow some assets to stay internal-only while others become chain-capable later

## Planned Fields

| Field | Purpose |
| --- | --- |
| `chainId` | canonical chain identifier |
| `chainName` | human-readable chain name |
| `rpc/network identifier` | RPC or network routing key used by monitoring services |
| `contractAddress` | token contract address for supported tokens |
| `tokenDecimals` | on-chain decimal precision |
| `tokenSymbol` | chain token symbol |
| `tokenName` | chain token display name |
| `depositEnabled` | per-asset deposit readiness flag |
| `withdrawEnabled` | per-asset withdrawal readiness flag |
| `minDeposit` | minimum creditable deposit amount |
| `minWithdraw` | minimum withdrawal amount |
| `withdrawFee` | operator-defined platform withdrawal fee |
| `confirmationsRequired` | confirmation depth before credit/complete state |
| `icon/metadata source` | chain metadata provenance or operator override |
| `status` | active, paused, deprecated, unsupported, or similar operational state |
| `admin controls` | operator actions for enable, disable, pause, edit, or deprecate |

## Admin Controls

- add chain metadata for an existing internal asset
- pause deposit capability without disabling withdrawal capability
- pause withdrawal capability without hiding the asset
- update minimums, fees, and confirmation depth
- mark a chain mapping deprecated or unsupported
- emergency-disable a chain asset path

## Validation Rules

- `contractAddress` must be normalized and unique within the relevant chain scope
- `tokenDecimals` must be within valid token precision bounds
- `minDeposit`, `minWithdraw`, and `withdrawFee` must be non-negative
- `confirmationsRequired` must be a positive operational value
- `depositEnabled` and `withdrawEnabled` must not bypass global feature flags
- paused or unsupported assets must not be accidentally creditable

## Relationship To Current Models

- Current internal `Asset` remains the core trading and wallet asset identity
- Current `Market` relationships remain based on internal asset pairs
- Chain registry records should reference internal assets instead of replacing them
- A market can exist for an internal asset even if that asset has no chain registry record
- A chain registry record does not make the asset live for deposit or withdraw by itself

## Boundary Reminder

- Current `v0.x` assets are internal/off-chain accounting assets
- Chain metadata is future `v1.x` planning only

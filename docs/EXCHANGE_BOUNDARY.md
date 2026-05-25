# Exchange Boundary

## Public Project Positioning

SW Exchange is a simulated exchange runtime for custom assets and custom markets.

The project is designed to provide an exchange-style product surface with internal accounting, market management, trading, wallet views, portfolio views, market data, admin operations, and deployable runtime infrastructure.

## What SW Exchange Is In v0.x

- An off-chain internal-accounting exchange runtime
- A platform for custom asset and custom market simulation
- A spot-style trading environment with limit and market orders
- An internal wallet and transfer system
- An admin-operated listing and operations console
- A Docker-deployable demo/runtime package

`v0.x` is already a complete product boundary within that off-chain simulation model.

## What SW Exchange May Become In v1.x

Future `v1.x` work may add optional chain token gateway capabilities, including:

- chain asset metadata
- token deposit support
- token withdrawal support
- hot wallet operations
- chain reconciliation and audit controls

Those capabilities are planned only and are not implemented in `v0.20`.

## What SW Exchange Does Not Include

- fiat deposits
- fiat withdrawals
- cash redemption
- fiat conversion
- built-in KYC
- regulated financial exchange workflow
- gambling or casino mechanics

If an operator needs those capabilities, they are responsible for building, integrating, or operating them outside the current project boundary.

## Operator And Deployer Responsibility

SW Exchange is software infrastructure, not a managed operational service.

The deployer or operator is responsible for:

- environment security
- secret management
- admin access control
- infrastructure monitoring
- operational procedures
- legal and regulatory review for their own deployment context
- deciding whether optional future token gateway features should be enabled at all

## Security Assumption For Future Token Features

Even though SW Exchange is a simulated exchange runtime, any future token-related feature must be designed as if the token may have value.

That means planned deposit, withdrawal, and custody work must treat the following as first-class requirements:

- asset safety
- permissioning
- audit logs
- idempotency
- reconciliation
- emergency disable controls
- operational approval paths

## Boundary Summary

Today, SW Exchange is an off-chain simulated exchange runtime.

Future `v1.x` may add optional token gateway capabilities.

Future `v2.x` may add optional margin or futures simulation.

None of those future modules are live in `v0.20`.

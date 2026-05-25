# Domain Terms

## Core Market Terms

- `Asset`: a listed internal token record such as `SWC`, `SWL`, or `SWD`
- `Market`: a spot trading pair record such as `SWL/SWC`
- `Base Asset`: the asset being bought or sold, left side of `BASE/QUOTE`
- `Quote Asset`: the pricing / settlement asset, right side of `BASE/QUOTE`
- `Market Symbol`: canonical pair string like `SWL/SWC`
- `Order Book`: grouped open limit liquidity for one market
- `Best Bid`: highest open BUY limit price
- `Best Ask`: lowest open SELL limit price
- `Last Price`: latest settled trade price for the market

## Order Terms

- `Limit Order`: priced order that can rest on the book
- `Market Order`: taker-only order that consumes resting liquidity immediately
- `Maker`: the resting order already on the book
- `Taker`: the incoming order that consumes liquidity
- `filledAmount`: executed base amount on an order
- `remainingAmount`: unfilled base amount remaining on an order
- `requestedQuoteAmount`: quote spend requested by a market BUY
- `spentQuoteAmount`: actual quote spent after execution
- `averagePrice`: realized average execution price for a market order
- `PARTIAL_FILLED_CANCELLED`: market-order status meaning partial execution with remainder auto-cancelled

## Candle Terms

- `Candle` / `K-line`: aggregated OHLC market data bucket
- `OHLC`: open, high, low, close

## Wallet Terms

- `availableBalance`: spendable balance in a wallet
- `lockedBalance`: balance reserved by open limit orders
- `walletType`: wallet bucket enum
- `MAIN wallet`: normal user wallet bucket and admin ordinary wallet bucket
- `FEE wallet`: admin fee-collection bucket
- `TREASURY wallet`: admin treasury placeholder bucket
- `AIRDROP wallet`: admin airdrop placeholder bucket
- `HOT wallet`: admin future chain placeholder bucket

## Fee Terms

- `Fee BPS`: fee rate in basis points, where `100` bps = `1%`
- `Buyer Fee`: fee charged to the buyer in base asset
- `Seller Fee`: fee charged to the seller in quote asset

## Status Terms

- `ACTIVE`: enabled for the relevant flow
- `FROZEN`: user can view but cannot act
- `BANNED`: login blocked
- `PAUSED`: asset or market is disabled for new activity

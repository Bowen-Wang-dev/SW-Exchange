# UI Style Guide

## Core Direction

- Dark CEX-style product language
- Desktop-first trading terminal
- Compact, dense information layout
- Exchange-inspired hierarchy over marketing-style composition

## Trading Terminal Rules

- Keep the professional terminal structure:
  - ticker bar
  - chart
  - order book / recent trades
  - order form rail
  - bottom tabs
- Keep order entry visible on desktop
- Prefer contained panel scrolling over page-wide horizontal scroll
- Avoid oversized spacing and oversized cards

## Interaction Rules

- Do not use plain system selects for key exchange interactions on the core trade surface
- Use the custom market selector pattern for market switching
- Use asset icons with clean fallbacks
- Use clear badges for status, side, type, and paused/live states
- Show safe empty states instead of fake data
- Show clear risk warnings for market orders and partial-liquidity outcomes

## Layout Rules

- Preserve dense row heights for exchange data
- Avoid horizontal scroll as the primary solution for core exchange UI
- Keep market rows and asset rows scannable at desktop widths
- Maintain fixed or predictable desktop panel proportions unless a task explicitly revisits layout behavior

## Theme / Scope Rules

- Dark mode remains the default professional exchange experience
- Light mode must reuse the same dense exchange layout and color semantics instead of redesigning the app
- Prefer shared CSS theme tokens over page-local hardcoded colors
- Persist theme preference locally when theme work is in scope
- Do not redesign the entire app during feature work
- No mobile-specific redesign or optimization unless explicitly requested

## Copy / State Rules

- Display current status clearly: `ACTIVE`, `PAUSED`, `FROZEN`, `BANNED`
- Keep simulation boundaries visible where relevant
- Do not imply deposit, withdraw, blockchain, or real-money functionality is live

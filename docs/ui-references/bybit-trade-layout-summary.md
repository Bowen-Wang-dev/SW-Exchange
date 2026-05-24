# Bybit Spot Trading Layout Reference Summary

Reference inspected: `sample/▲ 76958.1 BTCUSDT Bybit Spot Trading (24_05_2026 23：47：53).html`

This document captures layout and UX patterns only. It must not be used to copy branding, source code, proprietary assets, exact colors, class names, or exact text.

## Overall Trading Terminal Layout

- Desktop layout is a dense terminal with a minimum wide viewport, roughly optimized around 1280px+.
- The app uses a sticky global header, then a trading workspace below it.
- The main trading workspace is split into a large left work area and a fixed-width right rail.
- The left area contains a top market/ticker bar, then a grid of resizable panels.
- The right rail is dedicated primarily to order entry and account/balance shortcuts.
- A compact footer/status strip sits at the bottom with market-change and support-style utilities.

Observed workspace structure:

- Top global/header area: sticky, outside the trading grid.
- Left workspace: flexible width.
- Right order rail: about 300px wide.
- Main grid spacing: very tight, about 4px gutters between panels.
- Top row: chart on the left, order book/recent trades on the right.
- Bottom row: order, position, and history table spanning the left workspace width.

## Top Market/Ticker Bar

- The market bar sits directly above the chart/grid area inside the left workspace.
- It is short and dense, around one compact toolbar height.
- Left side contains the active symbol selector and pair identity.
- Adjacent ticker metrics are arranged horizontally: last price, fiat reference, change, high/low, volume, turnover, or similar market stats.
- Right side contains auxiliary market actions or shortcuts.
- The active symbol area is visually separated from ticker metrics with a subtle vertical divider.
- Metric labels are small and secondary; metric values are compact and aligned for quick scanning.

## Market Selector Placement And Behavior

- The market selector is anchored at the far left of the market bar.
- It behaves like a clickable symbol chip/dropdown rather than a full page navigation element.
- The selector combines an icon/avatar-sized visual, pair text, and a dropdown affordance.
- Expected behavior is an overlay or popover for search/switching markets.
- SW Exchange should emulate the placement and compact selector behavior, not the specific branding, icons, or market-copy text.

## Chart Area Placement

- The chart is the dominant top-left panel.
- It occupies most of the top row width and height.
- Its header includes a title plus compact mode tabs such as native chart, external-style chart, or depth view.
- The chart panel is framed as a self-contained module with a header, toolbar-like controls, and the chart canvas/content below.
- In the saved layout, the chart panel is roughly three times wider than the adjacent order book panel.

## Order Book Placement

- The order book sits in the top row immediately to the right of the chart and left of the order-entry rail.
- It is narrow and tall, matching the chart height.
- It shares a panel with recent trades through tabs or a segmented header.
- The panel favors numeric density: small rows, compact columns, and minimal padding.
- SW Exchange should preserve the mental model: chart left, market depth beside it, order entry further right.

## Recent Trades Placement

- Recent trades are colocated with the order book, accessible from the same top-right market-data panel.
- The reference treats recent trades as a peer tab to order book rather than a large separate module.
- This saves horizontal space while keeping trade tape data close to the chart and order form.
- For v0.17, SW Exchange should consider either tabs or a compact split if space allows, with tabs preferred for avoiding clutter.

## Order Form Placement

- The order form lives in a fixed right rail, separate from the draggable/resizable left grid.
- The rail starts near the top of the trading workspace and runs vertically.
- The order form begins with a high-level trade tab, then product/account context, then buy/sell side tabs.
- Order type tabs appear near the top of the form.
- Inputs are vertically stacked with right-aligned units.
- A percentage slider appears between quantity/value inputs.
- Optional controls such as TP/SL, post-only, or time-in-force appear below core inputs.
- The submit button is full width and anchored near the lower part of the form content.
- Balance/account shortcuts appear below or near the form, not in the chart workspace.

## Bottom Order/Position/History Panel

- The bottom panel spans the full left workspace beneath the chart and order book.
- It uses horizontal tabs for open orders, order history, trade history, and similar account activity.
- It includes a secondary tab/filter row for narrower status or time-range controls.
- Tables use an empty-state area when there is no data.
- Header tabs are compact and can overflow horizontally while hiding the scrollbar.
- This panel is important for terminal feel: it should remain visible without requiring navigation away from the trading screen.

## Density, Spacing, Borders, And Panel Behavior

- The reference is highly dense: small typography, tight row heights, and minimal gutters.
- Panels are separated by thin borders, background contrast, and 4px-ish gaps rather than large cards.
- Most modules have their own compact header row.
- The left workspace uses resizable/draggable grid panel behavior in the reference.
- For SW Exchange, resizable panels are optional for v0.17; fixed responsive grid proportions may be safer initially.
- Use clear panel boundaries and compact controls, but avoid making touch/click targets too small.

## Scrolling Behavior

- Page/body vertical scrolling exists when the terminal exceeds viewport height.
- The left grid itself hides overflow in major containers.
- Table bodies and preference/dropdown areas use internal scrolling.
- The order/history tab rows use horizontal overflow for many tabs, with scrollbars visually minimized.
- The order form right rail can become vertically dense; SW Exchange should allow internal vertical scrolling there on shorter screens.

## Horizontal Scrolling

- Horizontal scrolling appears mainly in tab rows or small control strips where many options may not fit.
- The reference also enforces a wide minimum desktop width, reducing full-page horizontal compression.
- SW Exchange should avoid full-page horizontal scrolling wherever possible.
- Prefer responsive collapse, tab overflow, or panel stacking at smaller widths.
- If horizontal scrolling is needed, limit it to contained tab strips or tables with clear affordances.

## Patterns SW Exchange Should Emulate

- Use a professional terminal layout: market bar above, chart primary, order book adjacent, order form fixed to the right, account activity below.
- Keep market switching at the top-left of the ticker bar.
- Make chart and order book share the top row height.
- Keep order entry always visible on desktop.
- Use a bottom activity panel with tabs for open orders and history.
- Use compact module headers and dense data rows.
- Prefer contained internal scroll regions over whole-page wandering.
- Maintain strong information hierarchy: current symbol and price first, chart second, execution controls always available.

## Things SW Exchange Must Not Copy

- Do not copy logos, icons, branding, exchange names, marketing text, or proprietary labels.
- Do not copy exact colors, CSS variables, class names, DOM structure, or source code.
- Do not copy embedded fonts, SVG assets, base64 images, tracking scripts, hidden modal content, or vendor-specific widgets.
- Do not copy the exact tab labels where they are proprietary or exchange-specific.
- Do not reproduce the exact visual skin; use SW Exchange's own design system and product language.
- Do not implement unrelated exchange-specific services, funding flows, customer service widgets, campaign systems, or compliance notices from the reference.

## Recommended SW Exchange v0.17 Direction

- Build a desktop-first professional terminal with a minimum comfortable width, but avoid forcing broad full-page horizontal scroll.
- Use a three-zone desktop layout: flexible left workspace, fixed right order rail, bottom activity panel.
- Initial v0.17 can use fixed CSS grid proportions instead of user-resizable panels to reduce implementation risk.
- Suggested desktop composition: market bar full width over left workspace; chart takes the largest top-left area; order book/recent trades top-right of left workspace; order form in a 300-340px right rail; open orders/history across the bottom.
- Add responsive behavior later: collapse right rail below chart or turn order book/recent trades into tabs on smaller screens.

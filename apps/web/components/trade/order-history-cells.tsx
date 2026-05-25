"use client";

import { AssetIcon } from "@/components/ui/asset-icon";
import type { OrderEntry, OrderSide, OrderStatus, OrderType } from "@/lib/api-types";
import { shortId } from "@/lib/format";

export function OrderIdentityCell({ order }: { order: OrderEntry }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--foreground)]">{shortId(order.id)}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SideText side={order.side} />
        <OrderTypeBadge type={order.type} />
      </div>
    </div>
  );
}

export function OrderPricingCell({ order }: { order: OrderEntry }) {
  const quoteSymbol = marketQuoteSymbol(order.marketSymbol);

  if (order.type === "MARKET") {
    return (
      <div className="space-y-1">
        <p className="font-medium text-[var(--foreground)]">
          {order.averagePrice ? `${order.averagePrice} ${quoteSymbol}` : "Market"}
        </p>
        <p className="text-xs text-[var(--foreground-muted)]">Average execution price</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="font-medium text-[var(--foreground)]">{order.price} {quoteSymbol}</p>
      <p className="text-xs text-[var(--foreground-muted)]">Resting limit price</p>
    </div>
  );
}

export function OrderExecutionCell({ order }: { order: OrderEntry }) {
  const baseSymbol = marketBaseSymbol(order.marketSymbol);
  const quoteSymbol = marketQuoteSymbol(order.marketSymbol);
  const feeText = order.feeSummary
    ? order.side === "BUY"
      ? `${order.feeSummary.buyerFee} ${order.feeSummary.buyerFeeAssetSymbol}`
      : `${order.feeSummary.sellerFee} ${order.feeSummary.sellerFeeAssetSymbol}`
    : null;

  return (
    <div className="space-y-1">
      <p className="text-[var(--foreground)]">Filled {order.filledAmount} {baseSymbol}</p>
      {order.type === "MARKET" ? (
        <>
          <p className="text-xs text-[var(--foreground-soft)]">
            {order.side === "BUY"
              ? `Spent ${order.spentQuoteAmount} ${quoteSymbol}`
              : `Received ${order.receivedQuoteAmount ?? "0"} ${quoteSymbol}`}
          </p>
          <p className="text-xs text-[var(--foreground-soft)]">
            {order.side === "BUY"
              ? `Cancelled remainder ${order.cancelledQuoteAmount ?? "0"} ${quoteSymbol}`
              : `Cancelled remainder ${order.cancelledAmount ?? "0"} ${baseSymbol}`}
          </p>
          <p className="text-xs text-[var(--foreground-muted)]">
            Trades {order.tradeCount ?? 0}{feeText ? ` • Fee ${feeText}` : ""}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-[var(--foreground-soft)]">Amount {order.amount} {baseSymbol}</p>
          <p className="text-xs text-[var(--foreground-soft)]">Remaining {order.remainingAmount} {baseSymbol}</p>
          <p className="text-xs text-[var(--foreground-muted)]">Locked {order.lockedAmount} {order.lockedAssetSymbol}</p>
        </>
      )}
      {order.warning ? <p className="text-xs text-[var(--notice-warning-text)]">{order.warning}</p> : null}
    </div>
  );
}

export function MarketCell({ marketSymbol }: { marketSymbol: string }) {
  const [baseSymbol, quoteSymbol] = marketSymbol.split("/");

  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex -space-x-2">
        <AssetIcon symbol={baseSymbol ?? "SWL"} size={24} />
        <AssetIcon symbol={quoteSymbol ?? "SWC"} size={24} />
      </span>
      <span className="font-medium text-[var(--foreground)]">{marketSymbol}</span>
    </span>
  );
}

export function SideText({ side }: { side: OrderSide }) {
  return (
    <span className={side === "BUY" ? "text-[var(--success)]" : "text-[var(--danger)]"}>{side}</span>
  );
}

export function OrderTypeBadge({ type }: { type: OrderType }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
        type === "MARKET"
          ? "border-[var(--notice-warning-border)] bg-[var(--notice-warning-bg)] text-[var(--notice-warning-text)]"
          : "border-[var(--notice-info-border)] bg-[var(--notice-info-bg)] text-[var(--notice-info-text)]"
      }`}
    >
      {type}
    </span>
  );
}

export function orderStatusTone(status: OrderStatus): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "OPEN" || status === "PARTIAL_FILLED") {
    return "info";
  }

  if (status === "CANCELLED" || status === "PARTIAL_FILLED_CANCELLED") {
    return "warning";
  }

  if (status === "FILLED") {
    return "success";
  }

  if (status === "REJECTED") {
    return "danger";
  }

  return "neutral";
}

function marketBaseSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[0] || "SWL";
}

function marketQuoteSymbol(marketSymbol: string) {
  return marketSymbol.split("/")[1] || "SWC";
}

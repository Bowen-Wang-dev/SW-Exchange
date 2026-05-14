import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";

export default function TradePage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="space-y-4">
          <PageHeader
            eyebrow="Trade"
            title="SWL/SWC spot terminal"
            description="This is the exchange-style trade layout for the only supported v0.x market. The page is visual-only in this milestone, with no real submit or matching behavior."
            action={<StatusBadge label="Limit Only" tone="warning" />}
          />

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.1fr_0.95fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Order Book</h2>
                <StatusBadge label="SWL/SWC" tone="info" />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["0.143200", "1,240.00", "Sell"],
                  ["0.143000", "980.00", "Sell"],
                  ["0.142900", "620.00", "Sell"],
                  ["0.142600", "1,510.00", "Buy"],
                  ["0.142500", "2,040.00", "Buy"],
                  ["0.142400", "1,300.00", "Buy"],
                ].map(([price, amount, side]) => (
                  <div
                    key={`${price}-${amount}`}
                    className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white/[0.02] px-3 py-2 text-sm"
                  >
                    <span className={side === "Buy" ? "text-emerald-300" : "text-rose-300"}>
                      {price}
                    </span>
                    <span className="text-[var(--foreground-soft)]">{amount}</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-[var(--foreground-muted)]">
                      {side}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Limit Order Form</h2>
                <StatusBadge label="Disabled" tone="warning" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <OrderFormCard side="Buy" />
                <OrderFormCard side="Sell" />
              </div>
            </section>

            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent Trades</h2>
                <StatusBadge label="Placeholder" tone="neutral" />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["12:01:14", "0.142900", "420.00", "buy"],
                  ["11:58:42", "0.142800", "180.00", "sell"],
                  ["11:54:09", "0.142700", "960.00", "buy"],
                  ["11:48:30", "0.142600", "250.00", "sell"],
                ].map(([time, price, amount, side]) => (
                  <div
                    key={`${time}-${price}`}
                    className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border)] bg-white/[0.02] px-3 py-2 text-sm"
                  >
                    <span className="text-[var(--foreground-muted)]">{time}</span>
                    <span className={side === "buy" ? "text-emerald-300" : "text-rose-300"}>
                      {price}
                    </span>
                    <span className="text-right text-[var(--foreground-soft)]">{amount}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <DataTable
            columns={["Order ID", "Market", "Side", "Price", "Amount", "Status"]}
            rows={[
              [
                "demo-open-001",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  BUY
                </span>,
                "0.142500",
                "1,200.00",
                <StatusBadge key="status-open" label="Open" tone="info" />,
              ],
              [
                "demo-open-002",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  SELL
                </span>,
                "0.143100",
                "750.00",
                <StatusBadge key="status-partial" label="Partial" tone="warning" />,
              ],
            ]}
          />
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function OrderFormCard({ side }: { side: "Buy" | "Sell" }) {
  const toneClass = side === "Buy" ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white/[0.02] p-4">
      <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${toneClass}`}>{side}</p>
      <div className="mt-4 grid gap-3">
        {["Price (SWC)", "Amount (SWL)", "Total (SWC)"].map((field) => (
          <input
            key={field}
            disabled
            placeholder={field}
            className="rounded-2xl border border-[var(--border)] bg-[#0a1122] px-4 py-3 text-sm text-[var(--foreground-muted)]"
          />
        ))}
        <button
          type="button"
          disabled
          className="rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-[var(--foreground-muted)]"
        >
          {side} placeholder
        </button>
      </div>
    </div>
  );
}

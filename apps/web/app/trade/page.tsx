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
            description="Trading UI is preview-only until v0.5/v0.6. Limit order support comes in v0.5 and the matching engine comes in v0.6."
            action={<StatusBadge label="Preview" tone="warning" />}
          />

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.1fr_0.95fr]">
            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Order Book</h2>
                <StatusBadge label="v0.5" tone="info" />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["—", "—", "Sell"],
                  ["—", "—", "Sell"],
                  ["—", "—", "Sell"],
                  ["—", "—", "Buy"],
                  ["—", "—", "Buy"],
                  ["—", "—", "Buy"],
                ].map(([price, amount, side], index) => (
                  <div
                    key={`${side}-${index}`}
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
                <StatusBadge label="v0.5" tone="warning" />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <OrderFormCard side="Buy" />
                <OrderFormCard side="Sell" />
              </div>
            </section>

            <section className="panel rounded-3xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Recent Trades</h2>
                <StatusBadge label="v0.6" tone="neutral" />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  ["—", "—", "—", "buy"],
                  ["—", "—", "—", "sell"],
                  ["—", "—", "—", "buy"],
                  ["—", "—", "—", "sell"],
                ].map(([time, price, amount, side], index) => (
                  <div
                    key={`${side}-${index}`}
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
                "—",
                "SWL/SWC",
                <span key="buy" className="text-emerald-300">
                  BUY
                </span>,
                "—",
                "—",
                <StatusBadge key="status-open" label="Preview" tone="info" />,
              ],
              [
                "—",
                "SWL/SWC",
                <span key="sell" className="text-rose-300">
                  SELL
                </span>,
                "—",
                "—",
                <StatusBadge key="status-partial" label="Preview" tone="warning" />,
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
          {side} disabled
        </button>
      </div>
    </div>
  );
}

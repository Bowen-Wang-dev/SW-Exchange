"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CandlestickData,
  HistogramData,
  IChartApi,
  MouseEventParams,
  UTCTimestamp,
} from "lightweight-charts";
import type { CandleInterval, MarketCandle } from "@/lib/api-types";

const INTERVAL_OPTIONS: CandleInterval[] = ["1m", "5m", "15m", "1h", "1d"];
const UP_COLOR = "#02c076";
const DOWN_COLOR = "#f6465d";
const GRID_COLOR = "rgba(154, 166, 199, 0.09)";
const AXIS_COLOR = "rgba(154, 166, 199, 0.22)";
const TEXT_COLOR = "#9aa6c7";
const CHART_BACKGROUND = "#070d1a";

type KlineChartProps = {
  marketSymbol: string;
  baseSymbol: string;
  quoteSymbol: string;
  candles: MarketCandle[];
  interval: CandleInterval;
  isLoading: boolean;
  error: string | null;
  onIntervalChange: (interval: CandleInterval) => void;
};

type ChartRow = {
  source: MarketCandle;
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
};

export function KlineChart({
  marketSymbol,
  baseSymbol,
  quoteSymbol,
  candles,
  interval,
  isLoading,
  error,
  onIntervalChange,
}: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const chartRows = useMemo(() => buildChartRows(candles), [candles]);
  const rowByTime = useMemo(
    () => new Map(chartRows.map((row) => [Number(row.time), row])),
    [chartRows],
  );
  const latestRow = chartRows[chartRows.length - 1] ?? null;
  const activeRow =
    hoveredTime !== null ? rowByTime.get(hoveredTime) ?? latestRow : latestRow;

  useEffect(() => {
    setHoveredTime(null);
  }, [marketSymbol, interval]);

  useEffect(() => {
    const container = chartContainerRef.current;

    if (!container || chartRows.length === 0 || isLoading || error) {
      return;
    }

    let chart: IChartApi | null = null;
    let didDispose = false;
    let unsubscribeCrosshair: (() => void) | null = null;

    async function mountChart() {
      const {
        CandlestickSeries,
        ColorType,
        CrosshairMode,
        HistogramSeries,
        createChart,
      } = await import("lightweight-charts");

      if (didDispose || !chartContainerRef.current) {
        return;
      }

      const currentContainer = chartContainerRef.current;
      chart = createChart(currentContainer, {
        autoSize: true,
        width: currentContainer.clientWidth || 960,
        height: currentContainer.clientHeight || 430,
        layout: {
          background: { type: ColorType.Solid, color: CHART_BACKGROUND },
          textColor: TEXT_COLOR,
          fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
        },
        grid: {
          vertLines: { color: GRID_COLOR },
          horzLines: { color: GRID_COLOR },
        },
        rightPriceScale: {
          visible: true,
          borderColor: AXIS_COLOR,
          scaleMargins: {
            top: 0.14,
            bottom: 0.08,
          },
        },
        leftPriceScale: {
          visible: false,
        },
        timeScale: {
          borderColor: AXIS_COLOR,
          timeVisible: interval !== "1d",
          secondsVisible: false,
          rightOffset: 8,
          barSpacing: 8,
          minBarSpacing: 4,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: "rgba(240, 185, 11, 0.52)",
            width: 1,
            labelBackgroundColor: "#111a2f",
          },
          horzLine: {
            color: "rgba(240, 185, 11, 0.42)",
            width: 1,
            labelBackgroundColor: "#111a2f",
          },
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: false,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: false,
        },
        localization: {
          priceFormatter: formatAxisPrice,
          timeFormatter: formatAxisTime,
        },
      });

      const priceSeries = chart.addSeries(CandlestickSeries, {
        title: marketSymbol,
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderVisible: false,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
        priceLineColor: "rgba(240, 185, 11, 0.64)",
        priceLineWidth: 1,
        priceFormat: {
          type: "custom",
          formatter: formatAxisPrice,
          minMove: 0.00000001,
        },
      });

      const volumePane = chart.addPane(false);
      chart.panes()[0]?.setStretchFactor(4);
      volumePane.setStretchFactor(1.1);

      const volumeSeries = volumePane.addSeries(HistogramSeries, {
        title: `Vol ${baseSymbol}`,
        priceFormat: {
          type: "volume",
        },
        priceLineVisible: false,
        lastValueVisible: false,
      });

      priceSeries.priceScale().applyOptions({
        borderColor: AXIS_COLOR,
        scaleMargins: {
          top: 0.14,
          bottom: 0.08,
        },
      });
      volumeSeries.priceScale().applyOptions({
        borderColor: AXIS_COLOR,
        scaleMargins: {
          top: 0.18,
          bottom: 0.04,
        },
      });

      priceSeries.setData(toCandlestickData(chartRows));
      volumeSeries.setData(toVolumeData(chartRows));
      chart.timeScale().fitContent();

      const handleCrosshairMove = (param: MouseEventParams) => {
        if (!param.point || typeof param.time !== "number") {
          setHoveredTime(null);
          return;
        }

        setHoveredTime(Number(param.time));
      };

      chart.subscribeCrosshairMove(handleCrosshairMove);
      unsubscribeCrosshair = () => chart?.unsubscribeCrosshairMove(handleCrosshairMove);
    }

    void mountChart();

    return () => {
      didDispose = true;
      unsubscribeCrosshair?.();
      chart?.remove();
    };
  }, [baseSymbol, chartRows, error, interval, isLoading, marketSymbol]);

  return (
    <section className="panel rounded-3xl p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase text-[var(--foreground-muted)]">K-line</p>
          <h2 className="mt-1 break-words text-lg font-semibold text-white">
            {marketSymbol} candlestick
          </h2>
        </div>
        <div className="grid grid-cols-5 rounded-2xl border border-[var(--border)] bg-white/[0.03] p-1">
          {INTERVAL_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                if (option !== interval) {
                  onIntervalChange(option);
                }
              }}
              aria-pressed={interval === option}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                interval === option
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "text-[var(--foreground-muted)] hover:text-white"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[#070d1a]">
        {isLoading ? (
          <ChartState message="Loading candles..." />
        ) : error ? (
          <ChartState tone="danger" message={error} />
        ) : candles.length === 0 ? (
          <ChartState message="No trades yet. K-line data will appear after trades execute." />
        ) : chartRows.length === 0 ? (
          <ChartState tone="danger" message="Unable to render candle data." />
        ) : (
          <>
            <OhlcPanel row={activeRow} baseSymbol={baseSymbol} quoteSymbol={quoteSymbol} />
            <div
              ref={chartContainerRef}
              role="img"
              aria-label={`${marketSymbol} ${interval} interactive candlestick chart`}
              className="h-[360px] w-full"
            />
          </>
        )}
      </div>
    </section>
  );
}

function ChartState({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={`flex min-h-[390px] items-center justify-center px-4 text-center text-sm ${
        tone === "danger" ? "text-rose-200" : "text-[var(--foreground-muted)]"
      }`}
    >
      {message}
    </div>
  );
}

function OhlcPanel({
  row,
  baseSymbol,
  quoteSymbol,
}: {
  row: ChartRow | null;
  baseSymbol: string;
  quoteSymbol: string;
}) {
  const movement = row ? calculateMovement(row) : null;
  const movementTone = movement ? toneForNumber(movement.change) : "neutral";

  return (
    <div className="grid gap-3 border-b border-[var(--border)] bg-[#09101f] px-3 py-2.5 text-[11px] lg:grid-cols-[1.35fr_repeat(9,minmax(0,1fr))]">
      <OhlcItem label="Time" value={row ? formatPanelTime(row.source.startTime) : "—"} />
      <OhlcItem label="Open" value={formatDisplayNumber(row?.source.open)} suffix={quoteSymbol} />
      <OhlcItem label="High" value={formatDisplayNumber(row?.source.high)} suffix={quoteSymbol} />
      <OhlcItem label="Low" value={formatDisplayNumber(row?.source.low)} suffix={quoteSymbol} />
      <OhlcItem
        label="Close"
        value={formatDisplayNumber(row?.source.close)}
        suffix={quoteSymbol}
        tone={movementTone}
      />
      <OhlcItem
        label="Change"
        value={movement ? formatSignedNumber(movement.change) : "—"}
        suffix={movement ? quoteSymbol : undefined}
        tone={movementTone}
      />
      <OhlcItem
        label="Change %"
        value={movement ? `${formatSignedNumber(movement.percent)}%` : "—"}
        tone={movementTone}
      />
      <OhlcItem label="Volume" value={formatDisplayNumber(row?.source.volume)} suffix={baseSymbol} />
      <OhlcItem
        label="Quote Vol"
        value={formatDisplayNumber(row?.source.quoteVolume)}
        suffix={quoteSymbol}
      />
      <OhlcItem label="Trades" value={row ? row.source.tradeCount.toString() : "—"} />
    </div>
  );
}

function OhlcItem({
  label,
  value,
  suffix,
  tone = "neutral",
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-300"
      : tone === "negative"
        ? "text-rose-300"
        : "text-white";

  return (
    <div className="min-w-0">
      <p className="uppercase tracking-[0.14em] text-[var(--foreground-muted)]">{label}</p>
      <p className={`mt-1 truncate font-semibold ${toneClass}`}>
        {value === "—" || !suffix ? value : `${value} ${suffix}`}
      </p>
    </div>
  );
}

function buildChartRows(candles: MarketCandle[]) {
  return candles
    .map(toChartRow)
    .filter((row): row is ChartRow => row !== null)
    .sort((a, b) => Number(a.time) - Number(b.time));
}

function toChartRow(candle: MarketCandle): ChartRow | null {
  const time = toUtcTimestamp(candle.startTime);
  const open = toFiniteNumber(candle.open);
  const high = toFiniteNumber(candle.high);
  const low = toFiniteNumber(candle.low);
  const close = toFiniteNumber(candle.close);
  const volume = toFiniteNumber(candle.volume) ?? 0;
  const quoteVolume = toFiniteNumber(candle.quoteVolume) ?? 0;

  if (time === null || open === null || high === null || low === null || close === null) {
    return null;
  }

  return {
    source: candle,
    time,
    open,
    high,
    low,
    close,
    volume: Math.max(volume, 0),
    quoteVolume: Math.max(quoteVolume, 0),
  };
}

function toCandlestickData(rows: ChartRow[]): CandlestickData<UTCTimestamp>[] {
  return rows.map((row) => ({
    time: row.time,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  }));
}

function toVolumeData(rows: ChartRow[]): HistogramData<UTCTimestamp>[] {
  return rows.map((row) => ({
    time: row.time,
    value: row.volume,
    color: row.close >= row.open ? "rgba(2, 192, 118, 0.42)" : "rgba(246, 70, 93, 0.42)",
  }));
}

function toUtcTimestamp(value: string): UTCTimestamp | null {
  const milliseconds = Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  return Math.floor(milliseconds / 1000) as UTCTimestamp;
}

function toFiniteNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function calculateMovement(row: ChartRow) {
  if (!Number.isFinite(row.open) || row.open === 0 || !Number.isFinite(row.close)) {
    return null;
  }

  const change = row.close - row.open;

  return {
    change,
    percent: (change / row.open) * 100,
  };
}

function toneForNumber(value: number): "neutral" | "positive" | "negative" {
  if (value > 0) {
    return "positive";
  }

  if (value < 0) {
    return "negative";
  }

  return "neutral";
}

function formatDisplayNumber(value?: string) {
  const parsed = toFiniteNumber(value);

  if (parsed === null) {
    return value?.trim() || "—";
  }

  return formatNumericValue(parsed);
}

function formatSignedNumber(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumericValue(value)}`;
}

function formatNumericValue(value: number) {
  const absolute = Math.abs(value);
  const maximumFractionDigits = absolute >= 1000 ? 2 : absolute >= 1 ? 6 : 8;

  return value.toLocaleString("en-US", {
    maximumFractionDigits,
  });
}

function formatAxisPrice(value: number) {
  return formatNumericValue(value);
}

function formatAxisTime(time: unknown) {
  if (typeof time === "number") {
    return formatUtcTimestamp(time);
  }

  if (typeof time === "string") {
    return time;
  }

  return "";
}

function formatPanelTime(value: string) {
  const timestamp = toUtcTimestamp(value);

  if (timestamp === null) {
    return "—";
  }

  return `${formatUtcTimestamp(Number(timestamp))} UTC`;
}

function formatUtcTimestamp(timestampSeconds: number) {
  const date = new Date(timestampSeconds * 1000);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const iso = date.toISOString();
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

"use client";

import { useMemo } from "react";
import type { CandleInterval, MarketCandle } from "@/lib/api-types";

const INTERVAL_OPTIONS: CandleInterval[] = ["1m", "5m", "15m", "1h", "1d"];
const CHART_WIDTH = 720;
const CHART_HEIGHT = 280;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 18;
const PRICE_TOP = 20;
const PRICE_BOTTOM = 198;
const VOLUME_TOP = 218;
const VOLUME_BOTTOM = 254;

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

type NumericCandle = {
  candle: MarketCandle;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  const visibleCandles = useMemo(() => candles.slice(-100), [candles]);
  const chart = useMemo(() => buildChartModel(visibleCandles), [visibleCandles]);
  const lastCandle = visibleCandles[visibleCandles.length - 1] ?? null;
  const lastTone = lastCandle
    ? Number(lastCandle.close) < Number(lastCandle.open)
      ? "negative"
      : "positive"
    : "neutral";

  return (
    <section className="panel rounded-3xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              onClick={() => onIntervalChange(option)}
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

      <div className="mt-4 min-h-[300px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[#080f1f]">
        {isLoading ? (
          <ChartState message="Loading candles..." />
        ) : error ? (
          <ChartState tone="danger" message={error} />
        ) : visibleCandles.length === 0 ? (
          <ChartState message="No trades yet. K-line data will appear after trades execute." />
        ) : chart ? (
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`${marketSymbol} ${interval} candlestick chart`}
            className="block h-[300px] w-full"
            preserveAspectRatio="none"
          >
            <rect width={CHART_WIDTH} height={CHART_HEIGHT} fill="#080f1f" />
            {chart.gridLines.map((line) => (
              <line
                key={`grid-${line.y}`}
                x1={PLOT_LEFT}
                x2={CHART_WIDTH - PLOT_RIGHT}
                y1={line.y}
                y2={line.y}
                stroke="rgba(154, 166, 199, 0.12)"
                strokeWidth="1"
              />
            ))}
            <line
              x1={PLOT_LEFT}
              x2={CHART_WIDTH - PLOT_RIGHT}
              y1={PRICE_BOTTOM}
              y2={PRICE_BOTTOM}
              stroke="rgba(154, 166, 199, 0.18)"
              strokeWidth="1"
            />
            {chart.priceLabels.map((label) => (
              <text
                key={`price-${label.y}`}
                x={8}
                y={label.y + 4}
                fill="rgba(154, 166, 199, 0.78)"
                fontSize="11"
              >
                {label.text}
              </text>
            ))}
            {chart.candles.map((item) => (
              <g key={`${item.candle.startTime}-${item.candle.tradeCount}`}>
                <line
                  x1={item.x}
                  x2={item.x}
                  y1={item.yHigh}
                  y2={item.yLow}
                  stroke={item.color}
                  strokeWidth="1.5"
                />
                <rect
                  x={item.bodyX}
                  y={item.bodyY}
                  width={item.bodyWidth}
                  height={item.bodyHeight}
                  rx="1.5"
                  fill={item.color}
                />
                <rect
                  x={item.volumeX}
                  y={item.volumeY}
                  width={item.bodyWidth}
                  height={item.volumeHeight}
                  fill={item.color}
                  opacity="0.28"
                />
              </g>
            ))}
            {chart.timeLabels.map((label) => (
              <text
                key={`time-${label.x}-${label.text}`}
                x={label.x}
                y={CHART_HEIGHT - 10}
                textAnchor={label.anchor}
                fill="rgba(154, 166, 199, 0.76)"
                fontSize="11"
              >
                {label.text}
              </text>
            ))}
          </svg>
        ) : (
          <ChartState tone="danger" message="Unable to render candle data." />
        )}
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-5">
        <ChartMetric label="Open" value={lastCandle?.open ?? "—"} suffix={quoteSymbol} />
        <ChartMetric label="High" value={lastCandle?.high ?? "—"} suffix={quoteSymbol} />
        <ChartMetric label="Low" value={lastCandle?.low ?? "—"} suffix={quoteSymbol} />
        <ChartMetric
          label="Close"
          value={lastCandle?.close ?? "—"}
          suffix={quoteSymbol}
          tone={lastTone}
        />
        <ChartMetric label="Volume" value={lastCandle?.volume ?? "—"} suffix={baseSymbol} />
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
      className={`flex min-h-[300px] items-center justify-center px-4 text-center text-sm ${
        tone === "danger" ? "text-rose-200" : "text-[var(--foreground-muted)]"
      }`}
    >
      {message}
    </div>
  );
}

function ChartMetric({
  label,
  value,
  suffix,
  tone = "neutral",
}: {
  label: string;
  value: string;
  suffix: string;
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
      <p className="uppercase text-[var(--foreground-muted)]">{label}</p>
      <p className={`mt-1 break-words font-semibold ${toneClass}`}>
        {value === "—" ? value : `${value} ${suffix}`}
      </p>
    </div>
  );
}

function buildChartModel(candles: MarketCandle[]) {
  const numericCandles = candles.map(toNumericCandle).filter((candle): candle is NumericCandle => candle !== null);

  if (numericCandles.length === 0) {
    return null;
  }

  let minPrice = numericCandles[0]?.low ?? 0;
  let maxPrice = numericCandles[0]?.high ?? 0;
  let maxVolume = 0;

  for (const candle of numericCandles) {
    minPrice = Math.min(minPrice, candle.low);
    maxPrice = Math.max(maxPrice, candle.high);
    maxVolume = Math.max(maxVolume, candle.volume);
  }

  if (maxPrice === minPrice) {
    const padding = maxPrice === 0 ? 1 : Math.abs(maxPrice) * 0.02;
    maxPrice += padding;
    minPrice -= padding;
  }

  const priceRange = maxPrice - minPrice || 1;
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const step = plotWidth / numericCandles.length;
  const bodyWidth = clamp(step * 0.54, 3, 10);

  const yForPrice = (price: number) =>
    PRICE_TOP + ((maxPrice - price) / priceRange) * (PRICE_BOTTOM - PRICE_TOP);

  const plottedCandles = numericCandles.map((candle, index) => {
    const x = PLOT_LEFT + step * index + step / 2;
    const yOpen = yForPrice(candle.open);
    const yClose = yForPrice(candle.close);
    const rawBodyHeight = Math.abs(yOpen - yClose);
    const bodyHeight = Math.max(rawBodyHeight, 2);
    const bodyY = rawBodyHeight < 2 ? (yOpen + yClose) / 2 - 1 : Math.min(yOpen, yClose);
    const volumeHeight =
      maxVolume > 0 ? Math.max((candle.volume / maxVolume) * (VOLUME_BOTTOM - VOLUME_TOP), 1) : 1;
    const color = candle.close >= candle.open ? "#02c076" : "#f6465d";

    return {
      candle: candle.candle,
      x,
      yHigh: yForPrice(candle.high),
      yLow: yForPrice(candle.low),
      bodyX: x - bodyWidth / 2,
      bodyY,
      bodyWidth,
      bodyHeight,
      volumeX: x - bodyWidth / 2,
      volumeY: VOLUME_BOTTOM - volumeHeight,
      volumeHeight,
      color,
    };
  });

  return {
    candles: plottedCandles,
    gridLines: [PRICE_TOP, (PRICE_TOP + PRICE_BOTTOM) / 2, PRICE_BOTTOM].map((y) => ({ y })),
    priceLabels: [
      { y: PRICE_TOP, text: formatAxisNumber(maxPrice) },
      { y: (PRICE_TOP + PRICE_BOTTOM) / 2, text: formatAxisNumber((maxPrice + minPrice) / 2) },
      { y: PRICE_BOTTOM, text: formatAxisNumber(minPrice) },
    ],
    timeLabels: buildTimeLabels(numericCandles, plottedCandles, candles[0]?.interval ?? "1m"),
  };
}

function toNumericCandle(candle: MarketCandle): NumericCandle | null {
  const open = toFiniteNumber(candle.open);
  const high = toFiniteNumber(candle.high);
  const low = toFiniteNumber(candle.low);
  const close = toFiniteNumber(candle.close);
  const volume = toFiniteNumber(candle.volume) ?? 0;

  if (open === null || high === null || low === null || close === null) {
    return null;
  }

  return {
    candle,
    open,
    high,
    low,
    close,
    volume: Math.max(volume, 0),
  };
}

function buildTimeLabels(
  numericCandles: NumericCandle[],
  plottedCandles: Array<{ x: number }>,
  interval: CandleInterval,
) {
  const firstCandle = numericCandles[0];
  const lastCandle = numericCandles[numericCandles.length - 1];
  const firstPlot = plottedCandles[0];
  const lastPlot = plottedCandles[plottedCandles.length - 1];

  if (!firstCandle || !lastCandle || !firstPlot || !lastPlot) {
    return [];
  }

  if (numericCandles.length === 1) {
    return [
      {
        x: firstPlot.x,
        text: formatShortTime(firstCandle.candle.startTime, interval),
        anchor: "middle" as const,
      },
    ];
  }

  return [
    {
      x: firstPlot.x,
      text: formatShortTime(firstCandle.candle.startTime, interval),
      anchor: "start" as const,
    },
    {
      x: lastPlot.x,
      text: formatShortTime(lastCandle.candle.startTime, interval),
      anchor: "end" as const,
    },
  ];
}

function toFiniteNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatShortTime(value: string, interval: CandleInterval) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const iso = date.toISOString();

  if (interval === "1d") {
    return iso.slice(5, 10);
  }

  if (interval === "1h") {
    return `${iso.slice(5, 10)} ${iso.slice(11, 13)}:00`;
  }

  return iso.slice(11, 16);
}

function formatAxisNumber(value: number) {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

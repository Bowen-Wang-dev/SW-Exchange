export class MoneyFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyFormatError";
  }
}

export function parseHumanDecimalToMinimalUnits(
  input: string,
  decimals: number,
  label = "Amount",
): bigint {
  const value = input.trim();

  if (!value) {
    throw new MoneyFormatError(`${label} is required.`);
  }

  if (value.startsWith("-")) {
    throw new MoneyFormatError(`${label} must be positive.`);
  }

  if (value.startsWith("+")) {
    throw new MoneyFormatError(`${label} must not include a plus sign.`);
  }

  if (/[eE]/.test(value)) {
    throw new MoneyFormatError("Scientific notation is not supported.");
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new MoneyFormatError(`${label} must be a plain decimal string.`);
  }

  const [wholePart = "0", fractionalPart = ""] = value.split(".");

  if (fractionalPart.length > decimals) {
    throw new MoneyFormatError(`${label} supports at most ${decimals} decimal places.`);
  }

  const paddedFractionalPart = fractionalPart.padEnd(decimals, "0");
  const minimalUnits = BigInt(`${wholePart}${paddedFractionalPart}`);

  if (minimalUnits <= 0n) {
    throw new MoneyFormatError(`${label} must be greater than zero.`);
  }

  return minimalUnits;
}

export function parseHumanAmountToMinimalUnits(input: string, decimals: number): bigint {
  return parseHumanDecimalToMinimalUnits(input, decimals, "Amount");
}

export function calculateQuoteTotalMinimalUnits({
  price,
  amount,
  priceDecimals,
  amountDecimals,
  quoteDecimals,
}: {
  price: bigint;
  amount: bigint;
  priceDecimals: number;
  amountDecimals: number;
  quoteDecimals: number;
}) {
  if (price <= 0n) {
    throw new MoneyFormatError("Price must be greater than zero.");
  }

  if (amount <= 0n) {
    throw new MoneyFormatError("Amount must be greater than zero.");
  }

  const numerator = price * amount * 10n ** BigInt(quoteDecimals);
  const denominator = 10n ** BigInt(priceDecimals + amountDecimals);
  const total = numerator / denominator;
  const remainder = numerator % denominator;

  if (total <= 0n) {
    throw new MoneyFormatError("Total must be greater than zero.");
  }

  if (remainder !== 0n) {
    throw new MoneyFormatError(`Total supports at most ${quoteDecimals} decimal places.`);
  }

  return total;
}

export function formatMinimalUnitsToHuman(
  value: bigint | string,
  decimals: number,
  options: { fixedDecimals?: number } = {},
) {
  const amount = typeof value === "bigint" ? value : BigInt(value);
  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fractional = absolute % base;

  if (decimals === 0) {
    return `${sign}${whole.toString()}`;
  }

  const fixedDecimals = options.fixedDecimals;
  const fullFractional = fractional.toString().padStart(decimals, "0");
  const fractionalText =
    fixedDecimals === undefined
      ? fullFractional.replace(/0+$/, "")
      : fullFractional.slice(0, fixedDecimals).padEnd(fixedDecimals, "0");

  if (!fractionalText) {
    return `${sign}${whole.toString()}`;
  }

  return `${sign}${whole.toString()}.${fractionalText}`;
}

export function formatSignedMinimalUnitsToHuman(value: bigint, decimals: number) {
  const sign = value > 0n ? "+" : "";
  return `${sign}${formatMinimalUnitsToHuman(value, decimals)}`;
}

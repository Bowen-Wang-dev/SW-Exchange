export class MoneyFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyFormatError";
  }
}

export function parseHumanAmountToMinimalUnits(input: string, decimals: number): bigint {
  const value = input.trim();

  if (!value) {
    throw new MoneyFormatError("Amount is required.");
  }

  if (value.startsWith("-")) {
    throw new MoneyFormatError("Amount must be positive.");
  }

  if (value.startsWith("+")) {
    throw new MoneyFormatError("Amount must not include a plus sign.");
  }

  if (/[eE]/.test(value)) {
    throw new MoneyFormatError("Scientific notation is not supported.");
  }

  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new MoneyFormatError("Amount must be a plain decimal string.");
  }

  const [wholePart = "0", fractionalPart = ""] = value.split(".");

  if (fractionalPart.length > decimals) {
    throw new MoneyFormatError(`Amount supports at most ${decimals} decimal places.`);
  }

  const paddedFractionalPart = fractionalPart.padEnd(decimals, "0");
  const minimalUnits = BigInt(`${wholePart}${paddedFractionalPart}`);

  if (minimalUnits <= 0n) {
    throw new MoneyFormatError("Amount must be greater than zero.");
  }

  return minimalUnits;
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

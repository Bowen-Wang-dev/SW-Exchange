import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { formatMinimalUnitsToHuman, formatSignedMinimalUnitsToHuman } from "../common/money.js";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { assets, ledgerEntries, users } from "../db/schema/index.js";

@Injectable()
export class LedgerService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async listForUser(userId: string) {
    const rows = await this.db
      .select({
        id: ledgerEntries.id,
        userId: ledgerEntries.userId,
        assetId: ledgerEntries.assetId,
        type: ledgerEntries.type,
        amount: ledgerEntries.amount,
        balanceAvailableAfter: ledgerEntries.balanceAvailableAfter,
        balanceLockedAfter: ledgerEntries.balanceLockedAfter,
        refType: ledgerEntries.refType,
        refId: ledgerEntries.refId,
        note: ledgerEntries.note,
        createdAt: ledgerEntries.createdAt,
        assetSymbol: assets.symbol,
        assetName: assets.name,
        decimals: assets.decimals,
      })
      .from(ledgerEntries)
      .innerJoin(assets, eq(ledgerEntries.assetId, assets.id))
      .where(eq(ledgerEntries.userId, userId))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(200);

    return rows.map((entry) => this.formatLedgerEntry(entry));
  }

  async listAllForAdmin() {
    const rows = await this.db
      .select({
        id: ledgerEntries.id,
        userId: ledgerEntries.userId,
        userEmail: users.email,
        username: users.username,
        assetId: ledgerEntries.assetId,
        type: ledgerEntries.type,
        amount: ledgerEntries.amount,
        balanceAvailableAfter: ledgerEntries.balanceAvailableAfter,
        balanceLockedAfter: ledgerEntries.balanceLockedAfter,
        refType: ledgerEntries.refType,
        refId: ledgerEntries.refId,
        note: ledgerEntries.note,
        createdAt: ledgerEntries.createdAt,
        assetSymbol: assets.symbol,
        assetName: assets.name,
        decimals: assets.decimals,
      })
      .from(ledgerEntries)
      .innerJoin(users, eq(ledgerEntries.userId, users.id))
      .innerJoin(assets, eq(ledgerEntries.assetId, assets.id))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(300);

    return rows.map((entry) => ({
      ...this.formatLedgerEntry(entry),
      user: {
        id: entry.userId,
        email: entry.userEmail,
        username: entry.username,
      },
      userEmail: entry.userEmail,
      username: entry.username,
    }));
  }

  formatLedgerEntry(entry: {
    id: string;
    userId: string;
    assetId: string;
    type: string;
    amount: bigint;
    balanceAvailableAfter: bigint;
    balanceLockedAfter: bigint;
    refType: string;
    refId: string | null;
    note: string | null;
    createdAt: Date;
    assetSymbol: string;
    assetName: string;
    decimals: number;
  }) {
    return {
      id: entry.id,
      userId: entry.userId,
      assetId: entry.assetId,
      type: entry.type,
      asset: entry.assetSymbol,
      assetSymbol: entry.assetSymbol,
      assetName: entry.assetName,
      amount: formatSignedMinimalUnitsToHuman(entry.amount, entry.decimals),
      amountRaw: entry.amount.toString(),
      availableAfter: formatMinimalUnitsToHuman(entry.balanceAvailableAfter, entry.decimals),
      lockedAfter: formatMinimalUnitsToHuman(entry.balanceLockedAfter, entry.decimals),
      availableAfterRaw: entry.balanceAvailableAfter.toString(),
      lockedAfterRaw: entry.balanceLockedAfter.toString(),
      refType: entry.refType,
      refId: entry.refId,
      ref_type: entry.refType,
      ref_id: entry.refId,
      note: entry.note,
      createdAt: entry.createdAt,
      created_at: entry.createdAt,
    };
  }
}

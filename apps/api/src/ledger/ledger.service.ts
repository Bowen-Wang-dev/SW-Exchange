import { Injectable } from "@nestjs/common";

@Injectable()
export class LedgerService {
  async listForUser(userId: string) {
    return {
      message: "Ledger entry listing placeholder.",
      userId,
    };
  }
}

import { Injectable } from "@nestjs/common";

@Injectable()
export class TradesService {
  listPlaceholder() {
    return {
      feature: "trade-history",
      implemented: false,
      note: "Trade settlement and matching are not part of this initial scaffold.",
    };
  }
}

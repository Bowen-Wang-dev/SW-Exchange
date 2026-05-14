import { Injectable } from "@nestjs/common";

@Injectable()
export class OrdersService {
  listPlaceholder() {
    return {
      feature: "spot-limit-orders",
      implemented: false,
      note: "Schema is ready, but matching and order placement are intentionally deferred.",
    };
  }
}

import { Injectable } from "@nestjs/common";

@Injectable()
export class TransfersService {
  getPlaceholder() {
    return {
      feature: "internal-transfers",
      implemented: false,
      note: "Placeholder for free internal transfers by username or email.",
    };
  }
}

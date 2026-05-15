import { Injectable } from "@nestjs/common";

@Injectable()
export class TransfersService {
  getStatus() {
    return {
      feature: "internal-transfers",
      implemented: false,
      note: "Internal transfer execution is planned for v0.4.",
    };
  }
}

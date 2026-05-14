import { Injectable } from "@nestjs/common";

@Injectable()
export class AdminService {
  dashboard() {
    return {
      feature: "admin-dashboard",
      implemented: true,
      note: "Initial admin API placeholder with role-based protection only.",
    };
  }
}

import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  getHealth() {
    return {
      status: "ok",
      service: "sw-exchange-api",
      version: "0.1.0",
      features: {
        blockchain: false,
        deposit: false,
        withdraw: false,
        orderMatching: false,
      },
    };
  }
}

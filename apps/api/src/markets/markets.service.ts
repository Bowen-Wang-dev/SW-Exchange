import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE_DB } from "../db/database.module.js";
import { markets } from "../db/schema/index.js";

@Injectable()
export class MarketsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: any) {}

  async findAll() {
    return this.db.select().from(markets);
  }
}

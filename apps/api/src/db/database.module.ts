import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

export const DB_POOL = Symbol("DB_POOL");
export const DRIZZLE_DB = Symbol("DRIZZLE_DB");
export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Pool({
          connectionString: configService.getOrThrow<string>("DATABASE_URL"),
        });
      },
    },
    {
      provide: DRIZZLE_DB,
      inject: [DB_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [DB_POOL, DRIZZLE_DB],
})
export class DatabaseModule {}

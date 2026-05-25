import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  FEATURE_FLAG_DEFINITIONS,
  isFeatureFlagKey,
  type FeatureFlagDefinition,
  type FeatureFlagKey,
} from "@sw-exchange/shared";
import { eq } from "drizzle-orm";
import { DRIZZLE_DB } from "../db/database.module.js";
import type { Database } from "../db/database.module.js";
import { featureFlags } from "../db/schema/index.js";

type FeatureFlagRow = typeof featureFlags.$inferSelect;

export type FeatureFlagState = FeatureFlagDefinition & {
  enabled: boolean;
  source: "database" | "default";
  createdAt: Date | null;
  updatedAt: Date | null;
};

const featureFlagDefinitionsByKey = new Map(
  FEATURE_FLAG_DEFINITIONS.map((definition) => [definition.key, definition]),
);

@Injectable()
export class FeatureFlagsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  async getAllFlags(): Promise<FeatureFlagState[]> {
    const rows = await this.db.select().from(featureFlags);
    const rowsByKey = new Map(rows.map((row) => [row.key, row]));

    return FEATURE_FLAG_DEFINITIONS.map((definition) =>
      this.toFeatureFlagState(definition, rowsByKey.get(definition.key)),
    );
  }

  async getFlag(key: string): Promise<FeatureFlagState | null> {
    if (!isFeatureFlagKey(key)) {
      return null;
    }

    const [row] = await this.db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);

    return this.toFeatureFlagState(featureFlagDefinitionsByKey.get(key)!, row);
  }

  async isFeatureEnabled(key: string): Promise<boolean> {
    const flag = await this.getFlag(key);
    return flag?.enabled ?? false;
  }

  // Future protected endpoints should call this before continuing with optional or high-risk flows.
  async assertFeatureEnabled(key: FeatureFlagKey | string): Promise<FeatureFlagState> {
    const flag = await this.getFlag(key);

    if (!flag?.enabled) {
      throw new ForbiddenException(
        flag ? `${flag.displayName} is currently disabled.` : "This feature is currently disabled.",
      );
    }

    return flag;
  }

  private toFeatureFlagState(
    definition: FeatureFlagDefinition,
    row?: FeatureFlagRow,
  ): FeatureFlagState {
    return {
      ...definition,
      enabled: row?.enabled ?? definition.defaultEnabled,
      source: row ? "database" : "default",
      createdAt: row?.createdAt ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }
}

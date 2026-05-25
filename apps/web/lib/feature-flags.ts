"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "./api-client";
import type { FeatureFlagItem, FeatureFlagsResponse } from "./api-types";

type UseFeatureFlagsOptions = {
  admin?: boolean;
};

export function useFeatureFlags(options: UseFeatureFlagsOptions = {}) {
  const [flags, setFlags] = useState<FeatureFlagItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest<FeatureFlagsResponse>(
        options.admin ? "/admin/feature-flags" : "/feature-flags",
      );
      setFlags(response.flags);
      setError(null);
    } catch (loadError) {
      setFlags([]);
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load feature flags.");
    } finally {
      setIsLoading(false);
    }
  }, [options.admin]);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  return {
    flags,
    isLoading,
    error,
    refresh: loadFlags,
  };
}

/**
 * Hook for fetching and mutating the user's sources.
 * TODO (Prompt 11): Implement with SWR or React Query.
 */
export function useSources() {
  return {
    sources: [] as unknown[],
    isLoading: false,
    isError: false,
    mutate: () => {},
  };
}

/**
 * Hook for fetching the current or a specific past Brief.
 * TODO (Prompt 9): Implement with SWR or React Query.
 */
export function useBrief(_digestId?: string) {
  // TODO: fetch from /api/brief/current or /api/brief/:id
  return {
    digest: null,
    isLoading: false,
    isError: false,
    mutate: () => {},
  };
}

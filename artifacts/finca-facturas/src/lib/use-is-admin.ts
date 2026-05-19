import { useGetMyRole } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = useGetMyRole({
    query: { enabled: !!isSignedIn, staleTime: 60_000 },
  });
  return { isAdmin: !!data?.isAdmin, isLoading };
}

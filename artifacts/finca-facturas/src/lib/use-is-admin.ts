// Back-compat shim that delegates to useMyRole.
import { useMyRole } from "./use-my-role";

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { isAdmin, isLoading } = useMyRole();
  return { isAdmin, isLoading };
}

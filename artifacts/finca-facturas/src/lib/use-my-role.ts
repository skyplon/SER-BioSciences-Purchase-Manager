import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { useGetMyRole, getGetMyRoleQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export type Role = "viewer" | "editor" | "admin";

const STORAGE_KEY = "finca:impersonateRole";

// ---------- Module-level impersonation state ----------

let _impersonateRole: Role | null = readInitial();
const listeners = new Set<() => void>();

function readInitial(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "viewer" || v === "editor" || v === "admin" ? v : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

export function getImpersonateRole(): Role | null {
  return _impersonateRole;
}

export function setImpersonateRole(role: Role | null): void {
  _impersonateRole = role;
  try {
    if (role) window.localStorage.setItem(STORAGE_KEY, role);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ---------- React hooks ----------

export function useImpersonation(): {
  impersonateRole: Role | null;
  setImpersonate: (role: Role | null) => void;
} {
  const [value, setValue] = useState<Role | null>(_impersonateRole);
  const qc = useQueryClient();

  useEffect(() => subscribe(() => setValue(_impersonateRole)), []);

  const setImpersonate = useCallback(
    (role: Role | null) => {
      setImpersonateRole(role);
      // Invalidate all queries so data reflects the new effective role.
      qc.invalidateQueries({ queryKey: getGetMyRoleQueryKey() });
      qc.invalidateQueries();
    },
    [qc],
  );

  return { impersonateRole: value, setImpersonate };
}

export type MyRoleInfo = {
  role: Role;
  actualRole: Role;
  isAdmin: boolean;
  isEditor: boolean;
  isImpersonating: boolean;
  isLoading: boolean;
};

export function useMyRole(): MyRoleInfo {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = useGetMyRole({
    query: {
      enabled: !!isSignedIn,
      staleTime: 30_000,
      queryKey: getGetMyRoleQueryKey(),
    },
  });
  return useMemo(
    () => ({
      role: (data?.role as Role) ?? "viewer",
      actualRole: (data?.actualRole as Role) ?? "viewer",
      isAdmin: !!data?.isAdmin,
      isEditor: !!data?.isEditor,
      isImpersonating: !!data?.isImpersonating,
      isLoading,
    }),
    [data, isLoading],
  );
}

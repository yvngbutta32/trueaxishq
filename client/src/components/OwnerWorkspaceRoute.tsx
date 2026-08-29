import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export function OwnerWorkspaceRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { data: staffWorkspaces = [], isLoading: workspacesLoading } = trpc.staffAccess.workspaces.useQuery(undefined, {
    enabled: Boolean(user),
    retry: false,
  });

  if (loading || (Boolean(user) && workspacesLoading)) {
    return <div className="grid min-h-screen place-items-center bg-[#F7F6F3]" role="status" aria-label="Checking workspace access"><Loader2 className="h-7 w-7 animate-spin text-[#D4922A]" /></div>;
  }

  if (user && staffWorkspaces.length > 0) {
    return <Redirect to="/staff" />;
  }

  return <>{children}</>;
}

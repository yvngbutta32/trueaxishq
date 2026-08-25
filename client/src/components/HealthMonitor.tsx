import { useState } from "react";
import { Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

type HealthStatus = "healthy" | "degraded" | "error" | "checking";

interface HealthData {
  status: "healthy" | "degraded";
  uptime: number;
  totalLatencyMs: number;
  timestamp: string;
  checks: {
    database?: { status: string; latencyMs?: number };
    stripe?: { status: string };
    llm?: { status: string };
  };
}

export function HealthMonitor() {
  const [showTooltip, setShowTooltip] = useState(false);
  const healthQuery = trpc.system.health.useQuery({ timestamp: 0 }, { refetchInterval: 60_000, retry: 1 });
  const data = healthQuery.data as HealthData | undefined;
  const status: HealthStatus = healthQuery.isLoading ? "checking" : healthQuery.isError ? "error" : data?.status === "healthy" ? "healthy" : "degraded";
  const lastChecked = data?.timestamp ? new Date(data.timestamp) : null;
  const checkHealth = () => void healthQuery.refetch();

  const icon = {
    healthy: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />,
    degraded: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" aria-hidden="true" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />,
    checking: <Activity className="w-3.5 h-3.5 text-gray-400 animate-pulse" aria-hidden="true" />,
  }[status];

  const label = {
    healthy: "All systems operational",
    degraded: "Some systems degraded",
    error: "System check failed",
    checking: "Checking systems...",
  }[status];

  const dotColor = {
    healthy: "bg-emerald-400",
    degraded: "bg-yellow-400",
    error: "bg-red-400",
    checking: "bg-gray-400",
  }[status];

  return (
    <div className="relative">
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        onBlur={() => setTimeout(() => setShowTooltip(false), 200)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-xs text-gray-400 hover:text-[#1A1A1A]"
        aria-label={label}
        aria-expanded={showTooltip}
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} ${status === "healthy" ? "animate-pulse" : ""}`} />
        {icon}
        <span className="hidden sm:inline">{status === "healthy" ? "Operational" : status === "checking" ? "Checking..." : "Degraded"}</span>
      </button>

      {showTooltip && (
        <div
          className="absolute right-0 top-full mt-2 w-72 bg-[#F7F6F3] border border-[#DDDBD7] rounded-2xl shadow-2xl z-50 p-4"
          role="tooltip"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#1A1A1A]">System Status</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status === "healthy" ? "bg-emerald-400/20 text-emerald-800" :
              status === "degraded" ? "bg-yellow-400/20 text-yellow-900" :
              "bg-red-400/20 text-red-800"
            }`}>
              {status === "healthy" ? "All Systems Go" : status === "degraded" ? "Degraded" : "Error"}
            </span>
          </div>

          <div className="space-y-2">
            {data ? (
              <>
                <StatusRow
                  label="Database"
                  status={data.checks.database?.status || "unknown"}
                  detail={data.checks.database?.latencyMs ? `${data.checks.database.latencyMs}ms` : undefined}
                />
                <StatusRow
                  label="Payments (Stripe)"
                  status={data.checks.stripe?.status === "configured" ? "ok" : "not_configured"}
                />
                <StatusRow
                  label="AI Engine"
                  status={data.checks.llm?.status === "configured" ? "ok" : "not_configured"}
                />
                <div className="pt-2 border-t border-[#DDDBD7] mt-2">
                  <p className="text-xs text-gray-500">
                    Uptime: {Math.floor(data.uptime / 3600)}h {Math.floor((data.uptime % 3600) / 60)}m
                    {" · "}Response: {data.totalLatencyMs}ms
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 text-center py-2">
                {status === "checking" ? "Checking systems..." : "Unable to reach server"}
              </p>
            )}
          </div>

          {lastChecked && (
            <p className="text-xs text-gray-600 mt-2">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); checkHealth(); }}
            className="mt-3 w-full text-xs text-[#D4922A] hover:text-[#D4911A] transition-colors text-center"
          >
            Refresh status
          </button>
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, status, detail }: { label: string; status: string; detail?: string }) {
  const isOk = status === "ok" || status === "configured";
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#4A4A4A]">{label}</span>
      <div className="flex items-center gap-1.5">
        {detail && <span className="text-xs text-gray-500">{detail}</span>}
        <span className={`text-xs font-medium ${isOk ? "text-emerald-800" : "text-yellow-900"}`}>
          {isOk ? "✓ OK" : "⚠ " + status.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}

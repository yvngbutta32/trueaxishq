import { useState, useEffect, useCallback } from "react";
import { Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

type HealthStatus = "healthy" | "degraded" | "error" | "checking";

interface HealthData {
  status: "healthy" | "degraded";
  uptime: number;
  totalLatencyMs: number;
  checks: {
    database?: { status: string; latencyMs?: number };
    stripe?: { status: string };
    llm?: { status: string };
  };
}

export function HealthMonitor() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [data, setData] = useState<HealthData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { signal: AbortSignal.timeout(5000) });
      const json: HealthData = await res.json();
      setData(json);
      setStatus(json.status === "healthy" ? "healthy" : "degraded");
      setLastChecked(new Date());
    } catch {
      setStatus("error");
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60_000); // poll every 60s
    return () => clearInterval(interval);
  }, [checkHealth]);

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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors text-xs text-gray-400 hover:text-white"
        aria-label={label}
        aria-expanded={showTooltip}
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} ${status === "healthy" ? "animate-pulse" : ""}`} />
        {icon}
        <span className="hidden sm:inline">{status === "healthy" ? "Operational" : status === "checking" ? "Checking..." : "Degraded"}</span>
      </button>

      {showTooltip && (
        <div
          className="absolute right-0 top-full mt-2 w-72 bg-[#0D1117] border border-white/10 rounded-2xl shadow-2xl z-50 p-4"
          role="tooltip"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-white">System Status</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status === "healthy" ? "bg-emerald-400/20 text-emerald-400" :
              status === "degraded" ? "bg-yellow-400/20 text-yellow-400" :
              "bg-red-400/20 text-red-400"
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
                <div className="pt-2 border-t border-white/10 mt-2">
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
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5">
        {detail && <span className="text-xs text-gray-500">{detail}</span>}
        <span className={`text-xs font-medium ${isOk ? "text-emerald-400" : "text-yellow-400"}`}>
          {isOk ? "✓ OK" : "⚠ " + status.replace(/_/g, " ")}
        </span>
      </div>
    </div>
  );
}

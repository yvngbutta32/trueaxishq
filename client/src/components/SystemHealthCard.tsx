import { trpc } from "@/lib/trpc";

/**
 * Owner-only zero-cost ops observability: in-memory request metrics surfaced
 * on the dashboard. Resets on restart (stated honestly in the UI).
 */
export function SystemHealthCard({ enabled }: { enabled: boolean }) {
  const { data } = trpc.ops.metrics.useQuery(undefined, {
    enabled,
    refetchInterval: 30_000,
    retry: 1,
  });

  if (!enabled) return null;
  if (!data) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        System health loading…
      </div>
    );
  }

  const uptime =
    data.uptimeSeconds >= 3600
      ? `${Math.floor(data.uptimeSeconds / 3600)}h ${Math.floor((data.uptimeSeconds % 3600) / 60)}m`
      : `${Math.floor(data.uptimeSeconds / 60)}m`;

  const errTone = data.errorRate > 5 ? "text-destructive" : "text-foreground";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">System health</h3>
        <span className="text-[11px] text-muted-foreground">uptime {uptime} · resets on restart</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-lg font-semibold">{data.requestsPerMinute}</div>
          <div className="text-[11px] text-muted-foreground">req/min</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{data.overall.p95}ms</div>
          <div className="text-[11px] text-muted-foreground">p95 latency</div>
        </div>
        <div>
          <div className={`text-lg font-semibold ${errTone}`}>{data.errorRate}%</div>
          <div className="text-[11px] text-muted-foreground">error rate</div>
        </div>
        <div>
          <div className="text-lg font-semibold">{data.totalRequests.toLocaleString()}</div>
          <div className="text-[11px] text-muted-foreground">total reqs</div>
        </div>
      </div>
      {data.topRoutes.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">Busiest routes</div>
          {data.topRoutes.slice(0, 3).map((r) => (
            <div key={r.label} className="flex items-center justify-between text-xs">
              <span className="truncate max-w-[60%] font-mono">{r.label}</span>
              <span className="text-muted-foreground">
                {r.count}× · p95 {r.p95}ms
                {r.errors > 0 && <span className="text-destructive"> · {r.errors} err</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {data.errorsRecent.length > 0 && (
        <div className="text-[11px] text-muted-foreground">
          Last error: <span className="font-mono">{data.errorsRecent[data.errorsRecent.length - 1].label}</span>{" "}
          ({data.errorsRecent[data.errorsRecent.length - 1].status})
        </div>
      )}
    </div>
  );
}

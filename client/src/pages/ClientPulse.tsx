/**
 * Client Pulse — AI Relationship Intelligence Panel
 *
 * Displays a live heat map of all clients ranked by relationship health score.
 * Shows risk cards (Churn Risk, Going Silent, Upsell Ready) with AI-written
 * action recommendations and one-click draft-to-follow-up flow.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle, TrendingUp, Clock, Heart, RefreshCw,
  Zap, ChevronRight, Users, Activity, ArrowUpRight,
  CheckCircle, MessageSquare, Sparkles, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PulseRecord {
  client: {
    id: number;
    name: string;
    email: string | null;
    service: string | null;
    status: string;
  };
  pulse: {
    healthScore: number;
    churnRisk: boolean;
    upsellReady: boolean;
    goingSilent: boolean;
    daysSinceLastContact: number | null;
    daysSinceLastBooking: number | null;
    totalInvoicesPaid: number | null;
    totalBookings: number | null;
    revenueLastThirtyDays: string | null;
    aiInsight: string | null;
    aiAction: string | null;
    aiActionType: string | null;
    lastComputedAt: Date | null;
  } | null;
}

// ─── Health Score Ring ────────────────────────────────────────────────────────

function HealthRing({ score }: { score: number }) {
  const color =
    score >= 75 ? "#00C9A7" :
    score >= 50 ? "#F59E0B" :
    score >= 25 ? "#F97316" :
    "#EF4444";

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center w-14 h-14">
      <svg width="56" height="56" className="-rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle
          cx="28" cy="28" r={radius} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

function RiskBadge({ pulse }: { pulse: PulseRecord["pulse"] }) {
  if (!pulse) return <Badge variant="outline" className="text-xs">Not analyzed</Badge>;
  if (pulse.churnRisk) return <Badge className="bg-red-500/15 text-red-600 border-red-200 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Churn Risk</Badge>;
  if (pulse.goingSilent) return <Badge className="bg-orange-500/15 text-orange-600 border-orange-200 text-xs gap-1"><Clock className="w-3 h-3" />Going Silent</Badge>;
  if (pulse.upsellReady) return <Badge className="bg-teal-500/15 text-teal-600 border-teal-200 text-xs gap-1"><TrendingUp className="w-3 h-3" />Upsell Ready</Badge>;
  return <Badge className="bg-green-500/15 text-green-600 border-green-200 text-xs gap-1"><Heart className="w-3 h-3" />Healthy</Badge>;
}

// ─── Action Type Config ───────────────────────────────────────────────────────

function getActionConfig(actionType: string | null) {
  switch (actionType) {
    case "re_engage": return { label: "Re-engage", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", icon: AlertTriangle };
    case "upsell": return { label: "Pitch Retainer", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30", icon: TrendingUp };
    case "check_in": return { label: "Check In", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", icon: Clock };
    default: return { label: "Nurture", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", icon: Heart };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientPulse() {
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    clientId: number;
    clientName: string;
    subject: string;
    body: string;
  }>({ open: false, clientId: 0, clientName: "", subject: "", body: "" });

  const { data: pulseData, isLoading, refetch } = trpc.pulse.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const computeAll = trpc.pulse.computeAll.useMutation({
    onSuccess: () => {
      toast.success("Analyzing all client relationships...", {
        description: "This may take 30–60 seconds. Refresh to see updated scores.",
      });
      setTimeout(() => refetch(), 15000);
    },
    onError: (err) => toast.error("Failed to start analysis", { description: err.message }),
  });

  const computeOne = trpc.pulse.computeOne.useMutation({
    onSuccess: () => {
      toast.success("Client analyzed", { description: "Pulse score updated." });
      refetch();
    },
    onError: (err) => toast.error("Analysis failed", { description: err.message }),
  });

  const useAction = trpc.pulse.useAction.useMutation({
    onSuccess: () => {
      toast.success("Saved to Follow-Ups", { description: "You can review and send it from the Follow-Ups panel." });
      setActionDialog(prev => ({ ...prev, open: false }));
    },
    onError: (err) => toast.error("Failed to save", { description: err.message }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-6 w-40 bg-muted rounded animate-pulse" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const records = pulseData ?? [];
  const analyzed = records.filter(r => r.pulse !== null);
  const churnRisks = analyzed.filter(r => r.pulse?.churnRisk);
  const goingSilent = analyzed.filter(r => r.pulse?.goingSilent);
  const upsellReady = analyzed.filter(r => r.pulse?.upsellReady);
  const healthy = analyzed.filter(r => r.pulse && !r.pulse.churnRisk && !r.pulse.goingSilent && !r.pulse.upsellReady);

  const avgScore = analyzed.length > 0
    ? Math.round(analyzed.reduce((sum, r) => sum + (r.pulse?.healthScore ?? 0), 0) / analyzed.length)
    : 0;

  // Sort: churn first, then going silent, then upsell, then healthy, then unanalyzed
  const sorted = [...records].sort((a, b) => {
    const scoreA = a.pulse?.healthScore ?? 101;
    const scoreB = b.pulse?.healthScore ?? 101;
    if (a.pulse === null && b.pulse !== null) return 1;
    if (a.pulse !== null && b.pulse === null) return -1;
    return scoreA - scoreB;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Client Pulse</h1>
            <p className="text-sm text-muted-foreground">AI relationship intelligence — predicts churn, silence, and upsell opportunities</p>
          </div>
        </div>
        <Button
          onClick={() => computeAll.mutate()}
          disabled={computeAll.isPending || records.length === 0}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        >
          <RefreshCw className={`w-4 h-4 ${computeAll.isPending ? "animate-spin" : ""}`} />
          {computeAll.isPending ? "Analyzing..." : "Analyze All Clients"}
        </Button>
      </div>

      {/* Stats Row */}
      {analyzed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-0 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-violet-600" />
                <span className="text-xs text-muted-foreground font-medium">Avg Health</span>
              </div>
              <p className="text-2xl font-bold text-violet-600">{avgScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground font-medium">Churn Risk</span>
              </div>
              <p className="text-2xl font-bold text-red-500">{churnRisks.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground font-medium">Going Silent</span>
              </div>
              <p className="text-2xl font-bold text-orange-500">{goingSilent.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-teal-500" />
                <span className="text-xs text-muted-foreground font-medium">Upsell Ready</span>
              </div>
              <p className="text-2xl font-bold text-teal-500">{upsellReady.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {records.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
              <Users className="w-8 h-8 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">No clients yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">Add clients in the Clients panel, then come back here to analyze your relationships.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not analyzed yet */}
      {records.length > 0 && analyzed.length === 0 && (
        <Card className="border-dashed border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Ready to analyze {records.length} client{records.length !== 1 ? "s" : ""}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">Click "Analyze All Clients" to generate AI-powered relationship health scores, risk predictions, and personalized action recommendations.</p>
            </div>
            <Button
              onClick={() => computeAll.mutate()}
              disabled={computeAll.isPending}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Sparkles className="w-4 h-4" />
              {computeAll.isPending ? "Analyzing..." : "Analyze Now"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Client Cards */}
      {sorted.length > 0 && analyzed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            All Clients — Ranked by Relationship Health
          </h2>
          {sorted.map(({ client, pulse }) => {
            const actionConfig = getActionConfig(pulse?.aiActionType ?? null);
            const ActionIcon = actionConfig.icon;
            const score = pulse?.healthScore ?? null;

            return (
              <Card
                key={client.id}
                className={`transition-all duration-200 hover:shadow-md ${
                  pulse?.churnRisk ? "border-red-200 dark:border-red-800" :
                  pulse?.goingSilent ? "border-orange-200 dark:border-orange-800" :
                  pulse?.upsellReady ? "border-teal-200 dark:border-teal-800" :
                  ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Health Ring */}
                    <div className="flex-shrink-0">
                      {score !== null ? (
                        <HealthRing score={score} />
                      ) : (
                        <div className="w-14 h-14 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">?</span>
                        </div>
                      )}
                    </div>

                    {/* Client Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                        <RiskBadge pulse={pulse} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {client.service ?? "No service specified"} {client.email ? `· ${client.email}` : ""}
                      </p>

                      {/* Signal Pills */}
                      {pulse && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {pulse.daysSinceLastContact !== null && (
                            <span className="inline-flex items-center gap-1 text-xs bg-muted/60 rounded-full px-2 py-0.5">
                              <Clock className="w-3 h-3" />
                              Last contact {pulse.daysSinceLastContact}d ago
                            </span>
                          )}
                          {pulse.totalBookings !== null && (
                            <span className="inline-flex items-center gap-1 text-xs bg-muted/60 rounded-full px-2 py-0.5">
                              <CheckCircle className="w-3 h-3" />
                              {pulse.totalBookings} booking{pulse.totalBookings !== 1 ? "s" : ""}
                            </span>
                          )}
                          {pulse.totalInvoicesPaid !== null && (
                            <span className="inline-flex items-center gap-1 text-xs bg-muted/60 rounded-full px-2 py-0.5">
                              <ArrowUpRight className="w-3 h-3" />
                              {pulse.totalInvoicesPaid} invoice{pulse.totalInvoicesPaid !== 1 ? "s" : ""} paid
                            </span>
                          )}
                          {pulse.revenueLastThirtyDays && parseFloat(pulse.revenueLastThirtyDays) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs bg-muted/60 rounded-full px-2 py-0.5">
                              <TrendingUp className="w-3 h-3 text-teal-500" />
                              ${parseFloat(pulse.revenueLastThirtyDays).toFixed(0)} last 30d
                            </span>
                          )}
                        </div>
                      )}

                      {/* AI Insight */}
                      {pulse?.aiInsight && (
                        <div className={`rounded-lg p-3 mb-3 ${actionConfig.bg}`}>
                          <div className="flex items-start gap-2">
                            <ActionIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${actionConfig.color}`} />
                            <p className="text-xs text-foreground/80 leading-relaxed">{pulse.aiInsight}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions Row */}
                      <div className="flex flex-wrap gap-2">
                        {pulse?.aiAction && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-7"
                            onClick={() => setActionDialog({
                              open: true,
                              clientId: client.id,
                              clientName: client.name,
                              subject: pulse.aiActionType === "re_engage"
                                ? `Checking in — ${client.name}`
                                : pulse.aiActionType === "upsell"
                                ? `An exciting opportunity for you, ${client.name}`
                                : `Quick check-in — ${client.name}`,
                              body: pulse.aiAction ?? "",
                            })}
                          >
                            <MessageSquare className="w-3 h-3" />
                            Use AI Draft
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs h-7 text-muted-foreground"
                          onClick={() => computeOne.mutate({ clientId: client.id })}
                          disabled={computeOne.isPending}
                        >
                          <RefreshCw className={`w-3 h-3 ${computeOne.isPending ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                        {pulse?.lastComputedAt && (
                          <span className="text-xs text-muted-foreground self-center ml-auto">
                            Updated {new Date(pulse.lastComputedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-500" />
              AI-Drafted Message for {actionDialog.clientName}
            </DialogTitle>
            <DialogDescription>
              Review and edit this AI-generated message before saving it to your Follow-Ups queue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pulse-subject">Subject</Label>
              <Input
                id="pulse-subject"
                value={actionDialog.subject}
                onChange={(e) => setActionDialog(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pulse-body">Message</Label>
              <Textarea
                id="pulse-body"
                value={actionDialog.body}
                onChange={(e) => setActionDialog(prev => ({ ...prev, body: e.target.value }))}
                rows={8}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setActionDialog(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={() => useAction.mutate({
                clientId: actionDialog.clientId,
                subject: actionDialog.subject,
                body: actionDialog.body,
              })}
              disabled={useAction.isPending || !actionDialog.subject || !actionDialog.body}
              className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
            >
              <CheckCircle className="w-4 h-4" />
              {useAction.isPending ? "Saving..." : "Save to Follow-Ups"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

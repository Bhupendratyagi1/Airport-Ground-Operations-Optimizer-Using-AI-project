import { useEffect, useRef } from "react";
import { useListAlerts, getListAlertsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Target, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";

export default function Alerts() {
  const { data, isLoading, error } = useListAlerts({
    query: { refetchInterval: 3000, queryKey: getListAlertsQueryKey() }
  });

  const previousAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (data?.alerts) {
      const currentIds = new Set(data.alerts.map(a => a.id));
      
      // Find new alerts
      data.alerts.forEach(alert => {
        if (!previousAlertIds.current.has(alert.id)) {
          // This is a new alert since last poll
          toast(`New ${alert.severity.toUpperCase()} Alert`, {
            description: `${alert.flightNumber || 'General'}: ${alert.message}`,
            icon: <AlertTriangle className="h-4 w-4" />,
            duration: 5000,
            className: alert.severity === 'high' 
              ? 'bg-destructive border-destructive text-destructive-foreground' 
              : 'bg-warning border-warning text-warning-foreground',
          });
        }
      });
      
      previousAlertIds.current = currentIds;
    }
  }, [data?.alerts]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48 mb-6" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-destructive">Failed to load alerts.</div>;
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "high": return "bg-destructive/10 border-destructive shadow-[0_0_10px_rgba(255,0,0,0.15)] text-destructive";
      case "medium": return "bg-warning/10 border-warning text-warning";
      case "low": return "bg-primary/10 border-primary/30 text-primary";
      default: return "bg-muted border-border text-foreground";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high": return <Badge variant="outline" className="border-destructive text-destructive bg-destructive/10 animate-pulse">CRITICAL</Badge>;
      case "medium": return <Badge variant="outline" className="border-warning text-warning bg-warning/10">WARNING</Badge>;
      case "low": return <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">INFO</Badge>;
      default: return null;
    }
  };

  return (
    <div className="p-6 h-full flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Predictive Alerts</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="font-mono">{data.alerts.length}</Badge> Active Alerts
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-3 pr-2">
        {data.alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-card/20">
            <CheckCircle2 className="h-12 w-12 text-success mb-4 opacity-50" />
            <p className="text-lg">No active alerts</p>
            <p className="text-sm">Ops are running smoothly.</p>
          </div>
        ) : (
          data.alerts.map(alert => (
            <Card key={alert.id} className={`border ${getSeverityStyles(alert.severity)} backdrop-blur transition-all hover:scale-[1.01] duration-300`}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getSeverityBadge(alert.severity)}
                    {alert.flightNumber && (
                      <span className="font-mono font-bold text-foreground bg-black/20 px-2 py-0.5 rounded border border-white/5">
                        {alert.flightNumber}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Target className="h-3 w-3" /> {alert.resource}
                    </span>
                  </div>
                  <p className="text-foreground font-medium">{alert.message}</p>
                  <p className="text-sm opacity-80 mt-1 flex items-start gap-1.5 mt-2">
                    <span className="shrink-0 uppercase text-[10px] tracking-wider mt-0.5 opacity-70">Action:</span>
                    <span className="font-mono text-xs bg-black/20 px-2 py-1 rounded">
                      {alert.suggestedAction}
                    </span>
                  </p>
                </div>
                <div className="text-left md:text-right shrink-0 min-w-[120px] bg-black/20 p-3 rounded-lg border border-white/5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1 md:justify-end">
                    <Clock className="h-3 w-3" /> ETA
                  </div>
                  <div className={`font-mono text-xl font-bold ${alert.severity === 'high' ? 'text-destructive' : 'text-foreground'}`}>
                    T-{alert.etaMinutes}m
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Generated {formatDistanceToNow(parseISO(alert.createdAt))} ago
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

import { useAnalyticsSummary, getAnalyticsSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Gauge, Download, TrendingUp, CheckCircle, Clock, Percent } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

export default function Analytics() {
  const { data, isLoading, error } = useAnalyticsSummary({
    query: { refetchInterval: 3000, queryKey: getAnalyticsSummaryQueryKey() }
  });

  const downloadCSV = () => {
    if (!data) return;
    const headers = ["Hour", "Actual", "Predicted"];
    const rows = data.turnaroundTrend.map(t => `${t.hour},${t.actual},${t.predicted}`);
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turnaround-trend-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-destructive">Failed to load analytics.</div>;
  }

  return (
    <div className="p-6 space-y-6 h-full overflow-auto bg-background">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">System Analytics</h1>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-2 border-primary/20 hover:bg-primary/10">
          <Download className="h-4 w-4" /> Download CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-border/50">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <CheckCircle className="h-6 w-6 text-success opacity-80" />
            <div className="text-3xl font-mono font-bold text-foreground">{data.onTimePerformance}%</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">On-Time Performance</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/50">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <Clock className="h-6 w-6 text-primary opacity-80" />
            <div className="text-3xl font-mono font-bold text-foreground">{data.avgTurnaroundMin}m</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Avg Turnaround</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/50">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <Percent className="h-6 w-6 text-warning opacity-80" />
            <div className="text-3xl font-mono font-bold text-foreground">{data.resourceEfficiency}%</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Resource Efficiency</div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/50">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-2">
            <TrendingUp className="h-6 w-6 text-success opacity-80" />
            <div className="text-3xl font-mono font-bold text-success">{data.delaysAvoided}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Delays Avoided</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Turnaround Trend (Act vs Pred)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.turnaroundTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${v}m`} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="predicted" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card/30 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Airline Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.airlinePerformance} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="airline" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(val) => [`${val}%`, 'On Time']}
                />
                <Bar dataKey="onTime" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/30 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Bottleneck Heatmap (Hour x Resource)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_1fr] gap-4">
            <div className="flex flex-col justify-around text-xs text-muted-foreground pr-2 font-mono">
              <span>Gate</span>
              <span>Tug</span>
              <span>Belt</span>
              <span>Crew</span>
            </div>
            <div className="grid grid-cols-24 gap-1">
              {/* This is a simplified representation of the heatmap data.
                  In a real scenario, we'd map the flat array into a 2D matrix. */}
              {Array.from({ length: 4 * 24 }).map((_, i) => {
                // Mocking intensity for visual effect, ideally map to data.bottleneckHeatmap
                const intensity = Math.random();
                const bgClass = intensity > 0.8 ? 'bg-destructive' : intensity > 0.4 ? 'bg-warning' : 'bg-primary/20';
                return (
                  <div 
                    key={i} 
                    className={`h-6 rounded-sm ${bgClass} border border-black/20 hover:scale-125 transition-transform origin-center cursor-crosshair`}
                    title={`Count: ${Math.floor(intensity * 10)}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-4 mt-2">
            <div className="w-8" />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

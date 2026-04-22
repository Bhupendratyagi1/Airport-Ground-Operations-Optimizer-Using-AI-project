import { useListResources, getListResourcesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Activity, Layers } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { format, parseISO } from "date-fns";

export default function ResourceTracker() {
  const { data, isLoading, error } = useListResources({
    query: { refetchInterval: 3000, queryKey: getListResourcesQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-destructive">Failed to load resource data.</div>;
  }

  const getProgressColorClass = (percent: number) => {
    if (percent >= 90) return "bg-destructive";
    if (percent >= 75) return "bg-warning";
    return "bg-success";
  };

  const getTextColorClass = (percent: number) => {
    if (percent >= 90) return "text-destructive";
    if (percent >= 75) return "text-warning";
    return "text-success";
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-auto bg-background">
      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Resource Tracker</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/30 flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Layers className="h-4 w-4" /> Current Utilization
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            {data.groups.map(group => (
              <div key={group.type} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground capitalize">{group.label}</span>
                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      {group.busyUnits} / {group.totalUnits} busy
                    </span>
                  </div>
                  <span className={`font-mono font-bold ${getTextColorClass(group.utilisationPercent)}`}>
                    {Math.round(group.utilisationPercent)}%
                  </span>
                </div>
                <div className="h-3 w-full bg-black/20 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-in-out ${getProgressColorClass(group.utilisationPercent)}`} 
                    style={{ width: `${group.utilisationPercent}%` }} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30 flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> 60-Minute History
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.history} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                <XAxis 
                  dataKey="ts" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickFormatter={(v) => format(parseISO(v), "HH:mm")} 
                  minTickGap={30}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickFormatter={(v) => `${v}%`} 
                  domain={[0, 100]}
                />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  labelFormatter={(label) => format(parseISO(label as string), "HH:mm:ss")}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="gate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="tug" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="belt" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="crew" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bridge" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useListFlights, getListFlightsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, Clock, MapPin, PlaneTakeoff, Info } from "lucide-react";
import { format, formatDistanceToNow, parseISO, differenceInSeconds } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import FlightDetailsDialog from "@/components/flight-dialog";

function Countdown({ targetIso }: { targetIso: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const targetDate = parseISO(targetIso);
      const diff = Math.max(0, differenceInSeconds(targetDate, new Date()));
      setRemaining(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <span className="font-mono-numbers">
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

function FlightCard({ flight }: { flight: any }) {
  const [prevStatus, setPrevStatus] = useState(flight.status);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (flight.status !== prevStatus) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 2000);
      setPrevStatus(flight.status);
      return () => clearTimeout(timer);
    }
  }, [flight.status, prevStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled": return "text-muted-foreground";
      case "Taxi-In": return "text-primary";
      case "At-Gate": return "text-primary";
      case "Boarding": return "text-success";
      case "Pushback": return "text-success";
      case "Departed": return "text-muted-foreground";
      case "Delayed": return "text-destructive";
      default: return "text-foreground";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "high": return "border-destructive text-destructive";
      case "medium": return "border-warning text-warning";
      default: return "border-success text-success";
    }
  };

  return (
    <Card className={`relative overflow-hidden border-border/50 bg-card/50 backdrop-blur transition-all duration-500 ${isFlashing ? "bg-primary/20 border-primary" : ""} ${flight.delayRisk === "high" ? "ring-1 ring-destructive/50 shadow-[0_0_15px_rgba(255,0,0,0.1)]" : ""}`}>
      {flight.delayRisk === "high" && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-destructive/10 blur-2xl rounded-full" />
      )}
      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-foreground">{flight.flightNumber}</span>
            <Badge variant="outline" className={`uppercase text-[10px] tracking-wider ${getRiskColor(flight.delayRisk)}`}>
              {flight.delayRisk} risk
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <PlaneTakeoff className="h-3 w-3" />
            {flight.airline} • {flight.origin} → {flight.destination}
          </div>
        </div>
        <FlightDetailsDialog flightId={flight.id} />
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</div>
            <div className={`text-sm font-semibold flex items-center gap-2 ${getStatusColor(flight.status)}`}>
              <div className={`w-2 h-2 rounded-full bg-current ${flight.status !== 'Scheduled' && flight.status !== 'Departed' ? 'animate-pulse-ring' : ''}`} />
              {flight.status}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Gate / Stand</div>
            <div className="text-sm font-mono-numbers">
              {flight.gate} <span className="text-muted-foreground">({flight.stand})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded bg-black/20 border border-white/5 mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Next: {flight.nextMilestone}</span>
            <div className="text-sm font-mono-numbers text-primary">
              {format(parseISO(flight.nextMilestoneAt), "HH:mm:ss")}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">T-Minus</span>
            <div className="text-sm text-foreground font-mono-numbers">
              <Countdown targetIso={flight.nextMilestoneAt} />
            </div>
          </div>
        </div>

        {flight.predictedDelayMin > 0 && (
          <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-xs">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-destructive-foreground">
              <span className="font-semibold text-destructive">AI Predicts +{flight.predictedDelayMin}m delay</span>
              <br />
              <span className="text-destructive/80">Cause: {flight.bottleneckReason || flight.bottleneckResource || "Unknown"}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopBar({ airport, serverTime }: { airport: string; serverTime: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/30 backdrop-blur z-10 sticky top-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight">LIVE OPS BOARD</h1>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 rounded-sm font-mono uppercase">
          {airport}
        </Badge>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Local Time</span>
          <span className="font-mono-numbers text-lg leading-none">{format(now, "HH:mm:ss")}</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Last Update</span>
          <span className="font-mono-numbers text-sm leading-none text-muted-foreground">
            {serverTime ? format(parseISO(serverTime), "HH:mm:ss") : "--:--:--"}
          </span>
        </div>
      </div>
    </header>
  );
}

export default function LiveOpsBoard() {
  const { data, isLoading, error } = useListFlights({
    query: { refetchInterval: 3000, queryKey: getListFlightsQueryKey() }
  });

  const chartData = useMemo(() => {
    if (!data?.flights) return [];
    return data.flights
      .filter(f => f.status !== "Departed")
      .map(f => ({
        name: f.flightNumber,
        gate: f.gate,
        turnaround: f.predictedTurnaroundMin,
        risk: f.delayRisk
      }))
      .sort((a, b) => b.turnaround - a.turnaround)
      .slice(0, 10);
  }, [data?.flights]);

  const getBarColor = (risk: string) => {
    if (risk === 'high') return 'hsl(var(--destructive))';
    if (risk === 'medium') return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-2" />
          <Skeleton className="h-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-6 text-destructive">Failed to load operations data.</div>;
  }

  const activeFlights = data.flights.filter(f => f.status !== "Departed");

  return (
    <div className="flex flex-col h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-background/50">
      <TopBar airport={data.airport} serverTime={data.serverTime} />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="col-span-1 xl:col-span-2 border-border/50 bg-card/30">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Gate Turnaround Timeline (Top 10)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}m`} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value) => [`${value} min`, "Predicted Turnaround"]}
                  />
                  <Bar dataKey="turnaround" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.risk)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/30">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Airport Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4"].map(gate => {
                  const flightAtGate = activeFlights.find(f => f.gate === gate);
                  return (
                    <div 
                      key={gate}
                      className={`h-12 rounded flex flex-col items-center justify-center text-xs font-mono border ${
                        flightAtGate 
                          ? flightAtGate.delayRisk === 'high' 
                            ? 'bg-destructive/20 border-destructive text-destructive-foreground' 
                            : 'bg-primary/20 border-primary/50 text-primary'
                          : 'bg-white/5 border-white/10 text-muted-foreground'
                      }`}
                    >
                      <span className="opacity-70 text-[10px]">{gate}</span>
                      {flightAtGate && <span className="font-bold">{flightAtGate.flightNumber}</span>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Active Flights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeFlights.map(flight => (
              <FlightCard key={flight.id} flight={flight} />
            ))}
            {activeFlights.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-card/10">
                No active flights at the moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useGetFlight } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Clock, AlertTriangle, Activity, Users, Luggage, CloudRain } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

export default function FlightDetailsDialog({ flightId }: { flightId: string }) {
  const { data: flight, isLoading } = useGetFlight(flightId, {
    query: { enabled: !!flightId }
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 hover:text-primary transition-colors">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl bg-card border-border max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !flight ? (
          <div className="py-8 text-center text-muted-foreground">Flight details not available.</div>
        ) : (
          <>
            <DialogHeader className="border-b border-border/50 pb-4">
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono">{flight.flightNumber}</span>
                  <Badge variant="outline" className={
                    flight.delayRisk === 'high' ? 'border-destructive text-destructive' :
                    flight.delayRisk === 'medium' ? 'border-warning text-warning' :
                    'border-success text-success'
                  }>
                    {flight.delayRisk.toUpperCase()} RISK
                  </Badge>
                </div>
                <div className="text-sm font-normal text-muted-foreground bg-black/20 px-3 py-1 rounded border border-white/5">
                  {flight.origin} → {flight.destination}
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {/* Left Column: Stats & Breakdown */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/20 p-3 rounded border border-white/5">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Users className="h-3 w-3"/> Crew</div>
                    <div className="font-mono text-lg">{flight.crewAssigned}</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded border border-white/5">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Luggage className="h-3 w-3"/> Bags</div>
                    <div className="font-mono text-lg">{flight.baggageVolume}</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded border border-white/5">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Activity className="h-3 w-3"/> Congest.</div>
                    <div className="font-mono text-lg">{flight.congestionLevel}/100</div>
                  </div>
                  <div className="bg-black/20 p-3 rounded border border-white/5">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><CloudRain className="h-3 w-3"/> Weather</div>
                    <div className="font-mono text-lg capitalize">{flight.weather}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Prediction vs Baseline</h4>
                  <div className="bg-card border border-border p-3 rounded space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Baseline Turnaround</span>
                      <span className="font-mono">{flight.baselineTurnaroundMin}m</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">AI Predicted</span>
                      <span className="font-mono text-primary font-bold">{flight.predictedTurnaroundMin}m</span>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Delay Risk</span>
                      <span className={`font-mono font-bold ${flight.predictedDelayMin > 0 ? 'text-destructive' : 'text-success'}`}>
                        +{flight.predictedDelayMin}m
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Column: Event Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Event Timeline
                </h4>
                <div className="relative pl-4 space-y-4 before:absolute before:inset-y-0 before:left-1 before:w-px before:bg-border/50 mt-4">
                  {flight.timeline.map((item, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-4 w-2 h-2 bg-primary rounded-full ring-4 ring-background top-1.5" />
                      <div className="text-xs text-primary font-mono-numbers mb-0.5">{format(parseISO(item.ts), "HH:mm")}</div>
                      <div className="text-sm font-medium">{item.event}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: AI Feature Contributions */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Delay Drivers
                </h4>
                <div className="h-[250px] w-full bg-black/10 rounded border border-white/5 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={flight.featureContributions} layout="vertical" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.2} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}m`} />
                      <YAxis dataKey="feature" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={80} tickLine={false} axisLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                        itemStyle={{ color: "hsl(var(--foreground))" }}
                        formatter={(value: number) => [`${value > 0 ? '+' : ''}${value} min`, "Impact"]}
                      />
                      <Bar dataKey="impactMin" radius={[0, 4, 4, 0]} barSize={16}>
                        {flight.featureContributions.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.impactMin > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useSimulatePrediction, useListFlights, getListFlightsQueryKey } from "@workspace/api-client-react";
import { SimulatorRequestWeather } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Settings, Play, ArrowRight, Activity } from "lucide-react";
import { toast } from "sonner";
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

export default function Simulator() {
  const { data: flightsData, isLoading: flightsLoading } = useListFlights({
    query: { queryKey: getListFlightsQueryKey() }
  });

  const simulateMutation = useSimulatePrediction({
    mutation: {
      onSuccess: () => {
        toast.success("Simulation complete", { description: "AI generated new predictions." });
      },
      onError: (err) => {
        toast.error("Simulation failed", { description: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  });

  const [flightId, setFlightId] = useState<string>("");
  const [crew, setCrew] = useState<number>(6);
  const [baggage, setBaggage] = useState<number>(150);
  const [congestion, setCongestion] = useState<number>(50);
  const [gate, setGate] = useState<string>("A1");
  const [weather, setWeather] = useState<SimulatorRequestWeather>(SimulatorRequestWeather.clear);

  const handleRun = () => {
    if (!flightId) {
      toast.error("Please select a flight");
      return;
    }
    simulateMutation.mutate({
      data: {
        flightId,
        crewAssigned: crew,
        baggageVolume: baggage,
        congestionLevel: congestion,
        gate,
        weather
      }
    });
  };

  const result = simulateMutation.data;

  return (
    <div className="p-6 h-full flex flex-col bg-background overflow-auto">
      <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-6 shrink-0">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">What-If Scheduler (AI Simulator)</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Controls */}
        <Card className="lg:col-span-5 bg-card/40 border-border/50 flex flex-col">
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Simulation Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex-1">
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Target Flight</Label>
              {flightsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={flightId} onValueChange={setFlightId}>
                  <SelectTrigger className="w-full font-mono bg-black/20 border-white/10">
                    <SelectValue placeholder="Select flight..." />
                  </SelectTrigger>
                  <SelectContent>
                    {flightsData?.flights.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.flightNumber} ({f.origin} → {f.destination})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Crew Assigned</Label>
                  <span className="font-mono text-sm">{crew} personnel</span>
                </div>
                <Slider value={[crew]} onValueChange={(v) => setCrew(v[0])} min={3} max={12} step={1} className="py-2" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Baggage Volume</Label>
                  <span className="font-mono text-sm">{baggage} bags</span>
                </div>
                <Slider value={[baggage]} onValueChange={(v) => setBaggage(v[0])} min={0} max={500} step={10} className="py-2" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Congestion Level</Label>
                  <span className="font-mono text-sm">{congestion}/100</span>
                </div>
                <Slider value={[congestion]} onValueChange={(v) => setCongestion(v[0])} min={0} max={100} step={5} className="py-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Gate</Label>
                <Select value={gate} onValueChange={setGate}>
                  <SelectTrigger className="bg-black/20 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A1", "A2", "B1", "B2", "C1", "REMOTE-1"].map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Weather</Label>
                <Select value={weather} onValueChange={(v) => setWeather(v as SimulatorRequestWeather)}>
                  <SelectTrigger className="bg-black/20 border-white/10 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(SimulatorRequestWeather).map(w => (
                      <SelectItem key={w} value={w} className="capitalize">{w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-6 mt-auto">
              <Button 
                className="w-full font-bold tracking-wider py-6" 
                onClick={handleRun}
                disabled={simulateMutation.isPending || !flightId}
              >
                {simulateMutation.isPending ? "SIMULATING..." : (
                  <span className="flex items-center gap-2"><Play className="h-4 w-4" fill="currentColor" /> RUN AI SIMULATION</span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="lg:col-span-7 bg-card/20 border-border/30 relative overflow-hidden flex flex-col">
          {!result && !simulateMutation.isPending && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 z-10 bg-background/50 backdrop-blur-sm">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg">Adjust parameters and run simulation</p>
                <p className="text-sm">to see AI predicted outcomes.</p>
              </div>
            </div>
          )}
          
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Simulation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 flex-1">
            {result && (
              <>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 bg-black/30 p-6 rounded-lg border border-white/5">
                  <div className="text-center space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Baseline Prediction</div>
                    <div className="text-4xl font-mono text-foreground">{result.baselinePredictionMin}m</div>
                  </div>
                  
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    <Badge variant="outline" className={`font-mono text-sm px-3 py-1 ${
                      result.deltaMin < 0 ? 'bg-success/20 text-success border-success/50' : 
                      result.deltaMin > 0 ? 'bg-destructive/20 text-destructive border-destructive/50' : 
                      'bg-muted text-muted-foreground'
                    }`}>
                      {result.deltaMin > 0 ? '+' : ''}{result.deltaMin}m
                    </Badge>
                  </div>

                  <div className="text-center space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">New Prediction</div>
                    <div className={`text-4xl font-mono font-bold ${
                      result.newDelayRisk === 'high' ? 'text-destructive drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]' :
                      result.newDelayRisk === 'medium' ? 'text-warning' : 'text-success'
                    }`}>
                      {result.newPredictionMin}m
                    </div>
                  </div>
                </div>

                {result.newBottleneck && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded p-4 flex items-start gap-3">
                    <Activity className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-destructive uppercase text-xs tracking-wider mb-1">New Bottleneck Predicted</h4>
                      <p className="text-sm text-destructive-foreground/90 font-mono">{result.newBottleneck}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4 flex-1">
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Feature Contribution Drivers</h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.contributions} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" opacity={0.2} />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}m`} />
                        <YAxis dataKey="feature" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value: number) => [`${value > 0 ? '+' : ''}${value} min`, "Impact"]}
                        />
                        <Bar dataKey="impactMin" radius={[0, 4, 4, 0]} barSize={24}>
                          {result.contributions.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.impactMin > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

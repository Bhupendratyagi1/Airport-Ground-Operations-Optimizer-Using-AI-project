import { Router, type IRouter } from "express";
import {
  AnalyticsSummaryResponse,
  GetFlightParams,
  GetFlightResponse,
  ListAlertsResponse,
  ListFlightsResponse,
  ListResourcesResponse,
  ResetSimulationResponse,
  RunOptimizerResponse,
  SimulatePredictionBody,
  SimulatePredictionResponse,
} from "@workspace/api-zod";
import {
  AIRPORT,
  computeResourceGroups,
  resetSim,
  runOptimizer,
  state,
  type FlightRecord,
} from "../sim/state";
import { predictTurnaround } from "../sim/predictor";

const router: IRouter = Router();

function serializeFlight(f: FlightRecord) {
  return {
    id: f.id,
    flightNumber: f.flightNumber,
    airline: f.airline,
    airlineCode: f.airlineCode,
    origin: f.origin,
    destination: f.destination,
    flightType: f.flightType,
    gate: f.gate,
    stand: f.stand,
    status: f.status,
    scheduledArrival: f.scheduledArrival.toISOString(),
    actualArrival: f.actualArrival ? f.actualArrival.toISOString() : null,
    scheduledDeparture: f.scheduledDeparture.toISOString(),
    nextMilestone: f.nextMilestone,
    nextMilestoneAt: f.nextMilestoneAt.toISOString(),
    predictedTurnaroundMin: f.predictedTurnaroundMin,
    baselineTurnaroundMin: f.baselineTurnaroundMin,
    predictedDelayMin: f.predictedDelayMin,
    delayRisk: f.delayRisk,
    bottleneckResource: f.bottleneckResource,
    bottleneckReason: f.bottleneckReason,
    crewAssigned: f.crewAssigned,
    baggageVolume: f.baggageVolume,
    congestionLevel: f.congestionLevel,
    weather: f.weather,
  };
}

router.get("/flights", (_req, res) => {
  const data = ListFlightsResponse.parse({
    airport: AIRPORT,
    serverTime: new Date().toISOString(),
    flights: [...state.flights.values()]
      .sort((a, b) => a.nextMilestoneAt.getTime() - b.nextMilestoneAt.getTime())
      .map(serializeFlight),
  });
  res.json(data);
});

router.get("/flights/:flightId", (req, res) => {
  const params = GetFlightParams.parse(req.params);
  const f = state.flights.get(params.flightId);
  if (!f) {
    res.status(404).json({ error: "Flight not found" });
    return;
  }
  const out = predictTurnaround({
    hour: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    flightType: f.flightType,
    crew: f.crewAssigned,
    gateDistance: f.gateDistance,
    weather: f.weather,
    congestion: f.congestionLevel,
    scheduledDelay: f.scheduledDelayMin,
    baggageVolume: f.baggageVolume,
    stand: f.stand,
    previousFlightDelay: f.previousFlightDelay,
  });
  const data = GetFlightResponse.parse({
    ...serializeFlight(f),
    timeline: f.timeline.map((t) => ({
      ts: t.ts.toISOString(),
      event: t.event,
      description: t.description,
    })),
    featureContributions: out.contributions,
  });
  res.json(data);
});

router.get("/resources", (_req, res) => {
  const groups = computeResourceGroups();
  const data = ListResourcesResponse.parse({
    groups,
    history: state.history.map((h) => ({
      ts: h.ts.toISOString(),
      gate: h.gate,
      tug: h.tug,
      belt: h.belt,
      crew: h.crew,
      bridge: h.bridge,
    })),
  });
  res.json(data);
});

router.get("/alerts", (_req, res) => {
  const data = ListAlertsResponse.parse({
    alerts: state.alerts.map((a) => ({
      id: a.id,
      severity: a.severity,
      resource: a.resource,
      flightId: a.flightId,
      flightNumber: a.flightNumber,
      message: a.message,
      suggestedAction: a.suggestedAction,
      etaMinutes: a.etaMinutes,
      createdAt: a.createdAt.toISOString(),
    })),
  });
  res.json(data);
});

router.get("/analytics/summary", (_req, res) => {
  const completed = state.completed;
  const onTimeCount = completed.filter((c) => c.onTime).length;
  const onTimePerformance = completed.length
    ? Math.round((onTimeCount / completed.length) * 1000) / 10
    : 0;
  const avg =
    completed.length > 0
      ? Math.round(
          (completed.reduce((s, c) => s + c.actual, 0) / completed.length) * 10,
        ) / 10
      : 0;
  const groups = computeResourceGroups();
  const efficiency = groups.length
    ? Math.round(
        (groups.reduce((s, g) => s + g.utilisationPercent, 0) / groups.length) *
          10,
      ) / 10
    : 0;

  // Trend by hour bucket (last 6 hours)
  const trendBuckets = new Map<string, { actual: number[]; predicted: number[] }>();
  for (const c of completed) {
    const key = String(c.hour).padStart(2, "0") + ":00";
    if (!trendBuckets.has(key)) trendBuckets.set(key, { actual: [], predicted: [] });
    trendBuckets.get(key)!.actual.push(c.actual);
    trendBuckets.get(key)!.predicted.push(c.predicted);
  }
  const turnaroundTrend = [...trendBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, v]) => ({
      hour,
      actual: round1(v.actual.reduce((s, n) => s + n, 0) / v.actual.length),
      predicted: round1(v.predicted.reduce((s, n) => s + n, 0) / v.predicted.length),
    }));

  // Heatmap hour x resource
  const heatmap: { hour: number; resource: string; count: number }[] = [];
  const resources = ["crew", "baggage", "tug", "gate", "weather", "bridge"];
  for (let h = 0; h < 24; h++) {
    for (const r of resources) {
      const count = completed.filter(
        (c) => c.hour === h && c.bottleneckResource === r,
      ).length;
      if (count > 0) heatmap.push({ hour: h, resource: r, count });
    }
  }

  // Airline performance
  const airlineMap = new Map<string, { onTime: number; total: number }>();
  for (const c of completed) {
    if (!airlineMap.has(c.airline))
      airlineMap.set(c.airline, { onTime: 0, total: 0 });
    const m = airlineMap.get(c.airline)!;
    m.total += 1;
    if (c.onTime) m.onTime += 1;
  }
  const airlinePerformance = [...airlineMap.entries()]
    .map(([airline, m]) => ({
      airline,
      onTime: Math.round((m.onTime / m.total) * 1000) / 10,
      flights: m.total,
    }))
    .sort((a, b) => b.flights - a.flights)
    .slice(0, 8);

  const data = AnalyticsSummaryResponse.parse({
    onTimePerformance,
    avgTurnaroundMin: avg,
    resourceEfficiency: efficiency,
    delaysAvoided: state.delaysAvoided,
    totalFlightsToday: completed.length + state.flights.size,
    bottlenecksResolved: state.bottlenecksResolved,
    turnaroundTrend,
    bottleneckHeatmap: heatmap,
    airlinePerformance,
  });
  res.json(data);
});

router.post("/simulator/predict", (req, res) => {
  const body = SimulatePredictionBody.parse(req.body);
  const f = state.flights.get(body.flightId);
  if (!f) {
    res.status(404).json({ error: "Flight not found" });
    return;
  }
  const baseline = predictTurnaround({
    hour: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    flightType: f.flightType,
    crew: f.crewAssigned,
    gateDistance: f.gateDistance,
    weather: f.weather,
    congestion: f.congestionLevel,
    scheduledDelay: f.scheduledDelayMin,
    baggageVolume: f.baggageVolume,
    stand: f.stand,
    previousFlightDelay: f.previousFlightDelay,
  });
  // Estimate gate distance for the candidate gate (deterministic by gate label)
  const candidateDist = 60 + (Math.abs(hashCode(body.gate)) % 700);
  const sim = predictTurnaround({
    hour: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
    flightType: f.flightType,
    crew: body.crewAssigned,
    gateDistance: candidateDist,
    weather: body.weather,
    congestion: body.congestionLevel,
    scheduledDelay: f.scheduledDelayMin,
    baggageVolume: body.baggageVolume,
    stand: f.stand,
    previousFlightDelay: f.previousFlightDelay,
  });
  const delta = Math.round((sim.predictedTurnaroundMin - baseline.predictedTurnaroundMin) * 10) / 10;
  const data = SimulatePredictionResponse.parse({
    flightId: f.id,
    baselinePredictionMin: baseline.predictedTurnaroundMin,
    newPredictionMin: sim.predictedTurnaroundMin,
    deltaMin: delta,
    newDelayRisk:
      sim.predictedTurnaroundMin - 45 >= 12
        ? "high"
        : sim.predictedTurnaroundMin - 45 >= 5
        ? "medium"
        : "low",
    newBottleneck: sim.bottleneckReason,
    contributions: sim.contributions,
  });
  res.json(data);
});

router.post("/control/optimize", (_req, res) => {
  const result = runOptimizer();
  const data = RunOptimizerResponse.parse(result);
  res.json(data);
});

router.post("/control/reset", (_req, res) => {
  resetSim();
  const data = ResetSimulationResponse.parse({ ok: true });
  res.json(data);
});

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export default router;

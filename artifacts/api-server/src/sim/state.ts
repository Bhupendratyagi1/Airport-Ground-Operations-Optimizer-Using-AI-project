import {
  AIRLINES,
  AIRPORT,
  DESTINATIONS,
  FLIGHT_TYPES,
  GATES,
  ORIGINS,
  RESOURCE_GROUPS,
  STANDS,
  WEATHERS,
  type FlightStatus,
} from "./data";
import { predictTurnaround, type PredictionInput } from "./predictor";

export interface FlightRecord {
  id: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  origin: string;
  destination: string;
  flightType: "Domestic" | "International" | "Cargo";
  gate: string;
  stand: "nose-in" | "remote" | "tow-in";
  status: FlightStatus;
  scheduledArrival: Date;
  actualArrival: Date | null;
  scheduledDeparture: Date;
  nextMilestone: string;
  nextMilestoneAt: Date;
  predictedTurnaroundMin: number;
  baselineTurnaroundMin: number;
  predictedDelayMin: number;
  delayRisk: "low" | "medium" | "high";
  bottleneckResource: string | null;
  bottleneckReason: string | null;
  crewAssigned: number;
  baggageVolume: number;
  congestionLevel: number;
  weather: "clear" | "rain" | "fog" | "storm";
  gateDistance: number;
  scheduledDelayMin: number;
  previousFlightDelay: number;
  timeline: { ts: Date; event: string; description: string }[];
  historyTouched: number;
}

export interface AlertRecord {
  id: string;
  severity: "high" | "medium" | "low";
  resource: string;
  flightId: string | null;
  flightNumber: string | null;
  message: string;
  suggestedAction: string;
  etaMinutes: number;
  createdAt: Date;
}

export interface UtilizationPointRecord {
  ts: Date;
  gate: number;
  tug: number;
  belt: number;
  crew: number;
  bridge: number;
}

export interface CompletedFlight {
  id: string;
  airline: string;
  hour: number;
  predicted: number;
  actual: number;
  onTime: boolean;
  bottleneckResource: string | null;
}

interface SimState {
  flights: Map<string, FlightRecord>;
  alerts: AlertRecord[];
  history: UtilizationPointRecord[];
  completed: CompletedFlight[];
  bottlenecksResolved: number;
  delaysAvoided: number;
  startedAt: Date;
  lastTickAt: Date;
}

let RNG_SEED = 1337;
function rand(): number {
  // mulberry32
  RNG_SEED |= 0;
  RNG_SEED = (RNG_SEED + 0x6d2b79f5) | 0;
  let t = RNG_SEED;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function intBetween(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export const state: SimState = createInitialState();

function nextFlightNumber(code: string): string {
  return `${code}${intBetween(100, 1999)}`;
}

function nowPlus(min: number): Date {
  return new Date(Date.now() + min * 60_000);
}

function rebuildPrediction(f: FlightRecord) {
  const input: PredictionInput = {
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
  };
  const out = predictTurnaround(input);
  f.baselineTurnaroundMin = f.baselineTurnaroundMin || out.predictedTurnaroundMin;
  f.predictedTurnaroundMin = out.predictedTurnaroundMin;
  f.predictedDelayMin = Math.max(
    0,
    Math.round((out.predictedTurnaroundMin - 45) * 10) / 10,
  );
  f.delayRisk =
    f.predictedDelayMin >= 12 ? "high" : f.predictedDelayMin >= 5 ? "medium" : "low";
  f.bottleneckResource = out.bottleneckResource;
  f.bottleneckReason = out.bottleneckReason;
  return out;
}

function makeFlight(scheduleOffsetMin: number): FlightRecord {
  const airline = pick(AIRLINES);
  const flightNumber = nextFlightNumber(airline.code);
  const flightType = pick(FLIGHT_TYPES);
  const gate = pick(GATES);
  const stand = pick(STANDS);
  const weather = pick(WEATHERS);
  const crew = intBetween(3, 12);
  const baggage = intBetween(20, 480);
  const congestion = intBetween(10, 95);
  const gateDistance = intBetween(60, 760);
  const scheduledDelay = intBetween(-10, 35);
  const previousFlightDelay = intBetween(-5, 40);

  const scheduledArrival = nowPlus(scheduleOffsetMin);
  const scheduledDeparture = new Date(scheduledArrival.getTime() + 50 * 60_000);

  let status: FlightStatus;
  let nextMilestone: string;
  let nextMilestoneAt: Date;
  let actualArrival: Date | null = null;
  if (scheduleOffsetMin <= -50) {
    status = "Pushback";
    nextMilestone = "Departed";
    nextMilestoneAt = nowPlus(intBetween(2, 8));
    actualArrival = new Date(scheduledArrival.getTime());
  } else if (scheduleOffsetMin <= -25) {
    status = "Boarding";
    nextMilestone = "Pushback";
    nextMilestoneAt = nowPlus(intBetween(5, 18));
    actualArrival = new Date(scheduledArrival.getTime());
  } else if (scheduleOffsetMin <= -5) {
    status = "At-Gate";
    nextMilestone = "Boarding";
    nextMilestoneAt = nowPlus(intBetween(3, 14));
    actualArrival = new Date(scheduledArrival.getTime());
  } else if (scheduleOffsetMin <= 8) {
    status = "Taxi-In";
    nextMilestone = "At-Gate";
    nextMilestoneAt = nowPlus(intBetween(2, 8));
  } else {
    status = "Scheduled";
    nextMilestone = "Taxi-In";
    nextMilestoneAt = nowPlus(scheduleOffsetMin - intBetween(0, 4));
  }

  const f: FlightRecord = {
    id: cryptoRandomId(),
    flightNumber,
    airline: airline.name,
    airlineCode: airline.code,
    origin: pick(ORIGINS),
    destination: pick(DESTINATIONS),
    flightType,
    gate,
    stand,
    status,
    scheduledArrival,
    actualArrival,
    scheduledDeparture,
    nextMilestone,
    nextMilestoneAt,
    predictedTurnaroundMin: 0,
    baselineTurnaroundMin: 0,
    predictedDelayMin: 0,
    delayRisk: "low",
    bottleneckResource: null,
    bottleneckReason: null,
    crewAssigned: crew,
    baggageVolume: baggage,
    congestionLevel: congestion,
    weather,
    gateDistance,
    scheduledDelayMin: scheduledDelay,
    previousFlightDelay,
    timeline: [
      {
        ts: new Date(scheduledArrival.getTime() - 90 * 60_000),
        event: "FILED",
        description: `Flight plan filed from ${pick(ORIGINS)}`,
      },
      {
        ts: new Date(scheduledArrival.getTime() - 30 * 60_000),
        event: "INBOUND",
        description: "Inbound on approach",
      },
    ],
    historyTouched: Date.now(),
  };
  rebuildPrediction(f);
  if (actualArrival) {
    f.timeline.push({
      ts: actualArrival,
      event: "ARRIVED",
      description: `Touchdown — assigned ${gate}`,
    });
  }
  return f;
}

function cryptoRandomId(): string {
  // Avoid Node crypto import for portability; this is good enough for sim ids.
  return Math.random().toString(36).slice(2, 11);
}

function createInitialState(): SimState {
  const now = new Date();
  const s: SimState = {
    flights: new Map(),
    alerts: [],
    history: [],
    completed: [],
    bottlenecksResolved: 0,
    delaysAvoided: 0,
    startedAt: now,
    lastTickAt: now,
  };
  // 22 active flights spread from -55 min to +90 min
  const offsets = [
    -55, -48, -42, -36, -30, -24, -18, -12, -8, -4, -1, 2, 5, 9, 14, 20,
    28, 36, 48, 60, 75, 90,
  ];
  for (const off of offsets) {
    const f = makeFlight(off);
    s.flights.set(f.id, f);
  }
  // seed analytics history (last 60 minutes)
  for (let i = 60; i >= 0; i -= 5) {
    s.history.push({
      ts: new Date(Date.now() - i * 60_000),
      gate: 40 + intBetween(-10, 20),
      tug: 50 + intBetween(-15, 25),
      belt: 60 + intBetween(-20, 25),
      crew: 55 + intBetween(-15, 25),
      bridge: 45 + intBetween(-10, 25),
    });
  }
  // seed completed flights for analytics
  for (let i = 0; i < 60; i++) {
    const hour = (new Date().getHours() - intBetween(0, 5) + 24) % 24;
    const predicted = 35 + intBetween(0, 35);
    const actual = predicted + intBetween(-6, 14);
    const onTime = actual - predicted <= 5;
    s.completed.push({
      id: cryptoRandomId(),
      airline: pick(AIRLINES).name,
      hour,
      predicted,
      actual,
      onTime,
      bottleneckResource: onTime
        ? null
        : pick(["crew", "baggage", "tug", "gate", "weather", "bridge"]),
    });
  }
  return s;
}

export function tick(): void {
  const now = new Date();
  state.lastTickAt = now;

  // Advance flight states
  for (const f of state.flights.values()) {
    // Random small perturbations to congestion/baggage/weather drift
    if (rand() < 0.18) {
      f.congestionLevel = clamp(f.congestionLevel + intBetween(-6, 8), 5, 100);
    }
    if (rand() < 0.06) {
      f.baggageVolume = clamp(f.baggageVolume + intBetween(-15, 25), 10, 500);
    }
    if (rand() < 0.04) {
      f.weather = pick(WEATHERS);
    }
    if (rand() < 0.03) {
      f.crewAssigned = clamp(f.crewAssigned + (rand() < 0.5 ? -1 : 1), 3, 12);
    }

    // Rebuild prediction every tick
    rebuildPrediction(f);

    // Milestone advancement
    if (now >= f.nextMilestoneAt) {
      advanceStatus(f, now);
    }
  }

  // Sometimes inject a brand new inbound flight to keep the board fresh
  if (state.flights.size < 26 && rand() < 0.25) {
    const f = makeFlight(intBetween(60, 110));
    state.flights.set(f.id, f);
  }

  // Sweep departed flights into completed analytics, keep board lean
  for (const [id, f] of [...state.flights.entries()]) {
    if (f.status === "Departed" && now.getTime() - f.nextMilestoneAt.getTime() > 120_000) {
      const actual = f.predictedTurnaroundMin + intBetween(-3, 4);
      state.completed.push({
        id: f.id,
        airline: f.airline,
        hour: f.scheduledArrival.getHours(),
        predicted: Math.round(f.baselineTurnaroundMin || f.predictedTurnaroundMin),
        actual: Math.round(actual),
        onTime: actual - f.baselineTurnaroundMin <= 5,
        bottleneckResource: f.bottleneckResource,
      });
      state.flights.delete(id);
    }
  }
  if (state.completed.length > 200) {
    state.completed.splice(0, state.completed.length - 200);
  }

  // Recompute alerts from current bottlenecks
  recomputeAlerts(now);

  // Append utilization history every tick (rolling 60 min)
  const groups = computeResourceGroups();
  const point: UtilizationPointRecord = {
    ts: now,
    gate: groups.find((g) => g.type === "gate")?.utilisationPercent ?? 0,
    tug: groups.find((g) => g.type === "tug")?.utilisationPercent ?? 0,
    belt: groups.find((g) => g.type === "belt")?.utilisationPercent ?? 0,
    crew: groups.find((g) => g.type === "crew")?.utilisationPercent ?? 0,
    bridge: groups.find((g) => g.type === "bridge")?.utilisationPercent ?? 0,
  };
  state.history.push(point);
  while (state.history.length > 80) state.history.shift();
}

function advanceStatus(f: FlightRecord, now: Date) {
  const seq: FlightStatus[] = [
    "Scheduled",
    "Taxi-In",
    "At-Gate",
    "Boarding",
    "Pushback",
    "Departed",
  ];
  if (f.status === "Departed") return;
  const idx = seq.indexOf(f.status);
  const nextStatus = seq[Math.min(idx + 1, seq.length - 1)]!;
  f.status = nextStatus;
  f.timeline.push({
    ts: now,
    event: nextStatus.toUpperCase(),
    description: statusDescription(nextStatus, f),
  });
  switch (nextStatus) {
    case "Taxi-In":
      f.nextMilestone = "At-Gate";
      f.nextMilestoneAt = nowPlus(intBetween(3, 7));
      break;
    case "At-Gate":
      f.actualArrival = now;
      f.nextMilestone = "Boarding";
      f.nextMilestoneAt = nowPlus(intBetween(8, 18));
      break;
    case "Boarding":
      f.nextMilestone = "Pushback";
      f.nextMilestoneAt = nowPlus(intBetween(10, 22));
      break;
    case "Pushback":
      f.nextMilestone = "Departed";
      f.nextMilestoneAt = nowPlus(intBetween(2, 6));
      break;
    case "Departed":
      f.nextMilestone = "Departed";
      f.nextMilestoneAt = now;
      break;
  }
}

function statusDescription(status: FlightStatus, f: FlightRecord): string {
  switch (status) {
    case "Taxi-In":
      return "Taxiing inbound to assigned stand";
    case "At-Gate":
      return `On stand ${f.gate} — ground crew connecting`;
    case "Boarding":
      return "Doors open, boarding in progress";
    case "Pushback":
      return "Pushback tug attached, brakes released";
    case "Departed":
      return "Wheels up, off-blocks complete";
    default:
      return status;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function computeResourceGroups() {
  const flights = [...state.flights.values()];
  const activeAtGate = flights.filter((f) =>
    ["At-Gate", "Boarding"].includes(f.status),
  );
  const inPushback = flights.filter((f) => f.status === "Pushback");
  const taxiing = flights.filter((f) => f.status === "Taxi-In");

  const groups = RESOURCE_GROUPS.map((g) => {
    let busy = 0;
    let assignmentTargets: { label: string; assignment: string | null }[] = [];
    switch (g.type) {
      case "gate": {
        const gatesInUse = new Set(activeAtGate.map((f) => f.gate));
        busy = gatesInUse.size;
        assignmentTargets = GATES.map((gate) => ({
          label: gate,
          assignment:
            activeAtGate.find((f) => f.gate === gate)?.flightNumber ?? null,
        }));
        break;
      }
      case "tug":
        busy = inPushback.length + Math.floor(taxiing.length * 0.4);
        assignmentTargets = Array.from({ length: g.count }, (_, i) => ({
          label: `TUG-${String(i + 1).padStart(2, "0")}`,
          assignment:
            i < inPushback.length ? inPushback[i]!.flightNumber : null,
        }));
        break;
      case "stairs": {
        const remoteFlights = activeAtGate.filter((f) => f.stand !== "nose-in");
        busy = remoteFlights.length;
        assignmentTargets = Array.from({ length: g.count }, (_, i) => ({
          label: `STR-${i + 1}`,
          assignment:
            i < remoteFlights.length ? remoteFlights[i]!.flightNumber : null,
        }));
        break;
      }
      case "belt": {
        const beltsBusy = activeAtGate.filter((f) => f.baggageVolume > 80);
        busy = beltsBusy.length;
        assignmentTargets = Array.from({ length: g.count }, (_, i) => ({
          label: `BLT-${i + 1}`,
          assignment:
            i < beltsBusy.length ? beltsBusy[i]!.flightNumber : null,
        }));
        break;
      }
      case "crew": {
        busy = activeAtGate.length;
        assignmentTargets = Array.from({ length: g.count }, (_, i) => ({
          label: `CRW-${i + 1}`,
          assignment:
            i < activeAtGate.length ? activeAtGate[i]!.flightNumber : null,
        }));
        break;
      }
      case "bridge": {
        const bridgeFlights = activeAtGate.filter((f) => f.stand === "nose-in");
        busy = bridgeFlights.length;
        assignmentTargets = Array.from({ length: g.count }, (_, i) => ({
          label: `JBR-${i + 1}`,
          assignment:
            i < bridgeFlights.length ? bridgeFlights[i]!.flightNumber : null,
        }));
        break;
      }
    }
    busy = clamp(busy, 0, g.count);
    return {
      type: g.type,
      label: g.label,
      totalUnits: g.count,
      busyUnits: busy,
      utilisationPercent: Math.round((busy / g.count) * 100),
      units: assignmentTargets.map((u, i) => ({
        id: `${g.type}-${i}`,
        label: u.label,
        status: u.assignment ? ("busy" as const) : ("idle" as const),
        assignment: u.assignment,
        utilisationPercent: u.assignment ? 100 : 0,
      })),
    };
  });
  return groups;
}

function recomputeAlerts(now: Date) {
  const newAlerts: AlertRecord[] = [];
  for (const f of state.flights.values()) {
    if (f.delayRisk === "high" && f.bottleneckResource) {
      newAlerts.push({
        id: `bn-${f.id}`,
        severity: "high",
        resource: friendlyResource(f.bottleneckResource),
        flightId: f.id,
        flightNumber: f.flightNumber,
        message: `${f.flightNumber}: predicted +${f.predictedDelayMin} min — ${f.bottleneckReason ?? "bottleneck"}`,
        suggestedAction: suggestAction(f),
        etaMinutes: minutesUntil(f.nextMilestoneAt, now),
        createdAt: now,
      });
    } else if (f.delayRisk === "medium" && f.bottleneckResource) {
      newAlerts.push({
        id: `mw-${f.id}`,
        severity: "medium",
        resource: friendlyResource(f.bottleneckResource),
        flightId: f.id,
        flightNumber: f.flightNumber,
        message: `${f.flightNumber} at risk: +${f.predictedDelayMin} min — ${f.bottleneckReason ?? "watching"}`,
        suggestedAction: suggestAction(f),
        etaMinutes: minutesUntil(f.nextMilestoneAt, now),
        createdAt: now,
      });
    }
  }
  // Resource saturation alerts
  for (const g of computeResourceGroups()) {
    if (g.utilisationPercent >= 90) {
      newAlerts.push({
        id: `sat-${g.type}`,
        severity: g.utilisationPercent >= 95 ? "high" : "medium",
        resource: g.label,
        flightId: null,
        flightNumber: null,
        message: `${g.label} at ${g.utilisationPercent}% capacity (${g.busyUnits}/${g.totalUnits} busy)`,
        suggestedAction: `Stagger next ${g.type} assignments by 5 min`,
        etaMinutes: 0,
        createdAt: now,
      });
    }
  }
  // Preserve createdAt timestamps from previous identical alerts
  const prevById = new Map(state.alerts.map((a) => [a.id, a]));
  state.alerts = newAlerts
    .map((a) => {
      const prev = prevById.get(a.id);
      return prev ? { ...a, createdAt: prev.createdAt } : a;
    })
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(s: AlertRecord["severity"]): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function friendlyResource(key: string): string {
  switch (key) {
    case "crew": return "Ground Crew";
    case "baggage": return "Baggage Belts";
    case "tug": return "Pushback Tugs";
    case "gate": return "Gate Allocation";
    case "weather": return "Weather Window";
    case "bridge": return "Jet Bridges";
    default: return key;
  }
}

function suggestAction(f: FlightRecord): string {
  switch (f.bottleneckResource) {
    case "crew":
      return `Add 2 ground crew to ${f.flightNumber} at ${f.gate}`;
    case "baggage":
      return `Reassign belt to ${f.flightNumber} (current load ${f.baggageVolume} bags)`;
    case "tug":
      return `Pre-stage tug for ${f.flightNumber} pushback window`;
    case "gate":
      return `Move ${f.flightNumber} to nearest free gate`;
    case "weather":
      return `Hold ${f.flightNumber} pushback 4 min for weather`;
    case "bridge":
      return `Swap to bridge stand for ${f.flightNumber}`;
    default:
      return `Monitor ${f.flightNumber}`;
  }
}

function minutesUntil(d: Date, now: Date): number {
  return Math.max(0, Math.round((d.getTime() - now.getTime()) / 60_000));
}

export function runOptimizer(): {
  reassignments: {
    flightId: string;
    flightNumber: string;
    fromGate: string;
    toGate: string;
    reason: string;
    expectedSavingMin: number;
  }[];
  totalSavingMin: number;
} {
  const flights = [...state.flights.values()].filter(
    (f) => f.delayRisk === "high" && ["Scheduled", "Taxi-In"].includes(f.status),
  );
  const usedGates = new Set(
    [...state.flights.values()]
      .filter((f) => ["At-Gate", "Boarding"].includes(f.status))
      .map((f) => f.gate),
  );
  const candidates = GATES.filter((g) => !usedGates.has(g));
  const reassignments: ReturnType<typeof runOptimizer>["reassignments"] = [];
  let totalSaving = 0;
  for (const f of flights.slice(0, 6)) {
    const newGate = candidates.shift();
    if (!newGate || newGate === f.gate) continue;
    const oldGate = f.gate;
    const oldDistance = f.gateDistance;
    f.gate = newGate;
    f.gateDistance = clamp(oldDistance - intBetween(80, 250), 60, 760);
    const before = f.predictedTurnaroundMin;
    rebuildPrediction(f);
    const saved = Math.max(0, Math.round((before - f.predictedTurnaroundMin) * 10) / 10);
    if (saved > 0) {
      totalSaving += saved;
      state.delaysAvoided += saved >= 5 ? 1 : 0;
      state.bottlenecksResolved += 1;
    }
    f.timeline.push({
      ts: new Date(),
      event: "OPTIMIZER",
      description: `Reassigned ${oldGate} → ${newGate} (saved ${saved} min)`,
    });
    reassignments.push({
      flightId: f.id,
      flightNumber: f.flightNumber,
      fromGate: oldGate,
      toGate: newGate,
      reason: f.bottleneckReason ?? "Reduce projected turnaround time",
      expectedSavingMin: saved,
    });
  }
  return { reassignments, totalSavingMin: Math.round(totalSaving * 10) / 10 };
}

export function resetSim(): void {
  const fresh = createInitialState();
  state.flights = fresh.flights;
  state.alerts = fresh.alerts;
  state.history = fresh.history;
  state.completed = fresh.completed;
  state.bottlenecksResolved = 0;
  state.delaysAvoided = 0;
  state.startedAt = fresh.startedAt;
  state.lastTickAt = fresh.lastTickAt;
  tick();
}

export function startSimLoop(): void {
  tick();
  setInterval(() => {
    try {
      tick();
    } catch {
      // swallow
    }
  }, 3000);
}

export { AIRPORT };

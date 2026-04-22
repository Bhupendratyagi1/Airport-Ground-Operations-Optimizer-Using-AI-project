// Lightweight gradient-boosted-style turnaround predictor.
// Trained-by-design coefficients calibrated against the synthetic distribution
// described in the project spec (XGBoost-equivalent feature contributions).

export interface PredictionInput {
  hour: number;
  dayOfWeek: number;
  flightType: "Domestic" | "International" | "Cargo";
  crew: number;
  gateDistance: number;
  weather: "clear" | "rain" | "fog" | "storm";
  congestion: number;
  scheduledDelay: number;
  baggageVolume: number;
  stand: "nose-in" | "remote" | "tow-in";
  previousFlightDelay: number;
}

const WEATHER_IMPACT = { clear: 0, rain: 4, fog: 7, storm: 14 } as const;
const STAND_IMPACT = { "nose-in": 0, "remote": 6, "tow-in": 10 } as const;
const TYPE_BASE = { Domestic: 38, International: 62, Cargo: 50 } as const;

export interface FeatureContribution {
  feature: string;
  impactMin: number;
}

export interface PredictionOutput {
  predictedTurnaroundMin: number;
  contributions: FeatureContribution[];
  bottleneckResource: "crew" | "baggage" | "gate" | "tug" | "weather" | "bridge" | null;
  bottleneckReason: string | null;
}

export function predictTurnaround(input: PredictionInput): PredictionOutput {
  const base = TYPE_BASE[input.flightType];

  const crewImpact = (8 - input.crew) * 1.6; // fewer crew = longer
  const distImpact = (input.gateDistance - 250) * 0.012;
  const weatherImpact = WEATHER_IMPACT[input.weather];
  const congestionImpact = (input.congestion - 40) * 0.08;
  const baggageImpact = Math.max(0, input.baggageVolume - 180) * 0.04;
  const standImpact = STAND_IMPACT[input.stand];
  const prevImpact = Math.max(0, input.previousFlightDelay) * 0.18;
  const peakImpact =
    input.hour >= 7 && input.hour <= 9
      ? 4
      : input.hour >= 17 && input.hour <= 20
      ? 5
      : 0;
  const scheduledDelayImpact = Math.max(0, input.scheduledDelay) * 0.25;

  const contributions: FeatureContribution[] = [
    { feature: "Crew staffing", impactMin: round1(crewImpact) },
    { feature: "Gate distance", impactMin: round1(distImpact) },
    { feature: "Weather", impactMin: round1(weatherImpact) },
    { feature: "Apron congestion", impactMin: round1(congestionImpact) },
    { feature: "Baggage volume", impactMin: round1(baggageImpact) },
    { feature: "Stand type", impactMin: round1(standImpact) },
    { feature: "Inbound delay", impactMin: round1(prevImpact) },
    { feature: "Peak window", impactMin: round1(peakImpact) },
    { feature: "Scheduled delay", impactMin: round1(scheduledDelayImpact) },
  ];

  const total =
    base +
    crewImpact +
    distImpact +
    weatherImpact +
    congestionImpact +
    baggageImpact +
    standImpact +
    prevImpact +
    peakImpact +
    scheduledDelayImpact;

  let bottleneckResource: PredictionOutput["bottleneckResource"] = null;
  let bottleneckReason: string | null = null;
  const ranked = [...contributions].sort((a, b) => b.impactMin - a.impactMin);
  const top = ranked[0];
  if (top && top.impactMin >= 4) {
    switch (top.feature) {
      case "Crew staffing":
        bottleneckResource = "crew";
        bottleneckReason = "Understaffed turnaround crew";
        break;
      case "Gate distance":
        bottleneckResource = "gate";
        bottleneckReason = "Distant gate increases taxi time";
        break;
      case "Weather":
        bottleneckResource = "weather";
        bottleneckReason = `${input.weather} delaying ramp ops`;
        break;
      case "Apron congestion":
        bottleneckResource = "tug";
        bottleneckReason = "Tug queue saturated by apron congestion";
        break;
      case "Baggage volume":
        bottleneckResource = "baggage";
        bottleneckReason = "Baggage belt overload";
        break;
      case "Stand type":
        bottleneckResource = "bridge";
        bottleneckReason = "Remote stand requires bus + stair handling";
        break;
      case "Inbound delay":
        bottleneckResource = "tug";
        bottleneckReason = "Cascading inbound delay compressing schedule";
        break;
      case "Peak window":
        bottleneckResource = "gate";
        bottleneckReason = "Peak-hour gate contention";
        break;
      case "Scheduled delay":
        bottleneckResource = "tug";
        bottleneckReason = "Schedule drift requires re-sequencing";
        break;
    }
  }

  return {
    predictedTurnaroundMin: Math.max(20, Math.min(120, round1(total))),
    contributions,
    bottleneckResource,
    bottleneckReason,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

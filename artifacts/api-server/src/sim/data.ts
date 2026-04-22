export const AIRPORT = "KSFO";

export const AIRLINES = [
  { code: "UA", name: "United" },
  { code: "AA", name: "American" },
  { code: "DL", name: "Delta" },
  { code: "WN", name: "Southwest" },
  { code: "AS", name: "Alaska" },
  { code: "BA", name: "British Airways" },
  { code: "LH", name: "Lufthansa" },
  { code: "JL", name: "JAL" },
  { code: "AF", name: "Air France" },
  { code: "FX", name: "FedEx" },
];

export const DESTINATIONS = [
  "JFK", "LAX", "ORD", "ATL", "DFW", "SEA", "DEN", "BOS",
  "MIA", "LHR", "CDG", "NRT", "HKG", "SYD", "FRA", "AMS",
  "ICN", "DXB", "SIN", "PVG",
];

export const ORIGINS = [
  "JFK", "LAX", "ORD", "ATL", "DFW", "SEA", "DEN", "BOS",
  "MIA", "LHR", "CDG", "NRT", "HKG", "SYD", "FRA", "AMS",
];

export const GATES = [
  "A1", "A2", "A3", "A4", "A5", "A6",
  "B1", "B2", "B3", "B4", "B5",
  "C1", "C2", "C3", "C4", "C5", "C6", "C7",
  "D1", "D2", "D3", "D4",
];

export const STANDS: Array<"nose-in" | "remote" | "tow-in"> = [
  "nose-in", "nose-in", "nose-in", "remote", "tow-in",
];

export const FLIGHT_TYPES: Array<"Domestic" | "International" | "Cargo"> = [
  "Domestic", "Domestic", "Domestic", "International", "International", "Cargo",
];

export const WEATHERS: Array<"clear" | "rain" | "fog" | "storm"> = [
  "clear", "clear", "clear", "clear", "rain", "fog",
];

export const STATUSES = [
  "Scheduled",
  "Taxi-In",
  "At-Gate",
  "Boarding",
  "Pushback",
  "Departed",
  "Delayed",
] as const;

export type FlightStatus = (typeof STATUSES)[number];

export const RESOURCE_GROUPS = [
  { type: "gate" as const, label: "Gates", count: GATES.length },
  { type: "tug" as const, label: "Pushback Tugs", count: 12 },
  { type: "stairs" as const, label: "Boarding Stairs", count: 8 },
  { type: "belt" as const, label: "Baggage Belts", count: 14 },
  { type: "crew" as const, label: "Ground Crew Teams", count: 18 },
  { type: "bridge" as const, label: "Jet Bridges", count: 16 },
];

import { API_URL } from "./api";
import { BlackSpot } from "./types";

export interface DemoDetection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
}

export interface DemoTrafficState {
  vehicle_count: number;
  congestion_level: number;
  density_per_km: number;
}

/** Per-frame VRU vulnerability, written by ai/vru_intelligence/annotate_footage
 * when a trained helmet detector has seen the clip. `multiplier` (>= 1.0) is the
 * factor the scene's exposure is raised by; `dominant_factor` says why. Absent
 * on clips that predate the detector, so every consumer treats it as optional. */
export interface DemoFrameVulnerability {
  multiplier: number;
  dominant_factor: "no_helmet" | "triple_riding" | "protected" | "no_riders";
  with_helmet: number;
  without_helmet: number;
  triple_riding: number;
}

export interface DemoFrame {
  t: number;
  vehicles: DemoDetection[];
  pedestrians: DemoDetection[];
  two_wheelers: DemoDetection[];
  traffic: DemoTrafficState;
  /** Helmet-detector rider boxes; labels: with_helmet | without_helmet | triple_riding | plate. */
  riders?: DemoDetection[];
  vulnerability?: DemoFrameVulnerability;
}

export interface DemoClipVulnerability {
  peak_multiplier: number;
  dominant_factor: string;
  riders_seen: number;
  without_helmet_total: number;
  triple_riding_total: number;
}

export interface DemoClipData {
  fps_source: number;
  frame_stride: number;
  duration_s: number;
  sample_count: number;
  peak_vehicle_count: number;
  avg_congestion_level: number;
  frames: DemoFrame[];
  vulnerability?: DemoClipVulnerability;
}

export interface DemoManifestEntry {
  name: string;
  title: string;
  video: string;
  detections: string;
  duration_s: number;
  peak_vehicle_count: number;
  avg_congestion_level: number;
  /** Present once the clip has been through the helmet detector. */
  peak_vulnerability?: number;
  vulnerability_factor?: string;
}

// The recorded clips + precomputed detections are a few MB of binary/JSON --
// too large to round-trip through the frontend's inline-payload deploy path,
// so they're served by the backend (which deploys via git push, no such
// limit) at /demo, a sibling of the /api/v1 prefix in API_URL.
const DEMO_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export async function fetchDemoManifest(): Promise<DemoManifestEntry[]> {
  const response = await fetch(`${DEMO_BASE_URL}/demo/vehicle-intelligence/manifest.json`);
  if (!response.ok) throw new Error(`manifest fetch failed: ${response.status}`);
  const entries: DemoManifestEntry[] = await response.json();
  return entries.map((entry) => ({
    ...entry,
    video: `${DEMO_BASE_URL}${entry.video}`,
    detections: `${DEMO_BASE_URL}${entry.detections}`,
  }));
}

export async function fetchDemoClip(url: string): Promise<DemoClipData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`clip data fetch failed: ${response.status}`);
  return response.json();
}

/** Illustrative black spots: the real BlackSpotEngine run on a seeded
 * multi-location scenario (ai/demo/build_blackspot_demo.py), so the map has
 * genuine engine output to plot. Labelled as a sample in the UI — the live
 * API only ever sees single-location demo telemetry. */
export async function fetchSampleBlackSpots(): Promise<BlackSpot[]> {
  const response = await fetch(`${DEMO_BASE_URL}/demo/blackspots/sample.json`);
  if (!response.ok) throw new Error(`sample black spots fetch failed: ${response.status}`);
  return response.json();
}

export function nearestFrame(frames: DemoFrame[], t: number): DemoFrame | null {
  if (frames.length === 0) return null;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}

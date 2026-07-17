import { API_URL } from "./api";

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

export interface DemoFrame {
  t: number;
  vehicles: DemoDetection[];
  pedestrians: DemoDetection[];
  two_wheelers: DemoDetection[];
  traffic: DemoTrafficState;
}

export interface DemoClipData {
  fps_source: number;
  frame_stride: number;
  duration_s: number;
  sample_count: number;
  peak_vehicle_count: number;
  avg_congestion_level: number;
  frames: DemoFrame[];
}

export interface DemoManifestEntry {
  name: string;
  title: string;
  video: string;
  detections: string;
  duration_s: number;
  peak_vehicle_count: number;
  avg_congestion_level: number;
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

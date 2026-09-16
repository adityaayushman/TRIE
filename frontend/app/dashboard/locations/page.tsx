"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createLocation, fetchLocations } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LocationSummary, RISK_COLOR } from "@/lib/types";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";

/** Multi-location scaling's list view: every registered site — a camera or
 * junction an operator manages — as a card with a live rollup, plus the form
 * to register a new one. Before this page, the platform had no way to ask
 * "show me only NH48 Junction 4" — every vehicle_id and raw lat/lon was one
 * undifferentiated stream. A Location is the identity that groups and filters
 * by (see backend/app/models/location.py); it does not change how risk is
 * computed, only how it is organised and browsed. */
export default function LocationsPage() {
  const { account } = useAuth();
  const [locations, setLocations] = useState<LocationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetchLocations()
      .then(setLocations)
      .catch((cause) => setError((cause as Error).message));
  };

  useEffect(load, []);

  return (
    <div className="space-y-5">
      <PageHeader
        icon="locations"
        title="Locations"
        subtitle="Every registered site — a camera or junction — with its own live risk trend."
        right={
          locations && locations.length > 0 ? (
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
              {locations.length} site{locations.length === 1 ? "" : "s"} registered
            </span>
          ) : undefined
        }
      />

      {account ? (
        <RegisterLocationForm onRegistered={load} />
      ) : (
        <EmptyState
          title="Sign in to register a site"
          body="Reading this list is open to everyone. Registering a new site needs an account — the same bar as submitting telemetry."
        />
      )}

      {error ? (
        <EmptyState title="Could not load locations" body={error} />
      ) : locations === null ? (
        <EmptyState title="Loading…" body="Fetching registered sites." />
      ) : locations.length === 0 ? (
        <EmptyState
          title="No sites registered yet"
          body="Register the first one above, or keep using the platform without one — every feature works fine scoped to just a vehicle_id, the way it always has."
        />
      ) : (
        <div>
          {/* A real heading, not just the grid: when signed out, "Register a
              site" above (which carries its own <h2>) renders as a headingless
              EmptyState instead, which left the page jumping straight from
              the <h1> to each card's <h3> with nothing between — a real
              heading-order violation, not just a card-grid label. */}
          <h2 className="sr-only">Registered sites</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => (
              <LocationCard key={loc.id} location={loc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LocationCard({ location }: { location: LocationSummary }) {
  return (
    <Link
      href={`/dashboard/locations/${location.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-linear-to-b from-slate-900/80 to-slate-900/40 p-5 transition-all hover:-translate-y-1 hover:border-sky-500/40"
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-500/5 blur-2xl transition-colors group-hover:bg-sky-500/10" />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-50">{location.name}</h3>
        {location.latest_risk_level && (
          <span className="flex shrink-0 items-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: RISK_COLOR[location.latest_risk_level] }}
            />
            {location.latest_risk_level}
          </span>
        )}
      </div>
      {location.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{location.description}</p>
      )}
      <p className="mt-2 font-mono text-[0.65rem] text-slate-400">
        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs">
        <span className="text-slate-400">
          {location.event_count} assessment{location.event_count === 1 ? "" : "s"}
        </span>
        <span className="tabular-nums text-slate-300">
          {location.latest_risk_score !== null ? `${location.latest_risk_score.toFixed(0)}%` : "—"}
        </span>
      </div>
    </Link>
  );
}

function RegisterLocationForm({ onRegistered }: { onRegistered: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function useMyPosition() {
    if (!("geolocation" in navigator)) {
      setError("This browser has no Geolocation API.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError("Could not read this device's position — enter coordinates manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (!name.trim()) throw new Error("Name is required.");
      if (Number.isNaN(lat) || Number.isNaN(lon)) throw new Error("Latitude and longitude must be numbers.");
      await createLocation({ name: name.trim(), description: description.trim(), latitude: lat, longitude: lon });
      setName("");
      setDescription("");
      setLatitude("");
      setLongitude("");
      onRegistered();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle hint="any signed-in account — the same bar as submitting telemetry">
        Register a site
      </SectionTitle>
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-slate-400">
          <span className="mb-1.5 block">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="NH48 Gurugram Junction"
            className="w-56 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-hidden focus:border-sky-600"
          />
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-1.5 block">Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief note"
            className="w-56 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-hidden focus:border-sky-600"
          />
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-1.5 block">Latitude</span>
          <input
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="28.4595"
            className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-hidden focus:border-sky-600"
          />
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-1.5 block">Longitude</span>
          <input
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="77.0266"
            className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-hidden focus:border-sky-600"
          />
        </label>
        <button
          onClick={useMyPosition}
          disabled={locating}
          className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:opacity-50"
        >
          {locating ? "Locating…" : "Use my position"}
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Registering…" : "Register site"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </Card>
  );
}

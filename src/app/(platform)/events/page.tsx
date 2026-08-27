"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiCalendar, FiMapPin, FiRefreshCw } from "react-icons/fi";
import { EventRow } from "@/components/blocks/upcoming-block";
import { formatEventDate, type DragEvent } from "@/lib/events/types";

/**
 * Where the scene is playing.
 *
 * The single most useful question this platform can answer for someone who
 * isn't already a fan — "who's performing near me" — so city is a first-class
 * filter rather than buried in search.
 */
export default function EventsPage() {
  const [events, setEvents] = useState<DragEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await fetch("/api/events?limit=100");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load events");
      setEvents(data.events ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load events");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cities = useMemo(() => {
    const seen = new Map<string, number>();
    for (const event of events) {
      if (!event.city) continue;
      seen.set(event.city, (seen.get(event.city) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const shown = city ? events.filter((e) => e.city === city) : events;

  // Group by day so a run of dates reads as a calendar rather than a list.
  const byDay = useMemo(() => {
    const groups = new Map<string, DragEvent[]>();
    for (const event of shown) {
      const key = formatEventDate(event.startsAt, event.timezone, { withTime: false });
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return [...groups.entries()];
  }, [shown]);

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        <header className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl uppercase tracking-tight leading-none">
              Events
            </h1>
            <p className="mt-1 text-sm text-gray-400">Gigs, shows and streams across the scene</p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            aria-label="Refresh events"
            className="p-2.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} size={18} />
          </button>
        </header>

        {cities.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter by city">
            <CityChip label="Everywhere" active={city === null} onClick={() => setCity(null)} />
            {cities.map(([name, count]) => (
              <CityChip
                key={name}
                label={`${name} (${count})`}
                active={city === name}
                onClick={() => setCity(name)}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading dates…</p>
        ) : shown.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-[#2f2942]/40 grid place-items-center mx-auto mb-4">
              <FiCalendar className="w-9 h-9 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {city ? `Nothing in ${city} yet` : "No dates listed yet"}
            </h2>
            <p className="text-gray-400">
              {city ? (
                <button onClick={() => setCity(null)} className="underline hover:text-white">
                  See everywhere instead
                </button>
              ) : (
                <>
                  Performing soon?{" "}
                  <Link href="/dashboard" className="underline hover:text-white">
                    Add your dates
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {byDay.map(([day, dayEvents]) => (
              <section key={day}>
                <h2 className="font-heading text-lg uppercase tracking-tight text-white/50 mb-3">
                  {day}
                </h2>
                <ul className="space-y-3">
                  {dayEvents.map((event) => (
                    <li key={event.id} className="rounded-[24px] bg-[color:var(--color-card-pink)] text-[color:var(--color-card-ink)] p-2 shadow-lg">
                      <EventRow event={event} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CityChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
        active
          ? "bg-[color:var(--color-dragverse-primary)] text-[color:var(--color-card-ink)]"
          : "bg-white/5 text-gray-300 hover:bg-white/10"
      }`}
    >
      <FiMapPin aria-hidden="true" size={11} />
      {label}
    </button>
  );
}

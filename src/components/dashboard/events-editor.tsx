"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { FiPlus, FiUpload, FiX, FiEdit2, FiTrash2, FiMapPin, FiCalendar } from "react-icons/fi";
import {
  EVENT_KINDS,
  EVENT_KIND_LABELS,
  PHYSICAL_KINDS,
  formatEventDate,
  formatEventLocation,
  type DragEvent,
  type EventKind,
} from "@/lib/events/types";

const inputClass =
  "w-full bg-[#0f071a] border border-[#2f2942] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-gray-600";

interface DraftEvent {
  id?: string;
  title: string;
  description: string;
  flyerUrl: string;
  kind: EventKind;
  /** `datetime-local` value, i.e. the creator's own wall-clock time. */
  startsAtLocal: string;
  endsAtLocal: string;
  venueName: string;
  address: string;
  city: string;
  country: string;
  ticketUrl: string;
  priceText: string;
  isFree: boolean;
  ageRestriction: string;
  lineup: string;
}

const EMPTY: DraftEvent = {
  title: "",
  description: "",
  flyerUrl: "",
  kind: "gig",
  startsAtLocal: "",
  endsAtLocal: "",
  venueName: "",
  address: "",
  city: "",
  country: "",
  ticketUrl: "",
  priceText: "",
  isFree: false,
  ageRestriction: "",
  lineup: "",
};

/** The browser's IANA zone — stored so the gig reads in its own local time. */
function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** `datetime-local` has no zone, so it means local wall time. */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventToDraft(event: DragEvent): DraftEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    flyerUrl: event.flyerUrl ?? "",
    kind: event.kind,
    startsAtLocal: isoToLocalInput(event.startsAt),
    endsAtLocal: isoToLocalInput(event.endsAt),
    venueName: event.venueName ?? "",
    address: event.address ?? "",
    city: event.city ?? "",
    country: event.country ?? "",
    ticketUrl: event.ticketUrl ?? "",
    priceText: event.priceText ?? "",
    isFree: event.isFree,
    ageRestriction: event.ageRestriction ?? "",
    lineup: event.lineup.join(", "),
  };
}

/**
 * Create and manage the creator's events — mostly physical gigs, with a flyer,
 * a description, a venue and a ticket link.
 */
export function EventsEditor({ handle }: { handle: string | null }) {
  const { getAccessToken, authenticated } = usePrivy();
  const [events, setEvents] = useState<DragEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!handle) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/events?handle=${encodeURIComponent(handle)}&includePast=true&limit=50`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load events");
      setEvents(data.events ?? []);
      // The API reports provisioned:false when the events table doesn't exist,
      // so the editor can explain that rather than looking broken.
      setUnavailable(data.provisioned === false);
    } catch (err) {
      setUnavailable(true);
      console.error("[EventsEditor]", err);
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!draft) return;
    setError(null);

    const startsAt = localInputToIso(draft.startsAtLocal);
    if (!draft.title.trim()) return setError("Give the event a name.");
    if (!startsAt) return setError("Pick a date and time.");

    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");

      const body = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        flyerUrl: draft.flyerUrl || null,
        kind: draft.kind,
        startsAt,
        endsAt: localInputToIso(draft.endsAtLocal),
        timezone: localZone(),
        venueName: draft.venueName.trim() || null,
        address: draft.address.trim() || null,
        city: draft.city.trim() || null,
        country: draft.country.trim().toUpperCase() || null,
        ticketUrl: draft.ticketUrl.trim() || null,
        priceText: draft.priceText.trim() || null,
        isFree: draft.isFree,
        ageRestriction: draft.ageRestriction.trim() || null,
        lineup: draft.lineup
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      };

      const response = await fetch(draft.id ? `/api/events/${draft.id}` : "/api/events", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't save the event");

      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the event");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const token = await getAccessToken();
      await fetch(`/api/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) return null;

  if (unavailable) {
    return (
      <p className="text-sm text-gray-400">
        Events aren&apos;t set up yet. Run <code className="text-gray-300">supabase-migration-events.sql</code>.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading your dates…</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-center gap-3 rounded-xl border border-[#2f2942] bg-[#1a0b2e] p-2.5"
            >
              {event.flyerUrl ? (
                <div className="relative w-12 h-12 rounded overflow-hidden bg-black/40 flex-shrink-0">
                  <Image src={event.flyerUrl} alt="" fill sizes="48px" className="object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                  <FiCalendar size={14} className="text-gray-500" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{event.title}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {formatEventDate(event.startsAt, event.timezone)}
                  {formatEventLocation(event) && ` · ${formatEventLocation(event)}`}
                </p>
              </div>

              <button
                onClick={() => setDraft(eventToDraft(event))}
                disabled={busy}
                aria-label={`Edit ${event.title}`}
                className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
              >
                <FiEdit2 size={14} />
              </button>
              <button
                onClick={() => void remove(event.id)}
                disabled={busy}
                aria-label={`Remove ${event.title}`}
                className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/10 disabled:opacity-40"
              >
                <FiTrash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <EventForm
          draft={draft}
          busy={busy}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null);
            setError(null);
          }}
          onSave={() => void save()}
        />
      ) : (
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-[#2f2942] text-sm text-gray-400 hover:text-white hover:border-[#EB83EA] transition-colors"
        >
          <FiPlus size={16} />
          Add a date
        </button>
      )}
    </div>
  );
}

function EventForm({
  draft,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: DraftEvent;
  busy: boolean;
  onChange: (draft: DraftEvent) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { getAccessToken } = usePrivy();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof DraftEvent>(key: K, value: DraftEvent[K]) =>
    onChange({ ...draft, [key]: value });

  const isPhysical = PHYSICAL_KINDS.includes(draft.kind);

  async function uploadFlyer(file: File) {
    setUploading(true);
    try {
      const token = await getAccessToken();
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload/image-v2", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (response.ok) set("flyerUrl", data.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-[#2f2942] bg-[#1a0b2e] p-3 space-y-3">
      <Field label="What is it?">
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Friday night at Bar Wonderland"
          className={inputClass}
        />
      </Field>

      <Field label="Type">
        <select
          value={draft.kind}
          onChange={(e) => set("kind", e.target.value as EventKind)}
          className={inputClass}
        >
          {EVENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {EVENT_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Starts">
          <input
            type="datetime-local"
            value={draft.startsAtLocal}
            onChange={(e) => set("startsAtLocal", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Ends (optional)">
          <input
            type="datetime-local"
            value={draft.endsAtLocal}
            onChange={(e) => set("endsAtLocal", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          rows={3}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What's the night about?"
          className={`${inputClass} resize-y`}
        />
      </Field>

      {/* Flyer */}
      <div>
        <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Flyer</span>
        <div className="flex items-center gap-2">
          {draft.flyerUrl && (
            <div className="relative w-16 h-16 rounded overflow-hidden bg-black/40 flex-shrink-0">
              <Image src={draft.flyerUrl} alt="" fill sizes="64px" className="object-cover" />
              <button
                type="button"
                aria-label="Remove flyer"
                onClick={() => set("flyerUrl", "")}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-white hover:text-red-400"
              >
                <FiX size={11} />
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && void uploadFlyer(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[#2f2942] text-gray-300 hover:text-white hover:border-[#EB83EA] transition-colors disabled:opacity-50"
          >
            <FiUpload size={12} />
            {uploading ? "Uploading…" : draft.flyerUrl ? "Replace" : "Upload flyer"}
          </button>
        </div>
      </div>

      {/* Venue — only for events that happen somewhere physical */}
      {isPhysical && (
        <div className="space-y-2 border-t border-[#2f2942] pt-3">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500">
            <FiMapPin size={11} />
            Where
          </p>
          <input
            value={draft.venueName}
            onChange={(e) => set("venueName", e.target.value)}
            placeholder="Venue name"
            className={inputClass}
          />
          <input
            value={draft.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Street address"
            className={inputClass}
          />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={draft.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="City"
              className={inputClass}
            />
            <input
              value={draft.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="DE"
              maxLength={2}
              aria-label="Country code"
              className={`${inputClass} w-16 uppercase`}
            />
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-[#2f2942] pt-3">
        <input
          value={draft.ticketUrl}
          onChange={(e) => set("ticketUrl", e.target.value)}
          placeholder="Ticket link (https://…)"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.priceText}
            onChange={(e) => set("priceText", e.target.value)}
            placeholder="£8 adv / £10 door"
            disabled={draft.isFree}
            className={`${inputClass} disabled:opacity-40`}
          />
          <input
            value={draft.ageRestriction}
            onChange={(e) => set("ageRestriction", e.target.value)}
            placeholder="18+"
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={draft.isFree}
            onChange={(e) => set("isFree", e.target.checked)}
            className="accent-[#EB83EA]"
          />
          <span className="text-gray-300">Free entry</span>
        </label>
        <input
          value={draft.lineup}
          onChange={(e) => set("lineup", e.target.value)}
          placeholder="Who else is on — comma separated"
          className={inputClass}
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white">
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={busy}
          className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#EB83EA] text-black hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : draft.id ? "Save changes" : "Add date"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

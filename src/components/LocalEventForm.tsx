'use client';

import { useState } from 'react';
import type { EventRow } from '@/lib/types';
import { addLocalEvent, updateLocalEvent, LocalEventInput } from '@/lib/localEvents';
import { geocodeAddress } from '@/lib/prefs';

type Props = {
  initial?: EventRow;
  onSaved: (row: EventRow) => void;
  onCancel: () => void;
};

export default function LocalEventForm({ initial, onSaved, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? '');
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? '');
  const [startsTime, setStartsTime] = useState(initial?.starts_time ?? '');
  const [endsTime, setEndsTime] = useState(initial?.ends_time ?? '');
  const [venue, setVenue] = useState(initial?.venue ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function tryGeocode() {
    if (!address) return;
    setGeocoding(true);
    setError(null);
    const hit = await geocodeAddress(address);
    setGeocoding(false);
    if (!hit) {
      setError('Could not locate that address');
      return;
    }
    setLat(hit.lat);
    setLng(hit.lng);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsOn) {
      setError('Title and start date are required');
      return;
    }
    const input: LocalEventInput = {
      title: title.trim(),
      starts_on: startsOn,
      ends_on: endsOn || null,
      starts_time: startsTime || null,
      ends_time: endsTime || null,
      venue: venue || null,
      address: address || null,
      notes: notes || null,
      lat,
      lng,
    };
    const saved = initial ? updateLocalEvent(initial.id, input) : addLocalEvent(input);
    if (!saved) {
      setError('Save failed');
      return;
    }
    onSaved(saved);
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <Field label="Title" required>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white"
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start date" required>
          <input
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white"
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            value={endsOn ?? ''}
            onChange={(e) => setEndsOn(e.target.value)}
            className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white"
          />
        </Field>
        <Field label="Start time">
          <input
            type="time"
            value={startsTime ?? ''}
            onChange={(e) => setStartsTime(e.target.value)}
            className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white"
          />
        </Field>
        <Field label="End time">
          <input
            type="time"
            value={endsTime ?? ''}
            onChange={(e) => setEndsTime(e.target.value)}
            className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white"
          />
        </Field>
      </div>
      <Field label="Venue">
        <input
          value={venue ?? ''}
          onChange={(e) => setVenue(e.target.value)}
          className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white"
        />
      </Field>
      <Field label="Address">
        <div className="flex gap-2">
          <input
            value={address ?? ''}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Via Monte Napoleone 1"
            className="flex-1 border border-stone-300 rounded px-2 py-1.5 bg-white"
          />
          <button
            type="button"
            onClick={tryGeocode}
            disabled={!address || geocoding}
            className="text-xs px-3 py-1.5 rounded bg-stone-900 text-white disabled:opacity-40 whitespace-nowrap"
          >
            {geocoding ? 'Locating…' : lat != null ? 'Re-locate' : 'Locate'}
          </button>
        </div>
        {lat != null && lng != null && (
          <div className="text-[11px] text-stone-500 mt-1">
            pinned at {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>
        )}
      </Field>
      <Field label="Notes">
        <textarea
          value={notes ?? ''}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white"
        />
      </Field>
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-stone-500 hover:text-stone-900 px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-stone-900 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-stone-800"
        >
          {initial ? 'Save' : 'Add event'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

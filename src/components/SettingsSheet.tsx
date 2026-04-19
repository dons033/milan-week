'use client';

import { useState } from 'react';
import type { Home } from '@/lib/prefs';
import { setHome, clearPrefs, geocodeAddress } from '@/lib/prefs';
import { clearPicks } from '@/lib/picks';
import {
  clearLocalEvents,
  exportJson,
  importJson,
} from '@/lib/localEvents';

type Props = {
  initialHome: Home | null;
  localEventCount: number;
  onHomeChange: (h: Home | null) => void;
  onLocalEventsChange: () => void;
  onClose: () => void;
};

export default function SettingsSheet({
  initialHome,
  localEventCount,
  onHomeChange,
  onLocalEventsChange,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:m-5 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold tracking-tight mb-1">Settings</h2>
        <p className="text-xs text-stone-500 mb-5">
          Stays in this browser. Nothing is sent to a server.
        </p>

        <HomeSection initial={initialHome} onChange={onHomeChange} />

        <div className="mt-6 border-t border-stone-200 pt-5">
          <DataSection
            localEventCount={localEventCount}
            onLocalEventsChange={onLocalEventsChange}
            onHomeChange={onHomeChange}
          />
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full text-sm text-stone-500 hover:text-stone-900 py-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function HomeSection({
  initial,
  onChange,
}: {
  initial: Home | null;
  onChange: (h: Home | null) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? 'Home');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null);
  const [geocoding, setGeocoding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function locate() {
    if (!address) return;
    setGeocoding(true);
    setStatus(null);
    const hit = await geocodeAddress(address);
    setGeocoding(false);
    if (!hit) {
      setStatus('Could not locate — directions will use the address string.');
      return;
    }
    setLat(hit.lat);
    setLng(hit.lng);
  }

  function save() {
    if (!address.trim()) {
      setStatus('Enter an address first.');
      return;
    }
    const next: Home = { label: label.trim() || 'Home', address: address.trim(), lat, lng };
    setHome(next);
    onChange(next);
    setStatus('Saved.');
  }

  function remove() {
    setHome(null);
    setLabel('Home');
    setAddress('');
    setLat(null);
    setLng(null);
    setStatus(null);
    onChange(null);
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-stone-800">Home base</h3>
      <p className="text-xs text-stone-500 mt-0.5 mb-3">
        Used for &quot;from ⌂&quot; directions and a pin on the map.
      </p>
      <div className="space-y-2">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1">
            Label
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-stone-500 mb-1">
            Address
          </span>
          <div className="flex gap-2">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setLat(null);
                setLng(null);
              }}
              placeholder="Via Roma 10, Milano"
              className="flex-1 border border-stone-300 rounded px-2 py-1.5 bg-white text-sm"
            />
            <button
              type="button"
              onClick={locate}
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
        </label>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={save}
          className="bg-stone-900 text-white rounded-full px-4 py-1.5 text-sm font-medium hover:bg-stone-800"
        >
          Save
        </button>
        {initial && (
          <button
            onClick={remove}
            className="text-sm text-stone-500 hover:text-red-600 px-3 py-1.5"
          >
            Remove
          </button>
        )}
        {status && <span className="text-xs text-stone-500 self-center">{status}</span>}
      </div>
    </div>
  );
}

function DataSection({
  localEventCount,
  onLocalEventsChange,
  onHomeChange,
}: {
  localEventCount: number;
  onLocalEventsChange: () => void;
  onHomeChange: (h: Home | null) => void;
}) {
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  function copyExport() {
    const json = exportJson();
    navigator.clipboard.writeText(json).then(
      () => setStatus(`Copied ${localEventCount} events to clipboard.`),
      () => setStatus('Copy failed.'),
    );
  }

  function doImport() {
    try {
      const n = importJson(importText, 'merge');
      onLocalEventsChange();
      setStatus(`Imported — ${n} events total.`);
      setImportText('');
      setShowImport(false);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Import failed');
    }
  }

  function wipeAll() {
    if (!confirm('Clear picks, home, and all personal events in this browser?')) return;
    clearPrefs();
    clearPicks();
    clearLocalEvents();
    onHomeChange(null);
    onLocalEventsChange();
    setStatus('Cleared.');
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-stone-800">Your data</h3>
      <p className="text-xs text-stone-500 mt-0.5 mb-3">
        {localEventCount} personal event{localEventCount === 1 ? '' : 's'} · picks &amp; home live
        in this browser only.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={copyExport}
          className="text-xs border border-stone-300 rounded-full px-3 py-1.5 hover:bg-stone-50"
        >
          Export events as JSON
        </button>
        <button
          onClick={() => setShowImport((v) => !v)}
          className="text-xs border border-stone-300 rounded-full px-3 py-1.5 hover:bg-stone-50"
        >
          Import…
        </button>
        <button
          onClick={wipeAll}
          className="text-xs border border-red-300 text-red-700 rounded-full px-3 py-1.5 hover:bg-red-50"
        >
          Clear all data
        </button>
      </div>
      {showImport && (
        <div className="mt-3 space-y-2">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder="Paste the JSON you exported earlier"
            className="w-full border border-stone-300 rounded px-2 py-1.5 bg-white text-xs font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={doImport}
              disabled={!importText.trim()}
              className="text-xs bg-stone-900 text-white rounded-full px-3 py-1.5 disabled:opacity-40"
            >
              Merge into my events
            </button>
          </div>
        </div>
      )}
      {status && <div className="text-xs text-stone-500 mt-2">{status}</div>}
    </div>
  );
}

"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { TextField } from "@/components/auth/TextField";

export interface VenueLocation {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

/**
 * Wraps Google's Places `PlaceAutocompleteElement` so venue coordinates come
 * from a real address lookup instead of the user typing raw latitude/
 * longitude by hand (api_design.docx §8.2 still requires both — this just
 * derives them instead of asking for them directly).
 *
 * Falls back to plain manual address + lat/long entry when
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY isn't configured, so the form stays fully
 * usable in any environment (including this one, right now — nobody has
 * supplied a real key yet) rather than being a hard dependency.
 */
export function VenueAddressField({
  value,
  onChange,
}: {
  value: VenueLocation;
  onChange: (location: VenueLocation) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  // Set on a script load failure (network block, ad blocker, CSP, an
  // invalid/restricted key) or a places-library/lookup failure — without
  // this, any of those leaves the field permanently empty with no way to
  // enter a venue at all, since the manual fallback below only triggered
  // on a missing API key, not a key that's present but not working.
  const [autocompleteFailed, setAutocompleteFailed] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  // `onChange` is a fresh closure on every parent render (it's an inline
  // callback, not memoized) — depending on it directly would tear down and
  // recreate the autocomplete widget on every keystroke in any other form
  // field, since this whole page re-renders on every form-state change.
  // Routing calls through a ref keeps the effect below running exactly once
  // per mount while still always calling the latest onChange. The ref is
  // updated in its own effect, not during render — React (and its lint
  // rule) treats a ref write during render as undefined behavior.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!scriptReady || !containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    async function setup() {
      let PlaceAutocompleteElement;
      try {
        ({ PlaceAutocompleteElement } = await google.maps.importLibrary("places"));
      } catch {
        if (!cancelled) setAutocompleteFailed(true);
        return;
      }
      if (cancelled) return;

      const element = new PlaceAutocompleteElement();
      container.replaceChildren(element);

      element.addEventListener("gmp-select", (event) => {
        void (async () => {
          setPickError(null);
          try {
            const { place } = await event.placePrediction.toPlace().fetchFields({
              fields: ["formattedAddress", "location"],
            });
            if (!place.location) {
              setPickError(
                "That result didn't include a precise location — try a different address.",
              );
              return;
            }
            onChangeRef.current({
              address: place.formattedAddress ?? "",
              latitude: place.location.lat(),
              longitude: place.location.lng(),
            });
          } catch {
            setPickError("Couldn't look up that address. Please try again.");
          }
        })();
      });
    }

    void setup();
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [scriptReady]);

  if (!GOOGLE_MAPS_API_KEY || autocompleteFailed) {
    return <ManualVenueFields value={value} onChange={onChange} />;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setAutocompleteFailed(true)}
      />
      <label className="font-label-lg text-label-lg text-on-surface">
        Venue address
        <span className="text-error" aria-hidden="true">
          {" "}
          *
        </span>
      </label>
      <div ref={containerRef} />
      {pickError && (
        <span className="font-body-sm text-body-sm text-error" role="alert">
          {pickError}
        </span>
      )}
      {value.address && (
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          Selected: {value.address}
        </span>
      )}
    </div>
  );
}

// `type="number"` still lets through syntactically-valid-but-useless values
// like "1e400" (Number("1e400") === Infinity) — Infinity is `!== null`, so
// it would otherwise slip past weddings/page.tsx's `latitude === null`
// submit guard. Rejecting non-finite values here keeps that guard correct
// for both this fallback and the autocomplete path above.
function parseCoordinate(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function ManualVenueFields({
  value,
  onChange,
}: {
  value: VenueLocation;
  onChange: (location: VenueLocation) => void;
}) {
  return (
    <div className="flex flex-col gap-space-md">
      <TextField
        label="Venue address"
        name="venueAddress"
        value={value.address}
        onChange={(address) => onChange({ ...value, address })}
        required
      />
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        <TextField
          label="Venue latitude"
          type="number"
          step="any"
          name="venueLatitude"
          value={value.latitude === null ? "" : String(value.latitude)}
          onChange={(v) => onChange({ ...value, latitude: parseCoordinate(v) })}
          required
          placeholder="24.5762"
        />
        <TextField
          label="Venue longitude"
          type="number"
          step="any"
          name="venueLongitude"
          value={value.longitude === null ? "" : String(value.longitude)}
          onChange={(v) => onChange({ ...value, longitude: parseCoordinate(v) })}
          required
          placeholder="73.6833"
        />
      </div>
    </div>
  );
}

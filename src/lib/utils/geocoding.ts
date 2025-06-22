// lib/utils/geocodeAddress.ts

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress({
  street,
  city,
  state,
  zipCode,
  country = "US",
}: {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}): Promise<GeocodeResult | null> {
  const address = encodeURIComponent(
    `${street}, ${city}, ${state} ${zipCode}, ${country}`,
  );
  const apiKey = process.env.OPENCAGE_API_KEY;

  const url = `https://api.opencagedata.com/geocode/v1/json?q=${address}&key=${apiKey}`;

  const res = await fetch(url);

  if (!res.ok) {
    console.error("Geocoding failed:", await res.text());
    return null;
  }

  const data = await res.json();

  const result = data.results?.[0]?.geometry;
  if (!result) return null;

  return {
    latitude: result.lat,
    longitude: result.lng,
  };
}

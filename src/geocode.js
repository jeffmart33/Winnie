function buildNominatimHeaders() {
  return {
    'User-Agent': process.env.GEOCODER_USER_AGENT || 'store-locator/1.0 (admin@localhost)'
  };
}

async function geocodeAddress(address) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, { headers: buildNominatimHeaders() });
  if (!response.ok) throw new Error('Geocoding request failed');

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Address not found');
  }

  return {
    latitude: Number(data[0].lat),
    longitude: Number(data[0].lon),
    formattedAddress: data[0].display_name
  };
}

async function reverseGeocode(latitude, longitude) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');

  const response = await fetch(url, { headers: buildNominatimHeaders() });
  if (!response.ok) throw new Error('Reverse geocoding request failed');

  const data = await response.json();
  if (!data || !data.display_name) {
    throw new Error('Address not found for coordinates');
  }

  return { formattedAddress: data.display_name };
}

module.exports = { geocodeAddress, reverseGeocode };

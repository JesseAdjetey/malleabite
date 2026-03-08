/**
 * Real-time Data Service — Client side (browser / Vapi tool calls)
 *
 * Fetches live data from external APIs using VITE_ environment keys.
 * Called from BottomMallyAI.tsx onToolCall handler when Mally invokes
 * search_web / get_weather / get_stock_price / get_flight_status.
 */

// ─── Types (mirrored from Firebase side) ─────────────────────────────────────

export interface WeatherResult {
  location: string;
  temp: number;
  feels_like: number;
  description: string;
  humidity: number;
  wind_speed: number;
  icon: string;
}

export interface StockResult {
  symbol: string;
  price: number;
  change: number;
  change_percent: string;
  open: number;
  high: number;
  low: number;
  volume: string;
  updated: string;
}

export interface FlightResult {
  flight_number: string;
  airline: string;
  status: string;
  departure_airport: string;
  departure_time: string;
  departure_actual?: string;
  arrival_airport: string;
  arrival_time: string;
  arrival_actual?: string;
  delay_minutes?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

// ─── Weather ─────────────────────────────────────────────────────────────────

export async function getWeather(location: string): Promise<WeatherResult | null> {
  const key = import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined;
  if (!key) {
    console.warn('[RealtimeData] VITE_OPENWEATHER_API_KEY not set');
    return null;
  }
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${key}&units=metric`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      location: `${data.name}, ${data.sys?.country}`,
      temp: Math.round(data.main?.temp),
      feels_like: Math.round(data.main?.feels_like),
      description: data.weather?.[0]?.description,
      humidity: data.main?.humidity,
      wind_speed: Math.round((data.wind?.speed || 0) * 3.6),
      icon: data.weather?.[0]?.icon,
    };
  } catch (err) {
    console.error('[RealtimeData] Weather error:', err);
    return null;
  }
}

// ─── Stock Price ──────────────────────────────────────────────────────────────

export async function getStockPrice(symbol: string): Promise<StockResult | null> {
  const key = import.meta.env.VITE_ALPHAVANTAGE_API_KEY as string | undefined;
  if (!key) {
    console.warn('[RealtimeData] VITE_ALPHAVANTAGE_API_KEY not set');
    return null;
  }
  try {
    const res = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol.toUpperCase())}&apikey=${key}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const quote = data['Global Quote'];
    if (!quote?.['05. price']) return null;
    return {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      change_percent: quote['10. change percent'],
      open: parseFloat(quote['02. open']),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      volume: parseInt(quote['06. volume']).toLocaleString(),
      updated: quote['07. latest trading day'],
    };
  } catch (err) {
    console.error('[RealtimeData] Stock error:', err);
    return null;
  }
}

// ─── Flight Status ────────────────────────────────────────────────────────────

export async function getFlightStatus(flightNumber: string): Promise<FlightResult | null> {
  const key = import.meta.env.VITE_AVIATIONSTACK_API_KEY as string | undefined;
  if (!key) {
    console.warn('[RealtimeData] VITE_AVIATIONSTACK_API_KEY not set');
    return null;
  }
  try {
    const iata = flightNumber.toUpperCase().replace(/\s/g, '');
    const res = await fetch(
      `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${encodeURIComponent(iata)}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const flight = data?.data?.[0];
    if (!flight) return null;

    return {
      flight_number: flight.flight?.iata || flightNumber,
      airline: flight.airline?.name || 'Unknown',
      status: formatStatus(flight.flight_status),
      departure_airport: `${flight.departure?.airport} (${flight.departure?.iata})`,
      departure_time: flight.departure?.scheduled || 'TBD',
      departure_actual: flight.departure?.actual,
      arrival_airport: `${flight.arrival?.airport} (${flight.arrival?.iata})`,
      arrival_time: flight.arrival?.scheduled || 'TBD',
      arrival_actual: flight.arrival?.actual,
      delay_minutes: flight.departure?.delay || flight.arrival?.delay,
    };
  } catch (err) {
    console.error('[RealtimeData] Flight error:', err);
    return null;
  }
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    scheduled: '🕐 Scheduled',
    active: '✈️ In Air',
    landed: '✅ Landed',
    cancelled: '❌ Cancelled',
    incident: '⚠️ Incident',
    diverted: '🔀 Diverted',
  };
  return map[status?.toLowerCase()] || status || 'Unknown';
}

// ─── Web Search ───────────────────────────────────────────────────────────────

export async function searchWeb(query: string, count = 5): Promise<SearchResult[]> {
  const key = import.meta.env.VITE_BRAVE_SEARCH_API_KEY as string | undefined;
  if (!key) {
    console.warn('[RealtimeData] VITE_BRAVE_SEARCH_API_KEY not set');
    return [];
  }
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&text_decorations=0&search_lang=en`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': key,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.web?.results || []).slice(0, count).map((r: any) => ({
      title: r.title,
      url: r.url,
      description: r.description || r.extra_snippets?.[0] || '',
    }));
  } catch (err) {
    console.error('[RealtimeData] Search error:', err);
    return [];
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatWeather(w: WeatherResult): string {
  return `**Weather in ${w.location}:** ${w.temp}°C (feels like ${w.feels_like}°C) · ${w.description} · Humidity: ${w.humidity}% · Wind: ${w.wind_speed} km/h`;
}

export function formatStock(s: StockResult): string {
  const dir = s.change >= 0 ? '📈' : '📉';
  return `${dir} **${s.symbol}:** $${s.price.toFixed(2)}  (${s.change >= 0 ? '+' : ''}${s.change_percent}) · High: $${s.high.toFixed(2)} · Low: $${s.low.toFixed(2)} · Volume: ${s.volume} · *${s.updated}*`;
}

export function formatFlight(f: FlightResult): string {
  const delay = f.delay_minutes ? ` — **${f.delay_minutes} min delay**` : '';
  return [
    `✈️ **${f.flight_number}** (${f.airline}): ${f.status}${delay}`,
    `   ${f.departure_airport} → ${f.arrival_airport}`,
    `   Departure: ${f.departure_actual || f.departure_time}`,
    `   Arrival: ${f.arrival_actual || f.arrival_time}`,
  ].join('\n');
}

export function formatSearch(results: SearchResult[]): string {
  if (!results.length) return 'No results found.';
  return results
    .map((r, i) => `**${i + 1}. [${r.title}](${r.url})**\n${r.description}`)
    .join('\n\n');
}

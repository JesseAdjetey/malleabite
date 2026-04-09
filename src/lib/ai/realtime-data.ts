/**
 * Real-time Data Service — Client side (browser / Vapi tool calls)
 *
 * All API keys are kept server-side. This module calls the
 * realtimeDataProxy Cloud Function which holds the secrets.
 */

import { getAuth } from 'firebase/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Proxy helper ────────────────────────────────────────────────────────────

const PROXY_URL =
  `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'malleabite-97d35'}.cloudfunctions.net/realtimeDataProxy`;

async function callProxy<T>(action: string, params: Record<string, any>): Promise<T | null> {
  try {
    const user = getAuth().currentUser;
    if (!user) {
      console.warn('[RealtimeData] No authenticated user');
      return null;
    }
    const token = await user.getIdToken();
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, params }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as T;
  } catch (err) {
    console.error(`[RealtimeData] ${action} error:`, err);
    return null;
  }
}

// ─── Public API (same signatures as before) ──────────────────────────────────

export async function getWeather(location: string): Promise<WeatherResult | null> {
  return callProxy<WeatherResult>('get_weather', { location });
}

export async function getStockPrice(symbol: string): Promise<StockResult | null> {
  return callProxy<StockResult>('get_stock_price', { symbol });
}

export async function getFlightStatus(flightNumber: string): Promise<FlightResult | null> {
  return callProxy<FlightResult>('get_flight_status', { flightNumber });
}

export async function searchWeb(query: string, count = 5): Promise<SearchResult[]> {
  const result = await callProxy<SearchResult[]>('search_web', { query, count });
  return result || [];
}

// ─── Format helpers ──────────────────────────────────────────────────────────

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

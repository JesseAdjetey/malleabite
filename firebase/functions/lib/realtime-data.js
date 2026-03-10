"use strict";
/**
 * Real-time Data Service — Firebase Functions side
 *
 * Fetches live data from external APIs to inject into AI prompts.
 * Used by WhatsApp bot and in-chat AI to give context-aware answers.
 *
 * APIs:
 *   - Brave Search (BRAVE_SEARCH_API_KEY)
 *   - OpenWeatherMap (OPENWEATHER_API_KEY)
 *   - Alpha Vantage stocks (ALPHAVANTAGE_API_KEY)
 *   - AviationStack flights (AVIATIONSTACK_API_KEY)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeather = getWeather;
exports.getStockPrice = getStockPrice;
exports.getFlightStatus = getFlightStatus;
exports.searchWeb = searchWeb;
exports.formatWeatherForPrompt = formatWeatherForPrompt;
exports.formatStockForPrompt = formatStockForPrompt;
exports.formatFlightForPrompt = formatFlightForPrompt;
exports.formatSearchForPrompt = formatSearchForPrompt;
// ─── Weather ─────────────────────────────────────────────────────────────────
async function getWeather(location, apiKey) {
    const key = apiKey || process.env.OPENWEATHER_API_KEY;
    if (!key) {
        console.warn('[RealTimeData] OPENWEATHER_API_KEY not configured');
        return null;
    }
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${key}&units=metric`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn('[RealTimeData] Weather fetch failed:', res.status, await res.text());
            return null;
        }
        const data = await res.json();
        return {
            location: `${data.name}, ${data.sys?.country}`,
            temp: Math.round(data.main?.temp),
            feels_like: Math.round(data.main?.feels_like),
            description: data.weather?.[0]?.description,
            humidity: data.main?.humidity,
            wind_speed: Math.round((data.wind?.speed || 0) * 3.6), // m/s → km/h
            icon: data.weather?.[0]?.icon,
        };
    }
    catch (err) {
        console.error('[RealTimeData] Weather error:', err);
        return null;
    }
}
// ─── Stock Price ──────────────────────────────────────────────────────────────
async function getStockPrice(symbol, apiKey) {
    const key = apiKey || process.env.ALPHAVANTAGE_API_KEY;
    if (!key) {
        console.warn('[RealTimeData] ALPHAVANTAGE_API_KEY not configured');
        return null;
    }
    try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol.toUpperCase())}&apikey=${key}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn('[RealTimeData] Stock fetch failed:', res.status);
            return null;
        }
        const data = await res.json();
        const quote = data['Global Quote'];
        if (!quote || !quote['05. price']) {
            console.warn('[RealTimeData] No stock data for symbol:', symbol);
            return null;
        }
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
    }
    catch (err) {
        console.error('[RealTimeData] Stock error:', err);
        return null;
    }
}
// ─── Flight Status ────────────────────────────────────────────────────────────
async function getFlightStatus(flightNumber, apiKey) {
    const key = apiKey || process.env.AVIATIONSTACK_API_KEY;
    if (!key) {
        console.warn('[RealTimeData] AVIATIONSTACK_API_KEY not configured');
        return null;
    }
    try {
        const iata = flightNumber.toUpperCase().replace(/\s/g, '');
        const url = `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${encodeURIComponent(iata)}&limit=1`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn('[RealTimeData] Flight fetch failed:', res.status);
            return null;
        }
        const data = await res.json();
        const flight = data?.data?.[0];
        if (!flight) {
            console.warn('[RealTimeData] No flight data for:', flightNumber);
            return null;
        }
        return {
            flight_number: flight.flight?.iata || flightNumber,
            airline: flight.airline?.name || 'Unknown Airline',
            status: formatFlightStatus(flight.flight_status),
            departure_airport: `${flight.departure?.airport} (${flight.departure?.iata})`,
            departure_time: flight.departure?.scheduled || 'Unknown',
            departure_actual: flight.departure?.actual,
            arrival_airport: `${flight.arrival?.airport} (${flight.arrival?.iata})`,
            arrival_time: flight.arrival?.scheduled || 'Unknown',
            arrival_actual: flight.arrival?.actual,
            delay_minutes: flight.departure?.delay || flight.arrival?.delay,
        };
    }
    catch (err) {
        console.error('[RealTimeData] Flight error:', err);
        return null;
    }
}
function formatFlightStatus(status) {
    const map = {
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
async function searchWeb(query, apiKey, count = 5) {
    const key = apiKey || process.env.BRAVE_SEARCH_API_KEY;
    if (!key) {
        console.warn('[RealTimeData] BRAVE_SEARCH_API_KEY not configured');
        return [];
    }
    try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&text_decorations=0&search_lang=en`;
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': key,
            },
        });
        if (!res.ok) {
            console.warn('[RealTimeData] Search fetch failed:', res.status, await res.text());
            return [];
        }
        const data = await res.json();
        return (data?.web?.results || []).slice(0, count).map((r) => ({
            title: r.title,
            url: r.url,
            description: r.description || r.extra_snippets?.[0] || '',
        }));
    }
    catch (err) {
        console.error('[RealTimeData] Search error:', err);
        return [];
    }
}
// ─── Format helpers for prompt injection ─────────────────────────────────────
function formatWeatherForPrompt(w) {
    return `🌤 Weather in ${w.location}: ${w.temp}°C (feels like ${w.feels_like}°C), ${w.description}, humidity ${w.humidity}%, wind ${w.wind_speed} km/h`;
}
function formatStockForPrompt(s) {
    const dir = s.change >= 0 ? '📈' : '📉';
    return `${dir} ${s.symbol}: $${s.price.toFixed(2)} (${s.change >= 0 ? '+' : ''}${s.change_percent}) · H: $${s.high.toFixed(2)} · L: $${s.low.toFixed(2)} · Vol: ${s.volume} as of ${s.updated}`;
}
function formatFlightForPrompt(f) {
    const delay = f.delay_minutes ? ` (${f.delay_minutes} min delay)` : '';
    return `✈️ ${f.flight_number} (${f.airline}): ${f.status}${delay} · ${f.departure_airport} → ${f.arrival_airport} · Dep: ${f.departure_actual || f.departure_time} · Arr: ${f.arrival_actual || f.arrival_time}`;
}
function formatSearchForPrompt(results) {
    if (!results.length)
        return 'No search results found.';
    return results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.description}\n   ${r.url}`).join('\n\n');
}
//# sourceMappingURL=realtime-data.js.map
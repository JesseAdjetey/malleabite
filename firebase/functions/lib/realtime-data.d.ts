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
export declare function getWeather(location: string, apiKey?: string): Promise<WeatherResult | null>;
export declare function getStockPrice(symbol: string, apiKey?: string): Promise<StockResult | null>;
export declare function getFlightStatus(flightNumber: string, apiKey?: string): Promise<FlightResult | null>;
export declare function searchWeb(query: string, apiKey?: string, count?: number): Promise<SearchResult[]>;
export declare function formatWeatherForPrompt(w: WeatherResult): string;
export declare function formatStockForPrompt(s: StockResult): string;
export declare function formatFlightForPrompt(f: FlightResult): string;
export declare function formatSearchForPrompt(results: SearchResult[]): string;

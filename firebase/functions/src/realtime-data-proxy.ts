/**
 * Realtime Data Proxy — keeps API keys server-side only.
 *
 * The frontend calls this single endpoint with { action, params },
 * and this function dispatches to the appropriate external API.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import {
  getWeather,
  getStockPrice,
  getFlightStatus,
  searchWeb,
} from './realtime-data';

const openweatherKey = defineSecret('OPENWEATHER_API_KEY');
const alphavantageKey = defineSecret('ALPHAVANTAGE_API_KEY');
const aviationstackKey = defineSecret('AVIATIONSTACK_API_KEY');
const braveSearchKey = defineSecret('BRAVE_SEARCH_API_KEY');

export const realtimeDataProxy = onRequest(
  {
    cors: [
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:5173',
      'http://localhost:3000',
      'https://malleabite-97d35.web.app',
      'https://malleabite-97d35.firebaseapp.com',
      'https://malleabite.vercel.app',
      /\.vercel\.app$/,
    ],
    region: 'us-central1',
    secrets: [openweatherKey, alphavantageKey, aviationstackKey, braveSearchKey],
  },
  async (req, res) => {
    // Preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // Auth — require a logged-in user
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const { action, params } = req.body as {
      action: string;
      params: Record<string, any>;
    };

    try {
      let data: any = null;

      switch (action) {
        case 'get_weather':
          data = await getWeather(params.location, openweatherKey.value());
          break;
        case 'get_stock_price':
          data = await getStockPrice(params.symbol, alphavantageKey.value());
          break;
        case 'get_flight_status':
          data = await getFlightStatus(params.flightNumber, aviationstackKey.value());
          break;
        case 'search_web':
          data = await searchWeb(params.query, braveSearchKey.value(), params.count);
          break;
        default:
          res.status(400).json({ error: `Unknown action: ${action}` });
          return;
      }

      res.status(200).json({ data });
    } catch (err: any) {
      console.error('[realtimeDataProxy] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

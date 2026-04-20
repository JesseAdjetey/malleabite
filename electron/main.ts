import { app, BrowserWindow, ipcMain, shell, session } from 'electron';
import path from 'path';
import http from 'http';
import * as apple from './apple-bridge';

// ─── Local auth callback server ───────────────────────────────────────────────
// The /electron-auth page fetches http://localhost:34567/auth-callback?idToken=...
// instead of redirecting to a custom URL scheme (which doesn't work in dev mode).
const AUTH_CALLBACK_PORT = 34567;

const authServer = http.createServer((req, res) => {
  // Allow the renderer page to POST to this server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || '/', `http://localhost:${AUTH_CALLBACK_PORT}`);
  if (url.pathname === '/auth-callback') {
    const idToken = url.searchParams.get('idToken');
    const accessToken = url.searchParams.get('accessToken') || undefined;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));

    // Forward tokens to the main window renderer
    if (idToken && mainWindow) {
      const payload = JSON.stringify({ idToken, accessToken: accessToken || null });
      mainWindow.webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('electron-oauth-callback', { detail: ${payload} }))`
      );
      mainWindow.focus();
    }
  } else {
    res.writeHead(404); res.end();
  }
});

authServer.listen(AUTH_CALLBACK_PORT);

// Register custom URL scheme so macOS routes malleabite:// back to this app
app.setAsDefaultProtocolClient('malleabite');

// Spoof a real Chrome user agent for the entire session.
// Google rejects Electron's default UA; setting Chrome here means every
// window and popup (including Firebase's signInWithPopup window) passes
// Google's user-agent check without any extra code in the renderer.
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

app.on('ready', () => {
  session.defaultSession.setUserAgent(CHROME_UA);
});

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // native macOS traffic lights inset
    vibrancy: 'sidebar',           // native macOS frosted glass
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for preload to use ipcRenderer
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:8080');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Allow Google OAuth popup to communicate back (same as Vite COOP header)
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin-allow-popups'],
      },
    });
  });

  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Handle deep link redirect back from browser after Google OAuth
// macOS fires 'open-url' when the OS routes malleabite:// to this app
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (!mainWindow) return;
  try {
    const parsed = new URL(url);
    const idToken = parsed.searchParams.get('idToken');
    const accessToken = parsed.searchParams.get('accessToken');
    if (idToken) {
      const payload = JSON.stringify({ idToken, accessToken: accessToken || null });
      mainWindow.webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('electron-oauth-callback', { detail: ${payload} }))`
      );
      mainWindow.focus();
    }
  } catch {}
});

// IPC: open a URL in the system browser
ipcMain.handle('open-external', async (_e, url: string) => {
  // For the electron-auth page, open a small popup window instead of the system browser
  // so the user doesn't have to leave the app
  if (url.includes('/electron-auth')) {
    const popup = new BrowserWindow({
      width: 420,
      height: 540,
      resizable: false,
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    popup.loadURL(url);

    // Intercept when the auth page redirects to malleabite://auth?idToken=...
    // This fires inside Electron before the OS ever sees the custom scheme,
    // so it works in dev mode without any system protocol registration.
    const forwardTokensFromUrl = (rawUrl: string) => {
      try {
        const parsed = new URL(rawUrl);
        const idToken = parsed.searchParams.get('idToken');
        const accessToken = parsed.searchParams.get('accessToken');
        if (idToken && mainWindow) {
          const payload = JSON.stringify({ idToken, accessToken: accessToken || null });
          mainWindow.webContents.executeJavaScript(
            `window.dispatchEvent(new CustomEvent('electron-oauth-callback', { detail: ${payload} }))`
          );
          mainWindow.focus();
        }
      } catch {}
      popup.close();
    };

    popup.webContents.on('will-navigate', (_e, navUrl) => {
      if (!navUrl.startsWith('malleabite://')) return;
      _e.preventDefault();
      forwardTokensFromUrl(navUrl);
    });

    popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
      if (newUrl.startsWith('malleabite://')) {
        forwardTokensFromUrl(newUrl);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    return;
  }
  await shell.openExternal(url);
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: Apple Reminders ─────────────────────────────────────────────────────

// On macOS, Reminders/Calendar access is gated by TCC — the first JXA call
// that touches those apps will trigger the system permission dialog automatically.
// We don't need a separate "request permission" step, but we expose one so the
// renderer can prime it with a user-friendly prompt before the first real call.

ipcMain.handle('apple:requestRemindersPermission', async () => {
  try {
    await apple.getReminders(); // triggers TCC if not yet granted
    return { granted: true };
  } catch {
    return { granted: false };
  }
});

ipcMain.handle('apple:getReminderLists', async () => {
  try {
    const lists = await apple.getReminderLists();
    return { lists };
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to get reminder lists');
  }
});

ipcMain.handle('apple:getReminders', async (_e, listId?: string) => {
  try {
    const reminders = await apple.getReminders(listId);
    return { reminders };
  } catch (err: any) {
    throw new Error(err?.message || 'Failed to get reminders');
  }
});

ipcMain.handle('apple:createReminder', async (_e, params) => {
  const reminder = await apple.createReminder(params);
  return { reminder };
});

ipcMain.handle('apple:updateReminder', async (_e, params) => {
  const { reminderId, ...rest } = params;
  const reminder = await apple.updateReminder({ reminderId, ...rest });
  return { reminder };
});

ipcMain.handle('apple:deleteReminder', async (_e, reminderId: string) => {
  await apple.deleteReminder(reminderId);
  return { deleted: true };
});

ipcMain.handle('apple:completeReminder', async (_e, reminderId: string) => {
  await apple.completeReminder(reminderId);
  return { completed: true };
});

// ─── IPC: Apple Calendar ──────────────────────────────────────────────────────

ipcMain.handle('apple:requestCalendarPermission', async () => {
  try {
    await apple.getCalendars(); // triggers TCC if not yet granted
    return { granted: true };
  } catch {
    return { granted: false };
  }
});

ipcMain.handle('apple:getCalendars', async () => {
  const calendars = await apple.getCalendars();
  return { calendars };
});

ipcMain.handle('apple:getEvents', async (_e, startDate: string, endDate: string) => {
  const events = await apple.getEvents(startDate, endDate);
  return { events };
});

ipcMain.handle('apple:createEvent', async (_e, params) => {
  const event = await apple.createEvent(params);
  return { event };
});

ipcMain.handle('apple:deleteEvent', async (_e, eventId: string) => {
  await apple.deleteEvent(eventId);
  return { deleted: true };
});

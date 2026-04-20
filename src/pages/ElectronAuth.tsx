/**
 * ElectronAuth page — runs in the user's SYSTEM browser (Safari/Chrome), not Electron.
 * Electron opens this page via shell.openExternal so the user gets the familiar
 * Google account picker with all their signed-in accounts.
 *
 * Flow:
 *  1. Electron opens http://localhost:8080/electron-auth in system browser
 *  2. This page auto-triggers signInWithPopup with Google
 *  3. On success, extracts the Google credential and redirects to
 *     malleabite://auth?idToken=...&accessToken=...
 *  4. Electron's open-url handler forwards the tokens to the renderer
 *  5. Renderer calls signInWithCredential and the user is signed in
 */

import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/integrations/firebase/config';

export default function ElectronAuth() {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const [copied, setCopied] = useState(false);
  const url = 'http://localhost:8080/electron-auth';

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignIn = async () => {
    setStatus('pending');
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.idToken) throw new Error('No ID token returned from Google');
      setStatus('success');
      const params = new URLSearchParams({
        idToken: credential.idToken,
        ...(credential.accessToken ? { accessToken: credential.accessToken } : {}),
      });
      // POST tokens to the local Electron auth server — works in dev without
      // needing OS-level custom URL scheme registration.
      const port = (window as any).electronAPI?.authCallbackPort ?? 34567;
      await fetch(`http://localhost:${port}/auth-callback?${params.toString()}`).catch(() => {
        // Fallback for packaged app where the scheme is registered
        window.location.href = `malleabite://auth?${params.toString()}`;
      });
      setTimeout(() => window.close(), 1500);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setStatus('idle');
      } else {
        setError(err?.message || 'Sign-in failed');
        setStatus('error');
      }
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, background: '#0a0a0a', color: '#fff' }}>
      {/* Logo */}
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
        M
      </div>

      {status === 'idle' && (
        <>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Sign in to Malleabite</p>
            <p style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Click the button below in this browser</p>
          </div>

          <button
            onClick={handleSignIn}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 29.8 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.4-4h-.1z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 17 19.3 14 24 14c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 16 3 9.1 7.8 6.3 14.7z"/><path fill="#FBBC05" d="M24 45c5.5 0 10.5-1.9 14.4-5l-6.6-5.4C29.8 36.1 27 37 24 37c-5.7 0-10.6-3.9-12.3-9.2l-7 5.4C8.3 40.4 15.6 45 24 45z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.5-2.4 4.7-4.5 6.1l6.6 5.4C41.7 37.1 45 31 45 24c0-1.4-.1-2.7-.4-4h-.1z"/></svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 320 }}>
            <div style={{ flex: 1, height: 1, background: '#333' }} />
            <span style={{ fontSize: 11, color: '#555' }}>or open in another browser</span>
            <div style={{ flex: 1, height: 1, background: '#333' }} />
          </div>

          {/* Copy link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', border: '1px solid #333', borderRadius: 8, padding: '8px 12px', width: '100%', maxWidth: 320 }}>
            <span style={{ flex: 1, fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
            <button
              onClick={handleCopy}
              style={{ fontSize: 12, color: copied ? '#22c55e' : '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#555', textAlign: 'center', maxWidth: 300, margin: 0 }}>
            Paste this URL into Chrome or any browser where you're signed into Google
          </p>
        </>
      )}

      {status === 'pending' && (
        <>
          <div style={{ width: 32, height: 32, border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ fontSize: 13, color: '#888' }}>Signing in… complete the Google popup</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#16a34a22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#22c55e"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Signed in!</p>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>Returning to Malleabite… you can close this tab.</p>
        </>
      )}

      {status === 'error' && (
        <>
          <p style={{ fontSize: 14, color: '#ef4444', fontWeight: 500 }}>Sign-in failed</p>
          <p style={{ fontSize: 12, color: '#888' }}>{error}</p>
          <button onClick={() => { setStatus('idle'); setError(''); }} style={{ fontSize: 13, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

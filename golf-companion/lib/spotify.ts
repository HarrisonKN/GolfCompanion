import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/components/supabase';
import { encode as btoa } from 'base-64';
import SHA256 from 'crypto-js/sha256';
import enc from 'crypto-js/enc-base64';

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';
const SPOTIFY_REDIRECT_URI = 'golfcompanion://golfHub';
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
];

// PKCE helper functions
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = SHA256(codeVerifier).toString(enc);
  return hash
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  is_local: boolean;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
  device: {
    name: string;
  };
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  external_urls: { spotify: string };
  images: Array<{ url: string }>;
}

class SpotifyService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;
  private codeVerifier: string = '';

  async initialize(userId: string) {
    try {
      // Try to get stored tokens
      const stored = await SecureStore.getItemAsync(`spotify_tokens_${userId}`);
      if (stored) {
        const tokens = JSON.parse(stored);
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.expiresAt = tokens.expiresAt;

        // Check if token is expired and refresh if needed
        if (Date.now() >= this.expiresAt) {
          await this.refreshAccessToken();
        }
      }
    } catch (error) {
      console.error('Error initializing Spotify:', error);
    }
  }

  async getAuthorizationUrl(): Promise<string> {
    const state = Math.random().toString(36).substring(7);
    const scope = SPOTIFY_SCOPES.join('%20');
    
    // Generate PKCE code verifier and challenge
    this.codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(this.codeVerifier);
    
    console.log('[Spotify] Generated PKCE code verifier (128 chars), challenge:', codeChallenge.substring(0, 20) + '...');

    return (
      `https://accounts.spotify.com/authorize?` +
      `client_id=${SPOTIFY_CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
      `scope=${scope}&` +
      `state=${state}&` +
      `code_challenge_method=S256&` +
      `code_challenge=${codeChallenge}&` +
      `show_dialog=true`
    );
  }

  async handleAuthorizationCode(code: string, userId: string): Promise<boolean> {
    try {
      console.log('[Spotify] Starting PKCE token exchange with code:', code.substring(0, 10) + '...');
      
      if (!this.codeVerifier) {
        throw new Error('Code verifier not set - authorization URL was not generated');
      }
      
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          client_id: SPOTIFY_CLIENT_ID,
          code_verifier: this.codeVerifier,
        }).toString(),
      });

      console.log('[Spotify] Token exchange response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Spotify] Token exchange failed:', response.status, errorText);
        throw new Error(`Failed to exchange code for token: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Spotify] Token exchange successful, expires in:', data.expires_in, 'seconds');
      
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.expiresAt = Date.now() + data.expires_in * 1000;

      // Store tokens securely
      await SecureStore.setItemAsync(
        `spotify_tokens_${userId}`,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.expiresAt,
        })
      );

      // Store in Supabase for backup
      await supabase
        .from('user_spotify_tokens')
        .upsert({
          user_id: userId,
          refresh_token: this.refreshToken,
          updated_at: new Date().toISOString(),
        });

      return true;
    } catch (error) {
      console.error('Error handling authorization code:', error);
      return false;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      console.log('[Spotify] Refreshing access token...');
      
      if (!this.refreshToken) {
        console.error('[Spotify] No refresh token available for refresh');
        throw new Error('No refresh token available');
      }

      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:`)}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }).toString(),
      });

      console.log('[Spotify] Token refresh response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Spotify] Token refresh failed:', response.status, errorText);
        throw new Error(`Failed to refresh token: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Spotify] Token refreshed successfully, expires in:', data.expires_in, 'seconds');
      this.accessToken = data.access_token;
      this.expiresAt = Date.now() + data.expires_in * 1000;

      return true;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return false;
    }
  }

  private async ensureValidToken(): Promise<boolean> {
    if (!this.accessToken) {
      console.error('[Spotify] No access token available');
      return false;
    }

    const timeUntilExpiry = this.expiresAt - Date.now();

    if (Date.now() >= this.expiresAt) {
      console.log('[Spotify] Token expired, refreshing...');
      return await this.refreshAccessToken();
    }

    return true;
  }

  async getCurrentlyPlaying(): Promise<SpotifyPlaybackState | null> {
    if (!(await this.ensureValidToken())) return null;

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (response.status === 204 || !response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching currently playing:', error);
      return null;
    }
  }

  async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    if (!(await this.ensureValidToken())) {
      return null;
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      // 204 No Content means user doesn't have an active device
      if (response.status === 204) {
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Spotify] Playback state error: ${response.status}`, errorText);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[Spotify] Error fetching playback state:', error);
      return null;
    }
  }

  async play(deviceId?: string): Promise<boolean> {
    if (!(await this.ensureValidToken())) {
      console.error('[Spotify] Cannot play - token not valid');
      return false;
    }

    try {
      console.log('[Spotify] Sending play command...');
      const response = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: deviceId ? JSON.stringify({ device_ids: [deviceId] }) : undefined,
      });

      console.log('[Spotify] Play response:', response.status, response.statusText);
      if (!response.ok) {
        const error = await response.text();
        console.error('[Spotify] Play failed:', error);
      }
      return response.ok;
    } catch (error) {
      console.error('[Spotify] Error playing:', error);
      return false;
    }
  }

  async pause(deviceId?: string): Promise<boolean> {
    if (!(await this.ensureValidToken())) {
      console.error('[Spotify] Cannot pause - token not valid');
      return false;
    }

    try {
      console.log('[Spotify] Sending pause command...');
      const response = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: deviceId ? JSON.stringify({ device_ids: [deviceId] }) : undefined,
      });

      console.log('[Spotify] Pause response:', response.status, response.statusText);
      if (!response.ok) {
        const error = await response.text();
        console.error('[Spotify] Pause failed:', error);
      }
      return response.ok;
    } catch (error) {
      console.error('[Spotify] Error pausing:', error);
      return false;
    }
  }

  async nextTrack(deviceId?: string): Promise<boolean> {
    if (!(await this.ensureValidToken())) {
      console.error('[Spotify] Cannot skip next - token not valid');
      return false;
    }

    try {
      console.log('[Spotify] Sending skip next command...');
      const response = await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: deviceId ? JSON.stringify({ device_ids: [deviceId] }) : undefined,
      });

      console.log('[Spotify] Skip next response:', response.status, response.statusText);
      if (!response.ok) {
        const error = await response.text();
        console.error('[Spotify] Skip next failed:', error);
      }
      return response.ok;
    } catch (error) {
      console.error('[Spotify] Error skipping to next:', error);
      return false;
    }
  }

  async previousTrack(deviceId?: string): Promise<boolean> {
    if (!(await this.ensureValidToken())) {
      console.error('[Spotify] Cannot skip previous - token not valid');
      return false;
    }

    try {
      console.log('[Spotify] Sending skip previous command...');
      const response = await fetch('https://api.spotify.com/v1/me/player/previous', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: deviceId ? JSON.stringify({ device_ids: [deviceId] }) : undefined,
      });

      console.log('[Spotify] Skip previous response:', response.status, response.statusText);
      if (!response.ok) {
        const error = await response.text();
        console.error('[Spotify] Skip previous failed:', error);
      }
      return response.ok;
    } catch (error) {
      console.error('[Spotify] Error skipping to previous:', error);
      return false;
    }
  }

  async seek(positionMs: number, deviceId?: string): Promise<boolean> {
    if (!(await this.ensureValidToken())) return false;

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: deviceId ? JSON.stringify({ device_ids: [deviceId] }) : undefined,
      });

      return response.ok;
    } catch (error) {
      console.error('Error seeking:', error);
      return false;
    }
  }

  async getAvailableDevices(): Promise<any[]> {
    if (!(await this.ensureValidToken())) return [];

    try {
      const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.devices || [];
    } catch (error) {
      console.error('Error fetching devices:', error);
      return [];
    }
  }

  async getUserProfile(): Promise<SpotifyUser | null> {
    if (!(await this.ensureValidToken())) return null;

    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  isConnected(): boolean {
    return !!this.accessToken;
  }

  async disconnect(userId: string): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;

    try {
      await SecureStore.deleteItemAsync(`spotify_tokens_${userId}`);
      await supabase
        .from('user_spotify_tokens')
        .delete()
        .eq('user_id', userId);
    } catch (error) {
      console.error('Error disconnecting Spotify:', error);
    }
  }
}

export const spotifyService = new SpotifyService();

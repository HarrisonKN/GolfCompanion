import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { spotifyService, SpotifyPlaybackState, SpotifyUser } from '@/lib/spotify';
import { useAuth } from './AuthContext';

WebBrowser.maybeCompleteAuthSession();

interface SpotifyContextType {
  isConnected: boolean;
  isPlaying: boolean;
  currentTrack: SpotifyPlaybackState | null;
  currentUser: SpotifyUser | null;
  isLoading: boolean;
  error: string | null;
  connectSpotify: () => Promise<void>;
  disconnectSpotify: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  refreshPlaybackState: () => Promise<void>;
}

const SpotifyContext = createContext<SpotifyContextType | undefined>(undefined);

export function SpotifyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyPlaybackState | null>(null);
  const [currentUser, setCurrentUser] = useState<SpotifyUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  // Initialize Spotify service
  useEffect(() => {
    if (user?.id) {
      console.log('[SpotifyContext] Initializing Spotify service for user:', user.id);
      spotifyService.initialize(user.id).then(() => {
        const connected = spotifyService.isConnected();
        console.log('[SpotifyContext] Spotify initialized, isConnected:', connected);
        setIsConnected(connected);
      });
    }
  }, [user?.id]);

  // Polling for playback state updates
  useEffect(() => {
    if (!isConnected) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      return;
    }

    // Refresh immediately
    refreshPlaybackState();

    // Set up polling every 1 second
    pollingIntervalRef.current = setInterval(() => {
      refreshPlaybackState();
    }, 1000) as unknown as NodeJS.Timeout;

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isConnected]);

  const refreshPlaybackState = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    try {
      const state = await spotifyService.getPlaybackState();
      if (state) {
        // Only log if track changed (not on every poll)
        const currentTrackId = state?.item?.id;
        if (currentTrackId !== lastTrackIdRef.current) {
          console.log('[SpotifyContext] Track changed:', state?.item?.name || 'No track');
          lastTrackIdRef.current = currentTrackId || null;
        }
        setCurrentTrack(state);
        setIsPlaying(state.is_playing);
        setError(null);
      } else {
        // Only log if we had a track before (state cleared)
        if (lastTrackIdRef.current !== null) {
          console.log('[SpotifyContext] Playback cleared - no active playback');
          lastTrackIdRef.current = null;
        }
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('[SpotifyContext] Error refreshing playback state:', err);
      setError('Failed to fetch playback state');
    }
  }, [isConnected]);

  const connectSpotify = useCallback(async () => {
    if (!user?.id) {
      console.error('[SpotifyContext] Cannot connect - user not authenticated');
      setError('User not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log('[SpotifyContext] Starting Spotify connection...');

      const authUrl = await spotifyService.getAuthorizationUrl();
      console.log('[SpotifyContext] Opening auth session with redirect URI: golfcompanion://golfHub');
      
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl, 
        'golfcompanion://golfHub'
      );

      console.log('[SpotifyContext] Auth result type:', result.type);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        console.log('[SpotifyContext] Authorization code received:', code ? 'yes' : 'no');

        if (code) {
          console.log('[SpotifyContext] Exchanging code for tokens...');
          const success = await spotifyService.handleAuthorizationCode(code, user.id);
          if (success) {
            console.log('[SpotifyContext] Token exchange successful, setting isConnected = true');
            setIsConnected(true);

            // Fetch user profile
            console.log('[SpotifyContext] Fetching user profile...');
            const profile = await spotifyService.getUserProfile();
            if (profile) {
              console.log('[SpotifyContext] User profile:', profile.display_name);
              setCurrentUser(profile);
            }

            // Start polling
            console.log('[SpotifyContext] Starting playback state polling...');
            await refreshPlaybackState();
          } else {
            console.error('[SpotifyContext] Token exchange failed');
            setError('Failed to authorize with Spotify');
          }
        } else {
          console.error('[SpotifyContext] No authorization code in redirect URL');
          setError('No authorization code received');
        }
      } else if (result.type === 'cancel') {
        console.log('[SpotifyContext] User cancelled Spotify authorization');
        setError('Authorization cancelled');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed';
      console.error('[SpotifyContext] Spotify connection error:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshPlaybackState]);

  const disconnectSpotify = useCallback(async () => {
    if (!user?.id) return;

    try {
      console.log('[SpotifyContext] Disconnecting from Spotify...');
      await spotifyService.disconnect(user.id);
      console.log('[SpotifyContext] Successfully disconnected from Spotify');
      setIsConnected(false);
      setCurrentTrack(null);
      setCurrentUser(null);
      setIsPlaying(false);

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Disconnection failed';
      console.error('[SpotifyContext] Error disconnecting:', errorMsg);
      setError(errorMsg);
    }
  }, [user?.id]);

  const play = useCallback(async () => {
    try {
      console.log('[SpotifyContext] Play button pressed');
      const success = await spotifyService.play();
      if (success) {
        console.log('[SpotifyContext] Play successful');
        setIsPlaying(true);
        await refreshPlaybackState();
      } else {
        console.error('[SpotifyContext] Play command returned false');
        setError('Failed to play');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Play failed';
      console.error('[SpotifyContext] Play error:', errorMsg);
      setError(errorMsg);
    }
  }, [refreshPlaybackState]);

  const pause = useCallback(async () => {
    try {
      console.log('[SpotifyContext] Pause button pressed');
      const success = await spotifyService.pause();
      if (success) {
        console.log('[SpotifyContext] Pause successful');
        setIsPlaying(false);
        await refreshPlaybackState();
      } else {
        console.error('[SpotifyContext] Pause command returned false');
        setError('Failed to pause');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Pause failed';
      console.error('[SpotifyContext] Pause error:', errorMsg);
      setError(errorMsg);
    }
  }, [refreshPlaybackState]);

  const nextTrack = useCallback(async () => {
    try {
      console.log('[SpotifyContext] Skip next button pressed');
      const success = await spotifyService.nextTrack();
      if (success) {
        console.log('[SpotifyContext] Skip next successful');
        await refreshPlaybackState();
      } else {
        console.error('[SpotifyContext] Skip next command returned false');
        setError('Failed to skip');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Skip failed';
      console.error('[SpotifyContext] Skip next error:', errorMsg);
      setError(errorMsg);
    }
  }, [refreshPlaybackState]);

  const previousTrack = useCallback(async () => {
    try {
      console.log('[SpotifyContext] Skip previous button pressed');
      const success = await spotifyService.previousTrack();
      if (success) {
        console.log('[SpotifyContext] Skip previous successful');
        await refreshPlaybackState();
      } else {
        console.error('[SpotifyContext] Skip previous command returned false');
        setError('Failed to go to previous');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Previous track failed';
      console.error('[SpotifyContext] Skip previous error:', errorMsg);
      setError(errorMsg);
    }
  }, [refreshPlaybackState]);

  return (
    <SpotifyContext.Provider
      value={{
        isConnected,
        isPlaying,
        currentTrack,
        currentUser,
        isLoading,
        error,
        connectSpotify,
        disconnectSpotify,
        play,
        pause,
        nextTrack,
        previousTrack,
        refreshPlaybackState,
      }}
    >
      {children}
    </SpotifyContext.Provider>
  );
}

export function useSpotify() {
  const context = useContext(SpotifyContext);
  if (!context) {
    throw new Error('useSpotify must be used within a SpotifyProvider');
  }
  return context;
}

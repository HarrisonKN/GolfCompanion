/**
 * VoiceContext.tsx
 *
 * Purpose
 * - Centralized, app-wide context for real-time voice chat using Agora and Supabase.
 * - Exposes UI-friendly state and actions (join/leave/mute/toggle device route) to components
 *   like GlobalVoiceBar and hubRoom.
 *
 * Key Responsibilities
 * - Initialize and manage a singleton Agora engine.
 * - Track current room, join/leave state, mute state, audio route, local Agora UID, and active speakers.
 * - Maintain a live presence list (voiceMembers) in Supabase voice_channel_presence so users see each other.
 * - Subscribe to Supabase Realtime (postgres_changes) to keep presence in sync across devices.
 * - Persist mute/audio route and heartbeat last_seen to keep presence.
 *
 * Data Model
 * - Table: public.voice_channel_presence
 *   Columns: group_id (uuid), user_id (uuid), session_id (text), agora_uid (int),
 *            joined_at (timestamptz), last_seen (timestamptz),
 *            is_muted (bool), audio_route (text)
 *   Uniqueness (current schema): (group_id, user_id) — one row per user per group (single-device presence).
 *   If multi-device presence is needed, change uniqueness to (group_id, user_id, session_id) and
 *   update upsert onConflict accordingly.
 *
 * Auth and RLS
 * - RLS requires a user to be the group creator or a member in voice_group_members to select presence rows.
 * - Insert/update/delete allowed only for the authenticated user’s own row.
 *
 * Realtime Flow
 * - On joinVoiceChannel:
 *   1) Generate a 31-bit Agora UID (fits Postgres integer).
 *   2) Upsert presence row with is_muted, audio_route, last_seen.
 *   3) Join Agora channel.
 *   4) Fetch presence list.
 * - On toggleMute: update is_muted in presence.
 * - Heartbeat: periodic upsert to bump last_seen and sync local mute/device route.
 * - Realtime subscription listens on voice_channel_presence for current group_id and refetches.
 *
 * Agora Events -> UI State
 * - onJoinChannelSuccess: sets joined, stores local UID, triggers fetch.
 * - onUserJoined/onUserOffline: triggers fetch and updates speaking set.
 * - onAudioVolumeIndication/onActiveSpeaker: highlights active speakers.
 * - onLeaveChannel: clears state and deletes presence row for this session.
 *
 * Lifecycle
 * - Cleans up Agora engine on unmount.
 * - Auto-leaves channel after a timeout when app goes to background.
 *
 * Known Pitfalls
 * - If users don’t see each other, check: RLS policies, group membership, realtime publication, and
 *   integer overflow on agora_uid (we clamp to 31-bit).
 * - If presence appears “stale,” confirm heartbeat runs and Realtime is enabled on the table.
 */

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, AppState } from 'react-native';
import { IRtcEngine, createAgoraRtcEngine } from 'react-native-agora';
import { AGORA_APP_ID } from '@/constants/agora';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';

// ---- Utility: light SFX for join/leave feedback ----
const playSound = async (soundFile: any) => {
  try {
    const { sound } = await Audio.Sound.createAsync(soundFile);
    await sound.playAsync();
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

// ---- Context types exposed to the app ----
interface VoiceContextType {
  isJoined: boolean;
  isMuted: boolean;
  audioRoute: 'speaker' | 'earpiece';
  currentRoomId: string | null;
  currentRoomName: string | null;
  voiceMembers: any[];
  speakingUsers: Set<number>;
  activeSpeakerUid: number | null;
  joinVoiceChannel: (roomId: string, roomName: string) => Promise<void>;
  leaveVoiceChannel: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleAudioRoute: () => void;
  fetchVoiceMembers: () => Promise<void>;
  navigateToCurrentRoom: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();

  // ===== Section: Core engine refs and UI state =====
  const engineRef = useRef<IRtcEngine | null>(null);
  const sessionIdRef = useRef<string>('');
  const [localAgoraUid, setLocalAgoraUid] = useState<number | null>(null);

  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioRoute, setAudioRoute] = useState<'speaker' | 'earpiece'>('speaker');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState<string | null>(null);
  const [voiceMembers, setVoiceMembers] = useState<any[]>([]);
  const [speakingUsers, setSpeakingUsers] = useState<Set<number>>(new Set());
  const [activeSpeakerUid, setActiveSpeakerUid] = useState<number | null>(null);

  // Navigate helper for UI elements outside the hub room
  const navigateToCurrentRoom = () => {
    if (currentRoomId && currentRoomName) {
      router.push({
        pathname: '/hubRoom',
        params: { roomId: currentRoomId, roomName: currentRoomName }
      });
    }
  };

  // Generate a session ID for this app run (used to disambiguate sessions if needed)
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }, []);

  // ===== Section: Agora initialization and event wiring =====
  useEffect(() => {
    const initAgora = async () => {
      // Request microphone permission on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'We need access to your microphone for voice chat.',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Microphone permission denied');
          return;
        }
      }

      try {
        const engine = createAgoraRtcEngine();
        engine.initialize({
          appId: AGORA_APP_ID,
          channelProfile: 0, // Communication
        });
        engine.enableAudio();
        engine.setAudioProfile(0, 0); // default profile
        engine.enableAudioVolumeIndication(250, 3, true);
        engine.setEnableSpeakerphone(true);

        // ---- Agora event handlers -> keep UI + presence in sync ----
        engine.registerEventHandler({
          onJoinChannelSuccess: async (_connection, uid) => {
            console.log('Global: Joined voice channel');
            setIsJoined(true);
            playSound(require('@/assets/audio/join.mp3'));
            setLocalAgoraUid(uid);
            fetchVoiceMembers();

            // Ensure local user exists in in-memory voiceMembers quickly for UI responsiveness
            if (user?.id) {
              setVoiceMembers(prev => {
                const exists = prev.some(m => m.user_id === user.id);
                const selfProfile = {
                  id: user.id,
                  full_name: (user as any)?.user_metadata?.full_name ?? 'You',
                  email: (user as any)?.email ?? '',
                };
                if (exists) {
                  return prev.map(m => m.user_id === user.id ? { ...m, agora_uid: uid, profiles: m.profiles ?? selfProfile } : m);
                }
                return [...prev, { user_id: user.id, agora_uid: uid, profiles: selfProfile }];
              });
            }

            fetchVoiceMembers();
          },

          onUserJoined: (_connection, remoteUid) => {
            console.log(`Global: User ${remoteUid} joined voice`);
            // Presence is authoritative from Supabase; we still prompt a refresh for snappy UI
            fetchVoiceMembers();
          },

          onUserOffline: (_connection, remoteUid) => {
            console.log(`Global: User ${remoteUid} left voice`);
            // Update speaking indicator set
            setSpeakingUsers(prev => {
              const next = new Set(prev);
              next.delete(remoteUid);
              return next;
            });
            // Remove local entry; subscription/fetch will correct if needed
            setVoiceMembers(prev => prev.filter(m => m.agora_uid !== remoteUid));
            fetchVoiceMembers();
          },

          onActiveSpeaker: (_connection, uid) => {
            setActiveSpeakerUid(uid);
            setSpeakingUsers(prev => new Set(prev).add(uid));
            // Remove “speaking” badge after 1s if no subsequent activity
            setTimeout(() => {
              setSpeakingUsers(prev => {
                const next = new Set(prev);
                next.delete(uid);
                return next;
              });
            }, 1000);
          },

          onAudioVolumeIndication: (_connection, speakers) => {
            const currentSpeakers = new Set<number>();
            speakers.forEach(speaker => {
              if (speaker.volume !== undefined && speaker.volume > 3 && speaker.uid !== undefined) {
                currentSpeakers.add(speaker.uid);
              }
            });
            setSpeakingUsers(currentSpeakers);
          },

          onError: (err, msg) => {
            console.error('Global Agora error:', err, msg);
          },

          onLeaveChannel: async () => {
            console.log('Global: onLeaveChannel triggered');
            setIsJoined(false);
            setSpeakingUsers(new Set());
            setActiveSpeakerUid(null);

            // Defensive cleanup: delete presence row
            if (currentRoomId && user?.id) {
              await supabase.from('voice_channel_presence')
                .delete()
                .eq('group_id', currentRoomId)
                .eq('user_id', user.id)
                .eq('session_id', sessionIdRef.current);
            }
          },
        });

        engineRef.current = engine;
        console.log('Global Agora initialization complete');
      } catch (error) {
        console.error('Global Agora init error:', error);
      }
    };

    initAgora();

    // Cleanup engine on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.leaveChannel();
        engineRef.current.release();
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
  }, [user?.id]);

  // ===== Section: Presence fetch (Supabase) =====
  // Fetch presence list for the current room.
  // Uses a short recency cutoff to ignore stale rows; falls back to a full list if empty.
  const fetchVoiceMembers = useCallback(async () => {
    if (!currentRoomId) return;

    try {
      const cutoff = new Date(Date.now() - 120000).toISOString(); // 120s
      let query = supabase
        .from('voice_channel_presence')
        .select('user_id, agora_uid, session_id, last_seen, is_muted, audio_route')
        .eq('group_id', currentRoomId)
        .gt('last_seen', cutoff)
        .order('last_seen', { ascending: false });

      let { data: rows, error } = await query;
      if (error) {
        console.error('Error fetching voice members:', error);
        return;
      }

      // Fallback without cutoff to diagnose clock skew and avoid empty lists
      if (!rows || rows.length === 0) {
        const fallback = await supabase
          .from('voice_channel_presence')
          .select('user_id, agora_uid, session_id, last_seen, is_muted, audio_route')
          .eq('group_id', currentRoomId)
          .order('last_seen', { ascending: false })
          .limit(50);
        if (fallback.error) {
          console.error('Error fetching voice members (fallback):', fallback.error);
          return;
        }
        rows = fallback.data ?? [];
      }

      if (!rows || rows.length === 0) {
        setVoiceMembers([]);
        return;
      }

      // Hydrate profiles for display names
      const userIds = Array.from(new Set(rows.map((m: any) => m.user_id)));
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (pErr) {
        console.error('Error fetching member profiles:', pErr);
      }

      setVoiceMembers(
        rows.map((m: any) => ({
          user_id: m.user_id,
          agora_uid: m.agora_uid,
          session_id: m.session_id,
          is_muted: !!m.is_muted,
          audio_route: m.audio_route ?? 'speaker',
          profiles: profiles?.find((p: any) => p.id === m.user_id) || null,
        }))
      );
    } catch (e) {
      console.error('Error in fetchVoiceMembers:', e);
    }
  }, [currentRoomId]);

  // ===== Section: Realtime subscription (Supabase) =====
  // Keep presence in sync for the current room via postgres_changes.
  useEffect(() => {
    if (!currentRoomId) return;

    fetchVoiceMembers();

    const channel = supabase
      .channel(`voice_presence:${currentRoomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_channel_presence', filter: `group_id=eq.${currentRoomId}` },
        // NOTE: Consider debouncing if you see rapid-fire updates.
        () => fetchVoiceMembers()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentRoomId, fetchVoiceMembers]);

  // ===== Section: Join channel (presence upsert -> Agora join) =====
  const joinVoiceChannel = async (roomId: string, roomName: string) => {
    if (!engineRef.current) return;
    if (isJoined && currentRoomId === roomId) return;

    // Switch rooms by leaving first
    if (isJoined && currentRoomId && currentRoomId !== roomId) {
      await leaveVoiceChannel();
    }

    // Deterministic 31-bit UID derived from user id (fits Postgres int)
    const rawUid =
      user?.id
        ? parseInt(user.id.replace(/-/g, '').substring(0, 8), 16)
        : Math.floor(Math.random() * 100000);
    const uid = (rawUid & 0x7fffffff) >>> 0;

    setCurrentRoomId(roomId);
    setCurrentRoomName(roomName);
    setIsJoined(true);

    // Optimistic self insert to local list for instant UI
    if (user?.id) {
      const selfProfile = {
        id: user.id,
        full_name: (user as any)?.user_metadata?.full_name ?? 'You',
        email: (user as any)?.email ?? '',
      };
      setVoiceMembers(prev => {
        const exists = prev.some(m => m.user_id === user.id);
        if (exists) {
          return prev.map(m =>
            m.user_id === user.id
              ? { ...m, agora_uid: uid, profiles: m.profiles ?? selfProfile, is_muted: isMuted }
              : m
          );
        }
        return [...prev, { user_id: user.id, agora_uid: uid, profiles: selfProfile, is_muted: isMuted }];
      });
    }

    try {
      // Upsert presence (DB uniqueness on group_id,user_id)
      if (user?.id) {
        const { error: upsertErr } = await supabase.from('voice_channel_presence').upsert({
          group_id: roomId,
          user_id: user.id,
          session_id: sessionIdRef.current,
          agora_uid: uid,
          joined_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          is_muted: isMuted,
          audio_route: audioRoute,
        }, { onConflict: 'group_id,user_id' });
        if (upsertErr) {
          console.error('presence upsert (join) failed:', upsertErr);
        }
      }

      // Initial fetch, then join Agora
      fetchVoiceMembers();
      await engineRef.current.joinChannel('', roomId, uid, {});
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      setIsJoined(false);
      setCurrentRoomId(null);
      setCurrentRoomName(null);
      setVoiceMembers(prev => prev.filter(m => m.user_id !== user?.id));
    }
  };

  // ===== Section: Leave channel (presence delete -> Agora leave) =====
  const leaveVoiceChannel = async () => {
    if (!engineRef.current) return;

    try {
      setIsJoined(false);
      setSpeakingUsers(new Set());
      setActiveSpeakerUid(null);

      if (currentRoomId && user?.id) {
        const { error: delErr } = await supabase
          .from('voice_channel_presence')
          .delete()
          .eq('group_id', currentRoomId)
          .eq('user_id', user.id)
          .eq('session_id', sessionIdRef.current);
        if (delErr) {
          console.error('presence delete failed:', delErr);
        }
      }

      await engineRef.current.leaveChannel();

      setCurrentRoomId(null);
      setCurrentRoomName(null);
      setVoiceMembers([]);
    } catch (error) {
      console.error('Error leaving voice channel:', error);
    }
  };

  // ===== Section: Mute/unmute (persist to presence) =====
  const toggleMute = async () => {
    if (!engineRef.current) return;

    const newMuted = !isMuted;
    try {
      engineRef.current.muteLocalAudioStream(newMuted);
      setIsMuted(newMuted);

      if (currentRoomId && user?.id) {
        const { error: upsertErr } = await supabase.from('voice_channel_presence').upsert({
          group_id: currentRoomId,
          user_id: user.id,
          session_id: sessionIdRef.current,
          agora_uid: localAgoraUid ?? undefined,
          last_seen: new Date().toISOString(),
          is_muted: newMuted,
          audio_route: audioRoute,
        }, { onConflict: 'group_id,user_id' });
        if (upsertErr) {
          console.error('presence upsert (mute) failed:', upsertErr);
        }
      }
    } catch (err) {
      console.error('toggleMute error', err);
    }
  };

  // ===== Section: Audio route toggle (speaker <-> earpiece) =====
  const toggleAudioRoute = () => {
    if (!engineRef.current) return;

    const newRoute = audioRoute === 'speaker' ? 'earpiece' : 'speaker';
    engineRef.current.setEnableSpeakerphone(newRoute === 'speaker');
    setAudioRoute(newRoute);
  };

  // ===== Section: Heartbeat (keep last_seen fresh, sync mute/device route) =====
  useEffect(() => {
    if (!isJoined || !currentRoomId || !user?.id || !localAgoraUid) return;

    const interval = setInterval(async () => {
      try {
        const { error: upsertErr } = await supabase.from('voice_channel_presence').upsert({
          group_id: currentRoomId,
          user_id: user.id,
          session_id: sessionIdRef.current,
          agora_uid: localAgoraUid,
          last_seen: new Date().toISOString(),
          is_muted: isMuted,
          audio_route: audioRoute,
        }, { onConflict: 'group_id,user_id' });
        if (upsertErr) {
          console.error('presence upsert (heartbeat) failed:', upsertErr);
        }
      } catch (e) {
        console.error('VoiceContext heartbeat failed', e);
      }
    }, 10000); // 10s

    return () => clearInterval(interval);
  }, [isJoined, currentRoomId, user?.id, localAgoraUid, isMuted, audioRoute]);

  // ===== Section: AppState handling (auto leave after background timeout) =====
  useEffect(() => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const BACKGROUND_TIMEOUT_MS = 60000;

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background') {
        if (isJoined) {
          timeoutHandle = setTimeout(() => {
            leaveVoiceChannel();
          }, BACKGROUND_TIMEOUT_MS);
        }
      } else if (nextAppState === 'active') {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        fetchVoiceMembers();
      }
    };

    const sub = AppState.addEventListener?.('change', handleAppStateChange);

    return () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      // @ts-ignore RN < 0.65 compat
      sub?.remove?.();
    };
  }, [isJoined, leaveVoiceChannel, fetchVoiceMembers, currentRoomId]);

  // ===== Section: Context value =====
  return (
    <VoiceContext.Provider value={{
      isJoined,
      isMuted,
      audioRoute,
      currentRoomId,
      currentRoomName,
      voiceMembers,
      speakingUsers,
      activeSpeakerUid,
      joinVoiceChannel,
      leaveVoiceChannel,
      toggleMute,
      toggleAudioRoute,
      fetchVoiceMembers,
      navigateToCurrentRoom,
    }}>
      {children}
    </VoiceContext.Provider>
  );
};

// ===== Hook: consume the context =====
export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
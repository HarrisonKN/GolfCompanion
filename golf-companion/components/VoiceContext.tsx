//VOICE CONTEXT
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid, AppState } from 'react-native';
import { IRtcEngine, createAgoraRtcEngine } from 'react-native-agora';
import { AGORA_APP_ID } from '@/constants/agora';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';

const playSound = async (soundFile: any) => {
  try {
    const { sound } = await Audio.Sound.createAsync(soundFile);
    await sound.playAsync();
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

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

  const navigateToCurrentRoom = () => {
    if (currentRoomId && currentRoomName) {
      router.push({
        pathname: '/hubRoom',
        params: { roomId: currentRoomId, roomName: currentRoomName }
      });
    }
  };

  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }, []);

  useEffect(() => {
    const initAgora = async () => {
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
          channelProfile: 0,
        });
        engine.enableAudio();
        engine.setAudioProfile(0, 0);
        engine.enableAudioVolumeIndication(250, 3, true);
        engine.setEnableSpeakerphone(true);

        engine.registerEventHandler({
          onJoinChannelSuccess: async (connection, uid) => {
            console.log('Global: Joined voice channel');
            setIsJoined(true);
            playSound(require('@/assets/audio/join.mp3'));
            setLocalAgoraUid(uid);
            fetchVoiceMembers();

            if (user?.id) {
              setVoiceMembers(prev => {
                const exists = prev.some(m => m.user_id === user.id);
                const selfProfile = { id: user.id, full_name: (user as any)?.user_metadata?.full_name ?? 'You', email: (user as any)?.email ?? '', };
                if (exists) {
                  return prev.map(m => m.user_id === user.id ? { ...m, agora_uid: uid, profiles: m.profiles ?? selfProfile } : m);
                }
                return [...prev, { user_id: user.id, agora_uid: uid, profiles: selfProfile }];
              });
            }

            fetchVoiceMembers();
          },
          onUserJoined: (connection, remoteUid) => {
            console.log(`Global: User ${remoteUid} joined voice`);
            fetchVoiceMembers();
          },
          onUserOffline: (connection, remoteUid) => {
            console.log(`Global: User ${remoteUid} left voice`);
            setSpeakingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(remoteUid);
              return newSet;
            });
            setVoiceMembers(prev => prev.filter(m => m.agora_uid !== remoteUid));
            fetchVoiceMembers();
          },
          onActiveSpeaker: (connection, uid) => {
            setActiveSpeakerUid(uid);
            setSpeakingUsers(prev => new Set(prev).add(uid));
            setTimeout(() => {
              setSpeakingUsers(prev => {
                const newSet = new Set(prev);
                newSet.delete(uid);
                return newSet;
              });
            }, 1000);
          },
          onAudioVolumeIndication: (connection, speakers) => {
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
          onLeaveChannel: async (connection, stats) => {
            console.log('Global: onLeaveChannel triggered');
            setIsJoined(false);
            setSpeakingUsers(new Set());
            setActiveSpeakerUid(null);

            if (currentRoomId && user?.id) {
              await supabase.from('voice_channel_presence') // fixed table name
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

  // Fetch members (try with cutoff; if empty, retry without cutoff so you still see presence)
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

      // fallback: if nothing came back, retry without cutoff (helps diagnose last_seen skew)
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

  // Realtime: subscribe to voice_channel_presence for the current room
  useEffect(() => {
    if (!currentRoomId) return;

    fetchVoiceMembers();

    const channel = supabase
      .channel(`voice_presence:${currentRoomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_channel_presence', filter: `group_id=eq.${currentRoomId}` },
        () => fetchVoiceMembers()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentRoomId, fetchVoiceMembers]);

  // Join: upsert into voice_channel_presence, then join Agora
  const joinVoiceChannel = async (roomId: string, roomName: string) => {
    if (!engineRef.current) return;
    if (isJoined && currentRoomId === roomId) return;

    if (isJoined && currentRoomId && currentRoomId !== roomId) {
      await leaveVoiceChannel();
    }

    // Derive a deterministic UID from user.id and clamp to 31-bit signed int to fit DB integer
    const rawUid =
      user?.id
        ? parseInt(user.id.replace(/-/g, '').substring(0, 8), 16)
        : Math.floor(Math.random() * 100000);

    const uid = (rawUid & 0x7fffffff) >>> 0; // <= 2_147_483_647

    setCurrentRoomId(roomId);
    setCurrentRoomName(roomName);
    setIsJoined(true);

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

  // Leave: delete row and log errors
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

  // Mute: mute local audio + persist to voice_channel_presence
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
        }, { onConflict: 'group_id,user_id' }); // changed
        if (upsertErr) {
          console.error('presence upsert (mute) failed:', upsertErr);
        }
      }
    } catch (err) {
      console.error('toggleMute error', err);
    }
  };

  const toggleAudioRoute = () => {
    if (!engineRef.current) return;

    const newRoute = audioRoute === 'speaker' ? 'earpiece' : 'speaker';

    if (newRoute === 'speaker') {
      engineRef.current.setEnableSpeakerphone(true);
    } else {
      engineRef.current.setEnableSpeakerphone(false);
    }

    setAudioRoute(newRoute);
  };

  // Heartbeat: bump last_seen + keep is_muted/audio_route in sync
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
        }, { onConflict: 'group_id,user_id' }); // changed
        if (upsertErr) {
          console.error('presence upsert (heartbeat) failed:', upsertErr);
        }
      } catch (e) {
        console.error('VoiceContext heartbeat failed', e);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isJoined, currentRoomId, user?.id, localAgoraUid, isMuted, audioRoute]);

  useEffect(() => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null; // fix type
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

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
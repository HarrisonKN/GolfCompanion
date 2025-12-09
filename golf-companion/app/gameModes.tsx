// ------------------- NOTES AND UPDATES -----------------
{/* 
    NEW FILE,
    This file shows the players selected, and then allows the user to select a game mode, which shows a description of the gamemode.

    

*/}

import React, { useEffect, useState, useMemo } from 'react';
import { Stack } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, Pressable, Image, Dimensions, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/components/supabase';
import { PALETTES } from '@/constants/theme';
import { useTheme } from '@/components/ThemeContext';
import { sendNotificationToUser } from "@/lib/sendNotification";

const PLAYER_AVATAR_SIZE = 50; // was 72
const GRID_COLS = 4;

// Sizes for a 4-column circular grid
const SCREEN_W = Dimensions.get('window').width;
const GRID_OUTER_PADDING = 40; // page padding (20 left + 20 right)
const GRID_INNER_PADDING = 24; // grid container padding (12 left + 12 right)
const ITEM_SIZE = Math.floor((SCREEN_W - GRID_OUTER_PADDING - GRID_INNER_PADDING) / GRID_COLS);
const CIRCLE_SIZE = Math.max(56, ITEM_SIZE - 24);

const gameModesData = [
  { id: 'stroke', name: 'Stroke Play', icon: '⛳', description: 'The Regular Game of Golf, Total strokes over the round. Lowest wins.' },
  { id: 'match', name: 'Match Play', icon: '🤝', description: 'Win holes versus opponents. Most holes won wins.' },
  { id: 'stableford', name: 'Stableford', icon: '⭐', description: 'Points per hole based on score vs par.' },
  { id: 'bestball', name: 'BestBall',icon: '👥', description: 'Best score per hole among partners counts.' },
  { id: 'scramble', name: 'Scramble',icon: '🔁', description: 'Team hits, chooses best shot, repeat until holed.' },
  { id: 'altshot', name: 'Alternate',icon: '🔄', description: 'Players alternate shots with one ball.' },
  { id: 'wolf', name: 'Wolf',icon: '🐺', description: 'Rotating “Wolf” chooses partner or goes solo for a reduced score bonus.' },
];

export default function GameModesScreen() {
  const router = useRouter();
  const { courseId, tee, playerIds, playerNames, gameId, isJoiningExistingGame } = useLocalSearchParams();
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedMode, setSelectedMode] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  // Scramble teams state
  const [teams, setTeams] = useState([
    { id: 1, name: "Team 1", players: [] as string[] },
    { id: 2, name: "Team 2", players: [] as string[] },
  ]);
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [teamPickerPlayer, setTeamPickerPlayer] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const { palette } = useTheme();

  // 🆕 DETECT IF USER IS JOINING AN EXISTING GAME
  const joiningExistingGame = String(isJoiningExistingGame) === '1';

  const parsedIds: string[] = useMemo(() => {
    try { return playerIds ? JSON.parse(String(playerIds)) : []; } catch { return []; }
  }, [playerIds]);
  const parsedNames: string[] = useMemo(() => {
    try { return playerNames ? JSON.parse(String(playerNames)) : []; } catch { return []; }
  }, [playerNames]);

  useEffect(() => {
    const load = async () => {
      // 🆕 IF JOINING AN EXISTING GAME, FETCH PARTICIPANTS FROM DATABASE
      if (joiningExistingGame && gameId && !parsedIds.length) {
        console.log("🔄 Fetching game participants for game:", gameId);
        setLoadingPlayers(true);
        try {
          const { data: participants, error: partError } = await supabase
            .from('game_participants')
            .select('user_id')
            .eq('game_id', gameId);

          if (partError) {
            console.error("Failed to fetch participants:", partError);
            setLoadingPlayers(false);
            return;
          }

          if (!participants || participants.length === 0) {
            console.warn("No participants found for game:", gameId);
            setLoadingPlayers(false);
            return;
          }

          const participantIds = participants.map(p => p.user_id);
          console.log("✅ Found participants:", participantIds);

          // Fetch their profiles
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, handicap')
            .in('id', participantIds);

          if (!profileError && profiles) {
            const ordered = participantIds.map(id => {
              const found = profiles.find(p => p.id === id);
              return {
                id,
                name: found?.full_name || 'Unknown',
                avatar_url: found?.avatar_url || null,
                handicap: found?.handicap ?? null,
              };
            });
            setPlayers(ordered);
            setUnassigned(ordered.map(p => p.id));
            console.log("✅ Players loaded:", ordered.length);
          }
        } catch (err) {
          console.error("Error loading game participants:", err);
        } finally {
          setLoadingPlayers(false);
        }
        return;
      }

      // ORIGINAL FLOW: Load from parsed player IDs
      if (!parsedIds.length) return;
      setLoadingPlayers(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, handicap')
          .in('id', parsedIds);
        if (!error && data) {
          // Preserve order matching parsedIds
          const ordered = parsedIds.map(id => {
            const found = data.find(p => p.id === id);
            return {
              id,
              name: found?.full_name || (parsedNames[parsedIds.indexOf(id)] || 'Unknown'),
              avatar_url: found?.avatar_url || null,
              handicap: found?.handicap ?? null,
            };
          });
          setPlayers(ordered);
          setUnassigned(ordered.map(p => p.id));
        }
      } finally {
        setLoadingPlayers(false);
      }
    };
    load();
  }, [parsedIds, joiningExistingGame, gameId]);

  const handleStart = async () => {
    if (!courseId || !parsedIds.length || creating) return;
    setCreating(true);

    try {
      // 🆕 IF JOINING EXISTING GAME, USE THE PROVIDED GAME ID
      let gid = gameId ? String(gameId) : null;

      if (!gid) {
        const { data: newGid, error } = await supabase.rpc('start_game', {
          course: String(courseId),
          participant_ids: parsedIds,
        });
        if (error || !newGid) {
          console.warn('Game creation failed', error);
          setCreating(false);
          return;
        }
        gid = newGid;
      } else {
        console.log("✅ Joining existing game:", gid);
      }

      await AsyncStorage.setItem('currentGamePlayers', JSON.stringify({
        ids: parsedIds,
        course: courseId,
        gameId: gid,
        mode: selectedMode?.id || null,
      }));
      await AsyncStorage.setItem('scrambleTeams', JSON.stringify(teams));

      const { data: teamRows, error: teamErr } = await supabase
        .from("game_teams")
        .insert(
          teams.map((t, i) => ({
            game_id: gid,
            team_number: t.id,
            name: t.name || `Team ${t.id}`,
            players: t.players,
          }))
        )
        .select();

      if (!teamErr) {
        await AsyncStorage.setItem('scrambleTeamRows', JSON.stringify(teamRows));
      }

      // 🆕 IF JOINING, NOTIFY THE GAME HOST THAT YOU'VE JOINED
      if (joiningExistingGame && gid) {
        try {
          const currentUser = await supabase.auth.getUser();
          const currentUserProfile = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', currentUser.data.user?.id)
            .single();

          const userName = currentUserProfile.data?.full_name || 'A player';

          // Get the game creator (first participant or from game metadata)
          const { data: gameData } = await supabase
            .from('games')
            .select('created_by')
            .eq('id', gid)
            .single();

          if (gameData?.created_by) {
            await sendNotificationToUser(
              gameData.created_by,
              "✅ Player Joined!",
              `${userName} joined your game!`,
              {
                route: "gameModes",
                gameId: gid,
              }
            );
            console.log("✅ Join notification sent to game host");
          }
        } catch (notifErr) {
          console.warn("Failed to send join notification:", notifErr);
        }
      }

      router.push({
        pathname: '/(tabs)/scorecard',
        params: {
          courseId: String(courseId),
          gameId: gid,
          playerIds: JSON.stringify(parsedIds),
          playerNames: JSON.stringify(players.map(p => p.name)),
          playerAvatars: JSON.stringify(players.map(p => p.avatar_url || null)),
          gameMode: selectedMode?.id || '',
          tee: tee || '',
          newGame: joiningExistingGame ? '0' : '1',
          teams: JSON.stringify(teams),
        },
      });
    } catch (err) {
      console.error("Error starting game:", err);
      setCreating(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Game Modes",
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.primary,
          headerShadowVisible: false,
        }}
      />
      <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        <Text style={styles(palette).screenTitle}>Players</Text>
        <View style={styles(palette).playersContainer}>
          {loadingPlayers ? (
            <Text style={{ color: '#6b7280', textAlign: 'center', padding: 16 }}>Loading players…</Text>
          ) : players.length === 0 ? (
            <Text style={{ color: '#6b7280', textAlign: 'center', padding: 16 }}>No players found.</Text>
          ) : (
            <View style={styles(palette).playerRowSingle}>
              {players.slice(0, 4).map(p => (
                <View key={p.id} style={styles(palette).playerCardSmall}>
                  <View style={styles(palette).avatarSmall}>
                    {p.avatar_url ? (
                      <Image source={{ uri: p.avatar_url }} style={{ width: PLAYER_AVATAR_SIZE, height: PLAYER_AVATAR_SIZE, borderRadius: PLAYER_AVATAR_SIZE / 2 }} />
                    ) : (
                      <Text style={styles(palette).avatarInitial}>{(p.name?.[0] || '?').toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={styles(palette).playerName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles(palette).playerHandicap}>
                    {p.handicap !== null && p.handicap !== undefined ? `HCP ${p.handicap}` : 'HCP —'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles(palette).sectionTitle}>Game Modes</Text>
        
        <View style={styles(palette).grid}>
            {gameModesData.map((mode, idx) => {
                // Get icon and name from mode object
                const icon = mode.icon;      // e.g. '⛳'
                const name = mode.name;      // e.g. 'Stroke Play'
                const isActive = selectedMode?.id === mode.id;

                return (
                <Pressable
                    key={mode.id}
                    onPress={() => setSelectedMode(mode)}
                    style={styles(palette).gridItem}
                >
                    {/* Icon inside a styled circle */}
                    <View style={[styles(palette).gridCircle, isActive && styles(palette).gridCircleActive]}>
                        <Text style={styles(palette).gridIcon}>{icon}</Text>
                        <Text
                            style={[styles(palette).gridLabel, isActive && { color: '#2563eb' }]} numberOfLines={1}>{name}
                        </Text>
                    </View>
                    {/* Game mode name below the icon */}
                    
                </Pressable>
                );
            })}
        </View>

        {selectedMode && (
          <View style={styles(palette).modeDetail}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles(palette).detailIcon}>{selectedMode.icon}</Text>
              <Text style={styles(palette).detailTitle}>{selectedMode.name}</Text>
            </View>
            <Text style={styles(palette).detailDesc}>{selectedMode.description}</Text>
            <TouchableOpacity
              onPress={() => setSelectedMode(null)}
              style={styles(palette).clearModeBtn}
              activeOpacity={0.8}
            >
              <Text style={styles(palette).clearModeText}>Clear Selection</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedMode?.id === 'scramble' && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles(palette).sectionTitle}>Scramble Teams</Text>

            {/* Unassigned pool */}
            <Text style={{ color: palette.textLight, marginBottom: 8 }}>Unassigned Players</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {unassigned.map(pid => {
                const p = players.find(x => x.id === pid);
                if (!p) return null;
                return (
                  <Pressable
                    key={pid}
                    onPress={() => setTeamPickerPlayer(pid)}
                    style={{ marginRight: 10, alignItems: 'center' }}
                  >
                    <View style={styles(palette).avatarSmall}>
                      {p.avatar_url ? (
                        <Image source={{ uri: p.avatar_url }} style={{ width: PLAYER_AVATAR_SIZE, height: PLAYER_AVATAR_SIZE, borderRadius: PLAYER_AVATAR_SIZE / 2 }} />
                      ) : (
                        <Text style={styles(palette).avatarInitial}>{(p.name?.[0] || '?').toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={{ color: palette.textLight, fontSize: 12 }}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Teams */}
            {teams.map(team => (
              <View key={team.id} style={{ marginBottom: 20 }}>
                {editingTeamId === team.id ? (
                  <View style={{ marginBottom: 6 }}>
                    <TextInput
                      value={editingName}
                      onChangeText={setEditingName}
                      style={{ borderWidth: 1, borderColor: palette.primary, padding: 6, borderRadius: 8, color: palette.textLight }}
                      autoFocus
                      onSubmitEditing={() => {
                        setTeams(prev =>
                          prev.map(t => t.id === team.id ? { ...t, name: editingName || t.name } : t)
                        );
                        setEditingTeamId(null);
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        setTeams(prev =>
                          prev.map(t => t.id === team.id ? { ...t, name: editingName || t.name } : t)
                        );
                        setEditingTeamId(null);
                      }}
                      style={{ marginTop: 4 }}
                    >
                      <Text style={{ color: palette.primary }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setEditingTeamId(team.id);
                      setEditingName(team.name);
                    }}
                  >
                    <Text style={{ color: palette.primary, marginBottom: 6, fontWeight: '700' }}>
                      {team.name}
                    </Text>
                  </Pressable>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {team.players.map(pid => {
                    const p = players.find(x => x.id === pid);
                    if (!p) return null;
                    return (
                      <Pressable
                        key={pid}
                        onPress={() => setTeamPickerPlayer(pid)}
                        style={{ marginRight: 10, alignItems: 'center' }}
                      >
                        <View style={styles(palette).avatarSmall}>
                          {p.avatar_url ? (
                            <Image source={{ uri: p.avatar_url }} style={{ width: PLAYER_AVATAR_SIZE, height: PLAYER_AVATAR_SIZE, borderRadius: PLAYER_AVATAR_SIZE / 2 }} />
                          ) : (
                            <Text style={styles(palette).avatarInitial}>{(p.name?.[0] || '?').toUpperCase()}</Text>
                          )}
                        </View>
                        <Text style={{ color: palette.textLight, fontSize: 12 }}>{p.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* Add Team Button */}
            {teams.length < 4 && (
              <TouchableOpacity
                onPress={() =>
                  setTeams([
                    ...teams,
                    { id: teams.length + 1, name: `Team ${teams.length + 1}`, players: [] }
                  ])
                }
                style={{ backgroundColor: palette.primary, padding: 10, borderRadius: 10, alignSelf: 'flex-start' }}
              >
                <Text style={{ color: palette.textLight, fontWeight: '700' }}>+ Add Team</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles(palette).bottomBar, { backgroundColor: palette.background }]}>
        <TouchableOpacity
        //IMPORTANT - LOGIC TO START GAMES WITHOUT TEAMS ASSIGNED IE:SOLO OR INDIVIDUAL SCORING WILL NEED TO ADD LOGIC FOR OTHER MODES
          onPress={handleStart}
          disabled={
          !selectedMode ||
          creating ||
          (selectedMode?.id === 'scramble' && unassigned.length > 0)
}
          style={[
            styles(palette).beginButton,
            (
              !selectedMode ||
              creating ||
              (selectedMode?.id === 'scramble' && unassigned.length > 0)
            )
              ? { opacity: 0.5 }
              : { opacity: 1 }
          ]}
          activeOpacity={0.9}
        >
          <Text style={styles(palette).beginButtonText}>
            {creating ? 'Starting…' : 'Begin Game'}
          </Text>
        </TouchableOpacity>

        {teamPickerPlayer && (
        <View style={{ marginTop: 20, backgroundColor: palette.background, padding: 20, borderRadius: 20 }}>
          <Text style={{ color: palette.primary, fontWeight: '700', marginBottom: 10 }}>Assign to Team</Text>

          {teams.map(team => (
            <TouchableOpacity
              key={team.id}
              onPress={() => {
                setTeams(prev => prev.map(t => ({
                  ...t,
                  players: t.id === team.id
                    ? [...t.players.filter(p => p !== teamPickerPlayer), teamPickerPlayer as string]
                    : t.players.filter(p => p !== teamPickerPlayer)
                })));
                setUnassigned(prev => prev.filter(id => id !== teamPickerPlayer));
                setTeamPickerPlayer(null);
              }}
              style={{ padding: 12, backgroundColor: palette.secondary, borderRadius: 10, marginBottom: 8 }}
            >
              <Text style={{ color: palette.textLight }}>{team.name}</Text>
            </TouchableOpacity>
          ))}

          {/* REMOVE FROM TEAM */}
          <TouchableOpacity
            onPress={() => {
              setTeams(prev => prev.map(t => ({
                ...t,
                players: t.players.filter(p => p !== teamPickerPlayer)
              })));
              setUnassigned(prev => [...prev, teamPickerPlayer as string]);
              setTeamPickerPlayer(null);
            }}
            style={{ padding: 12, backgroundColor: '#ff4d4d', borderRadius: 10, marginBottom: 8 }}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Remove From Team</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTeamPickerPlayer(null)}
            style={{ padding: 12, backgroundColor: '#ccc', borderRadius: 10, marginTop: 10 }}
          >
            <Text style={{ color: '#000', textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
      </View>
      </View>
    </>
  );
}

const styles = (palette: any) => ({
  screenTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: palette.primary,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  playersContainer: {
    backgroundColor: palette.background,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: palette.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 45,
    marginBottom: 24,
  },
  playerRowSingle: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  playerCardSmall: {
    width: (Dimensions.get('window').width - 40 - 28) / 4,
    alignItems: 'center' as const,
  },
  avatarSmall: {
    width: PLAYER_AVATAR_SIZE,
    height: PLAYER_AVATAR_SIZE,
    borderRadius: PLAYER_AVATAR_SIZE / 2,
    backgroundColor: '#E5E7EB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: palette.primary,
    marginBottom: 6,
    overflow: 'hidden' as const,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: palette.textLight,
  },
  playerName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: palette.textLight,
    textAlign: 'center' as const,
  },
  playerHandicap: {
    fontSize: 11,
    color: palette.third,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: palette.primary,
    marginTop: 28,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-start' as const,
    backgroundColor: palette.background,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: palette.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 45,
    marginBottom: 24,
  },
  gridItem: {
    width: ITEM_SIZE,
    alignItems: 'center' as const,
    marginBottom: 18,
    marginRight: 0,
  },
  gridCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: palette.secondary,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  gridCircleActive: {
    borderColor: palette.primary,
    backgroundColor: palette.teal,
  },
  gridIcon: {
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center' as const,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: palette.textLight,
    marginTop: 6,
    maxWidth: CIRCLE_SIZE + 8,
    textAlign: 'center' as const,
  },
  modeDetail: {
    marginTop: 20,
    backgroundColor: palette.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: palette.secondary,
    shadowColor: palette.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  detailIcon: {
    fontSize: 34,
    marginRight: 12,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: palette.textLight,
  },
  detailDesc: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color:  palette.textLight,
  },
  clearModeBtn: {
    marginTop: 16,
    alignSelf: 'flex-start' as const,
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  clearModeText: {
    color: palette.textLight,
    fontWeight: '700' as const,
    fontSize: 14,
  },
  bottomBar: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: palette.background,
    //borderTopWidth: 1,
    //borderTopColor: '#e5e7eb',
  },
  beginButton: {
    backgroundColor: palette.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  beginButtonText: {
    color: palette.textLight,
    fontWeight: '700' as const,
    fontSize: 18,
    letterSpacing: 0.5,
  },
});
// ------------------- NOTES AND UPDATES -----------------
{/* 
    NEW FILE,
    This file shows the players selected, and then allows the user to select a game mode, which shows a description of the gamemode.

    

*/}

import React, { useEffect, useState, useMemo } from 'react';
import { Stack } from "expo-router";
import { View, Text, ScrollView, TouchableOpacity, Pressable, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/components/supabase';
import { PALETTES } from '@/constants/theme';
import { useTheme } from '@/components/ThemeContext';

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
  const { courseId, tee, playerIds, playerNames } = useLocalSearchParams();
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedMode, setSelectedMode] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);

  const { palette } = useTheme();

  const parsedIds: string[] = useMemo(() => {
    try { return playerIds ? JSON.parse(String(playerIds)) : []; } catch { return []; }
  }, [playerIds]);
  const parsedNames: string[] = useMemo(() => {
    try { return playerNames ? JSON.parse(String(playerNames)) : []; } catch { return []; }
  }, [playerNames]);

  useEffect(() => {
    const load = async () => {
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
        }
      } finally {
        setLoadingPlayers(false);
      }
    };
    load();
  }, [parsedIds]);

  const handleStart = async () => {
    if (!courseId || !parsedIds.length || creating) return;
    setCreating(true);
    const { data: gid, error } = await supabase.rpc('start_game', {
      course: String(courseId),
      participant_ids: parsedIds,
    });
    if (error || !gid) {
      console.warn('Game creation failed', error);
      setCreating(false);
      return;
    }
    await AsyncStorage.setItem('currentGamePlayers', JSON.stringify({
      ids: parsedIds,
      course: courseId,
      gameId: gid,
      mode: selectedMode?.id || null,
    }));
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
        newGame: '1',
      },
    });
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
      </ScrollView>

      <View style={[styles(palette).bottomBar, { backgroundColor: palette.background }]}>
        <TouchableOpacity
          onPress={handleStart}
          disabled={!selectedMode || creating}
          style={[
            styles(palette).beginButton,
            (!selectedMode || creating) && { opacity: 0.5 },
          ]}
          activeOpacity={0.9}
        >
          <Text style={styles(palette).beginButtonText}>
            {creating ? 'Starting…' : 'Begin Game'}
          </Text>
        </TouchableOpacity>
      </View>
      </View>
    </>
  );
}

const styles = (palette) => ({
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
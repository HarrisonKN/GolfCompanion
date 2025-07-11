// ------------------- IMPORTS -------------------------
import React, { useState } from 'react';
import { View, Pressable, FlatList, StyleSheet, Platform, Switch } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';


// ------------------- MOCK DATA -------------------------
// Mock data for voice chat groups
const mockGroups = [
  { id: '1', name: 'Morning Golfers', members: 8 },
  { id: '2', name: 'Weekend Warriors', members: 12 },
  { id: '3', name: 'Pro Tips Chat', members: 5 },
];

// Mock Spotify track data
const mockTrack = {
  title: 'Green on the Fairway',
  artist: 'Birdie Band',
  albumArt: 'https://picsum.photos/100', // Replace with real album art url
};


// ------------------- Socials LOGIC -------------------------
export default function SocialScreen() {
  const [groups, setGroups] = useState(mockGroups);
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);

  // Handlers
  const joinGroup = (id: string) => {
    setJoinedGroupId(id);
  };

  const leaveGroup = () => {
    setJoinedGroupId(null);
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleSpotifyConnect = () => {
    setSpotifyConnected(!spotifyConnected);
  };


  // ------------------- UI Setup -------------------------
  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>VoiceChat</ThemedText>
        <Pressable
          style={styles.createButton}
          onPress={() => {
            // For demo, just add a new group with a timestamp id
            const newGroup = {
              id: Date.now().toString(),
              name: `New Group ${groups.length + 1}`,
              members: 1,
            };
            setGroups([newGroup, ...groups]);
            setJoinedGroupId(newGroup.id);
          }}
        >
          <ThemedText style={styles.createButtonText}>+ Create Group</ThemedText>
        </Pressable>
      </View>

      {/* Groups List */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        style={styles.groupList}
        renderItem={({ item }) => {
          const joined = item.id === joinedGroupId;
          return (
            <View style={[styles.groupItem, joined && styles.groupItemJoined]}>
              <ThemedText style={styles.groupName}>{item.name}</ThemedText>
              <ThemedText style={styles.groupMembers}>{item.members} members</ThemedText>

              {joined ? (
                <Pressable style={styles.leaveButton} onPress={leaveGroup}>
                  <ThemedText style={styles.leaveButtonText}>Leave</ThemedText>
                </Pressable>
              ) : (
                <Pressable style={styles.joinButton} onPress={() => joinGroup(item.id)}>
                  <ThemedText style={styles.joinButtonText}>Join</ThemedText>
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<ThemedText>No groups available</ThemedText>}
      />

      {/* Spotify Overlay */}
      <View style={styles.spotifyOverlay}>
        <View style={styles.albumArtContainer}>
          <IconSymbol
            name="music.note"
            size={60}
            color="#3B82F6"
          />
          {/* 
          To show actual album art image, uncomment and import Image from react-native or expo-image:
          <Image source={{ uri: mockTrack.albumArt }} style={styles.albumArt} />
          */}
        </View>

        <View style={styles.trackInfo}>
          <ThemedText style={styles.trackTitle}>{mockTrack.title}</ThemedText>
          <ThemedText style={styles.trackArtist}>{mockTrack.artist}</ThemedText>
        </View>

        <Pressable onPress={togglePlayback} style={styles.playPauseButton}>
          <IconSymbol
            name={isPlaying ? 'pause.circle.fill' : 'play.circle.fill'}
            size={48}
            color="#3B82F6"
          />
        </Pressable>
      </View>

      {/* Spotify Connect Toggle */}
      <View style={styles.spotifyConnectContainer}>
        <ThemedText style={styles.spotifyConnectLabel}>Spotify Connected</ThemedText>
        <Switch
          value={spotifyConnected}
          onValueChange={toggleSpotifyConnect}
          thumbColor={Platform.OS === 'android' ? (spotifyConnected ? '#3B82F6' : '#ccc') : undefined}
          trackColor={{ false: '#767577', true: '#A5B4FC' }}
        />
      </View>
    </ThemedView>
  );
}

// ------------------- UI Styling -------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E40AF',
  },
  createButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  groupList: {
    flexGrow: 0,
    marginBottom: 30,
  },
  groupItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  groupItemJoined: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  groupName: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1E3A8A',
    flex: 1,
  },
  groupMembers: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  joinButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  leaveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  spotifyOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  albumArtContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  trackArtist: {
    fontSize: 14,
    color: '#4B5563',
  },
  playPauseButton: {
    marginLeft: 10,
  },
  spotifyConnectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  spotifyConnectLabel: {
    fontWeight: '600',
    color: '#374151',
    fontSize: 14,
  },
});

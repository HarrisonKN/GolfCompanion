import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';

const COMPACT_H = 36;

const styles = {
  container: {
    flexGrow: 1,
    justifyContent: 'center' as 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as '700',
    color: '#2563eb',
    textAlign: 'center' as 'center',
    marginBottom: 18,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center' as 'center',
    marginBottom: 18,
  },
  sectionLabel: {
    fontWeight: '700' as '700',
    fontSize: 16,
    color: '#2563eb',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center' as 'center',
  },
  selectedPlayersSection: {
    marginBottom: 18,
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    padding: 12,
  },
  selectedPlayerChip: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    margin: 4,
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
  },
  selectedPlayerText: {
    color: '#fff',
    fontWeight: '600' as '600',
    fontSize: 14,
    marginRight: 8,
  },
  removePlayerButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 10,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  removePlayerButtonText: {
    color: '#2563eb',
    fontWeight: '700' as '700',
    fontSize: 12,
  },
  inviteSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  playerList: {
    flexDirection: 'row' as 'row',
    flexWrap: 'wrap' as 'wrap',
    marginBottom: 8,
  },
  playerChip: {
    backgroundColor: '#e0e7ff',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    margin: 4,
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playerChipText: {
    color: '#2563eb',
    fontWeight: '600' as '600',
    fontSize: 14,
  },
  searchInput: {
    backgroundColor: '#e3e3e3',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderColor: '#2563eb',
    borderWidth: 1,
    color: '#222',
  },
  searchResult: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    justifyContent: 'space-between' as 'space-between',
  },
  inviteButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginLeft: 8,
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '700' as '700',
    fontSize: 14,
  },
  beginButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 40,
    alignItems: 'center' as 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1 }],
  },
  beginButtonPressed: {
    backgroundColor: '#3B82F6',
    shadowOpacity: 0.08,
    transform: [{ scale: 0.96 }],
  },
  beginButtonText: {
    color: '#fff',
    fontWeight: '700' as '700',
    fontSize: 20,
    letterSpacing: 1,
    textShadowColor: '#222',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  dropdown: {
    backgroundColor: '#e3e3e3',
    borderColor: '#3B82F6',
    marginBottom: 8,
  },
  dropdownContainer: {
    backgroundColor: '#f5f5f5',
    borderColor: '#3B82F6',
  },
  containerCompact: {
    height: COMPACT_H,
    width: 220,
    alignSelf: "center" as "center",
    marginBottom: 18,
  },
  dropdownCompact: {
    height: COMPACT_H,
    minHeight: COMPACT_H,
    paddingVertical: 0,
    borderRadius: 8,
    width: 200,
  },
  textCompact: {
    fontSize: 14,
    lineHeight: 18,
    color: '#222',
  },
  placeholderCompact: {
    fontSize: 14,
    lineHeight: 18,
    color: '#888',
  },
  iconCompact: {
    height: COMPACT_H,
    justifyContent: "center" as "center",
  },
  iconText: {
    fontSize: 12,
    color: '#888',
  },
};

function ArrowDown({ style }: { style?: any }) {
  return (
    <View style={[style, styles.iconCompact]}>
      <Text style={styles.iconText}>▾</Text>
    </View>
  );
}

function ArrowUp({ style }: { style?: any }) {
  return (
    <View style={[style, styles.iconCompact]}>
      <Text style={styles.iconText}>▴</Text>
    </View>
  );
}

export default function StartGameScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Course dropdown state
  const [courseOpen, setCourseOpen] = useState(false);
  const [course, setCourse] = useState(null);
  const [courseItems, setCourseItems] = useState<any[]>([]);

  // Tee dropdown state
  const [teeOpen, setTeeOpen] = useState(false);
  const [tee, setTee] = useState(null);
  const [teeItems, setTeeItems] = useState<any[]>([]);

  // Friends and player selection
  const [allFriends, setAllFriends] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<any[]>([]);

  // Invite other users
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  // Used for users invited via search
  const [otherUsers, setOtherUsers] = useState<any[]>([]);

  // Fetch courses from Supabase
  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from("GolfCourses")
        .select("*")
        .order("name");
      if (!error && data) {
        setCourseItems(data.map((course) => ({
          label: course.name,
          value: course.id,
        })));
      }
    }
    fetchCourses();
  }, []);

  // Fetch tees when course changes (stub: replace with real fetch)
  useEffect(() => {
    if (!course) return;
    setTeeItems([
      { label: "Blue Tees", value: "blue" },
      { label: "White Tees", value: "white" },
      { label: "Red Tees", value: "red" },
    ]);
  }, [course]);

  // Fetch user's friends from Supabase (profiles full_name), and include "You"
  useEffect(() => {
    const fetchFriends = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('friends')
        .select('friend_id, profiles:friend_id(full_name)')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching friends:', error);
        return;
      }

      const friends = (data || []).map((f: any) => ({
        id: f.friend_id,
        name: f.profiles?.full_name || 'Unknown',
      }));

      const you = { id: user.id, name: 'You' };
      // Ensure no dup if your id appears in friends
      const unique = [you, ...friends.filter((f: any) => f.id !== user.id)];

      setAllFriends(unique);
    };
    fetchFriends();
  }, [user?.id]);

  // Search for other users (stub: replace with real backend search)
  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchResults([
      { id: 'u1', name: 'OtherUser1' },
      { id: 'u2', name: 'OtherUser2' },
    ].filter(u => u.name.toLowerCase().includes(search.toLowerCase())));
  }, [search]);

  // Add friend to selected players
  function selectFriend(friend: any) {
    if (!selectedPlayers.find(p => p.id === friend.id)) {
      setSelectedPlayers([...selectedPlayers, friend]);
    }
  }

  // Add other user to selected players
  function inviteOther(id: string, name: string) {
    if (!selectedPlayers.find(p => p.id === id)) {
      setSelectedPlayers([...selectedPlayers, { id, name }]);
    }
    setSearch('');
    setSearchResults([]);
  }

  // Remove player from selected
  function removePlayer(id: string) {
    setSelectedPlayers(selectedPlayers.filter(p => p.id !== id));
  }

  // Filter out already selected friends from invite list
  const availableFriends = allFriends.filter(
    friend => !selectedPlayers.find(p => p.id === friend.id)
  );

  const handleBegin = () => {
    const names = selectedPlayers.map((p: { name: string }) => p.name);
    const params: any = { playerNames: JSON.stringify(names) };
    if (course) params.courseId = String(course); // pass selected course
    router.push({ pathname: '/(tabs)/scorecard', params });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Start a New Game</Text>
        <Text style={styles.subtitle}>
          Select your course, tee, and invite players to begin your round!
        </Text>
        {/* Course Picker */}
        <DropDownPicker
          placeholder="Select a course..."
          open={courseOpen}
          value={course}
          items={courseItems}
          setOpen={setCourseOpen}
          setValue={setCourse}
          setItems={setCourseItems}
          containerStyle={styles.containerCompact}
          style={styles.dropdownCompact}
          textStyle={styles.textCompact}
          placeholderStyle={styles.placeholderCompact}
          arrowIconContainerStyle={styles.iconCompact}
          ArrowDownIconComponent={ArrowDown}
          ArrowUpIconComponent={ArrowUp}
          listMode="MODAL"
          modalProps={{ animationType: "slide", transparent: true }}
          modalContentContainerStyle={{
            backgroundColor: '#f5f5f5',
            maxHeight: 300,
            marginHorizontal: 20,
            borderRadius: 8,
          }}
          dropDownContainerStyle={styles.dropdownContainer}
          listItemLabelStyle={styles.textCompact}
          zIndex={2000}
        />
        {/* Tee Picker */}
        <DropDownPicker
          placeholder="Select Tee"
          open={teeOpen}
          value={tee}
          items={teeItems}
          setOpen={setTeeOpen}
          setValue={setTee}
          setItems={setTeeItems}
          containerStyle={styles.containerCompact}
          style={styles.dropdownCompact}
          textStyle={styles.textCompact}
          placeholderStyle={styles.placeholderCompact}
          arrowIconContainerStyle={styles.iconCompact}
          ArrowDownIconComponent={ArrowDown}
          ArrowUpIconComponent={ArrowUp}
          listMode="MODAL"
          modalProps={{ animationType: "slide", transparent: true }}
          modalContentContainerStyle={{
            backgroundColor: '#f5f5f5',
            maxHeight: 300,
            marginHorizontal: 20,
            borderRadius: 8,
          }}
          dropDownContainerStyle={styles.dropdownContainer}
          listItemLabelStyle={styles.textCompact}
          zIndex={2000}
        />

        {/* Selected Players Section */}
        <Text style={styles.sectionLabel}>Selected Players</Text>
        <View style={styles.selectedPlayersSection}>
          {selectedPlayers.length === 0 && (
            <Text style={{ color: '#888', textAlign: 'center' }}>No players selected yet.</Text>
          )}
          <View style={styles.playerList}>
            {selectedPlayers.map(player => (
              <View key={player.id} style={styles.selectedPlayerChip}>
                <Text style={styles.selectedPlayerText}>{player.name}</Text>
                <Pressable
                  style={styles.removePlayerButton}
                  onPress={() => removePlayer(player.id)}
                >
                  <Text style={styles.removePlayerButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* Invite Section (Friends + Other Users) */}
        <View style={styles.inviteSection}>
          <Text style={styles.sectionLabel}>Invite Friends</Text>
          <View style={styles.playerList}>
            {availableFriends.length === 0 && (
              <Text style={{ color: '#888', textAlign: 'center' }}>All friends selected.</Text>
            )}
            {availableFriends.map(friend => (
              <Pressable
                key={friend.id}
                style={styles.playerChip}
                onPress={() => selectFriend(friend)}
              >
                <Text style={styles.playerChipText}>{friend.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionLabel}>Invite Other Users</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for users..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#888"
          />
          {searchResults.map((user) => (
            <View key={user.id} style={styles.searchResult}>
              <Text style={styles.playerChipText}>{user.name}</Text>
              <Pressable
                style={styles.inviteButton}
                onPress={() => inviteOther(user.id, user.name)}
              >
                <Text style={styles.inviteButtonText}>Invite</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* BEGIN Button */}
        <TouchableOpacity
          onPress={handleBegin}
          style={[styles.beginButton /*, pressed && styles.beginButtonPressed */]}
          activeOpacity={0.9}
        >
          <Text style={styles.beginButtonText}>Begin Game</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COMPACT_H = 36;

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
  const [course, setCourse] = useState<any | null>(null);
  const [courseItems, setCourseItems] = useState<any[]>([]);

  // Add-course flow
  const [addingCourse, setAddingCourse] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [savingCourse, setSavingCourse] = useState(false);

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
        const mapped = data.map((course) => ({
          label: course.name,
          value: course.id,
        }));
        setCourseItems([{ label: "➕ Add a course", value: "add_course" }, ...mapped]);
      }
    }
    fetchCourses();
  }, []);

  // Save new course handler
  async function saveNewCourse() {
    if (!courseName.trim()) return;
    setSavingCourse(true);
    const { data, error } = await supabase
      .from("GolfCourses")
      .insert([{ name: courseName.trim() }])
      .select();
    setSavingCourse(false);
    if (!error && data && data.length > 0) {
      const newCourse = data[0];
      setCourseItems((prev) => [
        { label: "➕ Add a course", value: "add_course" },
        ...prev.filter(item => item.value !== "add_course"),
        { label: newCourse.name, value: newCourse.id }
      ]);
      setCourse(newCourse.id);
      setAddingCourse(false);
      setCourseName('');
    }
    // Optionally handle error (e.g., show a message)
  }

  // Fetch tees when course changes (stub: replace with real fetch)
  useEffect(() => {
    if (!course) return;
    setTeeItems([
      { label: "Blue Tees", value: "blue" },
      { label: "White Tees", value: "white" },
      { label: "Red Tees", value: "red" },
    ]);
  }, [course]);

  // Load friends from Supabase
  useEffect(() => {
    if (!user?.id) return;

    const loadFriends = async () => {
      try {
        // Try a symmetrical friendships table (user_id <-> friend_id) with status
        let friendIds: string[] = [];
        const { data: f1, error: e1 } = await supabase
          .from('friendships')
          .select('user_id, friend_id, status')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted');

        if (!e1 && Array.isArray(f1) && f1.length) {
          friendIds = f1.map(r => (r.user_id === user.id ? r.friend_id : r.user_id));
        } else {
          // Fallback to a one-way friends table (user_id -> friend_id)
          const { data: f2, error: e2 } = await supabase
            .from('friends')
            .select('friend_id')
            .eq('user_id', user.id);

          if (!e2 && Array.isArray(f2) && f2.length) {
            friendIds = f2.map(r => r.friend_id);
          }
        }

        if (!friendIds.length) {
          setAllFriends([]); // no friends
          return;
        }

        const { data: profiles, error: pe } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', friendIds);

        if (pe) {
          console.warn('Profiles fetch failed:', pe);
          setAllFriends([]);
          return;
        }

        const friends = (profiles || []).map(p => ({
          id: p.id,
          name: p.full_name || 'Unknown',
        }));

        // Optional: include "You" at the top
        const you = { id: user.id, name: 'You' };
        setAllFriends([you, ...friends.filter(f => f.id !== user.id)]);
      } catch (err) {
        console.warn('Error loading friends:', err);
        setAllFriends([]);
      }
    };

    loadFriends();
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

  const handleBegin = async () => {
    if (!user?.id || !course) return;

    const ids = selectedPlayers.map((p: { id: string }) => p.id);
    const names = selectedPlayers.map((p: { name: string }) => p.name);

    // Create game + participants atomically
    const { data: gid, error } = await supabase.rpc('start_game', {
      course: course as string,
      participant_ids: ids as string[],
    });
    if (error || !gid) {
      console.warn('Create game failed', error);
      return;
    }

    await AsyncStorage.setItem('currentGamePlayers', JSON.stringify({ ids, course, gameId: gid }));

    router.push({
      pathname: '/(tabs)/scorecard',
      params: {
        courseId: String(course),
        gameId: gid,
        playerNames: JSON.stringify(names),
        playerIds: JSON.stringify(ids),
        newGame: '1',
      },
    });
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
        {/* Add-course inline UI (appears when "➕ Add a course" is selected) */}
        {addingCourse && (
          <View style={{ marginTop: 12, marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', color: '#2563eb', marginBottom: 8 }}>New course name</Text>
            <TextInput
              value={courseName}
              onChangeText={setCourseName}
              placeholder="Enter course name"
              placeholderTextColor="#888"
              style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#d1d5db' }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <Pressable
                onPress={() => { setAddingCourse(false); setCourseName(''); }}
                style={{ paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
              >
                <Text style={{ color: '#2563eb', fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveNewCourse}
                disabled={savingCourse}
                style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{savingCourse ? 'Saving...' : 'Save Course'}</Text>
              </Pressable>
            </View>
          </View>
        )}
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

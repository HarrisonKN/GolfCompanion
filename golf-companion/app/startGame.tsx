// ------------------- NOTES AND UPDATES -----------------
{/* 

I changed the invite friends section and the selected players section, nothing major just some styling and layout 
changes to make it more user friendly.

I am going to change how users and things are shown so that there isnt so much movement on the screen when selecting and removing
players around the screen.

*/}
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, TouchableOpacity, Image, Modal, Dimensions, FlatList } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { opacity } from 'react-native-reanimated/lib/typescript/Colors';

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

  // Used to confirm removal of a selected player
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Make "invite other users" a modal-driven search like Accounts
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);

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

      // ✅ Automatically create 18 holes for this course
      const holesData = Array.from({ length: 18 }, (_, i) => ({
        course_id: newCourse.id,
        hole_number: i + 1,
        par: 0,
        yardage: 0,
      }));

      const { error: holesError } = await supabase.from('holes').insert(holesData);
      if (holesError) {
        console.warn('Error creating holes:', holesError);
      }

      // ✅ Initialize par_values in GolfCoursesr
      const parValues = Array(18).fill(0);
      await supabase
        .from('GolfCourses')
        .update({ par_values: parValues })
        .eq('id', newCourse.id);

      // ✅ Continue updating UI
      setCourseItems((prev) => [
        { label: "➕ Add a course", value: "add_course" },
        ...prev.filter(item => item.value !== "add_course"),
        { label: newCourse.name, value: newCourse.id },
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
          .select('id, full_name, avatar_url') // include avatar_url if present in your schema
          .in('id', friendIds);

        if (pe) {
          console.warn('Profiles fetch failed:', pe);
          setAllFriends([]);
          return;
        }

        const friends = (profiles || []).map(p => ({
          id: p.id,
          name: p.full_name || 'Unknown',
          avatar_url: (p as any).avatar_url || null,
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

  useEffect(() => {
    if (!inviteModalVisible) return;
    const run = async () => {
      const q = inviteSearch.trim();
      if (!q) {
        setInviteResults([]);
        return;
      }
      setInviteSearching(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .order('full_name', { ascending: true })
          .limit(50);
        if (error) throw error;
        setInviteResults(data || []);
      } catch (e) {
        console.warn('Invite search error:', e);
        setInviteResults([]);
      } finally {
        setInviteSearching(false);
      }
    };
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
  }, [inviteSearch, inviteModalVisible]);

  // Add friend to selected players
  function selectFriend(friend: any) {
    if (!selectedPlayers.find(p => p.id === friend.id)) {
      setSelectedPlayers([...selectedPlayers, friend]);
    }
  }

  // Add other user to selected players
  function inviteOther(id: string, name: string, avatar_url?: string | null) {
    if (!selectedPlayers.find(p => p.id === id)) {
      setSelectedPlayers([...selectedPlayers, { id, name, avatar_url: avatar_url || null }]);
    }
    setInviteModalVisible(false);
    setInviteSearch('');
    setInviteResults([]);
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

    const ids = Array.from(new Set([...selectedPlayers.map(p => p.id), user.id]));
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
      pathname: '/gameModes',
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
          setValue={(callback) => {
            const newValue = typeof callback === "function" ? callback(course) : callback;
            if (newValue === "add_course") {
              setAddingCourse(true);
              setCourse(null);
            } else {
              setAddingCourse(false);
              setCourse(newValue);
            }
          }}
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
        <View style={styles.selectedPlayersCompactRow}>
          {selectedPlayers.length === 0 ? (
            <Text style={{ color: '#888', textAlign: 'center' }}>No players selected yet.</Text>
          ) : (
            selectedPlayers.slice(0, 4).map(player => (
              <View key={player.id} style={styles.playerCardSmall}>
                <View style={styles.avatarSmall}>
                  {player.avatar_url ? (
                    <Image
                      source={{ uri: player.avatar_url }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                      }}
                    />
                  ) : (
                    <Text style={styles.avatarInitial}>
                      {(player.name?.[0] || '?').toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                <TouchableOpacity
                  onPress={() => removePlayer(player.id)}
                  style={styles.removePlayerCompactBtn}
                >
                  <Text style={styles.removePlayerCompactText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Invite Section (Friends + Invite Button) */}
        <View style={styles.inviteSection}>
          <Text style={styles.sectionLabel}>Invite Friends</Text>

          {availableFriends.length === 0 ? (
            <Text style={{ color: '#888', textAlign: 'center' }}>All friends selected.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.storyRow}
              contentContainerStyle={styles.storyScroll}
            >
              {/* Circular + button to open search modal */}
              <Pressable
                key="invite-button"
                style={styles.storyItem}
                onPress={() => setInviteModalVisible(true)}
                accessibilityLabel="Invite other users"
              >
                <View style={[styles.storyAvatar, { borderColor: '#2563eb', backgroundColor: '#DBEAFE' }]}>
                  <Text style={{ color: '#2563eb', fontSize: 28, fontWeight: '700' }}>+</Text>
                </View>
                <Text style={styles.storyName} numberOfLines={1}>
                  Invite
                </Text>
              </Pressable>

              {availableFriends.map(friend => (
                <Pressable
                  key={friend.id}
                  style={styles.storyItem}
                  onPress={() => selectFriend(friend)}
                >
                  <View style={styles.storyAvatar}>
                    {friend.avatar_url ? (
                      <Image
                        source={{ uri: friend.avatar_url }}
                        style={styles.storyAvatarImage}
                      />
                    ) : (
                      <Text style={styles.storyInitial}>
                        {(friend.name?.[0] || '?').toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>
                    {friend.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Removed inline "Invite Other Users" input/results in favor of modal */}
        </View>

        {/* Invite Search Modal */}
        <Modal
          visible={inviteModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setInviteModalVisible(false)}
        >
          <View style={styles.inviteModalOverlay}>
            <View style={styles.inviteModalContainer}>
              <View style={styles.inviteModalHeader}>
                <Text style={styles.inviteModalTitle}>Find players</Text>
                <Pressable onPress={() => setInviteModalVisible(false)} style={styles.inviteModalClose}>
                  <Text style={{ fontSize: 18, color: '#111827' }}>✕</Text>
                </Pressable>
              </View>

              <View style={{ padding: 12 }}>
                <View style={styles.inviteSearchInputContainer}>
                  <TextInput
                    style={styles.inviteSearchInput}
                    placeholder="Search by name or email..."
                    placeholderTextColor="#888"
                    value={inviteSearch}
                    onChangeText={setInviteSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {inviteSearching ? (
                <Text style={{ textAlign: 'center', color: '#888', paddingVertical: 12 }}>Searching…</Text>
              ) : (
                <FlatList
                  data={inviteResults}
                  keyExtractor={(u: any) => u.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.inviteResultsContent}
                  ListEmptyComponent={
                    <Text style={{ textAlign: 'center', color: '#888', paddingVertical: 12 }}>
                      {inviteSearch.trim() ? 'No users found' : 'Type to search for players'}
                    </Text>
                  }
                  renderItem={({ item: u }: any) => {
                    const alreadySelected = selectedPlayers.some(p => p.id === u.id);
                    return (
                      <Pressable
                        style={styles.inviteResultRow}
                        onPress={() => {
                          if (!alreadySelected) inviteOther(u.id, u.full_name || 'Unknown', u.avatar_url || null);
                        }}
                        disabled={alreadySelected}
                        accessibilityLabel={`Invite ${u.full_name || 'Unknown'}`}
                      >
                        <View style={styles.inviteResultAvatar}>
                          {u.avatar_url ? (
                            <Image source={{ uri: u.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                          ) : (
                            <Text style={{ color: '#fff', fontWeight: '700' }}>
                              {(u.full_name?.[0] || '?').toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.inviteResultName}>{u.full_name || 'Unknown'}</Text>
                          {!!u.email && <Text style={styles.inviteResultEmail}>{u.email}</Text>}
                        </View>
                        <Text style={[styles.inviteResultAction, alreadySelected && { opacity: 0.5 }]}>
                          {alreadySelected ? 'Selected' : 'Add'}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* BEGIN Button */}
        <TouchableOpacity
          onPress={handleBegin}
          style={[styles.beginButton /*, pressed && styles.beginButtonPressed */]}
          activeOpacity={0.9}
        >
          <Text style={styles.beginButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
const INVITE_MODAL_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.85);
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
  selectedPlayersCompactRow: {
    flexDirection: 'row' as 'row',
    flexWrap: 'wrap' as 'wrap',
    justifyContent: 'center' as 'center',
    marginBottom: 18,
  },
  playerCardSmall: {
    alignItems: 'center' as 'center',
    margin: 8,
  },
  avatarSmall: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
    alignItems: 'center' as 'center',
    justifyContent: 'center' as 'center',
    marginBottom: 4,
  },
  avatarInitial: {
    color: '#2563eb',
    fontWeight: '700' as '700',
    fontSize: 18,
  },
  playerName: {
    fontSize: 12,
    color: '#111827',
    textAlign: 'center' as 'center',
  },
  removePlayerCompactBtn: {
    marginTop: 4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  removePlayerCompactText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as '700',
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
  storyRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  storyScroll: {
    paddingHorizontal: 6,
  },
  storyItem: {
    width: 72,
    alignItems: 'center' as 'center',
    marginRight: 12,
  },
  storyItemConfirm: {
    // Optional: subtle emphasis for the whole item
  },
  storyItemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  storyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    alignItems: 'center' as 'center',
    justifyContent: 'center' as 'center',
    borderWidth: 2,
    borderColor: '#C7D2FE',
    overflow: 'hidden' as 'hidden',
    position: 'relative' as 'relative',
  },
  storyAvatarConfirm: {
    borderColor: '#ef4444',
  },
  storyAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  storyInitial: {
    color: '#2563eb',
    fontWeight: '700' as '700',
    fontSize: 18,
  },
  storyName: {
    marginTop: 6,
    fontSize: 12,
    color: '#111827',
    textAlign: 'center' as 'center',
  },
  storyNameConfirm: {
    color: '#ef4444',
    fontWeight: '700' as '700',
  },
  confirmOverlay: {
    position: 'absolute' as 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: 'rgba(133, 7, 7, 0.15)',
    alignItems: 'center' as 'center',
    justifyContent: 'center' as 'center',
    borderTopWidth: 1,
    borderTopColor: '#ef4444',
  },
  confirmText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as '700',
  },
  // If you still keep the badge elsewhere, you can keep/remove these:
  removeBadge: {
    position: 'absolute' as 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center' as 'center',
    justifyContent: 'center' as 'center',
    shadowColor: '#000',
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#fff',
  },
  removeBadgeText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700' as '700',
  },
  inviteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
    padding: 16,
  },
  inviteModalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '95%' as const,
    maxHeight: INVITE_MODAL_MAX_HEIGHT,
    overflow: 'hidden' as 'hidden',
  },
  inviteModalHeader: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    justifyContent: 'space-between' as 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  inviteModalTitle: {
    fontSize: 18,
    fontWeight: '700' as '700',
    color: '#2563eb',
  },
  inviteModalClose: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  inviteSearchInputContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inviteSearchInput: {
    height: 44,
    color: '#111827',
    fontSize: 16,
  },
  inviteResultsContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  inviteResultRow: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  inviteResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    alignItems: 'center' as 'center',
    justifyContent: 'center' as 'center',
  },
  inviteResultName: {
    fontSize: 14,
    fontWeight: '600' as '600',
    color: '#111827',
  },
  inviteResultEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
  inviteResultAction: {
    color: '#2563eb',
    fontWeight: '700' as '700',
    fontSize: 14,
    paddingHorizontal: 8,
  },
};

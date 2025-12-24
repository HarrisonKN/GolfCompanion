import React, { useEffect, useState } from 'react';
import { View, Pressable, FlatList, StyleSheet, TextInput, Modal, Image } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/components/ThemeContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { Swipeable } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { notifyGroupInvite } from '@/lib/NotificationTriggers';
import { useSpotify } from '@/components/SpotifyContext';

type VoiceGroup = {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  creator_id: string;
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function GolfHubScreen() {
  const [activeTab, setActiveTab] = useState<'chat' | 'music' | 'tournaments'>('chat');
  const [groups, setGroups] = useState<VoiceGroup[]>([]);
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalGroupDesc, setModalGroupDesc] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const { user } = useAuth();
  const [friends, setFriends] = useState<any[]>([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { isConnected: spotifyIsConnected, isPlaying, currentTrack, connectSpotify, disconnectSpotify, play, pause, nextTrack, previousTrack } = useSpotify();
  const { palette } = useTheme();

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleGroupPress = (group: VoiceGroup) => {
    router.push({
      pathname: '/hubRoom',
      params: {
        roomId: group.id,
        roomName: group.name,
        roomDesc: group.description || '',
      },
    });
  };

  const saveEditedGroupName = async () => {
    if (!editGroupId || !editGroupName.trim()) return;
    await supabase
      .from('voice_groups')
      .update({ name: editGroupName, description: editGroupDesc })
      .eq('id', editGroupId);
    setGroups(groups.map(g => g.id === editGroupId ? { ...g, name: editGroupName, description: editGroupDesc } : g));
    setEditModalVisible(false);
  };

  useEffect(() => {
    const fetchAllUserGroups = async () => {
      if (!user?.id) return;

      try {
        const { data: memberGroups, error: memberError } = await supabase
          .from('voice_group_members')
          .select(`
            group_id,
            voice_groups (
              id,
              name,
              description,
              created_at,
              creator_id
            )
          `)
          .eq('user_id', user.id);

        if (memberError) {
          console.error('Error fetching member groups:', memberError);
          return;
        }

        const allGroups = memberGroups
          ?.map(m => m.voice_groups)
          .filter(Boolean)
          .flat() as VoiceGroup[] || [];

        setGroups(allGroups);
      } catch (error) {
        console.error('Error in fetchAllUserGroups:', error);
      }
    };

    fetchAllUserGroups();
  }, [user?.id]);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('friends')
        .select('friend_id, profiles(full_name, email)')
        .eq('user_id', user.id);
      setFriends(data || []);
    };
    fetchFriends();
  }, [user]);

  const inviteFriend = async (friendId: string, groupId: string) => {
    try {
      await supabase.from('hubroom_invites').insert({
        group_id: groupId,
        invited_user_id: friendId,
        inviter_user_id: user?.id,
      });

      const inviterName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'A user';
      const groupName = groups.find(g => g.id === groupId)?.name || 'a group';
      await notifyGroupInvite(friendId, inviterName, groupName, groupId);

      showToast('Invite sent!');
    } catch (error) {
      console.error('Error sending invite:', error);
      showToast('Error sending invite');
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const membershipChannel = supabase
      .channel('voice_group_memberships')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_group_members', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const { data: groupData } = await supabase
            .from('voice_groups')
            .select('*')
            .eq('id', payload.new.group_id)
            .single();

          if (groupData) {
            setGroups(prev => {
              const exists = prev.some(g => g.id === groupData.id);
              if (exists) return prev;
              return [...prev, groupData];
            });
            showToast('Added to new group!');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'voice_group_members', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setGroups(prev => prev.filter(g => g.id !== payload.old.group_id));
          showToast('Removed from group');
        }
      )
      .subscribe();

    const groupUpdatesChannel = supabase
      .channel('voice_group_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'voice_groups' },
        (payload) => {
          setGroups(prev => prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'voice_groups' },
        (payload) => {
          setGroups(prev => prev.filter(g => g.id !== payload.old.id));
          showToast('Group was deleted');
        }
      )
      .subscribe();

    return () => {
      membershipChannel.unsubscribe();
      groupUpdatesChannel.unsubscribe();
    };
  }, [user?.id]);

  const createGroup = async () => {
    if (!modalGroupName.trim() || !user?.id) return;

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('voice_groups')
        .insert({
          name: modalGroupName,
          description: modalGroupDesc,
          creator_id: user.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const { error: memberError } = await supabase
        .from('voice_group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
        });

      if (memberError) throw memberError;

      setGroups(prev => [groupData, ...prev]);
      setModalGroupName('');
      setModalGroupDesc('');
      setCreateModalVisible(false);
      showToast('Group created successfully!');
    } catch (error) {
      console.error('❌ Error creating group:', error);
      showToast('Error creating group');
    }
  };

  const handleDeleteOrLeave = async () => {
    if (!groupToDelete || !user?.id) return;
    const group = groups.find(g => g.id === groupToDelete);
    if (!group) return;

    try {
      if (group.creator_id === user.id) {
        const { error } = await supabase
          .from('voice_groups')
          .delete()
          .eq('id', groupToDelete);
        if (error) throw error;
        showToast('Group deleted successfully');
      } else {
        const { error } = await supabase
          .from('voice_group_members')
          .delete()
          .eq('group_id', groupToDelete)
          .eq('user_id', user.id);
        if (error) throw error;
        showToast('Left group successfully');
      }

      setGroups(prev => prev.filter(g => g.id !== groupToDelete));
      setDeleteConfirmVisible(false);
      setGroupToDelete(null);
    } catch (error) {
      console.error('❌ Error processing request:', error);
      showToast('Error processing request');
    }
  };

  const renderRightActions = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;

    const isCreator = group.creator_id === user?.id;

    return (
      <View style={styles(palette).swipeActions}>
        <Pressable
          onPress={() => {
            setGroupToDelete(groupId);
            setDeleteConfirmVisible(true);
          }}
          style={[styles(palette).swipeButton, { backgroundColor: palette.error }]}
        >
          <ThemedText style={styles(palette).swipeButtonText}>
            {isCreator ? 'Delete' : 'Leave'}
          </ThemedText>
        </Pressable>

        {isCreator && (
          <>
            <Pressable
              onPress={() => {
                setInviteGroupId(groupId);
                setInviteModalVisible(true);
              }}
              style={[styles(palette).swipeButton, { backgroundColor: palette.primary }]}
            >
              <ThemedText style={styles(palette).swipeButtonText}>Invite</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                setEditGroupId(groupId);
                setEditGroupName(group.name);
                setEditGroupDesc(group.description || '');
                setEditModalVisible(true);
              }}
              style={[styles(palette).swipeButton, { backgroundColor: palette.grey }]}
            >
              <ThemedText style={styles(palette).swipeButtonText}>Edit</ThemedText>
            </Pressable>
          </>
        )}
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles(palette).tabBar}>
      {['chat', 'music', 'tournaments'].map(tab => (
        <Pressable
          key={tab}
          onPress={() => setActiveTab(tab as 'chat' | 'music' | 'tournaments')}
          style={[styles(palette).tabItem, activeTab === tab && styles(palette).tabItemActive]}
        >
          <ThemedText style={[styles(palette).tabItemLabel, activeTab === tab && styles(palette).tabItemLabelActive]}>
            {tab === 'chat' ? 'Chat' : tab === 'music' ? 'Music' : 'Tournaments'}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderChatSection = () => (
    <View style={styles(palette).sectionCard}>
      <View style={styles(palette).sectionHeaderRow}>
        <View>
          <ThemedText style={styles(palette).sectionTitle}>Chats</ThemedText>
          <ThemedText style={styles(palette).sectionSubTitle}>Pick a room to jump into HubRoom</ThemedText>
        </View>
        <Pressable style={styles(palette).createButton} onPress={() => setCreateModalVisible(true)}>
          <MaterialIcons name="add" size={20} color={palette.white} />
        </Pressable>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item.id)} overshootRight={false}>
            <Pressable style={styles(palette).chatCard} onPress={() => handleGroupPress(item)}>
              <View style={{ flex: 1 }}>
                <View style={styles(palette).chatCardHeader}>
                  <ThemedText style={styles(palette).groupName}>{item.name}</ThemedText>
                  {item.creator_id === user?.id && (
                    <View style={styles(palette).creatorBadge}>
                      <ThemedText style={styles(palette).creatorBadgeText}>Owner</ThemedText>
                    </View>
                  )}
                </View>
                {item.description ? (
                  <ThemedText style={styles(palette).groupDescription} numberOfLines={2}>
                    {item.description}
                  </ThemedText>
                ) : (
                  <ThemedText style={styles(palette).groupDescription}>No description provided.</ThemedText>
                )}
              </View>
              <View style={styles(palette).enterPill}>
                <ThemedText style={styles(palette).enterPillText}>Open</ThemedText>
                <MaterialIcons name="arrow-forward" size={16} color={palette.white} />
              </View>
            </Pressable>
          </Swipeable>
        )}
        ListEmptyComponent={
          <View style={styles(palette).emptyState}>
            <IconSymbol name="bubble.left.and.bubble.right.fill" size={48} color={palette.textLight} />
            <ThemedText style={styles(palette).emptyStateText}>No chats yet</ThemedText>
            <ThemedText style={styles(palette).emptyStateSubtext}>Create a chat or wait for an invite.</ThemedText>
          </View>
        }
      />
    </View>
  );

  const renderMusicSection = () => (
    <View style={styles(palette).musicPlayerContainer}>
      <View style={styles(palette).playerHeader}>
        <View>
          <ThemedText style={styles(palette).playerTitle}>
            {spotifyIsConnected ? '🎵 Now Playing' : '🎧 Spotify'}
          </ThemedText>
        </View>
        <Pressable
          style={[styles(palette).connectButton, spotifyIsConnected && { backgroundColor: palette.error }]}
          onPress={spotifyIsConnected ? disconnectSpotify : connectSpotify}
        >
          <MaterialIcons
            name={spotifyIsConnected ? 'logout' : 'login'}
            size={16}
            color={palette.white}
          />
        </Pressable>
      </View>

      {spotifyIsConnected && currentTrack ? (
        <>
          <View style={styles(palette).albumContainer}>
            {currentTrack.item?.album?.images?.[0]?.url ? (
              <Image source={{ uri: currentTrack.item.album.images[0].url }} style={styles(palette).albumImage} />
            ) : (
              <View style={[styles(palette).albumImage, { justifyContent: 'center', alignItems: 'center' }]}>
                <MaterialIcons name="music-note" size={50} color={palette.primary} />
              </View>
            )}
          </View>

          <View style={styles(palette).songInfo}>
            <ThemedText style={styles(palette).songTitle} numberOfLines={2}>
              {currentTrack.item?.name || 'Unknown'}
            </ThemedText>
            <ThemedText style={styles(palette).songArtist} numberOfLines={1}>
              {currentTrack.item?.artists?.[0]?.name || 'Unknown Artist'}
            </ThemedText>
          </View>

          {currentTrack.item && (
            <View style={styles(palette).progressSection}>
              <View style={styles(palette).progressBarBg}>
                <View
                  style={[
                    styles(palette).progressBarFill,
                    { width: `${(currentTrack.progress_ms / (currentTrack.item.duration_ms || 1)) * 100}%` }
                  ]}
                />
              </View>
              <View style={styles(palette).timeRow}>
                <ThemedText style={styles(palette).timeLabel}>{formatTime(currentTrack.progress_ms)}</ThemedText>
                <ThemedText style={styles(palette).timeLabel}>{formatTime(currentTrack.item.duration_ms || 0)}</ThemedText>
              </View>
            </View>
          )}

          <View style={styles(palette).controls}>
            <Pressable style={styles(palette).controlSmall} onPress={() => previousTrack()}>
              <MaterialIcons name="skip-previous" size={26} color={palette.primary} />
            </Pressable>

            <Pressable onPress={() => (isPlaying ? pause() : play())} style={styles(palette).controlLarge}>
              <MaterialIcons
                name={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
                size={60}
                color={palette.primary}
              />
            </Pressable>

            <Pressable style={styles(palette).controlSmall} onPress={() => nextTrack()}>
              <MaterialIcons name="skip-next" size={26} color={palette.primary} />
            </Pressable>
          </View>
        </>
      ) : spotifyIsConnected ? (
        <View style={styles(palette).emptyPlayerState}>
          <MaterialIcons name="music-note" size={48} color={palette.textLight} />
          <ThemedText style={styles(palette).emptyPlayerText}>No track playing</ThemedText>
          <ThemedText style={styles(palette).emptyPlayerSubtext}>Start playing on Spotify</ThemedText>
        </View>
      ) : (
        <View style={styles(palette).emptyPlayerState}>
          <MaterialIcons name="music-note" size={48} color={palette.grey} />
          <ThemedText style={styles(palette).emptyPlayerText}>Not Connected</ThemedText>
          <ThemedText style={styles(palette).emptyPlayerSubtext}>Tap login to connect</ThemedText>
        </View>
      )}
    </View>
  );

  const tournaments = [
    { id: '1', name: 'Winter Scramble', date: 'Jan 12', course: 'Pebble Ridge', status: 'Registration open', spots: 32 },
    { id: '2', name: 'Match Play Ladder', date: 'Feb 5', course: 'Harbor Links', status: 'Qualifiers running', spots: 16 },
    { id: '3', name: 'Spring Classic', date: 'Mar 18', course: 'St. Andrews (sim)', status: 'Opens soon', spots: 48 },
  ];

  const renderTournamentsSection = () => (
    <View style={{ flex: 1 }}>
      <View style={styles(palette).sectionHeaderRow}>
        <View>
          <ThemedText style={styles(palette).sectionTitle}>Tournaments</ThemedText>
          <ThemedText style={styles(palette).sectionSubTitle}>Standalone events in GolfHub</ThemedText>
        </View>
      </View>

      <FlatList
        data={tournaments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => (
          <View style={styles(palette).tournamentCard}>
            <View style={styles(palette).tournamentHeader}>
              <ThemedText style={styles(palette).tournamentName}>{item.name}</ThemedText>
              <ThemedText style={styles(palette).tournamentStatus}>{item.status}</ThemedText>
            </View>
            <ThemedText style={styles(palette).tournamentMeta}>{item.course}</ThemedText>
            <ThemedText style={styles(palette).tournamentMeta}>Starts {item.date} · {item.spots} spots</ThemedText>
            <Pressable style={styles(palette).enterPill} onPress={() => showToast('Tournament flow coming soon')}>
              <ThemedText style={styles(palette).enterPillText}>View</ThemedText>
              <MaterialIcons name="arrow-forward" size={16} color={palette.white} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles(palette).emptyState}>
            <IconSymbol name="trophy.fill" size={48} color={palette.textLight} />
            <ThemedText style={styles(palette).emptyStateText}>No tournaments yet</ThemedText>
            <ThemedText style={styles(palette).emptyStateSubtext}>We will surface events here.</ThemedText>
          </View>
        }
      />
    </View>
  );

  return (
    <ThemedView style={styles(palette).screen}>
      {toast && (
        <View style={styles(palette).toast}>
          <ThemedText style={styles(palette).toastText}>{toast}</ThemedText>
        </View>
      )}

      <View style={styles(palette).header}>
        <View>
          <ThemedText type="title" style={styles(palette).title}>GolfHub</ThemedText>
          <ThemedText style={styles(palette).subtitle}>{groups.length} groups</ThemedText>
        </View>
      </View>

      {renderTabBar()}

      {activeTab === 'chat' && renderChatSection()}
      {activeTab === 'music' && renderMusicSection()}
      {activeTab === 'tournaments' && renderTournamentsSection()}

      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles(palette).modalOverlayCentered}>
          <View style={styles(palette).modalCard}>
            <ThemedText style={styles(palette).modalTitle}>Edit Group</ThemedText>
            <TextInput
              value={editGroupName}
              onChangeText={setEditGroupName}
              style={styles(palette).modalInput}
              placeholder="New group name"
              placeholderTextColor={palette.textLight}
            />
            <TextInput
              value={editGroupDesc}
              onChangeText={setEditGroupDesc}
              style={styles(palette).modalInput}
              placeholder="Description (optional)"
              placeholderTextColor={palette.textLight}
            />
            <View style={{ flexDirection: 'row' }}>
              <Pressable style={[styles(palette).createButton, { marginRight: 8 }]} onPress={saveEditedGroupName}>
                <ThemedText style={styles(palette).createButtonText}>Save</ThemedText>
              </Pressable>
              <Pressable style={styles(palette).leaveButton} onPress={() => setEditModalVisible(false)}>
                <ThemedText style={styles(palette).leaveButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles(palette).modalOverlayCentered}>
          <View style={styles(palette).modalCard}>
            <ThemedText style={styles(palette).modalTitle}>Create New Group</ThemedText>
            <TextInput
              value={modalGroupName}
              onChangeText={setModalGroupName}
              style={styles(palette).modalInput}
              placeholder="Group name"
              placeholderTextColor={palette.textLight}
            />
            <TextInput
              value={modalGroupDesc}
              onChangeText={setModalGroupDesc}
              style={styles(palette).modalInput}
              placeholder="Description (optional)"
              placeholderTextColor={palette.textLight}
            />
            <View style={{ flexDirection: 'row' }}>
              <Pressable style={[styles(palette).createButton, { marginRight: 8 }]} onPress={createGroup}>
                <ThemedText style={styles(palette).createButtonText}>Create</ThemedText>
              </Pressable>
              <Pressable style={styles(palette).leaveButton} onPress={() => setCreateModalVisible(false)}>
                <ThemedText style={styles(palette).leaveButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles(palette).modalOverlayCentered}>
          <View style={styles(palette).modalCard}>
            <ThemedText style={[styles(palette).modalTitle, { color: palette.error }]}>
              {groupToDelete && groups.find(g => g.id === groupToDelete)?.creator_id === user?.id ? 'Delete Group?' : 'Leave Group?'}
            </ThemedText>
            <ThemedText style={styles(palette).modalDescription}>
              {groupToDelete && groups.find(g => g.id === groupToDelete)?.creator_id === user?.id
                ? 'This will permanently delete the group for all members.'
                : 'You will be removed from this group. You can be reinvited to join again.'}
            </ThemedText>
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                style={[styles(palette).leaveButton, { marginRight: 8 }]}
                onPress={handleDeleteOrLeave}
              >
                <ThemedText style={styles(palette).leaveButtonText}>
                  {groupToDelete && groups.find(g => g.id === groupToDelete)?.creator_id === user?.id ? 'Delete' : 'Leave'}
                </ThemedText>
              </Pressable>
              <Pressable style={styles(palette).createButton} onPress={() => setDeleteConfirmVisible(false)}>
                <ThemedText style={styles(palette).createButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles(palette).modalOverlay}>
          <View style={styles(palette).modalContent}>
            <ThemedText style={styles(palette).modalTitle}>Invite Friends</ThemedText>

            <FlatList
              data={friends}
              keyExtractor={(item) => item.friend_id}
              style={{ maxHeight: 300, width: '100%' }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles(palette).friendItem}
                  onPress={() => {
                    if (!inviteGroupId) return;
                    inviteFriend(item.friend_id, inviteGroupId);
                    setInviteModalVisible(false);
                  }}
                >
                  <View style={styles(palette).friendAvatar}>
                    <ThemedText style={styles(palette).friendAvatarText}>
                      {item.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={styles(palette).friendName}>{item.profiles?.full_name || 'Unknown'}</ThemedText>
                    <ThemedText style={styles(palette).friendEmail}>{item.profiles?.email || ''}</ThemedText>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <ThemedText style={styles(palette).emptyStateText}>No friends to invite</ThemedText>
              }
            />

            <Pressable
              style={[styles(palette).modalButton, { backgroundColor: palette.grey, marginTop: 16 }]}
              onPress={() => setInviteModalVisible(false)}
            >
              <ThemedText style={styles(palette).modalButtonText}>Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = (palette: any) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 16,
    paddingBottom: 80,
  },
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 999,
    shadowColor: palette.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  toastText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: palette.primary,
  },
  subtitle: {
    fontSize: 14,
    color: palette.textLight,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 6,
    marginBottom: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabItemActive: {
    backgroundColor: palette.primary,
  },
  tabItemLabel: {
    fontWeight: '700',
    color: palette.textDark,
  },
  tabItemLabelActive: {
    color: palette.white,
  },
  sectionCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 12,
    flex: 1,
    shadowColor: palette.black,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.primary,
  },
  sectionSubTitle: {
    fontSize: 14,
    color: palette.textLight,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  chatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  enterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 12,
    alignSelf: 'center',
    gap: 6,
  },
  enterPillText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 13,
  },
  groupChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: palette.background,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  groupChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  groupChipLabel: {
    color: palette.textDark,
    fontWeight: '600',
  },
  groupChipLabelActive: {
    color: palette.white,
  },
  chatPanel: {
    height: 260,
    borderRadius: 12,
    backgroundColor: palette.background,
    padding: 10,
    marginBottom: 10,
  },
  chatBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: palette.white,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  chatBubbleSelf: {
    backgroundColor: palette.primary,
  },
  chatUser: {
    fontWeight: '700',
    color: palette.textDark,
    marginBottom: 2,
  },
  chatText: {
    color: palette.textDark,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.grey,
    borderRadius: 10,
    padding: 10,
    color: palette.textDark,
    backgroundColor: palette.background,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicPlayerContainer: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 14,
    shadowColor: palette.black,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textDark,
  },
  connectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  albumImage: {
    width: 110,
    height: 110,
    borderRadius: 10,
    backgroundColor: palette.background,
    overflow: 'hidden',
  },
  songInfo: {
    alignItems: 'center',
    marginBottom: 10,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.textDark,
    textAlign: 'center',
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 12,
    color: palette.textLight,
    textAlign: 'center',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: palette.background,
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: palette.primary,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 10,
    color: palette.textLight,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  controlSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLarge: {
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  emptyPlayerState: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyPlayerText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textDark,
    marginTop: 8,
  },
  emptyPlayerSubtext: {
    fontSize: 11,
    color: palette.textLight,
    marginTop: 2,
  },
  tournamentCard: {
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textDark,
  },
  tournamentStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  tournamentMeta: {
    color: palette.textLight,
    fontSize: 13,
    marginBottom: 4,
  },
  groupList: {
    flexGrow: 0,
    marginBottom: 10,
  },
  groupItem: {
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  groupName: {
    fontWeight: '700',
    fontSize: 18,
    color: palette.third,
    flex: 1,
  },
  creatorBadge: {
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  creatorBadgeText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '700',
  },
  groupDescription: {
    fontSize: 14,
    color: palette.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '85%',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  swipeButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 4,
  },
  swipeButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textLight,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: palette.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  leaveButton: {
    backgroundColor: palette.error,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  leaveButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalOverlayCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    backgroundColor: palette.white,
    padding: 24,
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: palette.white,
    padding: 24,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: palette.primary,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 15,
    color: palette.textDark,
    marginBottom: 18,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 12,
    color: palette.textDark,
    backgroundColor: palette.background,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textDark,
  },
  friendEmail: {
    fontSize: 14,
    color: palette.textLight,
  },
});

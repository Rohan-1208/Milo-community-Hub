import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MessageCircle, Users } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-store';
import { userService, communityService, conversationService } from '@/database/service';
import type { User, Community } from '@/types';
import CommunityCard from '@/components/CommunityCard';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        setError(null);
        const dbUser = await userService.getUser(id);
        if (!dbUser) {
          setError('User not found');
          setIsLoading(false);
          return;
        }
        const mapped: User = {
          id: dbUser.id,
          name: (dbUser as any).name || (dbUser as any).username || 'Unknown',
          email: (dbUser as any).email || '',
          avatar: (dbUser as any).avatar || '',
          bio: (dbUser as any).bio || '',
          joinedCommunities: Array.isArray((dbUser as any).joinedCommunities) ? (dbUser as any).joinedCommunities : [],
          createdAt: typeof (dbUser as any).createdAt === 'string' ? (dbUser as any).createdAt : new Date().toISOString(),
        };
        setProfile(mapped);

        const communityIds = mapped.joinedCommunities;
        if (communityIds.length) {
          const list = await Promise.all(
            communityIds.map(async (cid) => {
              const c = await communityService.getCommunity(cid);
              if (!c) return null;
              // Map to app Community type
              const cc: Community = {
                id: c.id,
                name: c.name,
                description: c.description,
                image: c.image,
                category: c.category,
                memberCount: c.memberCount || 0,
                isPrivate: !!c.isPrivate,
                createdBy: c.createdBy,
                createdAt: typeof (c as any).createdAt === 'string' ? (c as any).createdAt : new Date().toISOString(),
                tags: Array.isArray(c.tags) ? c.tags : [],
                location: c.location,
                socialMedia: c.socialMedia as any,
              };
              return cc;
            })
          );
          setJoinedCommunities(list.filter(Boolean) as Community[]);
        } else {
          setJoinedCommunities([]);
        }
      } catch (e) {
        console.error('Failed to load user profile:', e);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  const handleMessage = async () => {
    if (!currentUser?.id || !profile?.id) return;
    if (profile.id === currentUser.id) {
      // No-op: users cannot message themselves
      return;
    }
    try {
      let existing: any | undefined;
      try {
        const convos = await conversationService.getUserConversations(currentUser.id, 50);
        existing = convos.find(c => !c.isGroup && Array.isArray(c.participants) && c.participants.includes(profile.id));
      } catch (listErr) {
        console.warn('Listing conversations failed; proceeding to create:', listErr);
      }
      if (existing) {
        router.push(`/chat/${existing.id}`);
        return;
      }
      const convoId = await conversationService.createConversation({
        participants: [currentUser.id, profile.id],
        isGroup: false,
        createdBy: currentUser.id,
        groupName: undefined,
        groupAvatar: undefined,
        lastMessage: undefined,
        settings: { allowInvites: false, allowMemberMessages: true, muteNotifications: false },
        unreadCount: { [currentUser.id]: 0, [profile.id]: 0 },
      } as any);
      router.push(`/chat/${convoId}`);
    } catch (e) {
      console.error('Could not start conversation:', e);
    }
  };

  const renderCommunity = ({ item }: { item: Community }) => (
    <CommunityCard
      community={item}
      onPress={() => router.push(`/community/${item.id}`)}
      isJoined={true}
    />
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <Text style={{ color: Colors.text }}>Loading…</Text>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <Text style={{ color: Colors.text }}>{error || 'User not found'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={Colors.gradient.secondary} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.profileRow}>
          <Image
            source={{ uri: profile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face' }}
            style={styles.profileAvatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            {profile.bio ? <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text> : null}
          </View>
          {profile.id !== currentUser?.id && (
            <TouchableOpacity style={styles.messageBtn} onPress={handleMessage} activeOpacity={0.85}>
              <LinearGradient colors={Colors.gradient.primary} style={styles.messageGradient}>
                <MessageCircle size={18} color={Colors.white} />
                <Text style={styles.messageText}>Message</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.sectionHeader}>
        <Users size={18} color={Colors.textLight} />
        <Text style={styles.sectionTitle}>Joined Communities ({joinedCommunities.length})</Text>
      </View>

      <FlatList
        data={joinedCommunities}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  bio: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  messageBtn: {
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageGradient: {
    height: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  messageText: {
    color: Colors.white,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
});
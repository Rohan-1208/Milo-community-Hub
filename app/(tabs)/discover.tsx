import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, FlatList } from 'react-native';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Search as SearchIcon, MessageCircle, User as UserIcon } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/hooks/auth-store';
import { userService, conversationService } from '@/database/service';
import type { User } from '@/types';

export default function DiscoverTabScreen() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const t = setTimeout(() => router.replace('/(auth)/auth'), 100);
      return () => clearTimeout(t);
    }
  }, [authLoading, isAuthenticated]);

  // Load a list of users on mount for discovery
  useEffect(() => {
    const loadUsers = async () => {
      if (authLoading || !isAuthenticated) return;
      try {
        setError(null);
        const list = await userService.listUsers(50);
        const mapped = list.map((u: any) => ({
          id: u.id,
          name: u.name || u.username || 'Unknown',
          email: u.email || '',
          avatar: u.avatar || '',
          bio: u.bio || '',
          joinedCommunities: Array.isArray(u.joinedCommunities) ? u.joinedCommunities : [],
          createdAt: typeof u.createdAt === 'string' ? u.createdAt : new Date().toISOString(),
        } as User));
        const filtered = mapped.filter((u) => u.id !== user?.id);
        setAllUsers(filtered);
      } catch (e) {
        console.error('List users failed:', e);
        setError('Failed to load users');
      }
    };
    loadUsers();
  }, [authLoading, isAuthenticated]);

  const runSearch = async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    try {
      setIsSearching(true);
      setError(null);
      const list = await userService.searchUsers(term, 25);
      const mapped = list.map((u: any) => ({
        id: u.id,
        name: u.name || u.username || 'Unknown',
        email: u.email || '',
        avatar: u.avatar || '',
        bio: u.bio || '',
        joinedCommunities: Array.isArray(u.joinedCommunities) ? u.joinedCommunities : [],
        createdAt: typeof u.createdAt === 'string' ? u.createdAt : new Date().toISOString(),
      } as User));
      const filtered = mapped.filter((u) => u.id !== user?.id);
      setResults(filtered);
    } catch (e) {
      console.error('Search users failed:', e);
      setError('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  const startOrOpenConversation = async (targetUserId: string) => {
    if (!user?.id) return;
    if (targetUserId === user.id) {
      setError('You cannot message yourself');
      return;
    }
    try {
      let existing: any | undefined;
      try {
        const convos = await conversationService.getUserConversations(user.id, 50);
        existing = convos.find(c => !c.isGroup && Array.isArray(c.participants) && c.participants.includes(targetUserId));
      } catch (listErr) {
        console.warn('Listing conversations failed; proceeding to create:', listErr);
      }
      if (existing) {
        router.push(`/chat/${existing.id}`);
        return;
      }
      const convoId = await conversationService.createConversation({
        participants: [user.id, targetUserId],
        isGroup: false,
        createdBy: user.id,
        groupName: undefined,
        groupAvatar: undefined,
        lastMessage: undefined,
        settings: { allowInvites: false, allowMemberMessages: true, muteNotifications: false },
        unreadCount: { [user.id]: 0, [targetUserId]: 0 },
      } as any);
      router.push(`/chat/${convoId}`);
    } catch (e) {
      console.error('Failed to start conversation:', e);
      setError('Could not start conversation');
    }
  };

  const onSubmitEditing = () => runSearch(query);

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image
          source={{ uri: item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face' }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.userBio} numberOfLines={1}>{item.bio || '—'}</Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        {item.id !== user?.id && (
          <TouchableOpacity style={styles.action} onPress={() => startOrOpenConversation(item.id)} activeOpacity={0.85}>
            <LinearGradient colors={Colors.gradient.primary} style={styles.actionGradient}>
              <MessageCircle size={18} color={Colors.white} />
              <Text style={styles.actionText}>Message</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.action} onPress={() => router.push(`/user/${item.id}`)} activeOpacity={0.85}>
          <LinearGradient colors={Colors.gradient.secondary} style={styles.actionGradient}>
            <UserIcon size={18} color={Colors.white} />
            <Text style={styles.actionText}>View Profile</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={Colors.gradient.secondary} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchBar}>
          <SearchIcon size={18} color={Colors.white} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search people by name…"
            placeholderTextColor={Colors.textLight}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onSubmitEditing}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <TouchableOpacity onPress={onSubmitEditing} style={styles.searchBtn}>
            <LinearGradient colors={Colors.gradient.primary} style={styles.searchBtnGradient}>
              <Text style={styles.searchBtnText}>Search</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </LinearGradient>

      <FlatList
        data={query.trim() ? results : allUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isSearching && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {query.trim() ? 'No people found' : 'No users yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {query.trim() ? 'Try a different name or keyword' : 'Invite friends or check back later'}
              </Text>
            </View>
          )
        }
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
    marginBottom: 8,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.white,
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  searchBtn: {
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  searchBtnGradient: {
    height: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: Colors.white,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    marginVertical: 6,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  userBio: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  action: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    color: Colors.white,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.white,
    marginTop: 8,
  },
});
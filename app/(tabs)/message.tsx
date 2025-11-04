import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle, Wifi, WifiOff } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { Colors } from '@/constants/colors';
import { useMessages, MessagesProvider } from '@/hooks/messages-store';
import { userService } from '@/database/service';

interface ChatPreview {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isOnline: boolean;
  isOfflineMode: boolean;
}

// Placeholder avatar for conversations without a specific image
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=face';

function MessagesScreenInner() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { conversations, isOfflineMode, setIsOfflineMode, loadConversations, subscribeToConversations } = useMessages();
  const [dmProfiles, setDmProfiles] = useState<Record<string, { name: string; avatar?: string }>>({});

  useEffect(() => {
    // Only navigate after auth loading is complete
    if (!authLoading && !isAuthenticated) {
      // Use a small delay to ensure the layout is mounted
      const timer = setTimeout(() => {
        router.replace('/(auth)/auth');
      }, 100);
      return () => clearTimeout(timer);
    }
    if (!authLoading && isAuthenticated && user?.id) {
      loadConversations(user.id);
      const unsub = subscribeToConversations(user.id);
      return () => unsub();
    }
  }, [isAuthenticated, authLoading]);

  const toggleOfflineMode = () => {
    setIsOfflineMode(!isOfflineMode);
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const chats: ChatPreview[] = useMemo(() => {
    if (!user) return [];
    return conversations.map((c) => {
      const isGroup = !!c.isGroup;
      const profile = !isGroup ? dmProfiles[c.id] : undefined;
      return {
        id: c.id,
        name: isGroup ? (c.groupName || 'Group Chat') : (profile?.name || 'Direct Message'),
        avatar: isGroup ? (c.groupAvatar || DEFAULT_AVATAR) : (profile?.avatar || DEFAULT_AVATAR),
        lastMessage: c.lastMessage?.content || 'No messages yet',
        timestamp: formatTimestamp(c.lastMessage?.createdAt),
        unreadCount: c.unreadCount?.[user.id] ?? 0,
        isOnline: false,
        isOfflineMode,
      } as ChatPreview;
    });
  }, [conversations, user, isOfflineMode, dmProfiles]);

  // Resolve and cache direct message participant profiles for display names/avatars
  useEffect(() => {
    if (!user) return;
    const dms = conversations.filter((c) => !c.isGroup && Array.isArray(c.participants));
    const toFetch = dms.filter((c) => !dmProfiles[c.id]);
    if (!toFetch.length) return;
    (async () => {
      const updates: Record<string, { name: string; avatar?: string }> = {};
      for (const c of toFetch) {
        try {
          const other = c.participants.find((p) => p !== user.id);
          if (!other) continue;
          const u = await userService.getUser(other);
          if (u) {
            updates[c.id] = { name: (u as any).name || (u as any).username || 'Unknown', avatar: (u as any).avatar };
          }
        } catch (e) {
          // Ignore fetch errors; keep fallback
        }
      }
      if (Object.keys(updates).length) {
        setDmProfiles((prev) => ({ ...prev, ...updates }));
      }
    })();
  }, [conversations, user, dmProfiles]);

  const renderChat = ({ item }: { item: ChatPreview }) => (
    <TouchableOpacity style={styles.chatItem} activeOpacity={0.8} onPress={() => router.push(`/chat/${item.id}`)}>
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        {item.isOfflineMode && (
          <View style={styles.offlineBadge}>
            <WifiOff size={12} color={Colors.white} />
          </View>
        )}
        {item.isOnline && !item.isOfflineMode && <View style={styles.onlineDot} />}
      </View>
      
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <LinearGradient
        colors={Colors.gradient.secondary}
        style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>Stay connected with your communities</Text>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.offlineToggle}
              onPress={toggleOfflineMode}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isOfflineMode ? ['#EF4444', '#DC2626'] : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.offlineToggleGradient}
              >
                {isOfflineMode ? (
                  <WifiOff size={20} color={Colors.white} />
                ) : (
                  <Wifi size={20} color={Colors.white} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        
        {isOfflineMode && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color={Colors.white} />
            <Text style={styles.offlineBannerText}>
              Offline Mode Active - Messages will sync when online
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );

  // Loading/auth guards placed AFTER all hooks to keep hook order consistent
  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: Colors.text, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

export default function MessagesScreen() {
  return (
    <MessagesProvider>
      <MessagesScreenInner />
    </MessagesProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    marginBottom: 16,
  },
  headerGradient: {
    padding: 24,
    paddingTop: 40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  offlineToggle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  offlineToggleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  offlineBannerText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  offlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textLight,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
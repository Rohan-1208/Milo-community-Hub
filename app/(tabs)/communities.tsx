import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Search } from 'lucide-react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/hooks/auth-store';
import { useCommunities } from '@/hooks/communities-store';
import { Colors } from '@/constants/colors';
import CommunityCard from '@/components/CommunityCard';
import type { Community } from '@/types';

export default function CommunitiesScreen() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { communities, userCommunities, isLoading, loadUserCommunities, loadCommunities } = useCommunities();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'joined'>('discover');

  useEffect(() => {
    // Only navigate after auth loading is complete
    if (!authLoading && !isAuthenticated) {
      // Use a small delay to ensure the layout is mounted
      const timer = setTimeout(() => {
        router.replace('/(auth)/auth');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading]);

  // Load joined communities once user is authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.id) {
      loadUserCommunities(user.id);
    }
  }, [authLoading, isAuthenticated, user?.id]);

  // Refresh when switching to Joined tab
  useEffect(() => {
    if (activeTab === 'joined' && !authLoading && isAuthenticated && user?.id) {
      loadUserCommunities(user.id);
    }
  }, [activeTab, authLoading, isAuthenticated, user?.id]);

  // Fetch communities immediately when the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (!authLoading && isAuthenticated) {
        loadCommunities();
        if (user?.id) {
          loadUserCommunities(user.id);
        }
      }
      // No cleanup necessary for one-shot loads here
    }, [authLoading, isAuthenticated, user?.id, loadCommunities, loadUserCommunities])
  );

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: Colors.text, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  // Don't render anything if not authenticated (navigation will happen)
  if (!isAuthenticated) {
    return null;
  }

  const filteredCommunities = communities.filter(community => {
    const name = String(community.name || '').toLowerCase();
    const desc = String(community.description || '').toLowerCase();
    const category = String(community.category || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || desc.includes(q) || category.includes(q);
  });

  const displayCommunities = activeTab === 'discover' ? filteredCommunities : userCommunities;

  const handleCommunityPress = (communityId: string) => {
    router.push(`/community/${communityId}`);
  };

  const handleCreateCommunity = () => {
    router.push('/community/create');
  };

  const renderCommunity = ({ item }: { item: Community }) => (
    <CommunityCard
      community={item}
      onPress={() => handleCommunityPress(item.id)}
      isJoined={userCommunities.some(c => c.id === item.id)}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <LinearGradient
        colors={Colors.gradient.accent}
        style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
      >
        <Text style={styles.headerTitle}>Communities</Text>
        <Text style={styles.headerSubtitle}>Discover and join amazing communities</Text>
        
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search communities..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'discover' && styles.activeTab]}
            onPress={() => setActiveTab('discover')}
          >
            <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>
              Discover
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'joined' && styles.activeTab]}
            onPress={() => setActiveTab('joined')}
          >
            <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>
              Joined ({userCommunities.length})
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayCommunities}
        renderItem={renderCommunity}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={() => {
          if (!authLoading && isAuthenticated) {
            loadCommunities();
            if (user?.id) {
              loadUserCommunities(user.id);
            }
          }
        }}
      />
      
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateCommunity}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={Colors.gradient.secondary}
          style={styles.fabGradient}
        >
          <Plus color={Colors.white} size={24} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  listContent: {
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  headerGradient: {
    padding: 24,
    paddingTop: 40,
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
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.white,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  activeTabText: {
    color: Colors.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
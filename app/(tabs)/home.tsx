import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/auth-store';
import { usePosts } from '@/hooks/posts-store';
import { Colors } from '@/constants/colors';
import PostCard from '@/components/PostCard';
import type { Post } from '@/types';

export default function FeedScreen() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { posts, isLoading, toggleLike, deletePost, loadPosts } = usePosts();
  const insets = useSafeAreaInsets();

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

  // Prime feed once authenticated (in case realtime subscription is delayed)
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.id && posts.length === 0) {
      loadPosts().catch(() => {});
    }
  }, [authLoading, isAuthenticated, user?.id]);

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Don't render anything if not authenticated (navigation will happen)
  if (!isAuthenticated) {
    return null;
  }

  const handleLike = (postId: string) => {
    toggleLike(postId);
  };

  const handleComment = (postId: string) => {
    console.log('Comment on post:', postId);
  };

  const handleShare = (postId: string) => {
    console.log('Share post:', postId);
  };

  const handleCreatePost = () => {
    router.push('/modal');
  };

  const handleDelete = (postId: string, ownerId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePost(postId) },
    ]);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onLike={() => handleLike(item.id)}
      onComment={() => handleComment(item.id)}
      onShare={() => handleShare(item.id)}
      canDelete={item.userId === user?.id}
      onDelete={() => handleDelete(item.id, item.userId)}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <LinearGradient
        colors={Colors.gradient.primary}
        style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
      >
        <Text style={styles.headerTitle}>Welcome back, {user?.name?.split(' ')[0]}!</Text>
        <Text style={styles.headerSubtitle}>What&apos;s happening in your communities?</Text>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={loadPosts}
      />
      
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreatePost}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={Colors.gradient.primary}
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '500',
  },
});
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Linking } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';

import { ArrowLeft, Users, MapPin, Tag, Instagram, Twitter, Facebook, Lock, Globe, Pencil } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunities } from '@/hooks/communities-store';
import { useAuth } from '@/hooks/auth-store';
import { Colors } from '@/constants/colors';
import GradientButton from '@/components/GradientButton';
import PostCard from '@/components/PostCard';
import type { Post } from '@/types';
import { postService } from '@/database/service';
import { COLLECTIONS } from '@/database/schema';
import type { Post as DbPost } from '@/database/schema';
import { where, orderBy, limit } from 'firebase/firestore';


export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { communities, userCommunities, requestToJoinCommunity, loadUserCommunities, pendingJoinRequests, loadPendingJoinStatus, subscribeToPendingJoinStatus, subscribeToJoinRequestStatus, communityJoinRequests, loadCommunityJoinRequests, subscribeToCommunityJoinRequests, approveJoinRequest, rejectJoinRequest, updateCommunity } = useCommunities();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [isJoining, setIsJoining] = useState(false);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState<boolean>(true);

  const community = communities.find(c => c.id === id);
  const isJoined = userCommunities.some(c => c.id === id);
  const hasRequestedToJoin = Boolean(pendingJoinRequests[id!]);
  const isAdmin = Boolean(user?.id && community && (community.createdBy === user.id || (community.moderators || []).includes(user.id)));

  // Ensure joined communities are loaded for accurate membership state
  useEffect(() => {
    if (user?.id) {
      loadUserCommunities(user.id);
    }
  }, [user?.id]);

  // Ensure we know if the user has a pending join request for this community
  useEffect(() => {
    if (!id || !user?.id) return;
    // Initial load
    loadPendingJoinStatus(id, user.id);
    // Subscribe to changes in request status (pending/approved)
    const unsub = subscribeToJoinRequestStatus(id, user.id);
    return () => {
      if (unsub) unsub();
    };
  }, [id, user?.id]);

  // Admins: ensure creator is listed as moderator; load + subscribe to requests
  useEffect(() => {
    if (!id || !isAdmin || !community) return;
    // If the current user is the creator but not in moderators, add them
    if (user?.id && community.createdBy === user.id && !(community.moderators || []).includes(user.id)) {
      // Best-effort update; ignore errors
      updateCommunity(community.id, { moderators: [...(community.moderators || []), user.id] }).catch(() => {});
    }
    loadCommunityJoinRequests(id);
    const unsub = subscribeToCommunityJoinRequests(id);
    return () => {
      if (unsub) unsub();
    };
  }, [id, isAdmin, community?.id, community?.moderators, community?.createdBy, user?.id]);

  // Subscribe to latest posts from this community
  useEffect(() => {
    if (!id) return;
    setIsLoadingPosts(true);

    // Avoid Firestore composite index requirements by not ordering here;
    // we'll sort client-side by createdAt desc.
    const constraints = [
      where('communityId', '==', id as string),
      where('status', '==', 'published'),
      limit(20),
    ];

    const unsubscribe = postService.subscribeToCollection<DbPost>(
      COLLECTIONS.POSTS,
      constraints,
      (dbPosts) => {
        const mapped: Post[] = dbPosts.map((p: any) => {
          const createdAt = p?.createdAt && typeof p.createdAt?.toDate === 'function'
            ? p.createdAt.toDate().toISOString()
            : (typeof p?.createdAt === 'string' ? p.createdAt : new Date().toISOString());

          const likesArray = Array.isArray(p?.likes) ? p.likes : [];

          return {
            id: p.id,
            userId: p.userId,
            userName: p.userName,
            userAvatar: p.userAvatar,
            communityId: p.communityId,
            communityName: p.communityName,
            content: p.content,
            images: Array.isArray(p.images) ? p.images : [],
            likes: likesArray.length,
            comments: typeof p.commentsCount === 'number' ? p.commentsCount : 0,
            createdAt,
            isLiked: !!(user?.id && likesArray.includes(user.id)),
          } as Post;
        }).sort((a: Post, b: Post) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setRecentPosts(mapped);
        setIsLoadingPosts(false);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [id, user?.id]);

  if (!community) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Community not found</Text>
      </View>
    );
  }

  const handleJoinCommunity = async () => {
    if (!user || isJoined || hasRequestedToJoin) return;

    setIsJoining(true);
    try {
      const result = await requestToJoinCommunity(community.id, user.id, user.name);
      if (result === 'joined') {
        Alert.alert('Success', 'You have joined the community!');
      } else if (result === 'requested') {
        Alert.alert('Request Sent', 'Your join request has been sent to the community admin.');
      }
    } catch {
      Alert.alert('Error', 'Failed to join community. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSocialMediaPress = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open link');
    });
  };

  const renderSocialMedia = () => {
    if (!community.socialMedia) return null;

    return (
      <View style={styles.socialSection}>
        <Text style={styles.sectionTitle}>Social Media</Text>
        <View style={styles.socialLinks}>
          {community.socialMedia.instagram && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialMediaPress(`https://instagram.com/${community.socialMedia!.instagram!.replace('@', '')}`)}
            >
              <Instagram size={20} color={Colors.primary} />
              <Text style={styles.socialText}>{community.socialMedia.instagram}</Text>
            </TouchableOpacity>
          )}
          {community.socialMedia.twitter && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialMediaPress(`https://twitter.com/${community.socialMedia!.twitter!.replace('@', '')}`)}
            >
              <Twitter size={20} color={Colors.secondary} />
              <Text style={styles.socialText}>{community.socialMedia.twitter}</Text>
            </TouchableOpacity>
          )}
          {community.socialMedia.facebook && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialMediaPress(`https://facebook.com/${community.socialMedia!.facebook}`)}
            >
              <Facebook size={20} color={Colors.secondary} />
              <Text style={styles.socialText}>{community.socialMedia.facebook}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const formatRequestDate = (val: any) => {
    try {
      if (!val) return '';
      if (typeof val === 'string') return new Date(val).toLocaleDateString();
      if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000).toLocaleDateString();
      return '';
    } catch {
      return '';
    }
  };

  const renderJoinButton = () => {
    // Owners and moderators see an Edit button styled like the join CTA
    if (isAdmin) {
      return (
        <GradientButton
          title={'Edit Community'}
          onPress={() => router.push(`/community/${community.id}/edit`)}
          colors={Colors.gradient.primary}
          style={styles.joinButton}
        />
      );
    }

    if (isJoined) {
      // Joined state: show a disabled green button
      return (
        <GradientButton
          title={'Joined'}
          onPress={() => {}}
          disabled
          dimWhenDisabled={false}
          colors={Colors.gradient.success}
          style={styles.joinButton}
        />
      );
    }

    if (hasRequestedToJoin) {
      // Requested state: show a disabled yellow button
      return (
        <GradientButton
          title={'Requested'}
          onPress={() => {}}
          disabled
          dimWhenDisabled={false}
          colors={Colors.gradient.accent}
          style={styles.joinButton}
        />
      );
    }

    return (
      <GradientButton
        title={isJoining ? 'Joining...' : `Join ${community.isPrivate ? '(Request)' : 'Community'}`}
        onPress={handleJoinCommunity}
        disabled={isJoining}
        colors={Colors.gradient.primary}
        style={styles.joinButton}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community</Text>
        {(user?.id && (community.createdBy === user.id || (community.moderators || []).includes(user.id))) ? (
          <TouchableOpacity onPress={() => router.push(`/community/${community.id}/edit`)} style={styles.editButton}>
            <Pencil size={20} color={Colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {community.image && (
          <Image source={{ uri: community.image }} style={styles.coverImage} />
        )}
        
        <View style={styles.communityInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.communityName}>{community.name}</Text>
            {community.isPrivate ? (
              <Lock size={20} color={Colors.textSecondary} />
            ) : (
              <Globe size={20} color={Colors.success} />
            )}
          </View>
          
          <Text style={styles.description}>{community.description}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Users size={16} color={Colors.textSecondary} />
              <Text style={styles.statText}>{community.memberCount} members</Text>
            </View>
            
            {community.location && (
              <View style={styles.stat}>
                <MapPin size={16} color={Colors.textSecondary} />
                <Text style={styles.statText}>{community.location}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Tag size={14} color={Colors.primary} />
              <Text style={styles.categoryText}>{community.category}</Text>
            </View>
          </View>
          
          {community.tags.length > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsContainer}>
                {community.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          {renderSocialMedia()}
          {isAdmin && (
            <View style={styles.requestsSection}>
              <Text style={styles.sectionTitle}>Join Requests</Text>
              {Array.isArray(communityJoinRequests[id!]) && communityJoinRequests[id!].length > 0 ? (
                communityJoinRequests[id!].map((req) => (
                  <View key={req.id} style={styles.requestCard}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestUser}>{req.userName}</Text>
                      <Text style={styles.requestMeta}>Requested on {formatRequestDate(req.createdAt)}</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.requestButton, styles.approveButton]}
                        onPress={() => approveJoinRequest(req.id, user!.id)}
                      >
                        <Text style={styles.approveText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.requestButton, styles.rejectButton]}
                        onPress={() => rejectJoinRequest(req.id, user!.id)}
                      >
                        <Text style={styles.rejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noRequests}>
                  <Text style={styles.noRequestsText}>No pending requests</Text>
                </View>
              )}
            </View>
          )}
          
          <View style={styles.recentPostsSection}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {isLoadingPosts ? (
              <View style={styles.placeholderPosts}>
                <Text style={styles.loadingText}>Loading latest posts…</Text>
              </View>
            ) : recentPosts.length > 0 ? (
              <View style={styles.postList}>
                {recentPosts.map((post) => (
                  <View key={post.id} style={styles.postWrapper}>
                    <PostCard
                      post={post}
                      onLike={async () => {
                        // Optimistic like toggle
                        setRecentPosts(prev => prev.map(p => p.id === post.id ? {
                          ...p,
                          isLiked: !p.isLiked,
                          likes: p.isLiked ? p.likes - 1 : p.likes + 1,
                        } : p));
                        if (user?.id) {
                          try { await postService.likePost(post.id, user.id); } catch {}
                        }
                      }}
                      onComment={() => { /* reserved for future comment UI */ }}
                      onShare={() => { /* reserved for future share UI */ }}
                      canDelete={post.userId === user?.id}
                      onDelete={undefined}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.placeholderPosts}>
                <Text style={styles.placeholderText}>No posts yet. Be the first to share!</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.bottomSection}>
        {renderJoinButton()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  placeholder: {
    width: 40,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  coverImage: {
    width: '100%',
    height: 200,
  },
  communityInfo: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  communityName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  categoryRow: {
    marginBottom: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  tagsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  socialSection: {
    marginBottom: 24,
  },
  socialLinks: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  socialText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  recentPostsSection: {
    marginBottom: 20,
  },
  requestsSection: {
    marginBottom: 24,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestUser: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  requestMeta: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  approveButton: {
    borderColor: Colors.success,
    backgroundColor: `${Colors.success}15`,
  },
  rejectButton: {
    borderColor: Colors.error,
    backgroundColor: `${Colors.error}15`,
  },
  approveText: {
    color: Colors.success,
    fontWeight: '600',
  },
  rejectText: {
    color: Colors.error,
    fontWeight: '600',
  },
  noRequests: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  noRequestsText: {
    color: Colors.textLight,
    fontSize: 14,
  },
  placeholderPosts: {
    padding: 20,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  postList: {
    gap: 12,
  },
  postWrapper: {
    marginBottom: 12,
  },
  bottomSection: {
    padding: 20,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  joinButton: {
    marginBottom: 0,
  },
  joinedContainer: {
    backgroundColor: Colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinedText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  pendingContainer: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  pendingText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginTop: 50,
  },
});
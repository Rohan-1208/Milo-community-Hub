import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Edit3, Users, MessageSquare, Heart, LogOut, User as UserIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { useCommunities } from '@/hooks/communities-store';
import { Colors } from '@/constants/colors';
import GradientButton from '@/components/GradientButton';
import { postService } from '@/database/service';
import type { Post as DbPost } from '@/database/schema';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { storage } from '../../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function ProfileScreen() {
  const { user, isAuthenticated, logout, isLoading: authLoading, authInProgress, updateProfile } = useAuth();
  const { userCommunities } = useCommunities();
  const insets = useSafeAreaInsets();
  const [postsCount, setPostsCount] = useState<number>(0);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    // Only navigate after auth loading is complete and not in-progress
    if (!authLoading && !isAuthenticated && !authInProgress) {
      // Use a small delay to ensure the layout is mounted
      const timer = setTimeout(() => {
        router.replace('/(auth)/auth');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading, authInProgress]);

  // Load real stats for posts and likes received
  useEffect(() => {
    const loadStats = async () => {
      if (!user?.id) return;
      try {
        // Fetch up to 100 recent posts by the user and compute counts
        const posts = await postService.getUserPosts(user.id, 100);
        const count = posts.length;
        const likes = posts.reduce((sum: number, p: any) => {
          const arr = Array.isArray(p?.likes) ? p.likes : [];
          return sum + arr.length;
        }, 0);
        setPostsCount(count);
        setLikesCount(likes);
      } catch (e) {
        // Keep defaults on error
        setPostsCount(0);
        setLikesCount(0);
      }
    };
    loadStats();
  }, [user?.id]);

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 18, color: Colors.text, fontWeight: '500' }}>Loading...</Text>
      </View>
    );
  }

  // Don't render anything if not authenticated (navigation will happen)
  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/auth');
  };

  const handleEditProfile = () => {
    // TODO: Navigate to edit profile screen
    console.log('Edit profile');
  };

  const handleChangeAvatar = async () => {
    if (!user?.id) return;
    try {
      // Ask media permissions on native; web does not require
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'Please allow photo library access to change your avatar.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setUploadingAvatar(true);
      // Compress and resize to speed up upload
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const res = await fetch(manipulated.uri);
      const blob = await res.blob();
      const path = `avatars/${user.id}/${Date.now()}.jpg`;
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

      const url: string = await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snap) => {
            if (snap.totalBytes) setUploadProgress(snap.bytesTransferred / snap.totalBytes);
          },
          (err) => reject(err),
          async () => {
            try {
              const doneUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(doneUrl);
            } catch (e) {
              reject(e);
            }
          }
        );
      });

      await updateProfile({ avatar: url });
    } catch (err) {
      console.error('Avatar upload error:', err);
      Alert.alert('Upload Error', 'Could not upload your photo. Please try again.');
    } finally {
      setUploadingAvatar(false);
      setUploadProgress(0);
    }
  };

  const stats = useMemo(() => ([
    { label: 'Communities', value: userCommunities.length, icon: Users },
    { label: 'Posts', value: postsCount, icon: MessageSquare },
    { label: 'Likes', value: likesCount, icon: Heart },
  ]), [userCommunities.length, postsCount, likesCount]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <LinearGradient
            colors={Colors.gradient.primary}
            style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}
          >
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.settingsButton}>
                <Settings size={24} color={Colors.white} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                {user.avatar ? (
                  <Image 
                    source={{ uri: user.avatar }} 
                    style={styles.avatar} 
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <UserIcon size={40} color={Colors.white} />
                  </View>
                )}
                <TouchableOpacity style={[styles.editAvatarButton, uploadingAvatar && { opacity: 0.7 }]} onPress={handleChangeAvatar} disabled={uploadingAvatar}>
                  {uploadingAvatar ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ActivityIndicator size="small" color={Colors.white} />
                      <Text style={{ color: Colors.white, fontSize: 12 }}>{Math.round(uploadProgress * 100)}%</Text>
                    </View>
                  ) : (
                    <Edit3 size={16} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
              
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.bio && <Text style={styles.userBio}>{user.bio}</Text>}
            </View>
          </LinearGradient>
        </View>

        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.1)', 'rgba(236, 72, 153, 0.1)']}
                style={styles.statGradient}
              >
                <stat.icon size={24} color={Colors.primary} />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </LinearGradient>
            </View>
          ))}
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Communities</Text>
            {userCommunities.length > 0 ? (
              <View style={styles.communitiesList}>
                {userCommunities.slice(0, 3).map((community) => (
                  <View key={community.id} style={styles.communityItem}>
                    <Image source={{ uri: community.image }} style={styles.communityImage} />
                    <View style={styles.communityInfo}>
                      <Text style={styles.communityName}>{community.name}</Text>
                      <Text style={styles.communityMembers}>{community.memberCount} members</Text>
                    </View>
                  </View>
                ))}
                {userCommunities.length > 3 && (
                  <TouchableOpacity style={styles.viewAllButton}>
                    <Text style={styles.viewAllText}>View all {userCommunities.length} communities</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Users size={48} color={Colors.textLight} />
                <Text style={styles.emptyStateText}>No communities joined yet</Text>
                <Text style={styles.emptyStateSubtext}>Discover and join communities to get started</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <GradientButton
              title="Edit Profile"
              onPress={handleEditProfile}
              style={styles.actionButton}
            />
            
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <LogOut size={20} color={Colors.error} />
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    marginBottom: 20,
  },
  headerGradient: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: Colors.white,
  },
  avatarFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  userBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  statItem: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  communitiesList: {
    gap: 12,
  },
  communityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  communityImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  communityMembers: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
  },
  actions: {
    gap: 16,
    paddingBottom: 40,
  },
  actionButton: {
    marginHorizontal: 0,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '600',
  },
});
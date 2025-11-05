import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import type { Post } from '@/types';
import { postService } from '@/database/service';
import type { Post as DbPost } from '@/database/schema';
import { COLLECTIONS } from '@/database/schema';
import { useAuth } from '@/hooks/auth-store';
import { Timestamp, where, orderBy, limit } from 'firebase/firestore';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Alert } from 'react-native';

// Removed mockPosts: feed will load exclusively from Firestore

export const [PostsProvider, usePosts] = createContextHook(() => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Removed cache prefill: feed renders only from Firestore

  // Real-time subscription to Firestore feed
  useEffect(() => {
    // Gate realtime feed behind auth; avoid listeners while logged out
    if (!user?.id) {
      setPosts([]);
      setIsLoading(false);
      return; // no subscription when unauthenticated
    }

    const constraints = [
      orderBy('createdAt', 'desc'),
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
        });

        setPosts(mapped);
        AsyncStorage.setItem('posts', JSON.stringify(mapped)).catch(() => {});
        setIsLoading(false);
      },
      (error) => {
        console.error('Realtime feed subscription error:', error);
        setPosts([]);
        setIsLoading(false);
      }
    );

    return () => {
      try { unsubscribe?.(); } catch {}
    };
  }, [user?.id]);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const dbPosts = await postService.getFeedPosts(user?.id || '', 20);
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
      });

      setPosts(mapped);
      await AsyncStorage.setItem('posts', JSON.stringify(mapped));
    } catch (error) {
      console.error('Error loading posts from Firestore:', error);
      // Do not use cache or mock; show empty feed on error
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createPost = async (postData: Omit<Post, 'id' | 'likes' | 'comments' | 'createdAt' | 'isLiked'>) => {
    // Upload local images to Firebase Storage so they are visible to all users
    let uploadedImages: string[] = [];
    try {
      const uid = postData.userId || 'anonymous';
      const toUpload = Array.isArray(postData.images) ? postData.images : [];
      const results: string[] = [];
      for (let i = 0; i < toUpload.length; i++) {
        const uri = toUpload[i];
        // Only upload non-remote URIs (blob:, file:, data:)
        if (uri && !/^https?:\/\//i.test(uri)) {
          const response = await fetch(uri);
          const blob = await response.blob();
          const filename = `posts/${uid}/${Date.now()}_${i}.jpg`;
          const storageRef = ref(storage, filename);
          await uploadBytes(storageRef, blob);
          const url = await getDownloadURL(storageRef);
          results.push(url);
        } else if (uri) {
          results.push(uri);
        }
      }
      uploadedImages = results;
    } catch (e) {
      console.error('Image upload failed; proceeding without images', e);
      uploadedImages = [];
    }

    const newPost: Post = {
      ...postData,
      images: uploadedImages,
      id: Date.now().toString(),
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
      isLiked: false,
    };

    const updatedPosts = [newPost, ...posts];
    setPosts(updatedPosts);
    await AsyncStorage.setItem('posts', JSON.stringify(updatedPosts));

    try {
      const firestoreData: Omit<DbPost, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: postData.userId,
        userName: postData.userName,
        userAvatar: postData.userAvatar,
        communityId: postData.communityId,
        communityName: postData.communityName,
        content: postData.content,
        images: uploadedImages,
        attachments: [],
        tags: [],
        mentions: [],
        isPinned: false,
        isAnnouncement: false,
        isEdited: false,
        likes: [],
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        visibility: postData.communityId ? 'community' : 'public',
        status: 'published',
        moderation: { isFlagged: false },
      };

      // Persist to Firestore and update local placeholder id to actual doc id
      const createdId = await postService.createPost(firestoreData);
      const reconciled = updatedPosts.map(p => p.id === newPost.id ? { ...p, id: createdId } : p);
      setPosts(reconciled);
      await AsyncStorage.setItem('posts', JSON.stringify(reconciled));
    } catch (err) {
      console.error('Error persisting post to Firestore:', err);
    }

    return newPost;
  };

  const toggleLike = async (postId: string) => {
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
        };
      }
      return post;
    });
    
    setPosts(updatedPosts);
    await AsyncStorage.setItem('posts', JSON.stringify(updatedPosts));
  };

  const deletePost = async (postId: string) => {
    const target = posts.find(p => p.id === postId);
    if (!target) return;
    if (!user?.id || target.userId !== user.id) {
      // Guard: only allow deleting own posts from UI
      Alert.alert('Not allowed', 'You can only delete your own posts.');
      return;
    }

    const prev = posts;
    const next = posts.filter(p => p.id !== postId);
    setPosts(next);
    await AsyncStorage.setItem('posts', JSON.stringify(next));

    try {
      await postService.deletePost(postId);
    } catch (err) {
      console.error('Error deleting post:', err);
      // revert local change on error
      setPosts(prev);
      await AsyncStorage.setItem('posts', JSON.stringify(prev));
      Alert.alert('Error', 'Failed to delete post.');
    }
  };

  return {
    posts,
    isLoading,
    loadPosts,
    createPost,
    toggleLike,
    deletePost,
  };
});
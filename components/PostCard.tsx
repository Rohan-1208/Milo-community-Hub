import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Heart, MessageCircle, Share, Trash } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

export default function PostCard({ post, onLike, onComment, onShare, onDelete, canDelete = false }: PostCardProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={{ uri: post.userAvatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' }} 
          style={styles.avatar} 
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{post.userName}</Text>
          <View style={styles.metaInfo}>
            {post.communityName && (
              <Text style={styles.communityName}>in {post.communityName}</Text>
            )}
            <Text style={styles.time}>{formatTime(post.createdAt)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.content}>{post.content}</Text>

      {post.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
          {post.images.map((image, index) => (
            <Image key={index} source={{ uri: image }} style={styles.postImage} />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <TouchableOpacity onPress={onLike} style={styles.actionButton}>
          <Heart 
            size={20} 
            color={post.isLiked ? Colors.error : Colors.textSecondary}
            fill={post.isLiked ? Colors.error : 'none'}
          />
          <Text style={[styles.actionText, post.isLiked && { color: Colors.error }]}>
            {post.likes}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onComment} style={styles.actionButton}>
          <MessageCircle size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onShare} style={styles.actionButton}>
          <Share size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {canDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
            <Trash size={20} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  communityName: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  time: {
    fontSize: 12,
    color: Colors.textLight,
  },
  content: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  imagesContainer: {
    marginBottom: 12,
  },
  postImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
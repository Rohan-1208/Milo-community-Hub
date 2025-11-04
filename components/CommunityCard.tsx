import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Users, Tag } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Community } from '@/types';

interface CommunityCardProps {
  community: Community;
  onPress: () => void;
  isJoined?: boolean;
}

export default function CommunityCard({ community, onPress, isJoined = false }: CommunityCardProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.8}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.1)', 'rgba(236, 72, 153, 0.1)']}
        style={styles.gradient}
      >
        {community.image && (
          <Image source={{ uri: community.image }} style={styles.image} />
        )}
        
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>{community.name}</Text>
            {isJoined && (
              <View style={styles.joinedBadge}>
                <Text style={styles.joinedText}>Joined</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.description} numberOfLines={2}>
            {community.description}
          </Text>
          
          <View style={styles.footer}>
            <View style={styles.memberCount}>
              <Users size={16} color={Colors.textSecondary} />
              <Text style={styles.memberText}>{community.memberCount}</Text>
            </View>
            
            <View style={styles.category}>
              <Tag size={14} color={Colors.primary} />
              <Text style={styles.categoryText}>{community.category}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
  },
  image: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  joinedBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  joinedText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
});
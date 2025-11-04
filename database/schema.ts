// Firestore Database Schema for Milo Community Hub

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  socialMedia?: {
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
  joinedCommunities: string[];
  followers: string[];
  following: string[];
  isVerified: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeen: string;
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      communityUpdates: boolean;
      messages: boolean;
    };
    privacy: {
      showEmail: boolean;
      showLocation: boolean;
      showLastSeen: boolean;
    };
  };
  stats: {
    postsCount: number;
    communitiesCount: number;
    followersCount: number;
    followingCount: number;
  };
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  image?: string;
  banner?: string;
  category: string;
  tags: string[];
  location?: string;
  isPrivate: boolean;
  isVerified: boolean;
  memberCount: number;
  createdBy: string;
  moderators: string[];
  rules: string[];
  settings: {
    allowPosts: boolean;
    allowImages: boolean;
    allowLinks: boolean;
    requireApproval: boolean;
    allowMemberInvites: boolean;
  };
  createdAt: string;
  updatedAt: string;
  lastActivity: string;
  socialMedia?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    discord?: string;
  };
  stats: {
    postsCount: number;
    membersCount: number;
    viewsCount: number;
  };
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  communityId?: string;
  communityName?: string;
  content: string;
  images: string[];
  attachments: {
    type: 'image' | 'video' | 'document' | 'link';
    url: string;
    metadata?: any;
  }[];
  tags: string[];
  mentions: string[];
  isPinned: boolean;
  isAnnouncement: boolean;
  isEdited: boolean;
  editedAt?: string;
  likes: string[];
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  visibility: 'public' | 'community' | 'followers' | 'private';
  status: 'published' | 'draft' | 'archived' | 'deleted';
  moderation: {
    isFlagged: boolean;
    flaggedBy?: string[];
    flaggedReason?: string;
    moderatedBy?: string;
    moderatedAt?: string;
  };
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  parentId?: string; // For nested comments
  likes: string[];
  repliesCount: number;
  isEdited: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
  status: 'published' | 'deleted' | 'hidden';
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: {
    type: 'image' | 'video' | 'document' | 'audio';
    url: string;
    name?: string;
    size?: number;
  }[];
  isRead: boolean;
  readAt?: string;
  isDelivered: boolean;
  deliveredAt?: string;
  isEdited: boolean;
  editedAt?: string;
  replyTo?: string;
  createdAt: string;
  updatedAt: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  settings: {
    allowInvites: boolean;
    allowMemberMessages: boolean;
    muteNotifications: boolean;
  };
  unreadCount: { [userId: string]: number };
}

export interface JoinRequest {
  id: string;
  communityId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'join_request' | 'message' | 'community_update' | 'system';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  actionUrl?: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId?: string;
  reportedPostId?: string;
  reportedCommunityId?: string;
  reportedCommentId?: string;
  reason: 'spam' | 'harassment' | 'inappropriate_content' | 'fake_account' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  COMMUNITIES: 'communities',
  POSTS: 'posts',
  COMMENTS: 'comments',
  MESSAGES: 'messages',
  CONVERSATIONS: 'conversations',
  JOIN_REQUESTS: 'joinRequests',
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
} as const;

// Indexes for better query performance
export const INDEXES = {
  POSTS_BY_COMMUNITY: 'communityId',
  POSTS_BY_USER: 'userId',
  POSTS_BY_CREATED_AT: 'createdAt',
  COMMENTS_BY_POST: 'postId',
  MESSAGES_BY_CONVERSATION: 'conversationId',
  NOTIFICATIONS_BY_USER: 'userId',
} as const;

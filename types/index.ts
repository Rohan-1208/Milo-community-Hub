export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  joinedCommunities: string[];
  createdAt: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  image?: string;
  category: string;
  memberCount: number;
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  tags: string[];
  location?: string;
  socialMedia?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
  };
  joinRequests?: JoinRequest[];
}

export interface JoinRequest {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  communityId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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
  likes: number;
  comments: number;
  createdAt: string;
  isLiked: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isOffline: boolean;
  createdAt: string;
  delivered: boolean;
}

export interface Announcement {
  id: string;
  communityId: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  isPinned: boolean;
}
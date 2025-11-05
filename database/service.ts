import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  QueryConstraint,
  documentId,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from './schema';
import type {
  User,
  Community,
  Post,
  Comment,
  Message,
  Conversation,
  JoinRequest,
  Notification,
  Report,
} from './schema';

// Utility: remove undefined fields to satisfy Firestore constraints
function pruneUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) out[key] = val;
  }
  return out as T;
}

// Base database service class
class DatabaseService {
  // Generic CRUD operations
  async create<T>(
    collectionName: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const clean = pruneUndefined(data as any);
      const docRef = await addDoc(collection(db, collectionName), {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  async getById<T>(collectionName: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  }

  async update<T>(collectionName: string, id: string, data: Partial<T>): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      const clean = pruneUndefined(data as any);
      await updateDoc(docRef, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  }

  async delete(collectionName: string, id: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  }

  async query<T>(
    collectionName: string,
    constraints: QueryConstraint[]
  ): Promise<T[]> {
    try {
      const q = query(collection(db, collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error querying ${collectionName}:`, error);
      throw error;
    }
  }

  // Real-time listeners
  subscribeToDocument<T>(
    collectionName: string,
    id: string,
    callback: (data: T | null) => void
  ): () => void {
    const docRef = doc(db, collectionName, id);
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as T);
      } else {
        callback(null);
      }
    });
  }

  subscribeToCollection<T>(
    collectionName: string,
    constraints: QueryConstraint[],
    callback: (data: T[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const q = query(collection(db, collectionName), ...constraints);
    return onSnapshot(
      q,
      (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        callback(data);
      },
      (error) => {
        console.error(`Realtime query error on ${collectionName}:`, error);
        try {
          onError?.(error);
        } catch {}
      }
    );
  }
}

// User service
export class UserService extends DatabaseService {
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<User>(COLLECTIONS.USERS, userData);
  }

  async getUser(userId: string): Promise<User | null> {
    return this.getById<User>(COLLECTIONS.USERS, userId);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    return this.update<User>(COLLECTIONS.USERS, userId, updates);
  }

  async searchUsers(searchTerm: string, limitCount: number = 20): Promise<User[]> {
    return this.query<User>(COLLECTIONS.USERS, [
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff'),
      orderBy('name', 'asc'),
      limit(limitCount)
    ]);
  }

  async listUsers(limitCount: number = 50): Promise<User[]> {
    // List users ordered by creation time or name as a fallback
    try {
      // Try ordering by createdAt desc; if mixed types, Firestore may still sort
      return await this.query<User>(COLLECTIONS.USERS, [
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      ]);
    } catch (e) {
      // Fallback: order by name ascending
      return this.query<User>(COLLECTIONS.USERS, [
        orderBy('name', 'asc'),
        limit(limitCount)
      ]);
    }
  }

  async getUserFollowers(userId: string): Promise<User[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    const ids = Array.isArray(user.followers) ? user.followers : [];
    if (!ids.length) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }
    const results: User[] = [];
    for (const c of chunks) {
      const res = await this.query<User>(COLLECTIONS.USERS, [
        where(documentId(), 'in', c)
      ]);
      results.push(...res);
    }
    return results;
  }

  async getUserFollowing(userId: string): Promise<User[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    const ids = Array.isArray(user.following) ? user.following : [];
    if (!ids.length) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }
    const results: User[] = [];
    for (const c of chunks) {
      const res = await this.query<User>(COLLECTIONS.USERS, [
        where(documentId(), 'in', c)
      ]);
      results.push(...res);
    }
    return results;
  }
}

// Community service
export class CommunityService extends DatabaseService {
  async createCommunity(communityData: Omit<Community, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<Community>(COLLECTIONS.COMMUNITIES, communityData);
  }

  async getCommunity(communityId: string): Promise<Community | null> {
    return this.getById<Community>(COLLECTIONS.COMMUNITIES, communityId);
  }

  async updateCommunity(communityId: string, updates: Partial<Community>): Promise<void> {
    // Update the community document first
    await this.update<Community>(COLLECTIONS.COMMUNITIES, communityId, updates);

    // If the community name changed, propagate to related posts' communityName field
    if (typeof updates.name === 'string' && updates.name.trim().length > 0) {
      const newName = updates.name.trim();
      const PAGE_SIZE = 500;
      let lastCreatedAt: any | undefined = undefined;

      while (true) {
        // Page through community posts ordered by createdAt to avoid reprocessing the same docs
        const constraints: QueryConstraint[] = [
          where('communityId', '==', communityId),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE),
        ];
        if (lastCreatedAt) {
          constraints.push(startAfter(lastCreatedAt));
        }

        const posts = await this.query<Post>(COLLECTIONS.POSTS, constraints);
        if (!posts.length) break;

        const batch = writeBatch(db);
        for (const p of posts) {
          const postRef = doc(db, COLLECTIONS.POSTS, (p as any).id);
          batch.update(postRef, {
            communityName: newName,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();

        // Prepare for next page
        const last = posts[posts.length - 1] as any;
        lastCreatedAt = last?.createdAt;
      }
    }
  }

  async searchCommunities(searchTerm: string, category?: string, limitCount: number = 20): Promise<Community[]> {
    const constraints: QueryConstraint[] = [
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff'),
      limit(limitCount)
    ];

    if (category) {
      constraints.unshift(where('category', '==', category));
    }

    return this.query<Community>(COLLECTIONS.COMMUNITIES, constraints);
  }

  async getPopularCommunities(limitCount: number = 10): Promise<Community[]> {
    return this.query<Community>(COLLECTIONS.COMMUNITIES, [
      orderBy('stats.membersCount', 'desc'),
      limit(limitCount)
    ]);
  }

  async getUserCommunities(userId: string): Promise<Community[]> {
    // Fetch the user's joined community IDs
    const user = await userService.getUser(userId);
    const joinedIds = Array.isArray(user?.joinedCommunities) ? user!.joinedCommunities : [];

    if (!joinedIds.length) return [];

    // Firestore 'in' operator supports up to 10 IDs per query; chunk if needed
    const chunks: string[][] = [];
    for (let i = 0; i < joinedIds.length; i += 10) {
      chunks.push(joinedIds.slice(i, i + 10));
    }

    const results: Community[] = [];
    for (const chunk of chunks) {
      const res = await this.query<Community>(COLLECTIONS.COMMUNITIES, [
        where(documentId(), 'in', chunk)
      ]);
      results.push(...res);
    }

    return results;
  }

  // FIX: use UserService for user record and guard arrays
  async joinCommunity(communityId: string, userId: string): Promise<void> {
    const batch = writeBatch(db);

    const communityRef = doc(db, COLLECTIONS.COMMUNITIES, communityId);
    const userRef = doc(db, COLLECTIONS.USERS, userId);

    const community = await this.getCommunity(communityId);
    const user = await userService.getUser(userId);

    if (community) {
      batch.update(communityRef, {
        memberCount: (community.memberCount || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }

    if (user) {
      const nextJoined = Array.isArray(user.joinedCommunities)
        ? [...new Set([...user.joinedCommunities, communityId])]
        : [communityId];
      batch.update(userRef, {
        joinedCommunities: nextJoined,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  // FIX: use UserService for user record and guard arrays
  async leaveCommunity(communityId: string, userId: string): Promise<void> {
    const batch = writeBatch(db);

    const communityRef = doc(db, COLLECTIONS.COMMUNITIES, communityId);
    const userRef = doc(db, COLLECTIONS.USERS, userId);

    const community = await this.getCommunity(communityId);
    const user = await userService.getUser(userId);

    if (community) {
      batch.update(communityRef, {
        memberCount: Math.max(0, (community.memberCount || 0) - 1),
        updatedAt: serverTimestamp(),
      });
    }

    if (user) {
      const nextJoined = Array.isArray(user.joinedCommunities)
        ? user.joinedCommunities.filter(id => id !== communityId)
        : [];
      batch.update(userRef, {
        joinedCommunities: nextJoined,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  // NEW: create join request document
  async createJoinRequest(data: Omit<JoinRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Upsert: if a pending request already exists for this user+community, reuse/update it
    const existing = await this.getPendingJoinRequest(data.communityId, data.userId);
    if (existing) {
      const patch: Partial<JoinRequest> = {};
      if (typeof (data as any).message !== 'undefined') {
        patch.message = (data as any).message || existing.message;
      }
      await this.update<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, existing.id, patch);
      return existing.id;
    }
    return this.create<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, {
      ...data,
      status: data.status ?? 'pending',
    } as any);
  }

  // NEW: get pending join request for a specific user and community
  async getPendingJoinRequest(communityId: string, userId: string): Promise<JoinRequest | null> {
    const results = await this.query<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, [
      where('communityId', '==', communityId),
      where('userId', '==', userId),
      where('status', '==', 'pending'),
      limit(1),
    ]);
    return results[0] || null;
  }

  // NEW: subscribe to pending join request status changes
  subscribeToPendingJoinRequest(
    communityId: string,
    userId: string,
    callback: (request: JoinRequest | null) => void,
  ): () => void {
    return this.subscribeToCollection<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, [
      where('communityId', '==', communityId),
      where('userId', '==', userId),
      where('status', '==', 'pending'),
      limit(1),
    ], (data) => {
      callback(data[0] || null);
    });
  }

  // NEW: subscribe to join request status (pending/approved/rejected)
  subscribeToJoinRequestStatus(
    communityId: string,
    userId: string,
    callback: (request: JoinRequest | null) => void,
  ): () => void {
    return this.subscribeToCollection<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, [
      where('communityId', '==', communityId),
      where('userId', '==', userId),
      limit(1),
    ], (data) => {
      callback(data[0] || null);
    });
  }

  // NEW: list join requests for a community (optionally filter by status)
  async getCommunityJoinRequests(communityId: string, status?: JoinRequest['status']): Promise<JoinRequest[]> {
    const constraints: QueryConstraint[] = [
      where('communityId', '==', communityId),
    ];
    if (status) {
      constraints.push(where('status', '==', status));
    }
    // No orderBy here to avoid composite index requirement; sort client-side
    return this.query<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, constraints);
  }

  // NEW: subscribe to community join requests (defaults to pending)
  subscribeToCommunityJoinRequests(
    communityId: string,
    callback: (requests: JoinRequest[]) => void,
    status: JoinRequest['status'] = 'pending',
  ): () => void {
    const constraints: QueryConstraint[] = [
      where('communityId', '==', communityId),
      where('status', '==', status),
    ];
    // No orderBy here to avoid composite index requirement; sort client-side
    return this.subscribeToCollection<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, constraints, callback);
  }

  // NEW: review a join request; on approval, add user to community
  async reviewJoinRequest(requestId: string, status: 'approved' | 'rejected', reviewerId: string): Promise<void> {
    const req = await this.getById<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, requestId);
    if (!req) throw new Error('Join request not found');

    await this.update<JoinRequest>(COLLECTIONS.JOIN_REQUESTS, requestId, {
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
    });
    // NOTE: Do NOT mutate the user's document or community counters here.
    // Under production rules, moderators cannot write user docs.
    // The requester’s client will update their own membership upon approval.
  }
}

// Helper: allow a user to update their own membership only
export class MembershipService {
  async addUserMembershipOnly(communityId: string, userId: string): Promise<void> {
    const user = await userService.getUser(userId);
    if (!user) throw new Error('User not found');

    const nextJoined = Array.isArray(user.joinedCommunities)
      ? [...new Set([...user.joinedCommunities, communityId])]
      : [communityId];

    await userService.updateUser(userId, {
      joinedCommunities: nextJoined,
      updatedAt: new Date().toISOString(),
    });
  }
}

// Post service
export class PostService extends DatabaseService {
  async createPost(postData: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<Post>(COLLECTIONS.POSTS, postData);
  }

  async getPost(postId: string): Promise<Post | null> {
    return this.getById<Post>(COLLECTIONS.POSTS, postId);
  }

  async updatePost(postId: string, updates: Partial<Post>): Promise<void> {
    return this.update<Post>(COLLECTIONS.POSTS, postId, updates);
  }

  async deletePost(postId: string): Promise<void> {
    return this.delete(COLLECTIONS.POSTS, postId);
  }

  async getFeedPosts(userId: string, limitCount: number = 20, lastPost?: Post): Promise<Post[]> {
    const constraints: QueryConstraint[] = [
      // Global feed: drop status equality to avoid composite index requirements
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    ];

    if (lastPost) {
      constraints.push(startAfter(lastPost.createdAt));
    }

    return this.query<Post>(COLLECTIONS.POSTS, constraints);
  }

  async getCommunityPosts(communityId: string, limitCount: number = 20, lastPost?: Post): Promise<Post[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('communityId', '==', communityId),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      ];
      if (lastPost) {
        constraints.push(startAfter((lastPost as any).createdAt));
      }
      return await this.query<Post>(COLLECTIONS.POSTS, constraints);
    } catch (error: any) {
      // Fallback: remove orderBy to avoid composite index; sort client-side
      const constraints: QueryConstraint[] = [
        where('communityId', '==', communityId),
        where('status', '==', 'published'),
        limit(limitCount)
      ];
      const data = await this.query<Post>(COLLECTIONS.POSTS, constraints);
      const sorted = [...data].sort((a: any, b: any) => {
        const ta = a?.createdAt && typeof a.createdAt.toMillis === 'function'
          ? a.createdAt.toMillis() : (typeof a?.createdAt === 'string' ? Date.parse(a.createdAt) : 0);
        const tb = b?.createdAt && typeof b.createdAt.toMillis === 'function'
          ? b.createdAt.toMillis() : (typeof b?.createdAt === 'string' ? Date.parse(b.createdAt) : 0);
        return tb - ta;
      });
      return sorted as Post[];
    }
  }

  async getUserPosts(userId: string, limitCount: number = 20, lastPost?: Post): Promise<Post[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('userId', '==', userId),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      ];
      if (lastPost) {
        constraints.push(startAfter((lastPost as any).createdAt));
      }
      return await this.query<Post>(COLLECTIONS.POSTS, constraints);
    } catch (error: any) {
      // Fallback: remove orderBy to avoid composite index; sort client-side
      const constraints: QueryConstraint[] = [
        where('userId', '==', userId),
        where('status', '==', 'published'),
        limit(limitCount)
      ];
      const data = await this.query<Post>(COLLECTIONS.POSTS, constraints);
      const sorted = [...data].sort((a: any, b: any) => {
        const ta = a?.createdAt && typeof a.createdAt.toMillis === 'function'
          ? a.createdAt.toMillis() : (typeof a?.createdAt === 'string' ? Date.parse(a.createdAt) : 0);
        const tb = b?.createdAt && typeof b.createdAt.toMillis === 'function'
          ? b.createdAt.toMillis() : (typeof b?.createdAt === 'string' ? Date.parse(b.createdAt) : 0);
        return tb - ta;
      });
      return sorted as Post[];
    }
  }

  async likePost(postId: string, userId: string): Promise<void> {
    const post = await this.getPost(postId);
    if (!post) throw new Error('Post not found');

    const isLiked = post.likes.includes(userId);
    const newLikes = isLiked
      ? post.likes.filter(id => id !== userId)
      : [...post.likes, userId];

    await this.updatePost(postId, { likes: newLikes });
  }

  async sharePost(postId: string, userId: string): Promise<void> {
    const post = await this.getPost(postId);
    if (!post) throw new Error('Post not found');

    await this.updatePost(postId, {
      sharesCount: post.sharesCount + 1
    });
  }
}

// Comment service
export class CommentService extends DatabaseService {
  async createComment(commentData: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const commentId = await this.create<Comment>(COLLECTIONS.COMMENTS, commentData);
    
    // Update post comments count
    const postService = new PostService();
    const post = await postService.getPost(commentData.postId);
    if (post) {
      await postService.updatePost(commentData.postId, {
        commentsCount: post.commentsCount + 1
      });
    }

    return commentId;
  }

  async getComments(postId: string, limitCount: number = 20, lastComment?: Comment): Promise<Comment[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('postId', '==', postId),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      ];
      if (lastComment) {
        constraints.push(startAfter((lastComment as any).createdAt));
      }
      return await this.query<Comment>(COLLECTIONS.COMMENTS, constraints);
    } catch (error: any) {
      // Fallback: remove orderBy to avoid composite index; sort client-side
      const constraints: QueryConstraint[] = [
        where('postId', '==', postId),
        where('status', '==', 'published'),
        limit(limitCount)
      ];
      const data = await this.query<Comment>(COLLECTIONS.COMMENTS, constraints);
      const sorted = [...data].sort((a: any, b: any) => {
        const ta = a?.createdAt && typeof a.createdAt.toMillis === 'function'
          ? a.createdAt.toMillis() : (typeof a?.createdAt === 'string' ? Date.parse(a.createdAt) : 0);
        const tb = b?.createdAt && typeof b.createdAt.toMillis === 'function'
          ? b.createdAt.toMillis() : (typeof b?.createdAt === 'string' ? Date.parse(b.createdAt) : 0);
        return tb - ta;
      });
      return sorted as Comment[];
    }
  }

  async likeComment(commentId: string, userId: string): Promise<void> {
    const comment = await this.getById<Comment>(COLLECTIONS.COMMENTS, commentId);
    if (!comment) throw new Error('Comment not found');

    const isLiked = comment.likes.includes(userId);
    const newLikes = isLiked
      ? comment.likes.filter(id => id !== userId)
      : [...comment.likes, userId];

    await this.update<Comment>(COLLECTIONS.COMMENTS, commentId, { likes: newLikes });
  }
}

// Message service
export class MessageService extends DatabaseService {
  async createMessage(messageData: Omit<Message, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<Message>(COLLECTIONS.MESSAGES, messageData);
  }

  async getMessages(conversationId: string, limitCount: number = 50, lastMessage?: Message): Promise<Message[]> {
    // Avoid composite index requirements by removing orderBy; sort client-side
    const constraints: QueryConstraint[] = [
      where('conversationId', '==', conversationId),
      limit(limitCount)
    ];

    const data = await this.query<Message>(COLLECTIONS.MESSAGES, constraints);
    // Return messages ordered by createdAt asc for UI rendering
    return [...data].sort((a: any, b: any) => {
      const ua = a?.createdAt;
      const ub = b?.createdAt;
      const ta = ua && typeof ua.toMillis === 'function' ? ua.toMillis() : (typeof ua === 'string' ? Date.parse(ua) : 0);
      const tb = ub && typeof ub.toMillis === 'function' ? ub.toMillis() : (typeof ub === 'string' ? Date.parse(ub) : 0);
      return ta - tb;
    });
  }

  async markAsRead(messageId: string, userId: string): Promise<void> {
    await this.update<Message>(COLLECTIONS.MESSAGES, messageId, {
      isRead: true,
      readAt: new Date().toISOString()
    });
  }
}

// Conversation service
export class ConversationService extends DatabaseService {
  async createConversation(convoData: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.create<Conversation>(COLLECTIONS.CONVERSATIONS, convoData);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.getById<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId);
  }

  async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<void> {
    return this.update<Conversation>(COLLECTIONS.CONVERSATIONS, conversationId, updates);
  }

  async getUserConversations(userId: string, limitCount?: number): Promise<Conversation[]> {
    // Avoid composite index requirement by removing orderBy; sort client-side
    const constraints: QueryConstraint[] = [
      where('participants', 'array-contains', userId),
    ];
    if (typeof limitCount === 'number') {
      constraints.push(limit(limitCount));
    }
    const data = await this.query<Conversation>(COLLECTIONS.CONVERSATIONS, constraints);
    return [...data].sort((a: any, b: any) => {
      const ua = a?.updatedAt;
      const ub = b?.updatedAt;
      const ta = ua && typeof ua.toMillis === 'function' ? ua.toMillis() : (typeof ua === 'string' ? Date.parse(ua) : 0);
      const tb = ub && typeof ub.toMillis === 'function' ? ub.toMillis() : (typeof ub === 'string' ? Date.parse(ub) : 0);
      return tb - ta;
    });
  }

  subscribeToUserConversations(userId: string, callback: (data: Conversation[]) => void): () => void {
    // Avoid composite index requirement by removing orderBy; sort client-side before callback
    return this.subscribeToCollection<Conversation>(COLLECTIONS.CONVERSATIONS, [
      where('participants', 'array-contains', userId),
    ], (data) => {
      const sorted = [...data].sort((a: any, b: any) => {
        const ua = a?.updatedAt;
        const ub = b?.updatedAt;
        const ta = ua && typeof ua.toMillis === 'function' ? ua.toMillis() : (typeof ua === 'string' ? Date.parse(ua) : 0);
        const tb = ub && typeof ub.toMillis === 'function' ? ub.toMillis() : (typeof ub === 'string' ? Date.parse(ub) : 0);
        return tb - ta;
      });
      callback(sorted as Conversation[]);
    });
  }

  async updateLastMessage(conversationId: string, last: NonNullable<Conversation['lastMessage']>): Promise<void> {
    return this.updateConversation(conversationId, { lastMessage: last });
  }
}

// Notification service
export class NotificationService extends DatabaseService {
  async createNotification(notificationData: Omit<Notification, 'id' | 'createdAt'>): Promise<string> {
    return this.create<Notification>(COLLECTIONS.NOTIFICATIONS, notificationData);
  }

  async getUserNotifications(userId: string, limitCount: number = 20): Promise<Notification[]> {
    try {
      return await this.query<Notification>(COLLECTIONS.NOTIFICATIONS, [
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      ]);
    } catch (error: any) {
      // Fallback: remove orderBy; sort client-side
      const data = await this.query<Notification>(COLLECTIONS.NOTIFICATIONS, [
        where('userId', '==', userId),
        limit(limitCount)
      ]);
      const sorted = [...data].sort((a: any, b: any) => {
        const ta = a?.createdAt && typeof a.createdAt.toMillis === 'function'
          ? a.createdAt.toMillis() : (typeof a?.createdAt === 'string' ? Date.parse(a.createdAt) : 0);
        const tb = b?.createdAt && typeof b.createdAt.toMillis === 'function'
          ? b.createdAt.toMillis() : (typeof b?.createdAt === 'string' ? Date.parse(b.createdAt) : 0);
        return tb - ta;
      });
      return sorted as Notification[];
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.update<Notification>(COLLECTIONS.NOTIFICATIONS, notificationId, {
      isRead: true,
      readAt: new Date().toISOString()
    });
  }
}

// Export service instances
export const userService = new UserService();
export const communityService = new CommunityService();
export const membershipService = new MembershipService();
export const postService = new PostService();
export const commentService = new CommentService();
export const messageService = new MessageService();
export const conversationService = new ConversationService();
export const notificationService = new NotificationService();

import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { communityService } from '@/database/service';
import type { Community, JoinRequest } from '@/database/schema';
import { orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/hooks/auth-store';

export const [CommunitiesProvider, useCommunities] = createContextHook(() => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<Record<string, boolean>>({});
  const [communityJoinRequests, setCommunityJoinRequests] = useState<Record<string, JoinRequest[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    setIsLoading(true);
    let unsub: (() => void) | undefined;

    if (isAuthenticated) {
      unsub = communityService.subscribeToCollection<Community>('communities', [
        orderBy('createdAt', 'desc'),
        limit(50),
      ], (data) => {
        setCommunities(data);
        setIsLoading(false);
      }, (err) => {
        console.error('Communities subscription error:', err);
        setCommunities([]);
        setIsLoading(false);
      });
    } else {
      // When logged out, ensure no Firestore listeners run and clear state
      setCommunities([]);
      setUserCommunities([]);
      setCommunityJoinRequests({});
      setPendingJoinRequests({});
      setIsLoading(false);
    }

    return () => {
      try { unsub?.(); } catch {}
    };
  }, [isAuthenticated]);

  const loadCommunities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Fallback one-shot load (subscription handles realtime updates)
      const all = await communityService.query<Community>('communities', [orderBy('createdAt', 'desc'), limit(50)]);
      setCommunities(all);
    } catch (err) {
      console.error('Error loading communities:', err);
      setError('Failed to load communities');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUserCommunities = useCallback(async (userId: string) => {
    try {
      const userComms = await communityService.getUserCommunities(userId);
      setUserCommunities(userComms);
    } catch (err) {
      console.error('Error loading user communities:', err);
      setError('Failed to load your communities');
    }
  }, []);

  // Load pending join request status for a specific community and user
  const loadPendingJoinStatus = useCallback(async (communityId: string, userId: string) => {
    try {
      const req = await communityService.getPendingJoinRequest(communityId, userId);
      setPendingJoinRequests(prev => ({ ...prev, [communityId]: Boolean(req) }));
      return Boolean(req);
    } catch (err) {
      console.error('Error checking pending join request:', err);
      return false;
    }
  }, []);

  // Subscribe to pending join request status changes
  const subscribeToPendingJoinStatus = useCallback((communityId: string, userId: string) => {
    return communityService.subscribeToPendingJoinRequest(communityId, userId, (req) => {
      setPendingJoinRequests(prev => ({ ...prev, [communityId]: Boolean(req) }));
    });
  }, []);

  // Load join requests for a community (defaults to pending)
  const loadCommunityJoinRequests = useCallback(async (communityId: string) => {
    try {
      const requests = await communityService.getCommunityJoinRequests(communityId, 'pending');
      const toMillis = (v: any) => (v && typeof v === 'object' && 'seconds' in v) ? v.seconds * 1000 : (typeof v === 'string' ? Date.parse(v) : 0);
      const sorted = [...requests].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      // Dedupe by userId keeping the latest request
      const byUser: Record<string, JoinRequest> = {};
      for (const r of sorted) {
        if (!byUser[r.userId]) byUser[r.userId] = r;
      }
      const unique = Object.values(byUser);
      setCommunityJoinRequests(prev => ({ ...prev, [communityId]: unique }));
      return requests;
    } catch (err) {
      console.error('Error loading community join requests:', err);
      setError('Failed to load join requests');
      return [];
    }
  }, []);

  // Subscribe to pending join requests for a community
  const subscribeToCommunityJoinRequests = useCallback((communityId: string) => {
    return communityService.subscribeToCommunityJoinRequests(communityId, (requests) => {
      const toMillis = (v: any) => (v && typeof v === 'object' && 'seconds' in v) ? v.seconds * 1000 : (typeof v === 'string' ? Date.parse(v) : 0);
      const sorted = [...requests].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      const byUser: Record<string, JoinRequest> = {};
      for (const r of sorted) {
        if (!byUser[r.userId]) byUser[r.userId] = r;
      }
      const unique = Object.values(byUser);
      setCommunityJoinRequests(prev => ({ ...prev, [communityId]: unique }));
    }, 'pending');
  }, []);

  // Review join request and update local state accordingly
  const approveJoinRequest = useCallback(async (requestId: string, reviewerId: string) => {
    try {
      setError(null);
      await communityService.reviewJoinRequest(requestId, 'approved', reviewerId);
      // Remove from pending list locally
      setCommunityJoinRequests(prev => {
        const copy: Record<string, JoinRequest[]> = { ...prev };
        Object.keys(copy).forEach(commId => {
          copy[commId] = (copy[commId] || []).filter(r => r.id !== requestId);
        });
        return copy;
      });
    } catch (err) {
      console.error('Error approving join request:', err);
      setError('Failed to approve join request');
      throw err;
    }
  }, []);

  const rejectJoinRequest = useCallback(async (requestId: string, reviewerId: string) => {
    try {
      setError(null);
      await communityService.reviewJoinRequest(requestId, 'rejected', reviewerId);
      setCommunityJoinRequests(prev => {
        const copy: Record<string, JoinRequest[]> = { ...prev };
        Object.keys(copy).forEach(commId => {
          copy[commId] = (copy[commId] || []).filter(r => r.id !== requestId);
        });
        return copy;
      });
    } catch (err) {
      console.error('Error rejecting join request:', err);
      setError('Failed to reject join request');
      throw err;
    }
  }, []);

  // Subscribe to overall join request status; on approval, refresh membership
  const subscribeToJoinRequestStatus = useCallback((communityId: string, userId: string) => {
    return communityService.subscribeToJoinRequestStatus(communityId, userId, async (req) => {
      const isPending = req?.status === 'pending';
      setPendingJoinRequests(prev => ({ ...prev, [communityId]: Boolean(isPending) }));
      if (req?.status === 'approved') {
        await loadUserCommunities(userId);
      }
    });
  }, [loadUserCommunities]);

  const createCommunity = useCallback(async (communityData: Omit<Community, 'id' | 'createdAt' | 'updatedAt' | 'stats'>) => {
    try {
      setError(null);
      
      const newCommunityData = {
        ...communityData,
        stats: {
          postsCount: 0,
          membersCount: 1,
          viewsCount: 0,
        },
        memberCount: 1,
        moderators: [communityData.createdBy],
        rules: [],
        settings: {
          allowPosts: true,
          allowImages: true,
          allowLinks: true,
          requireApproval: false,
          allowMemberInvites: true,
        },
        lastActivity: new Date().toISOString(),
      };

      const communityId = await communityService.createCommunity(newCommunityData);
      const newCommunity = await communityService.getCommunity(communityId);
      
      if (newCommunity) {
        setCommunities(prev => [newCommunity, ...prev]);
        setUserCommunities(prev => [newCommunity, ...prev]);
      }
      
      return newCommunity;
    } catch (err) {
      console.error('Error creating community:', err);
      setError('Failed to create community');
      throw err;
    }
  }, []);

  const searchCommunities = useCallback(async (searchTerm: string, category?: string) => {
    try {
      setError(null);
      const results = await communityService.searchCommunities(searchTerm, category);
      return results;
    } catch (err) {
      console.error('Error searching communities:', err);
      setError('Failed to search communities');
      return [];
    }
  }, []);

  const joinCommunity = useCallback(async (communityId: string, userId: string) => {
    try {
      setError(null);
      await communityService.joinCommunity(communityId, userId);
      
      // Update local state
      const community = await communityService.getCommunity(communityId);
      if (community) {
        setCommunities(prev => 
          prev.map(c => c.id === communityId ? community : c)
        );
        setUserCommunities(prev => [...prev, community]);
      }
      
      return 'joined';
    } catch (err) {
      console.error('Error joining community:', err);
      setError('Failed to join community');
      throw err;
    }
  }, []);

  const leaveCommunity = useCallback(async (communityId: string, userId: string) => {
    try {
      setError(null);
      await communityService.leaveCommunity(communityId, userId);
      
      // Update local state
      const community = await communityService.getCommunity(communityId);
      if (community) {
        setCommunities(prev => 
          prev.map(c => c.id === communityId ? community : c)
        );
        setUserCommunities(prev => 
          prev.filter(c => c.id !== communityId)
        );
      }
      
    } catch (err) {
      console.error('Error leaving community:', err);
      setError('Failed to leave community');
      throw err;
    }
  }, []);

  const requestToJoinCommunity = useCallback(async (communityId: string, userId: string, userName: string, message?: string) => {
    try {
      setError(null);
      
      // Check if community is private
      const community = await communityService.getCommunity(communityId);
      if (!community) {
        throw new Error('Community not found');
      }
      
      if (!community.isPrivate) {
        // If public, join directly
        return await joinCommunity(communityId, userId);
      } else {
        // If private, create join request
        const joinRequestData = {
          communityId,
          userId,
          userName,
          message: message || '',
          status: 'pending' as const,
        };
        
        await communityService.createJoinRequest(joinRequestData);
        // Reflect pending state in local store immediately
        setPendingJoinRequests(prev => ({ ...prev, [communityId]: true }));
        return 'requested';
      }
    } catch (err) {
      console.error('Error requesting to join community:', err);
      setError('Failed to request to join community');
      throw err;
    }
  }, [joinCommunity]);

  const getCommunity = useCallback(async (communityId: string) => {
    try {
      setError(null);
      return await communityService.getCommunity(communityId);
    } catch (err) {
      console.error('Error getting community:', err);
      setError('Failed to get community');
      return null;
    }
  }, []);

  const updateCommunity = useCallback(async (communityId: string, updates: Partial<Community>) => {
    try {
      setError(null);
      await communityService.updateCommunity(communityId, updates);
      
      // Update local state
      const updatedCommunity = await communityService.getCommunity(communityId);
      if (updatedCommunity) {
        setCommunities(prev => 
          prev.map(c => c.id === communityId ? updatedCommunity : c)
        );
        setUserCommunities(prev => 
          prev.map(c => c.id === communityId ? updatedCommunity : c)
        );
      }
      
    } catch (err) {
      console.error('Error updating community:', err);
      setError('Failed to update community');
      throw err;
    }
  }, []);

  return useMemo(() => ({
    communities,
    userCommunities,
    pendingJoinRequests,
    communityJoinRequests,
    isLoading,
    error,
    loadCommunities,
    loadUserCommunities,
    loadPendingJoinStatus,
    subscribeToPendingJoinStatus,
    subscribeToJoinRequestStatus,
    loadCommunityJoinRequests,
    subscribeToCommunityJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    createCommunity,
    searchCommunities,
    joinCommunity,
    leaveCommunity,
    requestToJoinCommunity,
    getCommunity,
    updateCommunity,
  }), [
    communities,
    userCommunities,
    pendingJoinRequests,
    communityJoinRequests,
    isLoading,
    error,
    loadCommunities,
    loadUserCommunities,
    loadPendingJoinStatus,
    subscribeToPendingJoinStatus,
    subscribeToJoinRequestStatus,
    loadCommunityJoinRequests,
    subscribeToCommunityJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    createCommunity,
    searchCommunities,
    joinCommunity,
    leaveCommunity,
    requestToJoinCommunity,
    getCommunity,
    updateCommunity,
  ]);
});

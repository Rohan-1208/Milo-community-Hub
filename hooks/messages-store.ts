import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { conversationService, messageService } from '@/database/service';
import type { Message, Conversation } from '@/database/schema';

interface SendOptions {
  offline?: boolean;
  type?: Message['type'];
  attachments?: NonNullable<Message['attachments']>;
}

export const [MessagesProvider, useMessages] = createContextHook(() => {
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Load from local spool on startup
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('offlineMessagesSpool');
        const spool = raw ? JSON.parse(raw) as Record<string, Message[]> : {};
        setMessagesByConversation(prev => ({ ...spool, ...prev }));
      } catch (e) {
        // noop
      }
    })();
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const msgs = await messageService.getMessages(conversationId, 50);
      // Service returns messages sorted asc by createdAt
      // Deduplicate by id to avoid React duplicate key warnings
      const deduped = Array.from(new Map(msgs.map(m => [m.id, m])).values());
      setMessagesByConversation(prev => ({ ...prev, [conversationId]: deduped }));
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const subscribeToConversation = useCallback((conversationId: string) => {
    // Real-time stream; sort client-side to avoid composite index requirements
    const unsub = messageService.subscribeToCollection<Message>(
      'messages',
      [where('conversationId', '==', conversationId)],
      (msgs) => {
        const sorted = [...msgs].sort((a: any, b: any) => {
          const ua = a?.createdAt;
          const ub = b?.createdAt;
          const ta = ua && typeof ua.toMillis === 'function' ? ua.toMillis() : (typeof ua === 'string' ? Date.parse(ua) : 0);
          const tb = ub && typeof ub.toMillis === 'function' ? ub.toMillis() : (typeof ub === 'string' ? Date.parse(ub) : 0);
          return ta - tb;
        });
        // Deduplicate by id to avoid React duplicate key warnings
        const deduped = Array.from(new Map(sorted.map(m => [m.id, m])).values());
        setMessagesByConversation(prev => ({ ...prev, [conversationId]: deduped }));
      },
      (err) => {
        console.error('Realtime query error on messages:', err);
        setError('Not authorized to view this conversation');
      }
    );
    return unsub;
  }, []);

  const loadConversations = useCallback(async (userId: string) => {
    try {
      setIsConversationsLoading(true);
      setError(null);
      // Fetch all conversations by omitting limit
      const convos = await conversationService.getUserConversations(userId);
      const uniqueConvos = Array.from(new Map(convos.map(c => [c.id, c])).values());
      setConversations(uniqueConvos);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setIsConversationsLoading(false);
    }
  }, []);

  const subscribeToConversations = useCallback((userId: string) => {
    const unsub = conversationService.subscribeToUserConversations(userId, (convos) => {
      const uniqueConvos = Array.from(new Map(convos.map(c => [c.id, c])).values());
      setConversations(uniqueConvos);
    });
    return unsub;
  }, []);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      senderId: string,
      receiverId: string,
      content: string,
      options?: SendOptions,
    ) => {
      setError(null);
      const offline = options?.offline ?? isOfflineMode;

      const base: Omit<Message, 'id'> = {
        senderId,
        receiverId,
        content,
        type: options?.type ?? 'text',
        attachments: options?.attachments ?? [],
        isRead: false,
        isDelivered: !offline,
        deliveredAt: offline ? undefined : new Date().toISOString(),
        isEdited: false,
        editedAt: undefined,
        replyTo: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: offline ? 'sent' : 'delivered',
        // We store conversationId on the record even if not in interface in some apps; here service expects it.
        // @ts-ignore: conversationId is used by messageService.getMessages
        conversationId,
      };

      if (offline) {
        // Spool locally for later sync
        setMessagesByConversation(prev => {
          const next = { ...prev };
          const list = next[conversationId] ?? [];
          const localMsg = { ...base, id: `local-${Date.now()}` } as Message;
          next[conversationId] = [...list, localMsg];
          return next;
        });
        const raw = await AsyncStorage.getItem('offlineMessagesSpool');
        const spool: Record<string, Message[]> = raw ? JSON.parse(raw) : {};
        const list = spool[conversationId] ?? [];
        spool[conversationId] = [...list, { ...base, id: `local-${Date.now()}` } as Message];
        await AsyncStorage.setItem('offlineMessagesSpool', JSON.stringify(spool));
        return;
      }

      // Online send via Firestore
      const id = await messageService.createMessage(base as any);
      const saved = { ...base, id } as Message;
      // Optimistically merge while deduplicating
      setMessagesByConversation(prev => {
        const next = { ...prev };
        const list = next[conversationId] ?? [];
        const map = new Map(list.map(m => [m.id, m]));
        map.set(saved.id, saved);
        next[conversationId] = Array.from(map.values());
        return next;
      });

      // Update conversation lastMessage metadata for previews
      try {
        const previewContent = (content && content.trim())
          ? content
          : (() => {
              const t = options?.attachments?.[0]?.type;
              if (t === 'image') return '[Image]';
              if (t === 'video') return '[Video]';
              if (t === 'document') return '[Document]';
              if (t === 'audio') return '[Audio]';
              return '[Attachment]';
            })();
        await conversationService.updateLastMessage(conversationId, {
          id,
          content: previewContent,
          senderId,
          createdAt: base.createdAt,
        });
      } catch (e) {
        // non-fatal
        console.warn('Failed to update conversation lastMessage:', e);
      }
    },
    [isOfflineMode]
  );

  const syncOfflineMessages = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('offlineMessagesSpool');
      const spool: Record<string, Message[]> = raw ? JSON.parse(raw) : {};
      for (const [conversationId, msgs] of Object.entries(spool)) {
        for (const m of msgs) {
          const id = await messageService.createMessage(m as any);
          m.id = id;
        }
      }
      await AsyncStorage.removeItem('offlineMessagesSpool');
    } catch (err) {
      console.error('Error syncing offline messages:', err);
    }
  }, []);

  return useMemo(() => ({
    messagesByConversation,
    conversations,
    isLoading,
    isConversationsLoading,
    error,
    isOfflineMode,
    setIsOfflineMode,
    loadMessages,
    loadConversations,
    sendMessage,
    subscribeToConversation,
    subscribeToConversations,
    syncOfflineMessages,
  }), [messagesByConversation, conversations, isLoading, isConversationsLoading, error, isOfflineMode, loadMessages, loadConversations, sendMessage, subscribeToConversation, subscribeToConversations, syncOfflineMessages]);
});
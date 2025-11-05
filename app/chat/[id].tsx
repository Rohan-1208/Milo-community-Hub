import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Send, WifiOff, Wifi, Image as ImageIcon, Video as VideoIcon } from 'lucide-react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { useMessages, MessagesProvider } from '@/hooks/messages-store';
import { Colors } from '@/constants/colors';
import type { Message } from '@/database/schema';
import { conversationService, userService } from '@/database/service';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';

function ChatScreenInner() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { messagesByConversation, loadMessages, subscribeToConversation, sendMessage, isOfflineMode, setIsOfflineMode } = useMessages();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const [receiverId, setReceiverId] = useState<string | null>(null);
  const [receiverProfile, setReceiverProfile] = useState<{ name: string; avatar?: string } | null>(null);

  const messages = useMemo(() => messagesByConversation[conversationId!] || [], [messagesByConversation, conversationId]);

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId as string);
      const unsub = subscribeToConversation(conversationId as string);
      // Resolve receiver from conversation participants
      (async () => {
        try {
          const convo = await conversationService.getConversation(conversationId as string);
          const other = convo?.participants?.find((p) => p !== user?.id) || null;
          setReceiverId(other);
          if (other) {
            const u = await userService.getUser(other);
            if (u) setReceiverProfile({ name: (u as any).name || (u as any).username || 'Unknown', avatar: (u as any).avatar });
          } else {
            setReceiverProfile(null);
          }
        } catch {
          setReceiverId(null);
          setReceiverProfile(null);
        }
      })();
      return () => unsub();
    }
  }, [conversationId, loadMessages, subscribeToConversation]);

  const handleSend = async () => {
    // Require a resolved receiverId; do not fallback to conversationId
    if (!user || !conversationId || !text.trim() || !receiverId) return;
    await sendMessage(conversationId as string, user.id, receiverId, text.trim());
    setText('');
    // Scroll to end after sending
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === user?.id;
    return (
      <View style={[styles.messageRow, isMine ? styles.mineRow : styles.theirRow]}>
        <View style={[styles.messageBubble, isMine ? styles.mineBubble : styles.theirBubble]}>
          <Text style={[styles.messageText, isMine ? styles.mineText : styles.theirText]}>{item.content}</Text>
          {Array.isArray(item.attachments) && item.attachments.length > 0 && (
            <View style={{ marginTop: 8, gap: 8 }}>
              {item.attachments.map((att, idx) => (
                <View key={`${item.id}-att-${idx}`}>
                  {att.type === 'image' ? (
                    <Image source={{ uri: att.url }} style={{ width: 220, height: 160, borderRadius: 8 }} />
                  ) : att.type === 'video' ? (
                    Platform.OS === 'web' ? (
                      // @ts-ignore web-only element
                      <video src={att.url} controls style={{ width: 220, height: 160, borderRadius: 8 }} />
                    ) : (
                      <TouchableOpacity onPress={() => Linking.openURL(att.url)}>
                        <Text style={{ color: isMine ? Colors.white : Colors.primary }}>Open video</Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity onPress={() => Linking.openURL(att.url)}>
                      <Text style={{ color: isMine ? Colors.white : Colors.primary }}>Open attachment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
          <Text style={styles.timestamp}>{new Date(item.createdAt || Date.now()).toLocaleTimeString()}</Text>
        </View>
      </View>
    );
  };

  const pickAndUpload = async (mode: 'image' | 'video') => {
    if (!user?.id || !conversationId || !receiverId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'image' ? ['images'] : ['videos'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const res = await fetch(asset.uri);
    const blob = await res.blob();
    const mime = blob.type || (mode === 'image' ? 'image/jpeg' : 'video/mp4');
    const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : mime.includes('mp4') ? 'mp4' : (mode === 'image' ? 'jpg' : 'mp4');
    const path = `messages/${user.id}/${conversationId}/${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    const url = await getDownloadURL(storageRef);
    await sendMessage(
      conversationId as string,
      user.id,
      receiverId,
      '',
      {
        type: mode === 'image' ? 'image' : 'file',
        attachments: [{
          type: mode,
          url,
          // Only include name when available to avoid Firestore undefined-field errors
          ...(asset.fileName ? { name: asset.fileName } : {}),
          size: (blob as any).size,
        }],
      }
    );
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient colors={Colors.gradient.secondary} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {receiverProfile?.avatar ? (
              <Image source={{ uri: receiverProfile.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : null}
            <Text style={styles.headerTitle}>{receiverProfile?.name || 'Chat'}</Text>
          </View>
          <TouchableOpacity style={styles.offlineToggle} onPress={() => setIsOfflineMode(!isOfflineMode)}>
            {isOfflineMode ? <WifiOff size={20} color={Colors.white} /> : <Wifi size={20} color={Colors.white} />}
          </TouchableOpacity>
        </View>
        {isOfflineMode && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color={Colors.white} />
            <Text style={styles.offlineBannerText}>Offline Mode Active - Messages will spool locally</Text>
          </View>
        )}
      </LinearGradient>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.mediaButton} onPress={() => pickAndUpload('image')} activeOpacity={0.8}>
            <LinearGradient colors={Colors.gradient.secondary} style={styles.mediaGradient}>
              <ImageIcon size={18} color={Colors.white} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaButton} onPress={() => pickAndUpload('video')} activeOpacity={0.8}>
            <LinearGradient colors={Colors.gradient.secondary} style={styles.mediaGradient}>
              <VideoIcon size={18} color={Colors.white} />
            </LinearGradient>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message"
            placeholderTextColor={Colors.textLight}
            value={text}
            onChangeText={setText}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} activeOpacity={0.8}>
            <LinearGradient colors={Colors.gradient.primary} style={styles.sendGradient}>
              <Send size={20} color={Colors.white} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function ChatScreen() {
  return (
    <MessagesProvider>
      <ChatScreenInner />
    </MessagesProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  offlineToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  offlineBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBannerText: {
    color: Colors.white,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  mineRow: {
    justifyContent: 'flex-end',
  },
  theirRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mineBubble: {
    backgroundColor: Colors.primary,
  },
  theirBubble: {
    backgroundColor: Colors.white,
  },
  messageText: {
    fontSize: 16,
  },
  mineText: {
    color: Colors.white,
  },
  theirText: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.6,
    color: Colors.textLight,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: Colors.white,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mediaGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: Colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
});
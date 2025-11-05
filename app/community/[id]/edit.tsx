import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { useCommunities } from '@/hooks/communities-store';
import GradientButton from '@/components/GradientButton';
import { Colors } from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '../../../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Community } from '@/database/schema';

export default function EditCommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { communities, getCommunity, updateCommunity } = useCommunities();

  const existing = communities.find(c => c.id === id);
  const [community, setCommunity] = useState<Community | null>(existing || null);

  const [name, setName] = useState(existing?.name || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [category, setCategory] = useState(existing?.category || 'General');
  const [tags, setTags] = useState<string>((existing?.tags || []).map(t => `#${t}`).join(' '));
  const [image, setImage] = useState(existing?.image || '');
  const [banner, setBanner] = useState(existing?.banner || '');
  const [isPrivate, setIsPrivate] = useState(!!existing?.isPrivate);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [newModeratorId, setNewModeratorId] = useState('');

  const categories = [
    'General',
    'Technology',
    'Fitness',
    'Art',
    'Music',
    'Gaming',
    'Education',
    'Travel',
    'Food',
    'Business',
    'Science',
  ];

  useEffect(() => {
    const load = async () => {
      if (!existing && id) {
        const c = await getCommunity(id);
        if (c) {
          setCommunity(c);
          setName(c.name);
          setDescription(c.description);
          setCategory(c.category);
          setTags((c.tags || []).map(t => `#${t}`).join(' '));
          setImage(c.image || '');
          setBanner(c.banner || '');
          setIsPrivate(!!c.isPrivate);
        }
      }
    };
    load();
  }, [id]);

  const isAdmin = useMemo(() => {
    if (!community || !user?.id) return false;
    return community.createdBy === user.id || (community.moderators || []).includes(user.id);
  }, [community, user?.id]);

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && description.trim().length >= 10 && !!user?.id && isAdmin;
  }, [name, description, user?.id, isAdmin]);

  const pickAndUpload = async (type: 'image' | 'banner') => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow media library access.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      type === 'image' ? setUploadingImage(true) : setUploadingBanner(true);

      const res = await fetch(uri);
      const blob = await res.blob();
      const path = `communities/${user?.id}/${Date.now()}-${type}.jpg`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      if (type === 'image') setImage(url); else setBanner(url);
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Upload Error', 'Could not upload image. Please try again.');
    } finally {
      type === 'image' ? setUploadingImage(false) : setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    if (!canSubmit || !id) return;
    setIsSaving(true);
    try {
      const tagsArray = tags
        .split(/\s+/)
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await updateCommunity(id, {
        name,
        description,
        category,
        tags: tagsArray,
        image: image || '',
        banner: banner || '',
        isPrivate,
        settings: {
          allowPosts: true,
          allowImages: true,
          allowLinks: true,
          requireApproval: isPrivate,
          allowMemberInvites: true,
        },
      } as Partial<Community>);
      Alert.alert('Saved', 'Community updated successfully.');
      router.back();
    } catch (err) {
      console.error('Update community error:', err);
      Alert.alert('Error', 'Failed to update community.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddModerator = async () => {
    if (!community || !id || !newModeratorId.trim()) return;
    try {
      const nextMods = Array.from(new Set([...(community.moderators || []), newModeratorId.trim()]));
      await updateCommunity(id, { moderators: nextMods });
      setCommunity({ ...community, moderators: nextMods } as Community);
      setNewModeratorId('');
      Alert.alert('Success', 'Moderator added.');
    } catch (err) {
      console.error('Add moderator error:', err);
      Alert.alert('Error', 'Failed to add moderator.');
    }
  };

  if (!community) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }] }>
        <Text style={{ fontSize: 16, color: Colors.textSecondary }}>Loading community...</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }] }>
        <Text style={{ fontSize: 16, color: Colors.error }}>You do not have permission to edit this community.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={Colors.gradient.secondary} style={styles.header}>
        <Text style={styles.headerTitle}>Edit Community</Text>
        <Text style={styles.headerSubtitle}>Update details and manage moderators</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsContainer}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat} onPress={() => setCategory(cat)} style={[styles.chip, category === cat && styles.chipActive]}>
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Tags (space separated, use #)</Text>
        <TextInput style={styles.input} placeholder="#react #community #meetup" value={tags} onChangeText={setTags} />

        <Text style={styles.label}>Community Image</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickAndUpload('image')} disabled={uploadingImage}>
            <Text style={styles.uploadText}>{uploadingImage ? 'Uploading...' : 'Upload Image'}</Text>
          </TouchableOpacity>
          {uploadingImage && <ActivityIndicator color={Colors.primary} style={{ marginLeft: 8 }} />}
        </View>
        {image ? <Image source={{ uri: image }} style={styles.previewImage} /> : <Text style={styles.helperText}>No image selected</Text>}

        <Text style={styles.label}>Banner Image</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickAndUpload('banner')} disabled={uploadingBanner}>
            <Text style={styles.uploadText}>{uploadingBanner ? 'Uploading...' : 'Upload Banner'}</Text>
          </TouchableOpacity>
          {uploadingBanner && <ActivityIndicator color={Colors.primary} style={{ marginLeft: 8 }} />}
        </View>
        {banner ? <Image source={{ uri: banner }} style={styles.previewBanner} /> : <Text style={styles.helperText}>No banner selected</Text>}

        <View style={styles.switchRow}>
          <Text style={styles.label}>Private community</Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} />
        </View>

        <View style={styles.submitRow}>
          <GradientButton title={isSaving ? 'Saving...' : 'Save Changes'} onPress={handleSave} disabled={!canSubmit || isSaving} />
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>Moderators</Text>
        <View style={styles.modRow}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="User ID" value={newModeratorId} onChangeText={setNewModeratorId} />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddModerator}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {community.moderators && community.moderators.length > 0 && (
          <Text style={styles.helperText}>Current moderators: {community.moderators.join(', ')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { color: Colors.white, fontSize: 24, fontWeight: '700' },
  headerSubtitle: { color: Colors.white, opacity: 0.9, marginTop: 6 },
  content: { padding: 16 },
  label: { color: Colors.text, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    color: Colors.text,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: `${Colors.primary}15`, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.primary },
  switchRow: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  submitRow: { marginTop: 24 },
  cancelButton: { marginTop: 12, alignItems: 'center' },
  cancelText: { color: Colors.textSecondary },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  uploadText: { color: Colors.text, fontWeight: '600' },
  previewImage: { width: '100%', height: 160, borderRadius: 12, marginTop: 8 },
  previewBanner: { width: '100%', height: 120, borderRadius: 12, marginTop: 8 },
  helperText: { color: Colors.textLight, marginTop: 8 },
  sectionDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: '600' },
  modRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  addBtnText: { color: Colors.white, fontWeight: '700' },
});
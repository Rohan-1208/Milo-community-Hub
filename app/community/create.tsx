import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Switch, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { useCommunities } from '@/hooks/communities-store';
import GradientButton from '@/components/GradientButton';
import { Colors } from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function CreateCommunityScreen() {
  const { user } = useAuth();
  const { createCommunity } = useCommunities();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState<string>('');
  const [image, setImage] = useState('');
  const [banner, setBanner] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

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

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2 && description.trim().length >= 10 && !!user?.id;
  }, [name, description, user?.id]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Incomplete', 'Please fill name and description.');
      return;
    }
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const slug = slugify(name);
      const tagsArray = tags
        .split(/\s+/)
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      const newCommunity = await createCommunity({
        name,
        slug,
        description,
        image: image || '',
        banner: banner || '',
        category,
        tags: tagsArray,
        location: '',
        isPrivate,
        isVerified: false,
        memberCount: 0,
        createdBy: user.id,
        moderators: [],
        rules: [],
        settings: {
          allowPosts: true,
          allowImages: true,
          allowLinks: true,
          requireApproval: isPrivate,
          allowMemberInvites: true,
        },
        createdAt: '',
        updatedAt: '',
        lastActivity: '',
        socialMedia: {},
        stats: {
          postsCount: 0,
          membersCount: 0,
          viewsCount: 0,
        },
      } as any);

      if (newCommunity?.id) {
        router.replace(`/community/${newCommunity.id}`);
      } else {
        router.back();
      }
    } catch (err) {
      console.error('Create community error:', err);
      Alert.alert('Error', 'Failed to create community. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <View style={styles.container}>
      <LinearGradient colors={Colors.gradient.secondary} style={styles.header}>
        <Text style={styles.headerTitle}>Create Community</Text>
        <Text style={styles.headerSubtitle}>Set up details and privacy</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Community name"
          placeholderTextColor={Colors.textLight}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Describe your community"
          placeholderTextColor={Colors.textLight}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsContainer}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.chip, category === cat && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Tags (space separated, use #)</Text>
        <TextInput
          style={styles.input}
          placeholder="#react #community #meetup"
          placeholderTextColor={Colors.textLight}
          value={tags}
          onChangeText={setTags}
        />

        <Text style={styles.label}>Community Image</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickAndUpload('image')} disabled={uploadingImage}>
            <Text style={styles.uploadText}>{uploadingImage ? 'Uploading...' : 'Upload Image'}</Text>
          </TouchableOpacity>
          {uploadingImage && <ActivityIndicator color={Colors.primary} style={{ marginLeft: 8 }} />}
        </View>
        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <Text style={styles.helperText}>No image selected</Text>
        )}

        <Text style={styles.label}>Banner Image</Text>
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickAndUpload('banner')} disabled={uploadingBanner}>
            <Text style={styles.uploadText}>{uploadingBanner ? 'Uploading...' : 'Upload Banner'}</Text>
          </TouchableOpacity>
          {uploadingBanner && <ActivityIndicator color={Colors.primary} style={{ marginLeft: 8 }} />}
        </View>
        {banner ? (
          <Image source={{ uri: banner }} style={styles.previewBanner} />
        ) : (
          <Text style={styles.helperText}>No banner selected</Text>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.label}>Private community</Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} />
        </View>

        <View style={styles.submitRow}>
          <GradientButton title={isLoading ? 'Creating...' : 'Create Community'} onPress={handleSubmit} disabled={!canSubmit || isLoading} />
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
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
});
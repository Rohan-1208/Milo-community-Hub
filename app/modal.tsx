import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Camera, Image as ImageIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/auth-store';
import { usePosts } from '@/hooks/posts-store';
import { useCommunities } from '@/hooks/communities-store';
import { Colors } from '@/constants/colors';
import GradientButton from '@/components/GradientButton';
import { storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function CreatePostModal() {
  const { user } = useAuth();
  const { createPost } = usePosts();
  const { userCommunities } = useCommunities();
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canSubmit = (content.trim().length > 0) || (selectedImages.length > 0);

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to add photos.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImages([...selectedImages, result.assets[0].uri]);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImages([...selectedImages, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!canSubmit) {
      Alert.alert('Add something', 'Please add text or at least one photo.');
      return;
    }

    if (!user) return;

    setIsLoading(true);
    try {
      const selectedCommunityData = userCommunities.find(c => c.id === selectedCommunity);
      
      // Upload selected images to Firebase Storage and get download URLs
      let imageUrls: string[] = [];
      if (selectedImages.length > 0) {
        try {
          const uploads = await Promise.all(
            selectedImages.map(async (uri, idx) => {
              const res = await fetch(uri);
              const blob = await res.blob();
              const mime = blob.type || 'image/jpeg';
              const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'jpg';
              const path = `posts/${user.id}/${Date.now()}-${idx}.${ext}`;
              const storageRef = ref(storage, path);
              await uploadBytes(storageRef, blob);
              const url = await getDownloadURL(storageRef);
              return url;
            })
          );
          imageUrls = uploads.filter(Boolean);
        } catch (uploadErr) {
          console.error('Post image upload error:', uploadErr);
          // Continue without images if upload fails
          imageUrls = [];
        }
      }

      await createPost({
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        communityId: selectedCommunity || undefined,
        communityName: selectedCommunityData?.name,
        content: content.trim(),
        images: imageUrls,
      });

      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Colors.gradient.primary}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <X size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Post</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.userSection}>
          <Image 
            source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face' }} 
            style={styles.avatar} 
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        {userCommunities.length > 0 && (
          <View style={styles.communitySection}>
            <Text style={styles.sectionTitle}>Share to community (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.communitiesScroll}>
              <TouchableOpacity
                style={[styles.communityChip, !selectedCommunity && styles.selectedCommunityChip]}
                onPress={() => setSelectedCommunity(null)}
              >
                <Text style={[styles.communityChipText, !selectedCommunity && styles.selectedCommunityChipText]}>
                  Personal
                </Text>
              </TouchableOpacity>
              {userCommunities.map((community) => (
                <TouchableOpacity
                  key={community.id}
                  style={[styles.communityChip, selectedCommunity === community.id && styles.selectedCommunityChip]}
                  onPress={() => setSelectedCommunity(community.id)}
                >
                  <Text style={[styles.communityChipText, selectedCommunity === community.id && styles.selectedCommunityChipText]}>
                    {community.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.inputSection}>
          <TextInput
            style={styles.textInput}
            placeholder="What's on your mind?"
            placeholderTextColor={Colors.textLight}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>You can share text, photos, or both.</Text>
        </View>

        {selectedImages.length > 0 && (
          <View style={styles.imagesSection}>
            <Text style={styles.sectionTitle}>Photos ({selectedImages.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedImages.map((image, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri: image }} style={styles.selectedImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <X size={16} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.mediaSection}>
          <Text style={styles.sectionTitle}>Add to your post</Text>
          <View style={styles.mediaButtons}>
            <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
              <ImageIcon size={24} color={Colors.primary} />
              <Text style={styles.mediaButtonText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaButton} onPress={takePhoto}>
              <Camera size={24} color={Colors.primary} />
              <Text style={styles.mediaButtonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <GradientButton
          title={isLoading ? "Posting..." : "Share Post"}
          onPress={handlePost}
          disabled={isLoading || !canSubmit}
          style={styles.postButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  userEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  communitySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  communitiesScroll: {
    flexDirection: 'row',
  },
  communityChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedCommunityChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  communityChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  selectedCommunityChipText: {
    color: Colors.white,
  },
  inputSection: {
    marginBottom: 24,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imagesSection: {
    marginBottom: 24,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaSection: {
    marginBottom: 24,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  mediaButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  postButton: {
    marginHorizontal: 0,
  },
});
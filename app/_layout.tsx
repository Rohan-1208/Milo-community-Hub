import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { LogBox, Platform } from "react-native";
import { AuthProvider } from "@/hooks/auth-store";
import { CommunitiesProvider } from "@/hooks/communities-store";
import { PostsProvider } from "@/hooks/posts-store";
import { MessagesProvider } from "@/hooks/messages-store";

SplashScreen.preventAutoHideAsync();
// Silence noisy dev-only warning on web related to Expo's HMR overlay
if (Platform.OS === 'web') {
  LogBox.ignoreLogs([
    "Can't perform a React state update on a component that hasn't mounted yet.",
  ]);
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CommunitiesProvider>
            <PostsProvider>
              <MessagesProvider>
                <StatusBar style="auto" />
                <RootLayoutNav />
              </MessagesProvider>
            </PostsProvider>
          </CommunitiesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
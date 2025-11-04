import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/auth');
      }
    }
  }, [isAuthenticated, isLoading]);

  return null;
}
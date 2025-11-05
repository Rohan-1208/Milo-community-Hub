import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';

export default function IndexScreen() {
  const { isAuthenticated, isLoading, authInProgress } = useAuth();

  useEffect(() => {
    if (!isLoading && !authInProgress) {
      if (isAuthenticated) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(auth)/auth');
      }
    }
  }, [isAuthenticated, isLoading, authInProgress]);

  return null;
}
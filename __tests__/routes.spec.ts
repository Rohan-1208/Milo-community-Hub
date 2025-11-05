import AuthScreen from '@/app/(auth)/auth';
import IndexScreen from '@/app/index';
import HomeScreen from '@/app/(tabs)/home';
import DiscoverScreen from '@/app/(tabs)/discover';
import CommunitiesScreen from '@/app/(tabs)/communities';
import ModalScreen from '@/app/modal';
import CommunityCreateScreen from '@/app/community/create';
import CommunityDynamicScreen from '@/app/community/[id]';

describe('Route components export', () => {
  test('Auth screen is defined', () => {
    expect(AuthScreen).toBeTruthy();
  });

  test('Index screen is defined', () => {
    expect(IndexScreen).toBeTruthy();
  });

  test('Tabs screens are defined', () => {
    expect(HomeScreen).toBeTruthy();
    expect(DiscoverScreen).toBeTruthy();
    expect(CommunitiesScreen).toBeTruthy();
  });

  test('Modal screen is defined', () => {
    expect(ModalScreen).toBeTruthy();
  });

  test('Community screens are defined', () => {
    expect(CommunityCreateScreen).toBeTruthy();
    expect(CommunityDynamicScreen).toBeTruthy();
  });
});
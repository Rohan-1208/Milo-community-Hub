import React from 'react';
import { render } from '@testing-library/react-native';
import CommunityCard from '@/components/CommunityCard';
import GradientButton from '@/components/GradientButton';
import PostCard from '@/components/PostCard';

describe('UI components', () => {
  test('GradientButton renders with title', () => {
    const { getByText } = render(<GradientButton title="Test" onPress={() => {}} />);
    expect(getByText('Test')).toBeTruthy();
  });

  test('CommunityCard renders basic content', () => {
    const { toJSON } = render(
      <CommunityCard
        id="1"
        name="Test Community"
        description="A test community"
        membersCount={10}
        imageUrl={undefined}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  test('PostCard renders basic content', () => {
    const { toJSON } = render(
      <PostCard
        id="p1"
        content="Hello world"
        author={{ id: 'u1', name: 'Alice', avatarUrl: undefined }}
        likesCount={0}
        commentsCount={0}
        createdAt={new Date().toISOString()}
      />
    );
    expect(toJSON()).toBeTruthy();
  });
});
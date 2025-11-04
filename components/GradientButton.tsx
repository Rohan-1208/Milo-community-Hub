import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  colors?: readonly string[];
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  dimWhenDisabled?: boolean;
}

export default function GradientButton({
  title,
  onPress,
  colors = Colors.gradient.primary as readonly string[],
  style,
  textStyle,
  disabled = false,
  dimWhenDisabled = true,
}: GradientButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.container, style]}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={disabled && dimWhenDisabled ? ['#9CA3AF', '#9CA3AF'] as const : colors as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <Text style={[styles.text, textStyle]}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
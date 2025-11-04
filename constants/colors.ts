const Colors = {
  primary: '#F43F5E',
  primaryDark: '#E11D48',
  secondary: '#3B82F6',
  accent: '#FACC15',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  background: '#FFF7ED',
  surface: '#FFF7ED',
  text: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  border: '#E2E8F0',
  white: '#FFFFFF',
  black: '#000000',
  gradient: {
    primary: ['#F43F5E', '#E11D48'] as const,
    secondary: ['#3B82F6', '#1D4ED8'] as const,
    accent: ['#FACC15', '#EAB308'] as const,
    success: ['#10B981', '#059669'] as const,
  }
};

export { Colors };
export default Colors;
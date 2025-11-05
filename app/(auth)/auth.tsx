import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-store';
import { Colors } from '@/constants/colors';
import GradientButton from '@/components/GradientButton';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, signup, signInWithGoogle, isAuthenticated, isLoading: authLoading } = useAuth();

  // Navigate to home only after auth state confirms the user is signed in
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const t = setTimeout(() => {
        router.replace('/(tabs)/home');
      }, 150);
      return () => clearTimeout(t);
    }
  }, [authLoading, isAuthenticated]);

  const handleEmailAuth = async () => {
    // reset previous error
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!isLogin && !name) {
      setError('Please enter your name');
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        console.log('Login attempt started');
        console.log('Calling login function with:', { email, password: '***' });
        await login(email, password);
        console.log('Login successful, navigating to home');
      } else {
        console.log('Signup attempt started');
        await signup(name, email, password);
        console.log('Signup successful');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      let errorMessage = isLogin ? 'Login failed. Please try again.' : 'Signup failed. Please try again.';
      
      // Handle specific Firebase auth errors
      if (error.message) {
        if (isLogin) {
          if (error.message.includes('user-not-found')) {
            errorMessage = 'No account found with this email address.';
          } else if (error.message.includes('wrong-password')) {
            errorMessage = 'Incorrect password. Please try again.';
          } else if (error.message.includes('invalid-email')) {
            errorMessage = 'Please enter a valid email address.';
          } else if (error.message.includes('too-many-requests')) {
            errorMessage = 'Too many failed attempts. Please try again later.';
          } else if (error.message.includes('user-disabled')) {
            errorMessage = 'This account has been disabled.';
          } else {
            errorMessage = error.message;
          }
        } else {
          if (error.message.includes('email-already-in-use')) {
            errorMessage = 'An account with this email already exists.';
          } else if (error.message.includes('invalid-email')) {
            errorMessage = 'Please enter a valid email address.';
          } else if (error.message.includes('weak-password')) {
            errorMessage = 'Password is too weak. Please choose a stronger password.';
          } else if (error.message.includes('operation-not-allowed')) {
            errorMessage = 'Email/password accounts are not enabled.';
          } else {
            errorMessage = error.message;
          }
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      // Navigation will occur via the auth state effect above
    } catch (error: any) {
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      if (error.message) {
        if (error.message.includes('popup-closed-by-user')) {
          errorMessage = 'Sign-in was cancelled.';
        } else if (error.message.includes('network-request-failed')) {
          errorMessage = 'Network error. Please check your connection.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={isLogin ? Colors.gradient.primary : Colors.gradient.secondary}
        style={styles.background}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {isLogin ? 'Welcome back to' : 'Join'}
              </Text>
              <Text style={styles.appName}>Milo</Text>
              <Text style={styles.subtitle}>
                {isLogin 
                  ? 'Sign in to continue to your communities' 
                  : 'Create your account and start connecting'
                }
              </Text>
            </View>

            <View style={styles.form}>
              {!isLogin && (
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textLight}
                  value={name}
                  onChangeText={setName}
                />
              )}
              
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { paddingRight: 64 }]}
                  placeholder="Password"
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.passwordToggle}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              {error ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <GradientButton
                title={isLoading ? (isLogin ? "Signing in..." : "Creating Account...") : (isLogin ? "Sign In" : "Create Account")}
                onPress={handleEmailAuth}
                disabled={isLoading}
                style={styles.authButton}
                colors={[Colors.white, Colors.white]}
                textStyle={{ color: isLogin ? Colors.primary : Colors.secondary }}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <View style={styles.googleButtonContent}>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={toggleMode}
                disabled={isLoading}
              >
                <Text style={styles.toggleButtonText}>
                  {isLogin 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 24,
    color: Colors.white,
    fontWeight: '300',
  },
  appName: {
    fontSize: 48,
    color: Colors.white,
    fontWeight: '800',
    marginVertical: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
  },
  passwordRow: {
    position: 'relative',
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  passwordToggleText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.95)', // Colors.error with opacity
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  errorText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  authButton: {
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.7)',
    marginHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    marginBottom: 8,
  },
  googleButtonContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  googleButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  toggleButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});

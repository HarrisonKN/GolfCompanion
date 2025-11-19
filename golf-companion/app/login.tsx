// ------------------- IMPORTS -------------------------
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import RotatingText from "@/components/RotatingText";
import { Image } from "react-native";
import React, { useState } from 'react';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';
import * as SecureStore from 'expo-secure-store';
import { ThemedView } from "@/components/ThemedView";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { useTheme } from "@/components/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PALETTES } from "@/constants/theme";

// ------------------- LOGIN LOGIC -------------------------
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.session?.access_token && data.session?.refresh_token) {
    await SecureStore.setItemAsync('supabase_access_token', data.session.access_token);
    await SecureStore.setItemAsync('supabase_refresh_token', data.session.refresh_token);
  }
  return data;
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { palette } = useTheme();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      // Test connection first
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest) {
        Alert.alert('Connection Error', 'Unable to connect to the server. Please check your internet connection.');
        return;
      }

      const data = await signIn(email, password);
      console.log('Login successful', data);

      // Small delay to allow Supabase to persist session before navigation
      await new Promise(resolve => setTimeout(resolve, 500));

      router.replace('/(tabs)/account');
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Login Error', error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles(palette).container}>
      <View style={styles(palette).headerContainer}>
        <Image source={require("@/assets/images/golf-logo.png")} style={styles(palette).logo} resizeMode="contain" />
        <View style={styles(palette).textContainer}>
          <ThemedText style={styles(palette).title} type="title">Golf</ThemedText>
          <RotatingText texts={["Companion", "Banter", "Stats", "Community"]} rotationInterval={1800} />
        </View>
      </View>
      <Pressable onPress={() => router.replace('/')} style={styles(palette).backButton}>
        <Text style={styles(palette).backButtonText}>{'<'} Back</Text>
      </Pressable>
      <ThemedText type="title" style={styles(palette).title}>
        Welcome Back
      </ThemedText>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        style={styles(palette).input}
        autoCapitalize="none"
        keyboardType="email-address"
        textContentType="emailAddress"
        importantForAutofill="yes"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        style={styles(palette).input}
        textContentType="password"
        importantForAutofill="yes"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <Pressable
        style={({ pressed }) => [
          styles(palette).button,
          pressed && styles(palette).buttonPressed,
          loading && styles(palette).buttonDisabled,
        ]}
        onPress={handleLogin}
        disabled={loading}
      >
        <ThemedText style={styles(palette).buttonText}>
          {loading ? 'Logging in...' : 'Login'}
        </ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/signup')} disabled={loading}>
        <ThemedText style={styles(palette).linkText}>
          Don't have an account? <Text style={styles(palette).linkHighlight}>Sign Up</Text>
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  textContainer: {
    flexDirection: "column",
    justifyContent: "center",
    marginLeft: 10,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 0,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 30,
    
  },
  backButtonText: {
    color: palette.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 5,
    color: palette.primary,
  },
  input: {
    height: 50,
    backgroundColor: palette.white,
    borderRadius: 12,
    paddingHorizontal: 20,
    marginVertical: 12,
    fontSize: 16,
    color: '#222',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  button: {
    backgroundColor: palette.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 30,
    marginBottom: 24,
    shadowColor: palette.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 45,
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: '#3B82F6',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 5 },
      },
    }),
  },
  buttonPressed: {
    backgroundColor: palette.third,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: palette.textLight,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
  },
  linkText: {
    textAlign: 'center',
    color: palette.textLight,
    fontSize: 15,
  },
  linkHighlight: {
    color: palette.primary,
    fontWeight: '600',
  },
});
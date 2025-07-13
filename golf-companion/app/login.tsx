import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error('Login error:', error);
        Alert.alert('Login Failed', error.message);
      } else {
        console.log('Login successful');
        router.replace('/(tabs)/account');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Login Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace('/')} style={styles.backButton}>
        <Text style={styles.backButtonText}>{'<'} Back</Text>
      </Pressable>
      
      <ThemedText type="title" style={styles.title}>
        Welcome Back
      </ThemedText>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        style={styles.input}
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
        style={styles.input}
        textContentType="password"
        importantForAutofill="yes"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleLogin}
        disabled={loading}
      >
        <ThemedText style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Login'}
        </ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/signup')} disabled={loading}>
        <ThemedText style={styles.linkText}>
          Don't have an account? <Text style={styles.linkHighlight}>Sign Up</Text>
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 30,
  },
  backButtonText: {
    color: '#3B82F6',
    fontWeight: 'bold',
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 40,
    color: '#1E3A8A',
  },
  input: {
    height: 50,
    backgroundColor: '#fff',
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
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 30,
    marginBottom: 18,
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
    backgroundColor: '#2563EB',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
  },
  linkText: {
    textAlign: 'center',
    color: '#555',
    fontSize: 15,
  },
  linkHighlight: {
    color: '#3B82F6',
    fontWeight: '600',
  },
});
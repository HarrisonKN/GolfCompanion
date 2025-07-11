// ------------------- IMPORTS -------------------------
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import React, { useState } from 'react';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/components/supabase';

// ------------------- LOGIN LOGIC -------------------------

export default function LoginScreen() {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Login failed', error.message);
    else router.replace('/(tabs)/account');
  };


// ------------------- UI Setup -------------------------
  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace('/')} style={{ marginBottom: 20 }}>
        <Text style={{ color: '#3B82F6', fontWeight: 'bold', fontSize: 16 }}>{'<'} Back</Text>
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
      />

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleLogin}
      >
        <ThemedText style={styles.buttonText}>Login</ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/signup')}>
        <ThemedText style={styles.linkText}>
          Don't have an account? <Text style={styles.linkHighlight}>Sign Up</Text>
        </ThemedText>
      </Pressable>
    </View>
  );
}

// ------------------- UI Styling -------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
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

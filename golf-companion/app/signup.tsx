// ------------------- IMPORTS -------------------------
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';
import * as SecureStore from 'expo-secure-store';

// ------------------- SIGNUP LOGIC -------------------------
export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateInputs = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name.');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email.');
      return false;
    }
    if (!password.trim()) {
      Alert.alert('Validation Error', 'Please enter a password.');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters long.');
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    try {
      // Test connection first
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest) {
        Alert.alert('Connection Error', 'Unable to connect to the server. Please check your internet connection.');
        return;
      }

      console.log('Starting signup process...');
      
      // 1. Sign up user with Supabase auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        Alert.alert('Signup Failed', signUpError.message);
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        Alert.alert('Signup Failed', 'No user ID returned from signup');
        return;
      }

      console.log('User created successfully:', userId);

      // 2. Check if profile already exists to avoid duplicates
      const { data: existingProfiles, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId);

      if (selectError) {
        console.error('Profile check error:', selectError);
        // Don't fail completely, just log the error
      }

      if (!existingProfiles || existingProfiles.length === 0) {
        // 3. Insert new profile if none exists
        console.log('Creating profile for user:', userId);
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          full_name: name,
          email,
          handicap: 0,
          rounds_played: 0,
          average_score: null,
          last_round_course_name: null,
          last_round_date: null,
          last_round_score: null,
        });

        if (insertError) {
          console.error('Profile creation error:', insertError);
          // Handle duplicate key error
          if (insertError.code === '23505') {
            console.log('Profile already exists, skipping insert.');
          } else {
            Alert.alert('Profile Creation Failed', insertError.message);
            return;
          }
        } else {
          console.log('Profile created successfully');
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Signup Successful!',
        text2: 'Welcome to Golf Companion',
        position: 'top',
        visibilityTime: 3000,
      });

      setTimeout(() => {
        router.replace('/(tabs)/account');
      }, 500);

    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert('Signup Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ------------------- SIGNUP UI -------------------------
  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.replace('/')} style={styles.backButton}>
        <Text style={styles.backButtonText}>{'<'} Back</Text>
      </Pressable>

      <ThemedText type="title" style={styles.title}>
        Create Account
      </ThemedText>

      <TextInput
        placeholder="Full Name"
        placeholderTextColor="#888"
        style={styles.input}
        value={name}
        onChangeText={setName}
        editable={!loading}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <TextInput
        placeholder="Password (min 6 characters)"
        placeholderTextColor="#888"
        secureTextEntry
        style={styles.input}
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
        onPress={handleSignup}
        disabled={loading}
      >
        <ThemedText style={styles.buttonText}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/login')} disabled={loading}>
        <ThemedText style={styles.linkText}>
          Already have an account? <Text style={styles.linkHighlight}>Login</Text>
        </ThemedText>
      </Pressable>
    </View>
  );
}

// ------------------- SIGNUP STYLING -------------------------
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

// ------------------- SIGNIN LOGIC -------------------------
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (data.session) {
    await SecureStore.setItemAsync('supabase_session', JSON.stringify(data.session));
  }
  return data;
};
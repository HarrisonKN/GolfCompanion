// ------------------- IMPORTS -------------------------
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/components/supabase';

// ------------------- SIGNUP LOGIC -------------------------

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    try {
      // 1. Sign up user with Supabase auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (signUpError) {
        Alert.alert('Signup failed', signUpError.message);
        return;
      }

      const userId = data?.user?.id;
      if (!userId) {
        Alert.alert('Signup failed', 'No user ID returned');
        return;
      }

      // 2. Check if profile already exists to avoid duplicates
      const { data: existingProfiles, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId);

      if (selectError) {
        Alert.alert('Error', 'Profile Already Exists'); //dont know if this is needed, could be 2 checks already
        return;
      }

      if (existingProfiles.length === 0) {
        // 3. Insert new profile if none exists
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
          // Handle duplicate key error
          if (insertError.code === '23505') {
            console.log('Profile already exists, skipping insert.');
          } else {
            Alert.alert('Profile creation failed', insertError.message);
            return;
          }
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Signup successful!',
        text2: 'Please check your email to confirm.',
        position: 'top',
        visibilityTime: 4000,
      });
      setTimeout(() => {
        router.replace('/(tabs)/account');
      }, 500);
    } finally {
      setLoading(false);
    }
  };


  // ------------------- UI Setup -------------------------
  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Create Account
      </ThemedText>

      <TextInput
        placeholder="Name"
        placeholderTextColor="#888"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleSignup}
        disabled={loading}
      >
        <ThemedText style={styles.buttonText}>
          {loading ? 'Signing up...' : 'Sign Up'}
        </ThemedText>
      </Pressable>

      <Pressable onPress={() => router.push('/login')}>
        <ThemedText style={styles.linkText}>
          Already have an account? <Text style={styles.linkHighlight}>Login</Text>
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

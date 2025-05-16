// src/services/supabase.js

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

// Project credentials
const SUPABASE_URL = "https://mxqhgktcdmymmwbsbfws.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cWhna3RjZG15bW13YnNiZndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1OTIxMTMsImV4cCI6MjA1NDE2ODExM30.7ElhxIdCyfvZEL038YKqoKXUo8P9FQ_TF1EbpiKdPzA";

// Minimalist storage adapter with proper fault isolation
const storageAdapter = {
  getItem: async (key) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Storage retrieval error: ${key}`, error);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      return await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Storage update error: ${key}`, error);
      return undefined;
    }
  },
  removeItem: async (key) => {
    try {
      return await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Storage removal error: ${key}`, error);
      return undefined;
    }
  }
};

// Supabase client with optimized configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Simplified auth storage reset utility
export const resetAuthStorage = async () => {
  const AUTH_KEYS = [
    'supabase.auth.token',
    'supabase.auth.refreshToken', 
    'supabase.auth.data',
    'supabase.auth.access_token',
    'supabase.auth.expires_at',
    'auth.session',
    'auth.refresh_token'
  ];
  
  let successCount = 0;
  for (const key of AUTH_KEYS) {
    try {
      await AsyncStorage.removeItem(key);
      successCount++;
    } catch (error) {
      console.error(`Reset failed for key: ${key}`, error);
    }
  }
  
  return { success: successCount > 0 };
};
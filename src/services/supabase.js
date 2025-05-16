// src/services/supabase.js
//
// Enhanced authentication persistence layer
// Migrated from SecureStore to AsyncStorage for improved initialization reliability

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from "@supabase/supabase-js";
import 'react-native-url-polyfill/auto';

// Project credentials
const SUPABASE_URL = "https://mxqhgktcdmymmwbsbfws.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cWhna3RjZG15bW13YnNiZndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1OTIxMTMsImV4cCI6MjA1NDE2ODExM30.7ElhxIdCyfvZEL038YKqoKXUo8P9FQ_TF1EbpiKdPzA";

/**
 * AsyncStorage adapter with optimized error handling
 * Eliminates initialization race conditions and improves startup performance
 */
const createAsyncStorageAdapter = () => {
  return {
    getItem: async (key) => {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        console.error(`[AsyncStorage] Failed to retrieve key ${key.substring(0, 15)}...`, error);
        return null;
      }
    },
    
    setItem: async (key, value) => {
      try {
        return await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.error(`[AsyncStorage] Failed to store key ${key.substring(0, 15)}...`, error);
        return undefined;
      }
    },
    
    removeItem: async (key) => {
      try {
        return await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error(`[AsyncStorage] Failed to remove key ${key.substring(0, 15)}...`, error);
        return undefined;
      }
    }
  };
};

/**
 * Strategic authentication storage reset utility
 * Provides a fault-tolerant mechanism to clear corrupted auth state
 */
export const resetAuthStorage = async () => {
  // Comprehensive token schema coverage
  const AUTH_KEYS = [
    'supabase.auth.token',
    'supabase.auth.refreshToken',
    'supabase.auth.data',
    // Additional potential token locations
    'supabase.auth.access_token',
    'supabase.auth.expires_at',
    'auth.session',
    'auth.refresh_token'
  ];
  
  console.log('Initiating authentication storage reset...');
  
  let successCount = 0;
  const operationResults = [];
  
  for (const key of AUTH_KEYS) {
    try {
      await AsyncStorage.removeItem(key);
      successCount++;
      operationResults.push({ key, success: true });
    } catch (error) {
      operationResults.push({ 
        key, 
        success: false, 
        errorMessage: error.message 
      });
      console.error(`Failed to reset auth key "${key}":`, error);
    }
  }
  
  // Generate comprehensive reset report
  console.log(`Auth storage reset summary:
    - Total keys attempted: ${AUTH_KEYS.length}
    - Successfully cleared: ${successCount}
    - Status: ${successCount > 0 ? 'PARTIAL_SUCCESS' : 'FAILED'}
  `);
  
  return {
    success: successCount > 0,
    keysAttempted: AUTH_KEYS.length,
    keysCleared: successCount,
    operations: operationResults
  };
};

/**
 * Enhanced Supabase client with unified AsyncStorage persistence
 * Eliminates Keychain initialization issues while maintaining token lifecycle
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: createAsyncStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
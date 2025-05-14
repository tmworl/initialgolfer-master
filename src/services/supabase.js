// src/services/supabase.js

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Import platform-specific secure storage
import * as SecureStore from 'expo-secure-store';
import * as Keychain from 'react-native-keychain';

// Project credentials
const SUPABASE_URL = "https://mxqhgktcdmymmwbsbfws.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cWhna3RjZG15bW13YnNiZndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1OTIxMTMsImV4cCI6MjA1NDE2ODExM30.7ElhxIdCyfvZEL038YKqoKXUo8P9FQ_TF1EbpiKdPzA";

/**
 * Storage Strategy implementation - abstracts platform differences
 * using the Strategy pattern for better maintainability and testability
 */
class StorageStrategies {
  static get strategies() {
    return {
      ios: {
        getItem: async (key) => {
          const credentials = await Keychain.getGenericPassword({ service: key });
          return credentials ? credentials.password : null;
        },
        setItem: async (key, value) => {
          await Keychain.setGenericPassword(key, value, { service: key });
        },
        removeItem: async (key) => {
          await Keychain.resetGenericPassword({ service: key });
        }
      },
      android: {
        getItem: async (key) => SecureStore.getItemAsync(key),
        setItem: async (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: async (key) => SecureStore.deleteItemAsync(key)
      },
      default: {
        getItem: async (key) => AsyncStorage.getItem(key),
        setItem: async (key, value) => AsyncStorage.setItem(key, value),
        removeItem: async (key) => AsyncStorage.removeItem(key)
      }
    };
  }

  static determineStrategy() {
    if (Platform.OS === 'ios') return this.strategies.ios;
    if (Platform.OS === 'android') return this.strategies.android;
    
    console.warn('Using less secure AsyncStorage for auth tokens - no secure storage available for this platform');
    return this.strategies.default;
  }
}

// Select strategy once at initialization rather than on each operation
const storageStrategy = StorageStrategies.determineStrategy();

/**
 * Enhanced storage adapter implementation with centralized error handling
 */
const createSecureStorageAdapter = () => {
  // Centralized error handler to eliminate redundancy
  const handleStorageError = (operation, key, error) => {
    console.error(`Secure storage ${operation} error for key "${key}":`, error);
    return operation === 'get' ? null : undefined;
  };

  return {
    getItem: async (key) => {
      try {
        return await storageStrategy.getItem(key);
      } catch (error) {
        return handleStorageError('get', key, error);
      }
    },
    
    setItem: async (key, value) => {
      try {
        return await storageStrategy.setItem(key, value);
      } catch (error) {
        return handleStorageError('set', key, error);
      }
    },
    
    removeItem: async (key) => {
      try {
        return await storageStrategy.removeItem(key);
      } catch (error) {
        return handleStorageError('remove', key, error);
      }
    }
  };
};

/**
 * Enhanced Supabase client with secure token persistence
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: createSecureStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
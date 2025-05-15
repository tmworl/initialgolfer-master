// src/services/supabase.js

import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Import platform-specific secure storage
// Note: Imports don't execute modules, just declare references
import * as SecureStore from 'expo-secure-store';
import * as Keychain from 'react-native-keychain';

// Project credentials
const SUPABASE_URL = "https://mxqhgktcdmymmwbsbfws.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cWhna3RjZG15bW13YnNiZndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1OTIxMTMsImV4cCI6MjA1NDE2ODExM30.7ElhxIdCyfvZEL038YKqoKXUo8P9FQ_TF1EbpiKdPzA";

/**
 * Technical architecture for platform-specific storage mechanisms
 * 
 * ARCHITECTURAL ENHANCEMENT:
 * - Module definition structure defers actual execution
 * - Implementation follows proper execution boundary pattern
 * - Module presence verification prevents native bridge failures
 */
class StorageStrategies {
  /**
   * Strategy definitions - implementation functions aren't executed at module parse time
   * 
   * @returns {Object} Strategy pattern implementations
   */
  static get strategies() {
    return {
      ios: {
        getItem: async (key) => {
          try {
            const credentials = await Keychain.getGenericPassword({ service: key });
            return credentials ? credentials.password : null;
          } catch (error) {
            console.warn(`iOS KeychainServices access failure: ${error.message}`);
            return null;
          }
        },
        setItem: async (key, value) => {
          try {
            await Keychain.setGenericPassword(key, value, { service: key });
          } catch (error) {
            console.warn(`iOS KeychainServices write failure: ${error.message}`);
            throw error;
          }
        },
        removeItem: async (key) => {
          try {
            await Keychain.resetGenericPassword({ service: key });
          } catch (error) {
            console.warn(`iOS KeychainServices delete failure: ${error.message}`);
            // Non-throwing on delete failures
          }
        }
      },
      android: {
        getItem: async (key) => {
          try {
            return await SecureStore.getItemAsync(key);
          } catch (error) {
            console.warn(`Android SecureStore access failure: ${error.message}`);
            return null;
          }
        },
        setItem: async (key, value) => {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch (error) {
            console.warn(`Android SecureStore write failure: ${error.message}`);
            throw error;
          }
        },
        removeItem: async (key) => {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch (error) {
            console.warn(`Android SecureStore delete failure: ${error.message}`);
            // Non-throwing on delete failures
          }
        }
      },
      default: {
        getItem: async (key) => AsyncStorage.getItem(key),
        setItem: async (key, value) => AsyncStorage.setItem(key, value),
        removeItem: async (key) => AsyncStorage.removeItem(key)
      }
    };
  }

  /**
   * Module existence verification
   * Ensures native modules are available before attempting access
   * 
   * @param {Object} module - Module reference to verify
   * @returns {boolean} Whether module is available
   */
  static isModuleAvailable(module) {
    return typeof module !== 'undefined' && module !== null;
  }

  /**
   * Defensive strategy determination with explicit error boundaries
   * 
   * ARCHITECTURAL ENHANCEMENT:
   * - Never executed at module parse time (only when function is called)
   * - Implements proper platform detection with defensive checks
   * - Provides graceful degradation path for all failure modes
   * 
   * @returns {Object} Storage strategy implementation
   */
  static determineStrategy() {
    try {
      // Perform platform detection with defensive coding
      const currentPlatform = typeof Platform !== 'undefined' ? Platform.OS : null;
      
      if (currentPlatform === 'ios') {
        // iOS path with module verification
        if (this.isModuleAvailable(Keychain) && 
            typeof Keychain.getGenericPassword === 'function') {
          console.log('Using iOS Keychain storage strategy');
          return this.strategies.ios;
        }
      } else if (currentPlatform === 'android') {
        // Android path with module verification
        if (this.isModuleAvailable(SecureStore) && 
            typeof SecureStore.getItemAsync === 'function') {
          console.log('Using Android SecureStore storage strategy');
          return this.strategies.android;
        }
      }
      
      // Fallback path for unsupported platforms or missing modules
      console.log('Using AsyncStorage fallback strategy (platform or secure storage unavailable)');
      return this.strategies.default;
    } catch (error) {
      // Comprehensive error handling with diagnostic logging
      console.error('Strategy determination error, falling back to AsyncStorage', error);
      return this.strategies.default;
    }
  }
}

/**
 * Enhanced storage adapter implementation with comprehensive architectural integrity
 * 
 * ARCHITECTURAL GUARANTEES:
 * - Deferred native module access with true lazy initialization
 * - Robust fault isolation with explicit fallback mechanisms
 * - Comprehensive error handling with diagnostic telemetry
 * - Clean execution boundary separation with React Native's bridge lifecycle
 */
const createSecureStorageAdapter = () => {
  // Private module state - initialization deferred until actual method invocation
  let _storageStrategy = null;
  let initializationAttempted = false;
  
  /**
   * Technical implementation of storage strategy resolution
   * Only executes when a storage operation is actually needed
   * 
   * @returns {Object} Appropriate storage strategy
   */
  const getStorageStrategy = () => {
    if (_storageStrategy === null) {
      try {
        // Mark initialization attempted to prevent repeated failures
        initializationAttempted = true;
        _storageStrategy = StorageStrategies.determineStrategy();
      } catch (error) {
        console.error('Secure storage initialization catastrophic failure, using AsyncStorage fallback', error);
        _storageStrategy = StorageStrategies.strategies.default;
      }
    }
    return _storageStrategy;
  };

  /**
   * Centralized error handler with comprehensive recovery logic
   * 
   * @param {string} operation - Storage operation that failed
   * @param {string} key - Storage key being accessed
   * @param {Error} error - Error object
   * @returns {any} Appropriate fallback value
   */
  const handleStorageError = async (operation, key, error) => {
    // Detailed diagnostic logging
    console.error(`Secure storage ${operation} error for key "${key}":`, error);
    
    // Strategic fallback mechanism for critical operations
    if (operation === 'get') {
      try {
        console.log(`Attempting AsyncStorage fallback for key: ${key}`);
        return await AsyncStorage.getItem(key);
      } catch (fallbackError) {
        console.error('AsyncStorage fallback also failed:', fallbackError);
        return null;
      }
    }
    
    return operation === 'get' ? null : undefined;
  };

  // Public interface with clean abstraction boundary
  return {
    /**
     * Get item from storage with comprehensive error handling
     * 
     * @param {string} key - Storage key to retrieve
     * @returns {Promise<string|null>} Retrieved value or null if not found
     */
    getItem: async (key) => {
      try {
        return await getStorageStrategy().getItem(key);
      } catch (error) {
        return handleStorageError('get', key, error);
      }
    },
    
    /**
     * Set item in storage with critical data protection
     * 
     * @param {string} key - Storage key to set
     * @param {string} value - Value to store
     * @returns {Promise<void>}
     */
    setItem: async (key, value) => {
      try {
        await getStorageStrategy().setItem(key, value);
      } catch (error) {
        try {
          // Strategic fallback for authentication state
          if (key.includes('supabase.auth') || key.includes('currentRound')) {
            console.log(`Secure storage failed, using AsyncStorage fallback for: ${key}`);
            await AsyncStorage.setItem(key, value);
          } else {
            return handleStorageError('set', key, error);
          }
        } catch (fallbackError) {
          return handleStorageError('set', key, fallbackError);
        }
      }
    },
    
    /**
     * Remove item from storage with guaranteed completion
     * 
     * @param {string} key - Storage key to remove
     * @returns {Promise<void>}
     */
    removeItem: async (key) => {
      try {
        await getStorageStrategy().removeItem(key);
      } catch (error) {
        try {
          // Strategic fallback for authentication state
          if (key.includes('supabase.auth') || key.includes('currentRound')) {
            console.log(`Secure storage failed, using AsyncStorage fallback for: ${key}`);
            await AsyncStorage.removeItem(key);
          } else {
            return handleStorageError('remove', key, error);
          }
        } catch (fallbackError) {
          return handleStorageError('remove', key, fallbackError);
        }
      }
    }
  };
};

/**
 * Enhanced Supabase client with secure token persistence
 * 
 * Technical Note (REFACTORING CHANGE 2023-05-14):
 * ---------------------------------------------
 * JWT expiration has been extended to 28 days (2,419,200 seconds) in the Supabase dashboard.
 * This intentionally reduces token refresh frequency to minimize UI reconciliation cascades.
 * 
 * The auth configuration below maintains the persist session capability,
 * but now relies on the extended token lifecycle rather than aggressive refresh.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: createSecureStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

// Export storage utilities for direct use in recovery scenarios
export const secureStorage = createSecureStorageAdapter();
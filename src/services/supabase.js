// src/services/supabase.js

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// Project credentials
const SUPABASE_URL = "https://mxqhgktcdmymmwbsbfws.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cWhna3RjZG15bW13YnNiZndzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg1OTIxMTMsImV4cCI6MjA1NDE2ODExM30.7ElhxIdCyfvZEL038YKqoKXUo8P9FQ_TF1EbpiKdPzA";

/**
 * Storage subsystem health verification
 * Performs a storage subsystem integrity check to validate operational status
 */
const verifyStorageSubsystem = async () => {
  const testKey = `storage.healthcheck.${Date.now()}`;
  const testValue = `verify-${Date.now()}`;
  
  try {
    // Attempt write-read-delete cycle to verify subsystem integrity
    await SecureStore.setItemAsync(testKey, testValue);
    const retrieved = await SecureStore.getItemAsync(testKey);
    await SecureStore.deleteItemAsync(testKey);
    
    // Verify data integrity
    const subsystemHealthy = retrieved === testValue;
    console.log(`Storage subsystem health check: ${subsystemHealthy ? 'PASSED' : 'FAILED'}`);
    return subsystemHealthy;
  } catch (error) {
    console.error('Storage subsystem verification failed:', error);
    return false;
  }
};

/**
 * Enhanced secure storage adapter with comprehensive error handling
 * Provides a robust bridge between Supabase auth and secure storage
 */
const createSecureStorageAdapter = () => {
  // Perform storage health check at initialization
  verifyStorageSubsystem().catch(e => 
    console.error('Storage initialization check failed:', e)
  );
  
  // Centralized error handler with telemetry instrumentation
  const handleStorageError = (operation, key, error) => {
    // Generate diagnostic signature for error analysis
    const errorSignature = {
      operation,
      key: key.substring(0, 15) + '...', // Truncate for privacy
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      platformVersion: Platform.Version
    };
    
    console.error(`[SecureStorage:${operation}] Operation failed:`, errorSignature);
    
    // Return appropriate fallback value based on operation type
    return operation === 'get' ? null : undefined;
  };

  return {
    getItem: async (key) => {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        return handleStorageError('get', key, error);
      }
    },
    
    setItem: async (key, value) => {
      try {
        return await SecureStore.setItemAsync(key, value);
      } catch (error) {
        return handleStorageError('set', key, error);
      }
    },
    
    removeItem: async (key) => {
      try {
        return await SecureStore.deleteItemAsync(key);
      } catch (error) {
        return handleStorageError('remove', key, error);
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
      await SecureStore.deleteItemAsync(key);
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
 * Enhanced Supabase client with unified secure token persistence
 * Standardizes on expo-secure-store for cross-platform token storage
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: createSecureStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
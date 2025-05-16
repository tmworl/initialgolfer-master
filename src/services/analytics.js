// src/services/analytics.js

import { supabase } from './supabase';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configuration
const EVENT_BUFFER_KEY = '@GolfApp:analytics_buffer';
const APP_VERSION = Constants.manifest?.version || '1.1.4';

// Singleton state
let currentUserId = null;
let eventBuffer = [];
let isInitialized = false;

// Error tracking constants
export const ERROR_TYPES = {
  ROUND_COMPLETION_ERROR: 'round_completion_error',
  DATA_PERSISTENCE_ERROR: 'data_persistence_error',
  API_ERROR: 'api_error',
  NAVIGATION_ERROR: 'navigation_error'
};

// Event constants for consistent naming across application
export const EVENTS = {
  ROUND_ENTITY_CREATED: 'round_entity_created',
  ROUND_ENTITY_DELETED: 'round_entity_deleted',
  ERROR_OCCURRED: 'error_occurred' // New event type for error tracking
};

/**
 * Initialize analytics service with user identity
 * 
 * @param {string} userId - User identifier
 */
export async function initAnalytics(userId) {
  if (!userId) {
    console.warn('[Analytics] Invalid user ID provided for initialization');
    return;
  }
  
  currentUserId = userId;
  isInitialized = true;
  
  console.log(`[Analytics] Initialized for user: ${userId}`);
  
  await restoreEventBuffer();
  processEventBuffer();
}

/**
 * Track error events via the existing tracking infrastructure
 * 
 * @param {string} errorType - The type of error from ERROR_TYPES
 * @param {Error|string} error - The error object or message
 * @param {Object} context - Additional context about the error
 * @returns {Promise<boolean>} Success indicator
 */
export async function trackError(errorType, error, context = {}) {
  if (!ERROR_TYPES[errorType]) {
    console.warn('[Analytics] Invalid error type:', errorType);
    return false;
  }

  // Extract basic error info
  const errorInfo = {
    message: error?.message || String(error),
    stack: error?.stack,
    name: error?.name || 'Error',
    type: errorType
  };
  
  // Create the error event payload
  const properties = {
    ...context,
    ...errorInfo,
    timestamp: Date.now(),
    app_version: APP_VERSION
  };
  
  // Use existing trackEvent infrastructure
  return await trackEvent(EVENTS.ERROR_OCCURRED, properties);
}

/**
 * Track an event via Supabase Edge Function
 * 
 * @param {string} eventName - Event name to track
 * @param {object} properties - Event properties
 * @returns {Promise<boolean>} Success indicator
 */
export async function trackEvent(eventName, properties = {}) {
  if (!eventName) {
    console.error('[Analytics] Invalid event name');
    return false;
  }
  
  const eventData = {
    name: eventName,
    properties: {
      ...properties,
      distinct_id: currentUserId,
      app_version: APP_VERSION,
      platform: Platform.OS,
      platform_version: Platform.Version,
      environment: __DEV__ ? 'development' : 'production',
      client_timestamp: new Date().toISOString()
    },
    timestamp: Date.now()
  };
  
  console.log(`[Analytics] Event: ${eventName}`, properties);
  
  if (!isInitialized || !currentUserId) {
    console.log(`[Analytics] Not initialized, buffering event: ${eventName}`);
    return bufferEvent(eventData);
  }
  
  const networkState = await NetInfo.fetch();
  
  if (!networkState.isConnected) {
    console.log(`[Analytics] Device offline, buffering event: ${eventName}`);
    return bufferEvent(eventData);
  }
  
  return sendEvent(eventData);
}

/**
 * Send event to PostHog via Edge Function
 * 
 * @param {object} eventData - Event data to send
 * @returns {Promise<boolean>} Success indicator
 */
async function sendEvent(eventData) {
  try {
    const { data, error } = await supabase.functions.invoke('track-analytics', {
      body: { 
        event: eventData.name, 
        properties: eventData.properties 
      }
    });
    
    if (error) {
      console.error(`[Analytics] Error sending event:`, error);
      bufferEvent(eventData);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`[Analytics] Failed to send event:`, err);
    bufferEvent(eventData);
    return false;
  }
}

/**
 * Buffer event for later sending
 * 
 * @param {object} eventData - Event to buffer
 * @returns {Promise<boolean>} Success indicator
 */
async function bufferEvent(eventData) {
  try {
    eventBuffer.push(eventData);
    await AsyncStorage.setItem(EVENT_BUFFER_KEY, JSON.stringify(eventBuffer));
    return true;
  } catch (error) {
    console.error('[Analytics] Failed to buffer event:', error);
    return false;
  }
}

/**
 * Restore event buffer from persistent storage
 */
async function restoreEventBuffer() {
  try {
    const storedBuffer = await AsyncStorage.getItem(EVENT_BUFFER_KEY);
    if (storedBuffer) {
      eventBuffer = JSON.parse(storedBuffer);
      console.log(`[Analytics] Restored ${eventBuffer.length} buffered events`);
    }
  } catch (error) {
    console.error('[Analytics] Failed to restore event buffer:', error);
  }
}

/**
 * Process buffered events
 */
async function processEventBuffer() {
  if (!isInitialized || eventBuffer.length === 0) {
    return;
  }
  
  console.log(`[Analytics] Processing ${eventBuffer.length} buffered events`);
  
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) {
    console.log('[Analytics] Device offline, cannot process buffer');
    return;
  }
  
  const successfulEvents = [];
  
  for (const event of eventBuffer) {
    try {
      const success = await sendEvent(event);
      if (success) {
        successfulEvents.push(event);
      }
    } catch (error) {
      console.error(`[Analytics] Error processing buffered event:`, error);
    }
  }
  
  if (successfulEvents.length > 0) {
    eventBuffer = eventBuffer.filter(event => !successfulEvents.includes(event));
    await AsyncStorage.setItem(EVENT_BUFFER_KEY, JSON.stringify(eventBuffer));
    console.log(`[Analytics] Processed ${successfulEvents.length} buffered events, ${eventBuffer.length} remaining`);
  }
}
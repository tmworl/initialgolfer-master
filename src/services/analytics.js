// src/services/analytics.js
// 
// Enhanced analytics service with improved auth event tracking
// Fully integrated with PostHog analytics via the track-analytics edge function

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase'; // Import Supabase client

// Initialize analytics state
let initialized = false;
let userId = null;
let deviceInfo = null;

// Define error type constants for tracking
export const ERROR_TYPES = {
  ROUND_COMPLETION_ERROR: 'round_completion_error',
  DATA_PERSISTENCE_ERROR: 'data_persistence_error',
  API_ERROR: 'api_error',
  NAVIGATION_ERROR: 'navigation_error',
  AUTH_SESSION_ERROR: 'auth_session_error',
  AUTH_PERMISSION_ERROR: 'auth_permission_error',
  AUTH_TOKEN_ERROR: 'auth_token_error',
  AUTH_TIMEOUT_ERROR: 'auth_timeout_error'
};

// Define event type constants for tracking
export const EVENTS = {
  // Auth events
  AUTH_STATE_CHANGED: 'auth_state_changed',
  AUTH_STATE_TRANSITION: 'auth_state_transition',
  
  // Round events
  ROUND_ENTITY_CREATED: 'round_entity_created',
  ROUND_COMPLETED: 'round_completed',
  ROUND_ABANDONED: 'round_abandoned',
  
  // Data events
  HOLE_DATA_SAVED: 'hole_data_saved',
  ROUND_DATA_FETCHED: 'round_data_fetched',
  
  // Transaction events
  TRANSACTION_STARTED: 'transaction_started',
  TRANSACTION_COMMITTED: 'transaction_committed',
  TRANSACTION_COMPLETED: 'transaction_completed',
  TRANSACTION_RECOVERED: 'transaction_recovered',
  TRANSACTION_FAILED: 'transaction_failed',
  
  // Insights events
  INSIGHTS_GENERATED: 'insights_generated'
};

/**
 * Initialize analytics with user information
 * Sets up device metadata for consistent tracking
 * 
 * @param {string} id - User ID for analytics tracking
 */
export const initAnalytics = async (id) => {
  if (!id) return;
  
  userId = id;
  
  // Collect device information for tracking context
  deviceInfo = {
    model: Device.modelName,
    deviceType: Device.deviceType,
    osName: Platform.OS,
    osVersion: Platform.Version,
    appVersion: Device.osVersion,
    brand: Device.brand
  };
  
  initialized = true;
  
  // Track analytics initialization
  await trackEvent('analytics_initialized', {
    device_info: deviceInfo
  });
};

/**
 * Track an error event
 * 
 * ARCHITECTURAL REFACTORING:
 * - Restructured to maintain critical error tracking
 * - Removed token refresh error tracking
 * 
 * @param {string} type - Error type constant
 * @param {Error} error - Error object
 * @param {Object} metadata - Additional error context
 */
export const trackError = async (type, error, metadata = {}) => {
  if (!initialized) {
    console.error(`[Analytics] Error tracked before initialization: ${type}`);
    console.error(error);
    return;
  }
  
  try {
    // Don't track TOKEN_REFRESHED errors - architectural change
    if (metadata.auth_event === 'TOKEN_REFRESHED') {
      return;
    }
    
    // Prepare error data
    const errorData = {
      error_type: type,
      message: error.message,
      stack: error.stack,
      ...metadata,
      device_info: deviceInfo,
      timestamp: new Date().toISOString()
    };
    
    console.error(`[Analytics] Error: ${type}`, errorData);
    
    // Send to server
    await sendToAnalyticsService('error_occurred', errorData);
    
  } catch (err) {
    // Fallback error logging if analytics fails
    console.error('Failed to track error:', err);
    console.error('Original error:', { type, message: error.message, metadata });
  }
};

/**
 * Track an application event
 * 
 * ARCHITECTURAL REFACTORING:
 * - Removed TOKEN_REFRESHED event tracking
 * - Added support for transaction lifecycle events
 * 
 * @param {string} eventName - Event name
 * @param {Object} properties - Event properties
 */
export const trackEvent = async (eventName, properties = {}) => {
  // Skip tracking for TOKEN_REFRESHED events - architectural change
  if (eventName === 'auth_state_changed' && properties.event === 'TOKEN_REFRESHED') {
    return;
  }
  
  try {
    // Add common properties
    const eventProperties = {
      ...properties,
      device_info: deviceInfo,
      platform: Platform.OS,
      distinct_id: userId || 'anonymous',
      timestamp: new Date().toISOString()
    };
    
    console.log(`[Analytics] Event: ${eventName}`, eventProperties);
    
    // Send to server
    await sendToAnalyticsService(eventName, eventProperties);
    
  } catch (err) {
    console.error(`Failed to track event ${eventName}:`, err);
  }
};

/**
 * Send event to analytics service
 * 
 * @param {string} event - Event name
 * @param {Object} properties - Event properties
 */
const sendToAnalyticsService = async (event, properties) => {
  try {
    // Use Supabase edge function for analytics
    await supabase.functions.invoke('track-analytics', {
      body: { event, properties }
    });
  } catch (error) {
    console.error('Error sending to analytics service:', error);
  }
};

export default {
  initAnalytics,
  trackEvent,
  trackError,
  ERROR_TYPES,
  EVENTS
};
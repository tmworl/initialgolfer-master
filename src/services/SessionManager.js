// src/services/SessionManager.js
//
// Authentication session boundary management with simplified architecture
// ARCHITECTURAL REFACTORING: Eliminated complex state tracking mechanisms

import { AppState } from 'react-native';
import { trackEvent } from './analytics';

/**
 * SessionManager Class
 * 
 * Simplified implementation that properly isolates auth events
 * from application state changes.
 */
class SessionManager {
  constructor() {
    this.appState = AppState.currentState;
    this.appStateSubscription = null;
    
    // Initialize app state monitoring
    this.initAppStateMonitoring();
  }
  
  /**
   * Initialize AppState monitoring for foreground/background transitions
   */
  initAppStateMonitoring() {
    // Subscribe to AppState changes
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange
    );
  }
  
  /**
   * Handle app state changes (foreground/background)
   */
  handleAppStateChange = (nextAppState) => {
    // Filter transition events (active => background or background => active)
    if (
      (this.appState === 'active' && nextAppState.match(/inactive|background/)) ||
      (this.appState.match(/inactive|background/) && nextAppState === 'active')
    ) {
      // Track app state transition
      trackEvent('app_state_changed', {
        previous_state: this.appState,
        current_state: nextAppState,
        timestamp: new Date().toISOString()
      });
    }
    
    // Update stored app state
    this.appState = nextAppState;
  };
  
  /**
   * Determine if an auth event should be processed
   * 
   * ARCHITECTURAL REFACTORING: 
   * Always filter out TOKEN_REFRESHED events to prevent
   * unnecessary state updates and UI reconciliation.
   * 
   * @param {string} eventType - Auth event type from Supabase
   * @returns {boolean} Whether the event should be processed
   */
  shouldProcessAuthEvent(eventType) {
    // Never process TOKEN_REFRESHED events - core architectural change
    if (eventType === 'TOKEN_REFRESHED') {
      return false;
    }
    
    // Always process critical auth events
    return true;
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    // Remove app state subscription
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

// Export singleton instance
export default new SessionManager();
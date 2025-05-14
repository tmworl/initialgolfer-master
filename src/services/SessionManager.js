// src/services/SessionManager.js

import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from './analytics';

// Singleton instance pattern
let instance = null;

/**
 * SessionManager
 * 
 * Manages authentication lifecycles with context-awareness of application state
 * and user journeys. Implements the Context-Aware Session Boundary pattern to
 * prevent authentication events from disrupting critical user flows.
 */
class SessionManager {
  constructor() {
    if (instance) {
      return instance;
    }
    
    // Initialize state
    this.activeRound = false;
    this.lastTokenRefresh = null;
    this.appState = AppState.currentState;
    this.suppressNextTokenRefresh = false;
    this.criticalOperationInProgress = false;
    
    // Register for app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    // Track backlogged events
    this.pendingEvents = [];
    
    // Restore state from persistent storage
    this.restoreState();
    
    instance = this;
  }
  
  /**
   * Restore session state from persistent storage
   * Ensures journey boundaries persist across app restarts
   */
  async restoreState() {
    try {
      const storedState = await AsyncStorage.getItem('@GolfApp:sessionManagerState');
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        this.activeRound = parsedState.activeRound || false;
        this.lastTokenRefresh = parsedState.lastTokenRefresh || null;
        
        console.log('[SessionManager] Restored state:', 
          { activeRound: this.activeRound, lastRefresh: this.lastTokenRefresh });
      }
    } catch (error) {
      console.error('[SessionManager] Failed to restore state:', error);
    }
  }
  
  /**
   * Persist session state to storage
   * Critical for maintaining journey boundaries across app restarts
   */
  async persistState() {
    try {
      const stateToStore = {
        activeRound: this.activeRound,
        lastTokenRefresh: this.lastTokenRefresh
      };
      
      await AsyncStorage.setItem(
        '@GolfApp:sessionManagerState', 
        JSON.stringify(stateToStore)
      );
    } catch (error) {
      console.error('[SessionManager] Failed to persist state:', error);
    }
  }
  
  /**
   * Handle application state transitions
   * Critical for managing authentication behavior during app lifecycle events
   */
  handleAppStateChange = (nextAppState) => {
    const previousState = this.appState;
    this.appState = nextAppState;
    
    console.log(
      `[SessionManager] App state changed: ${previousState} -> ${nextAppState}`, 
      { activeRound: this.activeRound }
    );
    
    // If app returns to foreground during active round, suppress token validation
    if (
      (previousState === 'background' || previousState === 'inactive') && 
      nextAppState === 'active' && 
      this.activeRound
    ) {
      console.log('[SessionManager] Suppressing next token refresh due to foreground transition during active round');
      this.suppressNextTokenRefresh = true;
      
      trackEvent('session_manager_foreground_suppression', {
        active_round: this.activeRound,
        last_refresh_age: this.lastTokenRefresh ? (Date.now() - this.lastTokenRefresh) : null
      });
    }
  }
  
  /**
   * Start tracking a round - establishes a critical user journey boundary
   * Preemptively refreshes token to maximize valid time during the round
   */
  async startRound() {
    console.log('[SessionManager] Round started - establishing session boundary');
    this.activeRound = true;
    
    // Persist active round state
    await this.persistState();
    
    // Preemptively refresh token to ensure maximum validity period
    await this.preemptiveTokenRefresh();
    
    trackEvent('session_manager_round_started', {
      token_refreshed: this.lastTokenRefresh ? 'yes' : 'no',
      token_age: this.lastTokenRefresh ? (Date.now() - this.lastTokenRefresh) : null
    });
  }
  
  /**
   * End round tracking - releases the critical user journey boundary
   * Processes any backlogged auth events
   */
  async endRound() {
    console.log('[SessionManager] Round ended - releasing session boundary');
    this.activeRound = false;
    
    // Persist state change
    await this.persistState();
    
    // Process any backlogged events
    if (this.pendingEvents.length > 0) {
      console.log(`[SessionManager] Processing ${this.pendingEvents.length} backlogged events`);
      // Events get handled on next auth cycle
      this.pendingEvents = [];
    }
    
    trackEvent('session_manager_round_ended', {
      round_duration: this.lastTokenRefresh ? (Date.now() - this.lastTokenRefresh) : null,
      pending_events: this.pendingEvents.length
    });
  }
  
  /**
   * Begin critical operation (like round completion)
   * Prevents auth events from interrupting sensitive data operations
   */
  startCriticalOperation() {
    this.criticalOperationInProgress = true;
    console.log('[SessionManager] Critical operation started - suppressing auth events');
  }
  
  /**
   * End critical operation
   * Releases the critical operation boundary
   */
  endCriticalOperation() {
    this.criticalOperationInProgress = false;
    console.log('[SessionManager] Critical operation ended - auth events normalized');
  }
  
  /**
   * Force token refresh before entering a critical flow
   * Preemptively maximizes token validity time
   */
  async preemptiveTokenRefresh() {
    try {
      // Only refresh if token is older than 5 minutes or doesn't exist
      const shouldRefresh = !this.lastTokenRefresh || 
                           (Date.now() - this.lastTokenRefresh) > 300000;
      
      if (shouldRefresh) {
        console.log('[SessionManager] Performing preemptive token refresh');
        
        // Get supabase client from the service
        const { supabase } = require('./supabase');
        
        // Force token refresh
        const { data, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('[SessionManager] Preemptive refresh failed:', error);
          return false;
        }
        
        this.lastTokenRefresh = Date.now();
        await this.persistState();
        
        console.log('[SessionManager] Preemptive refresh successful');
        return true;
      }
      
      console.log('[SessionManager] Preemptive refresh skipped - token recently refreshed');
      return true;
    } catch (error) {
      console.error('[SessionManager] Preemptive refresh exception:', error);
      return false;
    }
  }
  
  /**
   * Determines if an auth event should be processed now or suppressed
   * Core of the Context-Aware Session Boundary pattern
   */
  shouldProcessAuthEvent(event) {
    // Critical events should always be processed
    if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
      return true;
    }
    
    // During active round, suppress token refresh cascades
    if (this.activeRound && event === 'TOKEN_REFRESHED') {
      console.log('[SessionManager] Suppressing token refresh cascade during active round');
      
      // Track suppressed event for debugging
      this.pendingEvents.push({
        type: event,
        timestamp: Date.now(),
        suppressed_reason: 'active_round'
      });
      
      trackEvent('token_refresh_suppressed', {
        reason: 'active_round',
        app_state: this.appState,
        token_age: this.lastTokenRefresh ? (Date.now() - this.lastTokenRefresh) : null
      });
      
      return false;
    }
    
    // If a critical operation is in progress, suppress non-critical events
    if (this.criticalOperationInProgress && event !== 'SIGNED_OUT') {
      console.log('[SessionManager] Suppressing auth event during critical operation:', event);
      
      this.pendingEvents.push({
        type: event,
        timestamp: Date.now(),
        suppressed_reason: 'critical_operation'
      });
      
      return false;
    }
    
    // If returning to foreground, suppress first token event if flagged
    if (this.suppressNextTokenRefresh) {
      console.log('[SessionManager] Suppressing foreground token refresh');
      this.suppressNextTokenRefresh = false;
      
      trackEvent('token_refresh_suppressed', {
        reason: 'app_foregrounded',
        app_state: this.appState,
        active_round: this.activeRound
      });
      
      return false;
    }
    
    return true;
  }
  
  /**
   * Cleanup method to prevent memory leaks
   */
  cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

// Export singleton instance
export default new SessionManager();
// src/context/AuthContext.js

import React, { createContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { supabase } from "../services/supabase";
import { initAnalytics, trackError as analyticsTrackError, trackEvent as analyticsTrackEvent } from "../services/analytics";
import SessionManager from "../services/SessionManager";

// Create navigation reference for cross-component navigation capabilities
export const navigationRef = createNavigationContainerRef();

// Create an authentication context
export const AuthContext = createContext();

// Auth event tracking constants
const AUTH_EVENTS = {
  AUTH_STATE_TRANSITION: 'auth_state_transition'
};

const AUTH_ERROR_TYPES = {
  AUTH_TIMEOUT_ERROR: 'auth_timeout_error',
  AUTH_SESSION_ERROR: 'auth_session_error',
  AUTH_PERMISSION_ERROR: 'auth_permission_error',
  AUTH_TOKEN_ERROR: 'auth_token_error'
};

// Utility functions that connect to the analytics service
const trackError = (type, error, metadata = {}) => {
  console.error(`[${type}]`, error, metadata);
  // Send to analytics service if available
  if (typeof analyticsTrackError === 'function') {
    analyticsTrackError(type, error, metadata);
  }
};

const trackEvent = (eventName, data = {}) => {
  console.log(`[${eventName}]`, data);
  // Send to analytics service if available
  if (typeof analyticsTrackEvent === 'function') {
    analyticsTrackEvent(eventName, data);
  }
};

/**
 * Email verification utility
 * Determines if a user has verified their email based on presence of email_confirmed_at
 */
const checkEmailVerification = (userData) => {
  return userData && userData.email_confirmed_at ? true : false;
};

/**
 * AuthProvider Component
 * 
 * Enhanced with context-aware session management and event differentiation
 */
export const AuthProvider = ({ children }) => {
  // Authentication state
  const [user, setUser] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  
  // Session restoration state
  const [sessionRestored, setSessionRestored] = useState(false);

  /**
   * Navigation handler for successful verification
   * Memoized to prevent unnecessary re-renders
   */
  const handleSuccessfulVerification = useCallback(() => {
    console.log("Email verified successfully, initiating navigation transition");
    
    trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
      from_state: 'email_verified',
      to_state: 'navigating',
      timestamp: Date.now()
    });
    
    // Validate navigation ref to prevent runtime errors
    if (navigationRef.isReady()) {
      try {
        // Reset navigation stack to ensure clean navigation state
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: 'Main' }],
        });
        console.log("Navigation successfully transitioned to Main route");
        
        trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
          from_state: 'navigating',
          to_state: 'navigation_complete',
          timestamp: Date.now()
        });
      } catch (navError) {
        console.error("Navigation transition failed:", navError);
        trackError(AUTH_ERROR_TYPES.AUTH_SESSION_ERROR, navError, {
          operation: 'navigation_transition',
          critical: true
        });
        // Graceful degradation - verification state will still be picked up by AppNavigator
      }
    } else {
      console.log("Navigation reference not ready, verification state will be handled by AppNavigator");
      trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
        from_state: 'email_verified',
        to_state: 'waiting_for_navigator',
        timestamp: Date.now()
      });
    }
  }, []);

  /**
   * Load user permissions from the database
   * This is a critical operation that must execute after authentication
   */
  const loadUserPermissions = async (userId) => {
    if (!userId) {
      trackError(AUTH_ERROR_TYPES.AUTH_PERMISSION_ERROR, 
        new Error("Attempted to load permissions with no userId"),
        { critical: true });
      return;
    }
    
    try {
      trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
        from_state: 'permissions_unloaded',
        to_state: 'permissions_loading',
        user_id: userId,
        timestamp: Date.now()
      });
      
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("profile_id", userId)
        .eq("active", true);
        
      if (error) {
        trackError(AUTH_ERROR_TYPES.AUTH_PERMISSION_ERROR, error, {
          operation: 'permissions_query',
          user_id: userId
        });
        
        // Critical change: Update state with empty permissions to prevent blocked UI
        setUserPermissions([]);
        
        trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
          from_state: 'permissions_loading',
          to_state: 'permissions_error',
          user_id: userId,
          timestamp: Date.now()
        });
        
        return;
      }
      
      console.log("Loaded permissions:", data?.length);
      setUserPermissions(data || []);
      
      trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
        from_state: 'permissions_loading',
        to_state: 'permissions_loaded',
        permissions_count: data?.length || 0,
        user_id: userId,
        timestamp: Date.now()
      });
    } catch (err) {
      trackError(AUTH_ERROR_TYPES.AUTH_PERMISSION_ERROR, err, {
        operation: 'permissions_loading',
        user_id: userId
      });
      
      // Critical change: Update state with empty permissions to prevent blocked UI
      setUserPermissions([]);
    }
  };

  /**
   * Permission checking utility
   * Memoized for performance optimization
   */
  const hasPermission = useCallback((productId) => {
    return userPermissions.some(
      permission => permission.permission_id === productId && permission.active
    );
  }, [userPermissions]);

  /**
   * Deep link handler
   * Process verification callbacks from email links
   */
  const handleDeepLink = async (event) => {
    const url = event?.url || event;
    if (!url) return;

    console.log("Received deep link:", url);
    
    // Check if this is a verification callback URL
    if (url.startsWith("mygolfapp://login-callback")) {
      console.log("Processing verification deep link");
      
      trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
        from_state: 'deeplink_received',
        to_state: 'processing_verification',
        url: url,
        timestamp: Date.now()
      });
      
      try {
        // Refresh the auth state to get the updated verification status
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error("Error refreshing session:", refreshError);
          trackError(AUTH_ERROR_TYPES.AUTH_SESSION_ERROR, refreshError, {
            operation: 'refresh_session',
            url: url
          });
          return;
        }
        
        if (data?.session?.user) {
          setUser(data.session.user);
          
          // Check if email is now verified
          const isVerified = checkEmailVerification(data.session.user);
          setEmailVerified(isVerified);
          
          trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
            from_state: 'processing_verification',
            to_state: isVerified ? 'verification_confirmed' : 'verification_pending',
            timestamp: Date.now()
          });
          
          // Load user permissions
          await loadUserPermissions(data.session.user.id);
          
          if (isVerified && pendingVerificationEmail) {
            console.log("Email verification confirmed - transitioning authentication state");
            // Clear pending verification state
            setPendingVerificationEmail(null);
            await AsyncStorage.removeItem('@GolfApp:pendingVerificationEmail');
            
            // Trigger navigation to main app
            handleSuccessfulVerification();
          }
        }
      } catch (err) {
        console.error("Error processing verification link:", err);
        trackError(AUTH_ERROR_TYPES.AUTH_SESSION_ERROR, err, {
          operation: 'process_verification_link',
          url: url
        });
      }
    }
  };

  /**
   * Authentication initialization and session restoration
   * Instrumented with analytics and timeout protection
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true);
        
        // Start a timeout detector
        const operationStart = Date.now();
        const sessionTimeoutId = setTimeout(() => {
          trackError(AUTH_ERROR_TYPES.AUTH_TIMEOUT_ERROR, 
            new Error("Session restoration timed out after 10s"), 
            { operation: 'session_restoration' });
        }, 10000);
        
        // Track the start of auth initialization
        trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
          from_state: 'uninitialized',
          to_state: 'initializing',
          timestamp: Date.now()
        });
        
        // Load pending verification email from storage first
        const pendingEmail = await AsyncStorage.getItem('@GolfApp:pendingVerificationEmail');
        if (pendingEmail) {
          console.log("Found pending verification for:", pendingEmail);
          setPendingVerificationEmail(pendingEmail);
        }
        
        // Instrumented session restoration
        const { data, error } = await supabase.auth.getSession();
        
        clearTimeout(sessionTimeoutId);
        
        if (error) {
          trackError(AUTH_ERROR_TYPES.AUTH_SESSION_ERROR, error, {
            operation: 'session_restoration',
            duration_ms: Date.now() - operationStart
          });
          
          trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
            from_state: 'initializing',
            to_state: 'failed',
            failure_reason: 'session_error',
            timestamp: Date.now()
          });
        } else if (data?.session?.user) {
          trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
            from_state: 'initializing',
            to_state: 'session_restored',
            timestamp: Date.now()
          });
          
          setUser(data.session.user);
          setEmailVerified(checkEmailVerification(data.session.user));
          
          const permissionStart = Date.now();
          const permissionTimeoutId = setTimeout(() => {
            trackError(AUTH_ERROR_TYPES.AUTH_TIMEOUT_ERROR, 
              new Error("Permission loading timed out after 8s"), 
              { operation: 'permission_loading' });
          }, 8000);
          
          try {
            await loadUserPermissions(data.session.user.id);
            await initAnalytics(data.session.user.id);
            
            clearTimeout(permissionTimeoutId);
            
            trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
              from_state: 'session_restored',
              to_state: 'ready',
              permission_load_time_ms: Date.now() - permissionStart,
              timestamp: Date.now()
            });
          } catch (permError) {
            clearTimeout(permissionTimeoutId);
            
            trackError(AUTH_ERROR_TYPES.AUTH_PERMISSION_ERROR, permError, {
              operation: 'permission_loading',
              user_id: data.session.user.id,
              duration_ms: Date.now() - permissionStart
            });
          }
        } else {
          trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
            from_state: 'initializing',
            to_state: 'no_session',
            timestamp: Date.now()
          });
        }
        
        // Mark session restoration as complete
        setSessionRestored(true);
      } catch (err) {
        trackError(AUTH_ERROR_TYPES.AUTH_SESSION_ERROR, err, {
          operation: 'session_initialization',
          critical: true
        });
        
        // Mark session restoration as complete to unblock UI
        setSessionRestored(true);
      } finally {
        setLoading(false);
      }
    };

    // Initialize authentication
    initAuth();

    /**
     * Auth state change subscription
     * 
     * This synchronizes the UI with auth state changes from any source:
     * - Manual login/logout
     * - Session restoration
     * - Token refresh
     * - External auth events (deep links)
     * 
     * Enhanced with context-aware event processing via SessionManager
     */
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      
      // Check if event should be processed based on application context
      if (!SessionManager.shouldProcessAuthEvent(event)) {
        console.log(`[AuthContext] Auth event suppressed by SessionManager: ${event}`);
        return;
      }
      
      trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
        from_state: 'auth_change_detected',
        to_state: session ? 'session_available' : 'session_removed',
        auth_event: event,
        timestamp: Date.now()
      });
      
      // Process critical auth events with full state updates
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Update internal state based on auth changes
        if (session?.user) {
          setUser(session.user);
          setEmailVerified(checkEmailVerification(session.user));
          
          // Initialize analytics with user ID
          await initAnalytics(session.user.id);
          
          // Load user permissions
          await loadUserPermissions(session.user.id);
          
          // Handle verification state
          if (checkEmailVerification(session.user) && pendingVerificationEmail) {
            setPendingVerificationEmail(null);
            await AsyncStorage.removeItem('@GolfApp:pendingVerificationEmail');
          }
        } else {
          // Clear auth state on logout or session expiration
          setUser(null);
          setEmailVerified(false);
          setUserPermissions([]);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Minimal update for token refresh - just update the token without cascading reloads
        if (session?.user) {
          // Update user state but don't trigger permission reload or analytics reinit
          setUser(session.user);
          
          // Update verified state if it changed
          const isVerified = checkEmailVerification(session.user);
          if (isVerified !== emailVerified) {
            setEmailVerified(isVerified);
          }
        }
      }
    });

    // Deep link handling setup
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });
    const linkingListener = Linking.addEventListener('url', handleDeepLink);

    // Cleanup resources on unmount
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      linkingListener.remove();
      SessionManager.cleanup();
    };
  }, [pendingVerificationEmail, handleSuccessfulVerification, emailVerified, user]);

  /**
   * Enhanced sign-in implementation
   * Leverages persistence layer automatically through supabase client
   */
  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    
    trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
      from_state: 'unauthenticated',
      to_state: 'signin_initiated',
      timestamp: Date.now()
    });
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password
      });
      
      if (error) {
        setError(error.message);
        
        trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
          from_state: 'signin_initiated',
          to_state: 'signin_failed',
          error_code: error.code,
          timestamp: Date.now()
        });
      } else {
        // Session will be automatically persisted by the enhanced supabase client
        setUser(data.user);
        setEmailVerified(checkEmailVerification(data.user));
        
        trackEvent(AUTH_EVENTS.AUTH_STATE_TRANSITION, {
          from_state: 'signin_initiated',
          to_state: 'signin_success',
          timestamp: Date.now()
        });
        
        await loadUserPermissions(data.user.id);
      }
    } catch (err) {
      setError("An unexpected error occurred during sign in.");
      console.error("SignIn error:", err);
      
      trackError(AUTH_ERROR_TYPES.AUTH_SESSION_ERROR, err, {
        operation: 'sign_in',
        email: email ? email.substring(0, 3) + '...' : undefined // Partial email for privacy
      });
    } finally {
      setLoading(false);
    }
  };

  /* The rest of the auth methods remain unchanged */
  // ...

  // Expose auth context to the application
  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error, 
      signIn, 
      signUp, 
      signOut, 
      setError,
      emailVerified,
      pendingVerificationEmail,
      resendVerificationEmail,
      userPermissions,
      hasPermission,
      sessionRestored, // Session restoration flag
      navigateAfterVerification: handleSuccessfulVerification // Navigation capability
    }}>
      {children}
    </AuthContext.Provider>
  );
};
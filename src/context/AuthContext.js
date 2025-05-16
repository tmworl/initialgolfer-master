// src/context/AuthContext.js

import React, { createContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, AppState } from "react-native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { supabase } from "../services/supabase";

// Create navigation reference for cross-component navigation capabilities
export const navigationRef = createNavigationContainerRef();

// Create an authentication context
export const AuthContext = createContext();

/**
 * Email verification utility
 * Determines if a user has verified their email based on presence of email_confirmed_at
 */
const checkEmailVerification = (userData) => {
  return userData && userData.email_confirmed_at ? true : false;
};

/**
 * AuthProvider Component - Optimized Implementation
 * 
 * ARCHITECTURAL REFACTORING: 
 * - Simplified initialization sequence with fault isolation
 * - Eliminated SessionManager dependency with direct AppState monitoring
 * - Removed permission fetching creating network dependencies
 * - Implemented strategic token validation with lifecycle awareness
 */
export const AuthProvider = ({ children }) => {
  // Authentication state
  const [user, setUser] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Session restoration state
  const [sessionRestored, setSessionRestored] = useState(false);
  
  // AppState reference for transition management
  const appState = React.useRef(AppState.currentState);

  /**
   * Navigation handler for successful verification
   * Memoized to prevent unnecessary re-renders
   */
  const handleSuccessfulVerification = useCallback(() => {
    console.log("Email verified successfully, initiating navigation transition");
    
    // Validate navigation ref to prevent runtime errors
    if (navigationRef.isReady()) {
      try {
        // Reset navigation stack to ensure clean navigation state
        navigationRef.resetRoot({
          index: 0,
          routes: [{ name: 'Main' }],
        });
        console.log("Navigation successfully transitioned to Main route");
      } catch (navError) {
        console.error("Navigation transition failed:", navError);
        // Graceful degradation - verification state will still be picked up by AppNavigator
      }
    } else {
      console.log("Navigation reference not ready, verification state will be handled by AppNavigator");
    }
  }, []);

  /**
   * Deep link handler
   * Process verification callbacks from email links
   */
  const handleDeepLink = async (event) => {
    const url = event?.url || event;
    if (!url) return;

    // Check if this is a verification callback URL
    if (url.startsWith("mygolfapp://login-callback")) {
      console.log("Processing verification deep link");
      
      try {
        // Refresh the auth state to get the updated verification status
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error("Error refreshing session:", refreshError);
          return;
        }
        
        if (data?.session?.user) {
          setUser(data.session.user);
          
          // Check if email is now verified
          const isVerified = checkEmailVerification(data.session.user);
          setEmailVerified(isVerified);
          
          // Handle verification state
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
      }
    }
  };

  /**
   * Authentication initialization and session restoration
   * Optimized with clean separation of concerns and proper fault isolation
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true);
        
        // Load pending verification email from storage first
        try {
          const pendingEmail = await AsyncStorage.getItem('@GolfApp:pendingVerificationEmail');
          if (pendingEmail) {
            console.log("Found pending verification for:", pendingEmail);
            setPendingVerificationEmail(pendingEmail);
          }
        } catch (storageError) {
          console.error("Error reading pending verification:", storageError);
          // Non-fatal error - continue initialization
        }
        
        // Session restoration with fault isolation
        try {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Session restoration error:", error);
          } else if (data?.session?.user) {
            setUser(data.session.user);
            setEmailVerified(checkEmailVerification(data.session.user));
          }
        } catch (sessionError) {
          console.error("Session initialization error:", sessionError);
          // Non-fatal error - continue with degraded capabilities
        }
        
        // Mark session restoration as complete regardless of outcome
        setSessionRestored(true);
      } catch (err) {
        console.error("Authentication initialization error:", err);
      } finally {
        // Guarantee UI unblocking regardless of auth state
        setLoading(false);
      }
    };

    // Initialize authentication
    initAuth();

    /**
     * Auth state change subscription with explicit event filtering
     * Only processes critical auth events, ignoring TOKEN_REFRESHED
     */
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      
      // Skip TOKEN_REFRESHED events to prevent render cascades
      if (event === 'TOKEN_REFRESHED') {
        return;
      }
      
      // Process critical authentication events
      if (session?.user) {
        setUser(session.user);
        setEmailVerified(checkEmailVerification(session.user));
        
        // Handle verification state
        if (checkEmailVerification(session.user) && pendingVerificationEmail) {
          setPendingVerificationEmail(null);
          await AsyncStorage.removeItem('@GolfApp:pendingVerificationEmail');
        }
      } else {
        // Clear auth state on logout or session expiration
        setUser(null);
        setEmailVerified(false);
      }
    });

    // Foreground transition handler with strategic token validation
    const handleAppStateChange = async (nextAppState) => {
      const previousState = appState.current;
      appState.current = nextAppState;
      
      // Only validate when app returns to foreground
      if (previousState.match(/inactive|background/) && nextAppState === 'active' && user?.id) {
        console.log("App returned to foreground - validating authentication state");
        
        try {
          // Lightweight session validation with non-blocking execution
          const { data } = await supabase.auth.getSession();
          
          // If token is nearing expiry, perform proactive refresh
          if (data?.session?.expires_at) {
            const expiryTime = new Date(data.session.expires_at).getTime();
            const currentTime = Date.now();
            const remainingMs = expiryTime - currentTime;
            
            // If less than 30 minutes remaining, refresh token
            if (remainingMs < 30 * 60 * 1000) {
              console.log("Token nearing expiry, performing proactive refresh");
              await supabase.auth.refreshSession();
            }
          }
        } catch (validationError) {
          console.error("Foreground validation error:", validationError);
          // Non-fatal error - continue with current session
        }
      }
    };
    
    // Set up AppState monitoring
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Deep link handling setup
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });
    const linkingListener = Linking.addEventListener('url', handleDeepLink);

    // Cleanup resources on unmount with proper lifecycle management
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
      appStateSubscription.remove();
      linkingListener.remove();
    };
  }, [pendingVerificationEmail, handleSuccessfulVerification, user?.id]);

  /**
   * Enhanced sign-in implementation with clean error boundaries
   */
  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password
      });
      
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      } else {
        // Session will be automatically persisted by the supabase client
        setUser(data.user);
        setEmailVerified(checkEmailVerification(data.user));
        return { success: true };
      }
    } catch (err) {
      setError("An unexpected error occurred during sign in.");
      console.error("SignIn error:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign-up implementation with pending verification handling
   */
  const signUp = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      
      // Store email for verification flow
      await AsyncStorage.setItem('@GolfApp:pendingVerificationEmail', email);
      setPendingVerificationEmail(email);
      
      return { success: true };
    } catch (err) {
      setError("An unexpected error occurred during sign up.");
      console.error("SignUp error:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clean sign-out implementation
   */
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      return { success: true };
    } catch (err) {
      console.error("Sign out error:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Email verification resend with proper error handling
   */
  const resendVerificationEmail = async () => {
    try {
      setLoading(true);
      
      if (!pendingVerificationEmail) {
        setError("No email to verify");
        return { success: false, error: "No email to verify" };
      }
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingVerificationEmail
      });
      
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (err) {
      setError("Failed to resend verification email");
      console.error("Verification resend error:", err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Expose auth context to the application with clean interface contracts
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
      sessionRestored,
      navigateAfterVerification: handleSuccessfulVerification
    }}>
      {children}
    </AuthContext.Provider>
  );
};
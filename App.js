// App.js

import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from 'expo-device';
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider, navigationRef } from "./src/context/AuthContext";
import { trackEvent } from "./src/services/analytics";

// Telemetry boundary constants - defined but never directly invoked during render
const INIT_EVENTS = {
  APP_INITIALIZE: 'app_initialize',
  ERROR_BOUNDARY_TRIGGERED: 'error_boundary_triggered',
  AUTH_INIT_START: 'auth_initialization_start',
  AUTH_INIT_COMPLETE: 'auth_initialization_complete',
  AUTH_INIT_FAILED: 'auth_initialization_failed',
  STORAGE_RESET_ATTEMPT: 'storage_reset_attempt',
  STORAGE_RESET_RESULT: 'storage_reset_result',
  NAVIGATION_CONTAINER_READY: 'navigation_container_ready',
  APP_RECOVERY_ATTEMPT: 'app_recovery_attempt'
};

/**
 * Architecture-aware error boundary with deferred telemetry
 * 
 * ARCHITECTURAL ENFORCEMENT:
 * - Never invokes external modules during render phase
 * - Tracks initialization sequence with execution boundary integrity
 * - Ensures bridge communication occurs only after component mounting
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
    this.boundaryId = `boundary_${Date.now()}`;
    this.mounted = false;
  }

  componentDidMount() {
    this.mounted = true;
    
    // Safe to track initialization AFTER component has mounted
    if (typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.APP_INITIALIZE, {
        boundary_id: this.boundaryId,
        component: 'ErrorBoundary',
        react_phase: 'didMount'
      });
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  static getDerivedStateFromError(error) {
    // Pure state transition - no bridge communication
    return { hasError: true, errorInfo: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, errorInfo) {
    // Schedule telemetry for next tick to ensure execution boundary integrity
    setTimeout(() => {
      if (this.mounted && typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.ERROR_BOUNDARY_TRIGGERED, {
          boundary_id: this.boundaryId,
          error_message: error?.message || 'Unknown error',
          error_name: error?.name,
          error_stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
          react_component_stack: errorInfo?.componentStack?.split('\n').slice(0, 3).join(' | '),
          app_phase: 'initialization'
        });
      }
    }, 0);
    
    // Execute error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.boundaryId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Pure render with no side effects
      return this.props.fallback || (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Application Error</Text>
          <Text style={styles.errorMessage}>
            The application encountered a critical error during initialization.
          </Text>
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={this.handleReset}
          >
            <Text style={styles.resetButtonText}>Reset Application</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }

  handleReset = async () => {
    const resetStart = Date.now();
    
    // Event tracking in event handler - safe execution boundary
    if (typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.STORAGE_RESET_ATTEMPT, {
        triggered_by: 'user_action',
        error_info: this.state.errorInfo
      });
    }
    
    try {
      // Critical storage clearance for recovery
      const keysToRemove = [
        'supabase.auth.token',
        'supabase.auth.refreshToken',
        '@GolfApp:pendingVerificationEmail',
        'currentRound'
      ];
      
      await AsyncStorage.multiRemove(keysToRemove);
      
      // Track successful reset - safe execution boundary
      if (this.mounted && typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.STORAGE_RESET_RESULT, {
          success: true,
          keys_removed: keysToRemove.join(','),
          duration_ms: Date.now() - resetStart
        });
      }
    } catch (e) {
      // Track failed reset - safe execution boundary
      if (this.mounted && typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.STORAGE_RESET_RESULT, {
          success: false,
          error_message: e?.message || 'Unknown storage error',
          duration_ms: Date.now() - resetStart
        });
      }
      console.error("Error clearing storage:", e);
    }
    
    // Reset the error state - pure state transition
    this.setState({ hasError: false, errorInfo: null });
    
    // Track recovery attempt - safe execution boundary
    if (this.mounted && typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.APP_RECOVERY_ATTEMPT, {
        method: 'error_state_reset'
      });
    }
  }
}

/**
 * Root application component with architectural boundary enforcement
 * 
 * ARCHITECTURAL GUARANTEES:
 * 1. Execution boundaries properly respect React Native bridge initialization
 * 2. Native module communication occurs only after component mounting
 * 3. Telemetry is invoked with strict execution boundary discipline
 * 4. Initialization sequence maintains architectural integrity
 */
export default function App() {
  // Component state management
  const [initReported, setInitReported] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const appInitId = useRef(`app_init_${Date.now()}`).current;
  
  // Application initialization telemetry - CORRECT BOUNDARY
  useEffect(() => {
    // This executes after first render completes - bridge is initialized
    if (!initReported && typeof trackEvent === 'function') {
      setInitReported(true);
      trackEvent(INIT_EVENTS.APP_INITIALIZE, {
        init_id: appInitId,
        device_info: {
          brand: Device.brand,
          model: Device.modelName,
          os: Platform.OS,
          os_version: Platform.Version
        },
        timestamp: new Date().toISOString()
      });
    }
  }, [initReported, appInitId]);
  
  // Enhanced error handler with proper execution boundary
  const handleAuthenticationFailure = async (error, errorInfo, boundaryId) => {
    const recoveryStartTime = Date.now();
    
    // Track authentication failure - safe execution boundary in callback
    if (typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.AUTH_INIT_FAILED, {
        init_id: appInitId,
        boundary_id: boundaryId,
        error_message: error?.message || 'Unknown authentication error',
        error_stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
        component_stack: errorInfo?.componentStack?.split('\n').slice(0, 3).join(' | ')
      });
    }
    
    try {
      // Track recovery attempt - safe execution boundary in callback
      if (typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.STORAGE_RESET_ATTEMPT, {
          init_id: appInitId,
          boundary_id: boundaryId,
          triggered_by: 'auth_failure'
        });
      }
      
      // Clear potentially corrupted authentication state
      const keysToRemove = [
        'supabase.auth.token',
        'supabase.auth.refreshToken',
        '@GolfApp:pendingVerificationEmail'
      ];
      
      await AsyncStorage.multiRemove(keysToRemove);
      
      // Track successful reset - safe execution boundary in callback
      if (typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.STORAGE_RESET_RESULT, {
          init_id: appInitId,
          boundary_id: boundaryId,
          success: true,
          keys_removed: keysToRemove.join(','),
          duration_ms: Date.now() - recoveryStartTime
        });
      }
    } catch (clearError) {
      // Track failed reset with error context - safe execution boundary in callback
      if (typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.STORAGE_RESET_RESULT, {
          init_id: appInitId,
          boundary_id: boundaryId,
          success: false,
          error_message: clearError?.message || 'Unknown storage error',
          duration_ms: Date.now() - recoveryStartTime
        });
      }
      console.error("Failed to clear authentication state:", clearError);
    }
  };
  
  // Auth provider initialization callback - proper execution boundary
  const handleAuthInitialized = () => {
    setAuthInitialized(true);
    
    // Track auth initialization completion - safe execution boundary in callback
    if (typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.AUTH_INIT_COMPLETE, {
        init_id: appInitId,
        timestamp: new Date().toISOString()
      });
    }
  };
  
  // Navigation container ready callback - proper execution boundary
  const handleNavigationReady = () => {
    // Track navigation container ready - safe execution boundary in callback
    if (typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.NAVIGATION_CONTAINER_READY, {
        init_id: appInitId,
        auth_initialized: authInitialized,
        timestamp: new Date().toISOString()
      });
    }
  };
  
  // Deferred full app reset with proper execution boundary
  const handleFullReset = async () => {
    const resetStartTime = Date.now();
    
    // Track app-level recovery attempt - safe execution boundary in callback
    if (typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.APP_RECOVERY_ATTEMPT, {
        init_id: appInitId,
        method: 'full_storage_clear',
        triggered_by: 'user_action'
      });
    }
    
    try {
      await AsyncStorage.clear();
      
      // Track successful recovery - safe execution boundary in callback
      if (typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.STORAGE_RESET_RESULT, {
          init_id: appInitId,
          operation: 'full_clear',
          success: true,
          duration_ms: Date.now() - resetStartTime
        });
      }
      
      // In a production app, you would use Expo Updates or similar mechanism
      // to reload the application bundle
    } catch (e) {
      // Track failed recovery with diagnostic data - safe execution boundary in callback
      if (typeof trackEvent === 'function') {
        trackEvent(INIT_EVENTS.STORAGE_RESET_RESULT, {
          init_id: appInitId,
          operation: 'full_clear',
          success: false,
          error_message: e?.message || 'Unknown error',
          duration_ms: Date.now() - resetStartTime
        });
      }
      console.error("Reset failed:", e);
    }
  };
  
  // Track auth initialization start - proper timing in effect hook
  useEffect(() => {
    if (typeof trackEvent === 'function') {
      trackEvent(INIT_EVENTS.AUTH_INIT_START, {
        init_id: appInitId,
        timestamp: new Date().toISOString()
      });
    }
  }, [appInitId]);
  
  return (
    <ErrorBoundary 
      onError={handleAuthenticationFailure}
      fallback={
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication Error</Text>
          <Text style={styles.errorMessage}>
            There was a problem initializing the authentication system.
            Please try again or reinstall the application if the problem persists.
          </Text>
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={handleFullReset}
          >
            <Text style={styles.resetButtonText}>Reset & Try Again</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <AuthProvider onInitialized={handleAuthInitialized}>
        <NavigationContainer 
          ref={navigationRef}
          onReady={handleNavigationReady}
        >
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#d32f2f',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#424242',
  },
  resetButton: {
    backgroundColor: '#2196f3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});
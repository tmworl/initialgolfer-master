// App.js

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, Text, TouchableOpacity } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider, navigationRef } from "./src/context/AuthContext";
import { resetAuthStorage } from "./src/services/supabase";

/**
 * Authentication Error Boundary
 * 
 * Strategic fault isolation domain for authentication subsystem failures
 * Implements a deterministic recovery pathway for initialization errors
 */
class AuthErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorRecoveryAttempted: false,
      recoveryInProgress: false,
      errorDetails: null
    };
  }

  static getDerivedStateFromError(error) {
    // Capture error signature for diagnostic analysis
    return { 
      hasError: true,
      errorDetails: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    };
  }

  componentDidCatch(error, errorInfo) {
    // Collect comprehensive diagnostics for troubleshooting
    const diagnostics = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    };
    
    console.error("Authentication initialization failure:", diagnostics);
    
    // Initiate strategic recovery for first-time errors
    if (!this.state.errorRecoveryAttempted) {
      this.setState({ errorRecoveryAttempted: true });
      this.attemptRecovery();
    }
  }

  async attemptRecovery() {
    try {
      this.setState({ recoveryInProgress: true });
      console.log("Initiating authentication recovery sequence...");
      
      // Execute storage reset with enhanced error handling
      const resetResult = await resetAuthStorage();
      
      console.log("Authentication recovery results:", resetResult);
      
      // Reset error state to trigger component re-initialization
      this.setState({ 
        hasError: false,
        recoveryInProgress: false,
        recoveryResults: resetResult
      });
    } catch (error) {
      console.error("Authentication recovery failed:", error);
      this.setState({ 
        recoveryInProgress: false,
        recoveryError: error.message
      });
    }
  }

  render() {
    const { hasError, recoveryInProgress } = this.state;
    
    if (hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, marginBottom: 16, fontWeight: '600' }}>Authentication Error</Text>
          
          <Text style={{ textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
            There was a problem initializing the authentication system. Please try again or reinstall the application if the problem persists.
          </Text>
          
          <TouchableOpacity 
            style={{ 
              backgroundColor: '#007AFF', 
              paddingVertical: 12, 
              paddingHorizontal: 20, 
              borderRadius: 8,
              opacity: recoveryInProgress ? 0.7 : 1
            }}
            onPress={() => this.attemptRecovery()}
            disabled={recoveryInProgress}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              {recoveryInProgress ? 'Resetting...' : 'Reset & Try Again'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

/**
 * Root application component
 * 
 * Establishes the core system architecture layers:
 * 1. Authentication error isolation (AuthErrorBoundary)
 * 2. Authentication state management (AuthProvider)
 * 3. Navigation infrastructure (NavigationContainer)
 * 4. Route structure definition (AppNavigator)
 */
export default function App() {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </AuthErrorBoundary>
  );
}
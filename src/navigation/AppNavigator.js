// src/navigation/AppNavigator.js
//
// Authentication boundary navigator with simplified architecture
// Establishes core routing hierarchy with reduced styling complexity

import React, { useContext } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import AuthScreen from "../screens/AuthScreen";
import VerificationPendingScreen from "../screens/VerificationPendingScreen";
import MainNavigator from "./MainNavigator";
import { AuthContext } from "../context/AuthContext";
import navigationTheme from "../ui/navigation/theme";

const Stack = createStackNavigator();

/**
 * AppNavigator Component
 * 
 * Establishes authentication routing hierarchy based on user state.
 * Implements simplified screen options with direct theme property access.
 */
export default function AppNavigator() {
  // Retrieve both user and verification status from AuthContext
  const { user, emailVerified } = useContext(AuthContext);

  // ARCHITECTURAL CHANGE: Direct theme property references
  // Eliminates complex token transformation chains
  const screenOptions = {
    headerShown: false,
    cardStyle: {
      backgroundColor: navigationTheme.colors.background.card,
    },
    // ARCHITECTURAL CHANGE: Simplified presentation options
    // Removes complex conditional platform detection
    gestureEnabled: false,
  };

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        // If no user is authenticated, show the auth screen
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !emailVerified ? (
        // If user exists but email isn't verified, show verification screen
        <Stack.Screen 
          name="VerifyEmail" 
          component={VerificationPendingScreen}
        />
      ) : (
        // If user is authenticated and verified, show the main app
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
}
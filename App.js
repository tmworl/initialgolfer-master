// App.js

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { AuthProvider, navigationRef } from "./src/context/AuthContext";

/**
 * Root application component
 * 
 * Establishes simplified system architecture:
 * 1. Authentication state management (AuthProvider)
 * 2. Navigation infrastructure (NavigationContainer)
 * 3. Route structure definition (AppNavigator)
 */
export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
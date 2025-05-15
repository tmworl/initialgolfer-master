// src/navigation/AppNavigator.js
//
// Authentication boundary navigator with simplified architecture
// Establishes core routing hierarchy with reduced styling complexity

import React, { useContext, useEffect, useState } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackEvent } from "../services/analytics";
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
 * 
 * ARCHITECTURAL REFACTORING:
 * - Transaction recovery moved to post-navigation event
 * - Added proper initialization boundary enforcement
 * - Enhanced resilience with robust error handling 
 */
export default function AppNavigator() {
  // Retrieve both user and verification status from AuthContext
  const { user, emailVerified } = useContext(AuthContext);
  const navigation = useNavigation();
  const [recoveryAttempted, setRecoveryAttempted] = useState(false);

  // Recovery mechanism for interrupted round completion
  // ARCHITECTURAL REFACTORING: Deferred to post-navigation event
  useEffect(() => {
    // Only attempt recovery when authentication is verified and only once
    if (!user || !emailVerified || recoveryAttempted) return;

    // Add a navigation state listener to run recovery after navigation is stable
    const unsubscribe = navigation.addListener('state', (e) => {
      // Only run once navigation is idle and stable
      if (!recoveryAttempted) {
        setRecoveryAttempted(true);
        
        // Execute recovery with slight delay to ensure UI stability
        setTimeout(() => {
          checkForInterruptedTransactions().catch(error => {
            console.error("Transaction recovery error:", error);
          });
        }, 1000);
      }
    });

    return unsubscribe;
  }, [user, emailVerified, navigation, recoveryAttempted]);

  const checkForInterruptedTransactions = async () => {
    try {
      // Get all keys from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter for transaction markers
      const transactionKeys = keys.filter(k => k.startsWith('transaction_'));
      
      if (transactionKeys.length === 0) return;
      
      console.log(`Found ${transactionKeys.length} potential transaction markers`);
      
      // Process each transaction marker
      for (const key of transactionKeys) {
        try {
          const transactionDataStr = await AsyncStorage.getItem(key);
          if (!transactionDataStr) continue;
          
          const transaction = JSON.parse(transactionDataStr);
          
          // Only recover DB_COMMITTED transactions that haven't been fully completed
          if (transaction.type === 'round_completion' && 
              transaction.status === 'DB_COMMITTED' && 
              transaction.round_id) {
            
            console.log(`Found interrupted transaction for round ${transaction.round_id}`);
            
            // Track recovery attempt
            trackEvent('round_completion_recovery_started', {
              transaction_id: key.replace('transaction_', ''),
              round_id: transaction.round_id,
              original_timestamp: transaction.timestamp
            });
            
            // Clean up any remaining local round data
            await AsyncStorage.removeItem(`round_${transaction.round_id}_holes`);
            await AsyncStorage.removeItem("currentRound");
            
            // Navigate to the scorecard to show completion results
            navigation.navigate("ScorecardScreen", { 
              roundId: transaction.round_id,
              fromTracker: true,
              recovered: true,
              recoveryTimestamp: new Date().toISOString(),
              transactionId: key.replace('transaction_', '')
            });
            
            // Update marker to RECOVERED status and keep it for audit
            await AsyncStorage.setItem(key, JSON.stringify({
              ...transaction,
              status: 'RECOVERED',
              recovery_timestamp: new Date().toISOString()
            }));
            
            // Track successful recovery
            trackEvent('round_completion_recovery_succeeded', {
              transaction_id: key.replace('transaction_', ''),
              round_id: transaction.round_id
            });
            
            // Only recover one transaction at a time
            break;
          }
        } catch (parseError) {
          console.error(`Error processing transaction marker ${key}:`, parseError);
          // Continue to next transaction
        }
      }
    } catch (error) {
      console.error("Error checking for interrupted transactions:", error);
    }
  };

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
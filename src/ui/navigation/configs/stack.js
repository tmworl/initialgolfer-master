// src/ui/navigation/configs/stack.js
//
// Stack navigator configuration architecture with deterministic styling
// Implements direct theme consumption with explicit styling parameters

import React from 'react';
import { TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import navigationTheme from '../theme';

/**
 * Creates standardized stack navigator options with predictable styling
 * Eliminates dynamic header backdrop materials and opacity calculations
 */
const createStackNavigatorScreenOptions = () => {
  return {
    // ARCHITECTURAL CHANGE: Fixed header positioning
    // Ensures deterministic rendering with proper z-index management
    headerTransparent: false,
    
    // ARCHITECTURAL CHANGE: Direct theme property integration
    // Eliminates property transformation pipeline
    headerStyle: {
      backgroundColor: navigationTheme.colors.background.header,
      height: navigationTheme.spacing.header.height,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: navigationTheme.colors.border.header,
      
      // ARCHITECTURAL CHANGE: Simplified shadow implementation
      // Replaces complex dynamic calculations with direct platform values
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 1,
        },
        android: {
          elevation: 2,
        }
      }),
    },
    
    // ARCHITECTURAL CHANGE: Direct typography integration
    // Replaces dynamic optical sizing with fixed parameters
    headerTitleStyle: {
      ...navigationTheme.typography.header.title,
    },
    
    headerTitleAlign: Platform.OS === 'ios' ? 'center' : 'left',
    headerTintColor: navigationTheme.colors.tint.header,
    
    // ARCHITECTURAL CHANGE: Simplified card styling
    // Eliminates custom backdrop materials
    cardStyle: {
      backgroundColor: navigationTheme.colors.background.card,
    },
    
    // ARCHITECTURAL CHANGE: Platform-appropriate gesture handling
    // Eliminates complex detection in favor of direct platform check
    gestureEnabled: Platform.OS === 'ios',
    gestureDirection: 'horizontal',
  };
};

/**
 * Custom back button with simplified implementation
 * Eliminates complex platform detection in favor of direct checks
 */
const CustomBackButton = ({ onPress, canGoBack }) => {
  if (!canGoBack) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 8,
        marginLeft: Platform.OS === 'android' ? 0 : -8,
      }}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
    >
      <Ionicons
        name={Platform.OS === 'ios' ? "chevron-back" : "arrow-back"}
        size={Platform.OS === 'ios' ? 28 : 24}
        color={navigationTheme.colors.tint.header}
      />
    </TouchableOpacity>
  );
};

/**
 * Header left component factory with simplified implementation
 */
const createHeaderLeft = (navigation) => {
  return ({ canGoBack }) => {
    if (!canGoBack) return null;
    
    return (
      <CustomBackButton
        canGoBack={canGoBack}
        onPress={() => navigation.goBack()}
      />
    );
  };
};

// Stack configuration factories with reduced complexity
// Maintain API compatibility while simplifying implementation

const createHomeStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      HomeScreen: {
        options: {
          title: "Clubhouse",
        }
      },
      CourseSelector: {
        options: {
          title: "Select Course",
        }
      },
      Tracker: {
        options: {
          title: "Round Tracker",
        }
      },
      ScorecardScreen: {
        options: {
          title: "Scorecard",
        }
      }
    }
  };
};

// Similar configurations for other stack navigators
const createRoundsStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      RoundsScreen: {
        options: {
          title: "Your Rounds",
        }
      },
      ScorecardScreen: {
        options: {
          title: "Scorecard"
        }
      }
    }
  };
};

const createInsightsStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      InsightsScreen: {
        options: {
          title: "Golf Insights",
        }
      }
    }
  };
};

const createProfileStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      ProfileScreen: {
        options: {
          title: "Profile",
        }
      }
    }
  };
};

export {
  createStackNavigatorScreenOptions,
  createHeaderLeft,
  createHomeStackConfig,
  createRoundsStackConfig,
  createInsightsStackConfig,
  createProfileStackConfig
};
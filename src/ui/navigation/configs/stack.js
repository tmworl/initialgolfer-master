// src/ui/navigation/configs/stack.js
//
// Stack navigator configuration focused on rendering consistency
// Architectural foundation that ensures proper header/content separation

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../theme';

/**
 * Core navigation architecture with fixed rendering hierarchy
 * Eliminates unpredictable positioning and z-index conflicts
 */
const createStackNavigatorScreenOptions = () => {
  return {
    // ARCHITECTURAL CHANGE: Fixed header positioning
    // This ensures deterministic rendering hierarchy rather than floating headers
    headerTransparent: false,
    
    // ARCHITECTURAL CHANGE: Fixed header style with explicit dimensions
    // This establishes a predictable component tree with proper spacing
    headerStyle: {
      backgroundColor: theme.colors.background,
      height: Platform.OS === 'ios' ? 44 : 56,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      
      // ARCHITECTURAL CHANGE: Standard elevation instead of complex shadow params
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
    
    // Typography integration with design system
    headerTitleStyle: {
      fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.text,
    },
    
    headerTitleAlign: Platform.OS === 'ios' ? 'center' : 'left',
    headerTintColor: theme.colors.primary,
    
    // ARCHITECTURAL CHANGE: Explicit card style for screen content
    // This ensures consistent background rendering
    cardStyle: {
      backgroundColor: theme.colors.background,
    },
    
    // Animation parameters remain standard by platform
    gestureEnabled: Platform.OS === 'ios',
    gestureDirection: 'horizontal',
  };
};

/**
 * Custom back button with standard styling parameters
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
        color={theme.colors.primary}
      />
    </TouchableOpacity>
  );
};

/**
 * Standard header left component factory
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
// These maintain consistent header treatment across all stacks

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
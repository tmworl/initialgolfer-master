// src/ui/navigation/configs/tabBar.js
//
// Tab navigation configuration architecture with simplified implementation
// Establishes deterministic styling with direct theme integration

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import navigationTheme from '../theme';

/**
 * Tab Bar Visibility Logic
 * 
 * Simplified route-based visibility mechanism with deterministic behavior
 * Replaces complex dynamic calculations with straightforward conditionals
 */
export const getTabBarVisibility = (route) => {
  // Routes where tab bar should be hidden
  const hiddenRoutes = ['CourseSelector', 'Tracker', 'ScorecardScreen'];

  // Extract active route using React Navigation's built-in utility
  const routeName = getFocusedRouteNameFromRoute(route);
  
  // Return visibility styling directly - no complex conditionals
  return (routeName && hiddenRoutes.includes(routeName)) 
    ? { display: 'none' } 
    : undefined;
};

/**
 * Tab Navigator Configuration
 * 
 * Generates complete tab navigator screen options with simplified styling
 * Eliminates custom backdrop materials and dynamic rendering paths
 */
export const getTabNavigatorScreenOptions = () => {
  return {
    // No headers at tab level - handled by stack navigators
    headerShown: false,
    
    // ARCHITECTURAL CHANGE: Direct theme property references
    // Eliminates token transformation pipeline
    tabBarStyle: {
      backgroundColor: navigationTheme.colors.background.tabBar,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: navigationTheme.colors.border.tabBar,
      
      // ARCHITECTURAL CHANGE: Fixed height calculation with direct platform check
      // Replaces complex detection with simple Platform reference
      height: Platform.OS === 'ios' 
        ? navigationTheme.spacing.tabBar.height + navigationTheme.spacing.tabBar.bottomInset 
        : navigationTheme.spacing.tabBar.height,
      
      // ARCHITECTURAL CHANGE: Platform-specific elevation
      // Replaces complex shadow calculations with direct values
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        android: {
          elevation: 4,
        }
      }),
    },
    
    // ARCHITECTURAL CHANGE: Direct color references 
    // Eliminates complex token transformations
    tabBarActiveTintColor: navigationTheme.colors.tint.tabBarActive,
    tabBarInactiveTintColor: navigationTheme.colors.tint.tabBarInactive,
    
    // ARCHITECTURAL CHANGE: Direct typography values
    // Eliminates dynamic optical sizing
    tabBarLabelStyle: {
      ...navigationTheme.typography.tabBar.label,
    },
  };
};
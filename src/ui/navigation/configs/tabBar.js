// src/ui/navigation/configs/tabBar.js
//
// Streamlined tab bar configuration architecture
// Eliminates conditional rendering paths and complex material integrations

import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import theme from '../../theme';

/**
 * Tab Bar Visibility Logic
 * 
 * Simplified route-based visibility mechanism with deterministic behavior
 * Replaces complex dynamic calculations with straightforward conditionals
 * 
 * @param {Object} route - Current route object
 * @returns {Object|undefined} - Style object to hide tab bar or undefined
 */
export const getTabBarVisibility = (route) => {
  // Routes where tab bar should be hidden
  const hiddenRoutes = ['CourseSelector', 'Tracker', 'ScorecardScreen'];

  // Extract the active route name using React Navigation's utilities
  const routeName = getFocusedRouteNameFromRoute(route);
  
  // Simple conditional return with no branching logic
  return (routeName && hiddenRoutes.includes(routeName)) 
    ? { display: 'none' } 
    : undefined;
};

/**
 * Tab Navigator Configuration
 * 
 * Provides streamlined tab navigator options with deterministic styling
 * Eliminates material backdrop complexity and dynamic component generation
 * 
 * @returns {Object} - Tab navigator screen options
 */
export const getTabNavigatorScreenOptions = () => {
  return {
    // No header at tab navigator level - handled by child stack navigators
    headerShown: false,
    
    // Consistent styling across platforms with minimal platform branching
    tabBarStyle: {
      backgroundColor: theme.colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      
      // Fixed height calculation with explicit safe area handling
      height: Platform.OS === 'ios' ? 49 + 34 : 56, // Base height + bottom inset for iOS
      
      // Platform-appropriate elevation instead of complex shadow params
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
    
    // Standard tab styling from design system
    tabBarActiveTintColor: theme.colors.primary,
    tabBarInactiveTintColor: '#8E8E93',
    
    // Fixed label styling
    tabBarLabelStyle: {
      fontSize: 10,
      fontWeight: '500',
    },
  };
};
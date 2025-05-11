// src/ui/navigation/theme.js
//
// Consolidated navigation theme architecture
// Replaces complex token transformation system with direct references

import { Platform } from 'react-native';
import theme from '../../theme';

/**
 * Navigation Theme System
 * 
 * Unified architecture that leverages core design system
 * Replaces multi-file transformation pipeline with direct token references
 * Establishes proper abstraction boundaries with the design system
 */
const navigationTheme = {
  // Color tokens with direct references to design system
  colors: {
    // Background colors for navigation elements
    background: {
      header: theme.colors.background,
      tabBar: theme.colors.background,
      card: theme.colors.background,
      modal: theme.colors.background,
    },
    
    // Border colors with consistent design language
    border: {
      header: theme.colors.border,
      tabBar: theme.colors.border,
    },
    
    // Interactive element colors from design system
    tint: {
      header: theme.colors.primary,
      tabBarActive: theme.colors.primary,
      tabBarInactive: '#8E8E93',
    },
  },
  
  // Spacing system with platform-appropriate values
  spacing: {
    // Header dimensions based on platform standards
    header: {
      height: Platform.OS === 'ios' ? 44 : 56,
      paddingHorizontal: 16,
      statusBarHeight: Platform.OS === 'ios' ? 20 : 0,
    },
    
    // Tab bar dimensions with platform adaptations
    tabBar: {
      height: Platform.OS === 'ios' ? 49 : 56,
      itemPadding: 4,
      bottomInset: Platform.OS === 'ios' ? 34 : 0,
    },
  },
  
  // Typography that extends design system
  typography: {
    // Header text styles
    header: {
      title: {
        // Extend subtitle style from design system
        ...theme.typography.styles.subtitle,
        // Override with navigation-specific adjustments
        fontSize: 17,
      },
      backTitle: {
        // Extend body style from design system
        ...theme.typography.styles.body,
        color: theme.colors.primary,
      },
    },
    
    // Tab bar text styles
    tabBar: {
      label: {
        // Extend caption style from design system
        ...theme.typography.styles.caption,
        fontSize: 10,
      },
    },
  },
  
  // Expose platform utilities for navigation components
  platform: {
    isIOS: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
    select: Platform.select,
  },
};

export default navigationTheme;
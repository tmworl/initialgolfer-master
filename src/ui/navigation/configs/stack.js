// src/ui/navigation/configs/stack.js
//
// Core navigation configuration architecture with centralized token system

import React from 'react';
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TransitionPresets } from '@react-navigation/stack';
import platformDetection from '../../platform/detection';
import visualProperties from '../../platform/visualProperties';
import BackdropMaterial, { MATERIAL_TYPES } from '../../components/BackdropMaterial';
import Typography from '../../components/Typography';
import navigationTheme from '../theme';

const { tokens, platform } = navigationTheme;

/**
 * Architectural foundation for stack navigation with centralized header management
 * 
 * This configuration architecture establishes stack navigators as the exclusive
 * owners of header rendering while preserving platform-specific optimizations.
 * 
 * @returns {Object} Stack navigator screen options configuration
 */
const createStackNavigatorScreenOptions = () => {
  return {
    // Core architectural boundaries
    headerMode: 'float',
    headerTransparent: platformDetection.isIOS && platformDetection.supportsBlurEffects,
    
    // CRITICAL: Remove any explicit headerStatusBarHeight overrides
    // Let React Navigation handle status bar height calculations natively
    
    headerBackground: ({ style }) => (
      platformDetection.isIOS && platformDetection.supportsBlurEffects ? (
        <BackdropMaterial
          type={MATERIAL_TYPES.THIN}
          // Preserve React Navigation's layout system
          style={style}
        />
      ) : (
        <View
          style={[
            style,
            {
              backgroundColor: tokens.colors.background.header,
              borderBottomWidth: StyleSheet.hairlineWidth, 
              borderBottomColor: tokens.colors.border.header
            }
          ]}
        />
      )
    ),
    
    // Typography refinements
    headerTitleStyle: {
      ...tokens.typography.header.title,
      ...visualProperties.getOpticalTypography(
        platform.isIOS ? 17 : 20, 
        platform.isIOS ? '600' : '500'
      ),
    },
    
    // Platform-specific configurations
    headerBackTitleVisible: platform.isIOS,
    headerShadowVisible: !platform.isIOS,
    
    // Animation refinements
    gestureEnabled: platform.isIOS,
    gestureDirection: 'horizontal',
    
    // Card styling with proper corner radius
    cardStyle: {
      backgroundColor: tokens.colors.background.card,
    },
    
    // Platform-specific animation presets
    ...Platform.select({
      ios: TransitionPresets.SlideFromRightIOS,
      android: TransitionPresets.FadeFromBottomAndroid,
    }),
    
    // Animation timing refinements
    transitionSpec: {
      open: {
        animation: 'timing',
        config: {
          duration: platform.isIOS ? 350 : 300,
          useNativeDriver: true
        },
      },
      close: {
        animation: 'timing',
        config: {
          duration: platform.isIOS ? 350 : 300,
          useNativeDriver: true
        },
      },
    },
  };
};

/**
 * Platform-optimized back button implementation
 */
const CustomBackButton = ({ onPress, canGoBack }) => {
  if (!canGoBack) {
    return null;
  }

  // Optimize hitSlop for touch targets
  const hitSlop = { top: 12, right: 12, bottom: 12, left: 12 };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        padding: 8,
        marginLeft: platform.isAndroid ? 0 : -8,
      }}
      hitSlop={hitSlop}
      // Enable GPU acceleration for back button animations on Android
      style={Platform.OS === 'android' ? { 
        renderToHardwareTextureAndroid: true 
      } : undefined}
    >
      <Ionicons
        name={platform.isIOS ? "chevron-back" : "arrow-back"}
        size={platform.isIOS ? 28 : 24}
        color={platform.isIOS ? tokens.colors.tint.header : "#fff"}
      />
    </TouchableOpacity>
  );
};

/**
 * Header left component factory
 */
const createHeaderLeft = (navigation) => {
  return ({ canGoBack }) => {
    if (!canGoBack) {
      return null;
    }
    
    return (
      <CustomBackButton
        canGoBack={canGoBack}
        onPress={() => navigation.goBack()}
      />
    );
  };
};

/**
 * Stack configuration factory definitions for all navigators
 * Consumed by both external and internal stack navigators
 */

// Home stack config
const createHomeStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      HomeScreen: {
        options: {
          title: "Clubhouse",
          headerLargeTitle: platformDetection.isIOS,
          headerLargeTitleStyle: {
            ...visualProperties.getOpticalTypography(34, '700'),
          }
        }
      },
      CourseSelector: {
        options: {
          title: "Select Course",
          ...Platform.select({
            android: {
              headerStyle: {
                backgroundColor: tokens.colors.primary,
              },
              headerTintColor: '#fff',
            }
          })
        }
      },
      Tracker: {
        options: ({ navigation }) => ({
          title: "Round Tracker",
          // Prevent going back directly from tracker without completing the round
          headerLeft: () => null,
          ...Platform.select({
            android: {
              headerStyle: {
                backgroundColor: tokens.colors.primary,
              },
              headerTintColor: '#fff',
            }
          })
        })
      },
      ScorecardScreen: {
        options: {
          title: "Scorecard",
          ...Platform.select({
            android: {
              headerStyle: {
                backgroundColor: tokens.colors.primary,
              },
              headerTintColor: '#fff',
            }
          })
        }
      }
    }
  };
};

// Rounds stack config
const createRoundsStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      RoundsScreen: {
        options: {
          title: "Your Rounds",
          headerLargeTitle: platformDetection.isIOS,
          headerLargeTitleStyle: {
            ...visualProperties.getOpticalTypography(34, '700'),
          }
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

// Insights stack config
const createInsightsStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      InsightsScreen: {
        options: {
          title: "Golf Insights",
          headerLargeTitle: platformDetection.isIOS,
          headerLargeTitleStyle: {
            ...visualProperties.getOpticalTypography(34, '700'),
          }
        }
      }
    }
  };
};

// Profile stack config
const createProfileStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      ProfileScreen: {
        options: {
          title: "Profile",
          headerLargeTitle: platformDetection.isIOS,
          headerLargeTitleStyle: {
            ...visualProperties.getOpticalTypography(34, '700'),
          }
        }
      }
    }
  };
};

const styles = StyleSheet.create({
  headerTitle: {
    flex: 1,
    textAlign: Platform.OS === 'ios' ? 'center' : 'left',
  }
});

export {
  createStackNavigatorScreenOptions,
  createHeaderLeft,
  createHomeStackConfig,
  createRoundsStackConfig,
  createInsightsStackConfig,
  createProfileStackConfig
};
// src/ui/navigation/configs/stack.js
//
// Enhanced stack navigator configuration with iOS 18 header material integration
// Implements Dynamic Island avoidance and animation refinements

import React from 'react';
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getHeaderTitle } from '@react-navigation/elements';
import { TransitionPresets } from '@react-navigation/stack';
import platformDetection from '../../platform/detection';
import visualProperties from '../../platform/visualProperties';
import BackdropMaterial, { MATERIAL_TYPES } from '../../components/BackdropMaterial';
import Typography from '../../components/Typography';
import navigationTheme from '../theme';

const { tokens, platform } = navigationTheme;

/**
 * Create stack navigator default screen options with iOS 18 visual refinements
 * 
 * @returns {Object} Default screen options for stack navigators
 */
const createStackNavigatorScreenOptions = () => {
  return {
    // Header material integration
    headerMode: 'float',
    headerTransparent: platformDetection.isIOS && platformDetection.supportsBlurEffects,
    
    // Let React Navigation handle status bar height calculations
    
    headerBackground: ({ style }) => (
      platformDetection.isIOS && platformDetection.supportsBlurEffects ? (
        <BackdropMaterial
          type={MATERIAL_TYPES.THIN}
          // Critical: preserve original style provided by React Navigation without alteration
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
 * Create stack navigator custom back button with platform optimizations
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
 * Create a custom header left component factory
 * 
 * @param {Function} navigation - Navigation object from React Navigation
 * @returns {Function} Function that returns a header left component
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
 * Configuration factory for home stack
 * 
 * @returns {Object} Configuration object with screen options
 */
const createHomeStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      HomeScreen: {
        options: {
          title: "Clubhouse",
          // iOS 18 large title style
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
          // Apply different styling to this critical screen
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

// Add implementations for the other stack configurations
const createRoundsStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      RoundsScreen: {
        options: {
          title: "Your Rounds",
          // iOS 18 large title style
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

const createInsightsStackConfig = () => {
  return {
    screenOptions: createStackNavigatorScreenOptions(),
    screenConfigs: {
      InsightsScreen: {
        options: {
          title: "Golf Insights",
          // iOS 18 large title style
          headerLargeTitle: platformDetection.isIOS,
          headerLargeTitleStyle: {
            ...visualProperties.getOpticalTypography(34, '700'),
          }
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
          // iOS 18 large title style
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
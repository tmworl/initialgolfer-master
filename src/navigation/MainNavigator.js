// src/navigation/MainNavigator.js
//
// Core navigation architecture with proper component hierarchy and delegation

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import HomeStack from "./HomeStack";
import RoundsScreen from "../screens/RoundScreen";
import InsightsScreen from "../screens/InsightsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ScorecardScreen from "../screens/ScorecardScreen";
import navigationTheme from "../ui/navigation/theme";
import { 
  createRoundsStackConfig, 
  createInsightsStackConfig, 
  createProfileStackConfig 
} from "../ui/navigation/configs/stack";

// Create stack navigators for tabs with nested navigation
const RoundsStack = createStackNavigator();
const InsightsStack = createStackNavigator();
const ProfileStack = createStackNavigator();

/**
 * RoundsStackScreen Component
 * 
 * Local stack navigator definition that owns header rendering
 * for the rounds flow.
 */
function RoundsStackScreen() {
  // Get configuration from central system
  const config = createRoundsStackConfig();
  
  return (
    <RoundsStack.Navigator screenOptions={config.screenOptions}>
      <RoundsStack.Screen 
        name="RoundsScreen" 
        component={RoundsScreen} 
        options={config.screenConfigs.RoundsScreen.options}
      />
      <RoundsStack.Screen 
        name="ScorecardScreen" 
        component={ScorecardScreen} 
        options={config.screenConfigs.ScorecardScreen.options}
      />
    </RoundsStack.Navigator>
  );
}

/**
 * InsightsStackScreen Component
 * 
 * Local stack navigator definition that owns header rendering
 * for the insights flow.
 */
function InsightsStackScreen() {
  // Get configuration from central system
  const config = createInsightsStackConfig();
  
  return (
    <InsightsStack.Navigator screenOptions={config.screenOptions}>
      <InsightsStack.Screen 
        name="InsightsScreen" 
        component={InsightsScreen}
        options={config.screenConfigs.InsightsScreen.options}
      />
    </InsightsStack.Navigator>
  );
}

/**
 * ProfileStackScreen Component
 * 
 * Local stack navigator definition that owns header rendering
 * for the profile flow.
 */
function ProfileStackScreen() {
  // Get configuration from central system
  const config = createProfileStackConfig();
  
  return (
    <ProfileStack.Navigator screenOptions={config.screenOptions}>
      <ProfileStack.Screen 
        name="ProfileScreen" 
        component={ProfileScreen}
        options={config.screenConfigs.ProfileScreen.options}
      />
    </ProfileStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

/**
 * MainNavigator Component
 * 
 * Root navigation architecture establishing clear delegation boundaries.
 * Tab navigator explicitly delegates header rendering responsibility
 * to child stack navigators through headerShown: false.
 */
export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // ARCHITECTURAL BOUNDARY: Tab navigator explicitly delegates header ownership
        headerShown: false,
        
        // Icon mapping
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          switch (route.name) {
            case 'HomeTab':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Rounds':
              iconName = focused ? 'golf' : 'golf-outline';
              break;
            case 'Insights':
              iconName = focused ? 'bulb' : 'bulb-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'apps';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        
        // Tab bar visibility logic for specific routes
        tabBarStyle: (() => {
          const routeName = getFocusedRouteNameFromRoute(route);
          const hiddenRoutes = ['CourseSelector', 'Tracker', 'ScorecardScreen'];
          
          if (routeName && hiddenRoutes.includes(routeName)) {
            return { display: 'none' };
          }
          return undefined;
        })(),
        
        // Tab styling from theme
        tabBarActiveTintColor: navigationTheme.tokens.colors.tint.tabBarActive,
        tabBarInactiveTintColor: navigationTheme.tokens.colors.tint.tabBarInactive,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarLabel: 'Clubhouse' }}
      />
      <Tab.Screen
        name="Rounds"
        component={RoundsStackScreen}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsStackScreen}
        options={{ 
          tabBarBadge: 'New',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackScreen}
      />
    </Tab.Navigator>
  );
}
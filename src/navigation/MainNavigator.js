// src/navigation/MainNavigator.js
//
// Core navigation architecture with deterministic styling properties
// Implements direct theme consumption with explicit property lineage

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
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
import {
  getTabBarVisibility,
  getTabNavigatorScreenOptions
} from "../ui/navigation/configs/tabBar";

// Stack navigators for nested routing architecture
const RoundsStack = createStackNavigator();
const InsightsStack = createStackNavigator();
const ProfileStack = createStackNavigator();

/**
 * RoundsStackScreen Component
 */
function RoundsStackScreen() {
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
 */
function InsightsStackScreen() {
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
 */
function ProfileStackScreen() {
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
 */
export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // ARCHITECTURAL CHANGE: Tab navigator explicitly delegates header ownership
        headerShown: false,
        
        // ARCHITECTURAL CHANGE: Direct icon mapping with simplified function
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
        
        // ARCHITECTURAL CHANGE: Direct tab bar visibility logic
        tabBarStyle: getTabBarVisibility(route),
        
        // ARCHITECTURAL CHANGE: Direct theme property references
        // Eliminates token transformation pipeline
        tabBarActiveTintColor: navigationTheme.colors.tint.tabBarActive,
        tabBarInactiveTintColor: navigationTheme.colors.tint.tabBarInactive,
        
        // Apply additional screenOptions from consolidated function
        ...getTabNavigatorScreenOptions()
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
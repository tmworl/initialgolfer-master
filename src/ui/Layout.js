// src/ui/Layout.js

import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "./theme";

/**
 * Layout Component
 * 
 * Core container component providing safe area management for content.
 * Uses hooks-based inset detection to cooperate with React Navigation's
 * native safe area handling without creating competing layout systems.
 * 
 * @param {Object} props Component props
 * @param {React.ReactNode} props.children Content to render
 * @param {Object} props.style Additional styles for container
 */
export default function Layout({ children, style }) {
  // Hook-based inset detection for integration with React Navigation
  const insets = useSafeAreaInsets();
  
  return (
    <View 
      style={[
        styles.container,
        // Apply horizontal insets only, letting React Navigation handle vertical
        {
          paddingLeft: Math.max(theme.spacing.medium, insets.left),
          paddingRight: Math.max(theme.spacing.medium, insets.right)
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.medium,
  },
});
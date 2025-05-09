// src/ui/Layout.js

import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import theme from "./theme";

// Layout component with proper safe area handling
export default function Layout({ children, style }) {
  // Use hooks instead of wrapping components
  const insets = useSafeAreaInsets();
  
  return (
    <View 
      style={[
        styles.container,
        // Apply horizontal insets but let React Navigation handle vertical ones
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

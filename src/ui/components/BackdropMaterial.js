// src/ui/components/BackdropMaterial.js
//
// iOS 18 material system implementation
// Creates translucent surfaces with blur effects and proper vibrancy

import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import platformDetection from '../platform/detection';

// Import BlurView if available (it might be from expo-blur)
let BlurView;
try {
  BlurView = require('expo-blur').BlurView;
} catch (e) {
  // Blur view not available
}

// Material types for consistent styling
export const MATERIAL_TYPES = {
  THIN: 'thin',
  REGULAR: 'regular',
  THICK: 'thick',
  SOLID: 'solid'
};

/**
 * BackdropMaterial Component
 * 
 * Creates iOS 18-style material surfaces with proper translucency and blur effects.
 * Automatically handles platform-specific implementations and performance optimizations.
 * 
 * @param {Object} props Component props
 * @param {string} props.type Material type (thin, regular, thick, solid)
 * @param {number} props.intensity Blur intensity override (10-100)
 * @param {string} props.backgroundColor Base background color
 * @param {number} props.opacity Opacity value (0-1)
 * @param {boolean} props.disableBlur Force disable blur effects
 * @param {Object} props.style Additional styles for the material container
 * @param {React.ReactNode} props.children Content to render within the material
 */
const BackdropMaterial = ({
  type = MATERIAL_TYPES.REGULAR,
  intensity,
  backgroundColor = '#FFFFFF',
  opacity,
  disableBlur = false,
  style,
  children,
  ...otherProps
}) => {
  // Determine if this device supports blur effects
  const blurSupported = platformDetection.supportsBlurEffects && !disableBlur && BlurView;
  
  // Calculate blur parameters based on material type
  const blurProperties = useMemo(() => {
    // Default parameters
    let blurType = 'regular';
    let blurIntensity = 40;
    let backdropOpacity = 0.8;
    
    // Adjust based on material type
    switch (type) {
      case MATERIAL_TYPES.THIN:
        blurType = 'light';
        blurIntensity = 20;
        backdropOpacity = 0.7;
        break;
      case MATERIAL_TYPES.THICK:
        blurType = 'dark';
        blurIntensity = 60;
        backdropOpacity = 0.9;
        break;
      case MATERIAL_TYPES.SOLID:
        blurType = null;
        blurIntensity = 0;
        backdropOpacity = 1;
        break;
    }
    
    // Override with custom values if provided
    if (intensity !== undefined) blurIntensity = intensity;
    if (opacity !== undefined) backdropOpacity = opacity;
    
    // Calculate backdrop color with opacity
    const backdropColor = backgroundColor + Math.floor(backdropOpacity * 255).toString(16).padStart(2, '0');
    
    return {
      blurType,
      blurIntensity,
      backdropColor
    };
  }, [type, intensity, backgroundColor, opacity]);
  
  // For iOS, use native materials when possible
  if (Platform.OS === 'ios' && blurSupported && type !== MATERIAL_TYPES.SOLID) {
    return (
      <BlurView
        style={style}
        blurType={blurProperties.blurType}
        blurAmount={blurProperties.blurIntensity}
        reducedTransparencyFallbackColor={blurProperties.backdropColor}
        {...otherProps}
      >
        {children}
      </BlurView>
    );
  }
  
  // For Android or when blur isn't supported, use semi-transparent background
  return (
    <View 
      style={[
        { backgroundColor: blurProperties.backdropColor },
        style
      ]}
      {...otherProps}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  }
});

export default BackdropMaterial;
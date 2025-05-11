// src/ui/platform/visualProperties.js
//
// Simplified visual property system with deterministic outputs
// Eliminates computational architecture in favor of fixed constants

import { Platform } from 'react-native';

/**
 * Corner Radius System
 * 
 * Returns fixed constant values to ensure deterministic component rendering
 * Eliminates logarithmic calculations and complex math that created rendering edge cases
 * 
 * @param {Object} size - Dimensions object (unused in simplified implementation)
 * @param {string} variant - Design variant (small, standard, large, pill)
 * @returns {number} - Fixed corner radius value
 */
const getCornerRadius = (size, variant = 'standard') => {
  // Fixed values replace complex proportional calculations
  const radiusMap = {
    'small': 4,
    'standard': 8,
    'large': 12,
    'pill': 20
  };
  
  return radiusMap[variant] || radiusMap.standard;
};

/**
 * Shadow Parameter System
 * 
 * Generates platform-appropriate shadow values with linear relationships
 * Replaces exponential calculations with direct proportional values
 * 
 * @param {number} elevation - The Z-height (0-24)
 * @returns {Object} - Platform-specific shadow parameters
 */
const getShadowParams = (elevation = 1) => {
  // Normalize elevation bounds for safety
  const normalizedElevation = Math.max(0, Math.min(24, elevation));
  
  // No shadow case
  if (normalizedElevation === 0) {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0
    };
  }
  
  // Platform-specific parameters with direct linear relationships
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { 
        width: 0, 
        height: normalizedElevation === 1 ? 1 : 2 
      },
      shadowOpacity: normalizedElevation === 1 ? 0.1 : 0.2,
      shadowRadius: normalizedElevation,
    },
    android: {
      // Direct elevation passthrough for Android
      elevation: normalizedElevation
    },
    default: {
      // Fallback for other platforms
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1,
    }
  });
};

/**
 * Typography Optical System
 * 
 * Dramatically simplified with direct passthrough parameters
 * Maintains API compatibility while eliminating complex optical calculations
 * 
 * @param {number} fontSize - Base font size
 * @param {string} weight - Font weight
 * @returns {Object} - Typography parameters
 */
const getOpticalTypography = (fontSize, weight = 'normal') => {
  // Direct passthrough for backward compatibility
  // Eliminates logarithmic calculations and complex adjustments
  return {
    fontSize,
    fontWeight: weight,
    letterSpacing: 0,
    lineHeight: Math.round(fontSize * 1.5),
    fontFamily: Platform.OS === 'ios' ? undefined : 'Roboto'
  };
};

/**
 * Navigation Icon State System
 * 
 * Simplified icon state management with deterministic outputs
 * 
 * @param {string} baseIconName - Base icon name
 * @param {boolean} active - Active state flag
 * @returns {Object} - Icon rendering parameters
 */
const getNavigationIconState = (baseIconName, active = false) => {
  // Clean base name for consistent results
  const cleanBaseName = baseIconName.replace(/-outline$/, '');
  
  // Return fixed values instead of complex conditional states
  return {
    name: active ? cleanBaseName : `${cleanBaseName}-outline`,
    size: 24,
    weight: active ? '600' : '400',
    scale: 1.0
  };
};

/**
 * Exports a minimal but compatible API surface
 * Maintains architectural backward compatibility 
 * while eliminating computational complexity
 */
export default {
  getCornerRadius,
  getShadowParams,
  getOpticalTypography,
  getNavigationIconState,
  
  // Standard elevation constants replace dynamic calculation
  elevation: {
    none: 0,
    low: 1,
    medium: 2,
    high: 4
  }
};
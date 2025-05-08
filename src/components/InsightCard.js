// src/components/InsightCard.js
//
// Strategically architected conversion surface with enhanced IAP integration
// Leverages the specialized PremiumButton component for direct purchase flow

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../ui/components/Typography';
import Button from '../ui/components/Button';
import Card from '../ui/components/Card';
import PremiumButton from './PremiumButton';
import theme from '../ui/theme';
import * as Haptics from 'expo-haptics';

/**
 * InsightCard Component
 * 
 * A presentation layer for golf insights with integrated monetization capabilities.
 * Supports multiple display variants and conditional IAP integration through PremiumButton.
 * 
 * @param {Object} props Component props
 * @param {string} props.title Card title
 * @param {string} props.content Main card content
 * @param {string} props.iconName Ionicons icon name
 * @param {string} props.variant Display variant (standard, highlight, alert, success)
 * @param {Function} props.onRefresh Optional refresh callback for premium users
 * @param {boolean} props.loading Optional loading state
 * @param {string} props.ctaText Optional call-to-action text
 * @param {Function} props.ctaAction Optional call-to-action callback
 * @param {boolean} props.usePremiumButton Whether to use PremiumButton (for conversion surfaces)
 * @param {string} props.productId Product ID for IAP (required when usePremiumButton is true)
 */
const InsightCard = ({
  title,
  content,
  iconName = 'analytics-outline',
  variant = 'standard',
  onRefresh,
  loading = false,
  ctaText,
  ctaAction,
  usePremiumButton = false,
  productId = null
}) => {
  const [expanded, setExpanded] = useState(false);
  
  // Maximum content length before showing "Read More"
  const CONTENT_PREVIEW_LENGTH = 150;
  
  // Whether content should be truncated
  const shouldTruncate = content && content.length > CONTENT_PREVIEW_LENGTH;
  
  // Get display content based on expansion state
  const displayContent = !expanded && shouldTruncate
    ? `${content.substring(0, CONTENT_PREVIEW_LENGTH)}...`
    : content;
  
  // Handle read more/less toggle with haptic feedback for engagement
  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(!expanded);
  };
  
  // Handle refresh action with haptic feedback
  const handleRefresh = () => {
    if (onRefresh) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRefresh();
    }
  };
  
  // Determine card style based on variant
  const getCardStyle = () => {
    switch (variant) {
      case 'highlight':
        return styles.highlightCard;
      case 'alert':
        return styles.alertCard;
      case 'success':
        return styles.successCard;
      default:
        return styles.standardCard;
    }
  };
  
  // Get icon color based on variant
  const getIconColor = () => {
    switch (variant) {
      case 'highlight':
        return theme.colors.primary;
      case 'alert':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      default:
        return theme.colors.text;
    }
  };
  
  // Handle purchase completion callbacks
  const handlePurchaseComplete = (result) => {
    console.log('Purchase completed:', result);
    // Notify parent component if needed
    if (ctaAction) {
      ctaAction(result);
    }
    
    // Add analytics event tracking here if needed
  };
  
  return (
    <Card style={[styles.card, getCardStyle()]} elevation="medium">
      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {iconName && (
            <Ionicons
              name={iconName}
              size={20}
              color={getIconColor()}
              style={styles.icon}
            />
          )}
          <Typography variant="subtitle" weight="semibold" style={styles.title}>
            {title}
          </Typography>
        </View>
        
        {/* Refresh button for premium users */}
        {onRefresh && !loading && (
          <TouchableOpacity 
            onPress={handleRefresh} 
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="refresh-outline" size={18} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        
        {/* Loading indicator when refreshing */}
        {loading && (
          <Ionicons name="sync-outline" size={18} color={theme.colors.text} />
        )}
      </View>
      
      {/* Card Content */}
      <View style={styles.content}>
        <Typography variant="body" style={styles.contentText}>
          {displayContent}
        </Typography>
        
        {/* Read More/Less Toggle */}
        {shouldTruncate && (
          <TouchableOpacity onPress={toggleExpanded} style={styles.readMoreButton}>
            <Typography 
              variant="body" 
              weight="medium" 
              color={theme.colors.primary}
            >
              {expanded ? 'Read Less' : 'Read More'}
            </Typography>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Call to Action - Conditional PremiumButton Integration */}
      {ctaText && (
        <View style={styles.ctaContainer}>
          {usePremiumButton ? (
            // Premium conversion surface with direct IAP flow
            <PremiumButton
              label={ctaText}
              productId={productId}
              onPurchaseComplete={handlePurchaseComplete}
              variant={variant === 'highlight' ? 'primary' : 'secondary'}
              style={styles.ctaButton}
            />
          ) : (
            // Standard button for non-purchase actions
            <Button
              onPress={ctaAction}
              variant="outline"
              style={styles.ctaButton}
            >
              {ctaText}
            </Button>
          )}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.medium,
    overflow: 'hidden',
  },
  standardCard: {
    // Default card styling
  },
  highlightCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.small,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: theme.spacing.small,
  },
  title: {
    flex: 1,
  },
  content: {
    marginBottom: theme.spacing.small,
  },
  contentText: {
    lineHeight: 22, // Optimized for mobile viewport consumption
  },
  readMoreButton: {
    marginTop: theme.spacing.small,
    alignSelf: 'flex-start',
  },
  ctaContainer: {
    marginTop: theme.spacing.small,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    minWidth: 160, // Ensure sufficient touch target size
  }
});

export default InsightCard;
// src/screens/ProfileScreen.js
//
// User profile and subscription management interface
// Architectural integration point for IAP subscription lifecycle

import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../ui/Layout';
import theme from '../ui/theme';
import Typography from '../ui/components/Typography';
import Button from '../ui/components/Button';
import Card from '../ui/components/Card';
import { supabase } from '../services/supabase';
import { AuthContext } from '../context/AuthContext';
import purchaseService from '../services/purchaseService';
import PremiumButton from '../components/PremiumButton';

/**
 * ProfileScreen Component
 * 
 * Provides user profile management, authentication control,
 * and subscription lifecycle management capabilities.
 * 
 * Core architectural integration point for user identity and
 * premium feature entitlements.
 */
export default function ProfileScreen({ navigation }) {
  // Authentication and permission state
  const { user, hasPermission, signOut } = useContext(AuthContext);
  const hasPremiumAccess = hasPermission("product_a");
  
  // Component state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  
  // Load profile data and subscription details on component mount
  useEffect(() => {
    if (user) {
      loadProfileData();
      loadSubscriptionDetails();
    } else {
      setLoading(false);
    }
  }, [user]);
  
  /**
   * Load user profile data from database
   */
  const loadProfileData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Load subscription details for premium users
   */
  const loadSubscriptionDetails = async () => {
    try {
      if (!user) return;
      
      // Query permission record for subscription details
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('profile_id', user.id)
        .eq('permission_id', 'product_a')
        .eq('active', true)
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setSubscriptionDetails({
          status: 'active',
          expiryDate: new Date(data.expires_at),
          productId: data.product_id,
          platform: data.platform,
          metadata: data.metadata
        });
      } else {
        setSubscriptionDetails(null);
      }
    } catch (error) {
      console.error('Error loading subscription details:', error);
      // Non-fatal error - don't show alert to user
    }
  };
  
  /**
   * Handle sign out action
   */
  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };
  
  /**
   * Restore previous purchases
   * Technical implementation for subscription recovery
   */
  const handleRestorePurchases = async () => {
    try {
      setRestoringPurchases(true);
      
      // Ensure IAP is initialized
      await purchaseService.initializePurchases();
      
      // Attempt restoration
      const result = await purchaseService.restorePurchases();
      
      setRestoringPurchases(false);
      
      if (result.restored) {
        Alert.alert(
          'Purchase Restored',
          'Your premium subscription has been restored successfully.',
          [{ text: 'Great!' }]
        );
        
        // Refresh subscription details and permission state
        loadSubscriptionDetails();
      } else {
        // Handle restoration failure
        const message = result.error 
          ? result.error.message 
          : 'No previous purchases found for this account.';
          
        Alert.alert('Restore Failed', message, [{ text: 'OK' }]);
      }
    } catch (error) {
      setRestoringPurchases(false);
      console.error('Error restoring purchases:', error);
      
      Alert.alert(
        'Restore Error',
        'An unexpected error occurred while restoring purchases.',
        [{ text: 'OK' }]
      );
    }
  };
  
  /**
   * Open subscription management in App Store/Play Store
   * Platform-specific deep linking implementation
   */
  const handleManageSubscription = () => {
    try {
      // Platform-specific deep links to subscription management
      if (Platform.OS === 'ios') {
        // iOS subscription management URL
        Linking.openURL('https://apps.apple.com/account/subscriptions');
      } else {
        // Android subscription management URL
        Linking.openURL('https://play.google.com/store/account/subscriptions');
      }
    } catch (error) {
      console.error('Error opening subscription management:', error);
      Alert.alert(
        'Error',
        'Unable to open subscription management. Please check your device settings.',
        [{ text: 'OK' }]
      );
    }
  };
  
  /**
   * Format subscription expiry date for display
   */
  const formatExpiryDate = (date) => {
    if (!date) return '';
    
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Render loading state
  if (loading) {
    return (
      <Layout>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Layout>
    );
  }
  
  // Render profile screen with subscription management
  return (
    <Layout>
      <View style={styles.container}>
        {/* Profile Information */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color={theme.colors.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Typography variant="subtitle">{profile?.email || user?.email}</Typography>
            </View>
          </View>
        </Card>
        
        {/* Subscription Management Section */}
        <Card style={styles.sectionCard}>
          <Typography variant="subtitle" style={styles.sectionTitle}>
            Subscription
          </Typography>
          
          {hasPremiumAccess ? (
            // Premium user subscription details
            <View style={styles.subscriptionDetails}>
              <View style={styles.subscriptionStatus}>
                <Ionicons 
                  name="checkmark-circle" 
                  size={24} 
                  color={theme.colors.success} 
                  style={styles.statusIcon}
                />
                <Typography variant="body" weight="semibold">
                  Premium Insights Active
                </Typography>
              </View>
              
              {subscriptionDetails?.expiryDate && (
                <Typography variant="secondary" style={styles.expiryText}>
                  Renews on {formatExpiryDate(subscriptionDetails.expiryDate)}
                </Typography>
              )}
              
              <View style={styles.subscriptionActions}>
                <Button
                  variant="outline"
                  size="medium"
                  onPress={handleManageSubscription}
                  style={styles.actionButton}
                >
                  Manage Subscription
                </Button>
              </View>
            </View>
          ) : (
            // Non-premium user upgrade prompt
            <View style={styles.subscriptionUpgrade}>
              <Typography variant="body" style={styles.upgradeText}>
                Upgrade to Premium Insights to access advanced analysis, personalized coaching, and exclusive features.
              </Typography>
              
              <PremiumButton 
                label="Upgrade to Premium" 
                onPurchaseComplete={loadSubscriptionDetails}
                style={styles.upgradeButton}
              />
            </View>
          )}
          
          {/* Restore Purchases - available to all users */}
          <Button
            variant="text"
            onPress={handleRestorePurchases}
            loading={restoringPurchases}
            disabled={restoringPurchases}
            style={styles.restoreButton}
          >
            Restore Purchases
          </Button>
        </Card>
        
        {/* Sign Out Button */}
        <Button
          variant="outline"
          onPress={handleSignOut}
          style={styles.signOutButton}
        >
          Sign Out
        </Button>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.medium,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    marginBottom: theme.spacing.medium,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.medium,
  },
  profileInfo: {
    flex: 1,
  },
  sectionCard: {
    marginBottom: theme.spacing.medium,
  },
  sectionTitle: {
    marginBottom: theme.spacing.medium,
  },
  subscriptionDetails: {
    marginBottom: theme.spacing.medium,
  },
  subscriptionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.small,
  },
  statusIcon: {
    marginRight: 8,
  },
  expiryText: {
    marginBottom: theme.spacing.medium,
  },
  subscriptionActions: {
    marginTop: theme.spacing.small,
  },
  actionButton: {
    alignSelf: 'flex-start',
  },
  subscriptionUpgrade: {
    marginBottom: theme.spacing.medium,
  },
  upgradeText: {
    marginBottom: theme.spacing.medium,
  },
  upgradeButton: {
    marginBottom: theme.spacing.small,
  },
  restoreButton: {
    alignSelf: 'center',
    marginTop: theme.spacing.small,
  },
  signOutButton: {
    marginTop: theme.spacing.large,
  },
});
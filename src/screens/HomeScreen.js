// src/screens/HomeScreen.js
import React, { useState, useEffect, useContext, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { AuthContext } from "../context/AuthContext";
import Layout from "../ui/Layout";
import theme from "../ui/theme";
import { supabase } from "../services/supabase";
import { trackEvent, trackError, ERROR_TYPES } from "../services/analytics";
import InsightCard from "../components/InsightCard";
import RoundSummaryCard from "../components/RoundSummaryCard";
import { getLatestInsights } from "../services/insightsService";
import Typography from "../ui/components/Typography";
import Button from "../ui/components/Button";
import Card from "../ui/components/Card";

// Technical analytics constants for screen-specific events
const SCREEN_EVENTS = {
  SCREEN_RENDERED: 'home_screen_rendered',
  DATA_LOADING_STARTED: 'home_data_loading_started',
  DATA_LOADING_COMPLETED: 'home_data_loading_completed',
  DATA_LOADING_FAILED: 'home_data_loading_failed',
  CONTENT_RENDERED: 'home_content_rendered'
};

/**
 * HomeScreen Component
 * 
 * Architecturally enhanced with:
 * - Defensively bounded data fetching
 * - Explicit timeout boundaries
 * - Error recovery mechanisms
 * - Deterministic loading states
 * - Observability instrumentation
 */
export default function HomeScreen({ navigation }) {
  // Authentication and permission context
  const { user, hasPermission, sessionRestored } = useContext(AuthContext);
  
  // Component state with explicit loading phases
  const [recentRounds, setRecentRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState('initializing'); // 'initializing', 'rounds_loading', 'insights_loading', 'complete', 'failed'
  const [error, setError] = useState(null);
  
  // Insights state with bounded fetch operations
  const [insightsSummary, setInsightsSummary] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  
  // References for operation lifecycle management
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);
  
  // Determine premium status with resilient fallback
  const hasPremiumAccess = hasPermission("product_a");

  // Instrumented component lifecycle with explicit mounting control
  useEffect(() => {
    mountedRef.current = true;
    
    // Track screen initialization
    trackEvent(SCREEN_EVENTS.SCREEN_RENDERED, {
      has_user: !!user,
      has_premium: hasPremiumAccess,
      session_restored: sessionRestored
    });
    
    // Monitor for excessive loading time
    timeoutRef.current = setTimeout(() => {
      if (loading && mountedRef.current) {
        trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, 
          new Error(`HomeScreen stuck in loading phase: ${loadingPhase}`), 
          { 
            screen: 'HomeScreen',
            loading_phase: loadingPhase,
            session_restored: sessionRestored,
            user_state: !!user ? 'logged_in' : 'logged_out',
            premium_state: hasPremiumAccess ? 'premium' : 'free'
          });
      }
    }, 10000); // 10-second timeout boundary
    
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // React to auth state changes with explicit dependency tracking
  useEffect(() => {
    if (sessionRestored) {
      // Only attempt data loading after auth session is restored
      fetchData();
    }
  }, [user, sessionRestored]);

  /**
   * Coordinated data fetching with phase management
   * Implements bounded execution and defensive state normalization
   */
  const fetchData = async () => {
    // Reset state for retries
    setError(null);
    setLoading(true);
    
    trackEvent(SCREEN_EVENTS.DATA_LOADING_STARTED, {
      has_user: !!user,
      has_premium: hasPremiumAccess
    });
    
    // Fetch rounds and insights in parallel with individual error boundaries
    try {
      if (!user) {
        // Defensive state normalization for auth failures
        setRecentRounds([]);
        setInsightsSummary(null);
        setLoading(false);
        setLoadingPhase('complete');
        
        trackEvent(SCREEN_EVENTS.DATA_LOADING_COMPLETED, {
          success: false,
          reason: 'no_user',
          has_rounds: false,
          has_insights: false
        });
        return;
      }
      
      // Explicit fetch phase tracking
      setLoadingPhase('rounds_loading');
      
      // Rounds fetch with bounded execution
      const roundsPromise = fetchRecentRounds().catch(err => {
        trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, err, {
          operation: 'fetch_recent_rounds',
          user_id: user.id
        });
        return []; // Defensive empty return to prevent UI blocking
      });
      
      // Insights fetch with bounded execution
      setLoadingPhase('insights_loading');
      const insightsPromise = fetchInsightsSummary().catch(err => {
        trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, err, {
          operation: 'fetch_insights_summary',
          user_id: user.id
        });
        return null; // Defensive null return to prevent UI blocking
      });
      
      // Race against timeout for resilience
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data fetch timeout')), 8000)
      );
      
      // Wait for both operations with timeout boundary
      const [roundsResult, insightsResult] = await Promise.all([
        Promise.race([roundsPromise, timeoutPromise]),
        Promise.race([insightsPromise, timeoutPromise])
      ]).catch(err => {
        trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, err, {
          operation: 'parallel_data_fetch',
          timeout: err.message === 'Data fetch timeout',
          user_id: user.id
        });
        return [[], null]; // Defensive empty returns for UI continuity
      });
      
      // Update state if component still mounted
      if (mountedRef.current) {
        setLoadingPhase('complete');
        setLoading(false);
        
        trackEvent(SCREEN_EVENTS.DATA_LOADING_COMPLETED, {
          success: true,
          has_rounds: Array.isArray(roundsResult) && roundsResult.length > 0,
          has_insights: !!insightsResult,
          rounds_count: Array.isArray(roundsResult) ? roundsResult.length : 0
        });
        
        trackEvent(SCREEN_EVENTS.CONTENT_RENDERED, {
          has_premium: hasPremiumAccess,
          has_rounds: Array.isArray(roundsResult) && roundsResult.length > 0,
          has_insights: !!insightsResult
        });
      }
    } catch (e) {
      // Catch-all error handler for unexpected exceptions
      if (mountedRef.current) {
        setLoadingPhase('failed');
        setLoading(false);
        setError(e.message || "Failed to load content");
        
        trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, e, {
          operation: 'home_screen_data_fetch',
          critical: true,
          user_id: user?.id
        });
        
        trackEvent(SCREEN_EVENTS.DATA_LOADING_FAILED, {
          error_message: e.message,
          has_user: !!user
        });
      }
    }
  };

  /**
   * Bounded rounds fetch operation with resilient error handling
   */
  const fetchRecentRounds = async () => {
    if (!user) return [];
    
    try {
      // Fetch rounds with essential fields for UI rendering
      const { data, error } = await supabase
        .from("rounds")
        .select(`
          id, 
          profile_id,
          course_id,
          created_at,
          score,
          gross_shots,
          is_complete,
          course:course_id (
            id,
            name
          )
        `)
        .eq("profile_id", user.id)
        .eq("is_complete", true)
        .order("created_at", { ascending: false })
        .limit(5);
        
      if (error) throw error;
      
      if (!data || !Array.isArray(data)) return [];
      
      // Process rounds with defensive structure validation
      const processedRounds = data.map(round => ({
        id: round.id,
        date: round.created_at,
        courseName: round.course?.name || "Unknown Course",
        score: round.score,
        grossShots: round.gross_shots,
        isComplete: round.is_complete
      }));
      
      setRecentRounds(processedRounds);
      return processedRounds;
    } catch (error) {
      console.error("Error in fetchRecentRounds:", error);
      // Don't update state here - error handling in caller
      throw error;
    }
  };

  /**
   * Bounded insights fetch with permission-aware requests
   */
  const fetchInsightsSummary = async () => {
    if (!user) return null;
    
    try {
      // Use permission-aware insights service
      const summary = await getLatestInsights(user.id, 'summary');
      
      if (mountedRef.current) {
        setInsightsSummary(summary);
      }
      
      return summary;
    } catch (error) {
      console.error("Error fetching insights summary:", error);
      // Don't update state here - error handling in caller
      throw error;
    } finally {
      if (mountedRef.current) {
        setInsightsLoading(false);
      }
    }
  };
  
  /**
   * Refresh insights with explicit analytics tracking
   */
  const refreshInsights = async () => {
    if (!user) return;
    
    setInsightsLoading(true);
    
    trackEvent('insights_refresh_requested', {
      screen: 'HomeScreen',
      has_premium: hasPremiumAccess
    });
    
    try {
      const summary = await getLatestInsights(user.id, 'summary');
      
      if (mountedRef.current) {
        setInsightsSummary(summary);
        setInsightsLoading(false);
        
        trackEvent('insights_refresh_completed', {
          success: true
        });
      }
    } catch (error) {
      console.error("Error refreshing insights:", error);
      
      if (mountedRef.current) {
        setInsightsLoading(false);
      }
      
      trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, error, {
        operation: 'refresh_insights',
        user_id: user.id
      });
    }
  };

  /**
   * Navigation handler with explicit tracking
   */
  const handleRoundPress = (roundId) => {
    trackEvent('round_selected', {
      round_id: roundId
    });
    
    navigation.navigate("ScorecardScreen", { roundId });
  };

  /**
   * Defensive render method with fallback states
   * Ensures UI is always responsive regardless of data state
   */
  return (
    <Layout>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.container}>
          {/* Primary Monetization Surface: Insights Card */}
          <InsightCard
            title="Coach's Corner"
            content={insightsSummary || "Complete a round to get personalized insights from your golf coach."}
            loading={insightsLoading}
            variant={hasPremiumAccess ? "highlight" : "standard"}
            onRefresh={hasPremiumAccess ? refreshInsights : undefined}
            ctaText={!hasPremiumAccess && insightsSummary ? "Unlock Full Analysis" : undefined}
            ctaAction={() => navigation.navigate("Subscription")}
          />
          
          {/* Start New Round button */}
          <Button
            variant="primary"
            size="large"
            onPress={() => {
              trackEvent('start_new_round_pressed', {
                has_premium: hasPremiumAccess
              });
              navigation.navigate("CourseSelector");
            }}
            style={styles.primaryButton}
          >
            Start New Round
          </Button>
          
          <View style={styles.recentRoundsSection}>
            {/* Section title for Recent Rounds */}
            <Typography 
              variant="subtitle" 
              style={styles.sectionTitle}
            >
              Recent Rounds
            </Typography>
            
            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            ) : error ? (
              // Error state with retry capability
              <Card variant="flat" style={styles.errorCard}>
                <Typography variant="body" style={styles.errorText}>
                  {error}
                </Typography>
                <Button
                  variant="outline"
                  size="small"
                  onPress={fetchData}
                  style={styles.retryButton}
                >
                  Retry
                </Button>
              </Card>
            ) : recentRounds.length > 0 ? (
              <View style={styles.roundsList}>
                {recentRounds.map(round => (
                  <RoundSummaryCard 
                    key={round.id}
                    round={round} 
                    onPress={() => handleRoundPress(round.id)}
                  />
                ))}
              </View>
            ) : (
              // Empty state with clear onboarding
              <Card variant="flat" style={styles.emptyStateCard}>
                <Typography 
                  variant="body" 
                  italic 
                  align="center"
                >
                  No completed rounds yet. Start tracking your game!
                </Typography>
              </Card>
            )}
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    alignItems: "center",
    padding: theme.spacing.medium,
  },
  primaryButton: {
    marginVertical: theme.spacing.medium,
    minWidth: 200,
  },
  recentRoundsSection: {
    width: "100%",
    marginTop: theme.spacing.large,
  },
  sectionTitle: {
    marginBottom: theme.spacing.medium,
  },
  roundsList: {
    width: "100%",
  },
  emptyStateCard: {
    padding: theme.spacing.medium,
  },
  errorCard: {
    padding: theme.spacing.medium,
    backgroundColor: '#FFF5F5',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.error,
  },
  errorText: {
    marginBottom: theme.spacing.small,
    color: theme.colors.error,
  },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.small,
  }
});
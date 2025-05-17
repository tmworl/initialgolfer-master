import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase';

/**
 * Core architectural diagnostic component that instruments critical execution boundaries
 * to identify asynchronous execution discontinuities in the React/Supabase pipeline.
 * 
 * @param {Function} dataFetcher - Async function that returns data
 * @param {string} fetcherName - Display name for the diagnostic
 * @returns {React.Component} Diagnostic visualization
 */
export function ArchitectureDiagnostic({ dataFetcher, fetcherName }) {
  const { user, sessionRestored } = useContext(AuthContext);
  const [diagnostics, setDiagnostics] = useState({
    // Lifecycle boundaries
    componentMounted: true,
    mountTimestamp: Date.now(),
    renderCount: 0,
    
    // Data flow boundaries
    fetchInitiated: false,
    fetchTimestamp: null,
    dataReceived: false,
    dataTimestamp: null,
    stateUpdated: false,
    stateTimestamp: null,
    
    // Auth boundaries
    authStatus: sessionRestored ? 'RESTORED' : 'PENDING',
    tokenValid: null,
    sessionAvailable: !!user,
    
    // Execution coherence
    fetchToDataMs: null,
    dataToStateMs: null,
    mountToNowMs: null,
    anomalyDetected: false,
    
    // Result state
    result: 'INITIALIZING',
  });
  
  const renderCounter = useRef(0);
  const mounted = useRef(true);
  const lastUpdateTime = useRef(Date.now());
  
  // Track render executions and component lifetime
  useEffect(() => {
    renderCounter.current++;
    const now = Date.now();
    
    setDiagnostics(prev => ({
      ...prev,
      renderCount: renderCounter.current,
      mountToNowMs: now - prev.mountTimestamp,
      lastRenderTimestamp: now
    }));
    
    lastUpdateTime.current = now;
  });
  
  // Verify authentication state
  useEffect(() => {
    async function verifyAuthState() {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setDiagnostics(prev => ({
            ...prev,
            authStatus: 'ERROR',
            anomalyDetected: true,
            authError: error.message
          }));
          return;
        }
        
        setDiagnostics(prev => ({
          ...prev,
          authStatus: data?.session ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
          tokenValid: !!data?.session?.access_token,
          sessionAvailable: !!data?.session,
          tokenExpiresAt: data?.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString().split('T')[1].slice(0, 8) : 'N/A'
        }));
      } catch (e) {
        setDiagnostics(prev => ({
          ...prev,
          authStatus: 'ERROR',
          anomalyDetected: true,
          authError: e.message
        }));
      }
    }
    
    verifyAuthState();
    
    // Cleanup function
    return () => {
      mounted.current = false;
      setDiagnostics(prev => ({
        ...prev,
        componentMounted: false
      }));
    };
  }, []);
  
  // Execute test data fetch
  useEffect(() => {
    if (!dataFetcher) return;
    
    async function executeDiagnosticFetch() {
      const fetchStart = Date.now();
      setDiagnostics(prev => ({
        ...prev,
        fetchInitiated: true,
        fetchTimestamp: fetchStart,
        result: 'FETCHING'
      }));
      
      try {
        const { data, error } = await dataFetcher();
        const dataReceived = Date.now();
        
        if (!mounted.current) {
          // Critical architectural discontinuity detected
          setDiagnostics(prev => ({
            ...prev,
            dataReceived: true,
            dataTimestamp: dataReceived,
            fetchToDataMs: dataReceived - fetchStart,
            anomalyDetected: true,
            result: 'UNMOUNTED_WITH_DATA'
          }));
          return;
        }
        
        if (error) {
          setDiagnostics(prev => ({
            ...prev,
            dataReceived: true,
            dataTimestamp: dataReceived,
            fetchToDataMs: dataReceived - fetchStart,
            result: 'ERROR',
            dataError: error.message
          }));
          return;
        }
        
        setDiagnostics(prev => ({
          ...prev,
          dataReceived: true,
          dataTimestamp: dataReceived,
          fetchToDataMs: dataReceived - fetchStart,
          hasData: !!data,
          dataCount: Array.isArray(data) ? data.length : (data ? 1 : 0)
        }));
        
        // Set dummy state to validate state propagation
        setTimeout(() => {
          if (mounted.current) {
            const stateUpdated = Date.now();
            setDiagnostics(prev => ({
              ...prev,
              stateUpdated: true,
              stateTimestamp: stateUpdated,
              dataToStateMs: stateUpdated - prev.dataTimestamp,
              result: 'VERIFIED'
            }));
          }
        }, 50);
      } catch (e) {
        setDiagnostics(prev => ({
          ...prev,
          result: 'ERROR',
          anomalyDetected: true,
          dataError: e.message
        }));
      }
    }
    
    executeDiagnosticFetch();
  }, [dataFetcher]);
  
  // Determine diagnostic status color
  const getStatusColor = () => {
    switch (diagnostics.result) {
      case 'VERIFIED': return '#4CAF50';  // Green
      case 'FETCHING': return '#2196F3';  // Blue
      case 'ERROR': return '#F44336';     // Red
      case 'UNMOUNTED_WITH_DATA': return '#FF9800';  // Orange
      default: return '#9E9E9E';  // Gray
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={[styles.statusText, { color: getStatusColor() }]}>
        {fetcherName}: {diagnostics.result}
      </Text>
      
      <Text style={styles.metricText}>
        Auth: {diagnostics.authStatus} {diagnostics.tokenValid ? '✓' : '✗'}{' '}
        Session: {diagnostics.sessionAvailable ? '✓' : '✗'}{' '}
        Expires: {diagnostics.tokenExpiresAt || 'N/A'}
      </Text>
      
      <Text style={styles.metricText}>
        Fetch→Data: {diagnostics.fetchToDataMs || '-'}ms{' '}
        Data→State: {diagnostics.dataToStateMs || '-'}ms{' '}
        Alive: {diagnostics.mountToNowMs || '-'}ms{' '}
        Renders: {diagnostics.renderCount}
      </Text>
      
      {diagnostics.hasData !== undefined && (
        <Text style={styles.metricText}>
          Data: {diagnostics.hasData ? '✓' : '✗'}{' '}
          Count: {diagnostics.dataCount || 0}
        </Text>
      )}
      
      {diagnostics.anomalyDetected && (
        <Text style={styles.warningText}>
          ⚠️ Architectural discontinuity detected!
        </Text>
      )}
      
      {(diagnostics.authError || diagnostics.dataError) && (
        <Text style={styles.errorText}>
          Error: {diagnostics.authError || diagnostics.dataError}
        </Text>
      )}
    </View>
  );
}

/**
 * Integrated diagnostic panel that tests core data boundaries in the application.
 * Provides comprehensive insights into auth pipeline, data flow, and component
 * lifecycle alignment.
 */
export function DiagnosticPanel() {
  const { user } = useContext(AuthContext);
  
  // Define critical data fetching pipelines for instrumentation
  const fetchRounds = () => supabase
    .from('rounds')
    .select('id,profile_id,course_id,created_at,score,gross_shots,is_complete')
    .eq('profile_id', user?.id)
    .eq('is_complete', true)
    .order('created_at', { ascending: false })
    .limit(5);
    
  const fetchInsights = () => supabase
    .from('insights')
    .select('*')
    .eq('profile_id', user?.id)
    .order('created_at', { ascending: false })
    .limit(1);
    
  const fetchPermissions = () => supabase
    .from('user_permissions')
    .select('*')
    .eq('profile_id', user?.id)
    .eq('active', true);
  
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Architecture Diagnostics</Text>
      <Text style={styles.panelSubtitle}>
        Verify Token→Fetch→State Pipeline Integrity
      </Text>
      
      <ArchitectureDiagnostic 
        dataFetcher={fetchRounds} 
        fetcherName="Rounds" 
      />
      <ArchitectureDiagnostic 
        dataFetcher={fetchInsights} 
        fetcherName="Insights" 
      />
      <ArchitectureDiagnostic 
        dataFetcher={fetchPermissions} 
        fetcherName="Permissions" 
      />
      
      <Text style={styles.instructionText}>
        Diagnostic interpretation:{'\n'}
        • GREEN = Pipeline verified, all boundaries traversed{'\n'}
        • ORANGE = Component unmounted before state propagation{'\n'}
        • RED = Execution failure at architectural boundary{'\n'}
        • BLUE = In-progress execution
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  panel: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  panelSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    color: '#666',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricText: {
    fontSize: 12,
    marginBottom: 4,
  },
  warningText: {
    color: '#FF9800',
    fontWeight: 'bold',
    marginTop: 4,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  },
  instructionText: {
    fontSize: 12,
    marginTop: 12,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  }
});
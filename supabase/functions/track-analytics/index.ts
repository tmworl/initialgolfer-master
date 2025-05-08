// supabase/functions/track-analytics/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.0';

// Configuration constants
const POSTHOG_API_KEY = Deno.env.get("POSTHOG_API_KEY");
const POSTHOG_API_HOST = "https://eu.i.posthog.com";

// Technical error codes for operational diagnostics
const ERROR_CODES = {
  INVALID_PAYLOAD: 'invalid_payload',
  AUTH_FAILURE: 'authentication_failure',
  POSTHOG_API_ERROR: 'posthog_api_error',
  INTERNAL_ERROR: 'internal_server_error'
};

serve(async (req) => {
  // CORS handling with appropriate security headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ 
          error: ERROR_CODES.INVALID_PAYLOAD,
          message: "Method not allowed" 
        }),
        { 
          status: 405, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Parse and validate request payload
    let payload;
    try {
      payload = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          error: ERROR_CODES.INVALID_PAYLOAD,
          message: "Invalid JSON payload" 
        }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    const { event, properties } = payload;
    
    // Validate event structure
    if (!event || typeof event !== "string") {
      return new Response(
        JSON.stringify({ 
          error: ERROR_CODES.INVALID_PAYLOAD,
          message: "Invalid event name" 
        }),
        { 
          status: 400, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }
    
    // Extract and validate user identity
    let userId = properties.distinct_id || "anonymous";
    const authHeader = req.headers.get("Authorization");
    
    // Attempt JWT validation if header present
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        
        // Create Supabase client with environment credentials
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") || "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
        );
        
        // Validate JWT and extract user ID
        const { data, error } = await supabase.auth.getUser(token);
        
        if (!error && data?.user) {
          userId = data.user.id;
          console.log(`User identified: ${userId}`);
        } else {
          console.warn("JWT validation failed:", error?.message);
        }
      } catch (authError) {
        console.error("Authentication error:", authError);
        // Continue with provided or anonymous ID
      }
    }
    
    // Enrich event with server-side context
    const enrichedProperties = {
      distinct_id: userId,
      ...properties,
      // Append server-side properties
      server_processed: true,
      server_timestamp: new Date().toISOString(),
      processing_instance: Deno.env.get("DENO_DEPLOYMENT_ID") || "development"
    };
    
    // Construct PostHog payload
    const posthogPayload = {
      api_key: POSTHOG_API_KEY,
      event,
      properties: enrichedProperties
    };
    
    // Validate PostHog API key
    if (!POSTHOG_API_KEY) {
      console.error("Missing PostHog API key in environment");
      return new Response(
        JSON.stringify({ 
          error: ERROR_CODES.INTERNAL_ERROR,
          message: "Analytics configuration error" 
        }),
        { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }
    
    // Forward to PostHog API
    console.log(`Forwarding event "${event}" to PostHog`);
    const posthogResponse = await fetch(`${POSTHOG_API_HOST}/capture/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(posthogPayload)
    });
    
    if (!posthogResponse.ok) {
      const errorData = await posthogResponse.text();
      console.error(`PostHog API error (${posthogResponse.status}):`, errorData);
      
      throw new Error(`PostHog API error: ${posthogResponse.status}`);
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        event_id: crypto.randomUUID() // Include event ID for client correlation
      }),
      { 
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate"
        } 
      }
    );
    
  } catch (error) {
    console.error("Error processing analytics event:", error);
    
    return new Response(
      JSON.stringify({ 
        error: ERROR_CODES.INTERNAL_ERROR,
        message: error.message || "Internal server error"
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
});
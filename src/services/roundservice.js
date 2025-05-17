// src/services/roundservice.js

import { supabase } from "./supabase";
import { trackEvent, trackError, ERROR_TYPES, EVENTS } from "./analytics";

/**
 * Create a new round record in Supabase with analytics tracking.
 * 
 * @param {string} profile_id - The current user's profile ID.
 * @param {string} course_id - The ID of the course.
 * @param {string} tee_id - The ID of the selected tee.
 * @param {string} tee_name - The name of the selected tee.
 * @returns {object} The newly created round record.
 */
export const createRound = async (profile_id, course_id, tee_id, tee_name) => {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from("rounds")
      .insert({
        profile_id,
        course_id,
        is_complete: false,
        selected_tee_id: tee_id,
        selected_tee_name: tee_name
      })
      .select();

    const duration = Date.now() - startTime;

    if (error) {
      trackEvent(EVENTS.ROUND_ENTITY_CREATED, {
        success: false,
        error_code: error.code,
        error_message: error.message,
        profile_id,
        course_id, 
        tee_id,
        operation_duration_ms: duration
      });
      
      console.error("[createRound] Error creating round:", error);
      throw error;
    }

    const createdRound = data[0];
    
    trackEvent(EVENTS.ROUND_ENTITY_CREATED, {
      success: true,
      round_id: createdRound.id,
      profile_id,
      course_id,
      tee_id,
      tee_name,
      created_at: createdRound.created_at,
      operation_duration_ms: duration
    });

    return createdRound;
  } catch (error) {
    console.error("[createRound] Error creating round:", error);
    throw error;
  }
};

/**
 * Save hole data for a specific hole
 * 
 * This function saves hole data including shots in the new
 * hole-centric format to the shots table.
 * 
 * @param {string} round_id - The ID of the round
 * @param {number} hole_number - The hole number (1-18)
 * @param {object} hole_data - The hole data including par, distance, and shots
 * @param {number} total_score - The total number of shots for this hole
 * @returns {object} The saved record
 */
export const saveHoleData = async (round_id, hole_number, hole_data, total_score) => {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from("shots")
      .upsert({
        round_id,
        hole_number,
        hole_data,
        total_score
      }, {
        onConflict: 'round_id,hole_number',
        returning: 'representation'
      });
    
    const duration = Date.now() - startTime;

    if (error) {
      trackEvent(EVENTS.HOLE_DATA_SAVED, {
        success: false,
        error_code: error.code,
        error_message: error.message,
        round_id,
        hole_number,
        operation_duration_ms: duration
      });
      
      console.error("[saveHoleData] Error saving hole data:", error);
      throw error;
    }
    
    trackEvent(EVENTS.HOLE_DATA_SAVED, {
      success: true,
      round_id,
      hole_number,
      total_score,
      operation_duration_ms: duration
    });
    
    return data;
  } catch (error) {
    console.error("[saveHoleData] Exception in saveHoleData:", error);
    throw error;
  }
};

/**
 * Get all hole data for a round
 * 
 * @param {string} round_id - The ID of the round
 * @returns {Array} Array of hole data records
 */
export const getRoundHoleData = async (round_id) => {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase
      .from("shots")
      .select("*")
      .eq("round_id", round_id)
      .order("hole_number", { ascending: true });
    
    const duration = Date.now() - startTime;

    if (error) {
      trackEvent(EVENTS.ROUND_DATA_FETCHED, {
        success: false,
        error_code: error.code,
        error_message: error.message,
        round_id,
        operation_duration_ms: duration
      });
      
      console.error("[getRoundHoleData] Error getting hole data:", error);
      throw error;
    }
    
    trackEvent(EVENTS.ROUND_DATA_FETCHED, {
      success: true,
      round_id,
      holes_count: data?.length || 0,
      operation_duration_ms: duration
    });
    
    return data || [];
  } catch (error) {
    console.error("[getRoundHoleData] Exception in getRoundHoleData:", error);
    return [];
  }
};

/**
 * Complete a round by updating its is_complete flag and calculating final statistics.
 * Works with the new shots data structure.
 * 
 * @param {string} round_id - The ID of the round to complete.
 * @returns {object} The updated round record.
 */
export const completeRound = async (round_id) => {
  const startTime = Date.now();
  const context = { round_id };
  
  try {
    // FIRST THING: Refresh the authentication token before proceeding
    // This ensures we have a fresh token for the entire completion process
    console.log("[completeRound] Refreshing authentication token...");
    const { error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.warn("[completeRound] Token refresh warning, proceeding with current token:", refreshError);
      // Continue with operation - the current token might still be valid
      // Track the refresh attempt failure for monitoring
      await trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, refreshError, {
        ...context,
        error_stage: 'token_refresh',
        operation_duration_ms: Date.now() - startTime
      });
    } else {
      console.log("[completeRound] Token refreshed successfully");
    }
    
    // Fetch round data
    const { data: roundData, error: roundError } = await supabase
      .from("rounds")
      .select("course_id, profile_id, selected_tee_name") 
      .eq("id", round_id)
      .single();
      
    if (roundError) {
      await trackError(ERROR_TYPES.ROUND_COMPLETION_ERROR, roundError, {
        ...context,
        error_stage: 'round_data_fetch',
        operation_duration_ms: Date.now() - startTime
      });
      throw roundError;
    }
    
    // Fetch course data
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("par")
      .eq("id", roundData.course_id)
      .single();
      
    if (courseError) {
      await trackError(ERROR_TYPES.ROUND_COMPLETION_ERROR, courseError, {
        ...context,
        course_id: roundData.course_id,
        error_stage: 'course_data_fetch',
        operation_duration_ms: Date.now() - startTime
      });
      throw courseError;
    }
    
    const coursePar = courseData.par || 72;
    
    // Fetch hole records
    const { data: holeRecords, error: holesError } = await supabase
      .from("shots")
      .select("total_score")
      .eq("round_id", round_id);
      
    if (holesError) {
      await trackError(ERROR_TYPES.ROUND_COMPLETION_ERROR, holesError, {
        ...context,
        error_stage: 'holes_data_fetch',
        operation_duration_ms: Date.now() - startTime
      });
      throw holesError;
    }
    
    let grossShots = 0;
    holeRecords.forEach(hole => {
      grossShots += hole.total_score || 0;
    });
    
    const score = grossShots - coursePar;
    
    // Update round with completion data
    const { data, error } = await supabase
      .from("rounds")
      .update({ 
        is_complete: true,
        gross_shots: grossShots,
        score: score
      })
      .eq("id", round_id)
      .select();

    const duration = Date.now() - startTime;

    if (error) {
      await trackError(ERROR_TYPES.ROUND_COMPLETION_ERROR, error, {
        ...context,
        error_stage: 'round_update',
        gross_shots: grossShots,
        score,
        operation_duration_ms: duration
      });
      throw error;
    }

    // Track successful completion
    trackEvent(EVENTS.ROUND_COMPLETED, {
      success: true,
      round_id,
      profile_id: roundData.profile_id,
      course_id: roundData.course_id,
      gross_shots: grossShots,
      score,
      course_par: coursePar,
      holes_played: holeRecords.length,
      operation_duration_ms: duration
    });
    
    // Generate insights
    try {
      console.log("[completeRound] Triggering insights generation");
      
      const insightsPromise = supabase.functions.invoke('analyze-golf-performance', {
        body: { 
          userId: roundData.profile_id,
          roundId: round_id
        }
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Insights generation timeout')), 30000)
      );

      Promise.race([insightsPromise, timeoutPromise])
        .then(({ data: insightsData, error: insightsError }) => {
          if (insightsError) {
            trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, insightsError, {
              ...context,
              error_stage: 'insights_generation',
              operation_duration_ms: Date.now() - startTime
            });
          } else {
            trackEvent(EVENTS.INSIGHTS_GENERATED, {
              success: true,
              round_id,
              insights_count: insightsData?.insights?.length || 0
            });
          }
        })
        .catch(err => {
          trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, err, {
            ...context,
            error_stage: 'insights_generation_timeout',
            operation_duration_ms: Date.now() - startTime
          });
        });
      
    } catch (insightsError) {
      console.error("[completeRound] Failed to trigger insights:", insightsError);
      await trackError(ERROR_TYPES.DATA_PERSISTENCE_ERROR, insightsError, {
        ...context,
        error_stage: 'insights_generation_failed',
        operation_duration_ms: Date.now() - startTime
      });
    }

    return data;
  } catch (error) {
    console.error("[completeRound] Error in complete round process:", error);
    
    // Catch-all error tracking
    await trackError(ERROR_TYPES.ROUND_COMPLETION_ERROR, error, {
      ...context,
      error_stage: 'unknown',
      operation_duration_ms: Date.now() - startTime
    });
    
    throw error;
  }
};

/**
 * Delete a round that was abandoned before completion
 * 
 * @param {string} round_id - The ID of the round to delete
 * @returns {Promise<boolean>} Success status
 */
export const deleteAbandonedRound = async (round_id) => {
  const startTime = Date.now();
  
  try {
    const { error } = await supabase
      .from("rounds")
      .delete()
      .eq("id", round_id)
      .eq("is_complete", false);
    
    const duration = Date.now() - startTime;

    if (error) {
      trackEvent(EVENTS.ROUND_ABANDONED, {
        success: false,
        error_code: error.code,
        error_message: error.message,
        round_id,
        operation_duration_ms: duration
      });
      
      console.error("[deleteAbandonedRound] Error deleting round:", error);
      return false;
    }
    
    trackEvent(EVENTS.ROUND_ABANDONED, {
      success: true,
      round_id,
      operation_duration_ms: duration
    });
    
    console.log("[deleteAbandonedRound] Successfully deleted abandoned round");
    return true;
  } catch (error) {
    console.error("[deleteAbandonedRound] Exception deleting round:", error);
    return false;
  }
};
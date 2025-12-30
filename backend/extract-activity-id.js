/**
 * Extract Activity ID from tincan.xml
 * Utility function to parse tincan.xml and get the main course activity ID
 */

import { parseStringPromise } from 'xml2js';

/**
 * Extract activity ID from tincan.xml content
 */
export async function extractActivityIdFromXml(xmlContent) {
  try {
    const result = await parseStringPromise(xmlContent);
    
    // Navigate through XML structure
    const tincan = result.tincan;
    if (!tincan || !tincan.activities || !tincan.activities[0] || !tincan.activities[0].activity) {
      throw new Error('Invalid tincan.xml structure');
    }
    
    const activities = tincan.activities[0].activity;
    
    // Find the main course activity (type="http://adlnet.gov/expapi/activities/course")
    const courseActivity = activities.find(activity => {
      const type = activity.$?.type || activity.type?.[0];
      return type === 'http://adlnet.gov/expapi/activities/course';
    });
    
    if (!courseActivity) {
      // Fallback: use first activity
      const firstActivity = activities[0];
      const activityId = firstActivity.$?.id || firstActivity.id?.[0];
      if (activityId) {
        return activityId;
      }
      throw new Error('No activity ID found in tincan.xml');
    }
    
    // Get activity ID
    const activityId = courseActivity.$?.id || courseActivity.id?.[0];
    
    if (!activityId) {
      throw new Error('Activity ID not found in course activity');
    }
    
    return activityId;
  } catch (error) {
    throw new Error(`Failed to parse tincan.xml: ${error.message}`);
  }
}


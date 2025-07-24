/**
 * Legacy type compatibility layer
 * 
 * This file provides backward compatibility for any legacy save files or components
 * that might reference old type structures. Since the refactoring maintained
 * 100% backward compatibility, this file is minimal and serves as a placeholder
 * for any future legacy support needs.
 */

import type { SaveData, CustomRule } from './index';

/**
 * Legacy save data structure that might contain the old 'userKnowledge' field
 * This is automatically migrated to the new customRules structure
 */
export interface LegacySaveData extends Omit<SaveData, 'customRules'> {
  customRules?: CustomRule[];
  userKnowledge?: string; // Legacy field that gets migrated to customRules
}

/**
 * Migration utility for legacy save data
 */
export function migrateLegacySaveData(legacyData: LegacySaveData): SaveData {
  const { userKnowledge, ...rest } = legacyData;
  
  // If legacy userKnowledge exists, migrate it to customRules
  let customRules = rest.customRules || [];
  
  if (userKnowledge && !customRules.some(rule => rule.id === 'imported_knowledge')) {
    customRules = [
      ...customRules,
      {
        id: 'imported_knowledge',
        content: userKnowledge,
        isActive: true
      }
    ];
  }

  return {
    ...rest,
    customRules,
    // Ensure all required fields have defaults
    turnCount: rest.turnCount || 0,
    party: rest.party || [],
    systemInstruction: rest.systemInstruction || ''
  } as SaveData;
}

/**
 * Type guard to check if data is legacy format
 */
export function isLegacySaveData(data: any): data is LegacySaveData {
  return data && typeof data === 'object' && 'userKnowledge' in data;
}

// Re-export all current types for compatibility
export * from './index';

export default {
  migrateLegacySaveData,
  isLegacySaveData
};
import type { Quest, SaveData, Memory, Entity } from '../types';
import type { GeneratedQuest } from './QuestGenerator';
import type { ValidationResult } from './QuestValidator';
import { MemoryEnhancer } from './MemoryEnhancer';

export interface QuestIntegrationResult {
    success: boolean;
    integratedQuests: GeneratedQuest[];
    createdMemories: Memory[];
    updatedEntities: string[];
    integrationStats: {
        questsAdded: number;
        memoriesCreated: number;
        entitiesUpdated: number;
        duplicatesSkipped: number;
    };
    errors: string[];
    warnings: string[];
}

export interface IntegrationConfig {
    maxSimultaneousQuests: number;
    createIntegrationMemories: boolean;
    updateEntityRelationships: boolean;
    checkForDuplicates: boolean;
    skipLowConfidenceQuests: boolean;
    minimumConfidence: number;
}

export class QuestIntegrator {
    
    private static readonly DEFAULT_CONFIG: IntegrationConfig = {
        maxSimultaneousQuests: 5,
        createIntegrationMemories: true,
        updateEntityRelationships: true,
        checkForDuplicates: true,
        skipLowConfidenceQuests: true,
        minimumConfidence: 0.6
    };

    /**
     * Integrate validated quests into game state
     */
    public static integrateQuests(
        validatedQuests: { quest: GeneratedQuest; validation: ValidationResult }[],
        gameState: SaveData,
        config: IntegrationConfig = this.DEFAULT_CONFIG
    ): QuestIntegrationResult {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🎯 [${timestamp}] Quest Integration Started:`, {
            questsToIntegrate: validatedQuests.length,
            currentActiveQuests: gameState.quests.filter(q => q.status === 'active').length,
            maxAllowed: config.maxSimultaneousQuests
        });

        const integratedQuests: GeneratedQuest[] = [];
        const createdMemories: Memory[] = [];
        const updatedEntities: string[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        let duplicatesSkipped = 0;

        // Filter quests based on validation and configuration
        const questsToProcess = this.filterQuestsForIntegration(validatedQuests, gameState, config);

        for (const { quest, validation } of questsToProcess) {
            try {
                // Check if we can add more quests
                const activeQuests = gameState.quests.filter(q => q.status === 'active').length;
                if (activeQuests >= config.maxSimultaneousQuests) {
                    warnings.push(`Đạt giới hạn ${config.maxSimultaneousQuests} quest cùng lúc, bỏ qua quest: ${quest.title}`);
                    break;
                }

                // Check for duplicates (including already processed quests in this batch)
                const allExistingQuests = [...gameState.quests, ...integratedQuests];
                console.log(`🔍 [${timestamp}] Checking duplicates for quest: "${quest.title}"`);
                console.log(`🔍 [${timestamp}] Existing quests count: ${allExistingQuests.length}`);
                
                if (config.checkForDuplicates && this.isDuplicateQuest(quest, allExistingQuests)) {
                    // Try to make title unique instead of skipping
                    const originalTitle = quest.title;
                    console.log(`⚠️ [${timestamp}] Duplicate detected: "${originalTitle}"`);
                    
                    quest.title = this.makeQuestTitleUnique(quest.title, allExistingQuests);
                    
                    if (quest.title === originalTitle) {
                        // Still duplicate, skip it
                        duplicatesSkipped++;
                        console.log(`❌ [${timestamp}] Could not make unique, skipping: "${quest.title}"`);
                        warnings.push(`Bỏ qua quest trùng lặp: ${quest.title}`);
                        continue;
                    } else {
                        console.log(`✅ [${timestamp}] Renamed quest: "${originalTitle}" → "${quest.title}"`);
                        warnings.push(`Đã đổi tên quest từ "${originalTitle}" thành "${quest.title}" để tránh trùng lặp`);
                    }
                } else {
                    console.log(`✅ [${timestamp}] Quest "${quest.title}" is unique`);
                }

                // Integrate the quest
                const integrationResult = this.integrateIndividualQuest(quest, validation, gameState, config);
                
                if (integrationResult.success) {
                    integratedQuests.push(integrationResult.quest);
                    createdMemories.push(...integrationResult.memories);
                    updatedEntities.push(...integrationResult.updatedEntities);
                    
                    // Add quest to game state
                    gameState.quests.push(integrationResult.quest);
                } else {
                    errors.push(`Failed to integrate quest: ${quest.title} - ${integrationResult.error}`);
                }

            } catch (error) {
                errors.push(`Integration error for quest "${quest.title}": ${error}`);
                console.error('Quest integration error:', error);
            }
        }

        // Update game state with new memories
        if (createdMemories.length > 0) {
            gameState.memories.push(...createdMemories);
        }

        const integrationStats = {
            questsAdded: integratedQuests.length,
            memoriesCreated: createdMemories.length,
            entitiesUpdated: updatedEntities.length,
            duplicatesSkipped
        };

        console.log(`✅ [${timestamp}] Quest Integration Complete:`, integrationStats);

        return {
            success: integratedQuests.length > 0,
            integratedQuests,
            createdMemories,
            updatedEntities,
            integrationStats,
            errors,
            warnings
        };
    }

    /**
     * Integrate a single quest into the game state
     */
    private static integrateIndividualQuest(
        quest: GeneratedQuest,
        validation: ValidationResult,
        gameState: SaveData,
        config: IntegrationConfig
    ): { success: boolean; quest: GeneratedQuest; memories: Memory[]; updatedEntities: string[]; error?: string } {
        const memories: Memory[] = [];
        const updatedEntities: string[] = [];

        try {
            // Use processed quest if validation provided fixes
            const finalQuest = validation.processedQuest || quest;

            // Create integration memory if configured
            if (config.createIntegrationMemories) {
                const integrationMemory = this.createQuestIntegrationMemory(finalQuest, gameState);
                if (integrationMemory) {
                    memories.push(integrationMemory);
                }
            }

            // Update entity relationships if configured
            if (config.updateEntityRelationships) {
                const entityUpdates = this.updateEntityRelationships(finalQuest, gameState);
                updatedEntities.push(...entityUpdates);
            }

            // Ensure quest giver exists in known entities
            if (finalQuest.giver && !gameState.knownEntities[finalQuest.giver]) {
                const newGiver = this.createQuestGiverEntity(finalQuest, gameState);
                gameState.knownEntities[finalQuest.giver] = newGiver;
                updatedEntities.push(finalQuest.giver);
            }

            // Add quest metadata for tracking
            finalQuest.generationMetadata.integrationTimestamp = Date.now();
            finalQuest.generationMetadata.integrationTurn = gameState.turnCount;

            return {
                success: true,
                quest: finalQuest,
                memories,
                updatedEntities
            };

        } catch (error) {
            return {
                success: false,
                quest,
                memories: [],
                updatedEntities: [],
                error: String(error)
            };
        }
    }

    /**
     * Filter quests based on integration criteria
     */
    private static filterQuestsForIntegration(
        validatedQuests: { quest: GeneratedQuest; validation: ValidationResult }[],
        gameState: SaveData,
        config: IntegrationConfig
    ): { quest: GeneratedQuest; validation: ValidationResult }[] {
        return validatedQuests.filter(({ quest, validation }) => {
            // Skip invalid quests in strict mode
            if (!validation.isValid && config.skipLowConfidenceQuests) {
                return false;
            }

            // Skip low confidence quests
            if (validation.confidence < config.minimumConfidence) {
                return false;
            }

            // Skip if quest type is not compatible with current game state
            if (!this.isQuestTypeCompatible(quest, gameState)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Check if quest is duplicate of existing quest
     */
    private static isDuplicateQuest(quest: GeneratedQuest, existingQuests: any[]): boolean {
        return existingQuests.some(existingQuest => {
            // Check title similarity
            if (this.calculateTextSimilarity(quest.title, existingQuest.title) > 0.8) {
                return true;
            }

            // Check if same quest giver with similar content
            if (quest.giver === existingQuest.giver) {
                const descSimilarity = this.calculateTextSimilarity(quest.description, existingQuest.description);
                if (descSimilarity > 0.6) {
                    return true;
                }
            }

            // Check objective similarity
            if (this.hasOverlappingObjectives(quest, existingQuest)) {
                return true;
            }

            return false;
        });
    }

    /**
     * Make quest title unique by appending suffixes
     */
    private static makeQuestTitleUnique(originalTitle: string, existingQuests: any[]): string {
        let uniqueTitle = originalTitle;
        let counter = 2;
        const maxAttempts = 10;

        // Check if the original title is already unique first
        const originalTitleExists = existingQuests.some(existingQuest => {
            return this.calculateTextSimilarity(originalTitle, existingQuest.title) > 0.8;
        });

        // If original title is unique, return it
        if (!originalTitleExists) {
            return originalTitle;
        }

        // Original title is duplicate, try to make it unique
        while (counter <= maxAttempts) {
            // Generate new title with Vietnamese suffix
            if (counter === 2) {
                uniqueTitle = `${originalTitle} (Phần ${counter})`;
            } else if (counter === 3) {
                uniqueTitle = `${originalTitle} (Tiếp theo)`;
            } else if (counter === 4) {
                uniqueTitle = `${originalTitle} (Nâng cao)`;
            } else {
                uniqueTitle = `${originalTitle} (${counter})`;
            }

            // Check if this new title is unique
            const newTitleExists = existingQuests.some(existingQuest => {
                return this.calculateTextSimilarity(uniqueTitle, existingQuest.title) > 0.8;
            });

            if (!newTitleExists) {
                break; // Title is unique
            }

            counter++;
        }

        // If we couldn't make it unique after max attempts, add timestamp
        if (counter > maxAttempts) {
            const timestamp = Date.now().toString().slice(-4);
            uniqueTitle = `${originalTitle} (${timestamp})`;
        }

        return uniqueTitle;
    }

    /**
     * Check if quest type is compatible with current game state
     */
    private static isQuestTypeCompatible(quest: GeneratedQuest, gameState: SaveData): boolean {
        const questType = quest.generationMetadata.questType;
        
        // Character arc quests need existing relationships
        if (questType === 'character_arc') {
            const hasRelationshipMemories = gameState.memories.some(m => m.category === 'relationship');
            if (!hasRelationshipMemories && gameState.party.length === 0) {
                return false;
            }
        }

        // Exploration quests need discovery memories or locations
        if (questType === 'exploration') {
            const hasDiscoveryMemories = gameState.memories.some(m => m.category === 'discovery');
            const hasLocations = gameState.locationDiscoveryOrder && gameState.locationDiscoveryOrder.length > 0;
            if (!hasDiscoveryMemories && !hasLocations) {
                return false;
            }
        }

        return true;
    }

    /**
     * Create memory for quest integration
     */
    private static createQuestIntegrationMemory(quest: GeneratedQuest, gameState: SaveData): Memory | null {
        const memoryText = `Nhận được quest mới: "${quest.title}". ${quest.description}`;
        
        // Check if a similar memory already exists to prevent duplicates
        const existingMemory = gameState.memories.find(m => {
            // Check for exact quest title match in memory text
            if (m.text.includes(`"${quest.title}"`)) {
                return true;
            }
            
            // Check for similar quest integration memory by content similarity
            if (m.source === 'auto_generated' && 
                m.tags?.includes('quest') && 
                m.tags?.includes('new_mission')) {
                const similarity = this.calculateTextSimilarity(m.text, memoryText);
                if (similarity > 0.8) {
                    return true;
                }
            }
            
            return false;
        });

        if (existingMemory) {
            console.log(`⚠️ Skipping duplicate quest memory for: "${quest.title}"`);
            return null; // Return null to indicate no new memory should be created
        }

        const memory: Memory = {
            text: memoryText,
            pinned: false,
            createdAt: gameState.turnCount,
            lastAccessed: gameState.turnCount,
            source: 'auto_generated',
            category: 'story',
            importance: this.calculateQuestMemoryImportance(quest),
            relatedEntities: this.extractQuestEntities(quest, gameState),
            tags: ['quest', 'new_mission', quest.generationMetadata.questType],
            emotionalWeight: quest.isMainQuest ? 5 : 2
        };

        // Enhance the memory with additional metadata
        const enhancedResult = MemoryEnhancer.enhanceMemory(memory, gameState);
        return enhancedResult.enhanced;
    }

    /**
     * Update entity relationships based on quest
     */
    private static updateEntityRelationships(quest: GeneratedQuest, gameState: SaveData): string[] {
        const updatedEntities: string[] = [];

        // Update quest giver relationship
        if (quest.giver && gameState.knownEntities[quest.giver]) {
            const giver = gameState.knownEntities[quest.giver];
            if (!giver.relationship) {
                giver.relationship = 'Quest Giver';
                updatedEntities.push(quest.giver);
            }
            giver.lastInteraction = gameState.turnCount;
        }

        // Update entities mentioned in quest
        const questEntities = this.extractQuestEntities(quest, gameState);
        questEntities.forEach(entityName => {
            const entity = gameState.knownEntities[entityName];
            if (entity) {
                entity.lastMentioned = gameState.turnCount;
                if (!updatedEntities.includes(entityName)) {
                    updatedEntities.push(entityName);
                }
            }
        });

        return updatedEntities;
    }

    /**
     * Create new quest giver entity if needed
     */
    private static createQuestGiverEntity(quest: GeneratedQuest, gameState: SaveData): Entity {
        return {
            name: quest.giver!,
            type: 'npc',
            description: `Người giao quest "${quest.title}". Một NPC quan trọng trong câu chuyện.`,
            relationship: 'Quest Giver',
            location: gameState.locationDiscoveryOrder?.[gameState.locationDiscoveryOrder.length - 1] || 'Unknown',
            lastInteraction: gameState.turnCount,
            personality: 'Helpful, knowledgeable'
        };
    }

    /**
     * Extract entities mentioned in quest
     */
    private static extractQuestEntities(quest: GeneratedQuest, gameState: SaveData): string[] {
        const entities = new Set<string>();

        // Add quest giver
        if (quest.giver) {
            entities.add(quest.giver);
        }

        // Add entities from source seeds
        quest.sourceSeeds.forEach(seed => {
            seed.involvedEntities.forEach(entity => entities.add(entity));
        });

        // Extract entities mentioned in text
        const questText = quest.title + ' ' + quest.description + ' ' + 
                         quest.objectives.map(o => o.description).join(' ');
        
        const knownEntityNames = Object.keys(gameState.knownEntities);
        knownEntityNames.forEach(entityName => {
            if (questText.includes(entityName)) {
                entities.add(entityName);
            }
        });

        return Array.from(entities);
    }

    /**
     * Calculate importance score for quest memory
     */
    private static calculateQuestMemoryImportance(quest: GeneratedQuest): number {
        let importance = 50; // Base importance

        // Main quest bonus
        if (quest.isMainQuest) {
            importance += 20;
        }

        // Difficulty bonus
        switch (quest.generationMetadata.difficulty) {
            case 'hard': importance += 15; break;
            case 'medium': importance += 10; break;
            case 'easy': importance += 5; break;
        }

        // Confidence bonus
        importance += quest.generationMetadata.confidence * 20;

        // Quest type bonus
        switch (quest.generationMetadata.questType) {
            case 'character_arc': importance += 10; break;
            case 'mystery': importance += 8; break;
            case 'consequence': importance += 6; break;
            case 'exploration': importance += 4; break;
        }

        return Math.min(100, Math.max(10, importance));
    }

    /**
     * Calculate text similarity between two strings
     */
    private static calculateTextSimilarity(text1: string, text2: string): number {
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * Check if quests have overlapping objectives
     */
    private static hasOverlappingObjectives(quest1: Quest, quest2: Quest): boolean {
        for (const obj1 of quest1.objectives) {
            for (const obj2 of quest2.objectives) {
                if (this.calculateTextSimilarity(obj1.description, obj2.description) > 0.7) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Manual quest integration for testing/admin purposes
     */
    public static forceIntegrateQuest(
        quest: GeneratedQuest,
        gameState: SaveData
    ): QuestIntegrationResult {
        console.log('🔧 Force integrating quest:', quest.title);

        try {
            // Create minimal integration
            const integrationMemory = this.createQuestIntegrationMemory(quest, gameState);
            const updatedEntities = this.updateEntityRelationships(quest, gameState);

            // Add quest to game state
            gameState.quests.push(quest);
            if (integrationMemory) {
                gameState.memories.push(integrationMemory);
            }

            const createdMemories = integrationMemory ? [integrationMemory] : [];
            
            return {
                success: true,
                integratedQuests: [quest],
                createdMemories,
                updatedEntities,
                integrationStats: {
                    questsAdded: 1,
                    memoriesCreated: createdMemories.length,
                    entitiesUpdated: updatedEntities.length,
                    duplicatesSkipped: 0
                },
                errors: [],
                warnings: integrationMemory ? 
                    ['Quest was force-integrated without validation'] :
                    ['Quest was force-integrated without validation', 'Duplicate memory skipped']
            };

        } catch (error) {
            return {
                success: false,
                integratedQuests: [],
                createdMemories: [],
                updatedEntities: [],
                integrationStats: {
                    questsAdded: 0,
                    memoriesCreated: 0,
                    entitiesUpdated: 0,
                    duplicatesSkipped: 0
                },
                errors: [`Force integration failed: ${error}`],
                warnings: []
            };
        }
    }

    /**
     * Get integration statistics for analysis
     */
    public static getIntegrationStats(gameState: SaveData): {
        totalQuests: number;
        activeQuests: number;
        completedQuests: number;
        generatedQuests: number;
        averageQuestAge: number;
        questsByType: { [type: string]: number };
    } {
        const allQuests = gameState.quests;
        const generatedQuests = allQuests.filter(q => 
            'generationMetadata' in q && (q as GeneratedQuest).generationMetadata
        ) as GeneratedQuest[];

        const questsByType: { [type: string]: number } = {};
        generatedQuests.forEach(quest => {
            const type = quest.generationMetadata.questType;
            questsByType[type] = (questsByType[type] || 0) + 1;
        });

        const totalAge = generatedQuests.reduce((sum, quest) => 
            sum + (gameState.turnCount - quest.generationMetadata.generatedAt), 0
        );
        const averageQuestAge = generatedQuests.length > 0 ? totalAge / generatedQuests.length : 0;

        return {
            totalQuests: allQuests.length,
            activeQuests: allQuests.filter(q => q.status === 'active').length,
            completedQuests: allQuests.filter(q => q.status === 'completed').length,
            generatedQuests: generatedQuests.length,
            averageQuestAge,
            questsByType
        };
    }
}
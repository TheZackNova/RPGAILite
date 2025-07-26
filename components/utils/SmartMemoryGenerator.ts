import type { Memory, SaveData, Entity, GameHistoryEntry } from '../types';
import { MemoryEnhancer } from './MemoryEnhancer';
import { ImportanceScorer } from './ImportanceScorer';

export interface MemoryGenerationResult {
    memories: Memory[];
    insights: string[];
    stats: {
        eventsAnalyzed: number;
        memoriesGenerated: number;
        highImportanceCount: number;
        categoriesCovered: string[];
    };
}

export interface MemoryGenerationConfig {
    enableEventMemories: boolean;
    enableRelationshipMemories: boolean;
    enableDiscoveryMemories: boolean;
    enableCombatMemories: boolean;
    enableAchievementMemories: boolean;
    minImportanceThreshold: number;
    maxMemoriesPerTurn: number;
    lookbackTurns: number;
}

export class SmartMemoryGenerator {
    private static readonly DEFAULT_CONFIG: MemoryGenerationConfig = {
        enableEventMemories: true,
        enableRelationshipMemories: true,
        enableDiscoveryMemories: true,
        enableCombatMemories: true,
        enableAchievementMemories: true,
        minImportanceThreshold: 40,
        maxMemoriesPerTurn: 3,
        lookbackTurns: 5
    };

    /**
     * Generate smart memories from recent game history
     */
    public static generateMemoriesFromHistory(
        gameState: SaveData,
        config: MemoryGenerationConfig = this.DEFAULT_CONFIG
    ): MemoryGenerationResult {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🧠 [${timestamp}] Smart Memory Generation Started:`, {
            turnNumber: gameState.turnCount,
            historyEntries: gameState.gameHistory.length,
            existingMemories: gameState.memories.length,
            config
        });

        const memories: Memory[] = [];
        const insights: string[] = [];
        const categoriesCovered = new Set<string>();

        // Analyze recent history entries
        const recentEntries = this.getRecentEntries(gameState.gameHistory, config.lookbackTurns);
        let eventsAnalyzed = 0;

        for (const entry of recentEntries) {
            if (entry.role === 'model' && memories.length < config.maxMemoriesPerTurn) {
                try {
                    const parsed = JSON.parse(entry.parts[0].text);
                    if (parsed.story) {
                        eventsAnalyzed++;
                        const newMemories = this.analyzeStoryForMemories(
                            parsed.story, 
                            gameState, 
                            config
                        );
                        
                        // Filter by importance threshold
                        const qualifiedMemories = newMemories.filter(mem => 
                            (mem.importance || 0) >= config.minImportanceThreshold
                        );
                        
                        memories.push(...qualifiedMemories);
                        qualifiedMemories.forEach(mem => {
                            if (mem.category) categoriesCovered.add(mem.category);
                        });
                    }
                } catch (e) {
                    // Skip invalid JSON entries
                }
            }
        }

        // Generate relationship memories
        if (config.enableRelationshipMemories) {
            const relationshipMemories = this.generateRelationshipMemories(gameState, config);
            memories.push(...relationshipMemories);
            relationshipMemories.forEach(mem => {
                if (mem.category) categoriesCovered.add(mem.category);
            });
        }

        // Generate achievement memories
        if (config.enableAchievementMemories) {
            const achievementMemories = this.generateAchievementMemories(gameState, config);
            memories.push(...achievementMemories);
            achievementMemories.forEach(mem => {
                if (mem.category) categoriesCovered.add(mem.category);
            });
        }

        // Sort by importance and limit total count
        const finalMemories = memories
            .sort((a, b) => (b.importance || 0) - (a.importance || 0))
            .slice(0, config.maxMemoriesPerTurn);

        const highImportanceCount = finalMemories.filter(mem => 
            (mem.importance || 0) >= 70
        ).length;

        // Generate insights
        if (finalMemories.length > 0) {
            insights.push(`Generated ${finalMemories.length} smart memories from recent events`);
            if (highImportanceCount > 0) {
                insights.push(`${highImportanceCount} high-importance memories created`);
            }
            if (categoriesCovered.size > 0) {
                insights.push(`Covered categories: ${Array.from(categoriesCovered).join(', ')}`);
            }
        }

        console.log(`✅ [${timestamp}] Smart Memory Generation Completed:`, {
            eventsAnalyzed,
            memoriesGenerated: finalMemories.length,
            highImportanceCount,
            categoriesCovered: Array.from(categoriesCovered)
        });

        return {
            memories: finalMemories,
            insights,
            stats: {
                eventsAnalyzed,
                memoriesGenerated: finalMemories.length,
                highImportanceCount,
                categoriesCovered: Array.from(categoriesCovered)
            }
        };
    }

    /**
     * Analyze story text for memory-worthy events
     */
    private static analyzeStoryForMemories(
        story: string,
        gameState: SaveData,
        config: MemoryGenerationConfig
    ): Memory[] {
        const memories: Memory[] = [];

        // Event patterns to detect significant happenings
        const eventPatterns = [
            // Discovery events
            {
                pattern: /(khám phá|tìm thấy|phát hiện) ([^.!?]+)/gi,
                category: 'discovery' as const,
                importance: 60,
                enabled: config.enableDiscoveryMemories
            },
            // Combat events
            {
                pattern: /(chiến đấu|tấn công|đánh bại|chiến thắng|thất bại) ([^.!?]+)/gi,
                category: 'combat' as const,
                importance: 65,
                enabled: config.enableCombatMemories
            },
            // Social interactions
            {
                pattern: /(gặp gỡ|nói chuyện|thuyết phục|giao dịch) ([^.!?]+)/gi,
                category: 'social' as const,
                importance: 55,
                enabled: config.enableRelationshipMemories
            },
            // Important acquisitions
            {
                pattern: /(nhận được|thu thập|học được) ([^.!?]+)/gi,
                category: 'general' as const,
                importance: 50,
                enabled: config.enableEventMemories
            },
            // Story milestones
            {
                pattern: /(hoàn thành|đạt được|thành công) ([^.!?]+)/gi,
                category: 'story' as const,
                importance: 70,
                enabled: config.enableAchievementMemories
            }
        ];

        for (const eventPattern of eventPatterns) {
            if (!eventPattern.enabled) continue;

            const matches = story.match(eventPattern.pattern);
            if (matches) {
                for (const match of matches) {
                    // Create memory for significant events
                    const memoryText = this.createMemoryFromEvent(match, story);
                    if (memoryText.length > 10 && memoryText.length < 300) {
                        const basicMemory: Memory = {
                            text: memoryText,
                            pinned: false,
                            source: 'auto_generated',
                            category: eventPattern.category,
                            createdAt: gameState.turnCount,
                            lastAccessed: gameState.turnCount,
                            importance: eventPattern.importance,
                            tags: this.extractTags(memoryText, gameState)
                        };

                        // Enhance the memory
                        const enhancementResult = MemoryEnhancer.enhanceMemory(basicMemory, gameState);
                        memories.push(enhancementResult.enhanced);
                    }
                }
            }
        }

        return memories;
    }

    /**
     * Generate memories from relationship changes
     */
    private static generateRelationshipMemories(
        gameState: SaveData,
        config: MemoryGenerationConfig
    ): Memory[] {
        const memories: Memory[] = [];

        // Check for recent relationship changes in party members
        gameState.party.forEach(member => {
            if (member.relationship && member.name) {
                const memoryText = `Mối quan hệ với ${member.name}: ${member.relationship}`;
                
                const relationshipMemory: Memory = {
                    text: memoryText,
                    pinned: false,
                    source: 'auto_generated',
                    category: 'relationship',
                    createdAt: gameState.turnCount,
                    lastAccessed: gameState.turnCount,
                    importance: 60,
                    relatedEntities: [member.name],
                    tags: ['relationship', 'party', member.name.toLowerCase()]
                };

                // Only add if we don't already have a similar memory
                const existingSimilar = gameState.memories.some(mem => 
                    mem.text.includes(member.name) && 
                    mem.text.includes('quan hệ') &&
                    mem.text.includes(member.relationship || '')
                );

                if (!existingSimilar) {
                    const enhancementResult = MemoryEnhancer.enhanceMemory(relationshipMemory, gameState);
                    memories.push(enhancementResult.enhanced);
                }
            }
        });

        return memories;
    }

    /**
     * Generate memories from achievements and milestones
     */
    private static generateAchievementMemories(
        gameState: SaveData,
        config: MemoryGenerationConfig
    ): Memory[] {
        const memories: Memory[] = [];

        // Check for quest completions
        const completedQuests = gameState.quests.filter(q => q.status === 'completed');
        
        completedQuests.forEach(quest => {
            const memoryText = `Hoàn thành nhiệm vụ: ${quest.title}`;
            
            // Check if we already have a memory for this quest completion
            const existingQuestMemory = gameState.memories.some(mem => 
                mem.text.includes(quest.title) && mem.text.includes('hoàn thành')
            );

            if (!existingQuestMemory) {
                const achievementMemory: Memory = {
                    text: memoryText,
                    pinned: false,
                    source: 'auto_generated',
                    category: 'story',
                    createdAt: gameState.turnCount,
                    lastAccessed: gameState.turnCount,
                    importance: quest.isMainQuest ? 80 : 60,
                    relatedEntities: quest.giver ? [quest.giver] : [],
                    tags: ['achievement', 'quest', quest.isMainQuest ? 'main_quest' : 'side_quest']
                };

                const enhancementResult = MemoryEnhancer.enhanceMemory(achievementMemory, gameState);
                memories.push(enhancementResult.enhanced);
            }
        });

        // Check for significant entity discoveries
        const recentEntities = Object.values(gameState.knownEntities)
            .filter(entity => 
                entity.type === 'location' && 
                // Assume recent if no creation date or within recent turns
                (!entity.discoveredAt || gameState.turnCount - entity.discoveredAt <= config.lookbackTurns)
            );

        recentEntities.forEach(entity => {
            if (entity.name && entity.description) {
                const memoryText = `Khám phá ${entity.type === 'location' ? 'địa điểm' : 'thực thể'} mới: ${entity.name}`;
                
                const discoveryMemory: Memory = {
                    text: memoryText,
                    pinned: false,
                    source: 'auto_generated',
                    category: 'discovery',
                    createdAt: gameState.turnCount,
                    lastAccessed: gameState.turnCount,
                    importance: 55,
                    relatedEntities: [entity.name],
                    tags: ['discovery', entity.type, entity.name.toLowerCase()]
                };

                const enhancementResult = MemoryEnhancer.enhanceMemory(discoveryMemory, gameState);
                memories.push(enhancementResult.enhanced);
            }
        });

        return memories;
    }

    /**
     * Get recent history entries for analysis
     */
    private static getRecentEntries(
        gameHistory: GameHistoryEntry[],
        lookbackTurns: number
    ): GameHistoryEntry[] {
        // Get the last N turns worth of entries (each turn has user + model entries)
        const recentEntryCount = Math.min(lookbackTurns * 2, gameHistory.length);
        return gameHistory.slice(-recentEntryCount);
    }

    /**
     * Create a concise memory text from an event match
     */
    private static createMemoryFromEvent(eventMatch: string, fullStory: string): string {
        // Clean up the event match to create a proper memory
        const cleanEvent = eventMatch.trim();
        
        // Try to extract a meaningful sentence containing the event
        const sentences = fullStory.split(/[.!?]+/);
        const containingSentence = sentences.find(sentence => 
            sentence.toLowerCase().includes(cleanEvent.toLowerCase())
        );

        if (containingSentence && containingSentence.length < 200) {
            return containingSentence.trim();
        }

        // Fallback to the event match itself
        return cleanEvent;
    }

    /**
     * Extract relevant tags from memory text
     */
    private static extractTags(text: string, gameState: SaveData): string[] {
        const tags: string[] = [];
        const lowerText = text.toLowerCase();

        // Add entity-based tags
        Object.values(gameState.knownEntities).forEach(entity => {
            if (entity.name && lowerText.includes(entity.name.toLowerCase())) {
                tags.push(entity.name.toLowerCase());
                tags.push(entity.type);
            }
        });

        // Add contextual tags
        const contextTags = [
            { keywords: ['chiến đấu', 'tấn công', 'đánh'], tag: 'combat' },
            { keywords: ['khám phá', 'tìm thấy', 'phát hiện'], tag: 'exploration' },
            { keywords: ['học', 'kỹ năng', 'phép thuật'], tag: 'learning' },
            { keywords: ['giao dịch', 'mua', 'bán'], tag: 'commerce' },
            { keywords: ['nói chuyện', 'thuyết phục'], tag: 'dialogue' }
        ];

        contextTags.forEach(({ keywords, tag }) => {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                tags.push(tag);
            }
        });

        return [...new Set(tags)]; // Remove duplicates
    }

    /**
     * Get smart memory generation statistics
     */
    public static getGenerationStats(memories: Memory[]): {
        totalGenerated: number;
        byCategory: { [category: string]: number };
        byImportance: { high: number; medium: number; low: number };
        averageImportance: number;
    } {
        const byCategory: { [category: string]: number } = {};
        let totalImportance = 0;
        let high = 0, medium = 0, low = 0;

        memories.forEach(memory => {
            if (memory.category) {
                byCategory[memory.category] = (byCategory[memory.category] || 0) + 1;
            }
            
            const importance = memory.importance || 0;
            totalImportance += importance;
            
            if (importance >= 70) high++;
            else if (importance >= 40) medium++;
            else low++;
        });

        return {
            totalGenerated: memories.length,
            byCategory,
            byImportance: { high, medium, low },
            averageImportance: memories.length > 0 ? totalImportance / memories.length : 0
        };
    }
}
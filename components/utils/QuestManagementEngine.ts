import type { SaveData } from '../types';
import { QuestAnalyzer, type QuestOpportunity } from './QuestAnalyzer';
import { QuestGenerator, type QuestGenerationResult } from './QuestGenerator';
import { QuestValidator, type ValidationConfig } from './QuestValidator';
import { QuestIntegrator, type IntegrationConfig } from './QuestIntegrator';

export interface QuestGenerationConfig {
    maxQuestsPerGeneration: number;
    enableAnalysis: boolean;
    enableGeneration: boolean;
    enableValidation: boolean;
    enableIntegration: boolean;
    validationConfig: ValidationConfig;
    integrationConfig: IntegrationConfig;
    autoGenerationTriggers: {
        memoryThreshold: number;      // Generate quests when memories reach this count
        turnInterval: number;         // Generate quests every N turns
        completedQuestTrigger: boolean; // Generate new quests when quests are completed
    };
}

export interface QuestManagementResult {
    success: boolean;
    stage: 'analysis' | 'generation' | 'validation' | 'integration' | 'complete';
    analysis?: QuestOpportunity;
    generation?: QuestGenerationResult;
    validation?: Array<{ quest: any; validation: any }>;
    integration?: any;
    stats: {
        totalProcessingTime: number;
        questsAnalyzed: number;
        questsGenerated: number;
        questsValidated: number;
        questsIntegrated: number;
    };
    errors: string[];
    warnings: string[];
}

export class QuestManagementEngine {
    
    private static readonly DEFAULT_CONFIG: QuestGenerationConfig = {
        maxQuestsPerGeneration: 3,
        enableAnalysis: true,
        enableGeneration: true,
        enableValidation: true,
        enableIntegration: true,
        validationConfig: {
            strictMode: false,
            checkWorldConsistency: true,
            checkEntityReferences: true,
            checkDifficultyBalance: true,
            checkLanguageQuality: true,
            autoFix: true
        },
        integrationConfig: {
            maxSimultaneousQuests: 3,
            createIntegrationMemories: true,
            updateEntityRelationships: true,
            checkForDuplicates: true,
            skipLowConfidenceQuests: false,
            minimumConfidence: 0.3
        },
        autoGenerationTriggers: {
            memoryThreshold: 15,
            turnInterval: 25,
            completedQuestTrigger: true
        }
    };

    /**
     * Full quest generation pipeline from analysis to integration
     */
    public static async generateQuestsFromMemories(
        gameState: SaveData,
        ai: any,
        selectedModel: string = "gemini-2.5-flash-lite",
        config: QuestGenerationConfig = this.DEFAULT_CONFIG
    ): Promise<QuestManagementResult> {
        const startTime = performance.now();
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`🎯 [${timestamp}] Quest Management Engine Started:`, {
            turnNumber: gameState.turnCount,
            memories: gameState.memories.length,
            activeQuests: gameState.quests.filter(q => q.status === 'active').length,
            enabledStages: {
                analysis: config.enableAnalysis,
                generation: config.enableGeneration,
                validation: config.enableValidation,
                integration: config.enableIntegration
            }
        });

        const result: QuestManagementResult = {
            success: false,
            stage: 'analysis',
            stats: {
                totalProcessingTime: 0,
                questsAnalyzed: 0,
                questsGenerated: 0,
                questsValidated: 0,
                questsIntegrated: 0
            },
            errors: [],
            warnings: []
        };

        try {
            // Stage 1: Analysis
            if (config.enableAnalysis) {
                console.log(`📊 [${timestamp}] Stage 1: Quest Analysis`);
                result.analysis = QuestAnalyzer.analyzeQuestOpportunities(gameState);
                result.stats.questsAnalyzed = result.analysis.seeds.length;
                
                if (result.analysis.seeds.length === 0) {
                    result.warnings.push('Không tìm thấy cơ hội quest nào từ memories hiện tại');
                    result.success = true; // Not an error, just no opportunities
                    result.stage = 'complete';
                    result.stats.totalProcessingTime = performance.now() - startTime;
                    return result;
                }
            } else {
                result.warnings.push('Quest analysis bị vô hiệu hóa');
                result.stage = 'complete';
                result.stats.totalProcessingTime = performance.now() - startTime;
                return result;
            }

            // Stage 2: Generation
            if (config.enableGeneration && ai) {
                console.log(`🎨 [${timestamp}] Stage 2: Quest Generation`);
                result.stage = 'generation';
                
                const topSeeds = result.analysis!.seeds.slice(0, config.maxQuestsPerGeneration);
                result.generation = await QuestGenerator.generateQuestsFromSeeds(
                    topSeeds,
                    gameState,
                    ai,
                    selectedModel,
                    config.maxQuestsPerGeneration
                );
                
                result.stats.questsGenerated = result.generation.quests.length;
                
                if (result.generation.quests.length === 0) {
                    result.errors.push('Không thể tạo quest nào từ các cơ hội đã phân tích');
                    result.stats.totalProcessingTime = performance.now() - startTime;
                    return result;
                }
                
                result.errors.push(...result.generation.errors);
            } else {
                if (!ai) {
                    result.errors.push('AI instance không khả dụng cho quest generation');
                } else {
                    result.warnings.push('Quest generation bị vô hiệu hóa');
                }
                result.stage = 'complete';
                result.stats.totalProcessingTime = performance.now() - startTime;
                return result;
            }

            // Stage 3: Validation
            if (config.enableValidation) {
                console.log(`✅ [${timestamp}] Stage 3: Quest Validation`);
                result.stage = 'validation';
                
                result.validation = [];
                for (const quest of result.generation!.quests) {
                    const validation = QuestValidator.validateQuest(quest, gameState, config.validationConfig);
                    result.validation.push({ quest, validation });
                }
                
                result.stats.questsValidated = result.validation.length;
                
                const validQuests = result.validation.filter(({ validation }) => validation.isValid);
                if (validQuests.length === 0) {
                    result.warnings.push('Không có quest nào vượt qua validation');
                }
            } else {
                result.warnings.push('Quest validation bị vô hiệu hóa');
                // Create minimal validation results for integration
                result.validation = result.generation!.quests.map(quest => ({
                    quest,
                    validation: {
                        isValid: true,
                        confidence: quest.generationMetadata.confidence,
                        issues: [],
                        recommendations: []
                    }
                }));
            }

            // Stage 4: Integration
            if (config.enableIntegration) {
                console.log(`🔗 [${timestamp}] Stage 4: Quest Integration`);
                result.stage = 'integration';
                
                result.integration = QuestIntegrator.integrateQuests(
                    result.validation!,
                    gameState,
                    config.integrationConfig
                );
                
                result.stats.questsIntegrated = result.integration.integrationStats.questsAdded;
                
                result.errors.push(...result.integration.errors);
                result.warnings.push(...result.integration.warnings);
                
                if (result.integration.success) {
                    result.success = true;
                }
            } else {
                result.warnings.push('Quest integration bị vô hiệu hóa');
            }

            result.stage = 'complete';
            result.success = result.stats.questsIntegrated > 0 || result.warnings.length > 0;

        } catch (error) {
            result.errors.push(`Quest Management Engine error: ${error}`);
            console.error('Quest Management Engine error:', error);
        }

        result.stats.totalProcessingTime = performance.now() - startTime;
        
        console.log(`🏁 [${timestamp}] Quest Management Engine Complete:`, {
            success: result.success,
            stage: result.stage,
            stats: result.stats,
            errorsCount: result.errors.length,
            warningsCount: result.warnings.length
        });

        return result;
    }

    /**
     * Check if auto-generation should be triggered
     */
    public static shouldTriggerAutoGeneration(gameState: SaveData, config: QuestGenerationConfig): {
        shouldTrigger: boolean;
        reasons: string[];
    } {
        const reasons: string[] = [];
        let shouldTrigger = false;

        // Check memory threshold
        if (gameState.memories.length >= config.autoGenerationTriggers.memoryThreshold) {
            const lastGenerationTurn = this.getLastQuestGenerationTurn(gameState);
            const memoryGrowth = gameState.memories.filter(m => 
                (m.createdAt || 0) > lastGenerationTurn
            ).length;
            
            if (memoryGrowth >= config.autoGenerationTriggers.memoryThreshold / 2) {
                shouldTrigger = true;
                reasons.push(`${memoryGrowth} memories mới được tạo kể từ lần generation cuối`);
            }
        }

        // Check turn interval
        const lastGenerationTurn = this.getLastQuestGenerationTurn(gameState);
        const turnsSinceLastGeneration = gameState.turnCount - lastGenerationTurn;
        if (turnsSinceLastGeneration >= config.autoGenerationTriggers.turnInterval) {
            shouldTrigger = true;
            reasons.push(`${turnsSinceLastGeneration} turns kể từ lần generation cuối`);
        }

        // Check completed quest trigger
        if (config.autoGenerationTriggers.completedQuestTrigger) {
            const recentlyCompletedQuests = gameState.quests.filter(q => 
                q.status === 'completed' && 
                this.isQuestCompletedRecently(q, gameState, 5) // Within last 5 turns
            );
            
            if (recentlyCompletedQuests.length > 0) {
                shouldTrigger = true;
                reasons.push(`${recentlyCompletedQuests.length} quest được hoàn thành gần đây`);
            }
        }

        // Don't trigger if too many active quests
        const activeQuests = gameState.quests.filter(q => q.status === 'active').length;
        if (activeQuests >= config.integrationConfig.maxSimultaneousQuests) {
            shouldTrigger = false;
            reasons.push(`Đã có ${activeQuests} quest active, đạt giới hạn`);
        }

        return { shouldTrigger, reasons };
    }

    /**
     * Quick quest generation for testing purposes
     */
    public static async generateQuickQuest(
        gameState: SaveData,
        ai: any,
        selectedModel: string = "gemini-2.0-flash-exp",
        questType?: 'consequence' | 'mystery' | 'exploration' | 'character_arc'
    ): Promise<QuestManagementResult> {
        const quickConfig: QuestGenerationConfig = {
            ...this.DEFAULT_CONFIG,
            maxQuestsPerGeneration: 1,
            integrationConfig: {
                ...this.DEFAULT_CONFIG.integrationConfig,
                skipLowConfidenceQuests: false,
                minimumConfidence: 0.3
            },
            validationConfig: {
                ...this.DEFAULT_CONFIG.validationConfig,
                strictMode: false,
                autoFix: true
            }
        };

        return this.generateQuestsFromMemories(gameState, ai, selectedModel, quickConfig);
    }

    /**
     * Get quest generation statistics
     */
    public static getQuestGenerationStats(gameState: SaveData): {
        totalGeneratedQuests: number;
        generationHistory: Array<{
            turn: number;
            questsGenerated: number;
            questType: string;
            success: boolean;
        }>;
        averageGenerationInterval: number;
        questTypeDistribution: { [type: string]: number };
        successRate: number;
    } {
        const generatedQuests = gameState.quests.filter(q => 
            'generationMetadata' in q
        ) as any[];

        const generationHistory = generatedQuests.map(quest => ({
            turn: quest.generationMetadata.generatedAt,
            questsGenerated: 1,
            questType: quest.generationMetadata.questType,
            success: true
        }));

        const questTypeDistribution: { [type: string]: number } = {};
        generatedQuests.forEach(quest => {
            const type = quest.generationMetadata.questType;
            questTypeDistribution[type] = (questTypeDistribution[type] || 0) + 1;
        });

        let averageGenerationInterval = 0;
        if (generationHistory.length > 1) {
            const intervals = [];
            for (let i = 1; i < generationHistory.length; i++) {
                intervals.push(generationHistory[i].turn - generationHistory[i-1].turn);
            }
            averageGenerationInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
        }

        return {
            totalGeneratedQuests: generatedQuests.length,
            generationHistory,
            averageGenerationInterval,
            questTypeDistribution,
            successRate: generatedQuests.length > 0 ? 1.0 : 0.0 // Simplified for now
        };
    }

    // Helper Methods

    private static getLastQuestGenerationTurn(gameState: SaveData): number {
        const generatedQuests = gameState.quests.filter(q => 
            'generationMetadata' in q
        ) as any[];

        if (generatedQuests.length === 0) return 0;

        return Math.max(...generatedQuests.map(q => q.generationMetadata.generatedAt || 0));
    }

    private static isQuestCompletedRecently(quest: any, gameState: SaveData, turnWindow: number): boolean {
        // This would need quest completion tracking - simplified for now
        return quest.status === 'completed';
    }

    /**
     * Analyze quest opportunities without generating
     */
    public static analyzeQuestOpportunities(gameState: SaveData): QuestOpportunity {
        return QuestAnalyzer.analyzeQuestOpportunities(gameState);
    }

    /**
     * Force generate quest from specific memory pattern
     */
    public static async forceGenerateFromPattern(
        gameState: SaveData,
        ai: any,
        selectedModel: string = "gemini-2.5-flash-lite",
        pattern: 'combat' | 'discovery' | 'relationship' | 'mystery'
    ): Promise<QuestManagementResult> {
        // Filter memories by pattern
        const relevantMemories = gameState.memories.filter(m => {
            switch (pattern) {
                case 'combat':
                    return m.category === 'combat' || m.text.toLowerCase().includes('chiến đấu');
                case 'discovery':
                    return m.category === 'discovery' || m.text.toLowerCase().includes('khám phá');
                case 'relationship':
                    return m.category === 'relationship' || m.text.toLowerCase().includes('quan hệ');
                case 'mystery':
                    return m.text.toLowerCase().includes('bí ẩn') || m.text.toLowerCase().includes('bí mật');
                default:
                    return true;
            }
        });

        if (relevantMemories.length === 0) {
            return {
                success: false,
                stage: 'analysis',
                stats: {
                    totalProcessingTime: 0,
                    questsAnalyzed: 0,
                    questsGenerated: 0,
                    questsValidated: 0,
                    questsIntegrated: 0
                },
                errors: [`Không tìm thấy memories phù hợp với pattern "${pattern}"`],
                warnings: []
            };
        }

        // Create temporary game state with filtered memories
        const filteredGameState = {
            ...gameState,
            memories: relevantMemories.slice(-5) // Use most recent 5 memories
        };

        return this.generateQuestsFromMemories(filteredGameState, ai, selectedModel);
    }
}
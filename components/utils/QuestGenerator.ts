import type { Quest, QuestObjective, SaveData, Entity, Memory } from '../types';
import type { QuestSeed } from './QuestAnalyzer';

export interface GeneratedQuest extends Quest {
    sourceSeeds: QuestSeed[];
    generationMetadata: {
        aiPromptUsed: string;
        generatedAt: number;
        difficulty: string;
        questType: string;
        confidence: number;
        modelUsed?: string;
        integrationTimestamp?: number;
        integrationTurn?: number;
        uniqueId?: string;
    };
}

export interface QuestGenerationResult {
    quests: GeneratedQuest[];
    stats: {
        seedsProcessed: number;
        questsGenerated: number;
        highConfidenceQuests: number;
        averageConfidence: number;
    };
    errors: string[];
}

export class QuestGenerator {
    
    // Static counter to ensure unique IDs even if generated at same timestamp
    private static uniqueCounter = 0;
    
    /**
     * Generate quests from analyzed quest seeds using AI
     */
    public static async generateQuestsFromSeeds(
        seeds: QuestSeed[],
        gameState: SaveData,
        ai: any, // GoogleGenAI instance
        selectedModel: string = "gemini-2.5-flash-lite",
        maxQuests: number = 3
    ): Promise<QuestGenerationResult> {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🎯 [${timestamp}] Quest Generation Started:`, {
            seedsToProcess: seeds.length,
            maxQuests,
            turnNumber: gameState.turnCount
        });

        const quests: GeneratedQuest[] = [];
        const errors: string[] = [];
        
        // Sort seeds by relevance and priority
        const sortedSeeds = seeds
            .sort((a, b) => {
                if (a.priority !== b.priority) {
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
                return b.relevanceScore - a.relevanceScore;
            })
            .slice(0, maxQuests);

        // Generate quests from top seeds
        for (const seed of sortedSeeds) {
            try {
                const generatedQuest = await this.generateQuestFromSeed(seed, gameState, ai, selectedModel);
                if (generatedQuest) {
                    quests.push(generatedQuest);
                }
            } catch (error) {
                console.error(`Failed to generate quest from seed ${seed.id}:`, error);
                errors.push(`Quest generation failed for ${seed.type} quest: ${error}`);
            }
        }

        const stats = {
            seedsProcessed: sortedSeeds.length,
            questsGenerated: quests.length,
            highConfidenceQuests: quests.filter(q => q.generationMetadata.confidence >= 0.8).length,
            averageConfidence: quests.length > 0 ? 
                quests.reduce((sum, q) => sum + q.generationMetadata.confidence, 0) / quests.length : 0
        };

        console.log(`✅ [${timestamp}] Quest Generation Complete:`, stats);

        return {
            quests,
            stats,
            errors
        };
    }

    /**
     * Generate a single quest from a quest seed using AI
     */
    private static async generateQuestFromSeed(
        seed: QuestSeed,
        gameState: SaveData,
        ai: any,
        selectedModel: string
    ): Promise<GeneratedQuest | null> {
        const prompt = this.buildQuestGenerationPrompt(seed, gameState);
        
        // Try multiple models if the selected one fails
        const modelsToTry = [
            selectedModel,
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash",
            "gemini-1.5-pro"
        ];
        
        // Remove duplicates and ensure selected model is first
        const uniqueModels = [selectedModel, ...modelsToTry.filter(m => m !== selectedModel)];
        
        for (let i = 0; i < uniqueModels.length; i++) {
            const currentModel = uniqueModels[i];
            
            try {
                console.log(`🎯 Quest Generation Attempt ${i + 1}/${uniqueModels.length} with model: ${currentModel}`);
                console.log('🎯 Quest Generation Prompt:', prompt.substring(0, 200) + '...');
                
                const response = await ai.models.generateContent({
                    model: currentModel,
                    contents: prompt
                });
                
                const responseText = response.text?.trim() || '';
                console.log('🎯 Quest Generation Raw Response:', responseText.length > 0 ? responseText.substring(0, 100) + '...' : '[EMPTY RESPONSE]');
                
                if (!responseText) {
                    console.warn(`Empty response from ${currentModel}, trying next model...`);
                    continue;
                }
                
                let questData = this.parseQuestResponse(responseText);
                
                if (!questData) {
                    console.warn(`Parsing failed for ${currentModel}, trying next model...`);
                    continue;
                }
                
                // Generate unique ID for quest with counter to prevent collisions
                this.uniqueCounter++;
                const timestamp = Date.now();
                const randomPart = Math.random().toString(36).substr(2, 9);
                const seedId = seed.id.replace(/[^a-zA-Z0-9]/g, ''); // Clean seed ID
                const uniqueId = `quest_${gameState.turnCount}_${timestamp}_${this.uniqueCounter}_${seedId}_${randomPart}`;
                
                // Success! Create the quest
                const generatedQuest: GeneratedQuest = {
                    title: questData.title,
                    description: questData.description,
                    objectives: questData.objectives,
                    giver: questData.giver,
                    reward: questData.reward,
                    isMainQuest: this.determineQuestImportance(seed),
                    status: 'active',
                    sourceSeeds: [seed],
                    generationMetadata: {
                        aiPromptUsed: prompt,
                        generatedAt: gameState.turnCount,
                        difficulty: seed.suggestedDifficulty,
                        questType: seed.type,
                        confidence: this.calculateGenerationConfidence(questData, seed),
                        modelUsed: currentModel,
                        uniqueId: uniqueId
                    }
                };

                console.log(`✅ Quest generated successfully with model: ${currentModel}`);
                return generatedQuest;
                
            } catch (error) {
                console.warn(`Error with model ${currentModel}:`, error);
                if (i === uniqueModels.length - 1) {
                    // Last model failed, use fallback
                    console.warn('All AI models failed, using fallback quest template');
                    return this.generateFallbackQuest(seed, gameState);
                }
                // Try next model
                continue;
            }
        }
        
        // If we somehow get here, use fallback
        console.warn('Unexpected fallthrough, using fallback quest template');
        return this.generateFallbackQuest(seed, gameState);
    }

    /**
     * Build AI prompt for quest generation
     */
    private static buildQuestGenerationPrompt(seed: QuestSeed, gameState: SaveData): string {
        const worldContext = this.buildWorldContext(gameState);
        const memoryContext = this.buildMemoryContext(seed.triggerMemories);
        const entityContext = this.buildEntityContext(seed.involvedEntities, gameState);
        
        let prompt = `Bạn là một Game Master chuyên nghiệp cho game RPG tiếng Việt. Hãy tạo một quest ${this.getQuestTypeInVietnamese(seed.type)} dựa trên thông tin sau:

=== BỐI CẢNH THỾ GIỚI ===
${worldContext}

=== KÝ ỨC LIÊN QUAN ===
${memoryContext}

=== NHÂN VẬT LIÊN QUAN ===
${entityContext}

=== YÊU CẦU QUEST ===
- Loại quest: ${this.getQuestTypeInVietnamese(seed.type)}
- Độ khó: ${this.getDifficultyInVietnamese(seed.suggestedDifficulty)}
- Ý tưởng gợi ý: ${seed.questHooks.join(', ')}
- Phần thưởng gợi ý: ${seed.expectedRewards.join(', ')}

=== HƯỚNG DẪN TẠO QUEST ===
1. Tạo tiêu đề quest hấp dẫn và phù hợp với bối cảnh
2. Viết mô tả quest chi tiết, kể câu chuyện và động lực
3. Tạo 2-4 objective cụ thể, có thể hoàn thành
4. Chọn quest giver phù hợp từ nhân vật đã biết hoặc tạo mới
5. Đề xuất phần thưởng hợp lý với độ khó và bối cảnh

=== YÊU CẦU ĐỊNH DẠNG ===
Trả về JSON với format sau:
{
  "title": "Tên quest",
  "description": "Mô tả chi tiết quest, bao gồm bối cảnh và động lực",
  "objectives": [
    {"description": "Mục tiêu 1", "completed": false},
    {"description": "Mục tiêu 2", "completed": false}
  ],
  "giver": "Tên người giao quest",
  "reward": "Mô tả phần thưởng"
}

Hãy đảm bảo quest phù hợp với bối cảnh, có tính logic và thú vị để chơi.`;

        return prompt;
    }

    /**
     * Build world context from game state
     */
    private static buildWorldContext(gameState: SaveData): string {
        const context: string[] = [];
        
        // World basic info
        context.push(`Thế giới: ${gameState.worldData.storyName}`);
        context.push(`Thể loại: ${gameState.worldData.genre}`);
        context.push(`Mô tả: ${gameState.worldData.worldDetail}`);
        
        // Time context
        const time = gameState.gameTime;
        context.push(`Thời gian hiện tại: Ngày ${time.day}, tháng ${time.month}, năm ${time.year}, giờ ${time.hour}`);
        
        // Character context
        const pc = Object.values(gameState.knownEntities).find(e => e.type === 'pc');
        if (pc) {
            context.push(`Nhân vật chính: ${pc.name} - ${pc.description}`);
        }
        
        // Party context
        if (gameState.party.length > 0) {
            const partyNames = gameState.party.map(p => p.name).join(', ');
            context.push(`Đồng đội: ${partyNames}`);
        }
        
        // Recent locations
        if (gameState.locationDiscoveryOrder && gameState.locationDiscoveryOrder.length > 0) {
            const recentLocation = gameState.locationDiscoveryOrder[gameState.locationDiscoveryOrder.length - 1];
            context.push(`Vị trí hiện tại: ${recentLocation}`);
        }

        return context.join('\n');
    }

    /**
     * Build memory context from trigger memories
     */
    private static buildMemoryContext(memories: Memory[]): string {
        if (memories.length === 0) return "Không có ký ức liên quan cụ thể.";
        
        return memories.map((memory, index) => 
            `${index + 1}. [${memory.category?.toUpperCase() || 'GENERAL'}] ${memory.text}`
        ).join('\n');
    }

    /**
     * Build entity context from involved entities
     */
    private static buildEntityContext(entityNames: string[], gameState: SaveData): string {
        if (entityNames.length === 0) return "Không có nhân vật cụ thể liên quan.";
        
        const entityDescriptions: string[] = [];
        
        entityNames.forEach(name => {
            const entity = gameState.knownEntities[name];
            if (entity) {
                let description = `- ${entity.name} (${entity.type}): ${entity.description}`;
                if (entity.location) description += ` [Ở ${entity.location}]`;
                if (entity.relationship) description += ` [Quan hệ: ${entity.relationship}]`;
                entityDescriptions.push(description);
            }
        });

        return entityDescriptions.length > 0 ? 
            entityDescriptions.join('\n') : 
            "Các nhân vật: " + entityNames.join(', ');
    }

    /**
     * Parse AI response into quest data
     */
    private static parseQuestResponse(responseText: string): any {
        try {
            console.log('🔍 Parsing quest response, length:', responseText.length);
            
            if (!responseText || responseText.length === 0) {
                throw new Error("Empty response text");
            }
            
            // Clean the response text
            let cleanText = responseText.trim();
            
            // Remove markdown code blocks if present
            if (cleanText.startsWith('```json')) {
                const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanText = jsonMatch[1].trim();
                }
            } else if (cleanText.startsWith('```')) {
                const jsonMatch = cleanText.match(/```\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanText = jsonMatch[1].trim();
                }
            }
            
            // Try to find JSON object if response has extra text
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            }
            
            console.log('🔍 Cleaned text for parsing:', cleanText.substring(0, 200) + '...');
            
            if (!cleanText || cleanText.length === 0) {
                throw new Error("No valid JSON content found");
            }
            
            const questData = JSON.parse(cleanText);
            console.log('🔍 Parsed quest data:', questData);
            
            // Validate required fields
            if (!questData.title || !questData.description || !questData.objectives) {
                throw new Error(`Missing required quest fields. Has: title=${!!questData.title}, description=${!!questData.description}, objectives=${!!questData.objectives}`);
            }
            
            // Ensure objectives is an array
            if (!Array.isArray(questData.objectives)) {
                // Try to fix if it's a string
                if (typeof questData.objectives === 'string') {
                    questData.objectives = [{ description: questData.objectives, completed: false }];
                } else {
                    throw new Error("Objectives must be an array");
                }
            }
            
            // Validate and fix objective format
            questData.objectives = questData.objectives.map((obj: any, index: number) => {
                if (typeof obj === 'string') {
                    return { description: obj, completed: false };
                }
                if (!obj.description) {
                    throw new Error(`Objective at index ${index} missing description`);
                }
                if (typeof obj.completed !== 'boolean') {
                    obj.completed = false;
                }
                return obj;
            });
            
            // Ensure all required fields exist with defaults
            return {
                title: questData.title,
                description: questData.description,
                objectives: questData.objectives,
                giver: questData.giver || 'Người Lạ',
                reward: questData.reward || 'Kinh nghiệm và phần thưởng'
            };
            
        } catch (error) {
            console.error('Failed to parse quest response:', error, 'Raw response:', responseText);
            return null;
        }
    }

    /**
     * Calculate confidence score for generated quest
     */
    private static calculateGenerationConfidence(questData: any, seed: QuestSeed): number {
        let confidence = 0.5; // Base confidence
        
        // Title quality
        if (questData.title && questData.title.length >= 10 && questData.title.length <= 50) {
            confidence += 0.1;
        }
        
        // Description quality
        if (questData.description && questData.description.length >= 50) {
            confidence += 0.2;
        }
        
        // Objectives quality
        if (questData.objectives && questData.objectives.length >= 2 && questData.objectives.length <= 5) {
            confidence += 0.1;
            
            // Check if objectives are specific
            const hasSpecificObjectives = questData.objectives.some((obj: any) => 
                obj.description && obj.description.length >= 20
            );
            if (hasSpecificObjectives) confidence += 0.1;
        }
        
        // Quest giver present
        if (questData.giver && questData.giver.trim().length > 0) {
            confidence += 0.05;
        }
        
        // Reward quality
        if (questData.reward && questData.reward.length >= 10) {
            confidence += 0.05;
        }
        
        return Math.min(1.0, confidence);
    }

    /**
     * Determine if quest should be main quest based on seed
     */
    private static determineQuestImportance(seed: QuestSeed): boolean {
        return seed.priority === 'high' && 
               seed.relevanceScore >= 70 && 
               (seed.type === 'character_arc' || seed.involvedEntities.length >= 3);
    }

    /**
     * Helper method to get quest type in Vietnamese
     */
    private static getQuestTypeInVietnamese(type: string): string {
        const typeMap: { [key: string]: string } = {
            'consequence': 'hậu quả từ hành động',
            'mystery': 'bí ẩn cần giải mã',
            'exploration': 'khám phá và tìm kiếm',
            'character_arc': 'phát triển nhân vật'
        };
        return typeMap[type] || type;
    }

    /**
     * Helper method to get difficulty in Vietnamese
     */
    private static getDifficultyInVietnamese(difficulty: string): string {
        const difficultyMap: { [key: string]: string } = {
            'easy': 'dễ',
            'medium': 'trung bình',
            'hard': 'khó'
        };
        return difficultyMap[difficulty] || difficulty;
    }

    /**
     * Generate quest templates for different types (fallback method)
     */
    public static generateFallbackQuest(seed: QuestSeed, gameState: SaveData): GeneratedQuest {
        const templates = this.getQuestTemplates();
        const template = templates[seed.type] || templates.consequence;
        
        // Generate unique ID for fallback quest with counter to prevent collisions
        this.uniqueCounter++;
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substr(2, 9);
        const seedId = seed.id.replace(/[^a-zA-Z0-9]/g, ''); // Clean seed ID
        const uniqueId = `quest_fallback_${gameState.turnCount}_${timestamp}_${this.uniqueCounter}_${seedId}_${randomPart}`;
        
        const quest: GeneratedQuest = {
            title: template.title.replace('{entity}', seed.involvedEntities[0] || 'Người bí ẩn'),
            description: template.description,
            objectives: template.objectives.map(obj => ({
                description: obj.replace('{entity}', seed.involvedEntities[0] || 'mục tiêu'),
                completed: false
            })),
            giver: seed.involvedEntities[0] || 'Người lạ',
            reward: seed.expectedRewards[0] || 'Kinh nghiệm và vàng',
            isMainQuest: false,
            status: 'active',
            sourceSeeds: [seed],
            generationMetadata: {
                aiPromptUsed: 'Fallback template',
                generatedAt: gameState.turnCount,
                difficulty: seed.suggestedDifficulty,
                questType: seed.type,
                confidence: 0.7, // Higher confidence - templates are reliable
                uniqueId: uniqueId
            }
        };

        return quest;
    }

    /**
     * Get quest templates for fallback generation
     */
    private static getQuestTemplates(): { [key: string]: any } {
        return {
            consequence: {
                title: "Hậu quả từ {entity}",
                description: "Hành động trong quá khứ của bạn đã tạo ra những hậu quả không lường trước được. Giờ đây, bạn phải đối mặt với chúng.",
                objectives: [
                    "Tìm hiểu về hậu quả của hành động",
                    "Giải quyết vấn đề phát sinh",
                    "Hoàn thành nghĩa vụ cần thiết"
                ]
            },
            mystery: {
                title: "Bí ẩn của {entity}",
                description: "Một bí ẩn cần được giải mã. Những manh mối rải rác chờ đợi được ghép lại để tạo thành bức tranh hoàn chỉnh.",
                objectives: [
                    "Thu thập manh mối",
                    "Điều tra các dấu hiệu bất thường",
                    "Khám phá sự thật ẩn giấu"
                ]
            },
            exploration: {
                title: "Khám phá vùng đất mới",
                description: "Những vùng đất chưa được khám phá đang chờ đợi. Hãy mở rộng hiểu biết về thế giới xung quanh.",
                objectives: [
                    "Khám phá khu vực mới",
                    "Lập bản đồ chi tiết",
                    "Tìm kiếm kho báu ẩn giấu"
                ]
            },
            character_arc: {
                title: "Hành trình của {entity}",
                description: "Đây là cơ hội để phát triển mối quan hệ và giúp đỡ những người quan trọng trong cuộc hành trình.",
                objectives: [
                    "Lắng nghe câu chuyện của {entity}",
                    "Hỗ trợ giải quyết vấn đề cá nhân",
                    "Củng cố mối quan hệ"
                ]
            }
        };
    }
}
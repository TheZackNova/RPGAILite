import type { Memory, SaveData, Entity, Quest } from '../types';
import { ImportanceScorer } from './ImportanceScorer';

export interface QuestSeed {
    id: string;
    type: 'consequence' | 'mystery' | 'exploration' | 'character_arc';
    priority: 'low' | 'medium' | 'high';
    triggerMemories: Memory[];
    involvedEntities: string[];
    suggestedDifficulty: 'easy' | 'medium' | 'hard';
    questHooks: string[];
    expectedRewards: string[];
    relevanceScore: number;
    generatedAt: number;
}

export interface QuestOpportunity {
    seeds: QuestSeed[];
    analysisStats: {
        memoriesAnalyzed: number;
        patternsFound: number;
        highPrioritySeeds: number;
        entitiesInvolved: number;
    };
    recommendations: string[];
}

export class QuestAnalyzer {
    
    /**
     * Analyze game state to identify quest generation opportunities
     */
    public static analyzeQuestOpportunities(gameState: SaveData): QuestOpportunity {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🔍 [${timestamp}] Quest Analysis Started:`, {
            turnNumber: gameState.turnCount,
            memories: gameState.memories.length,
            entities: Object.keys(gameState.knownEntities).length,
            activeQuests: gameState.quests.filter(q => q.status === 'active').length
        });

        const seeds: QuestSeed[] = [];
        const recommendations: string[] = [];

        // Analyze for different quest types
        seeds.push(...this.analyzeConsequenceQuests(gameState));
        seeds.push(...this.analyzeMysteryQuests(gameState));
        seeds.push(...this.analyzeExplorationQuests(gameState));
        seeds.push(...this.analyzeCharacterArcQuests(gameState));

        // Sort seeds by relevance score
        seeds.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Generate recommendations
        recommendations.push(...this.generateRecommendations(seeds, gameState));

        const analysisStats = {
            memoriesAnalyzed: gameState.memories.length,
            patternsFound: seeds.length,
            highPrioritySeeds: seeds.filter(s => s.priority === 'high').length,
            entitiesInvolved: new Set(seeds.flatMap(s => s.involvedEntities)).size
        };

        console.log(`✅ [${timestamp}] Quest Analysis Complete:`, analysisStats);

        return {
            seeds,
            analysisStats,
            recommendations
        };
    }

    /**
     * Analyze for consequence-based quests from player actions
     */
    private static analyzeConsequenceQuests(gameState: SaveData): QuestSeed[] {
        const seeds: QuestSeed[] = [];
        const combatMemories = gameState.memories.filter(m => 
            m.category === 'combat' && (m.importance || 0) >= 40
        );

        // Combat consequences - revenge, bounties, faction reactions
        for (const memory of combatMemories) {
            if (this.hasConsequencePotential(memory, gameState)) {
                const seed: QuestSeed = {
                    id: `consequence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'consequence',
                    priority: this.calculateSeedPriority(memory),
                    triggerMemories: [memory],
                    involvedEntities: memory.relatedEntities || [],
                    suggestedDifficulty: this.calculateDifficulty(memory, gameState),
                    questHooks: this.generateConsequenceHooks(memory),
                    expectedRewards: this.suggestConsequenceRewards(memory, gameState),
                    relevanceScore: this.calculateRelevanceScore(memory, gameState, 'consequence'),
                    generatedAt: gameState.turnCount
                };
                seeds.push(seed);
            }
        }

        // Social consequences - reputation, alliances, political fallout
        const socialMemories = gameState.memories.filter(m => 
            m.category === 'social' && (m.importance || 0) >= 35
        );

        for (const memory of socialMemories) {
            if (this.hasSocialConsequencePotential(memory, gameState)) {
                const seed: QuestSeed = {
                    id: `social_consequence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'consequence',
                    priority: this.calculateSeedPriority(memory),
                    triggerMemories: [memory],
                    involvedEntities: memory.relatedEntities || [],
                    suggestedDifficulty: 'medium',
                    questHooks: this.generateSocialConsequenceHooks(memory),
                    expectedRewards: this.suggestSocialRewards(memory, gameState),
                    relevanceScore: this.calculateRelevanceScore(memory, gameState, 'consequence'),
                    generatedAt: gameState.turnCount
                };
                seeds.push(seed);
            }
        }

        return seeds;
    }

    /**
     * Analyze for mystery quests from incomplete or intriguing memories
     */
    private static analyzeMysteryQuests(gameState: SaveData): QuestSeed[] {
        const seeds: QuestSeed[] = [];
        
        // Find memories with high intrigue but incomplete resolution
        const mysteriousMemories = gameState.memories.filter(m => 
            this.hasMysteryPotential(m, gameState)
        );

        for (const memory of mysteriousMemories) {
            const relatedMemories = this.findRelatedMemories(memory, gameState.memories);
            
            const seed: QuestSeed = {
                id: `mystery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'mystery',
                priority: this.calculateMysteryPriority(memory, relatedMemories),
                triggerMemories: [memory, ...relatedMemories],
                involvedEntities: memory.relatedEntities || [],
                suggestedDifficulty: this.calculateMysteryDifficulty(memory, relatedMemories),
                questHooks: this.generateMysteryHooks(memory, relatedMemories),
                expectedRewards: this.suggestMysteryRewards(memory, gameState),
                relevanceScore: this.calculateRelevanceScore(memory, gameState, 'mystery'),
                generatedAt: gameState.turnCount
            };
            seeds.push(seed);
        }

        return seeds;
    }

    /**
     * Analyze for exploration quests based on location and discovery patterns
     */
    private static analyzeExplorationQuests(gameState: SaveData): QuestSeed[] {
        const seeds: QuestSeed[] = [];
        
        // Find location-based memories that suggest further exploration
        const discoveryMemories = gameState.memories.filter(m => 
            m.category === 'discovery' && (m.importance || 0) >= 30
        );

        // Group by location patterns
        const locationPatterns = this.analyzeLocationPatterns(discoveryMemories, gameState);

        for (const pattern of locationPatterns) {
            const seed: QuestSeed = {
                id: `exploration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'exploration',
                priority: this.calculateExplorationPriority(pattern),
                triggerMemories: pattern.memories,
                involvedEntities: pattern.entities,
                suggestedDifficulty: this.calculateExplorationDifficulty(pattern),
                questHooks: this.generateExplorationHooks(pattern),
                expectedRewards: this.suggestExplorationRewards(pattern, gameState),
                relevanceScore: this.calculatePatternRelevance(pattern, gameState),
                generatedAt: gameState.turnCount
            };
            seeds.push(seed);
        }

        return seeds;
    }

    /**
     * Analyze for character arc quests based on relationships and companion development
     */
    private static analyzeCharacterArcQuests(gameState: SaveData): QuestSeed[] {
        const seeds: QuestSeed[] = [];
        
        // Analyze party member development opportunities
        for (const companion of gameState.party) {
            const companionMemories = gameState.memories.filter(m => 
                m.relatedEntities?.includes(companion.name) && m.category === 'relationship'
            );

            if (companionMemories.length >= 2) {
                const seed: QuestSeed = {
                    id: `character_arc_${companion.name}_${Date.now()}`,
                    type: 'character_arc',
                    priority: this.calculateCharacterArcPriority(companion, companionMemories),
                    triggerMemories: companionMemories,
                    involvedEntities: [companion.name],
                    suggestedDifficulty: 'medium',
                    questHooks: this.generateCharacterArcHooks(companion, companionMemories),
                    expectedRewards: this.suggestCharacterArcRewards(companion, gameState),
                    relevanceScore: this.calculateCharacterRelevance(companion, companionMemories, gameState),
                    generatedAt: gameState.turnCount
                };
                seeds.push(seed);
            }
        }

        // Analyze faction relationship development
        const factionMemories = gameState.memories.filter(m => 
            m.category === 'social' && this.mentionsFaction(m.text)
        );

        if (factionMemories.length >= 3) {
            const factionEntities = this.extractFactionEntities(factionMemories, gameState);
            
            const seed: QuestSeed = {
                id: `faction_arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'character_arc',
                priority: 'medium',
                triggerMemories: factionMemories.slice(-3), // Most recent 3
                involvedEntities: factionEntities,
                suggestedDifficulty: 'hard',
                questHooks: this.generateFactionArcHooks(factionMemories),
                expectedRewards: this.suggestFactionRewards(gameState),
                relevanceScore: this.calculateFactionRelevance(factionMemories, gameState),
                generatedAt: gameState.turnCount
            };
            seeds.push(seed);
        }

        return seeds;
    }

    // Helper Methods for Pattern Recognition

    private static hasConsequencePotential(memory: Memory, gameState: SaveData): boolean {
        const text = memory.text.toLowerCase();
        
        // Combat consequence indicators (Vietnamese patterns)
        const combatConsequencePatterns = [
            /đánh bại|giết|hạ gục|tiêu diệt/,
            /chiến thắng|thắng|đánh thắng/,
            /tấn công|đánh nhau|chiến đấu/,
            /thù hận|báo thù|trả thù/
        ];

        return combatConsequencePatterns.some(pattern => pattern.test(text)) &&
               memory.relatedEntities && memory.relatedEntities.length > 0;
    }

    private static hasSocialConsequencePotential(memory: Memory, gameState: SaveData): boolean {
        const text = memory.text.toLowerCase();
        
        // Social consequence indicators
        const socialConsequencePatterns = [
            /thuyết phục|đàm phán|thỏa thuận/,
            /liên minh|đồng minh|hợp tác/,
            /xung đột|mâu thuẫn|tranh cãi/,
            /danh tiếng|uy tín|thanh danh/,
            /quyền lực|ảnh hưởng|địa vị/
        ];

        return socialConsequencePatterns.some(pattern => pattern.test(text));
    }

    private static hasMysteryPotential(memory: Memory, gameState: SaveData): boolean {
        const text = memory.text.toLowerCase();
        
        // Mystery indicators
        const mysteryPatterns = [
            /bí ẩn|bí mật|bí ấn/,
            /không rõ|không biết|chưa rõ/,
            /lạ|kỳ lạ|khác thường/,
            /ẩn giấu|che giấu|giấu kín/,
            /manh mối|dấu vết|dấu hiệu/,
            /điều tra|khám phá|tìm hiểu/,
            /cổ xưa|thượng cổ|xa xưa/,
            /ma thuật|phép thuật|pháp thuật/
        ];

        return mysteryPatterns.some(pattern => pattern.test(text)) &&
               (memory.importance || 0) >= 35;
    }

    private static mentionsFaction(text: string): boolean {
        const factionPatterns = [
            /bang hội|tông môn|phái/,
            /hoàng gia|triều đình|hoàng tộc/,
            /thương gia|thương hội|hội thương/,
            /tổ chức|nhóm|đảng phái/
        ];

        return factionPatterns.some(pattern => pattern.test(text.toLowerCase()));
    }

    // Scoring and Priority Calculation

    private static calculateSeedPriority(memory: Memory): 'low' | 'medium' | 'high' {
        const importance = memory.importance || 0;
        if (importance >= 70) return 'high';
        if (importance >= 40) return 'medium';
        return 'low';
    }

    private static calculateMysteryPriority(memory: Memory, relatedMemories: Memory[]): 'low' | 'medium' | 'high' {
        const totalImportance = [memory, ...relatedMemories].reduce((sum, m) => sum + (m.importance || 0), 0);
        const avgImportance = totalImportance / (relatedMemories.length + 1);
        
        if (avgImportance >= 60) return 'high';
        if (avgImportance >= 40) return 'medium';
        return 'low';
    }

    private static calculateCharacterArcPriority(companion: Entity, memories: Memory[]): 'low' | 'medium' | 'high' {
        // Party members get higher priority
        if (memories.length >= 4) return 'high';
        if (memories.length >= 2) return 'medium';
        return 'low';
    }

    private static calculateExplorationPriority(pattern: any): 'low' | 'medium' | 'high' {
        if (pattern.memories.length >= 3) return 'high';
        if (pattern.memories.length >= 2) return 'medium';
        return 'low';
    }

    private static calculateDifficulty(memory: Memory, gameState: SaveData): 'easy' | 'medium' | 'hard' {
        const importance = memory.importance || 0;
        const entitiesInvolved = memory.relatedEntities?.length || 0;
        
        if (importance >= 70 || entitiesInvolved >= 3) return 'hard';
        if (importance >= 40 || entitiesInvolved >= 2) return 'medium';
        return 'easy';
    }

    private static calculateMysteryDifficulty(memory: Memory, relatedMemories: Memory[]): 'easy' | 'medium' | 'hard' {
        const totalComplexity = relatedMemories.length + (memory.relatedEntities?.length || 0);
        
        if (totalComplexity >= 5) return 'hard';
        if (totalComplexity >= 3) return 'medium';
        return 'easy';
    }

    private static calculateExplorationDifficulty(pattern: any): 'easy' | 'medium' | 'hard' {
        if (pattern.complexity >= 7) return 'hard';
        if (pattern.complexity >= 4) return 'medium';
        return 'easy';
    }

    private static calculateRelevanceScore(memory: Memory, gameState: SaveData, type: string): number {
        let score = memory.importance || 0;
        
        // Boost for recent memories
        const age = gameState.turnCount - (memory.createdAt || gameState.turnCount);
        if (age <= 5) score += 15;
        else if (age <= 10) score += 10;
        
        // Boost for entity involvement
        if (memory.relatedEntities) {
            score += memory.relatedEntities.length * 5;
            
            // Extra boost if involves party members
            const partyMembers = gameState.party.map(p => p.name);
            const partyInvolvement = memory.relatedEntities.filter(e => partyMembers.includes(e)).length;
            score += partyInvolvement * 10;
        }
        
        return Math.min(100, score);
    }

    private static calculatePatternRelevance(pattern: any, gameState: SaveData): number {
        return pattern.memories.reduce((sum: number, memory: Memory) => 
            sum + this.calculateRelevanceScore(memory, gameState, 'exploration'), 0
        ) / pattern.memories.length;
    }

    private static calculateCharacterRelevance(companion: Entity, memories: Memory[], gameState: SaveData): number {
        const avgImportance = memories.reduce((sum, m) => sum + (m.importance || 0), 0) / memories.length;
        return avgImportance + 20; // Bonus for being party member
    }

    private static calculateFactionRelevance(memories: Memory[], gameState: SaveData): number {
        return memories.reduce((sum, m) => sum + (m.importance || 0), 0) / memories.length;
    }

    // Quest Hook Generation

    private static generateConsequenceHooks(memory: Memory): string[] {
        const hooks: string[] = [];
        const text = memory.text.toLowerCase();
        
        if (/đánh bại|giết|hạ gục/.test(text)) {
            hooks.push("Người thân của kẻ thù muốn báo thù");
            hooks.push("Một thừa kế bí mật được tiết lộ");
            hooks.push("Lời nguyền từ kẻ thù hấp hối");
        }
        
        if (/chiến thắng|thắng lợi/.test(text)) {
            hooks.push("Danh tiếng thu hút sự chú ý không mong muốn");
            hooks.push("Cơ hội thăng tiến trong tổ chức");
            hooks.push("Kẻ thù mới xuất hiện từ bóng tối");
        }
        
        return hooks.length > 0 ? hooks : ["Hậu quả từ hành động trong quá khứ"];
    }

    private static generateSocialConsequenceHooks(memory: Memory): string[] {
        return [
            "Thỏa thuận cần được thực hiện",
            "Uy tín mở ra cơ hội mới",
            "Mối quan hệ đòi hỏi sự đầu tư",
            "Nghĩa vụ xã hội phải được hoàn thành"
        ];
    }

    private static generateMysteryHooks(memory: Memory, relatedMemories: Memory[]): string[] {
        return [
            "Manh mối dẫn đến bí mật lớn hơn",
            "Câu đố cổ xưa chờ được giải mã",
            "Sự thật ẩn giấu sau các dấu hiệu",
            "Điều tra kỹ lưỡng sẽ mang lại kết quả"
        ];
    }

    private static generateExplorationHooks(pattern: any): string[] {
        return [
            "Vùng đất chưa được khám phá hoàn toàn",
            "Kho báu ẩn giấu trong khu vực",
            "Bản đồ cổ chỉ ra vị trí quan trọng",
            "Địa điểm thiêng liêng cần được tìm thấy"
        ];
    }

    private static generateCharacterArcHooks(companion: Entity, memories: Memory[]): string[] {
        return [
            `${companion.name} cần sự giúp đỡ cá nhân`,
            `Quá khứ của ${companion.name} tái xuất hiện`,
            `${companion.name} có cơ hội phát triển kỹ năng`,
            `Mối quan hệ với ${companion.name} có thể sâu sắc hơn`
        ];
    }

    private static generateFactionArcHooks(memories: Memory[]): string[] {
        return [
            "Cơ hội thăng tiến trong tổ chức",
            "Nhiệm vụ quan trọng của phe phái",
            "Chứng tỏ lòng trung thành",
            "Mở rộng ảnh hưởng và quyền lực"
        ];
    }

    // Reward Suggestions

    private static suggestConsequenceRewards(memory: Memory, gameState: SaveData): string[] {
        return [
            "Kinh nghiệm chiến đấu",
            "Vật phẩm từ kẻ thù",
            "Thông tin quan trọng",
            "Uy tín và danh tiếng"
        ];
    }

    private static suggestSocialRewards(memory: Memory, gameState: SaveData): string[] {
        return [
            "Mối quan hệ chính trị",
            "Quyền tiếp cận thông tin",
            "Hỗ trợ từ đồng minh",
            "Địa vị xã hội cao hơn"
        ];
    }

    private static suggestMysteryRewards(memory: Memory, gameState: SaveData): string[] {
        return [
            "Kiến thức cổ xưa",
            "Bảo vật huyền thoại",
            "Bí kíp võ công",
            "Sức mạnh ma pháp"
        ];
    }

    private static suggestExplorationRewards(pattern: any, gameState: SaveData): string[] {
        return [
            "Kho báu ẩn giấu",
            "Bản đồ khu vực mới",
            "Nguồn tài nguyên quý hiếm",
            "Địa điểm an toàn"
        ];
    }

    private static suggestCharacterArcRewards(companion: Entity, gameState: SaveData): string[] {
        return [
            "Kỹ năng mới cho đồng đội",
            "Lòng trung thành tăng cường",
            "Khả năng đặc biệt",
            "Mối quan hệ sâu sắc hơn"
        ];
    }

    private static suggestFactionRewards(gameState: SaveData): string[] {
        return [
            "Chức vụ cao trong tổ chức",
            "Quyền lợi và đặc quyền",
            "Hỗ trợ từ phe phái",
            "Quyền tiếp cận tài nguyên"
        ];
    }

    // Utility Methods

    private static findRelatedMemories(targetMemory: Memory, allMemories: Memory[]): Memory[] {
        if (!targetMemory.relatedEntities) return [];
        
        return allMemories.filter(memory => 
            memory !== targetMemory &&
            memory.relatedEntities?.some(entity => 
                targetMemory.relatedEntities!.includes(entity)
            )
        ).slice(0, 3); // Limit to 3 related memories
    }

    private static analyzeLocationPatterns(memories: Memory[], gameState: SaveData): any[] {
        const patterns: any[] = [];
        
        // Group memories by location mentions
        const locationGroups = new Map<string, Memory[]>();
        
        memories.forEach(memory => {
            const locations = this.extractLocationsFromText(memory.text);
            locations.forEach(location => {
                if (!locationGroups.has(location)) {
                    locationGroups.set(location, []);
                }
                locationGroups.get(location)!.push(memory);
            });
        });

        // Create patterns from location groups
        locationGroups.forEach((groupMemories, location) => {
            if (groupMemories.length >= 2) {
                patterns.push({
                    location,
                    memories: groupMemories,
                    entities: [...new Set(groupMemories.flatMap(m => m.relatedEntities || []))],
                    complexity: groupMemories.length + groupMemories.reduce((sum, m) => sum + (m.relatedEntities?.length || 0), 0)
                });
            }
        });

        return patterns;
    }

    private static extractLocationsFromText(text: string): string[] {
        const locations: string[] = [];
        const locationPatterns = [
            /(?:ở|tại|trong|đến)\s+([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúăđĩũơư\s]+)/g,
            /([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúăđĩũơư]+(?:\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúăđĩũơư]+)*)\s*(?:thành|làng|thị|phố|rừng|núi|sông|hồ)/g
        ];

        locationPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                locations.push(match[1].trim());
            }
        });

        return [...new Set(locations)];
    }

    private static extractFactionEntities(memories: Memory[], gameState: SaveData): string[] {
        const entities = new Set<string>();
        
        memories.forEach(memory => {
            memory.relatedEntities?.forEach(entity => {
                const entityData = gameState.knownEntities[entity];
                if (entityData && (entityData.type === 'faction' || entityData.type === 'npc')) {
                    entities.add(entity);
                }
            });
        });

        return Array.from(entities);
    }

    private static generateRecommendations(seeds: QuestSeed[], gameState: SaveData): string[] {
        const recommendations: string[] = [];
        
        if (seeds.length === 0) {
            recommendations.push("Không tìm thấy cơ hội quest nào. Hãy tương tác nhiều hơn với thế giới!");
            return recommendations;
        }

        const highPrioritySeeds = seeds.filter(s => s.priority === 'high');
        if (highPrioritySeeds.length > 0) {
            recommendations.push(`${highPrioritySeeds.length} cơ hội quest ưu tiên cao được tìm thấy.`);
        }

        const questTypes = [...new Set(seeds.map(s => s.type))];
        if (questTypes.length >= 3) {
            recommendations.push("Nhiều loại quest đa dạng có thể được tạo ra.");
        }

        if (seeds.some(s => s.involvedEntities.length >= 3)) {
            recommendations.push("Có quest phức tạp với nhiều nhân vật liên quan.");
        }

        return recommendations;
    }
}
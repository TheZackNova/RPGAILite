import type { SaveData, Entity, Status, Quest, GameHistoryEntry, CustomRule, KnownEntities } from './types.ts';
import { MBTI_PERSONALITIES } from './data/mbti.ts';
import { EnhancedRAG } from './utils/EnhancedRAG';
import { MemoryAnalytics } from './utils/MemoryAnalytics';

// Aggressive Token Management for 100k hard limit
const TOKEN_CONFIG = {
    MAX_TOKENS_PER_TURN: 90000,  // 90k hard limit with 10k buffer
    TOKEN_BUFFER: 10000,         // 10k safety buffer
    CHARS_PER_TOKEN: 1.2,        // Conservative token estimation
    
    // Aggressive allocation for strict 100k budget
    ALLOCATION: {
        CRITICAL: 0.50,      // 45k tokens - Party, action context only
        IMPORTANT: 0.25,     // 22.5k tokens - Essential entities, key quests
        CONTEXTUAL: 0.15,    // 13.5k tokens - Minimal world info
        SUPPLEMENTAL: 0.10   // 9k tokens - Rules, misc (reduced)
    }
};

// Entity relevance scoring
interface EntityRelevance {
    entity: Entity;
    score: number;
    reason: string[];
}

// Memory with relevance scoring
interface ScoredMemory {
    memory: string;
    score: number;
    type: 'turn' | 'chapter' | 'memoir';
}

export class EnhancedRAGSystem {
    private semanticCache = new Map<string, Set<string>>();
    private entityGraph = new Map<string, Set<string>>();
    
    constructor() {
        this.initializeSystem();
    }

    private initializeSystem() {
        // Initialize any preprocessing needed
    }

    // Main entry point - builds the enhanced RAG prompt
    public buildEnhancedPrompt(
        action: string,
        gameState: SaveData,
        ruleChangeContext: string = '',
        playerNsfwRequest: string = ''
    ): string {
        const startTime = performance.now();
        
        try {
            // Step 1: Phase 4 Enhancement - Build intelligent context using Enhanced RAG
            const intelligentContext = EnhancedRAG.buildIntelligentContext(gameState, action, {
                maxMemories: 5,
                maxTokens: 1000,
                importanceThreshold: 35,
                recencyWeight: 0.3,
                relevanceWeight: 0.5,
                diversityWeight: 0.2,
                includeArchived: false
            });
            
            // Step 2: Analyze action intent
            const actionIntent = this.analyzeActionIntent(action);
            
            // Step 3: Build entity relationship graph
            this.buildEntityGraph(gameState.knownEntities);
            
            // Step 4: Score and retrieve relevant entities (enhanced with context)
            const relevantEntities = this.retrieveRelevantEntities(
                action,
                actionIntent,
                gameState,
                intelligentContext
            );
            
            // Step 5: Calculate dynamic token budgets (accounting for intelligent context)
            const tokenBudget = this.calculateDynamicTokenBudget(
                relevantEntities,
                gameState,
                intelligentContext.tokenUsage
            );
            
            // Step 5: Build context sections with priority
            const contextSections = this.buildPrioritizedContext(
                relevantEntities,
                gameState,
                tokenBudget
            );
            
            // Step 6: Assemble final prompt with intelligent context
            const finalPrompt = this.assembleFinalPrompt(
                action,
                contextSections,
                ruleChangeContext,
                playerNsfwRequest,
                gameState.worldData,
                intelligentContext
            );
            
            const endTime = performance.now();
            console.log(`RAG processing time: ${(endTime - startTime).toFixed(2)}ms`);
            
            return this.enforceTokenLimit(finalPrompt);
            
        } catch (error) {
            console.error('Enhanced RAG Error:', error);
            // Fallback to basic prompt
            return this.buildFallbackPrompt(action, gameState);
        }
    }

    // Analyze the player's action to understand intent
    private analyzeActionIntent(action: string): ActionIntent {
        const lowerAction = action.toLowerCase();
        const intent: ActionIntent = {
            type: 'general',
            targets: [],
            keywords: [],
            isMovement: false,
            isCombat: false,
            isSocial: false,
            isItemUse: false,
            isSkillUse: false,
            isExploration: false
        };

        // Movement patterns
        if (/đi|chạy|leo|nhảy|bay|di chuyển|tới|đến|rời|về/.test(lowerAction)) {
            intent.isMovement = true;
            intent.type = 'movement';
        }

        // Combat patterns
        if (/tấn công|đánh|chém|đâm|bắn|ném|chiến đấu|giết/.test(lowerAction)) {
            intent.isCombat = true;
            intent.type = 'combat';
        }

        // Social patterns
        if (/nói|hỏi|trả lời|thuyết phục|dọa|giao dịch|mua|bán/.test(lowerAction)) {
            intent.isSocial = true;
            intent.type = 'social';
        }

        // Item use patterns
        if (/sử dụng|dùng|uống|ăn|trang bị|tháo|cho|lấy/.test(lowerAction)) {
            intent.isItemUse = true;
            intent.type = 'item_interaction';
        }

        // Skill use patterns
        if (/thi triển|sử dụng.*pháp|công pháp|kỹ năng/.test(lowerAction)) {
            intent.isSkillUse = true;
            intent.type = 'skill_use';
        }

        // Extract potential entity targets
        intent.targets = this.extractPotentialTargets(action);
        intent.keywords = this.extractKeywords(action);

        return intent;
    }

    // Build entity relationship graph for better retrieval
    private buildEntityGraph(entities: KnownEntities) {
        this.entityGraph.clear();
        
        if (!entities || typeof entities !== 'object') {
            return;
        }
        
        for (const [name, entity] of Object.entries(entities)) {
            const connections = new Set<string>();
            
            // Add connections based on entity properties
            if (entity.owner) connections.add(entity.owner);
            if (entity.location) connections.add(entity.location);
            
            // Parse description for entity mentions
            const description = (entity.description || '').toLowerCase();
            for (const [otherName, otherEntity] of Object.entries(entities)) {
                if (name !== otherName && description.includes(otherName.toLowerCase())) {
                    connections.add(otherName);
                }
            }
            
            // Special handling for NPCs with skills
            if (entity.skills && Array.isArray(entity.skills)) {
                entity.skills.forEach(skill => connections.add(skill));
            }
            
            this.entityGraph.set(name, connections);
        }
    }

    // Enhanced entity retrieval with relevance scoring
    private retrieveRelevantEntities(
        action: string,
        intent: ActionIntent,
        gameState: SaveData,
        intelligentContext?: any
    ): EntityRelevance[] {
        const { knownEntities, party, gameHistory, statuses } = gameState;
        const relevanceScores: EntityRelevance[] = [];
        
        // Always include party members with high relevance
        if (Array.isArray(party)) {
            party.forEach(member => {
                relevanceScores.push({
                    entity: member,
                    score: 100,
                    reason: ['Party member']
                });
            });
        }

        // Score all other entities
        for (const [name, entity] of Object.entries(knownEntities)) {
            if (Array.isArray(party) && party.some(p => p.name === name)) continue;
            
            let score = 0;
            const reasons: string[] = [];
            
            // Direct mention in action
            if (action.toLowerCase().includes(name.toLowerCase())) {
                score += 50;
                reasons.push('Directly mentioned');
            }
            
            // Mentioned in recent history (sliding window)
            const recentMentions = this.countRecentMentions(name, gameHistory, 3);
            if (recentMentions > 0) {
                score += Math.min(30, recentMentions * 10);
                reasons.push(`Recent mentions: ${recentMentions}`);
            }
            
            // Location matching for PC
            const pc = party.find(p => p.type === 'pc');
            if (pc?.location && entity.location === pc.location) {
                score += 20;
                reasons.push('Same location as PC');
            }
            
            // Type relevance based on intent
            score += this.getTypeRelevanceScore(entity.type, intent);
            
            // Enhanced companion skill matching
            if (entity.type === 'companion' && entity.skills) {
                const skillsArray = Array.isArray(entity.skills) ? entity.skills : entity.skills.split(',').map(s => s.trim());
                const skillMatch = this.getCompanionSkillRelevance(skillsArray, action, intent);
                score += skillMatch;
                if (skillMatch > 0) {
                    reasons.push(`Relevant skills: ${skillsArray.slice(0, 2).join(', ')}`);
                }
            }
            
            // Graph connections
            const connections = this.entityGraph.get(name) || new Set();
            const connectedToRelevant = Array.from(connections).some(conn => 
                relevanceScores.some(r => r.score > 50 && r.entity.name === conn)
            );
            if (connectedToRelevant) {
                score += 15;
                reasons.push('Connected to relevant entity');
            }
            
            // Status effects
            if (statuses.some(s => s.owner === name)) {
                score += 10;
                reasons.push('Has active status');
            }
            
            if (score > 0) {
                relevanceScores.push({ entity, score, reason: reasons });
            }
        }
        
        // Sort by relevance and apply cutoffs
        return relevanceScores
            .sort((a, b) => b.score - a.score)
            .filter(r => r.score >= 10); // Minimum relevance threshold
    }

    // Calculate dynamic token budgets based on context
    private calculateDynamicTokenBudget(
        relevantEntities: EntityRelevance[],
        gameState: SaveData,
        intelligentContextTokens: number = 0
    ): TokenBudget {
        const baseLimit = TOKEN_CONFIG.MAX_TOKENS_PER_TURN - TOKEN_CONFIG.TOKEN_BUFFER;
        
        // Analyze context complexity
        const hasActiveQuests = gameState.quests.some(q => q.status === 'active');
        const hasComplexHistory = gameState.gameHistory.length > 20;
        const hasManyCriticalEntities = relevantEntities.filter(r => r.score > 70).length > 5;
        
        // Adjust allocations based on context
        let criticalWeight = TOKEN_CONFIG.ALLOCATION.CRITICAL;
        let importantWeight = TOKEN_CONFIG.ALLOCATION.IMPORTANT;
        
        if (hasManyCriticalEntities) {
            criticalWeight += 0.1;
            importantWeight -= 0.05;
        }
        
        if (!hasActiveQuests) {
            importantWeight -= 0.05;
            criticalWeight += 0.05;
        }
        
        return {
            critical: Math.floor(baseLimit * criticalWeight),
            important: Math.floor(baseLimit * importantWeight),
            contextual: Math.floor(baseLimit * TOKEN_CONFIG.ALLOCATION.CONTEXTUAL),
            supplemental: Math.floor(baseLimit * TOKEN_CONFIG.ALLOCATION.SUPPLEMENTAL)
        };
    }

    // Build prioritized context sections
    private buildPrioritizedContext(
        relevantEntities: EntityRelevance[],
        gameState: SaveData,
        budget: TokenBudget
    ): ContextSections {
        const sections: ContextSections = {
            critical: '',
            important: '',
            contextual: '',
            supplemental: ''
        };

        // Critical: High-relevance entities and immediate context
        sections.critical = this.buildCriticalContext(
            relevantEntities.filter(r => r.score >= 70),
            gameState,
            budget.critical
        );

        // Important: Related entities, active quests, recent history
        sections.important = this.buildImportantContext(
            relevantEntities.filter(r => r.score >= 30 && r.score < 70),
            gameState,
            budget.important
        );

        // Contextual: World info, chronicle, memories
        sections.contextual = this.buildContextualInfo(
            gameState,
            budget.contextual
        );

        // Supplemental: Custom rules and additional context
        sections.supplemental = this.buildSupplementalContext(
            gameState,
            relevantEntities,
            budget.supplemental
        );

        return sections;
    }

    // Helper methods for context building
    private buildCriticalContext(
        entities: EntityRelevance[],
        gameState: SaveData,
        tokenBudget: number
    ): string {
        let context = "=== TRI THỨC QUAN TRỌNG ===\n";
        let usedTokens = this.estimateTokens(context);
        
        // Add time and turn info
        const timeInfo = this.formatGameTime(gameState.gameTime, gameState.turnCount);
        context += timeInfo + "\n\n";
        usedTokens += this.estimateTokens(timeInfo);
        
        // Dedicated party section for enhanced coordination  
        const partyContext = this.buildEnhancedPartyContext(gameState, Math.floor(tokenBudget * 0.4));
        if (partyContext) {
            context += partyContext + "\n";
            usedTokens += this.estimateTokens(partyContext);
        }
        
        // Add remaining entities with detailed info
        const remainingBudget = tokenBudget - usedTokens;
        const nonPartyEntities = entities.filter(e => e.entity.type !== 'companion');
        const tokensPerEntity = Math.floor(remainingBudget / Math.max(1, nonPartyEntities.length));
        
        nonPartyEntities.forEach(({ entity, score, reason }) => {
            const entityText = this.formatEntityWithContext(
                entity,
                gameState.statuses,
                reason,
                tokensPerEntity
            );
            
            const entityTokens = this.estimateTokens(entityText);
            if (usedTokens + entityTokens <= tokenBudget) {
                context += entityText + "\n";
                usedTokens += entityTokens;
            }
        });
        
        return context;
    }
    
    // Enhanced party coordination context for better AI understanding
    private buildEnhancedPartyContext(gameState: SaveData, maxTokens: number): string {
        const { party, statuses } = gameState;
        
        if (!party || party.length === 0) return '';
        
        let context = "**TỔ ĐỘI PHIỀU LƯU:**\n";
        let usedTokens = this.estimateTokens(context);
        
        // Log AI context building for debugging
        if (gameState.turnCount) {
            import('./utils/partyDebugger').then(({ partyDebugger }) => {
                partyDebugger.logAIContextBuild({
                    companions: party.filter(p => p.type === 'companion'),
                    contextLength: context.length,
                    includesPersonalities: party.some(p => p.personality),
                    includesSkills: party.some(p => p.skills),
                    includesRelationships: party.some(p => p.relationship)
                }, usedTokens, gameState.turnCount);
            });
        }
        
        // PC information first
        const pc = party.find(p => p.type === 'pc');
        if (pc) {
            const pcStatuses = statuses.filter(s => s.owner === 'pc' || s.owner === pc.name);
            let pcInfo = `[Nhân vật chính] ${pc.name}`;
            
            const pcDetails: string[] = [];
            if (pc.location) pcDetails.push(`Vị trí: ${pc.location}`);
            if (pc.realm) pcDetails.push(`Thực lực: ${pc.realm}`);
            if (pcStatuses.length > 0) {
                pcDetails.push(`Trạng thái: ${pcStatuses.map(s => s.name).join(', ')}`);
            }
            
            if (pcDetails.length > 0) {
                pcInfo += ` - ${pcDetails.join(', ')}`;
            }
            pcInfo += '\n';
            
            const pcTokens = this.estimateTokens(pcInfo);
            if (usedTokens + pcTokens <= maxTokens) {
                context += pcInfo;
                usedTokens += pcTokens;
            }
        }
        
        // Companions with detailed coordination info
        const companions = party.filter(p => p.type === 'companion');
        if (companions.length > 0) {
            companions.forEach(companion => {
                let companionInfo = `[Đồng hành] ${companion.name}`;
                
                const companionDetails: string[] = [];
                
                // Relationship status (critical for party dynamics)
                if (companion.relationship) {
                    companionDetails.push(`Quan hệ: ${companion.relationship}`);
                }
                
                // Power level for tactical coordination
                if (companion.realm) {
                    companionDetails.push(`Cảnh giới: ${companion.realm}`);
                }
                
                // Key skills for party synergy
                if (companion.skills && companion.skills.length > 0) {
                    const skillsArray = Array.isArray(companion.skills) ? companion.skills : companion.skills.split(',').map(s => s.trim());
                    companionDetails.push(`Chuyên môn: ${skillsArray.slice(0, 2).join(', ')}`);
                }
                
                // Active status effects
                const companionStatuses = statuses.filter(s => s.owner === companion.name);
                if (companionStatuses.length > 0) {
                    companionDetails.push(`Trạng thái: ${companionStatuses.map(s => s.name).join(', ')}`);
                }
                
                // Core personality for AI roleplay
                if (companion.personality) {
                    const personalitySnippet = companion.personality.length > 50 
                        ? companion.personality.substring(0, 50) + '...' 
                        : companion.personality;
                    companionDetails.push(`Tính cách: ${personalitySnippet}`);
                }
                
                if (companionDetails.length > 0) {
                    companionInfo += ` - ${companionDetails.join(', ')}`;
                }
                companionInfo += '\n';
                
                const companionTokens = this.estimateTokens(companionInfo);
                if (usedTokens + companionTokens <= maxTokens) {
                    context += companionInfo;
                    usedTokens += companionTokens;
                }
            });
            
            // Party coordination notes
            const coordNote = "\n*Lưu ý: Hãy chú trọng đến sự tương tác và phối hợp giữa các thành viên trong tổ đội. Mỗi đồng hành có cá tính và kỹ năng riêng, hãy thể hiện điều này trong câu chuyện.*\n";
            const noteTokens = this.estimateTokens(coordNote);
            if (usedTokens + noteTokens <= maxTokens) {
                context += coordNote;
            }
        }
        
        return context;
    }

    private buildImportantContext(
        entities: EntityRelevance[],
        gameState: SaveData,
        tokenBudget: number
    ): string {
        let context = "\n=== THÔNG TIN LIÊN QUAN ===\n";
        let usedTokens = this.estimateTokens(context);
        
        // Active quests
        const questContext = this.buildQuestContext(
            gameState.quests.filter(q => q.status === 'active'),
            Math.floor(tokenBudget * 0.3)
        );
        context += questContext;
        usedTokens += this.estimateTokens(questContext);
        
        // Recent history with smart summarization
        const historyContext = this.buildSmartHistoryContext(
            gameState.gameHistory,
            Math.floor(tokenBudget * 0.4)
        );
        context += historyContext;
        usedTokens += this.estimateTokens(historyContext);
        
        // Related entities
        const remainingBudget = tokenBudget - usedTokens;
        const tokensPerEntity = Math.floor(remainingBudget / Math.max(1, entities.length));
        
        entities.forEach(({ entity, reason }) => {
            const entityText = this.formatEntityBrief(entity, reason, tokensPerEntity);
            const entityTokens = this.estimateTokens(entityText);
            
            if (usedTokens + entityTokens <= tokenBudget) {
                context += entityText + "\n";
                usedTokens += entityTokens;
            }
        });
        
        return context;
    }

    // Utility methods
    private estimateTokens(text: string): number {
        return Math.ceil(text.length * TOKEN_CONFIG.CHARS_PER_TOKEN);
    }

    private countRecentMentions(name: string, history: GameHistoryEntry[], lookback: number): number {
        const recentEntries = history.slice(-lookback * 2); // User + model entries
        let count = 0;
        
        recentEntries.forEach(entry => {
            const text = entry.parts[0].text.toLowerCase();
            const regex = new RegExp(`\\b${name.toLowerCase()}\\b`, 'g');
            const matches = text.match(regex);
            count += matches ? matches.length : 0;
        });
        
        return count;
    }

    private getTypeRelevanceScore(type: string, intent: ActionIntent): number {
        const relevanceMatrix: Record<string, Record<string, number>> = {
            'combat': { 'npc': 20, 'item': 15, 'skill': 25, 'companion': 35 }, // Higher for companions in combat
            'social': { 'npc': 30, 'companion': 40, 'faction': 20 }, // Companions excel in social situations
            'item_interaction': { 'item': 30, 'skill': 10, 'companion': 15 }, // Companions may have opinions
            'movement': { 'location': 30, 'npc': 10, 'companion': 25 }, // Companions travel together
            'skill_use': { 'skill': 40, 'item': 10, 'companion': 30 }, // Companions can assist with skills
            'general': { 'npc': 10, 'item': 10, 'location': 10, 'companion': 20 } // Always include companions
        };
        
        return relevanceMatrix[intent.type]?.[type] || 0;
    }

    // NEW: Enhanced skill relevance scoring for companions
    private getCompanionSkillRelevance(skills: string[], action: string, intent: ActionIntent): number {
        let score = 0;
        const actionLower = action.toLowerCase();
        
        // Combat skill relevance
        const combatSkills = ['chiến đấu', 'tấn công', 'phòng thủ', 'kiếm thuật', 'võ thuật', 'magic', 'pháp thuật'];
        if (intent.isCombat && skills.some(skill => 
            combatSkills.some(combat => skill.toLowerCase().includes(combat)))) {
            score += 25;
        }
        
        // Social skill relevance  
        const socialSkills = ['thuyết phục', 'giao tiếp', 'đàm phán', 'lãnh đạo', 'charm'];
        if (intent.isSocial && skills.some(skill => 
            socialSkills.some(social => skill.toLowerCase().includes(social)))) {
            score += 20;
        }
        
        // Direct skill mention in action
        for (const skill of skills) {
            if (actionLower.includes(skill.toLowerCase())) {
                score += 30;
                break;
            }
        }
        
        // Movement and exploration skills
        const explorationSkills = ['do thám', 'stealth', 'survival', 'navigation', 'tracking'];
        if (intent.isMovement && skills.some(skill => 
            explorationSkills.some(explore => skill.toLowerCase().includes(explore)))) {
            score += 15;
        }
        
        return score;
    }

    private extractPotentialTargets(action: string): string[] {
        // Extract quoted strings and proper nouns
        const targets: string[] = [];
        
        // Extract quoted targets
        const quotedMatches = action.match(/"([^"]+)"/g);
        if (quotedMatches) {
            targets.push(...quotedMatches.map(m => m.replace(/"/g, '')));
        }
        
        // Extract capitalized words (potential entity names)
        const words = action.split(/\s+/);
        words.forEach(word => {
            if (word.length > 2 && /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/.test(word)) {
                targets.push(word);
            }
        });
        
        return [...new Set(targets)];
    }

    private extractKeywords(action: string): string[] {
        const stopWords = new Set(['và', 'của', 'là', 'trong', 'với', 'để', 'đến', 'từ']);
        const words = action.toLowerCase().split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
        
        return [...new Set(words)];
    }

    private formatGameTime(time: any, turnCount: number): string {
        return `Thời gian: Năm ${time.year} Tháng ${time.month} Ngày ${time.day}, ${time.hour} giờ (Lượt ${turnCount})`;
    }

    // UPDATED: Aggressive truncation for token control
    private aggressiveTruncation(text: string, maxTokens: number): string {
        const estimatedTokens = this.estimateTokens(text);
        
        if (estimatedTokens <= maxTokens) {
            return text;
        }
        
        // Aggressive character limit
        const charLimit = Math.floor(maxTokens / TOKEN_CONFIG.CHARS_PER_TOKEN * 0.9); // 90% safety margin
        
        if (text.length <= charLimit) {
            return text;
        }
        
        // Priority truncation - keep first and last parts
        const keepStart = Math.floor(charLimit * 0.6);
        const keepEnd = Math.floor(charLimit * 0.3);
        
        if (keepStart + keepEnd < text.length) {
            return text.substring(0, keepStart) + "\n...[nội dung đã được rút gọn]...\n" + text.substring(text.length - keepEnd);
        }
        
        return text.substring(0, charLimit) + '...';
    }

    // ENHANCED: Special handling for party members with detailed context
    private formatEntityWithContext(
        entity: Entity,
        statuses: Status[],
        reasons: string[],
        maxTokens: number
    ): string {
        let text = `• ${entity.name} (${entity.type})`;
        
        const details: string[] = [];
        
        // Enhanced party member context
        if (entity.type === 'companion') {
            text += ` [ĐỒNG HÀNH]`;
            
            // Core personality and motivation for companions
            if (entity.personality) details.push(`Tính cách: ${entity.personality}`);
            if (entity.personalityMbti && MBTI_PERSONALITIES[entity.personalityMbti]) {
                details.push(`MBTI: ${entity.personalityMbti} (${MBTI_PERSONALITIES[entity.personalityMbti].title})`);
            }
            if (entity.motivation) details.push(`Động cơ: ${entity.motivation}`);
            
            // Relationship with PC (critical for party dynamics)
            if (entity.relationship) {
                details.push(`Quan hệ với PC: ${entity.relationship}`);
            }
            
            // Skills and abilities (important for party coordination)
            if (entity.skills?.length) {
                const skillsArray = Array.isArray(entity.skills) ? entity.skills : entity.skills.split(',').map(s => s.trim());
                details.push(`Kỹ năng: ${skillsArray.slice(0, 4).join(', ')}`);
            }
            
            // Power level for tactical decisions
            if (entity.realm) details.push(`Cảnh giới: ${entity.realm}`);
            
        } else if (entity.type === 'npc') {
            // Standard NPC context (reduced for non-party members)
            if (entity.personality) details.push(`Tính cách: ${entity.personality}`);
            if (entity.personalityMbti) details.push(`MBTI: ${entity.personalityMbti}`);
            if (entity.motivation) details.push(`Động cơ: ${entity.motivation}`);
            if (entity.skills?.length) {
                // Handle both string and array formats for skills
                const skillsArray = Array.isArray(entity.skills) ? entity.skills : entity.skills.split(',').map(s => s.trim());
                details.push(`Kỹ năng: ${skillsArray.slice(0, 3).join(', ')}`);
            }
        }
        
        if (entity.location) details.push(`Vị trí: ${entity.location}`);
        if (entity.realm && entity.type !== 'companion') details.push(`Cảnh giới: ${entity.realm}`);
        
        // Enhanced status effects for party members
        const entityStatuses = statuses.filter(s => s.owner === entity.name);
        if (entityStatuses.length > 0) {
            if (entity.type === 'companion') {
                // More detailed status for companions
                details.push(`Trạng thái: ${entityStatuses.map(s => `${s.name} (${s.type})`).slice(0, 3).join(', ')}`);
            } else {
                details.push(`Trạng thái: ${entityStatuses.map(s => s.name).slice(0, 2).join(', ')}`);
            }
        }
        
        // Description with priority for companions
        if (entity.description) {
            const remainingTokens = Math.max(0, maxTokens - this.estimateTokens(text + details.join('; ')));
            const threshold = entity.type === 'companion' ? 50 : 30; // Higher threshold for companions
            
            if (remainingTokens > threshold) {
                const truncatedDesc = this.aggressiveTruncation(entity.description, remainingTokens);
                details.push(`Mô tả: ${truncatedDesc}`);
            }
        }
        
        return text + "\n  " + details.join("\n  ");
    }

    private formatEntityBrief(entity: Entity, reasons: string[], maxTokens: number): string {
        const base = `• ${entity.name} (${entity.type})`;
        const reasonText = reasons.length > 0 ? ` [${reasons[0]}]` : '';
        const description = entity.description ? ` - ${entity.description}` : '';
        
        const fullText = base + reasonText + description;
        return this.aggressiveTruncation(fullText, maxTokens);
    }

    private buildQuestContext(quests: Quest[], maxTokens: number): string {
        if (quests.length === 0) return '';
        
        let context = "**Nhiệm vụ đang hoạt động:**\n";
        let usedTokens = this.estimateTokens(context);
        
        quests.forEach(quest => {
            const activeObjectives = quest.objectives.filter(o => !o.completed);
            const questText = `- ${quest.title}: ${activeObjectives.map(o => o.description).join(', ')}\n`;
            const questTokens = this.estimateTokens(questText);
            
            if (usedTokens + questTokens <= maxTokens) {
                context += questText;
                usedTokens += questTokens;
            }
        });
        
        return context + "\n";
    }

    // UPDATED: More aggressive history context reduction
    private buildSmartHistoryContext(history: GameHistoryEntry[], maxTokens: number): string {
        let context = "**Diễn biến gần đây:**\n";
        let usedTokens = this.estimateTokens(context);
        
        const recentEvents: string[] = [];
        const lookback = Math.min(1, history.length); // Giảm từ 2 xuống 1
        
        for (let i = history.length - lookback; i < history.length; i++) {
            const entry = history[i];
            if (entry.role === 'user') {
                const actionMatch = entry.parts[0].text.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
                if (actionMatch) {
                    // Truncate action nếu quá dài
                    const action = actionMatch[1];
                    const shortAction = action.length > 100 ? action.substring(0, 100) + '...' : action;
                    recentEvents.push(`> ${shortAction}`);
                }
            } else {
                try {
                    const parsed = JSON.parse(entry.parts[0].text);
                    if (parsed.story) {
                        const summary = this.summarizeStory(parsed.story);
                        if (summary) {
                            // Truncate summary
                            const shortSummary = summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
                            recentEvents.push(shortSummary);
                        }
                    }
                } catch (e) {
                    // Skip
                }
            }
        }
        
        // Add events với limit chặt chẽ hơn
        recentEvents.forEach(event => {
            const eventTokens = this.estimateTokens(event + '\n');
            if (usedTokens + eventTokens <= maxTokens * 0.8) { // Chỉ dùng 80% token budget
                context += event + '\n';
                usedTokens += eventTokens;
            }
        });
        
        return context + "\n";
    }

    private summarizeStory(story: string): string {
        // Extract key information from story
        // This is simplified - could use more sophisticated NLP
        const sentences = story.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        // Look for sentences with important keywords
        const importantKeywords = /chiến đấu|giết|chết|nhận được|mất|thành công|thất bại|phát hiện|gặp/;
        const importantSentences = sentences.filter(s => importantKeywords.test(s));
        
        if (importantSentences.length > 0) {
            return importantSentences[0].trim() + '.';
        }
        
        return sentences[0]?.trim() + '.' || '';
    }

    private buildContextualInfo(gameState: SaveData, maxTokens: number): string {
        let context = "\n=== BỐI CẢNH THẾ GIỚI ===\n";
        let usedTokens = this.estimateTokens(context);
        
        // World info - reference only
        if (gameState.worldData.worldName) {
            context += `Thế giới: ${gameState.worldData.worldName}\n\n`;
            usedTokens += this.estimateTokens(context);
        }
        
        // Chronicle (prioritized memories)
        const chronicleTokens = Math.floor((maxTokens - usedTokens) * 0.4);
        const chronicleContext = this.buildChronicleContext(gameState.chronicle, chronicleTokens);
        context += chronicleContext;
        usedTokens += this.estimateTokens(chronicleContext);
        
        // Pinned memories
        const memoryTokens = maxTokens - usedTokens;
        const pinnedMemories = gameState.memories.filter(m => m.pinned);
        
        if (pinnedMemories.length > 0 && memoryTokens > 100) {
            context += "**Ký ức quan trọng:**\n";
            pinnedMemories.slice(0, 1).forEach(mem => { // Reduced to 1 memory only
                const memText = `- ${mem.text}\n`;
                const memTokens = this.estimateTokens(memText);
                
                if (memTokens <= memoryTokens) {
                    context += memText;
                    memoryTokens - memTokens;
                }
            });
        }
        
        return context;
    }

    // UPDATED: Reduced chronicle entries
    private buildChronicleContext(chronicle: any, maxTokens: number): string {
        const memories: ScoredMemory[] = [];
        
        // Aggressive reduction for token savings
        chronicle.memoir.slice(-2).forEach((m: string) => memories.push({ memory: m, score: 100, type: 'memoir' })); // Reduced to 2
        chronicle.chapter.slice(-1).forEach((c: string) => memories.push({ memory: c, score: 70, type: 'chapter' })); // Reduced to 1
        // chronicle.turn removed completely to save tokens
        
        // Sort by score and build context
        memories.sort((a, b) => b.score - a.score);
        
        let context = "**Biên niên sử:**\n";
        let usedTokens = this.estimateTokens(context);
        
        memories.forEach(({ memory, type }) => {
            const prefix = type === 'memoir' ? '[Hồi ký] ' : type === 'chapter' ? '[Chương] ' : '[Lượt] ';
            const memText = `${prefix}${memory}\n`;
            const memTokens = this.estimateTokens(memText);
            
            if (usedTokens + memTokens <= maxTokens) {
                context += memText;
                usedTokens += memTokens;
            }
        });
        
        return context + "\n";
    }

    private buildSupplementalContext(
        gameState: SaveData,
        relevantEntities: EntityRelevance[],
        maxTokens: number
    ): string {
        let context = "";
        let usedTokens = 0;
        
        // Custom rules
        const activeRules = gameState.customRules.filter(r => r.isActive && r.content.trim());
        
        if (activeRules.length > 0) {
            // Find relevant rules based on entities and keywords
            const relevantRules = this.findRelevantRules(activeRules, relevantEntities);
            
            if (relevantRules.length > 0) {
                context += "\n=== LUẬT LỆ TÙY CHỈNH LIÊN QUAN ===\n";
                usedTokens += this.estimateTokens(context);
                
                relevantRules.forEach(rule => {
                    const ruleText = `- ${rule.content}\n`;
                    const ruleTokens = this.estimateTokens(ruleText);
                    
                    if (usedTokens + ruleTokens <= maxTokens) {
                        context += ruleText;
                        usedTokens += ruleTokens;
                    }
                });
            }
        }
        
        return context;
    }

    private findRelevantRules(rules: CustomRule[], entities: EntityRelevance[]): CustomRule[] {
        const entityNames = new Set(entities.map(e => e.entity.name.toLowerCase()));
        
        return rules.filter(rule => {
            const ruleLower = rule.content.toLowerCase();
            
            // Check if rule mentions any relevant entity
            for (const name of entityNames) {
                if (ruleLower.includes(name)) return true;
            }
            
            // Check for general relevance keywords
            const generalKeywords = ['tất cả', 'mọi', 'luôn', 'không được', 'phải'];
            return generalKeywords.some(keyword => ruleLower.includes(keyword));
        });
    }

    private assembleFinalPrompt(
        action: string,
        sections: ContextSections,
        ruleChangeContext: string,
        nsfwContext: string,
        worldData: any,
        intelligentContext?: any
    ): string {
        let prompt = "";
        
        // Rule changes first (highest priority)
        if (ruleChangeContext) {
            prompt += ruleChangeContext + "\n";
        }
        
        // Critical context
        prompt += sections.critical + "\n";
        
        // Phase 4: Intelligent Context (before important context)
        if (intelligentContext && intelligentContext.relevantMemories.length > 0) {
            prompt += EnhancedRAG.formatContextForPrompt(intelligentContext) + "\n";
        }
        
        // Important context
        prompt += sections.important + "\n";
        
        // Contextual information
        prompt += sections.contextual + "\n";
        
        // Supplemental context
        if (sections.supplemental) {
            prompt += sections.supplemental + "\n";
        }
        
        // Player action
        prompt += `\n--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"${action}"`;
        
        // NSFW context if applicable
        if (nsfwContext) {
            prompt += `\n${nsfwContext}`;
        } else if (worldData.allowNsfw) {
            prompt += `\nLƯU Ý: Chế độ NSFW đang BẬT.`;
        }
        
        prompt += `\nYÊU CẦU: Tiếp tục câu chuyện dựa trên hành động và tri thức đã truy xuất.`;
        
        return prompt;
    }

    private truncateWithTokenLimit(text: string, maxTokens: number): string {
        const estimatedTokens = this.estimateTokens(text);
        
        if (estimatedTokens <= maxTokens) {
            return text;
        }
        
        // Calculate character limit based on token limit
        const charLimit = Math.floor(maxTokens / TOKEN_CONFIG.CHARS_PER_TOKEN);
        
        if (text.length <= charLimit) {
            return text;
        }
        
        // Smart truncation - try to break at sentence boundaries
        const truncated = text.substring(0, charLimit);
        const lastPeriod = truncated.lastIndexOf('.');
        const lastComma = truncated.lastIndexOf(',');
        const lastSpace = truncated.lastIndexOf(' ');
        
        let breakPoint = Math.max(lastPeriod, lastComma, lastSpace);
        if (breakPoint < charLimit * 0.8) {
            breakPoint = charLimit;
        }
        
        return text.substring(0, breakPoint) + '...';
    }

    // ADDED: Emergency truncation method
    private emergencyTruncation(prompt: string): string {
        const totalTokens = this.estimateTokens(prompt);
        const hardLimit = 85000; // Emergency limit well under 100k
        
        if (totalTokens <= hardLimit) {
            return prompt;
        }
        
        console.warn(`🚨 EMERGENCY TRUNCATION: ${totalTokens} -> ${hardLimit}`);
        
        // Keep only critical sections
        const lines = prompt.split('\n');
        const criticalMarkers = ['=== TRI THỨC QUAN TRỌNG ===', '--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---'];
        
        let emergencyPrompt = '';
        let inCriticalSection = false;
        
        for (const line of lines) {
            if (criticalMarkers.some(marker => line.includes(marker))) {
                inCriticalSection = true;
            }
            
            if (inCriticalSection) {
                emergencyPrompt += line + '\n';
                
                if (this.estimateTokens(emergencyPrompt) > hardLimit) {
                    break;
                }
            }
        }
        
        return emergencyPrompt;
    }

    // UPDATED: Enhanced token limit enforcement with hard limit
    private enforceTokenLimit(prompt: string): string {
        const totalTokens = this.estimateTokens(prompt);
        const softLimit = TOKEN_CONFIG.MAX_TOKENS_PER_TURN - TOKEN_CONFIG.TOKEN_BUFFER;
        const hardLimit = 85000; // Well under 100k
        
        if (totalTokens <= softLimit) {
            console.log(`✅ Prompt tokens: ${totalTokens}/${softLimit} (Safe)`);
            return prompt;
        }
        
        if (totalTokens <= hardLimit) {
            console.warn(`⚠️ WARNING: Prompt near limit: ${totalTokens}/${hardLimit}`);
            return prompt;
        }
        
        // Emergency truncation with alert
        console.error(`🚨 CRITICAL: Prompt exceeds limit: ${totalTokens}/${hardLimit}. Emergency truncation applied!`);
        alert(`🚨 TOKEN LIMIT EXCEEDED!\nUsed: ${totalTokens}\nLimit: ${hardLimit}\nApplying emergency truncation.`);
        return this.emergencyTruncation(prompt);
    }

    private buildFallbackPrompt(action: string, gameState: SaveData): string {
        // Minimal prompt for error cases
        const pc = gameState.party.find(p => p.type === 'pc');
        const pcName = pc?.name || 'Nhân vật chính';
        
        return `
Nhân vật: ${pcName}
Vị trí: ${pc?.location || 'Không xác định'}
Lượt: ${gameState.turnCount}

--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---
"${action}"

YÊU CẦU: Tiếp tục câu chuyện.`;
    }
}

// Type definitions for the enhanced system
interface ActionIntent {
    type: 'movement' | 'combat' | 'social' | 'item_interaction' | 'skill_use' | 'exploration' | 'general';
    targets: string[];
    keywords: string[];
    isMovement: boolean;
    isCombat: boolean;
    isSocial: boolean;
    isItemUse: boolean;
    isSkillUse: boolean;
    isExploration: boolean;
}

interface TokenBudget {
    critical: number;
    important: number;
    contextual: number;
    supplemental: number;
}

interface ContextSections {
    critical: string;
    important: string;
    contextual: string;
    supplemental: string;
}

// Export singleton instance
export const enhancedRAG = new EnhancedRAGSystem();

// Backward compatibility wrapper
export const buildEnhancedRagPrompt = (
    action: string,
    gameState: SaveData,
    ruleChangeContext = '',
    playerNsfwRequest = ''
): string => {
    return enhancedRAG.buildEnhancedPrompt(
        action,
        gameState,
        ruleChangeContext,
        playerNsfwRequest
    );
};
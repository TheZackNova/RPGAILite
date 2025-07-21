import type { SaveData, Entity, Status, Quest, GameHistoryEntry, CustomRule, KnownEntities } from './types.ts';
import { MBTI_PERSONALITIES } from './data/mbti.ts';

// Enhanced Token Management with Stricter Controls
const TOKEN_CONFIG = {
    MAX_TOKENS_PER_TURN: 75000,  // Giảm từ 70k xuống 75k để có buffer an toàn
    TOKEN_BUFFER: 8000,          // Tăng buffer từ 5k lên 8k
    CHARS_PER_TOKEN: 0.8,        // Tăng từ 0.75 lên 0.8 để ước tính chặt chẽ hơn
    
    // Tái phân bổ để ưu tiên nội dung quan trọng
    ALLOCATION: {
        CRITICAL: 0.45,      // Tăng từ 0.40 - Ưu tiên action context
        IMPORTANT: 0.25,     // Giảm từ 0.30 - Giảm entities liên quan
        CONTEXTUAL: 0.20,    // Giữ nguyên - World context
        SUPPLEMENTAL: 0.10   // Giữ nguyên - Custom rules
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
            // Step 1: Analyze action intent
            const actionIntent = this.analyzeActionIntent(action);
            
            // Step 2: Build entity relationship graph
            this.buildEntityGraph(gameState.knownEntities);
            
            // Step 3: Score and retrieve relevant entities
            const relevantEntities = this.retrieveRelevantEntities(
                action,
                actionIntent,
                gameState
            );
            
            // Step 4: Calculate dynamic token budgets
            const tokenBudget = this.calculateDynamicTokenBudget(
                relevantEntities,
                gameState
            );
            
            // Step 5: Build context sections with priority
            const contextSections = this.buildPrioritizedContext(
                relevantEntities,
                gameState,
                tokenBudget
            );
            
            // Step 6: Assemble final prompt
            const finalPrompt = this.assembleFinalPrompt(
                action,
                contextSections,
                ruleChangeContext,
                playerNsfwRequest,
                gameState.worldData
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
            if (entity.skills) {
                entity.skills.forEach(skill => connections.add(skill));
            }
            
            this.entityGraph.set(name, connections);
        }
    }

    // Enhanced entity retrieval with relevance scoring
    private retrieveRelevantEntities(
        action: string,
        intent: ActionIntent,
        gameState: SaveData
    ): EntityRelevance[] {
        const { knownEntities, party, gameHistory, statuses } = gameState;
        const relevanceScores: EntityRelevance[] = [];
        
        // Always include party members with high relevance
        party.forEach(member => {
            relevanceScores.push({
                entity: member,
                score: 100,
                reason: ['Party member']
            });
        });

        // Score all other entities
        for (const [name, entity] of Object.entries(knownEntities)) {
            if (party.some(p => p.name === name)) continue;
            
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
        gameState: SaveData
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
        
        // Add entities with detailed info
        const tokensPerEntity = Math.floor((tokenBudget - usedTokens) / Math.max(1, entities.length));
        
        entities.forEach(({ entity, score, reason }) => {
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
            'combat': { 'npc': 20, 'item': 15, 'skill': 25, 'companion': 20 },
            'social': { 'npc': 30, 'companion': 25, 'faction': 20 },
            'item_interaction': { 'item': 30, 'skill': 10 },
            'movement': { 'location': 30, 'npc': 10 },
            'skill_use': { 'skill': 40, 'item': 10 },
            'general': { 'npc': 10, 'item': 10, 'location': 10 }
        };
        
        return relevanceMatrix[intent.type]?.[type] || 0;
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

    // UPDATED: Reduced entity details to save tokens
    private formatEntityWithContext(
        entity: Entity,
        statuses: Status[],
        reasons: string[],
        maxTokens: number
    ): string {
        let text = `• ${entity.name} (${entity.type})`;
        
        const details: string[] = [];
        
        // Chỉ giữ thông tin quan trọng nhất
        if (entity.type === 'npc' || entity.type === 'companion') {
            if (entity.personality) details.push(`Tính cách: ${entity.personality}`);
            // Bỏ MBTI description để tiết kiệm token
            if (entity.personalityMbti) details.push(`MBTI: ${entity.personalityMbti}`);
            if (entity.motivation) details.push(`Động cơ: ${entity.motivation}`);
            // Giảm skills từ 5 xuống 3
            if (entity.skills?.length) details.push(`Kỹ năng: ${entity.skills.slice(0, 3).join(', ')}`);
        }
        
        if (entity.location) details.push(`Vị trí: ${entity.location}`);
        if (entity.realm) details.push(`Cảnh giới: ${entity.realm}`);
        
        // Status effects - chỉ tên, không mô tả
        const entityStatuses = statuses.filter(s => s.owner === entity.name);
        if (entityStatuses.length > 0) {
            details.push(`Trạng thái: ${entityStatuses.map(s => s.name).slice(0, 2).join(', ')}`); // Tối đa 2 status
        }
        
        // Mô tả ngắn hơn
        if (entity.description) {
            const remainingTokens = Math.max(0, maxTokens - this.estimateTokens(text + details.join('; ')));
            
            if (remainingTokens > 30) { // Giảm threshold từ 50 xuống 30
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
        
        // World info
        if (gameState.worldData.worldDetail) {
            const worldTokens = Math.floor(maxTokens * 0.3);
            const worldInfo = this.aggressiveTruncation(gameState.worldData.worldDetail, worldTokens);
            context += `Thế giới: ${worldInfo}\n\n`;
            usedTokens += this.estimateTokens(worldInfo);
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
            pinnedMemories.slice(0, 3).forEach(mem => { // Giảm từ 5 xuống 3
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
        
        // Giảm số lượng entries để tiết kiệm token
        chronicle.memoir.slice(-5).forEach((m: string) => memories.push({ memory: m, score: 100, type: 'memoir' })); // Giảm từ 7 xuống 5
        chronicle.chapter.slice(-2).forEach((c: string) => memories.push({ memory: c, score: 70, type: 'chapter' })); // Giảm từ 3 xuống 2
        chronicle.turn.slice(-1).forEach((t: string) => memories.push({ memory: t, score: 40, type: 'turn' })); // Giảm từ 2 xuống 1
        
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
        worldData: any
    ): string {
        let prompt = "";
        
        // Rule changes first (highest priority)
        if (ruleChangeContext) {
            prompt += ruleChangeContext + "\n";
        }
        
        // Critical context
        prompt += sections.critical + "\n";
        
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
        const hardLimit = 78000; // Emergency limit dưới 80k
        
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
        const hardLimit = 78000; // Dưới 80k
        
        if (totalTokens <= softLimit) {
            console.log(`✅ Prompt tokens: ${totalTokens}/${softLimit} (Safe)`);
            return prompt;
        }
        
        if (totalTokens <= hardLimit) {
            console.warn(`⚠️ Prompt near limit: ${totalTokens}/${hardLimit}`);
            return prompt;
        }
        
        // Emergency truncation
        console.error(`🚨 Prompt exceeds hard limit: ${totalTokens}/${hardLimit}. Emergency truncation!`);
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
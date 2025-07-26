# Unified Memory System Integration Plan

## Current System Analysis

### Memory Optimizer Issues

#### 1. **Basic Memory Management**
```typescript
export interface Memory {
    text: string;
    pinned: boolean;
}
```
**Problems:**
- No metadata (creation time, importance score, source type)
- Binary pinned/unpinned logic is too simplistic
- No semantic understanding of content value
- No connection to game events or story significance

#### 2. **Cleanup Logic Flaws**
```typescript
const recentUnpinned = unpinned.slice(-config.maxUnpinnedMemories);
const tokensSaved = removed * 50; // Arbitrary token estimation
```
**Issues:**
- FIFO approach ignores content importance
- Fixed token estimates don't reflect actual content
- No consideration for memory relationships or clustering

#### 3. **Entity Inactivity Detection**
```typescript
if (text.includes(entityName.toLowerCase())) {
    mentionCounts[entityName] = (mentionCounts[entityName] || 0) + 1;
}
```
**Problems:**
- Case-sensitive issues with Vietnamese text
- No context awareness (mentions in different roles)
- Doesn't distinguish between important vs casual mentions

## Integration Strategy

### Phase 1: Unified Importance Scoring System

#### 1.1 Enhanced Memory Interface
```typescript
interface EnhancedMemory {
    text: string;
    createdAt: number;           // Turn number when created
    lastAccessed: number;        // Turn number when last referenced
    source: 'chronicle' | 'manual' | 'auto_generated';
    category: 'combat' | 'social' | 'discovery' | 'story' | 'relationship';
    importance: number;          // 0-100 dynamic score
    relatedEntities: string[];   // Connected entity names
    pinned: boolean;
    tags: string[];             // User or AI generated tags
    emotionalWeight: number;    // Story significance (-10 to 10)
}
```

#### 1.2 Importance Scoring Algorithm
```typescript
class ImportanceScorer {
    static calculateMemoryScore(memory: EnhancedMemory, gameState: SaveData): number {
        let score = 0;
        
        // Base importance by source
        if (memory.source === 'chronicle') score += 30;
        if (memory.pinned) score += 50;
        
        // Recency bonus (decays over time)
        const turnsSinceCreated = gameState.turnCount - memory.createdAt;
        score += Math.max(0, 20 - (turnsSinceCreated * 0.5));
        
        // Access frequency bonus
        const turnsSinceAccess = gameState.turnCount - memory.lastAccessed;
        score += Math.max(0, 15 - (turnsSinceAccess * 0.3));
        
        // Entity relevance (active characters boost score)
        memory.relatedEntities.forEach(entityName => {
            const entity = gameState.knownEntities[entityName];
            if (entity?.type === 'companion') score += 10;
            if (entity?.type === 'pc') score += 5;
            if (entity?.owner === 'pc') score += 5;
        });
        
        // Emotional weight bonus
        score += Math.abs(memory.emotionalWeight) * 2;
        
        // Category importance
        if (memory.category === 'story') score += 15;
        if (memory.category === 'relationship') score += 10;
        
        return Math.min(100, Math.max(0, score));
    }
}
```

### Phase 2: Coordinated Cleanup System

#### 2.1 Unified Content Analyzer
```typescript
class ContentAnalyzer {
    // Shared between HistoryManager and GameStateOptimizer
    static analyzeGameHistory(history: GameHistoryEntry[], entities: KnownEntities): AnalysisResult {
        const entityMentions = new Map<string, EntityMentionInfo>();
        const importantEvents: ExtractedEvent[] = [];
        const keyActions: ExtractedAction[] = [];
        
        history.forEach((entry, index) => {
            if (entry.role === 'user') {
                const action = this.extractPlayerAction(entry);
                if (action && this.isImportantAction(action.text)) {
                    keyActions.push({
                        ...action,
                        turnIndex: Math.floor(index / 2),
                        relatedEntities: this.findRelatedEntities(action.text, entities)
                    });
                }
            } else if (entry.role === 'model') {
                const events = this.extractStoryEvents(entry);
                importantEvents.push(...events.map(event => ({
                    ...event,
                    turnIndex: Math.floor(index / 2),
                    relatedEntities: this.findRelatedEntities(event.text, entities)
                })));
            }
            
            // Track entity mentions with context
            this.analyzeEntityMentions(entry, entities, entityMentions);
        });
        
        return { entityMentions, importantEvents, keyActions };
    }
    
    static analyzeEntityMentions(entry: GameHistoryEntry, entities: KnownEntities, mentions: Map<string, EntityMentionInfo>) {
        const text = entry.parts[0]?.text?.toLowerCase() || '';
        
        Object.entries(entities).forEach(([name, entity]) => {
            const patterns = [
                name.toLowerCase(),
                ...this.generateNameVariations(name),
                ...(entity.skills || []).map(s => s.toLowerCase())
            ];
            
            patterns.forEach(pattern => {
                if (text.includes(pattern)) {
                    const mention = mentions.get(name) || {
                        name,
                        totalMentions: 0,
                        recentMentions: 0,
                        contexts: [],
                        lastMentionTurn: 0,
                        importanceScore: 0
                    };
                    
                    mention.totalMentions++;
                    mention.recentMentions++;
                    mention.contexts.push({
                        role: entry.role,
                        context: this.extractContext(text, pattern),
                        emotional: this.detectEmotionalContext(text, pattern)
                    });
                    
                    mentions.set(name, mention);
                }
            });
        });
    }
}
```

#### 2.2 Coordinated Cleanup Pipeline
```typescript
class UnifiedCleanupSystem {
    static performCoordinatedCleanup(gameState: SaveData, config: UnifiedConfig): CleanupResult {
        // Phase 1: Analyze content importance across all systems
        const analysis = ContentAnalyzer.analyzeGameHistory(gameState.gameHistory, gameState.knownEntities);
        const memoryScores = gameState.memories.map(memory => ({
            memory,
            score: ImportanceScorer.calculateMemoryScore(memory, gameState)
        }));
        
        // Phase 2: Create unified importance ranking
        const priorityMatrix = this.createPriorityMatrix(analysis, memoryScores, gameState);
        
        // Phase 3: Coordinate cleanup decisions
        const cleanupPlan = this.generateCleanupPlan(priorityMatrix, config);
        
        // Phase 4: Execute cleanup in optimal order
        return this.executeCleanupPlan(gameState, cleanupPlan);
    }
    
    private static createPriorityMatrix(analysis: AnalysisResult, memoryScores: MemoryScore[], gameState: SaveData): PriorityMatrix {
        // Cross-reference importance across:
        // - History events
        // - Memory content  
        // - Entity relevance
        // - Chronicle entries
        // - Quest connections
        
        return {
            highPriority: [], // Must keep
            mediumPriority: [], // Keep if space allows
            lowPriority: [], // First to remove
            protected: [] // Never remove (PC, companions, owned items)
        };
    }
}
```

### Phase 3: Smart Memory Creation

#### 3.1 Automatic Memory Generation
```typescript
class SmartMemoryGenerator {
    static generateMemoryFromChronicle(chronicleEntry: string, gameState: SaveData): EnhancedMemory | null {
        const importance = this.assessChronicleImportance(chronicleEntry, gameState);
        
        if (importance < 30) return null; // Skip low-importance content
        
        const relatedEntities = ContentAnalyzer.findRelatedEntities(chronicleEntry, gameState.knownEntities);
        const category = this.categorizeContent(chronicleEntry);
        const emotionalWeight = this.analyzeEmotionalContent(chronicleEntry);
        
        return {
            text: chronicleEntry,
            createdAt: gameState.turnCount,
            lastAccessed: gameState.turnCount,
            source: 'chronicle',
            category,
            importance,
            relatedEntities,
            pinned: importance > 80, // Auto-pin very important memories
            tags: this.generateTags(chronicleEntry, relatedEntities),
            emotionalWeight
        };
    }
    
    static assessChronicleImportance(text: string, gameState: SaveData): number {
        let score = 50; // Base score
        
        // Check for important keywords
        const importantPatterns = [
            /chết|tử vong|hi sinh/gi, // Death events (+30)
            /yêu|cưới|kết hôn/gi, // Relationship events (+25)
            /chiến thắng|đánh bại|thắng lợi/gi, // Victory (+20)
            /học được|nâng cấp|tiến bộ/gi, // Progression (+15)
            /gặp gỡ|kết bạn|đồng minh/gi, // Social (+10)
        ];
        
        // Check entity involvement
        const mentionedEntities = ContentAnalyzer.findRelatedEntities(text, gameState.knownEntities);
        mentionedEntities.forEach(entityName => {
            const entity = gameState.knownEntities[entityName];
            if (entity?.type === 'companion') score += 15;
            if (entity?.type === 'pc') score += 10;
        });
        
        return Math.min(100, score);
    }
}
```

### Phase 4: Performance Optimization

#### 4.1 Background Processing
```typescript
class BackgroundProcessor {
    private static worker: Worker | null = null;
    
    static initializeWorker() {
        this.worker = new Worker(new URL('./cleanup-worker.ts', import.meta.url));
        this.worker.onmessage = this.handleWorkerMessage;
    }
    
    static scheduleCleanup(gameState: SaveData, priority: 'low' | 'normal' | 'high') {
        if (!this.worker) this.initializeWorker();
        
        this.worker.postMessage({
            type: 'SCHEDULE_CLEANUP',
            payload: { gameState, priority },
            timestamp: Date.now()
        });
    }
    
    private static handleWorkerMessage(event: MessageEvent) {
        const { type, payload } = event.data;
        
        switch (type) {
            case 'CLEANUP_COMPLETE':
                // Apply cleanup results to main thread
                GameStateManager.applyCleanupResults(payload.cleanupResult);
                break;
            case 'ANALYSIS_COMPLETE':
                // Update importance scores
                ImportanceScorer.updateScores(payload.analysis);
                break;
        }
    }
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Implement EnhancedMemory interface
- [ ] Create ImportanceScorer class
- [ ] Update Memory-related components

### Week 2: Content Analysis
- [ ] Implement ContentAnalyzer
- [ ] Enhance entity mention detection
- [ ] Add Vietnamese language patterns

### Week 3: Unified Cleanup
- [ ] Create UnifiedCleanupSystem
- [ ] Integrate with existing HistoryManager
- [ ] Update GameStateOptimizer

### Week 4: Smart Features
- [ ] Implement SmartMemoryGenerator
- [ ] Add background processing
- [ ] Performance optimization

### Week 5: Integration & Testing
- [ ] Integrate all systems
- [ ] Add user controls
- [ ] Performance testing

## Expected Benefits

1. **Better Content Preservation**: Important memories and entities preserved based on actual relevance
2. **Reduced Token Waste**: Smart cleanup removes truly unimportant content
3. **Improved AI Context**: Better content means better AI responses
4. **User Experience**: Less disruption from overly aggressive cleanup
5. **Performance**: Background processing and smarter algorithms
6. **Scalability**: System adapts to different play styles and content volumes

## Configuration Options

```typescript
interface UnifiedConfig {
    // Memory management
    memoryImportanceThreshold: number; // 0-100, below this gets cleaned
    maxMemoriesPerCategory: number;
    autoGenerateFromChronicle: boolean;
    
    // History compression
    historyCompressionThreshold: number;
    preserveImportantActionsCount: number;
    
    // Entity management
    entityInactivityGracePeriod: number; // Turns before considering inactive
    protectedEntityTypes: string[];
    
    // Performance
    backgroundProcessing: boolean;
    cleanupFrequency: 'conservative' | 'normal' | 'aggressive';
}
```

This unified system will make both the memory optimizer and history compression work intelligently together, preserving what matters most while efficiently managing memory and performance.
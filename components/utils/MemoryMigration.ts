import type { Memory, SaveData } from '../types';
import { MemoryEnhancer } from './MemoryEnhancer';
import { ImportanceScorer } from './ImportanceScorer';

export class MemoryMigration {
    
    /**
     * Check if memories need migration to enhanced format
     */
    static needsMigration(memories: Memory[]): boolean {
        return memories.some(memory => 
            memory.createdAt === undefined || 
            memory.importance === undefined ||
            memory.category === undefined
        );
    }
    
    /**
     * Migrate legacy memories to enhanced format
     */
    static migrateMemories(memories: Memory[], gameState: SaveData): Memory[] {
        return memories.map((memory, index) => {
            // Skip if already enhanced
            if (memory.createdAt !== undefined && 
                memory.importance !== undefined && 
                memory.category !== undefined) {
                return memory;
            }
            
            // Create enhanced version of legacy memory
            const legacyMemory: Memory = {
                ...memory,
                // Estimate creation time based on position (older memories = lower turn count)
                createdAt: memory.createdAt || Math.max(1, gameState.turnCount - (memories.length - index - 1)),
                lastAccessed: memory.lastAccessed || gameState.turnCount,
                source: memory.source || this.guessSource(memory.text),
            };
            
            const result = MemoryEnhancer.enhanceMemory(legacyMemory, gameState);
            
            console.log(`📦 Migrated memory: "${memory.text.substring(0, 50)}..." -> Score: ${result.enhanced.importance}/100, Category: ${result.enhanced.category}`);
            
            return result.enhanced;
        });
    }
    
    /**
     * Guess the source of a legacy memory based on content patterns
     */
    private static guessSource(text: string): 'chronicle' | 'manual' | 'auto_generated' {
        // Chronicle patterns
        if (text.startsWith('⭐') || text.includes('Biên niên sử') || text.includes('Chronicle')) {
            return 'chronicle';
        }
        
        // Manual patterns (usually shorter, personal notes)
        if (text.length < 100 && !text.includes('Tại ') && !text.includes('Sau khi')) {
            return 'manual';
        }
        
        // Auto-generated patterns (usually longer, descriptive)
        if (text.includes('tự động') || text.includes('hệ thống') || text.length > 200) {
            return 'auto_generated';
        }
        
        // Default to manual for uncertain cases
        return 'manual';
    }
    
    /**
     * Clean up duplicate memories after migration
     */
    static deduplicateMemories(memories: Memory[]): Memory[] {
        const seen = new Set<string>();
        const deduplicated: Memory[] = [];
        
        // Keep higher importance memories when duplicates are found
        const sortedByImportance = [...memories].sort((a, b) => (b.importance || 0) - (a.importance || 0));
        
        for (const memory of sortedByImportance) {
            const normalizedText = memory.text.toLowerCase().trim();
            
            if (!seen.has(normalizedText)) {
                seen.add(normalizedText);
                deduplicated.push(memory);
            }
        }
        
        // Restore original order for deduplicated memories
        return deduplicated.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }
    
    /**
     * Generate migration report
     */
    static generateMigrationReport(originalMemories: Memory[], migratedMemories: Memory[]): {
        totalMigrated: number;
        categoriesFound: { [category: string]: number };
        sourcesDetected: { [source: string]: number };
        averageImportanceScore: number;
        highImportanceCount: number;
        duplicatesRemoved: number;
    } {
        const categoriesFound: { [category: string]: number } = {};
        const sourcesDetected: { [source: string]: number } = {};
        let totalImportance = 0;
        let highImportanceCount = 0;
        
        migratedMemories.forEach(memory => {
            if (memory.category) {
                categoriesFound[memory.category] = (categoriesFound[memory.category] || 0) + 1;
            }
            
            if (memory.source) {
                sourcesDetected[memory.source] = (sourcesDetected[memory.source] || 0) + 1;
            }
            
            if (memory.importance) {
                totalImportance += memory.importance;
                if (memory.importance >= 70) {
                    highImportanceCount++;
                }
            }
        });
        
        return {
            totalMigrated: migratedMemories.length,
            categoriesFound,
            sourcesDetected,
            averageImportanceScore: migratedMemories.length > 0 ? totalImportance / migratedMemories.length : 0,
            highImportanceCount,
            duplicatesRemoved: originalMemories.length - migratedMemories.length
        };
    }
    
    /**
     * Auto-migrate memories on game state load
     */
    static autoMigrateOnLoad(gameState: SaveData): SaveData {
        if (!this.needsMigration(gameState.memories)) {
            return gameState;
        }
        
        console.log('🔄 Auto-migrating memories to enhanced format...');
        
        const migratedMemories = this.migrateMemories(gameState.memories, gameState);
        const deduplicatedMemories = this.deduplicateMemories(migratedMemories);
        const report = this.generateMigrationReport(gameState.memories, deduplicatedMemories);
        
        console.log('✅ Memory migration completed:', report);
        
        return {
            ...gameState,
            memories: deduplicatedMemories
        };
    }
    
    /**
     * Batch update importance scores for all memories
     */
    static recalculateAllImportanceScores(memories: Memory[], gameState: SaveData): Memory[] {
        console.log('🔄 Recalculating importance scores for all memories...');
        
        return memories.map(memory => {
            const analysis = ImportanceScorer.calculateMemoryScore(memory, gameState);
            return {
                ...memory,
                importance: analysis.score,
                lastAccessed: gameState.turnCount // Update access time
            };
        });
    }
}
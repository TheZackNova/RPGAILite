import type { Entity, KnownEntities, SaveData } from '../types';

export interface ExportConfig {
    enabled: boolean;
    exportInterval: number; // turns between exports (5-10)
    maxFileSize: number; // bytes
    exportPath: string;
    enableDebugLogging: boolean;
    // Import settings
    importEnabled: boolean;
    autoMergeOnImport: boolean;
    backupBeforeImport: boolean;
}

export interface ExportMetadata {
    lastExportTurn: number;
    totalExports: number;
    totalImports: number;
    exportHistory: {
        turn: number;
        timestamp: string;
        entitiesExported: number;
        filesCreated: string[];
    }[];
    importHistory: {
        timestamp: string;
        fileName: string;
        entitiesImported: number;
        conflicts: number;
        success: boolean;
    }[];
}

export interface ImportResult {
    success: boolean;
    entitiesImported: number;
    entitiesSkipped: number;
    conflicts: Array<{
        entityName: string;
        reason: string;
        action: 'merged' | 'skipped' | 'replaced';
    }>;
    error?: string;
}

export interface CategorizedEntities {
    characters: { [key: string]: Entity };
    locations: { [key: string]: Entity };
    items: { [key: string]: Entity };
    factions: { [key: string]: Entity };
    concepts: { [key: string]: Entity };
    skills: { [key: string]: Entity };
    statusEffects: { [key: string]: Entity };
}

export class EntityExportManager {
    private static readonly DEFAULT_CONFIG: ExportConfig = {
        enabled: true,
        exportInterval: 7, // every 7 turns
        maxFileSize: 1024 * 1024, // 1MB
        exportPath: '/data/game-exports/',
        enableDebugLogging: true,
        // Import settings
        importEnabled: true,
        autoMergeOnImport: true,
        backupBeforeImport: true
    };

    private static config: ExportConfig = this.DEFAULT_CONFIG;
    private static metadata: ExportMetadata = {
        lastExportTurn: 0,
        totalExports: 0,
        totalImports: 0,
        exportHistory: [],
        importHistory: []
    };

    /**
     * Configure export settings
     */
    public static configure(newConfig: Partial<ExportConfig>): void {
        this.config = { ...this.config, ...newConfig };
        this.debugLog('🔧 EntityExportManager configured:', this.config);
    }

    /**
     * Check if export should be triggered
     */
    public static shouldExport(currentTurn: number): boolean {
        if (!this.config.enabled) {
            this.debugLog('❌ Export disabled in config');
            return false;
        }

        const turnsSinceLastExport = currentTurn - this.metadata.lastExportTurn;
        const shouldExport = turnsSinceLastExport >= this.config.exportInterval;
        
        this.debugLog(`🔍 Turn ${currentTurn}: ${turnsSinceLastExport} turns since last export (interval: ${this.config.exportInterval})`);
        this.debugLog(`📊 Should export: ${shouldExport}`);
        
        return shouldExport;
    }

    /**
     * Main export function - processes entities and creates files
     */
    public static async exportEntities(gameState: SaveData): Promise<boolean> {
        try {
            const timestamp = new Date().toISOString();
            this.debugLog(`🚀 [${timestamp}] Starting entity export for turn ${gameState.turnCount}`);

            // Categorize entities by type
            const categorized = this.categorizeEntities(gameState.knownEntities);
            this.debugLog('📋 Entity categorization complete:', {
                characters: Object.keys(categorized.characters).length,
                locations: Object.keys(categorized.locations).length,
                items: Object.keys(categorized.items).length,
                factions: Object.keys(categorized.factions).length,
                concepts: Object.keys(categorized.concepts).length,
                skills: Object.keys(categorized.skills).length,
                statusEffects: Object.keys(categorized.statusEffects).length
            });

            // Convert to Vietnamese format
            const vietnameseEntities = this.convertToVietnameseFormat(categorized);
            
            // Create export files
            const filesCreated = await this.createExportFiles(vietnameseEntities, gameState);
            
            // Update metadata
            this.updateMetadata(gameState.turnCount, filesCreated, Object.keys(gameState.knownEntities).length);
            
            this.debugLog(`✅ Export completed successfully. Files created: ${filesCreated.join(', ')}`);
            return true;

        } catch (error) {
            console.error('🚨 EntityExportManager: Export failed:', error);
            this.debugLog(`❌ Export failed: ${error}`);
            return false;
        }
    }

    /**
     * Categorize entities by type
     */
    private static categorizeEntities(knownEntities: KnownEntities): CategorizedEntities {
        const categories: CategorizedEntities = {
            characters: {},
            locations: {},
            items: {},
            factions: {},
            concepts: {},
            skills: {},
            statusEffects: {}
        };

        for (const [name, entity] of Object.entries(knownEntities)) {
            // Skip archived entities
            if (entity.archived) {
                this.debugLog(`⏭️ Skipping archived entity: ${name}`);
                continue;
            }

            switch (entity.type) {
                case 'pc':
                case 'npc':
                case 'companion':
                    categories.characters[name] = entity;
                    break;
                case 'location':
                    categories.locations[name] = entity;
                    break;
                case 'item':
                    categories.items[name] = entity;
                    break;
                case 'faction':
                    categories.factions[name] = entity;
                    break;
                case 'skill':
                    categories.skills[name] = entity;
                    break;
                case 'status_effect':
                    categories.statusEffects[name] = entity;
                    break;
                case 'concept':
                default:
                    categories.concepts[name] = entity;
                    break;
            }
        }

        return categories;
    }

    /**
     * Convert entities to Vietnamese format with Hán Việt names
     */
    private static convertToVietnameseFormat(categories: CategorizedEntities): CategorizedEntities {
        const converted: CategorizedEntities = {
            characters: {},
            locations: {},
            items: {},
            factions: {},
            concepts: {},
            skills: {},
            statusEffects: {}
        };

        // Convert each category
        for (const [categoryName, entities] of Object.entries(categories)) {
            for (const [name, entity] of Object.entries(entities)) {
                const convertedEntity = {
                    ...entity,
                    originalName: entity.name,
                    hanVietName: this.generateHanVietName(entity.name, entity.type),
                    exportedAt: Date.now(),
                    exportTurn: this.metadata.lastExportTurn + 1
                };

                // Clean up sensitive or unnecessary data for export
                delete convertedEntity.lastMentioned;
                delete convertedEntity.archivedAt;

                (converted as any)[categoryName][name] = convertedEntity;
            }
        }

        return converted;
    }

    /**
     * Generate Hán Việt (Chinese-Vietnamese) names
     */
    private static generateHanVietName(name: string, type: string): string {
        // This is a simplified implementation
        // In a real system, you'd want a more sophisticated translation system
        const hanVietMap: { [key: string]: string } = {
            // Characters
            'Naruto': 'Minh Nhân',
            'Sasuke': 'Tá Trợ', 
            'Sakura': 'Tiểu Anh',
            'Kakashi': 'Kỳ Mộc',
            
            // Locations
            'Konoha': 'Mộc Diệp',
            'Hidden Leaf Village': 'Mộc Diệp Ẩn Thôn',
            
            // Common terms
            'Academy': 'Học Viện',
            'Forest': 'Rừng',
            'Mountain': 'Sơn',
            'Village': 'Thôn',
            'City': 'Thành',
            'Temple': 'Tự',
            'Palace': 'Cung'
        };

        // Try direct mapping first
        if (hanVietMap[name]) {
            return hanVietMap[name];
        }

        // Fallback: add type prefix
        const typePrefixes: { [key: string]: string } = {
            'pc': 'Chủ Nhân',
            'npc': 'Nhân Vật',
            'companion': 'Đồng Hành',
            'location': 'Địa Điểm',
            'item': 'Vật Phẩm',
            'skill': 'Kỹ Năng',
            'faction': 'Thế Lực'
        };

        const prefix = typePrefixes[type] || 'Thực Thể';
        return `${prefix} ${name}`;
    }

    /**
     * Create export files using browser file system
     */
    private static async createExportFiles(entities: CategorizedEntities, gameState: SaveData): Promise<string[]> {
        const filesCreated: string[] = [];
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const characterName = gameState.worldData?.characterName || 'Unknown';

        try {
            // Create individual category files
            for (const [categoryName, categoryEntities] of Object.entries(entities)) {
                if (Object.keys(categoryEntities).length === 0) {
                    this.debugLog(`⏭️ Skipping empty category: ${categoryName}`);
                    continue;
                }

                const fileName = `${characterName}_${categoryName}_turn${gameState.turnCount}_${timestamp}.json`;
                const fileContent = JSON.stringify({
                    metadata: {
                        exportedAt: timestamp,
                        turn: gameState.turnCount,
                        category: categoryName,
                        entityCount: Object.keys(categoryEntities).length,
                        characterName: characterName
                    },
                    entities: categoryEntities
                }, null, 2);

                // Create and download file
                await this.downloadFile(fileName, fileContent);
                filesCreated.push(fileName);
                
                this.debugLog(`📄 Created file: ${fileName} (${Object.keys(categoryEntities).length} entities)`);
            }

            // Create combined metadata file
            const metadataFileName = `${characterName}_export_metadata_turn${gameState.turnCount}_${timestamp}.json`;
            const metadataContent = JSON.stringify({
                ...this.metadata,
                currentTurn: gameState.turnCount,
                totalEntities: Object.keys(gameState.knownEntities).length,
                exportedAt: timestamp
            }, null, 2);
            
            await this.downloadFile(metadataFileName, metadataContent);
            filesCreated.push(metadataFileName);

            return filesCreated;

        } catch (error) {
            console.error('🚨 Error creating export files:', error);
            throw error;
        }
    }

    /**
     * Download file using browser API
     */
    private static async downloadFile(fileName: string, content: string): Promise<void> {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Small delay to ensure file is processed
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * Update export metadata
     */
    private static updateMetadata(currentTurn: number, filesCreated: string[], entitiesCount: number): void {
        this.metadata.lastExportTurn = currentTurn;
        this.metadata.totalExports++;
        this.metadata.exportHistory.push({
            turn: currentTurn,
            timestamp: new Date().toISOString(),
            entitiesExported: entitiesCount,
            filesCreated: filesCreated
        });

        // Keep only last 10 export records
        if (this.metadata.exportHistory.length > 10) {
            this.metadata.exportHistory = this.metadata.exportHistory.slice(-10);
        }

        this.debugLog('📊 Metadata updated:', this.metadata);
    }

    /**
     * Get current export status
     */
    public static getExportStatus(): {
        config: ExportConfig;
        metadata: ExportMetadata;
        nextExportTurn: number;
    } {
        return {
            config: this.config,
            metadata: this.metadata,
            nextExportTurn: this.metadata.lastExportTurn + this.config.exportInterval
        };
    }

    /**
     * Force immediate export
     */
    public static async forceExport(gameState: SaveData): Promise<boolean> {
        this.debugLog('🔄 Force export triggered');
        return await this.exportEntities(gameState);
    }

    /**
     * Import entities from exported JSON file
     */
    public static async importEntities(file: File, gameState: SaveData): Promise<ImportResult> {
        if (!this.config.importEnabled) {
            return {
                success: false,
                entitiesImported: 0,
                entitiesSkipped: 0,
                conflicts: [],
                error: 'Import is disabled in configuration'
            };
        }

        this.debugLog(`📥 Starting import from file: ${file.name}`);

        try {
            // Read and parse file
            const fileContent = await this.readFileContent(file);
            const importData = JSON.parse(fileContent);
            
            // Validate file format
            if (!this.validateImportData(importData)) {
                return {
                    success: false,
                    entitiesImported: 0,
                    entitiesSkipped: 0,
                    conflicts: [],
                    error: 'Invalid file format - not a valid entity export file'
                };
            }

            // Create backup if enabled
            if (this.config.backupBeforeImport) {
                await this.createBackup(gameState);
            }

            // Process import
            const result = await this.processImport(importData, gameState);
            
            // Update metadata
            this.updateImportMetadata(file.name, result);
            
            this.debugLog(`✅ Import completed. Entities imported: ${result.entitiesImported}, Conflicts: ${result.conflicts.length}`);
            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugLog(`❌ Import failed: ${errorMessage}`);
            return {
                success: false,
                entitiesImported: 0,
                entitiesSkipped: 0,
                conflicts: [],
                error: errorMessage
            };
        }
    }

    /**
     * Import multiple files at once
     */
    public static async importMultipleFiles(files: FileList, gameState: SaveData): Promise<ImportResult[]> {
        const results: ImportResult[] = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith('.json')) {
                const result = await this.importEntities(file, gameState);
                results.push(result);
            } else {
                results.push({
                    success: false,
                    entitiesImported: 0,
                    entitiesSkipped: 0,
                    conflicts: [],
                    error: `File ${file.name} is not a JSON file`
                });
            }
        }
        
        return results;
    }

    /**
     * Read file content as text
     */
    private static async readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Validate imported data structure
     */
    private static validateImportData(data: any): boolean {
        // Check if it has metadata and entities structure
        if (!data || typeof data !== 'object') return false;
        if (!data.metadata || !data.entities) return false;
        if (typeof data.metadata !== 'object' || typeof data.entities !== 'object') return false;
        
        // Check metadata fields
        const metadata = data.metadata;
        if (!metadata.category || typeof metadata.category !== 'string') return false;
        if (!metadata.entityCount || typeof metadata.entityCount !== 'number') return false;
        
        return true;
    }

    /**
     * Process the actual import and merging
     */
    private static async processImport(importData: any, gameState: SaveData): Promise<ImportResult> {
        const result: ImportResult = {
            success: true,
            entitiesImported: 0,
            entitiesSkipped: 0,
            conflicts: []
        };

        const importedEntities = importData.entities;
        const category = importData.metadata.category;
        
        this.debugLog(`📋 Processing ${Object.keys(importedEntities).length} entities from category: ${category}`);

        for (const [entityName, entityData] of Object.entries(importedEntities)) {
            try {
                const importResult = await this.importSingleEntity(entityName, entityData as Entity, gameState);
                
                if (importResult.action === 'merged' || importResult.action === 'replaced') {
                    result.entitiesImported++;
                } else {
                    result.entitiesSkipped++;
                }
                
                if (importResult.conflict) {
                    result.conflicts.push({
                        entityName,
                        reason: importResult.reason || 'Unknown conflict',
                        action: importResult.action
                    });
                }
                
            } catch (error) {
                result.entitiesSkipped++;
                result.conflicts.push({
                    entityName,
                    reason: `Import error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    action: 'skipped'
                });
            }
        }

        return result;
    }

    /**
     * Import a single entity with conflict resolution
     */
    private static async importSingleEntity(
        entityName: string, 
        entityData: Entity, 
        gameState: SaveData
    ): Promise<{
        action: 'merged' | 'skipped' | 'replaced';
        conflict: boolean;
        reason?: string;
    }> {
        const existingEntity = gameState.knownEntities[entityName];
        
        // If entity doesn't exist, add it directly
        if (!existingEntity) {
            // Clean up import-specific fields
            const cleanEntity = { ...entityData };
            delete (cleanEntity as any).exportedAt;
            delete (cleanEntity as any).exportTurn;
            delete (cleanEntity as any).hanVietName;
            delete (cleanEntity as any).originalName;
            
            gameState.knownEntities[entityName] = cleanEntity;
            this.debugLog(`➕ Added new entity: ${entityName}`);
            return { action: 'replaced', conflict: false };
        }

        // Entity exists - check for conflicts
        if (this.config.autoMergeOnImport) {
            // Merge strategy: keep existing important fields, update description and other details
            const mergedEntity = this.mergeEntities(existingEntity, entityData);
            gameState.knownEntities[entityName] = mergedEntity;
            this.debugLog(`🔄 Merged entity: ${entityName}`);
            return { 
                action: 'merged', 
                conflict: true, 
                reason: 'Entity existed and was merged with imported data' 
            };
        } else {
            // Skip conflicts if auto-merge is disabled
            this.debugLog(`⏭️ Skipped conflicting entity: ${entityName}`);
            return { 
                action: 'skipped', 
                conflict: true, 
                reason: 'Entity already exists and auto-merge is disabled' 
            };
        }
    }

    /**
     * Merge existing entity with imported data
     */
    private static mergeEntities(existing: Entity, imported: Entity): Entity {
        // Keep existing critical fields, update with imported data
        const merged = {
            ...imported, // Start with imported data
            ...existing, // Override with existing critical data
            // Always update description and tags if they exist in imported data
            description: imported.description || existing.description,
            tags: [...(existing.tags || []), ...(imported.tags || [])].filter((tag, index, arr) => arr.indexOf(tag) === index),
            // Update skills if imported has more
            skills: imported.skills && imported.skills.length > (existing.skills?.length || 0) 
                ? imported.skills 
                : existing.skills,
            // Keep relationship and other game-state dependent fields from existing
            relationship: existing.relationship,
            location: existing.location,
            // Mark as updated
            lastUpdated: Date.now()
        };

        // Clean up import-specific fields
        delete (merged as any).exportedAt;
        delete (merged as any).exportTurn;
        delete (merged as any).hanVietName;
        delete (merged as any).originalName;

        return merged;
    }

    /**
     * Create backup before import
     */
    private static async createBackup(gameState: SaveData): Promise<void> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `backup_before_import_${timestamp}.json`;
        const backupContent = JSON.stringify({
            metadata: {
                backupCreatedAt: timestamp,
                totalEntities: Object.keys(gameState.knownEntities).length,
                reason: 'Pre-import backup'
            },
            entities: gameState.knownEntities
        }, null, 2);

        await this.downloadFile(backupFileName, backupContent);
        this.debugLog(`💾 Backup created: ${backupFileName}`);
    }

    /**
     * Update import metadata
     */
    private static updateImportMetadata(fileName: string, result: ImportResult): void {
        this.metadata.totalImports++;
        this.metadata.importHistory.push({
            timestamp: new Date().toISOString(),
            fileName,
            entitiesImported: result.entitiesImported,
            conflicts: result.conflicts.length,
            success: result.success
        });

        // Keep only last 10 import records
        if (this.metadata.importHistory.length > 10) {
            this.metadata.importHistory = this.metadata.importHistory.slice(-10);
        }

        this.debugLog('📊 Import metadata updated:', this.metadata);
    }

    /**
     * Reset export metadata
     */
    public static resetMetadata(): void {
        this.metadata = {
            lastExportTurn: 0,
            totalExports: 0,
            totalImports: 0,
            exportHistory: [],
            importHistory: []
        };
        this.debugLog('🔄 Export metadata reset');
    }

    /**
     * Debug logging utility
     */
    private static debugLog(message: string, data?: any): void {
        if (!this.config.enableDebugLogging) return;
        
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] EntityExportManager: ${message}`, data || '');
    }
}

// Export singleton instance for easy access
export const entityExportManager = EntityExportManager;
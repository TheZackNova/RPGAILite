import { EntityExportManager } from './EntityExportManager';
import type { SaveData } from '../types';

/**
 * Debugging utilities for EntityExportManager
 * Provides comprehensive testing and monitoring functions
 */
export class EntityExportDebugger {
    
    /**
     * Test the complete export pipeline with sample data
     */
    public static async testExportPipeline(): Promise<void> {
        console.log('🧪 Starting EntityExportManager Pipeline Test...');
        
        // Create comprehensive test data
        const testGameState: SaveData = this.createTestGameState();
        
        // Test configuration
        console.log('🔧 Testing configuration...');
        EntityExportManager.configure({
            enabled: true,
            exportInterval: 5,
            enableDebugLogging: true,
            exportPath: '/data/game-exports/',
            maxFileSize: 1024 * 1024
        });
        
        // Test shouldExport logic
        console.log('📊 Testing shouldExport logic...');
        this.testShouldExportLogic();
        
        // Test categorization
        console.log('📋 Testing entity categorization...');
        this.testEntityCategorization(testGameState);
        
        // Test actual export
        console.log('💾 Testing export functionality...');
        try {
            const success = await EntityExportManager.exportEntities(testGameState);
            if (success) {
                console.log('✅ Export test completed successfully!');
                this.logExportStatus();
            } else {
                console.error('❌ Export test failed');
            }
        } catch (error) {
            console.error('🚨 Export test error:', error);
        }
        
        console.log('🏁 Pipeline test completed!');
    }
    
    /**
     * Create comprehensive test game state
     */
    private static createTestGameState(): SaveData {
        return {
            turnCount: 10,
            worldData: {
                characterName: 'TestNinja',
                worldName: 'Test World'
            },
            knownEntities: {
                // Characters
                'naruto_uzumaki': {
                    name: 'Naruto Uzumaki',
                    type: 'companion',
                    description: 'Ninja trẻ tuổi với ước mơ trở thành Hokage',
                    personality: 'Năng động, lạc quan, không bao giờ từ bỏ',
                    personalityMbti: 'ENFP',
                    skills: ['Kage Bunshin no Jutsu', 'Rasengan', 'Sage Mode'],
                    relationship: 'Bạn thân',
                    realm: 'Chunin',
                    location: 'Konoha Village',
                    motivation: 'Trở thành Hokage và bảo vệ làng'
                },
                'sasuke_uchiha': {
                    name: 'Sasuke Uchiha',
                    type: 'companion',
                    description: 'Thiên tài của gia tộc Uchiha, tìm kiếm sức mạnh',
                    personality: 'Lạnh lùng, kiêu hãnh, quyết tâm',
                    personalityMbti: 'INTJ',
                    skills: ['Sharingan', 'Chidori', 'Katon Goukakyuu'],
                    relationship: 'Bạn/Đối thủ',
                    realm: 'Chunin',
                    location: 'Konoha Village'
                },
                'kakashi_hatake': {
                    name: 'Kakashi Hatake',
                    type: 'npc',
                    description: 'Jounin với biệt danh Copy Ninja',
                    personality: 'Bình tĩnh, thông minh, có chút lười biếng',
                    skills: ['Sharingan', 'Chidori', 'Raikiri'],
                    realm: 'Jounin',
                    location: 'Konoha Village'
                },
                
                // Locations
                'konoha_village': {
                    name: 'Konoha Village',
                    type: 'location',
                    description: 'Làng Lá Ẩn, một trong những làng ninja mạnh nhất',
                    location: 'Fire Country'
                },
                'ichiraku_ramen': {
                    name: 'Ichiraku Ramen',
                    type: 'location',
                    description: 'Quán ramen nổi tiếng ở Konoha',
                    location: 'Konoha Village'
                },
                'training_ground_7': {
                    name: 'Training Ground 7',
                    type: 'location',
                    description: 'Khu vực luyện tập của Team 7',
                    location: 'Konoha Village'
                },
                
                // Items
                'kunai': {
                    name: 'Kunai',
                    type: 'item',
                    description: 'Dao ném ninja cơ bản',
                    owner: 'pc',
                    equippable: true,
                    equipped: true,
                    durability: 100
                },
                'shuriken': {
                    name: 'Shuriken',
                    type: 'item',
                    description: 'Vũ khí ném hình sao',
                    owner: 'pc',
                    equippable: true,
                    uses: 10
                },
                'soldier_pill': {
                    name: 'Soldier Pill',
                    type: 'item',
                    description: 'Viên thuốc tăng chakra',
                    owner: 'pc',
                    consumable: true,
                    uses: 3
                },
                
                // Factions
                'konoha_military': {
                    name: 'Konoha Military',
                    type: 'faction',
                    description: 'Lực lượng quân sự của Làng Lá',
                    location: 'Konoha Village'
                },
                'akatsuki': {
                    name: 'Akatsuki',
                    type: 'faction',
                    description: 'Tổ chức tội phạm nguy hiểm',
                    location: 'Unknown'
                },
                
                // Skills
                'rasengan': {
                    name: 'Rasengan',
                    type: 'skill',
                    description: 'Kỹ thuật chakra xoáy tròn',
                    learnable: true,
                    realm: 'A-rank'
                },
                'sharingan': {
                    name: 'Sharingan',
                    type: 'skill',
                    description: 'Con mắt copy của gia tộc Uchiha',
                    learnable: false,
                    realm: 'Kekkei Genkai'
                },
                
                // Status Effects
                'chakra_exhaustion': {
                    name: 'Chakra Exhaustion',
                    type: 'status_effect',
                    description: 'Kiệt sức chakra, giảm hiệu suất chiến đấu',
                    owner: 'pc'
                },
                
                // Concepts
                'will_of_fire': {
                    name: 'Will of Fire',
                    type: 'concept',
                    description: 'Tinh thần của Konoha - bảo vệ đồng đội và làng'
                },
                
                // Archived entity (should not be exported)
                'archived_character': {
                    name: 'Archived Character',
                    type: 'npc',
                    description: 'This character was archived',
                    archived: true,
                    archivedAt: 8
                }
            },
            statuses: [],
            quests: [],
            gameHistory: [],
            memories: [],
            party: [],
            customRules: [],
            systemInstruction: '',
            totalTokens: 0,
            gameTime: { day: 1, month: 1, year: 1, hour: 12 },
            chronicle: { memoir: [], chapter: [], turn: [] },
            compressedHistory: [],
            historyStats: {},
            cleanupStats: {},
            archivedMemories: [],
            memoryStats: {},
            storyLog: [],
            choices: [],
            locationDiscoveryOrder: []
        };
    }
    
    /**
     * Test shouldExport logic with various turn numbers
     */
    private static testShouldExportLogic(): void {
        const testTurns = [1, 4, 5, 6, 9, 10, 11, 15, 20];
        
        console.log('🔍 Testing shouldExport for various turn numbers:');
        testTurns.forEach(turn => {
            const should = EntityExportManager.shouldExport(turn);
            console.log(`  Turn ${turn}: ${should ? '✅ Export' : '❌ Skip'}`);
        });
    }
    
    /**
     * Test entity categorization
     */
    private static testEntityCategorization(gameState: SaveData): void {
        console.log('📊 Testing entity categorization:');
        
        const entities = gameState.knownEntities;
        const categories = {
            characters: 0,
            locations: 0,
            items: 0,
            factions: 0,
            skills: 0,
            statusEffects: 0,
            concepts: 0,
            archived: 0
        };
        
        for (const [name, entity] of Object.entries(entities)) {
            if (entity.archived) {
                categories.archived++;
                continue;
            }
            
            switch (entity.type) {
                case 'pc':
                case 'npc':
                case 'companion':
                    categories.characters++;
                    break;
                case 'location':
                    categories.locations++;
                    break;
                case 'item':
                    categories.items++;
                    break;
                case 'faction':
                    categories.factions++;
                    break;
                case 'skill':
                    categories.skills++;
                    break;
                case 'status_effect':
                    categories.statusEffects++;
                    break;
                case 'concept':
                default:
                    categories.concepts++;
                    break;
            }
        }
        
        console.log('  Categories found:');
        Object.entries(categories).forEach(([category, count]) => {
            if (count > 0) {
                console.log(`    ${category}: ${count} entities`);
            }
        });
    }
    
    /**
     * Log current export status
     */
    private static logExportStatus(): void {
        const status = EntityExportManager.getExportStatus();
        console.log('📈 Current Export Status:');
        console.log('  Config:', status.config);
        console.log('  Metadata:', status.metadata);
        console.log('  Next Export Turn:', status.nextExportTurn);
    }
    
    /**
     * Monitor export activity in real-time
     */
    public static startExportMonitoring(): void {
        console.log('🔍 Starting EntityExport monitoring...');
        
        // Monitor turn changes and export triggers
        let lastTurn = 0;
        const checkInterval = setInterval(() => {
            const status = EntityExportManager.getExportStatus();
            const currentTurn = status.metadata.lastExportTurn;
            
            if (currentTurn !== lastTurn) {
                console.log(`📊 Turn changed: ${lastTurn} → ${currentTurn}`);
                console.log(`📈 Export status update:`, {
                    totalExports: status.metadata.totalExports,
                    nextExportTurn: status.nextExportTurn,
                    configEnabled: status.config.enabled
                });
                lastTurn = currentTurn;
            }
        }, 5000); // Check every 5 seconds
        
        // Stop monitoring after 5 minutes
        setTimeout(() => {
            clearInterval(checkInterval);
            console.log('🛑 Export monitoring stopped');
        }, 300000);
    }
    
    /**
     * Force an export for testing
     */
    public static async forceTestExport(): Promise<void> {
        console.log('🚀 Forcing test export...');
        const testState = this.createTestGameState();
        testState.turnCount = Date.now(); // Unique turn for testing
        
        try {
            const success = await EntityExportManager.forceExport(testState);
            if (success) {
                console.log('✅ Force export successful!');
                this.logExportStatus();
            } else {
                console.error('❌ Force export failed');
            }
        } catch (error) {
            console.error('🚨 Force export error:', error);
        }
    }
    
    /**
     * Reset export metadata for testing
     */
    public static resetForTesting(): void {
        console.log('🔄 Resetting EntityExportManager for testing...');
        EntityExportManager.resetMetadata();
        console.log('✅ Reset complete');
    }
}

// Make available globally for browser console testing
if (typeof window !== 'undefined') {
    (window as any).EntityExportDebugger = EntityExportDebugger;
    console.log('🐛 EntityExportDebugger available globally as window.EntityExportDebugger');
}
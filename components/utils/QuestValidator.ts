import type { Quest, SaveData, Entity } from '../types';
import type { GeneratedQuest } from './QuestGenerator';

export interface ValidationResult {
    isValid: boolean;
    confidence: number;
    issues: ValidationIssue[];
    recommendations: string[];
    processedQuest?: GeneratedQuest;
}

export interface ValidationIssue {
    severity: 'low' | 'medium' | 'high';
    type: 'consistency' | 'logic' | 'difficulty' | 'language' | 'balance';
    description: string;
    suggestion?: string;
}

export interface ValidationConfig {
    strictMode: boolean;
    checkWorldConsistency: boolean;
    checkEntityReferences: boolean;
    checkDifficultyBalance: boolean;
    checkLanguageQuality: boolean;
    autoFix: boolean;
}

export class QuestValidator {
    
    private static readonly DEFAULT_CONFIG: ValidationConfig = {
        strictMode: false,
        checkWorldConsistency: true,
        checkEntityReferences: true,
        checkDifficultyBalance: true,
        checkLanguageQuality: true,
        autoFix: true
    };

    /**
     * Validate a generated quest against game state and quality standards
     */
    public static validateQuest(
        quest: GeneratedQuest,
        gameState: SaveData,
        config: ValidationConfig = this.DEFAULT_CONFIG
    ): ValidationResult {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🔍 [${timestamp}] Quest Validation Started:`, {
            questTitle: quest.title,
            questType: quest.generationMetadata.questType,
            strictMode: config.strictMode
        });

        const issues: ValidationIssue[] = [];
        let processedQuest = { ...quest };

        // Core validation checks
        issues.push(...this.validateBasicStructure(quest));
        
        if (config.checkWorldConsistency) {
            issues.push(...this.validateWorldConsistency(quest, gameState));
        }
        
        if (config.checkEntityReferences) {
            issues.push(...this.validateEntityReferences(quest, gameState));
        }
        
        if (config.checkDifficultyBalance) {
            issues.push(...this.validateDifficultyBalance(quest, gameState));
        }
        
        if (config.checkLanguageQuality) {
            issues.push(...this.validateLanguageQuality(quest));
        }

        // Auto-fix issues if enabled
        if (config.autoFix) {
            processedQuest = this.applyAutoFixes(processedQuest, issues, gameState);
        }

        // Calculate overall validation score
        const confidence = this.calculateValidationConfidence(issues, quest.generationMetadata.confidence);
        const isValid = this.determineValidity(issues, config.strictMode);

        // Generate recommendations
        const recommendations = this.generateRecommendations(issues, quest, gameState);

        console.log(`✅ [${timestamp}] Quest Validation Complete:`, {
            isValid,
            confidence: confidence.toFixed(2),
            issuesFound: issues.length,
            highSeverityIssues: issues.filter(i => i.severity === 'high').length
        });

        return {
            isValid,
            confidence,
            issues,
            recommendations,
            processedQuest: config.autoFix ? processedQuest : undefined
        };
    }

    /**
     * Validate basic quest structure and requirements
     */
    private static validateBasicStructure(quest: GeneratedQuest): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Title validation
        if (!quest.title || quest.title.trim().length === 0) {
            issues.push({
                severity: 'high',
                type: 'consistency',
                description: 'Quest thiếu tiêu đề',
                suggestion: 'Tạo tiêu đề ngắn gọn và hấp dẫn'
            });
        } else if (quest.title.length > 100) {
            issues.push({
                severity: 'medium',
                type: 'consistency',
                description: 'Tiêu đề quest quá dài',
                suggestion: 'Rút gọn tiêu đề xuống dưới 100 ký tự'
            });
        }

        // Description validation
        if (!quest.description || quest.description.trim().length === 0) {
            issues.push({
                severity: 'high',
                type: 'consistency',
                description: 'Quest thiếu mô tả',
                suggestion: 'Thêm mô tả chi tiết về bối cảnh và mục đích'
            });
        } else if (quest.description.length < 50) {
            issues.push({
                severity: 'medium',
                type: 'consistency',
                description: 'Mô tả quest quá ngắn',
                suggestion: 'Mở rộng mô tả để cung cấp thêm bối cảnh'
            });
        }

        // Objectives validation
        if (!quest.objectives || quest.objectives.length === 0) {
            issues.push({
                severity: 'high',
                type: 'consistency',
                description: 'Quest không có mục tiêu',
                suggestion: 'Thêm ít nhất 1-2 mục tiêu cụ thể'
            });
        } else {
            if (quest.objectives.length > 6) {
                issues.push({
                    severity: 'medium',
                    type: 'balance',
                    description: 'Quest có quá nhiều mục tiêu',
                    suggestion: 'Giảm xuống 2-5 mục tiêu chính'
                });
            }

            // Check individual objectives
            quest.objectives.forEach((objective, index) => {
                if (!objective.description || objective.description.trim().length === 0) {
                    issues.push({
                        severity: 'medium',
                        type: 'consistency',
                        description: `Mục tiêu ${index + 1} thiếu mô tả`,
                        suggestion: 'Thêm mô tả rõ ràng cho mục tiêu'
                    });
                } else if (objective.description.length < 10) {
                    issues.push({
                        severity: 'low',
                        type: 'consistency',
                        description: `Mục tiêu ${index + 1} quá ngắn`,
                        suggestion: 'Mở rộng mô tả mục tiêu'
                    });
                }
            });
        }

        return issues;
    }

    /**
     * Validate quest consistency with world state
     */
    private static validateWorldConsistency(quest: GeneratedQuest, gameState: SaveData): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Check if quest fits world genre
        const worldGenre = gameState.worldData.genre?.toLowerCase() || '';
        const questContent = (quest.title + ' ' + quest.description).toLowerCase();

        if (worldGenre.includes('fantasy') || worldGenre.includes('kiếm hiệp')) {
            // Fantasy world checks
            if (questContent.includes('robot') || questContent.includes('máy tính') || questContent.includes('công nghệ')) {
                issues.push({
                    severity: 'high',
                    type: 'consistency',
                    description: 'Quest chứa yếu tố không phù hợp với thế giới fantasy',
                    suggestion: 'Thay thế bằng yếu tố ma pháp hoặc kiếm hiệp'
                });
            }
        }

        // Check current game time context
        const gameTime = gameState.gameTime;
        if (quest.description.includes('ban đêm') && gameTime.hour >= 6 && gameTime.hour < 18) {
            issues.push({
                severity: 'low',
                type: 'consistency',
                description: 'Quest đề cập đến ban đêm nhưng hiện tại là ban ngày',
                suggestion: 'Điều chỉnh thời gian hoặc nội dung quest'
            });
        }

        // Check location consistency
        if (gameState.locationDiscoveryOrder && gameState.locationDiscoveryOrder.length > 0) {
            const currentLocation = gameState.locationDiscoveryOrder[gameState.locationDiscoveryOrder.length - 1];
            // Add location-specific checks here if needed
        }

        return issues;
    }

    /**
     * Validate entity references in quest
     */
    private static validateEntityReferences(quest: GeneratedQuest, gameState: SaveData): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Check quest giver exists or is reasonable
        if (quest.giver) {
            const giverEntity = gameState.knownEntities[quest.giver];
            if (!giverEntity) {
                // Quest giver is new - check if it makes sense
                if (quest.giver.length < 3) {
                    issues.push({
                        severity: 'medium',
                        type: 'logic',
                        description: 'Tên người giao quest quá ngắn',
                        suggestion: 'Sử dụng tên dài hơn hoặc chọn NPC đã biết'
                    });
                }
            } else {
                // Check if giver can logically give this quest
                if (giverEntity.state === 'dead') {
                    issues.push({
                        severity: 'high',
                        type: 'logic',
                        description: 'Người giao quest đã chết',
                        suggestion: 'Chọn người giao quest khác'
                    });
                }
            }
        }

        // Check if quest references unknown entities in description/objectives
        const questText = quest.description + ' ' + quest.objectives.map(o => o.description).join(' ');
        const entityNames = Object.keys(gameState.knownEntities);
        
        // Look for potential entity references that might not exist
        const mentionedNames = this.extractPotentialEntityNames(questText);
        mentionedNames.forEach(name => {
            if (!entityNames.includes(name) && name.length > 3) {
                issues.push({
                    severity: 'low',
                    type: 'consistency',
                    description: `Quest đề cập đến "${name}" chưa được biết đến`,
                    suggestion: 'Đảm bảo tất cả nhân vật được giới thiệu trước'
                });
            }
        });

        return issues;
    }

    /**
     * Validate quest difficulty balance
     */
    private static validateDifficultyBalance(quest: GeneratedQuest, gameState: SaveData): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        const difficulty = quest.generationMetadata.difficulty;
        const objectiveCount = quest.objectives.length;
        const isMainQuest = quest.isMainQuest;

        // Check objective count vs difficulty
        if (difficulty === 'easy' && objectiveCount > 3) {
            issues.push({
                severity: 'medium',
                type: 'balance',
                description: 'Quest dễ có quá nhiều mục tiêu',
                suggestion: 'Giảm xuống 1-2 mục tiêu hoặc tăng độ khó'
            });
        } else if (difficulty === 'hard' && objectiveCount < 2) {
            issues.push({
                severity: 'medium',
                type: 'balance',
                description: 'Quest khó có quá ít mục tiêu',
                suggestion: 'Thêm mục tiêu hoặc giảm độ khó'
            });
        }

        // Check main quest requirements
        if (isMainQuest && difficulty === 'easy') {
            issues.push({
                severity: 'low',
                type: 'balance',
                description: 'Quest chính có độ khó quá thấp',
                suggestion: 'Tăng độ khó lên medium hoặc hard'
            });
        }

        // Check quest complexity vs player progression
        const playerLevel = this.estimatePlayerLevel(gameState);
        if (playerLevel < 5 && difficulty === 'hard') {
            issues.push({
                severity: 'medium',
                type: 'balance',
                description: 'Quest khó cho người chơi mới',
                suggestion: 'Giảm độ khó xuống medium'
            });
        }

        return issues;
    }

    /**
     * Validate Vietnamese language quality
     */
    private static validateLanguageQuality(quest: GeneratedQuest): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Check for common language issues
        const textToCheck = quest.title + ' ' + quest.description + ' ' + 
                           quest.objectives.map(o => o.description).join(' ');

        // Check for mixed languages
        if (this.hasMixedLanguages(textToCheck)) {
            issues.push({
                severity: 'medium',
                type: 'language',
                description: 'Quest có lẫn tiếng Anh và tiếng Việt',
                suggestion: 'Sử dụng nhất quán tiếng Việt'
            });
        }

        // Check for grammar patterns
        if (this.hasGrammarIssues(textToCheck)) {
            issues.push({
                severity: 'low',
                type: 'language',
                description: 'Có thể có lỗi ngữ pháp',
                suggestion: 'Kiểm tra lại ngữ pháp tiếng Việt'
            });
        }

        // Check for appropriate tone
        if (this.hasInappropriateTone(textToCheck)) {
            issues.push({
                severity: 'low',
                type: 'language',
                description: 'Giọng điệu không phù hợp với game RPG',
                suggestion: 'Sử dụng giọng điệu trang trọng hơn'
            });
        }

        return issues;
    }

    /**
     * Apply automatic fixes to common issues
     */
    private static applyAutoFixes(
        quest: GeneratedQuest,
        issues: ValidationIssue[],
        gameState: SaveData
    ): GeneratedQuest {
        let fixedQuest = { ...quest };

        issues.forEach(issue => {
            try {
                switch (issue.type) {
                    case 'consistency':
                        if (issue.description.includes('thiếu tiêu đề')) {
                            fixedQuest.title = this.generateFallbackTitle(quest.generationMetadata.questType);
                        }
                        if (issue.description.includes('thiếu mô tả')) {
                            fixedQuest.description = this.generateFallbackDescription(quest.generationMetadata.questType);
                        }
                        break;
                        
                    case 'balance':
                        if (issue.description.includes('quá nhiều mục tiêu')) {
                            fixedQuest.objectives = fixedQuest.objectives.slice(0, 4);
                        }
                        break;
                        
                    case 'logic':
                        if (issue.description.includes('đã chết')) {
                            fixedQuest.giver = this.findAlternativeGiver(gameState);
                        }
                        break;
                }
            } catch (error) {
                console.warn('Failed to auto-fix issue:', issue.description, error);
            }
        });

        return fixedQuest;
    }

    // Helper Methods

    private static calculateValidationConfidence(issues: ValidationIssue[], originalConfidence: number): number {
        let penaltyScore = 0;
        
        // Group issues by severity to avoid excessive penalties
        const severityCounts = { high: 0, medium: 0, low: 0 };
        issues.forEach(issue => severityCounts[issue.severity]++);
        
        // Apply diminishing returns for multiple issues of same severity
        penaltyScore += Math.min(severityCounts.high * 0.15, 0.4); // Max 0.4 penalty for high issues
        penaltyScore += Math.min(severityCounts.medium * 0.08, 0.2); // Max 0.2 penalty for medium issues  
        penaltyScore += Math.min(severityCounts.low * 0.03, 0.1); // Max 0.1 penalty for low issues

        return Math.max(0.3, originalConfidence - penaltyScore);
    }

    private static determineValidity(issues: ValidationIssue[], strictMode: boolean): boolean {
        const highSeverityIssues = issues.filter(i => i.severity === 'high').length;
        const mediumSeverityIssues = issues.filter(i => i.severity === 'medium').length;

        if (strictMode) {
            return highSeverityIssues === 0 && mediumSeverityIssues <= 1;
        } else {
            return highSeverityIssues <= 1 && mediumSeverityIssues <= 3;
        }
    }

    private static generateRecommendations(
        issues: ValidationIssue[],
        quest: GeneratedQuest,
        gameState: SaveData
    ): string[] {
        const recommendations: string[] = [];

        if (issues.length === 0) {
            recommendations.push("Quest đạt chất lượng tốt và sẵn sàng sử dụng");
        } else {
            const highIssues = issues.filter(i => i.severity === 'high');
            if (highIssues.length > 0) {
                recommendations.push(`Cần sửa ${highIssues.length} vấn đề nghiêm trọng trước khi sử dụng`);
            }

            const mediumIssues = issues.filter(i => i.severity === 'medium');
            if (mediumIssues.length > 0) {
                recommendations.push(`Nên cải thiện ${mediumIssues.length} vấn đề trung bình`);
            }

            // Specific recommendations based on issue types
            const consistencyIssues = issues.filter(i => i.type === 'consistency');
            if (consistencyIssues.length > 0) {
                recommendations.push("Cần đảm bảo tính nhất quán với thế giới game");
            }

            const balanceIssues = issues.filter(i => i.type === 'balance');
            if (balanceIssues.length > 0) {
                recommendations.push("Cần cân bằng lại độ khó và số lượng mục tiêu");
            }
        }

        return recommendations;
    }

    private static extractPotentialEntityNames(text: string): string[] {
        // Simple regex to find capitalized words that might be names
        const namePattern = /[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúăđĩũơư]+/g;
        const matches = text.match(namePattern) || [];
        
        // Filter out common words that aren't names
        const commonWords = ['Tìm', 'Hãy', 'Bạn', 'Người', 'Nơi', 'Khi', 'Điều', 'Việc'];
        return matches.filter(match => !commonWords.includes(match));
    }

    private static estimatePlayerLevel(gameState: SaveData): number {
        // Simple estimation based on game progression
        const turnCount = gameState.turnCount;
        const questCount = gameState.quests.length;
        const entityCount = Object.keys(gameState.knownEntities).length;
        
        return Math.min(10, Math.floor((turnCount / 10) + (questCount / 5) + (entityCount / 20)));
    }

    private static hasMixedLanguages(text: string): boolean {
        const hasEnglish = /[a-zA-Z]{3,}/.test(text);
        const hasVietnamese = /[àáâãèéêìíòóôõùúăđĩũơư]/.test(text);
        return hasEnglish && hasVietnamese;
    }

    private static hasGrammarIssues(text: string): boolean {
        // Basic grammar checks for Vietnamese
        const issues = [
            /\s{2,}/,  // Multiple spaces
            /\.\./,    // Double periods
            /\?\?/,    // Double question marks
            /!!/       // Double exclamation marks
        ];
        return issues.some(pattern => pattern.test(text));
    }

    private static hasInappropriateTone(text: string): boolean {
        const casualPatterns = [
            /\bck\b/,     // "ck" slang
            /\bthím\b/,   // "thím" casual
            /\bmày\b/,    // "mày" too casual
            /\btao\b/     // "tao" too casual
        ];
        return casualPatterns.some(pattern => pattern.test(text.toLowerCase()));
    }

    private static generateFallbackTitle(questType: string): string {
        const titles: { [key: string]: string } = {
            'consequence': 'Hậu Quả Không Lường Trước',
            'mystery': 'Bí Ẩn Cần Giải Đáp',
            'exploration': 'Hành Trình Khám Phá',
            'character_arc': 'Phát Triển Mối Quan Hệ'
        };
        return titles[questType] || 'Nhiệm Vụ Mới';
    }

    private static generateFallbackDescription(questType: string): string {
        const descriptions: { [key: string]: string } = {
            'consequence': 'Hành động trong quá khứ đã tạo ra những hậu quả không ngờ. Giờ đây bạn phải đối mặt với chúng.',
            'mystery': 'Một bí ẩn đang chờ được giải mã. Hãy tìm hiểu sự thật ẩn giấu đằng sau những dấu hiệu này.',
            'exploration': 'Những vùng đất mới đang chờ được khám phá. Hãy mở rộng hiểu biết về thế giới.',
            'character_arc': 'Đây là cơ hội để phát triển mối quan hệ và giúp đỡ những người quan trọng.'
        };
        return descriptions[questType] || 'Một nhiệm vụ quan trọng đang chờ bạn hoàn thành.';
    }

    private static findAlternativeGiver(gameState: SaveData): string {
        // Find living NPCs who could be quest givers
        const livingNPCs = Object.values(gameState.knownEntities)
            .filter(entity => entity.type === 'npc' && entity.state !== 'dead');
        
        if (livingNPCs.length > 0) {
            return livingNPCs[0].name;
        }
        
        return 'Người Lạ Bí Ẩn';
    }
}
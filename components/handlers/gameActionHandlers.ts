import { GoogleGenAI } from "@google/genai";
import type { GameHistoryEntry, SaveData } from '../types';
import { buildEnhancedRagPrompt } from '../promptBuilder';
import { EntityExportManager } from '../utils/EntityExportManager';
import { QuestManagementEngine } from '../utils/QuestManagementEngine';

export interface GameActionHandlersParams {
    ai: GoogleGenAI | null;
    selectedModel: string;
    systemInstruction: string;
    responseSchema: any;
    isUsingDefaultKey: boolean;
    userApiKeyCount: number;
    rotateKey: () => void;
    rehydratedChoices: string[];
    
    // State setters
    setIsLoading: (loading: boolean) => void;
    setChoices: (choices: string[]) => void;
    setCustomAction: (action: string) => void;
    setStoryLog: (log: string[] | ((prev: string[]) => string[])) => void;
    setGameHistory: (history: GameHistoryEntry[] | ((prev: GameHistoryEntry[]) => GameHistoryEntry[])) => void;
    setTurnCount: (count: number | ((prev: number) => number)) => void;
    setCurrentTurnTokens: (tokens: number) => void;
    setTotalTokens: (tokens: number | ((prev: number) => number)) => void;
    
    // Current state values
    gameHistory: GameHistoryEntry[];
    customRules: any[];
    ruleChanges: any;
    setRuleChanges: (changes: any) => void;
    parseStoryAndTags: (text: string, applySideEffects: boolean) => string;
}

export const createGameActionHandlers = (params: GameActionHandlersParams) => {
    const {
        ai, selectedModel, systemInstruction, responseSchema,
        isUsingDefaultKey, userApiKeyCount, rotateKey, rehydratedChoices,
        setIsLoading, setChoices, setCustomAction, setStoryLog, setGameHistory,
        setTurnCount, setCurrentTurnTokens, setTotalTokens,
        gameHistory, customRules, ruleChanges, setRuleChanges, parseStoryAndTags
    } = params;

    const generateInitialStory = async (
        worldData: any,
        knownEntities: any,
        pcEntity: any,
        initialHistory: GameHistoryEntry[]
    ) => {
        if (!ai) return;
        setIsLoading(true);
        
        const finalPersonality = worldData.customPersonality || worldData.personalityFromList;
        const writingStyleText = worldData.writingStyle === 'first_person' ? 'Ngôi thứ nhất - Nhân vật chính xưng "Ta/Tôi"' : 'Ngôi thứ hai - "Ngươi" là nhân vật chính';
        const nsfwInstruction = worldData.allowNsfw ? 'Cho phép. Kích hoạt quy tắc nội dung 18+ của Quản Trò. Viết một cách trần trụi, bạo lực, tục tĩu và không giới hạn.' : 'Không, AI phải tránh các chủ đề và mô tả 18+.';
        
        const activeRules = customRules.filter(r => r.isActive);
        let customRulesContext = '';
        if (activeRules.length > 0) {
            customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`;
        }

        // BƯỚC 2: SỬ DỤNG LORE_CONCEPT ĐÃ TẠO
        const conceptEntities = Object.values(knownEntities).filter((e: any) => e.type === 'concept');
        let conceptContext = '';
        if (conceptEntities.length > 0) {
            conceptContext = `\n--- CÁC LORE_CONCEPT ĐÃ THIẾT LẬP ---\n${conceptEntities.map((c: any) => `• ${c.name}: ${c.description}`).join('\n')}\n--- KẾT THÚC ---\n`;
        }

        if (!pcEntity) return;

        const userPrompt = `${customRulesContext}${conceptContext}

BẠN LÀ QUẢN TRÒ AI. Tạo câu chuyện mở đầu cho game RPG với yêu cầu sau:

--- THÔNG TIN NHÂN VẬT CHÍNH ---
Tên: ${pcEntity.name}
Giới tính: ${pcEntity.gender}
Tiểu sử: ${pcEntity.description}
Tính cách: ${pcEntity.personality}

--- THÔNG TIN THẾ GIỚI ---
Thế giới: ${worldData.worldName}
Mô tả: ${worldData.worldDescription}
Thời gian: Năm ${worldData.worldTime?.year || 1}, Tháng ${worldData.worldTime?.month || 1}, Ngày ${worldData.worldTime?.day || 1}
Địa điểm bắt đầu: ${worldData.startLocation === 'Tuỳ chọn' ? worldData.customStartLocation : worldData.startLocation || 'Không xác định'}
Phong cách viết: ${writingStyleText}
Nội dung 18+: ${nsfwInstruction}

--- YÊU CẦU VIẾT STORY ---
1. **CHIỀU DÀI**: Chính xác 300-400 từ, chi tiết và sống động
2. **SỬ DỤNG CONCEPT**: Phải tích hợp các LORE_CONCEPT đã thiết lập vào câu chuyện một cách tự nhiên
3. **THIẾT LẬP BỐI CẢNH**: Tạo tình huống mở đầu thú vị, không quá drama
4. **TIME_ELAPSED**: Bắt buộc sử dụng [TIME_ELAPSED: hours=0] 
5. **THẺ LỆNH**: Tạo ít nhất 2-3 thẻ lệnh phù hợp (LORE_LOCATION, LORE_NPC, STATUS_APPLIED_SELF...)
6. **LỰA CHỌN**: Tạo 4-6 lựa chọn hành động đa dạng và thú vị

Hãy tạo một câu chuyện mở đầu cuốn hút!`;

        const finalHistory: GameHistoryEntry[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
        setGameHistory(finalHistory);

        try {
            console.log('📖 GenerateInitialStory: Making AI request with model:', selectedModel);
            console.log('📖 GenerateInitialStory: System instruction length:', systemInstruction.length);
            console.log('📖 GenerateInitialStory: Initial history:', finalHistory);
            
            const response = await ai.models.generateContent({
                model: selectedModel, 
                contents: finalHistory,
                config: { 
                    systemInstruction: systemInstruction, 
                    responseMimeType: "application/json", 
                    responseSchema: responseSchema 
                }
            });
            
            console.log('📖 GenerateInitialStory: AI response received:', {
                hasText: !!response.text,
                textLength: response.text?.length || 0,
                usageMetadata: response.usageMetadata
            });
            
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);

            const responseText = response.text?.trim() || '';
            
            if (!responseText) {
                console.error("📖 GenerateInitialStory: API returned empty response text");
                setStoryLog(prev => [...prev, "Lỗi: AI không trả về nội dung. Hãy thử lại."]);
                setChoices([]);
                return;
            }
            
            console.log('📖 GenerateInitialStory: Response text received, length:', responseText.length);
            parseApiResponseHandler(responseText);
            setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        } catch (error: any) {
            console.error("📖 GenerateInitialStory: Error occurred:", {
                errorMessage: error.message,
                errorString: error.toString(),
                errorStack: error.stack,
                errorType: typeof error,
                isUsingDefaultKey,
                userApiKeyCount
            });
            
            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                console.log("📖 GenerateInitialStory: Rate limit detected, rotating key...");
                rotateKey();
                setStoryLog(prev => [...prev, "**⭐ Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại hành động của bạn. ⭐**"]);
                setChoices(rehydratedChoices);
            } else {
                console.error("📖 GenerateInitialStory: Non-rate-limit error, showing error message");
                setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại.", `Chi tiết lỗi: ${error.message || error.toString()}`]);
            }
        } finally {
            console.log("📖 GenerateInitialStory: Cleaning up, setting loading false");
            setIsLoading(false);
        }
    };

    const handleAction = async (action: string, currentGameState: SaveData) => {
        let originalAction = action.trim();
        let isNsfwRequest = false;
        
        const nsfwRegex = /\s+nsfw\s*$/i;
        if (nsfwRegex.test(originalAction)) {
            isNsfwRequest = true;
            originalAction = originalAction.replace(nsfwRegex, '').trim();
        }

        if (!originalAction || !ai) return;

        setIsLoading(true);
        setChoices([]);
        setCustomAction('');
        setStoryLog(prev => [...prev, `> ${originalAction}`]);

        let ruleChangeContext = '';
        if (ruleChanges) {
            // Build context string from ruleChanges
            setRuleChanges(null); 
        }

        let nsfwInstructionPart = isNsfwRequest && currentGameState.worldData.allowNsfw ? `\nLƯU Ý ĐẶC BIỆT: ...` : '';
        
        const userPrompt = buildEnhancedRagPrompt(originalAction, currentGameState, ruleChangeContext, nsfwInstructionPart);

        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
        const updatedHistory = [...gameHistory, newUserEntry];

        try {
            const response = await ai.models.generateContent({
                model: selectedModel, contents: updatedHistory,
                config: { systemInstruction: systemInstruction, responseMimeType: "application/json", responseSchema: responseSchema, }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);

            const responseText = response.text?.trim() || '';
            
            if (!responseText) {
                console.error("API returned empty response text in handleAction");
                setStoryLog(prev => [...prev, "Lỗi: AI không trả về nội dung. Hãy thử lại."]);
                return;
            }
            
            setGameHistory(prev => [...prev, newUserEntry, { role: 'model', parts: [{ text: responseText }] }]);
            parseApiResponseHandler(responseText);
            
            setTurnCount(prev => {
                const newTurn = prev + 1;
                
                // 🔄 Auto-export entities every few turns (with unique ID to prevent duplicates)
                const exportId = `export_${newTurn}_${Date.now()}_${Math.random().toString(36)}`;
                console.log(`📋 [Turn ${newTurn}] Scheduling export with ID: ${exportId}`);
                
                setTimeout(async () => {
                    try {
                        console.log(`🔍 [Turn ${newTurn}] Checking export eligibility (ID: ${exportId})`);
                        if (EntityExportManager.shouldExport(newTurn, exportId)) {
                            console.log(`🚀 [Turn ${newTurn}] Triggering auto-export (ID: ${exportId})`);
                            const exportSuccess = await EntityExportManager.exportEntities(currentGameState, exportId);
                            
                            if (exportSuccess) {
                                console.log(`✅ [Turn ${newTurn}] Entity export completed successfully (ID: ${exportId})`);
                            } else {
                                console.warn(`⚠️ [Turn ${newTurn}] Entity export failed (ID: ${exportId})`);
                            }
                        } else {
                            console.log(`⏭️ [Turn ${newTurn}] Export not needed (ID: ${exportId})`);
                        }
                    } catch (error) {
                        console.error(`🚨 [Turn ${newTurn}] Entity export error (ID: ${exportId}):`, error);
                    }
                }, 1000); // Delay to ensure state is updated
                
                // 🎯 Auto-quest generation check
                const questGenId = `questgen_${newTurn}_${Date.now()}_${Math.random().toString(36)}`;
                console.log(`🎯 [Turn ${newTurn}] Scheduling quest generation check (ID: ${questGenId})`);
                
                setTimeout(async () => {
                    try {
                        console.log(`🎯 [Turn ${newTurn}] Checking quest auto-generation eligibility (ID: ${questGenId})`);
                        
                        // Check if we should trigger auto-generation
                        const defaultConfig = {
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
                        const triggerCheck = QuestManagementEngine.shouldTriggerAutoGeneration(currentGameState, defaultConfig);
                        
                        if (triggerCheck.shouldTrigger && ai) {
                            console.log(`🎯 [Turn ${newTurn}] Triggering auto-quest generation (ID: ${questGenId}). Reasons:`, triggerCheck.reasons);
                            
                            const result = await QuestManagementEngine.generateQuestsFromMemories(currentGameState, ai, selectedModel);
                            
                            if (result.success && result.integration?.integratedQuests.length > 0) {
                                const questCount = result.integration.integratedQuests.length;
                                const questTitles = result.integration.integratedQuests.map((q: any) => q.title).join(', ');
                                console.log(`✅ [Turn ${newTurn}] Auto-generated ${questCount} quests: ${questTitles} (ID: ${questGenId})`);
                            } else {
                                console.log(`⚠️ [Turn ${newTurn}] Quest auto-generation completed but no quests created (ID: ${questGenId})`);
                            }
                        } else {
                            console.log(`⏭️ [Turn ${newTurn}] Quest auto-generation not needed (ID: ${questGenId}). Reasons: ${triggerCheck.reasons.join(', ') || 'No triggers met'}`);
                        }
                    } catch (error) {
                        console.error(`🚨 [Turn ${newTurn}] Quest auto-generation error (ID: ${questGenId}):`, error);
                    }
                }, 1500); // Slightly delayed after entity export
                
                return newTurn;
            }); 
        } catch (error: any) {
            console.error("Error continuing story:", error);
            setStoryLog(prev => prev.slice(0, -1));

            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                rotateKey();
                setStoryLog(prev => [...prev, "**⭐ Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại hành động của bạn. ⭐**"]);
            } else {
                 setStoryLog(prev => [...prev, "Lỗi: AI không thể xử lý yêu cầu. Vui lòng thử một hành động khác."]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestAction = async (storyLog: string[]) => {
        if (!ai) return;
        setIsLoading(true);
        try {
            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: `Bối cảnh: "${storyLog.slice(-1)[0]}". Gợi ý một hành động sáng tạo.`,
            });
            setCustomAction(response.text?.trim() || 'Không thể nhận gợi ý lúc này.');
        } catch (error) {
            console.error("Error suggesting action:", error);
            setCustomAction("Không thể nhận gợi ý lúc này.");
        } finally {
            setIsLoading(false);
        }
    };

    const parseApiResponseHandler = (text: string) => {
        try {
            // Check if response is empty or whitespace only
            if (!text || text.trim().length === 0) {
                console.error("Empty AI response received");
                setStoryLog(prev => [...prev, "Lỗi: AI trả về phản hồi trống. Hãy thử lại."]);
                setChoices([]);
                return;
            }
            
            // Clean the response text to remove any non-JSON content
            let cleanText = text.trim();
            
            // If response starts with markdown code block, extract JSON
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
            
            // Final check if cleanText is valid before parsing
            if (!cleanText || cleanText.length === 0) {
                console.error("No valid JSON found in response");
                setStoryLog(prev => [...prev, "Lỗi: Không tìm thấy JSON hợp lệ trong phản hồi. Hãy thử lại."]);
                setChoices([]);
                return;
            }
            
            const jsonResponse = JSON.parse(cleanText);
            
            // Validate required fields
            if (!jsonResponse.story) {
                console.error("Missing story field in JSON response");
                setStoryLog(prev => [...prev, "Lỗi: Phản hồi thiếu nội dung câu chuyện. Hãy thử lại."]);
                setChoices([]);
                return;
            }
            
            const cleanStory = parseStoryAndTags(jsonResponse.story, true);
            setStoryLog(prev => [...prev, cleanStory]);
            setChoices(jsonResponse.choices || []);
        } catch (e) {
            console.error("Failed to parse AI response:", e, "Raw response:", text);
            setStoryLog(prev => [...prev, "Lỗi: AI trả về dữ liệu không hợp lệ. Hãy thử lại."]);
            setChoices([]);
        }
    };

    return {
        generateInitialStory,
        handleAction,
        handleSuggestAction
    };
};
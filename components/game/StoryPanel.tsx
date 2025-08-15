// components/game/StoryPanel.tsx
import React, { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { SpinnerIcon } from '../Icons';
import { generateGeminiImageFromStory } from '../utils/EnhancedRAG';
import { OptimizedInteractiveText } from '../OptimizedInteractiveText';
import { StatusPanelContent } from './StatusPanelContent';
import { useOptimizedScroll } from '../hooks/useOptimizedScroll';
import { isHTMLContent } from '../utils/htmlParser';
import type { KnownEntities } from '../types';

interface VirtualItem {
    id: string;
    index: number;
    content: string;
    estimatedHeight: number;
    actualHeight?: number;
}

interface VirtualScrollState {
    scrollTop: number;
    containerHeight: number;
    isScrolling: boolean;
    shouldAutoScroll: boolean;
}

interface StoryPanelProps {
    storyLog: string[];
    isLoading: boolean;
    isAiReady: boolean;
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
    className?: string;
}

const ITEM_OVERSCAN = 5;
const ESTIMATED_ITEM_HEIGHT = 80;
const AUTO_SCROLL_THRESHOLD = 5; // Much stricter threshold - only when very close to bottom

// Utility function to estimate text height
const estimateTextHeight = (text: string): number => {
    const baseHeight = 60;
    const charPerLine = 80;
    const lineHeight = 24;
    
    // Count line breaks
    const explicitLines = (text.match(/\n/g) || []).length + 1;
    
    // Estimate wrapped lines
    const estimatedWrappedLines = Math.ceil(text.length / charPerLine);
    
    // Take the maximum and add some padding
    const totalLines = Math.max(explicitLines, estimatedWrappedLines);
    
    return Math.max(baseHeight, baseHeight + (totalLines - 1) * lineHeight);
};

// Virtual item component
const VirtualStoryItem = memo<{
    item: VirtualItem;
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
    onHeightMeasured: (id: string, height: number) => void;
}>(({ item, knownEntities, onEntityClick, onHeightMeasured }) => {
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (itemRef.current && !item.actualHeight) {
            // Use requestAnimationFrame to avoid forced reflow during rendering
            requestAnimationFrame(() => {
                if (itemRef.current) {
                    const height = itemRef.current.getBoundingClientRect().height;
                    if (height !== item.actualHeight) {
                        onHeightMeasured(item.id, height);
                    }
                }
            });
        }
    }, [item.content, item.id, item.actualHeight, onHeightMeasured]);

    const isHTML = isHTMLContent(item.content);

    return (
        <div ref={itemRef} className="story-item bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all duration-300">
            {isHTML ? (
                <StatusPanelContent
                    htmlContent={item.content}
                    onEntityClick={onEntityClick}
                    knownEntities={knownEntities}
                />
            ) : (
                <OptimizedInteractiveText
                    text={item.content}
                    onEntityClick={onEntityClick}
                    knownEntities={knownEntities}
                />
            )}
        </div>
    );
});

VirtualStoryItem.displayName = 'VirtualStoryItem';

// Main StoryPanel component with virtual scrolling
export const StoryPanel: React.FC<StoryPanelProps> = memo(({
    storyLog,
    isLoading,
    isAiReady,
    knownEntities,
    onEntityClick,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // State cho ảnh tự động
    const [autoImage, setAutoImage] = useState(true);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);

    // Hàm gọi Gemini tạo ảnh
    const createImage = useCallback(async (prompt: string) => {
        setImageLoading(true);
        setImageError(null);
        try {
            const url = await generateGeminiImageFromStory(prompt);
            setImageUrl(url);
        } catch (e) {
            setImageError('Tạo ảnh thất bại, thử lại!');
        } finally {
            setImageLoading(false);
        }
    }, []);

    // Tự động tạo ảnh khi storyLog thay đổi
    useEffect(() => {
        if (autoImage && storyLog.length > 0) {
            const last = storyLog[storyLog.length - 1];
            createImage(last);
        }
    }, [storyLog, autoImage, createImage]);
    const [virtualState, setVirtualState] = useState<VirtualScrollState>({
        scrollTop: 0,
        containerHeight: window.innerHeight * 0.6, // Use 60% of viewport height initially
        isScrolling: false,
        shouldAutoScroll: false // Changed to false to prevent auto-scroll by default
    });
    const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Create virtual items from story log
    const virtualItems = useMemo<VirtualItem[]>(() => {
        return storyLog.map((line, index) => ({
            id: `story-${index}-${line.substring(0, 10)}`,
            index,
            content: line,
            estimatedHeight: estimateTextHeight(line),
            actualHeight: itemHeights.get(`story-${index}-${line.substring(0, 10)}`)
        }));
    }, [storyLog, itemHeights]);

    // Calculate item positions
    const itemPositions = useMemo(() => {
        const positions: Array<{ start: number; height: number }> = [];
        let currentPosition = 0;

        virtualItems.forEach(item => {
            const height = item.actualHeight || item.estimatedHeight;
            positions.push({
                start: currentPosition,
                height
            });
            currentPosition += height;
        });

        return positions;
    }, [virtualItems]);

    const totalHeight = useMemo(() => {
        return itemPositions.length > 0 
            ? itemPositions[itemPositions.length - 1].start + itemPositions[itemPositions.length - 1].height
            : 0;
    }, [itemPositions]);

    // Simplified visible range - show all items to prevent scroll jumping issues
    const visibleRange = useMemo(() => ({
        startIndex: 0,
        endIndex: Math.max(0, virtualItems.length - 1)
    }), [virtualItems.length]);

    // Visible items
    const visibleItems = useMemo(() => {
        if (visibleRange.endIndex < visibleRange.startIndex) return [];
        return virtualItems.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
    }, [virtualItems, visibleRange]);

    // Handle item height measurement
    const handleHeightMeasured = useCallback((id: string, height: number) => {
        setItemHeights(prev => {
            const newMap = new Map(prev);
            newMap.set(id, height);
            return newMap;
        });
    }, []);

    // Simple scroll handler - only tracks scroll position for virtual scrolling
    const handleScroll = useCallback((scrollData: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
        const { scrollTop } = scrollData;

        setVirtualState(prev => ({
            ...prev,
            scrollTop,
            isScrolling: true,
            shouldAutoScroll: false // Always false to prevent any auto-scroll
        }));

        // Clear existing timeout
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // Set timeout to detect scroll end
        scrollTimeoutRef.current = setTimeout(() => {
            setVirtualState(prev => ({
                ...prev,
                isScrolling: false
            }));
        }, 150);
    }, []);

    // Use optimized scroll hook but disable scrollToBottom to prevent accidental calls
    const { scrollElementRef, onScroll } = useOptimizedScroll(handleScroll, 16);
    
    // Custom scrollToBottom that only works when user explicitly clicks the button
    const scrollToBottom = useCallback(() => {
        if (scrollElementRef.current) {
            scrollElementRef.current.scrollTop = scrollElementRef.current.scrollHeight;
        }
    }, []);

    // Update container height on resize (debounced to prevent performance issues)
    useEffect(() => {
        let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
        
        const updateContainerHeight = () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (containerRef.current) {
                    requestAnimationFrame(() => {
                        if (containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect();
                            setVirtualState(prev => ({
                                ...prev,
                                containerHeight: rect.height
                            }));
                        }
                    });
                }
            }, 150);
        };

        updateContainerHeight();
        window.addEventListener('resize', updateContainerHeight);
        return () => {
            window.removeEventListener('resize', updateContainerHeight);
            if (resizeTimeout) clearTimeout(resizeTimeout);
        };
    }, []);

    // Note: Removed scroll position management to fix random scrolling issues
    // The virtual scrolling system handles scroll positions automatically

    // Calculate offset for visible items
    const offsetY = visibleRange.startIndex > 0 ? itemPositions[visibleRange.startIndex].start : 0;

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div 
            ref={containerRef}
            className={`md:col-span-1 flex flex-col bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-purple-200 via-pink-200 to-purple-200 bg-clip-text text-transparent">
                        📖 Diễn Biến Câu Chuyện
                    </h2>
                    <div className="flex items-center gap-3 text-sm text-white/70">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1">
                            <span>{storyLog.length} dòng</span>
                        </div>
                        {virtualState.isScrolling && (
                            <div className="w-2 h-2 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full animate-pulse" />
                        )}
                        {/* Nút bật/tắt tự động tạo ảnh */}
                        <button
                            className={`ml-2 px-3 py-1 rounded-xl border ${autoImage ? 'bg-green-500/30 border-green-400/60' : 'bg-gray-700/30 border-gray-500/60'} text-xs`}
                            onClick={() => setAutoImage(v => !v)}
                            title="Bật/tắt tự động tạo ảnh minh họa"
                        >
                            {autoImage ? 'Tự động ảnh: Bật' : 'Tự động ảnh: Tắt'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow min-h-0 relative">
                {!isAiReady ? (
                    <div className="flex items-center justify-center h-full p-6">
                        <div className="text-center bg-red-500/10 backdrop-blur-sm border border-red-400/20 rounded-2xl p-8">
                            <div className="text-red-300 mb-4 text-4xl">⚠️</div>
                            <p className="text-white/80 text-lg font-medium">
                                AI chưa sẵn sàng
                            </p>
                            <p className="text-white/60 text-sm mt-2">
                                Vui lòng kiểm tra API Key và quay về trang chủ
                            </p>
                        </div>
                    </div>
                ) : storyLog.length === 0 ? (
                    <div className="flex items-center justify-center h-full p-6">
                        <div className="text-center bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
                            <div className="text-purple-300 mb-4 text-4xl">📖</div>
                            <p className="text-white/80 text-lg font-medium">
                                Câu chuyện sẽ bắt đầu ở đây...
                            </p>
                            <p className="text-white/60 text-sm mt-2">
                                Hãy chọn một hành động để bắt đầu cuộc phiêu lưu
                            </p>
                        </div>
                    </div>
                ) : (
                    <div
                        ref={scrollElementRef}
                        className="h-full overflow-y-auto pr-2 p-4 md:pb-4 pb-40"
                        onScroll={onScroll}
                    >
                        {/* Simplified non-virtual layout */}
                        <div className="space-y-4">
                            {visibleItems.map((item) => (
                                <VirtualStoryItem
                                    key={item.id}
                                    item={item}
                                    knownEntities={knownEntities}
                                    onEntityClick={onEntityClick}
                                    onHeightMeasured={handleHeightMeasured}
                                />
                            ))}
                            {/* Hiển thị ảnh minh họa dưới cùng */}
                            <div className="mt-6">
                                {imageLoading && (
                                    <div className="flex items-center gap-2 text-white/70"><SpinnerIcon className="w-5 h-5 animate-spin"/> Đang tạo ảnh minh họa...</div>
                                )}
                                {imageError && (
                                    <div className="text-red-400 flex items-center gap-2">
                                        {imageError}
                                        <button className="ml-2 px-2 py-1 rounded bg-red-500/30 border border-red-400/60 text-xs" onClick={() => {
                                            if (storyLog.length > 0) createImage(storyLog[storyLog.length-1]);
                                        }}>Tạo lại ảnh</button>
                                    </div>
                                )}
                                {imageUrl && !imageLoading && !imageError && (
                                    <img src={imageUrl} alt="Minh họa diễn biến" className="w-full rounded-xl border border-white/20 shadow-lg mt-2"/>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading indicator */}
                {isLoading && isAiReady && storyLog.length > 0 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className="flex items-center gap-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-purple-400/30 px-4 py-3 rounded-2xl shadow-2xl">
                            <SpinnerIcon className="w-5 h-5 text-purple-300" />
                            <span className="text-sm text-white font-medium">
                                Đang tạo câu chuyện...
                            </span>
                        </div>
                    </div>
                )}

                {/* Scroll indicators and controls */}
                {storyLog.length > 5 && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                        {/* Scroll to bottom button - always available */}
                        <button
                            onClick={scrollToBottom}
                            className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 hover:from-purple-500/40 hover:to-pink-500/40 backdrop-blur-xl border border-purple-400/40 text-white p-3 rounded-2xl shadow-2xl transition-all hover:scale-110 group"
                            title="Cuộn xuống cuối"
                        >
                            <svg className="w-4 h-4 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Scroll progress bar */}
                {storyLog.length > 10 && (
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/10 backdrop-blur-sm rounded-r-2xl">
                        <div
                            className="bg-gradient-to-b from-purple-400 to-pink-400 w-full transition-all duration-200 rounded-r-2xl"
                            style={{
                                height: `${Math.min(100, (virtualState.scrollTop / (totalHeight - virtualState.containerHeight)) * 100)}%`
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

StoryPanel.displayName = 'StoryPanel';

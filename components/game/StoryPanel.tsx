// components/game/StoryPanel.tsx
import React, { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { SpinnerIcon } from '../Icons';
import { OptimizedInteractiveText } from '../OptimizedInteractiveText';
import { useOptimizedScroll } from '../hooks/useOptimizedScroll';
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
const AUTO_SCROLL_THRESHOLD = 100;

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
        if (itemRef.current) {
            const height = itemRef.current.getBoundingClientRect().height;
            if (height !== item.actualHeight) {
                onHeightMeasured(item.id, height);
            }
        }
    }, [item.content, item.id, item.actualHeight, onHeightMeasured]);

    return (
        <div ref={itemRef} className="story-item">
            <OptimizedInteractiveText
                text={item.content}
                onEntityClick={onEntityClick}
                knownEntities={knownEntities}
            />
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
    const [virtualState, setVirtualState] = useState<VirtualScrollState>({
        scrollTop: 0,
        containerHeight: 400,
        isScrolling: false,
        shouldAutoScroll: true
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

    // Calculate visible range
    const visibleRange = useMemo(() => {
        if (itemPositions.length === 0) return { startIndex: 0, endIndex: -1 };

        const { scrollTop, containerHeight } = virtualState;
        const viewportTop = scrollTop;
        const viewportBottom = scrollTop + containerHeight;

        let startIndex = 0;
        let endIndex = itemPositions.length - 1;

        // Binary search for start index
        let low = 0;
        let high = itemPositions.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const position = itemPositions[mid];
            
            if (position.start + position.height < viewportTop) {
                startIndex = mid + 1;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        // Find end index
        for (let i = startIndex; i < itemPositions.length; i++) {
            if (itemPositions[i].start > viewportBottom) {
                endIndex = i - 1;
                break;
            }
            endIndex = i;
        }

        return {
            startIndex: Math.max(0, startIndex - ITEM_OVERSCAN),
            endIndex: Math.min(itemPositions.length - 1, endIndex + ITEM_OVERSCAN)
        };
    }, [virtualState, itemPositions]);

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

    // Scroll handler with auto-scroll detection
    const handleScroll = useCallback((scrollData: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
        const { scrollTop, scrollHeight, clientHeight } = scrollData;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - AUTO_SCROLL_THRESHOLD;

        setVirtualState(prev => ({
            ...prev,
            scrollTop,
            isScrolling: true,
            shouldAutoScroll: isNearBottom
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

    // Use optimized scroll hook
    const { scrollElementRef, onScroll, scrollToBottom } = useOptimizedScroll(handleScroll, 16);

    // Update container height on resize
    useEffect(() => {
        const updateContainerHeight = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setVirtualState(prev => ({
                    ...prev,
                    containerHeight: rect.height
                }));
            }
        };

        updateContainerHeight();
        window.addEventListener('resize', updateContainerHeight);
        return () => window.removeEventListener('resize', updateContainerHeight);
    }, []);

    // Auto-scroll when new content is added
    useEffect(() => {
        if (virtualState.shouldAutoScroll && storyLog.length > 0) {
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    }, [storyLog.length, virtualState.shouldAutoScroll, scrollToBottom]);

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
            className={`md:col-span-1 flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="flex-shrink-0 p-4 pb-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-pink-700 dark:text-pink-400">
                        Diễn Biến Câu Chuyện:
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{storyLog.length} dòng</span>
                        {virtualState.isScrolling && (
                            <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow min-h-0 relative">
                {!isAiReady ? (
                    <div className="flex items-center justify-center h-full p-4">
                        <div className="text-center">
                            <div className="text-red-500 mb-2 text-2xl">⚠️</div>
                            <p className="text-slate-600 dark:text-slate-400">
                                AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ.
                            </p>
                        </div>
                    </div>
                ) : storyLog.length === 0 ? (
                    <div className="flex items-center justify-center h-full p-4">
                        <div className="text-center">
                            <div className="text-slate-400 mb-2 text-2xl">📖</div>
                            <p className="text-slate-600 dark:text-slate-400">
                                Câu chuyện sẽ bắt đầu ở đây...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div
                        ref={scrollElementRef}
                        className="h-full overflow-y-auto pr-2 p-4 md:pb-4 pb-32"
                        onScroll={onScroll}
                        style={{ height: virtualState.containerHeight }}
                    >
                        <div
                            style={{
                                height: totalHeight,
                                position: 'relative',
                                width: '100%'
                            }}
                        >
                            {/* Virtual items container */}
                            <div
                                style={{
                                    transform: `translateY(${offsetY}px)`,
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0
                                }}
                            >
                                <div className="space-y-4">
                                    {visibleItems.map((item) => {
                                        const itemPosition = itemPositions[item.index];
                                        return (
                                            <div
                                                key={item.id}
                                                style={{
                                                    minHeight: itemPosition.height
                                                }}
                                            >
                                                <VirtualStoryItem
                                                    item={item}
                                                    knownEntities={knownEntities}
                                                    onEntityClick={onEntityClick}
                                                    onHeightMeasured={handleHeightMeasured}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading indicator */}
                {isLoading && isAiReady && storyLog.length > 0 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className="flex items-center gap-2 bg-pink-100 dark:bg-pink-900/50 px-3 py-2 rounded-lg backdrop-blur-sm">
                            <SpinnerIcon className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                            <span className="text-sm text-pink-700 dark:text-pink-300">
                                Đang tạo câu chuyện...
                            </span>
                        </div>
                    </div>
                )}

                {/* Scroll indicators and controls */}
                {storyLog.length > 5 && (
                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                        {/* Scroll to bottom button */}
                        {!virtualState.shouldAutoScroll && (
                            <button
                                onClick={scrollToBottom}
                                className="bg-pink-500 hover:bg-pink-600 text-white p-2 rounded-full shadow-lg transition-all hover:scale-110 group"
                                title="Cuộn xuống cuối"
                            >
                                <svg className="w-4 h-4 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                            </button>
                        )}

                        {/* Auto-scroll indicator */}
                        {virtualState.shouldAutoScroll && (
                            <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs backdrop-blur-sm">
                                Auto-scroll ✓
                            </div>
                        )}
                    </div>
                )}

                {/* Scroll progress bar */}
                {storyLog.length > 10 && (
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-slate-200 dark:bg-slate-700">
                        <div
                            className="bg-pink-500 dark:bg-pink-400 w-full transition-all duration-200"
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

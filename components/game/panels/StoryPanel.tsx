// components/game/panels/StoryPanel.tsx
import React, { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { SpinnerIcon } from '../../Icons.tsx';

const ArrowDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16l-6-6 1.4-1.4L12 13.2l4.6-4.6L18 10l-6 6z"/>
    </svg>
);
import { OptimizedInteractiveText } from '../../OptimizedInteractiveText.tsx';
import { useOptimizedScroll } from '../../hooks/useOptimizedScroll.ts';
import type { KnownEntities } from '../../types.ts';

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

const estimateTextHeight = (text: string): number => {
    const baseHeight = 60;
    const charPerLine = 80;
    const lineHeight = 24;
    const explicitLines = (text.match(/\n/g) || []).length + 1;
    const estimatedWrappedLines = Math.ceil(text.length / charPerLine);
    const totalLines = Math.max(explicitLines, estimatedWrappedLines);
    return Math.max(baseHeight, baseHeight + (totalLines - 1) * lineHeight);
};

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

export const StoryPanel: React.FC<StoryPanelProps> = memo(({
    storyLog,
    isLoading,
    isAiReady,
    knownEntities,
    onEntityClick,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [virtualState, setVirtualState] = useState<VirtualScrollState>({ scrollTop: 0, containerHeight: 400, isScrolling: false, shouldAutoScroll: true });
    const [itemHeights, setItemHeights] = useState<Map<string, number>>(new Map());
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const virtualItems = useMemo<VirtualItem[]>(() => storyLog.map((line, index) => {
        // Create a more stable hash of the content for consistent keys
        const contentHash = line.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        const id = `story-${contentHash}-${index}`;
        return {
            id, index, content: line, estimatedHeight: estimateTextHeight(line),
            actualHeight: itemHeights.get(id)
        };
    }), [storyLog, itemHeights]);

    const itemPositions = useMemo(() => {
        const positions: Array<{ start: number; height: number }> = [];
        let currentPosition = 0;
        virtualItems.forEach(item => {
            const height = item.actualHeight || item.estimatedHeight;
            positions.push({ start: currentPosition, height });
            currentPosition += height;
        });
        return positions;
    }, [virtualItems]);

    const totalHeight = useMemo(() => itemPositions.length > 0 ? itemPositions[itemPositions.length - 1].start + itemPositions[itemPositions.length - 1].height : 0, [itemPositions]);

    const visibleRange = useMemo(() => {
        if (itemPositions.length === 0) return { startIndex: 0, endIndex: -1 };
        const { scrollTop, containerHeight } = virtualState;
        let startIndex = 0, endIndex = itemPositions.length - 1;
        let low = 0, high = itemPositions.length - 1;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (itemPositions[mid].start + itemPositions[mid].height < scrollTop) { startIndex = mid + 1; low = mid + 1; } else { high = mid - 1; }
        }
        for (let i = startIndex; i < itemPositions.length; i++) {
            if (itemPositions[i].start > scrollTop + containerHeight) { endIndex = i - 1; break; }
            endIndex = i;
        }
        return { startIndex: Math.max(0, startIndex - ITEM_OVERSCAN), endIndex: Math.min(itemPositions.length - 1, endIndex + ITEM_OVERSCAN) };
    }, [virtualState, itemPositions]);

    const visibleItems = useMemo(() => visibleRange.endIndex < visibleRange.startIndex ? [] : virtualItems.slice(visibleRange.startIndex, visibleRange.endIndex + 1), [virtualItems, visibleRange]);

    const handleHeightMeasured = useCallback((id: string, height: number) => setItemHeights(prev => new Map(prev).set(id, height)), []);

    const handleScroll = useCallback((scrollData: { scrollTop: number; scrollHeight: number; clientHeight: number }) => {
        const { scrollTop, scrollHeight, clientHeight } = scrollData;
        setVirtualState(prev => ({ ...prev, scrollTop, isScrolling: true, shouldAutoScroll: scrollTop + clientHeight >= scrollHeight - AUTO_SCROLL_THRESHOLD }));
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => setVirtualState(prev => ({ ...prev, isScrolling: false })), 150);
    }, []);

    const { scrollElementRef, onScroll, scrollToBottom } = useOptimizedScroll(handleScroll, 16);

    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                setVirtualState(prev => ({ ...prev, containerHeight: containerRef.current!.getBoundingClientRect().height }));
            }
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    // Auto-scroll removed - users can now manually control scrolling

    const offsetY = visibleRange.startIndex > 0 ? itemPositions[visibleRange.startIndex].start : 0;

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
                scrollTimeoutRef.current = null;
            }
        };
    }, []);

    return (
        <div ref={containerRef} className={`md:col-span-1 flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden ${className}`}>
            <div className="flex-shrink-0 p-4 pb-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-pink-700 dark:text-pink-400">Diễn Biến Câu Chuyện:</h2>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <span>{storyLog.length} dòng</span>
                        {virtualState.isScrolling && <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" />}
                    </div>
                </div>
            </div>
            <div className="flex-grow min-h-0 relative">
                {!isAiReady ? (
                    <div className="flex items-center justify-center h-full p-4 text-center">
                        <p className="text-slate-600 dark:text-slate-400">AI chưa sẵn sàng. Vui lòng kiểm tra API Key.</p>
                    </div>
                ) : storyLog.length === 0 ? (
                    <div className="flex items-center justify-center h-full p-4 text-center">
                        <p className="text-slate-600 dark:text-slate-400">Câu chuyện sẽ bắt đầu ở đây...</p>
                    </div>
                ) : (
                    <div ref={scrollElementRef} className="h-full overflow-y-auto pr-2 p-4 md:pb-4 pb-40" onScroll={onScroll} style={{ height: virtualState.containerHeight }}>
                        <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
                            <div style={{ transform: `translateY(${offsetY}px)`, position: 'absolute', top: 0, left: 0, right: 0 }}>
                                <div className="space-y-4">
                                    {visibleItems.map(item => (
                                        <div key={item.id} style={{ minHeight: itemPositions[item.index].height }}>
                                            <VirtualStoryItem item={item} knownEntities={knownEntities} onEntityClick={onEntityClick} onHeightMeasured={handleHeightMeasured} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {isLoading && isAiReady && storyLog.length > 0 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-pink-100 dark:bg-pink-900/50 px-3 py-2 rounded-lg backdrop-blur-sm">
                        <SpinnerIcon className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                        <span className="text-sm text-pink-700 dark:text-pink-300">Đang tạo câu chuyện...</span>
                    </div>
                )}
                {!isLoading && storyLog.length > 0 && !virtualState.shouldAutoScroll && (
                    <button
                        onClick={scrollToBottom}
                        className="absolute bottom-4 right-4 bg-pink-500 hover:bg-pink-600 dark:bg-pink-600 dark:hover:bg-pink-500 text-white p-2 rounded-full shadow-lg transition-colors duration-200 z-10"
                        title="Cuộn xuống cuối"
                        aria-label="Cuộn xuống cuối câu chuyện"
                    >
                        <ArrowDownIcon className="w-5 h-5" />
                    </button>
                )}
            </div>
        </div>
    );
});

StoryPanel.displayName = 'StoryPanel';

// components/hooks/useOptimizedScroll.ts
import { useCallback, useRef, useEffect } from 'react';
import { useThrottledCallback } from './useDebounce.ts';

interface ScrollOptions {
    threshold?: number;
    throttleDelay?: number;
    behavior?: 'auto' | 'smooth';
}

export function useOptimizedScroll(options: ScrollOptions = {}) {
    const { threshold = 100, throttleDelay = 100, behavior = 'smooth' } = options;
    const scrollElementRef = useRef<HTMLElement | null>(null);
    const isScrollingRef = useRef(false);
    const lastScrollTopRef = useRef(0);

    // Throttled scroll handler to prevent excessive re-renders
    const handleScroll = useThrottledCallback((event: Event) => {
        const target = event.target as HTMLElement;
        if (target) {
            lastScrollTopRef.current = target.scrollTop;
            isScrollingRef.current = true;
            
            // Reset scrolling flag after a delay
            setTimeout(() => {
                isScrollingRef.current = false;
            }, throttleDelay + 50);
        }
    }, throttleDelay);

    // Attach scroll listener
    useEffect(() => {
        const element = scrollElementRef.current;
        if (element) {
            element.addEventListener('scroll', handleScroll, { passive: true });
            return () => {
                element.removeEventListener('scroll', handleScroll);
            };
        }
    }, [handleScroll]);

    // Scroll to bottom function
    const scrollToBottom = useCallback((force = false) => {
        const element = scrollElementRef.current;
        if (!element) return;

        // Check if user is near bottom before auto-scrolling
        const { scrollTop, scrollHeight, clientHeight } = element;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;

        if (force || isNearBottom) {
            element.scrollTo({
                top: scrollHeight,
                behavior: behavior
            });
        }
    }, [threshold, behavior]);

    // Scroll to top function
    const scrollToTop = useCallback(() => {
        const element = scrollElementRef.current;
        if (element) {
            element.scrollTo({
                top: 0,
                behavior: behavior
            });
        }
    }, [behavior]);

    // Scroll to specific position
    const scrollToPosition = useCallback((position: number) => {
        const element = scrollElementRef.current;
        if (element) {
            element.scrollTo({
                top: position,
                behavior: behavior
            });
        }
    }, [behavior]);

    // Check if user is at bottom
    const isAtBottom = useCallback(() => {
        const element = scrollElementRef.current;
        if (!element) return false;

        const { scrollTop, scrollHeight, clientHeight } = element;
        return scrollHeight - scrollTop - clientHeight < threshold;
    }, [threshold]);

    // Check if user is at top
    const isAtTop = useCallback(() => {
        const element = scrollElementRef.current;
        if (!element) return false;

        return element.scrollTop < threshold;
    }, [threshold]);

    // Get current scroll percentage
    const getScrollPercentage = useCallback(() => {
        const element = scrollElementRef.current;
        if (!element) return 0;

        const { scrollTop, scrollHeight, clientHeight } = element;
        const maxScroll = scrollHeight - clientHeight;
        return maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    }, []);

    return {
        scrollElementRef,
        scrollToBottom,
        scrollToTop,
        scrollToPosition,
        isAtBottom,
        isAtTop,
        getScrollPercentage,
        isScrolling: isScrollingRef.current,
        lastScrollTop: lastScrollTopRef.current
    };
}

// Hook for auto-scrolling to bottom when new content is added
export function useAutoScrollToBottom(dependency: any, enabled = true) {
    const { scrollElementRef, scrollToBottom, isAtBottom } = useOptimizedScroll();

    useEffect(() => {
        if (enabled && isAtBottom()) {
            // Small delay to ensure DOM has updated
            setTimeout(() => scrollToBottom(true), 10);
        }
    }, [dependency, enabled, scrollToBottom, isAtBottom]);

    return { scrollElementRef };
}
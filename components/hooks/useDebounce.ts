// components/hooks/useDebounce.ts
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Debounce hook để delay việc update value
 * @param value - Giá trị cần debounce
 * @param delay - Thời gian delay (ms)
 * @returns Giá trị đã được debounce
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Debounced callback hook để delay việc thực thi function
 * @param callback - Function cần debounce
 * @param delay - Thời gian delay (ms)
 * @param deps - Dependencies array
 * @returns Debounced callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number,
    deps: React.DependencyList = []
): T {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);

    // Update callback ref when dependencies change
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback, ...deps]);

    const debouncedCallback = useCallback(
        ((...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            
            timeoutRef.current = setTimeout(() => {
                callbackRef.current.apply(undefined, args);
            }, delay);
        }) as T,
        [delay]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return debouncedCallback;
}

/**
 * Throttle hook để giới hạn tần suất thực thi function
 * @param callback - Function cần throttle
 * @param delay - Thời gian throttle (ms)
 * @returns Throttled callback function
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T {
    const lastCallRef = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const throttledCallback = useCallback(
        ((...args: Parameters<T>) => {
            const now = Date.now();
            const timeSinceLastCall = now - lastCallRef.current;

            if (timeSinceLastCall >= delay) {
                lastCallRef.current = now;
                callbackRef.current.apply(undefined, args);
            } else {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                
                timeoutRef.current = setTimeout(() => {
                    lastCallRef.current = Date.now();
                    callbackRef.current.apply(undefined, args);
                }, delay - timeSinceLastCall);
            }
        }) as T,
        [delay]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return throttledCallback;
}

/**
 * Debounce với cancel function
 * @param callback - Function cần debounce
 * @param delay - Thời gian delay (ms)
 * @returns [debouncedCallback, cancel]
 */
export function useDebouncedCallbackWithCancel<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): [T, () => void] {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const cancel = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const debouncedCallback = useCallback(
        ((...args: Parameters<T>) => {
            cancel();
            timeoutRef.current = setTimeout(() => {
                callbackRef.current.apply(undefined, args);
            }, delay);
        }) as T,
        [delay, cancel]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cancel();
        };
    }, [cancel]);

    return [debouncedCallback, cancel];
}
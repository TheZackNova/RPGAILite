import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Entity } from './types.ts';
import { getIconForLocation } from './utils.ts';
import * as GameIcons from './GameIcons.tsx';
import { CrossIcon, PlusIcon, HomeIcon, PencilIcon } from './Icons.tsx';

// Mobile-specific interfaces
interface TouchPoint {
    x: number;
    y: number;
    id: number;
}

interface PinchGesture {
    initialDistance: number;
    initialScale: number;
}

const MapLegend = ({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) => {
    const iconLegend = [
        { icon: <GameIcons.LocationCurrentIcon />, label: 'Vị trí hiện tại' },
        { icon: <HomeIcon />, label: 'Làng mạc' },
        { icon: <GameIcons.TownIcon />, label: 'Thị trấn' },
        { icon: <GameIcons.CityIcon />, label: 'Thành phố' },
        { icon: <GameIcons.CapitalIcon />, label: 'Thủ đô' },
        { icon: <GameIcons.SectIcon />, label: 'Tông môn/Gia tộc' },
        { icon: <GameIcons.ShopIcon />, label: 'Cửa hàng' },
        { icon: <GameIcons.InnIcon />, label: 'Quán trọ/Tửu điếm' },
        { icon: <GameIcons.ForestIcon />, label: 'Rừng rậm' },
        { icon: <GameIcons.MountainIcon />, label: 'Núi non' },
        { icon: <GameIcons.CaveIcon />, label: 'Hang động' },
        { icon: <GameIcons.DungeonIcon />, label: 'Hầm ngục/Bí cảnh' },
        { icon: <GameIcons.RuinsIcon />, label: 'Tàn tích' },
        { icon: <GameIcons.WaterIcon />, label: 'Sông/Hồ' },
        { icon: <GameIcons.LandmarkIcon />, label: 'Địa danh đặc biệt' },
        { icon: <GameIcons.DefaultLocationIcon />, label: 'Mặc định' },
    ];

    const colorLegend = [
        { color: 'rgb(249, 115, 22)', label: 'Vị trí hiện tại' },
        { color: 'rgb(34, 197, 94)', label: 'Khu Vực An Toàn' },
        { color: 'rgb(14, 165, 233)', label: 'Địa Điểm Đã Khám Phá' },
        { color: 'rgb(107, 114, 128)', label: 'Địa Điểm Chưa Đến' },
        { color: 'rgb(156, 163, 175)', label: 'Đường Đi Đã Biết' },
    ];

    return (
        <>
            {/* Mobile: Collapsible legend button */}
            <div className="md:hidden absolute top-4 left-4 z-10">
                <button
                    onClick={onToggle}
                    className="bg-slate-800/90 backdrop-blur-sm text-white p-2 rounded-lg border border-slate-600 shadow-lg"
                >
                    <GameIcons.MapPinIcon className="w-5 h-5" />
                </button>
                
                {!isCollapsed && (
                    <div className="absolute top-12 left-0 bg-slate-800/95 backdrop-blur-sm p-3 rounded-lg border border-slate-600 shadow-xl max-w-[250px] max-h-[60vh] overflow-y-auto">
                        <h4 className="font-bold text-sm text-purple-300 mb-2">Chú giải</h4>
                        <div className="space-y-1 mb-3">
                            {iconLegend.slice(0, 8).map(item => (
                                <div key={item.label} className="flex items-center text-xs">
                                    <span className="w-4 h-4 mr-2 text-purple-300">{item.icon}</span>
                                    <span className="text-white truncate">{item.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1">
                            {colorLegend.map(item => (
                                <div key={item.label} className="flex items-center text-xs">
                                    <span className="w-3 h-3 mr-2 rounded-full border border-white/20" style={{ backgroundColor: item.color }}></span>
                                    <span className="text-white truncate">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Desktop: Full legend sidebar */}
            <div className="hidden md:block w-64 flex-shrink-0 bg-slate-800/50 p-4 overflow-y-auto rounded-r-lg">
                <h3 className="font-bold text-lg text-purple-300 mb-4">Chú giải Icon</h3>
                <ul className="space-y-2 mb-6">
                    {iconLegend.map(item => (
                        <li key={item.label} className="flex items-center text-sm">
                            <span className="w-5 h-5 mr-3 text-purple-300">{item.icon}</span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
                <h3 className="font-bold text-lg text-purple-300 mb-4">Chú giải Màu sắc</h3>
                <ul className="space-y-2">
                    {colorLegend.map(item => (
                        <li key={item.label} className="flex items-center text-sm">
                            <span className="w-4 h-4 mr-3 rounded-full border border-white/20" style={{ backgroundColor: item.color }}></span>
                            <span>{item.label}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
};

export const MapModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    locations: Entity[];
    currentLocationName: string;
    discoveryOrder: string[];
}> = ({ isOpen, onClose, locations, currentLocationName, discoveryOrder }) => {
    if (!isOpen) return null;
    
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    // View state
    const [view, setView] = useState({ x: 0, y: 0, scale: 0.5 });
    
    // Interaction state
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
    const [isLegendCollapsed, setIsLegendCollapsed] = useState(true);
    
    // Touch and gesture state
    const [touches, setTouches] = useState<TouchPoint[]>([]);
    const [pinchGesture, setPinchGesture] = useState<PinchGesture | null>(null);
    const [lastTouchTime, setLastTouchTime] = useState(0);
    
    // Selected location state for mobile
    const [selectedLocation, setSelectedLocation] = useState<Entity | null>(null);

    // Memoized node positions
    const nodePositions = useMemo(() => {
        const positions: { [key: string]: { x: number, y: number } } = {};
        const xStep = window.innerWidth < 768 ? 150 : 180; // Smaller spacing on mobile
        const yStep = window.innerWidth < 768 ? 100 : 120;
        let currentX = 0;
        let currentY = 0;
        let direction = 1;
        let nodesInRow = 0;
        const maxNodesInRow = window.innerWidth < 768 ? 2 : 3; // Fewer nodes per row on mobile

        discoveryOrder.forEach((name) => {
            positions[name] = { x: currentX, y: currentY };
            
            nodesInRow++;
            if (nodesInRow < maxNodesInRow) {
                currentX += xStep * direction;
            } else {
                currentY += yStep;
                direction *= -1;
                currentX += xStep * direction;
                nodesInRow = 1;
            }
        });
        return positions;
    }, [discoveryOrder]);

    // Helper functions
    const getDistance = (touch1: TouchPoint, touch2: TouchPoint): number => {
        return Math.sqrt(Math.pow(touch1.x - touch2.x, 2) + Math.pow(touch1.y - touch2.y, 2));
    };

    const getTouchPoints = (e: TouchEvent): TouchPoint[] => {
        return Array.from(e.touches).map(touch => ({
            x: touch.clientX,
            y: touch.clientY,
            id: touch.identifier
        }));
    };

    // Touch event handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        const touchPoints = getTouchPoints(e.nativeEvent);
        setTouches(touchPoints);

        if (touchPoints.length === 1) {
            setIsDragging(true);
            setStartDrag({ 
                x: touchPoints[0].x - view.x, 
                y: touchPoints[0].y - view.y 
            });
        } else if (touchPoints.length === 2) {
            setIsDragging(false);
            const distance = getDistance(touchPoints[0], touchPoints[1]);
            setPinchGesture({
                initialDistance: distance,
                initialScale: view.scale
            });
        }
    }, [view]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        const touchPoints = getTouchPoints(e.nativeEvent);

        if (touchPoints.length === 1 && isDragging) {
            // Single finger drag
            setView(prev => ({
                ...prev,
                x: touchPoints[0].x - startDrag.x,
                y: touchPoints[0].y - startDrag.y
            }));
        } else if (touchPoints.length === 2 && pinchGesture) {
            // Pinch to zoom
            const distance = getDistance(touchPoints[0], touchPoints[1]);
            const scaleRatio = distance / pinchGesture.initialDistance;
            const newScale = Math.min(Math.max(0.1, pinchGesture.initialScale * scaleRatio), 3);
            
            setView(prev => ({ ...prev, scale: newScale }));
        }
    }, [isDragging, startDrag, pinchGesture]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const now = Date.now();
        const touchPoints = getTouchPoints(e.nativeEvent);

        // Double tap to zoom
        if (touchPoints.length === 0 && now - lastTouchTime < 300) {
            const newScale = view.scale < 1.5 ? view.scale * 1.5 : 0.5;
            setView(prev => ({ ...prev, scale: newScale }));
        }

        setLastTouchTime(now);
        setIsDragging(false);
        setPinchGesture(null);
        setTouches(touchPoints);
    }, [lastTouchTime, view.scale]);

    // Mouse event handlers (for desktop)
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.min(Math.max(0.1, view.scale + scaleAmount), 3);
        
        const svgPoint = svgRef.current?.createSVGPoint();
        if (svgPoint && svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            svgPoint.x = e.clientX - rect.left;
            svgPoint.y = e.clientY - rect.top;

            const pointTo = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
            
            setView({
                scale: newScale,
                x: view.x - (pointTo.x * (newScale - view.scale)),
                y: view.y - (pointTo.y * (newScale - view.scale)),
            });
        }
    }, [view]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        setStartDrag({ x: e.clientX - view.x, y: e.clientY - view.y });
    }, [view]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setView(prev => ({ ...prev, x: e.clientX - startDrag.x, y: e.clientY - startDrag.y }));
    }, [isDragging, startDrag]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Utility functions
    const zoom = useCallback((factor: number) => {
        setView(prev => ({ ...prev, scale: Math.min(Math.max(0.1, prev.scale * factor), 3) }));
    }, []);

    const resetView = useCallback(() => {
        const currentPos = nodePositions[currentLocationName];
        if (currentPos && svgRef.current) {
            const { width, height } = svgRef.current.getBoundingClientRect();
            setView({
                scale: window.innerWidth < 768 ? 0.7 : 0.5, // Larger initial scale on mobile
                x: -currentPos.x * (window.innerWidth < 768 ? 0.7 : 0.5) + width / 2,
                y: -currentPos.y * (window.innerWidth < 768 ? 0.7 : 0.5) + height / 2,
            });
        }
    }, [nodePositions, currentLocationName]);

    const centerOnLocation = useCallback((locationName: string) => {
        const pos = nodePositions[locationName];
        if (pos && svgRef.current) {
            const { width, height } = svgRef.current.getBoundingClientRect();
            setView(prev => ({
                ...prev,
                x: -pos.x * prev.scale + width / 2,
                y: -pos.y * prev.scale + height / 2,
            }));
        }
    }, [nodePositions]);

    // Initialize view on current location
    useEffect(() => {
        if (isOpen) {
            resetView();
            setIsLegendCollapsed(true);
            setSelectedLocation(null);
        }
    }, [isOpen, resetView]);

    const discoveredLocations = new Set(discoveryOrder);

    // Handle location click for mobile info panel
    const handleLocationClick = useCallback((location: Entity) => {
        if (window.innerWidth < 768) {
            setSelectedLocation(location);
        }
    }, []);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[70] p-2 md:p-4" onClick={onClose}>
            <div 
                ref={containerRef}
                className="bg-[#1f2238] border-2 border-slate-700 rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-[95vh] md:max-h-[90vh] text-white flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-2 md:p-3 border-b-2 border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-lg md:text-xl font-bold text-purple-300 flex items-center gap-2">
                        <GameIcons.MapPinIcon className="w-5 h-5 md:w-6 md:h-6" /> Bản Đồ Thế Giới
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Current location indicator on mobile */}
                        <div className="md:hidden text-xs text-purple-300 truncate max-w-[120px]">
                            📍 {currentLocationName}
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <CrossIcon className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-grow flex overflow-hidden relative">
                    {/* Map area */}
                    <div className="flex-grow relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
                        <svg
                            ref={svgRef}
                            className="w-full h-full select-none"
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            style={{ touchAction: 'none' }}
                        >
                            <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: isDragging ? 'none' : 'transform 0.1s linear' }}>
                                {/* Connection lines */}
                                {discoveryOrder.slice(0, -1).map((name, i) => {
                                    const start = nodePositions[name];
                                    const end = nodePositions[discoveryOrder[i + 1]];
                                    if (!start || !end) return null;
                                    return (
                                        <line 
                                            key={`line-${i}`} 
                                            x1={start.x} 
                                            y1={start.y} 
                                            x2={end.x} 
                                            y2={end.y} 
                                            stroke="rgb(156, 163, 175)" 
                                            strokeWidth="2" 
                                            strokeDasharray="5,5" 
                                        />
                                    );
                                })}
                                
                                {/* Location nodes */}
                                {locations.map(loc => {
                                    const pos = nodePositions[loc.name];
                                    if (!pos) return null;
                                    
                                    const isCurrent = loc.name === currentLocationName;
                                    const isDiscovered = discoveredLocations.has(loc.name);
                                    const isSafe = loc.description?.toLowerCase().includes('an toàn');
                                    
                                    let color = isDiscovered ? 'rgb(14, 165, 233)' : 'rgb(107, 114, 128)';
                                    if (isSafe) color = 'rgb(34, 197, 94)';
                                    if (isCurrent) color = 'rgb(249, 115, 22)';

                                    const nodeSize = window.innerWidth < 768 ? 20 : 25; // Smaller nodes on mobile
                                    const iconSize = window.innerWidth < 768 ? 24 : 32;

                                    return (
                                        <g 
                                            key={loc.name} 
                                            transform={`translate(${pos.x}, ${pos.y})`} 
                                            className={`cursor-pointer transition-transform ${isCurrent ? '' : 'hover:scale-110'}`}
                                            onClick={() => handleLocationClick(loc)}
                                        >
                                            <circle 
                                                r={nodeSize} 
                                                fill={color} 
                                                stroke="rgba(255,255,255,0.4)" 
                                                strokeWidth="2"
                                                className="drop-shadow-lg"
                                            />
                                            <foreignObject 
                                                x={-iconSize/2} 
                                                y={-iconSize/2} 
                                                width={iconSize} 
                                                height={iconSize}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                <div className="w-full h-full flex items-center justify-center text-white">
                                                    {getIconForLocation(loc, isCurrent)}
                                                </div>
                                            </foreignObject>
                                            <text 
                                                y={nodeSize + 15} 
                                                textAnchor="middle" 
                                                fill="white" 
                                                fontSize={window.innerWidth < 768 ? "12" : "14"} 
                                                className="font-semibold pointer-events-none" 
                                                style={{
                                                    paintOrder: "stroke", 
                                                    stroke: "black", 
                                                    strokeWidth: "3px", 
                                                    strokeLinejoin: "round"
                                                }}
                                            >
                                                {loc.name}
                                            </text>
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>

                        {/* Control buttons */}
                        <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
                            <button 
                                onClick={() => zoom(1.2)} 
                                className="w-10 h-10 md:w-12 md:h-12 bg-slate-700/90 hover:bg-slate-600 rounded-lg flex items-center justify-center border border-slate-600 backdrop-blur-sm shadow-lg transition-colors"
                            >
                                <PlusIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                            <button 
                                onClick={() => zoom(0.8)} 
                                className="w-10 h-10 md:w-12 md:h-12 bg-slate-700/90 hover:bg-slate-600 rounded-lg flex items-center justify-center border border-slate-600 backdrop-blur-sm shadow-lg transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                                </svg>
                            </button>
                            <button 
                                onClick={resetView} 
                                className="w-10 h-10 md:w-12 md:h-12 bg-slate-700/90 hover:bg-slate-600 rounded-lg flex items-center justify-center border border-slate-600 backdrop-blur-sm shadow-lg transition-colors"
                            >
                                <HomeIcon className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>

                        {/* Mobile quick navigation */}
                        <div className="md:hidden absolute bottom-4 left-4">
                            <select
                                value={currentLocationName}
                                onChange={(e) => centerOnLocation(e.target.value)}
                                className="bg-slate-800/90 backdrop-blur-sm text-white text-sm border border-slate-600 rounded-lg px-3 py-2 max-w-[150px]"
                            >
                                {discoveryOrder.map(locName => (
                                    <option key={locName} value={locName} className="bg-slate-800">
                                        {locName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Legend */}
                    <MapLegend 
                        isCollapsed={isLegendCollapsed} 
                        onToggle={() => setIsLegendCollapsed(!isLegendCollapsed)} 
                    />
                </div>

                {/* Mobile location info panel */}
                {selectedLocation && (
                    <div className="md:hidden absolute bottom-0 left-0 right-0 bg-slate-800/95 backdrop-blur-sm border-t-2 border-slate-600 p-4 rounded-t-xl max-h-[40%] overflow-y-auto">
                        <div className="flex justify-between items-start mb-3">
                            <h4 className="text-lg font-bold text-purple-300">{selectedLocation.name}</h4>
                            <button 
                                onClick={() => setSelectedLocation(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <CrossIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">
                            <span className="font-semibold">Loại:</span> {selectedLocation.type}
                        </p>
                        {selectedLocation.description && (
                            <p className="text-sm text-gray-300 mb-3">
                                <span className="font-semibold">Mô tả:</span> {selectedLocation.description}
                            </p>
                        )}
                        <div className="flex gap-2">
                            <button 
                                onClick={() => centerOnLocation(selectedLocation.name)}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md transition-colors"
                            >
                                Đi đến
                            </button>
                            <button 
                                onClick={() => setSelectedLocation(null)}
                                className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded-md transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}

                {/* Touch instructions for mobile */}
                <div className="md:hidden absolute top-16 left-4 right-4 text-center">
                    <div className="bg-slate-800/80 backdrop-blur-sm text-xs text-gray-300 px-3 py-2 rounded-lg border border-slate-600 max-w-fit mx-auto">
                        👆 Chạm để kéo • ✌️ Véo để zoom • 👆👆 Chạm đôi để phóng to
                    </div>
                </div>
            </div>
        </div>
    );
};

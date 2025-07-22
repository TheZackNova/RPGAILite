

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Entity } from './types.ts';
import { getIconForLocation } from './utils.ts';
import * as GameIcons from './GameIcons.tsx';
import { CrossIcon, PlusIcon, HomeIcon, PencilIcon, MenuIcon, ArrowRightIcon, MapIcon } from './Icons.tsx';

const LocationDetailsModal: React.FC<{
    location: Entity | null;
    isOpen: boolean;
    onClose: () => void;
    onTravelTo?: (locationName: string) => void;
    canTravelTo?: boolean;
}> = ({ location, isOpen, onClose, onTravelTo, canTravelTo = false }) => {
    if (!isOpen || !location) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-[#1f2238] border-2 border-slate-600 rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto text-white"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="location-title"
            >
                <div className="p-4 border-b border-slate-600 flex justify-between items-center">
                    <h3 id="location-title" className="text-lg font-bold text-purple-300 flex items-center gap-2">
                        {getIconForLocation(location, false)}
                        {location.name}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <CrossIcon className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-4 space-y-4">
                    <div>
                        <h4 className="font-semibold text-purple-300 mb-2">Mô tả</h4>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            {location.description || 'Không có thông tin chi tiết.'}
                        </p>
                    </div>
                    
                    {location.type && (
                        <div>
                            <h4 className="font-semibold text-purple-300 mb-2">Loại địa điểm</h4>
                            <span className="inline-block px-2 py-1 bg-slate-700 rounded text-xs font-medium">
                                {location.type}
                            </span>
                        </div>
                    )}
                    
                    {location.attributes && Object.keys(location.attributes).length > 0 && (
                        <div>
                            <h4 className="font-semibold text-purple-300 mb-2">Thông tin khác</h4>
                            <div className="space-y-1">
                                {Object.entries(location.attributes).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-sm">
                                        <span className="text-gray-400 capitalize">{key}:</span>
                                        <span className="text-gray-300">{String(value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-2 px-4 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                        >
                            Đóng
                        </button>
                        {canTravelTo && onTravelTo && (
                            <button 
                                onClick={() => {
                                    onTravelTo(location.name);
                                    onClose();
                                }}
                                className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowRightIcon className="w-4 h-4" />
                                Di chuyển
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MapLegend: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
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
        { color: 'rgb(14, 165, 233)', label: 'Đã Khám Phá' },
        { color: 'rgb(107, 114, 128)', label: 'Chưa Đến' },
        { color: 'rgb(156, 163, 175)', label: 'Đường Đi' },
    ];

    return (
        <>
            {/* Desktop Legend */}
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
            
            {/* Mobile Legend Modal */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 bg-black/60 z-[80] flex items-end" onClick={onClose}>
                    <div 
                        className="w-full bg-slate-800 p-4 pt-3 rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto animate-[slideUp_0.3s_ease-out]"
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="legend-title"
                    >
                        <div className="w-12 h-1.5 bg-slate-400 rounded-full mx-auto mb-3"></div>
                        <h3 id="legend-title" className="font-bold text-lg text-purple-300 mb-4">Chú giải Bản đồ</h3>
                        
                        <div className="mb-6">
                            <h4 className="font-semibold text-purple-300 mb-3">Icons</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {iconLegend.map(item => (
                                    <div key={item.label} className="flex items-center text-sm">
                                        <span className="w-4 h-4 mr-2 text-purple-300 flex-shrink-0">{item.icon}</span>
                                        <span className="truncate">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="mb-4">
                            <h4 className="font-semibold text-purple-300 mb-3">Màu sắc</h4>
                            <div className="grid grid-cols-1 gap-2">
                                {colorLegend.map(item => (
                                    <div key={item.label} className="flex items-center text-sm">
                                        <span className="w-4 h-4 mr-3 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                                        <span>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <button 
                            onClick={onClose} 
                            className="w-full mt-4 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-md font-semibold transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </>
    )
};


export const MapModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    locations: Entity[];
    currentLocationName: string;
    discoveryOrder: string[];
    onTravelTo?: (locationName: string) => void;
}> = ({ isOpen, onClose, locations, currentLocationName, discoveryOrder, onTravelTo }) => {
    if (!isOpen) return null;
    
    const svgRef = useRef<SVGSVGElement>(null);
    const [view, setView] = useState({ x: 0, y: 0, scale: 0.5 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
    const [showLegend, setShowLegend] = useState(false);
    const [lastTouchDistance, setLastTouchDistance] = useState(0);
    const [selectedLocation, setSelectedLocation] = useState<Entity | null>(null);
    const [showTravelRoutes, setShowTravelRoutes] = useState(false);
    const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
    
    const nodePositions = useMemo(() => {
        const positions: { [key: string]: { x: number, y: number } } = {};
        const xStep = 180;
        const yStep = 120;
        let currentX = 0;
        let currentY = 0;
        let direction = 1;
        let nodesInRow = 0;
        const maxNodesInRow = 3;

        discoveryOrder.forEach((name, i) => {
            positions[name] = { x: currentX, y: currentY };
            
            nodesInRow++;
            if(nodesInRow < maxNodesInRow) {
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
    
    useEffect(() => {
        // Center view on the current location when map opens
        const currentPos = nodePositions[currentLocationName];
        if (currentPos && svgRef.current) {
            const { width, height } = svgRef.current.getBoundingClientRect();
            setView(prev => ({ 
                ...prev,
                x: -currentPos.x * prev.scale + width / 2,
                y: -currentPos.y * prev.scale + height / 2,
            }));
        }
    }, [isOpen, currentLocationName, nodePositions]);


    const handleWheel = (e: React.WheelEvent) => {
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
    };
    
    // Mouse handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartDrag({ x: e.clientX - view.x, y: e.clientY - view.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setView(prev => ({ ...prev, x: e.clientX - startDrag.x, y: e.clientY - startDrag.y }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };
    
    // Touch handlers for mobile
    const getTouchDistance = (touches: TouchList): number => {
        if (touches.length < 2) return 0;
        const touch1 = touches[0];
        const touch2 = touches[1];
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            setIsDragging(true);
            setStartDrag({ x: e.touches[0].clientX - view.x, y: e.touches[0].clientY - view.y });
        } else if (e.touches.length === 2) {
            setLastTouchDistance(getTouchDistance(e.touches));
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        
        if (e.touches.length === 1 && isDragging) {
            // Single finger drag
            setView(prev => ({ 
                ...prev, 
                x: e.touches[0].clientX - startDrag.x, 
                y: e.touches[0].clientY - startDrag.y 
            }));
        } else if (e.touches.length === 2) {
            // Two finger pinch to zoom
            const currentDistance = getTouchDistance(e.touches);
            if (lastTouchDistance > 0) {
                const scaleChange = currentDistance / lastTouchDistance;
                const newScale = Math.min(Math.max(0.1, view.scale * scaleChange), 3);
                setView(prev => ({ ...prev, scale: newScale }));
            }
            setLastTouchDistance(currentDistance);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 0) {
            setIsDragging(false);
            setLastTouchDistance(0);
        } else if (e.touches.length === 1) {
            setLastTouchDistance(0);
        }
    };

    const zoom = (factor: number) => {
        setView(prev => ({...prev, scale: Math.min(Math.max(0.1, prev.scale * factor), 3)}));
    }

    const resetView = () => {
        const currentPos = nodePositions[currentLocationName];
        if (currentPos && svgRef.current) {
            const { width, height } = svgRef.current.getBoundingClientRect();
            setView({
                scale: 0.5,
                x: -currentPos.x * 0.5 + width / 2,
                y: -currentPos.y * 0.5 + height / 2,
            });
        }
    };

    const discoveredLocations = new Set(discoveryOrder);
    
    // Calculate possible travel routes from current location
    const travelRoutes = useMemo(() => {
        if (!showTravelRoutes) return [];
        
        const currentLocationIndex = discoveryOrder.indexOf(currentLocationName);
        if (currentLocationIndex === -1) return [];
        
        const routes: Array<{from: string; to: string; distance: number}> = [];
        
        // Can travel to adjacent discovered locations (within 2-3 steps in discovery order)
        const maxTravelDistance = 3;
        
        discoveryOrder.forEach((locationName, index) => {
            if (locationName === currentLocationName) return;
            
            const distance = Math.abs(index - currentLocationIndex);
            if (distance <= maxTravelDistance) {
                routes.push({
                    from: currentLocationName,
                    to: locationName,
                    distance
                });
            }
        });
        
        return routes;
    }, [currentLocationName, discoveryOrder, showTravelRoutes]);
    
    const handleLocationClick = (location: Entity, e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedLocation(location);
    };
    
    const handleLocationTouchStart = (location: Entity, e: React.TouchEvent) => {
        // Prevent the map pan gesture when touching a location
        e.stopPropagation();
    };
    
    const handleLocationTouchEnd = (location: Entity, e: React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Only trigger click if this was a short tap (not a drag)
        const touch = e.changedTouches[0];
        if (touch) {
            console.log('Touch end on location:', location.name);
            setSelectedLocation(location);
        }
    };
    
    // Also handle regular clicks for desktop and as fallback
    const handleLocationTap = (location: Entity) => {
        console.log('Location tapped:', location.name);
        setSelectedLocation(location);
    };
    
    const handleTravelTo = (locationName: string) => {
        if (onTravelTo) {
            onTravelTo(`di chuyển đến ${locationName}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[70] md:p-4" onClick={onClose}>
            <div className="bg-[#1f2238] border-2 border-slate-700 rounded-lg shadow-2xl w-full h-full md:max-w-7xl md:max-h-[90vh] text-white flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b-2 border-slate-700 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg md:text-xl font-bold text-purple-300 flex items-center gap-2">
                            <GameIcons.MapPinIcon className="w-5 h-5 md:w-6 md:h-6" /> Bản Đồ
                        </h3>
                        <button 
                            onClick={() => setShowLegend(true)} 
                            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
                            aria-label="Hiện thị chú giải"
                        >
                            <MenuIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1"><CrossIcon className="w-6 h-6" /></button>
                </div>
                <div className="flex-grow flex overflow-hidden">
                    <div className="flex-grow relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
                        <svg
                            ref={svgRef}
                            className="w-full h-full cursor-grab"
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
                            <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: 'transform 0.1s linear' }}>
                                {/* Discovery Path Edges */}
                                {discoveryOrder.slice(0, -1).map((name, i) => {
                                    const start = nodePositions[name];
                                    const end = nodePositions[discoveryOrder[i+1]];
                                    if (!start || !end) return null;
                                    return <line key={`discovery-line-${i}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="rgb(156, 163, 175)" strokeWidth="2" strokeDasharray="5,5" />
                                })}
                                
                                {/* Travel Routes */}
                                {showTravelRoutes && travelRoutes.map((route, i) => {
                                    const start = nodePositions[route.from];
                                    const end = nodePositions[route.to];
                                    if (!start || !end) return null;
                                    
                                    const opacity = route.distance <= 1 ? 1 : route.distance <= 2 ? 0.7 : 0.4;
                                    const strokeWidth = route.distance <= 1 ? 4 : route.distance <= 2 ? 3 : 2;
                                    
                                    return (
                                        <g key={`travel-route-${i}`}>
                                            <line 
                                                x1={start.x} y1={start.y} 
                                                x2={end.x} y2={end.y} 
                                                stroke="rgb(34, 197, 94)" 
                                                strokeWidth={strokeWidth}
                                                opacity={opacity}
                                                strokeDasharray="10,5"
                                            />
                                            <circle 
                                                cx={(start.x + end.x) / 2} 
                                                cy={(start.y + end.y) / 2} 
                                                r="8" 
                                                fill="rgb(34, 197, 94)" 
                                                opacity={opacity}
                                            >
                                                <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
                                            </circle>
                                        </g>
                                    );
                                })}
                                
                                {/* Nodes */}
                                {locations.map(loc => {
                                    const pos = nodePositions[loc.name];
                                    if (!pos) return null;
                                    const isCurrent = loc.name === currentLocationName;
                                    const isDiscovered = discoveredLocations.has(loc.name);
                                    const isSafe = loc.description?.toLowerCase().includes('an toàn');
                                    const isHovered = hoveredLocation === loc.name;
                                    
                                    let color = isDiscovered ? 'rgb(14, 165, 233)' : 'rgb(107, 114, 128)';
                                    if(isSafe) color = 'rgb(34, 197, 94)';
                                    if (isCurrent) color = 'rgb(249, 115, 22)';

                                    return (
                                        <g 
                                            key={loc.name} 
                                            transform={`translate(${pos.x}, ${pos.y})`} 
                                            className="cursor-pointer transition-all duration-200"
                                        >
                                            {/* Touch target for better mobile interaction */}
                                            <circle 
                                                r="35" 
                                                fill="rgba(255,255,255,0.05)" 
                                                stroke="rgba(255,255,255,0.1)"
                                                strokeWidth="1"
                                                className="md:hidden"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleLocationTap(loc);
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleLocationTap(loc);
                                                }}
                                            />
                                            
                                            {/* Desktop hover target */}
                                            <circle 
                                                r="30" 
                                                fill="transparent" 
                                                className="hidden md:block"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    handleLocationTap(loc);
                                                }}
                                                onMouseEnter={() => setHoveredLocation(loc.name)}
                                                onMouseLeave={() => setHoveredLocation(null)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            {/* Hover effect ring */}
                                            {isHovered && (
                                                <circle r="35" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                                                    <animate attributeName="r" values="30;40;30" dur="1.5s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0.5;0.2;0.5" dur="1.5s" repeatCount="indefinite" />
                                                </circle>
                                            )}
                                            
                                            
                                            {/* Main circle */}
                                            <circle 
                                                r={isHovered ? "28" : "25"} 
                                                fill={color} 
                                                stroke="rgba(255,255,255,0.3)" 
                                                strokeWidth={isHovered ? "3" : "2"}
                                                className="transition-all duration-200 pointer-events-none"
                                            />
                                            
                                            {/* Travel route indicator */}
                                            {showTravelRoutes && travelRoutes.some(route => route.to === loc.name) && (
                                                <circle r="30" fill="none" stroke="rgb(34, 197, 94)" strokeWidth="2" strokeDasharray="3,3">
                                                    <animateTransform 
                                                        attributeName="transform" 
                                                        type="rotate" 
                                                        values="0;360" 
                                                        dur="3s" 
                                                        repeatCount="indefinite"
                                                    />
                                                </circle>
                                            )}
                                            
                                            <foreignObject x="-16" y="-16" width="32" height="32">
                                                 <div className="w-full h-full flex items-center justify-center text-white pointer-events-none">
                                                    {getIconForLocation(loc, isCurrent)}
                                                </div>
                                            </foreignObject>
                                            <text 
                                                y="45" 
                                                textAnchor="middle" 
                                                fill="white" 
                                                fontSize={isHovered ? "15" : "14"}
                                                className="font-semibold transition-all duration-200 pointer-events-none" 
                                                style={{paintOrder: "stroke", stroke: "black", strokeWidth: "3px", strokeLinejoin: "round"}}
                                            >
                                                {loc.name}
                                            </text>
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>
                        <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
                             <button 
                                onClick={() => setShowTravelRoutes(!showTravelRoutes)} 
                                className={`w-12 h-12 md:w-10 md:h-10 ${showTravelRoutes ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-700/80 hover:bg-slate-600'} rounded-md flex items-center justify-center border border-slate-600 transition-colors`}
                                aria-label="Hiển thị tuyến đường di chuyển"
                             >
                                <MapIcon className="w-5 h-5" />
                             </button>
                             <button onClick={() => zoom(1.2)} className="w-12 h-12 md:w-10 md:h-10 bg-slate-700/80 hover:bg-slate-600 rounded-md flex items-center justify-center border border-slate-600 transition-colors" aria-label="Phóng to"><PlusIcon className="w-6 h-6"/></button>
                             <button onClick={() => zoom(0.8)} className="w-12 h-12 md:w-10 md:h-10 bg-slate-700/80 hover:bg-slate-600 rounded-md flex items-center justify-center border border-slate-600 transition-colors" aria-label="Thu nhỏ"><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 16 16"><path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/></svg></button>
                             <button onClick={resetView} className="w-12 h-12 md:w-10 md:h-10 bg-slate-700/80 hover:bg-slate-600 rounded-md flex items-center justify-center border border-slate-600 transition-colors" aria-label="Quay lại vị trí hiện tại"><GameIcons.MapPinIcon className="w-6 h-6"/></button>
                        </div>
                    </div>
                    <MapLegend isOpen={showLegend} onClose={() => setShowLegend(false)} />
                </div>
                
                {/* Location Details Modal */}
                <LocationDetailsModal 
                    location={selectedLocation}
                    isOpen={!!selectedLocation}
                    onClose={() => setSelectedLocation(null)}
                    onTravelTo={handleTravelTo}
                    canTravelTo={selectedLocation?.name !== currentLocationName && discoveredLocations.has(selectedLocation?.name || '')}
                />
            </div>
        </div>
    );
};
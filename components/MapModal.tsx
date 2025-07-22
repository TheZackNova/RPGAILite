

import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Entity } from './types.ts';
import { getIconForLocation } from './utils.ts';
import * as GameIcons from './GameIcons.tsx';
import { CrossIcon, PlusIcon, HomeIcon, PencilIcon, ClipboardListIcon } from './Icons.tsx';

const MapLegend = () => {
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
        { color: 'rgb(249, 115, 22)', label: 'Vị trí hiện tại (Màu)' },
        { color: 'rgb(34, 197, 94)', label: 'Khu Vực An Toàn' },
        { color: 'rgb(14, 165, 233)', label: 'Địa Điểm Đã Khám Phá' },
        { color: 'rgb(107, 114, 128)', label: 'Địa Điểm Chưa Đến' },
        { color: 'rgb(156, 163, 175)', label: 'Đường Đi Đã Biết' },
    ];

    return (
        <div className="w-full md:w-64 flex-shrink-0 bg-slate-800/50 p-4 overflow-y-auto md:rounded-r-lg">
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
    )
};

const MobileLegendSheet: React.FC<{onClose: () => void}> = ({ onClose }) => (
    <div className="md:hidden fixed inset-0 bg-black/60 z-[75] flex items-end" onClick={onClose}>
        <div 
            className="w-full bg-[#1f2238] p-4 rounded-t-2xl shadow-2xl transition-transform transform translate-y-0 max-h-[60vh] flex flex-col"
            style={{ animation: 'slideUp 0.3s ease-out' }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-3 flex-shrink-0"></div>
            <div className="overflow-y-auto">
                <MapLegend />
            </div>
        </div>
         <style>{`
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
        `}</style>
    </div>
);


export const MapModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    locations: Entity[];
    currentLocationName: string;
    discoveryOrder: string[];
    onLocationClick: (locationName: string) => void;
}> = ({ isOpen, onClose, locations, currentLocationName, discoveryOrder, onLocationClick }) => {
    if (!isOpen) return null;
    
    const svgRef = useRef<SVGSVGElement>(null);
    const [view, setView] = useState({ x: 0, y: 0, scale: 0.5 });
    const [isDragging, setIsDragging] = useState(false);
    const [startDrag, setStartDrag] = useState({ x: 0, y: 0 });
    const touchRef = useRef({ initialDistance: 0, isPinching: false });
    const [isLegendOpen, setIsLegendOpen] = useState(false);
    
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
        if (isOpen) {
            resetView();
        }
    }, [isOpen, currentLocationName, nodePositions]);


    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        
        setView(prev => {
            const newScale = Math.min(Math.max(0.1, prev.scale + scaleAmount), 3);
            const svgPoint = svgRef.current?.createSVGPoint();
            if (svgPoint && svgRef.current) {
                const rect = svgRef.current.getBoundingClientRect();
                svgPoint.x = e.clientX - rect.left;
                svgPoint.y = e.clientY - rect.top;

                const pointTo = svgPoint.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
                
                return {
                    scale: newScale,
                    x: prev.x - (pointTo.x * (newScale - prev.scale)),
                    y: prev.y - (pointTo.y * (newScale - prev.scale)),
                };
            }
            return { ...prev, scale: newScale };
        });
    };
    
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

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setStartDrag({ x: e.touches[0].clientX - view.x, y: e.touches[0].clientY - view.y });
        } else if (e.touches.length === 2) {
            setIsDragging(false);
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            touchRef.current = { initialDistance: dist, isPinching: true };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging && !touchRef.current.isPinching) {
            setView(prev => ({ ...prev, x: e.touches[0].clientX - startDrag.x, y: e.touches[0].clientY - startDrag.y }));
        } else if (e.touches.length === 2 && touchRef.current.isPinching) {
            const newDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scaleFactor = newDist / touchRef.current.initialDistance;
            touchRef.current.initialDistance = newDist;

            setView(prev => {
                const newScale = Math.min(Math.max(0.1, prev.scale * scaleFactor), 3);
                const svgPoint = svgRef.current?.createSVGPoint();
                if (svgPoint && svgRef.current) {
                    const rect = svgRef.current.getBoundingClientRect();
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                    
                    svgPoint.x = midX - rect.left;
                    svgPoint.y = midY - rect.top;

                    const pointTo = svgPoint.matrixTransform(svgRef.current.getScreenCTM()!.inverse());

                    return {
                        scale: newScale,
                        x: prev.x - (pointTo.x * (newScale - prev.scale)),
                        y: prev.y - (pointTo.y * (newScale - prev.scale)),
                    };
                }
                return { ...prev, scale: newScale };
            });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        setIsDragging(false);
        if (e.touches.length < 2) {
            touchRef.current.isPinching = false;
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[75] p-0 sm:p-4" onClick={onClose}>
            <div className="bg-[#1f2238] border-2 border-slate-700 sm:rounded-lg shadow-2xl w-full h-full max-w-7xl max-h-full sm:max-h-[90vh] text-white flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b-2 border-slate-700 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-xl font-bold text-purple-300 flex items-center gap-3">
                        <GameIcons.MapPinIcon className="w-6 h-6" /> Bản Đồ
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none"><CrossIcon className="w-6 h-6" /></button>
                </div>
                <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                    <div className="flex-grow relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
                        <svg
                            ref={svgRef}
                            className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: 'transform 0.1s linear' }}>
                                {/* Edges */}
                                {discoveryOrder.slice(0, -1).map((name, i) => {
                                    const start = nodePositions[name];
                                    const end = nodePositions[discoveryOrder[i+1]];
                                    if (!start || !end) return null;
                                    return <line key={`line-${i}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="rgb(156, 163, 175)" strokeWidth="2" strokeDasharray="5,5" />
                                })}
                                {/* Nodes */}
                                {locations.map(loc => {
                                    const pos = nodePositions[loc.name];
                                    if (!pos) return null;
                                    const isCurrent = loc.name === currentLocationName;
                                    const isDiscovered = discoveredLocations.has(loc.name);
                                    const isSafe = loc.description.toLowerCase().includes('an toàn');
                                    
                                    let color = isDiscovered ? 'rgb(14, 165, 233)' : 'rgb(107, 114, 128)';
                                    if(isSafe) color = 'rgb(34, 197, 94)';
                                    if (isCurrent) color = 'rgb(249, 115, 22)';

                                    return (
                                        <g key={loc.name} transform={`translate(${pos.x}, ${pos.y})`} className="cursor-pointer" onClick={() => onLocationClick(loc.name)}>
                                            <circle r="25" fill={color} stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                                            <foreignObject x="-16" y="-16" width="32" height="32">
                                                 <div className="w-full h-full flex items-center justify-center text-white">
                                                    {getIconForLocation(loc, isCurrent)}
                                                </div>
                                            </foreignObject>
                                            <text y="45" textAnchor="middle" fill="white" fontSize="14" className="font-semibold" style={{paintOrder: "stroke", stroke: "black", strokeWidth: "3px", strokeLinejoin: "round"}}>{loc.name}</text>
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>
                        <div className="absolute bottom-4 right-4 flex flex-col space-y-2">
                             <button onClick={() => zoom(1.2)} className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-md flex items-center justify-center border border-slate-600"><PlusIcon className="w-6 h-6"/></button>
                             <button onClick={() => zoom(0.8)} className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-md flex items-center justify-center border border-slate-600"><svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="currentColor" viewBox="0 0 16 16"><path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/></svg></button>
                             <button onClick={resetView} className="w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-md flex items-center justify-center border border-slate-600"><GameIcons.MapPinIcon className="w-6 h-6"/></button>
                             <button onClick={() => setIsLegendOpen(true)} className="md:hidden w-10 h-10 bg-slate-700/80 hover:bg-slate-600 rounded-md flex items-center justify-center border border-slate-600"><ClipboardListIcon className="w-6 h-6"/></button>
                             {/* Edit button placeholder */}
                             <button className="w-10 h-10 bg-slate-800/50 text-slate-500 cursor-not-allowed rounded-md flex items-center justify-center border border-slate-700"><PencilIcon className="w-5 h-5"/></button>
                        </div>
                    </div>
                    <div className="hidden md:block">
                        <MapLegend />
                    </div>
                </div>
                {isLegendOpen && <MobileLegendSheet onClose={() => setIsLegendOpen(false)} />}
            </div>
        </div>
    );
};
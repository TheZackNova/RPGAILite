import React from 'react';
import { Status } from '../../types';
import * as GameIcons from '../../../components/GameIcons';

interface StatusDetailModalProps {
    status: Status | null;
    onClose: () => void;
}

// Helper functions for status styling
const getIconForStatus = (status: Status): React.ReactNode => {
    if (!status) return <GameIcons.HeartIcon />;
    const name = status.name.toLowerCase();
    const type = status.type;

    if (type === 'buff') return <GameIcons.UpArrowIcon />;
    if (name.includes('độc')) return <GameIcons.PoisonIcon />;
    if (name.includes('chảy máu')) return <GameIcons.BloodDropIcon />;
    if (name.includes('bỏng') || name.includes('hỏa')) return <GameIcons.FireIcon />;
    if (name.includes('tê liệt') || name.includes('choáng')) return <GameIcons.LightningIcon />;
    if (name.includes('gãy') || name.includes('trọng thương') || name.includes('thương tích')) return <GameIcons.BandagedHeartIcon />;
    if (name.includes('tan vỡ') || name.includes('đau khổ')) return <GameIcons.BrokenHeartIcon />;
    if (name.includes('yếu') || name.includes('suy nhược')) return <GameIcons.DownArrowIcon />;
    if (type === 'injury') return <GameIcons.BandagedHeartIcon />;
    if (type === 'debuff') return <GameIcons.DownArrowIcon />;
    
    return <GameIcons.HeartIcon />;
};

const getStatusTextColor = (status: Status): string => {
    if (status.type === 'buff') {
        return 'text-green-600 dark:text-green-400';
    }
    if (status.type === 'debuff' || status.type === 'injury') {
        if (/\b(nặng|trọng|vĩnh viễn)\b/i.test(status.name) || status.duration === 'Vĩnh viễn') {
             return 'text-red-700 dark:text-red-500';
        }
        if (/\b(nhẹ)\b/i.test(status.name)) {
            return 'text-yellow-600 dark:text-yellow-400';
        }
        return 'text-red-600 dark:text-red-400';
    }
    return 'text-slate-600 dark:text-slate-400'; // Neutral
};

const getStatusBorderColor = (status: Status): string => {
    if (status.type === 'buff') {
        return 'border-green-400/50';
    }
    if (status.type === 'debuff' || status.type === 'injury') {
        if (/\b(nặng|trọng|vĩnh viễn)\b/i.test(status.name) || status.duration === 'Vĩnh viễn') {
             return 'border-red-500/50';
        }
        if (/\b(nhẹ)\b/i.test(status.name)) {
            return 'border-yellow-400/50';
        }
        return 'border-red-400/50';
    }
    return 'border-slate-400 dark:border-slate-600/50';
};

export const StatusDetailModal: React.FC<StatusDetailModalProps> = ({ status, onClose }) => {
    if (!status) return null;

    const textColor = getStatusTextColor(status);
    const borderColor = getStatusBorderColor(status).replace('/50', '/80');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className={`bg-white/90 dark:bg-[#2a2f4c]/90 backdrop-blur-sm border-2 ${borderColor} rounded-lg shadow-2xl w-full max-w-md text-slate-900 dark:text-white`} 
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-4 border-b-2 ${borderColor} flex justify-between items-center`}>
                    <h3 className={`text-xl font-bold ${textColor} flex items-center gap-2`}>
                       <span className="w-6 h-6">{getIconForStatus(status)}</span>
                        {status.name}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="p-6 space-y-4 text-slate-700 dark:text-gray-300">
                    <div>
                        <p className="font-semibold text-slate-800 dark:text-gray-100 text-sm uppercase tracking-wider mb-1">Mô tả</p>
                        <p className="italic text-base">"{status.description || 'Không có mô tả chi tiết.'}"</p>
                    </div>
                     <div className="border-t border-slate-200 dark:border-slate-700/60 mt-4 pt-4 space-y-3">
                        {status.effects && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-32 inline-block">Hiệu ứng:</strong> {status.effects}</p>}
                        {status.duration && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-32 inline-block">Thời gian:</strong> {status.duration}</p>}
                        {status.cureConditions && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-32 inline-block">Cách chữa trị:</strong> {status.cureConditions}</p>}
                        {status.source && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-32 inline-block">Nguồn gốc:</strong> {status.source}</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
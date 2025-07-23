import React from 'react';
import { Entity, Status, Quest } from '../types';
import * as GameIcons from '../../components/GameIcons';
import { BrainIcon, InfoIcon, CrossIcon } from 'lucide-react';

// --- Icon Factory ---
export const getIconForEntity = (entity: Entity): React.ReactNode => {
    if (!entity) return <GameIcons.SparklesIcon />;
    const name = entity.name.toLowerCase();
    const type = entity.type;

    if (type === 'item') {
        if (name.includes('kiếm')) return <GameIcons.SwordIcon />;
        if (name.includes('đao')) return <GameIcons.SaberIcon />;
        if (name.includes('thương')) return <GameIcons.SpearIcon />;
        if (name.includes('cung')) return <GameIcons.BowIcon />;
        if (name.includes('trượng')) return <GameIcons.StaffIcon />;
        if (name.includes('búa')) return <GameIcons.AxeIcon />;
        if (name.includes('chủy thủ') || name.includes('dao găm')) return <GameIcons.DaggerIcon />;
        if (name.includes('khiên')) return <GameIcons.ShieldIcon />;
        if (name.includes('giáp')) return <GameIcons.ChestplateIcon />;
        if (name.includes('nón') || name.includes('mũ')) return <GameIcons.HelmetIcon />;
        if (name.includes('ủng') || name.includes('giày')) return <GameIcons.BootsIcon />;
        if (name.includes('thuốc')) return <GameIcons.PotionIcon />;
        if (name.includes('đan')) return <GameIcons.PillIcon />;
        if (name.includes('sách') || name.includes('pháp') || name.includes('quyển')) return <GameIcons.BookIcon />;
        if (name.includes('cuốn') || name.includes('chỉ')) return <GameIcons.ScrollIcon />;
        if (name.includes('nhẫn')) return <GameIcons.RingIcon />;
        if (name.includes('dây chuyền')) return <GameIcons.AmuletIcon />;
        if (name.includes('chìa khóa')) return <GameIcons.KeyIcon />;
        if (name.includes('tiền') || name.includes('vàng') || name.includes('bạc')) return <GameIcons.CoinIcon />;
        if (name.includes('đá') || name.includes('ngọc')) return <GameIcons.GemIcon />;
        if (name.includes('thịt') || name.includes('thực')) return <GameIcons.MeatIcon />;
        return <GameIcons.ChestIcon />;
    }

    if (type === 'skill') {
        if (name.includes('kiếm')) return <GameIcons.SwordIcon />;
        if (name.includes('đao')) return <GameIcons.SaberIcon />;
        if (name.includes('quyền') || name.includes('chưởng')) return <GameIcons.FistIcon />;
        if (name.includes('cước')) return <GameIcons.BootIcon_Skill />;
        if (name.includes('thân pháp')) return <GameIcons.FeatherIcon />;
        if (name.includes('hỏa') || name.includes('lửa')) return <GameIcons.FireIcon />;
        if (name.includes('lôi') || name.includes('sét')) return <GameIcons.LightningIcon />;
        if (name.includes('thủy') || name.includes('nước')) return <GameIcons.WaterDropIcon />;
        if (name.includes('độc')) return <GameIcons.PoisonIcon />;
        if (name.includes('tâm pháp') || name.includes('công pháp') || name.includes('quyết')) return <GameIcons.BookIcon />;
        return <GameIcons.ScrollIcon />;
    }

    if (type === 'npc' || type === 'companion') return <GameIcons.NpcIcon />;
    if (type === 'location') return <GameIcons.MapIcon />;
    if (type === 'faction') return <GameIcons.FlagIcon />;
    if (type === 'concept') return <BrainIcon />;

    return <GameIcons.SparklesIcon />;
};

export const getIconForStatus = (status: Status): React.ReactNode => {
    if (!status) return <InfoIcon />;
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

export const getIconForQuest = (quest: Quest): React.ReactNode => {
    if (!quest) return <GameIcons.ScrollIcon />;
    if (quest.status === 'completed') return <GameIcons.CheckmarkIcon />;
    if (quest.status === 'failed') return <CrossIcon />;
    return <GameIcons.ScrollIcon />;
};

// --- Status Styling Functions ---
export const getStatusTextColor = (status: Status): string => {
    if (!status) return 'text-gray-400';
    
    switch (status.type) {
        case 'buff':
            return 'text-green-400';
        case 'debuff':
            return 'text-red-400';
        case 'injury':
            return 'text-red-500';
        case 'neutral':
            return 'text-blue-400';
        default:
            return 'text-gray-400';
    }
};

export const getStatusFontWeight = (status: Status): string => {
    if (!status) return 'font-normal';
    
    switch (status.type) {
        case 'injury':
            return 'font-bold';
        case 'buff':
        case 'debuff':
            return 'font-semibold';
        case 'neutral':
            return 'font-normal';
        default:
            return 'font-normal';
    }
};

export const getStatusBorderColor = (status: Status): string => {
    if (!status) return 'border-gray-600';
    
    switch (status.type) {
        case 'buff':
            return 'border-green-500';
        case 'debuff':
            return 'border-red-500';
        case 'injury':
            return 'border-red-600';
        case 'neutral':
            return 'border-blue-500';
        default:
            return 'border-gray-600';
    }
};
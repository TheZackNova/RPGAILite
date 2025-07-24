import React, { useRef, useState } from 'react';
import MenuButton from '../../../components/MenuButton';
import { PlayIcon, FileIcon, ChartIcon, SettingsIcon } from '../../../components/Icons';

interface MainMenuProps {
    onStartNewAdventure: () => void;
    onOpenApiSettings: () => void;
    onLoadGameFromFile: (file: File) => void;
    isUsingDefaultKey: boolean;
}

export const MainMenu: React.FC<MainMenuProps> = ({ 
    onStartNewAdventure, 
    onOpenApiSettings, 
    onLoadGameFromFile, 
    isUsingDefaultKey 
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showChangelog, setShowChangelog] = useState(false);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onLoadGameFromFile(file);
        }
        // Reset file input to allow selecting the same file again
        if (event.target) {
            event.target.value = '';
        }
    };
    
    return (
        <div className="bg-white/80 dark:bg-[#1f2238]/80 backdrop-blur-md border border-slate-300 dark:border-slate-700 p-8 rounded-2xl shadow-xl max-w-lg w-full">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".json"
                className="hidden"
            />
            <header className="text-center mb-10">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-wider text-slate-900 dark:text-white">
                    <span className="dark:text-purple-400">ĐÂY LÀ GAME </span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-orange-400">BẠN CÓ THỂ COOK MỌI THỨ</span>
                </h1>
            </header>
            
            <main className="flex flex-col items-center space-y-4">
                <MenuButton 
                    text="Tạo Thế Giới Mới" 
                    icon={<PlayIcon />}
                    onClick={onStartNewAdventure}
                    colorClass="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500"
                    hoverClass="hover:from-purple-700 hover:via-pink-600 hover:to-red-600"
                    focusClass="focus:ring-pink-500"
                />
                <MenuButton 
                    text="Tải Game Từ Tệp (.json)" 
                    icon={<FileIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    colorClass="bg-blue-500"
                    hoverClass="hover:bg-blue-600"
                    focusClass="focus:ring-blue-400"
                />
                <MenuButton 
                    text="Xem Cập Nhật Game" 
                    icon={<ChartIcon />}
                    onClick={() => setShowChangelog(true)}
                    colorClass="bg-green-500"
                    hoverClass="hover:bg-green-600"
                    focusClass="focus:ring-green-400"
                />
                <MenuButton 
                    text="Thiết Lập API Key" 
                    icon={<SettingsIcon />}
                    onClick={onOpenApiSettings}
                    colorClass="bg-slate-700"
                    hoverClass="hover:bg-slate-600"
                    focusClass="focus:ring-slate-500"
                />
            </main>
        
            <footer className="text-center mt-10 text-xs text-slate-600 dark:text-gray-400">
                <p>{isUsingDefaultKey ? 'Đang dùng Gemini AI mặc định.' : 'Đang dùng API Key của bạn.'}</p>
                <p className="mt-1">UserID: 000000000</p>
            </footer>

            {/* Changelog Modal */}
            {showChangelog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cập Nhật Game</h2>
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Phiên bản 1.0.0 - 24/07/2025</h3>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Sửa lỗi thiếu export TopNavigation trong layout components</li>
                                    <li>Sửa lỗi thiếu export TabNavigation trong layout components</li>
                                    <li>Khắc phục lỗi SyntaxError ngăn game khởi động đúng cách</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Các phiên bản trước</h3>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Cải thiện giao diện người dùng</li>
                                    <li>Thêm tính năng lưu và tải game</li>
                                    <li>Tối ưu hóa hiệu suất</li>
                                    <li>Sửa lỗi và cải thiện trải nghiệm</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
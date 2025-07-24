import React, { useState } from 'react';
import { SparklesIcon } from '../Icons';

interface ApiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentApiKey: string;
    isUsingDefault: boolean;
    onSave: (key: string) => void;
    onUseDefault: () => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    currentApiKey, 
    isUsingDefault, 
    onSave, 
    onUseDefault 
}) => {
    if (!isOpen) return null;
    
    const [keyInput, setKeyInput] = useState(isUsingDefault ? '' : currentApiKey);

    const handleSaveClick = () => {
        if (keyInput.trim()) {
            onSave(keyInput.trim());
            onClose();
        }
    };

    const handleDefaultClick = () => {
        onUseDefault();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-3xl font-bold mb-4 text-center text-purple-600 dark:text-purple-300" style={{ textShadow: '0 0 8px rgba(192, 132, 252, 0.5)' }}>Thiết Lập Nguồn AI</h2>
                <div className="bg-white/90 dark:bg-[#252945]/90 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl p-6 space-y-6">

                    {/* Default AI Section */}
                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                        <p className="font-semibold text-sm mb-3 text-slate-800 dark:text-gray-300">Nguồn AI Mặc Định</p>
                        <button
                            onClick={handleDefaultClick}
                            disabled={isUsingDefault}
                            className="w-full flex items-center justify-center px-4 py-2.5 bg-cyan-600 text-white font-semibold rounded-md shadow-md hover:bg-cyan-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 disabled:bg-slate-500 disabled:cursor-not-allowed"
                        >
                            <SparklesIcon className="w-5 h-5 mr-2" />
                            Sử Dụng Gemini AI Mặc Định
                        </button>
                        {isUsingDefault && <p className="text-xs text-green-500 dark:text-green-400 mt-2 px-1 text-center">Đang hoạt động</p>}
                    </div>

                    <div className="text-center text-sm text-gray-500 dark:text-gray-400">hoặc</div>

                    {/* Custom API Key Section */}
                    <div className="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                        <p className="font-semibold text-sm mb-2 text-slate-800 dark:text-gray-300">Sử Dụng API Key Của Bạn</p>
                        <label htmlFor="api-key-input" className="sr-only">Nhập API Key Gemini của bạn</label>
                        <input
                            id="api-key-input"
                            type="password"
                            placeholder="Nhập API Key Gemini của bạn"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
                            API Key của bạn sẽ được lưu trữ cục bộ trên trình duyệt này.
                        </p>
                        <button
                            onClick={handleSaveClick}
                            disabled={!keyInput.trim() || keyInput === currentApiKey && !isUsingDefault}
                            className="w-full mt-3 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-md text-white text-base font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-500 disabled:cursor-not-allowed"
                        >
                            Lưu và Sử Dụng Key Này
                        </button>
                        {!isUsingDefault && <p className="text-xs text-green-500 dark:text-green-400 mt-2 px-1 text-center">Đang hoạt động</p>}
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded-md text-white text-base font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};
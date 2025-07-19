
import React from 'react';

interface MenuButtonProps {
  text: string;
  icon: React.ReactNode;
  colorClass: string;
  hoverClass: string;
  focusClass: string;
  onClick?: () => void;
  disabled?: boolean;
}

const MenuButton: React.FC<MenuButtonProps> = ({ text, icon, colorClass, hoverClass, focusClass, onClick, disabled = false }) => {
  const disabledClasses = 'bg-slate-800 text-gray-500 cursor-not-allowed';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-start w-80 sm:w-96 py-3 px-6 rounded-lg text-white font-semibold shadow-lg 
        transform transition ease-in-out duration-200
        focus:outline-none focus:ring-2 focus:ring-opacity-75
        ${disabled 
          ? disabledClasses
          : `${colorClass} ${hoverClass} ${focusClass} hover:scale-105 hover:shadow-xl`
        }
      `}
    >
      <div className="w-5 h-5 mr-4 flex-shrink-0">{icon}</div>
      <span>{text}</span>
    </button>
  );
};

export default MenuButton;
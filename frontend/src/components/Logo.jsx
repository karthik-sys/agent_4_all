import React from 'react';
import { useDarkMode } from '../DarkModeContext';
import { Moon, Sun } from 'lucide-react';

const Logo = ({ showToggle = true }) => {
  const { darkMode, toggleDarkMode } = useDarkMode();

  return (
    <div className="flex items-center space-x-3">
      {/* Cool Logo */}
      <div className="relative">
        <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-2 rounded-xl transform hover:scale-110 transition-transform">
          <svg
            className="h-6 w-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Shield outline */}
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            {/* AI Circuit pattern inside */}
            <circle cx="12" cy="11" r="1.5" fill="currentColor" />
            <path d="M12 9.5v-2M12 13v2M9.5 11h-2M14.5 11h2" strokeWidth="1.5" />
          </svg>
        </div>
        {/* Pulse animation */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-xl animate-ping opacity-20"></div>
      </div>
      
      <div className="flex items-center space-x-3">
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          AgentGuard
        </span>
        
        {/* Dark Mode Toggle */}
        {showToggle && (
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Moon className="h-5 w-5 text-gray-700" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default Logo;

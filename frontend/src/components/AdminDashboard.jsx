import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Store, LogOut, AlertTriangle } from 'lucide-react';
import AdminMerchants from './AdminMerchants';
import AdminAllAgents from './AdminAllAgents';
import AdminBlockRequests from './AdminBlockRequests';
import Logo from './Logo';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('merchants');

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const getUserInfo = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.email || user.full_name || 'Admin';
      }
    } catch (e) {
      console.error('Failed to parse user info:', e);
    }
    return 'Admin';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-900 dark:to-gray-800">
      <nav className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo showToggle={true} />
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-xl">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-xs text-green-600 dark:text-green-400 font-semibold">ADMIN</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{getUserInfo()}</p>
                </div>
              </div>
              
              <button
                onClick={handleSignOut}
                className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center space-x-2"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage merchants, monitor agents, and oversee the platform
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('merchants')}
              className={`flex-1 py-4 px-6 font-bold transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'merchants'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Store className="h-5 w-5" />
              <span>Merchant Approvals</span>
            </button>
            
            <button
              onClick={() => setActiveTab('agents')}
              className={`flex-1 py-4 px-6 font-bold transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'agents'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Users className="h-5 w-5" />
              <span>All Agents</span>
            </button>

            <button
              onClick={() => setActiveTab('blocks')}
              className={`flex-1 py-4 px-6 font-bold transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'blocks'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span>Block Requests</span>
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'merchants' && <AdminMerchants />}
            {activeTab === 'agents' && <AdminAllAgents />}
            {activeTab === 'blocks' && <AdminBlockRequests />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

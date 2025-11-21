import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '../services/api';
import { Bot, Plus, Search, TrendingUp, DollarSign, Activity, AlertCircle, LogOut, User, Map } from 'lucide-react';

const AgentList = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAgents();
    
    // Poll every 10 seconds for updates
    const interval = setInterval(() => {
      loadAgents();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadAgents = async () => {
    try {
      const data = await agentService.getAllAgents();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError('Failed to load agents: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const filteredAgents = agents.filter(agent => {
    if (!searchTerm) return true;
    const name = agent.name || agent.agent_name || '';
    const id = agent.id || '';
    const tier = agent.tier || '';
    const search = searchTerm.toLowerCase();
    return name.toLowerCase().includes(search) || 
           id.toLowerCase().includes(search) ||
           tier.toLowerCase().includes(search);
  });

  const getTierColor = (tier) => {
    const colors = {
      bronze: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      silver: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      diamond: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return colors[tier] || colors.bronze;
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      revoked: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const getUserInfo = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.email || user.full_name || 'User';
      }
    } catch (e) {
      console.error('Failed to parse user info:', e);
    }
    return 'User';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading agents...</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Sign Out */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">My AI Agents</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your autonomous commerce agents
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* User Info */}
            <div className="hidden md:flex items-center space-x-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700">
              <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {getUserInfo()}
              </span>
            </div>
            
            {/* Network Map Button */}
            <button
              onClick={() => navigate('/network')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center space-x-2"
            >
              <Map className="h-5 w-5" />
              <span>Network Map</span>
            </button>
            
            {/* Register New Agent Button */}
            <button
              onClick={() => navigate('/register-agent')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Register Agent</span>
            </button>
            
            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center space-x-2"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents by name, ID, or tier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                <Bot className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{agents.length}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Agents</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(agents.reduce((sum, a) => sum + (a.remaining_balance || 0), 0))}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Available</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {agents.reduce((sum, a) => sum + (a.transaction_count || 0), 0)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Agents Grid */}
        {filteredAgents.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <Bot className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No agents found' : 'No agents yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm 
                ? 'Try adjusting your search criteria'
                : 'Get started by registering your first AI agent'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/register-agent')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                Register Your First Agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => navigate(`/agent/${agent.id}`)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border border-gray-200 dark:border-gray-700 overflow-hidden group"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-xl">
                      <Bot className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTierColor(agent.tier)}`}>
                        {agent.tier}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{agent.name || agent.agent_name || 'Unnamed Agent'}</h3>
                  <p className="text-blue-100 text-sm font-mono truncate">{agent.id}</p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  {/* Balance */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Remaining Balance</span>
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(agent.remaining_balance)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      of {formatCurrency(agent.balance)} original
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Total Spent</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {formatCurrency(agent.total_volume)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <Activity className="h-4 w-4 text-blue-600" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Transactions</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {agent.transaction_count || 0}
                      </p>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <button className="w-full mt-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg font-semibold group-hover:bg-blue-600 group-hover:text-white transition-all">
                    View Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentList;

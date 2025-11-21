import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '../services/api';
import { Plus, Bot, DollarSign, Activity, TrendingUp, Shield, LogOut, Map } from 'lucide-react';
import AgentRegistrationModal from './AgentRegistrationModal';
import Logo from './Logo';

const Dashboard = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [totalStats, setTotalStats] = useState({
    totalBalance: 0,
    totalVolume: 0,
    totalTransactions: 0,
    avgRiskScore: 0,
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const data = await agentService.listAgents();
      setAgents(data);
      calculateStats(data);
    } catch (err) {
      console.error('Failed to load agents:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (agentData) => {
    const stats = agentData.reduce(
      (acc, agent) => ({
        totalBalance: acc.totalBalance + agent.remaining_balance,
        totalVolume: acc.totalVolume + agent.total_volume,
        totalTransactions: acc.totalTransactions + agent.transaction_count,
        avgRiskScore: acc.avgRiskScore + agent.risk_score,
      }),
      { totalBalance: 0, totalVolume: 0, totalTransactions: 0, avgRiskScore: 0 }
    );

    stats.avgRiskScore = agentData.length > 0 ? Math.round(stats.avgRiskScore / agentData.length) : 0;
    setTotalStats(stats);
  };

  const handleAgentClick = (agentId) => {
    navigate(`/agents/${agentId}`);
  };

  const handleSignOut = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleModalSuccess = () => {
    setShowModal(false);
    loadAgents();
  };

  const getUserEmail = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.email;
      } catch (e) {
        return '';
      }
    }
    return '';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <nav className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo showToggle={true} />
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-purple-100 dark:bg-purple-900/30 px-4 py-2 rounded-xl">
                <Bot className="h-5 w-5 text-purple-600" />
                <span className="text-sm text-purple-600 dark:text-purple-400 font-semibold">{getUserEmail()}</span>
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
            Agent Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your AI agents and monitor their performance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalStats.totalBalance)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Balance</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalStats.totalVolume)}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">
                <Activity className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalStats.totalTransactions}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-xl">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalStats.avgRiskScore}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Risk Score</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Agents</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/network')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center space-x-2"
            >
              <Map className="h-5 w-5" />
              <span>Network Map</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Register New Agent</span>
            </button>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <Bot className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No agents yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Get started by registering your first AI agent
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all inline-flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Register First Agent</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => handleAgentClick(agent.id)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {agent.agent_name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{agent.id}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    agent.status === 'active' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {agent.status.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Balance</span>
                    <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(agent.remaining_balance)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Transactions</span>
                    <span className="font-bold text-gray-900 dark:text-white">{agent.transaction_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Risk Score</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">{agent.risk_score}/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Model</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">{agent.foundational_model || 'Custom'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tier</span>
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded font-semibold">
                      {agent.tier.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AgentRegistrationModal
          onClose={() => setShowModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default Dashboard;

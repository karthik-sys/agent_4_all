import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { agentService } from '../services/api';
import { ArrowLeft, DollarSign, TrendingUp, Activity, Shield, AlertTriangle, Trash2, Plus, Ban } from 'lucide-react';
import TransactionModal from './TransactionModal';

const AgentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  useEffect(() => {
    loadAgentDetails();
  }, [id]);

  const loadAgentDetails = async () => {
    try {
      const agentData = await agentService.getAgent(id);
      const txData = await agentService.getTransactions(id);
      setAgent(agentData);
      setTransactions(txData);
    } catch (err) {
      console.error('Failed to load agent details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (window.confirm(`Are you sure you want to delete ${agent.agent_name}? This action cannot be undone.`)) {
      try {
        await agentService.deleteAgent(id);
        navigate('/dashboard');
      } catch (err) {
        alert('Failed to delete agent: ' + err.message);
      }
    }
  };

  const handleTransactionSuccess = () => {
    setShowTransactionModal(false);
    loadAgentDetails();
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:text-gray-800';
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
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-purple-600 dark:border-purple-400 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-bold text-gray-900 dark:text-white mb-2">Agent not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 flex items-center space-x-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Dashboard</span>
        </button>

        {/* Agent Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8 border-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{agent.agent_name}</h1>
              <p className="text-gray-500 dark:text-gray-400 font-mono text-sm">{agent.id}</p>
              <div className="flex items-center space-x-3 mt-3">
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                  agent.status === 'active' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {agent.status.toUpperCase()}
                </span>
                <span className="px-4 py-2 rounded-full text-sm font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                  {agent.tier.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowTransactionModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>New Transaction</span>
              </button>
              <button
                onClick={handleDeleteAgent}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg flex items-center space-x-2"
              >
                <Trash2 className="h-5 w-5" />
                <span>Delete Agent</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">REMAINING BALANCE</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(agent.remaining_balance)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">of {formatCurrency(agent.balance)} total</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">TOTAL VOLUME</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(agent.total_volume)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All-time spending</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
                <p className="text-sm font-bold text-purple-600 dark:text-purple-400">TRANSACTIONS</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{agent.transaction_count}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completed transactions</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-6 border-2 border-orange-200 dark:border-orange-800">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-lg">
                  <Shield className="h-6 w-6 text-orange-600" />
                </div>
                <p className="text-sm font-bold text-orange-600 dark:text-orange-400">RISK SCORE</p>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{agent.risk_score}<span className="text-xl text-gray-500">/100</span></p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Security rating</p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-5 border-b-2 border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction History</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
            </p>
          </div>

          {transactions.length === 0 ? (
            <div className="p-16 text-center">
              <Activity className="h-20 w-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-500 dark:text-gray-400 mb-2">No transactions yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Get started by making your first transaction</p>
              <button
                onClick={() => setShowTransactionModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
              >
                Make First Transaction
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Merchant
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{tx.merchant_name}</p>
                            {tx.is_blocked && (
                              <div className="flex items-center space-x-1 mt-1">
                                <Ban className="h-3 w-3 text-red-500" />
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                  Currently Blocked
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(tx.amount)}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${getStatusColor(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <TransactionModal
          isOpen={showTransactionModal}
          agent={agent}
          onClose={() => setShowTransactionModal(false)}
          onSuccess={handleTransactionSuccess}
        />
      )}
    </div>
  );
};

export default AgentDetail;

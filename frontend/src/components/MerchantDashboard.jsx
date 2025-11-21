import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { merchantAuthService } from '../services/merchantAuthService';
import { merchantTransactionService } from '../services/api';
import { Store, DollarSign, TrendingUp, Users, Activity, LogOut, Shield, Ban } from 'lucide-react';
import TransactionDetailModal from './TransactionDetailModal';
import BlockAgentModal from './BlockAgentModal';
import BlockWithRefundModal from './BlockWithRefundModal';
import Logo from './Logo';

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [blockModalAgent, setBlockModalAgent] = useState(null);
  const [refundModalTransaction, setRefundModalTransaction] = useState(null);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const merchantInfo = merchantAuthService.getMerchantInfo();
      if (!merchantInfo) {
        navigate('/merchant/login');
        return;
      }

      const data = await merchantTransactionService.getTransactionStats(merchantInfo.id);
      setStats(data.stats);
      setTransactions(data.transactions);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    merchantAuthService.logout();
    navigate('/');
  };

  const getMerchantInfo = () => {
    const info = merchantAuthService.getMerchantInfo();
    return info?.merchant_name || 'Merchant';
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
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
                <Store className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">MERCHANT</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{getMerchantInfo()}</p>
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
            Merchant Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor transactions and manage AI agent interactions
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalTransactions}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.activeAgents}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Agents</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-xl">
                  <TrendingUp className="h-8 w-8 text-yellow-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingTransactions}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
                  <Ban className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.blockedAgents || 0}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Blocked Agents</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recent Transactions</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{tx.agent_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{tx.agent_id}</p>
                        {tx.is_blocked && (
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <Ban className="h-3 w-3 mr-1" />
                            Agent Blocked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(tx.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(tx.status)}`}>
                        {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedTransaction(tx)}
                          className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-all"
                        >
                          View
                        </button>
                        {tx.is_blocked ? (
                          <span className="px-3 py-1 bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed">
                            Agent Blocked
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => setBlockModalAgent(tx)}
                              className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 transition-all flex items-center space-x-1"
                            >
                              <Shield className="h-3 w-3" />
                              <span>Block</span>
                            </button>
                            {tx.status === 'completed' && (
                              <button
                                onClick={() => setRefundModalTransaction(tx)}
                                className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-semibold hover:bg-orange-600 transition-all"
                              >
                                Refund
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transactions.length === 0 && (
            <div className="p-12 text-center">
              <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No transactions yet</p>
            </div>
          )}
        </div>
      </div>

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onTransactionUpdated={(updated) => {
            loadDashboard();
            setSelectedTransaction(null);
          }}
        />
      )}

      {blockModalAgent && (
        <BlockAgentModal
          isOpen={!!blockModalAgent}
          onClose={() => setBlockModalAgent(null)}
          agent={blockModalAgent}
          merchantId={merchantAuthService.getMerchantInfo()?.id}
          onSuccess={loadDashboard}
        />
      )}

      {refundModalTransaction && (
        <BlockWithRefundModal
          isOpen={!!refundModalTransaction}
          onClose={() => setRefundModalTransaction(null)}
          transaction={refundModalTransaction}
          merchantId={merchantAuthService.getMerchantInfo()?.id}
          onSuccess={loadDashboard}
        />
      )}
    </div>
  );
};

export default MerchantDashboard;

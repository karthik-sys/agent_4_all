import React, { useState, useEffect } from 'react';
import { Bot, Search, TrendingUp, DollarSign, Activity, AlertCircle, Shield, User, Eye, Ban, ChevronDown, ChevronRight } from 'lucide-react';
import axios from 'axios';

const AdminAllAgents = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUsers, setExpandedUsers] = useState(new Set());
  const [selectedAgent, setSelectedAgent] = useState(null);

  useEffect(() => {
    loadAllAgents();
    
    const interval = setInterval(() => {
      loadAllAgents();
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  const loadAllAgents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:8081/api/v1/admin/agents', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log('Admin agents loaded:', response.data);
      console.log("Setting agents state:", response.data);
      setAgents(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to load agents:', err);
      setError('Failed to load agents: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAgent = async (agentId) => {
    if (!window.confirm('Are you sure you want to revoke this agent? This action will disable the agent.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:8081/api/v1/agents/${agentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      alert('Agent revoked successfully!');
      loadAllAgents();
    } catch (err) {
      console.error('Failed to revoke agent:', err);
      alert('Failed to revoke agent: ' + (err.response?.data?.message || err.message));
    }
  };

  const toggleUserExpanded = (userEmail) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userEmail)) {
      newExpanded.delete(userEmail);
    } else {
      newExpanded.add(userEmail);
    }
    setExpandedUsers(newExpanded);
  };

  // Group agents by user
  const agentsByUser = agents.reduce((acc, agent) => {
    const owner = agent.owner_email || 'Unknown User';
    if (!acc[owner]) {
      acc[owner] = [];
    }
    acc[owner].push(agent);
    return acc;
  }, {});

  console.log('Agents grouped by user:', agentsByUser);

  const filteredUsers = Object.keys(agentsByUser).filter(owner => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const userAgents = agentsByUser[owner];
    
    return owner.toLowerCase().includes(search) ||
           userAgents.some(agent => 
             (agent.name || agent.agent_name || '').toLowerCase().includes(search) ||
             (agent.id || '').toLowerCase().includes(search)
           );
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading all agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user email, agent name, or agent ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{Object.keys(agentsByUser).length}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Users</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
              <Bot className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{agents.length}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Agents</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(agents.reduce((sum, a) => sum + (a.total_volume || 0), 0))}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Volume</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">
              <Activity className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {agents.reduce((sum, a) => sum + (a.transaction_count || 0), 0)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Total Transactions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center border border-gray-200 dark:border-gray-700">
          <Bot className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No users or agents found' : 'No agents yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm ? 'Try adjusting your search' : 'Agents will appear here once registered'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredUsers.map((userEmail) => {
            const userAgents = agentsByUser[userEmail];
            const isExpanded = expandedUsers.has(userEmail);
            const totalBalance = userAgents.reduce((sum, a) => sum + (a.remaining_balance || a.balance || 0), 0);
            const totalVolume = userAgents.reduce((sum, a) => sum + (a.total_volume || 0), 0);
            const totalTransactions = userAgents.reduce((sum, a) => sum + (a.transaction_count || 0), 0);
            const activeCount = userAgents.filter(a => a.status === 'active').length;

            return (
              <div key={userEmail} className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* User Header - Clickable */}
                <button
                  onClick={() => toggleUserExpanded(userEmail)}
                  className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{userEmail}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {userAgents.length} agent{userAgents.length !== 1 ? 's' : ''} • {activeCount} active
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Balance</p>
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(totalBalance)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatCurrency(totalVolume)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalTransactions}</p>
                      </div>
                      
                      {isExpanded ? (
                        <ChevronDown className="h-6 w-6 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-6 w-6 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* User's Agents Table - Expandable */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Agent Name</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">ID</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Tier</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Balance</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Volume</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">TX</th>
                            <th className="text-left py-3 px-4 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userAgents.map((agent) => (
                            <tr key={agent.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
                              <td className="py-3 px-4">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                  {agent.name || agent.agent_name || 'Unnamed'}
                                </p>
                              </td>
                              <td className="py-3 px-4">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{agent.id}</p>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getTierColor(agent.tier)}`}>
                                  {(agent.tier || 'bronze').toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(agent.status)}`}>
                                  {agent.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {formatCurrency(agent.remaining_balance || agent.balance || 0)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                  {formatCurrency(agent.total_volume || 0)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {agent.transaction_count || 0}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAgent(agent);
                                    }}
                                    className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                    title="View Details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  {agent.status === 'active' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRevokeAgent(agent.id);
                                      }}
                                      className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                      title="Revoke Agent"
                                    >
                                      <Ban className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedAgent(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Agent Details</h3>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedAgent.name || selectedAgent.agent_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedAgent.status)}`}>
                    {selectedAgent.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tier</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getTierColor(selectedAgent.tier)}`}>
                    {selectedAgent.tier?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Protocol</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedAgent.protocol || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Remaining Balance</p>
                  <p className="font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(selectedAgent.remaining_balance || selectedAgent.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Volume</p>
                  <p className="font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(selectedAgent.total_volume)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                  <p className="font-bold text-gray-900 dark:text-white">{selectedAgent.transaction_count || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Owner</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{selectedAgent.owner_email}</p>
                </div>
              </div>
              <div className="col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Agent ID</p>
                <p className="font-mono text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 p-2 rounded">{selectedAgent.id}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAllAgents;

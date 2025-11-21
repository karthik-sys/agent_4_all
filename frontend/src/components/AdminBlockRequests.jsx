import React, { useState, useEffect } from 'react';
import { adminBlockingService, adminLedgerService } from '../services/api';
import { Shield, CheckCircle, XCircle, Clock, DollarSign, AlertCircle, User, Ban } from 'lucide-react';

const AdminBlockRequests = () => {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allBlocks, setAllBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'ledger'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load pending refund requests
      const requests = await adminBlockingService.listBlockRequests();
      setPendingRequests(requests.filter(r => r.status === 'pending'));
      
      // Load complete block ledger
      const ledger = await adminLedgerService.getAllBlocksLedger();
      setAllBlocks(ledger);
      
      setError(null);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this block request? The agent will be blacklisted and refunded.')) {
      return;
    }

    setProcessing(true);
    try {
      await adminBlockingService.approveBlockRequest(requestId, adminNotes);
      alert('Block request approved! Agent has been blacklisted and refunded.');
      setSelectedRequest(null);
      setAdminNotes('');
      loadData();
    } catch (err) {
      alert('Failed to approve request: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeny = async (requestId) => {
    if (!adminNotes.trim()) {
      alert('Please provide a reason for denying this request');
      return;
    }

    setProcessing(true);
    try {
      await adminBlockingService.denyBlockRequest(requestId, adminNotes);
      alert('Block request denied.');
      setSelectedRequest(null);
      setAdminNotes('');
      loadData();
    } catch (err) {
      alert('Failed to deny request: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      denied: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getBlockTypeColor = (type) => {
    if (type === 'simple') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-purple-600 dark:border-purple-400 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
          <p className="text-red-800 dark:text-red-300 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex space-x-2 bg-gray-100 dark:bg-gray-900 p-2 rounded-xl">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'pending'
              ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Pending Requests ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
            activeTab === 'ledger'
              ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Complete Ledger ({allBlocks.length})
        </button>
      </div>

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div>
          {pendingRequests.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
              <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No pending requests</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border-2 border-yellow-200 dark:border-yellow-800"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="bg-gradient-to-br from-red-500 to-pink-600 p-3 rounded-xl">
                          <Shield className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                            Block + Refund Request
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Submitted {new Date(request.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(request.status)}`}>
                      {request.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2">MERCHANT</p>
                      <p className="font-bold text-gray-900 dark:text-white">{request.merchant_name}</p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">AGENT</p>
                      <p className="font-bold text-gray-900 dark:text-white">{request.agent_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">{request.agent_id}</p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">AGENT OWNER</p>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-700 dark:text-gray-300">{request.agent_owner_email}</p>
                      </div>
                    </div>

                    {request.refund_amount && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="flex items-center space-x-2 mb-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <p className="text-xs font-semibold text-green-600 dark:text-green-400">REFUND AMOUNT</p>
                        </div>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(request.refund_amount)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800 mb-4">
                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">SECURITY REASON</p>
                    <p className="text-gray-700 dark:text-gray-300">{request.reason}</p>
                  </div>

                  {selectedRequest?.id === request.id && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Admin Notes (Optional)
                      </label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        rows="3"
                        placeholder="Add any notes about your decision..."
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-3">
                    {selectedRequest?.id !== request.id ? (
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all"
                      >
                        Review Request
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedRequest(null);
                            setAdminNotes('');
                          }}
                          disabled={processing}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={processing}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>{processing ? 'Approving...' : 'Approve & Blacklist'}</span>
                        </button>
                        <button
                          onClick={() => handleDeny(request.id)}
                          disabled={processing}
                          className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-50 flex items-center space-x-2"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>{processing ? 'Denying...' : 'Deny Request'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complete Ledger Tab */}
      {activeTab === 'ledger' && (
        <div>
          {allBlocks.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
              <Ban className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No blocks recorded yet</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow-xl overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Type</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Merchant</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Agent</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Owner</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Reason</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Refund</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allBlocks.map((block) => (
                    <tr key={block.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBlockTypeColor(block.block_type)}`}>
                          {block.block_type === 'simple' ? 'Simple Block' : 'Refund Request'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-gray-900 dark:text-white">
                        {block.merchant_name}
                      </td>
                      <td className="px-6 py-5">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">{block.agent_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{block.agent_id}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600 dark:text-gray-400">
                        {block.agent_owner_email}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                        {block.reason}
                      </td>
                      <td className="px-6 py-5 text-sm font-bold text-gray-900 dark:text-white">
                        {block.refund_amount ? formatCurrency(block.refund_amount) : '-'}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(block.status)}`}>
                          {block.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(block.blocked_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminBlockRequests;

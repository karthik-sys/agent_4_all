import React, { useState } from 'react';
import { X, Bot, User, Mail, DollarSign, Calendar, CheckCircle, Clock, Link as LinkIcon, Package, ShieldCheck, XCircle } from 'lucide-react';
import { merchantTransactionService } from '../services/api';

const TransactionDetailModal = ({ transaction, onClose, onTransactionUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [showDenyInput, setShowDenyInput] = useState(false);
  
  if (!transaction) return null;

  const getStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="h-6 w-6 text-green-600" />;
    if (status === 'pending') return <Clock className="h-6 w-6 text-yellow-600" />;
    if (status === 'failed') return <XCircle className="h-6 w-6 text-red-600" />;
    return <Clock className="h-6 w-6 text-gray-600" />;
  };

  const parseItems = (items) => {
    if (!items) return [];
    if (typeof items === 'string') {
      try { return JSON.parse(items); } catch { return [items]; }
    }
    if (Array.isArray(items)) return items;
    return [];
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const updatedTransaction = await merchantTransactionService.completeTransaction(transaction.id);
      
      if (onTransactionUpdated) {
        onTransactionUpdated(updatedTransaction);
      }
      
      onClose();
    } catch (err) {
      console.error('Failed to approve transaction:', err);
      alert('Failed to approve transaction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) {
      alert('Please provide a reason for denying the transaction');
      return;
    }

    setLoading(true);
    try {
      await merchantTransactionService.denyTransaction(transaction.id, denyReason);
      
      if (onTransactionUpdated) {
        onTransactionUpdated({ ...transaction, status: 'failed' });
      }
      
      onClose();
    } catch (err) {
      console.error('Failed to deny transaction:', err);
      alert('Failed to deny transaction: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const items = parseItems(transaction.items);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-bold text-white">Transaction Details</h2>
            <p className="text-purple-100 text-sm mt-1">ID: {transaction.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3 mb-2">
                {getStatusIcon(transaction.status)}
                <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Status</p>
              </div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(transaction.status)}`}>
                {transaction.status.toUpperCase()}
              </span>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-3 mb-2">
                <DollarSign className="h-6 w-6 text-green-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Amount</p>
              </div>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">${transaction.amount.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{transaction.currency}</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <Bot className="h-5 w-5 mr-2 text-blue-600" />
              AI Agent Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg mr-3">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Agent Name</p>
                  <p className="font-bold text-gray-900 dark:text-white">{transaction.agent_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">{transaction.agent_id}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex items-start">
                  <User className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Agent Owner</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{transaction.agent_owner_name}</p>
                    <div className="flex items-center mt-1">
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.agent_owner_email}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Package className="h-5 w-5 mr-2 text-purple-600" />
                Items Purchased
              </h3>
              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li key={index} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                    <span className="text-gray-700 dark:text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {transaction.checkout_url && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                <LinkIcon className="h-4 w-4 mr-2" />
                Checkout URL
              </h3>
              <a href={transaction.checkout_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm break-all">
                {transaction.checkout_url}
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Created At</p>
                <p className="font-semibold text-gray-900 dark:text-white">{new Date(transaction.created_at).toLocaleString()}</p>
              </div>
            </div>

            {transaction.completed_at && (
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Completed At</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{new Date(transaction.completed_at).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {showDenyInput && transaction.status === 'pending' && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-200 dark:border-red-800">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Reason for Denial
              </label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                rows="3"
                placeholder="Explain why you're denying this transaction..."
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900/50 px-6 py-4 rounded-b-3xl border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3">
            <button onClick={onClose} className="flex-1 px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold">
              Close
            </button>
            
            {transaction.status === 'pending' && !showDenyInput && (
              <>
                <button 
                  onClick={() => setShowDenyInput(true)}
                  className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold flex items-center justify-center space-x-2"
                >
                  <XCircle className="h-5 w-5" />
                  <span>Deny</span>
                </button>
                
                <button 
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all font-semibold flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>{loading ? 'Approving...' : 'Approve'}</span>
                </button>
              </>
            )}

            {showDenyInput && transaction.status === 'pending' && (
              <>
                <button 
                  onClick={() => {
                    setShowDenyInput(false);
                    setDenyReason('');
                  }}
                  className="flex-1 px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeny}
                  disabled={loading || !denyReason.trim()}
                  className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all font-semibold disabled:opacity-50"
                >
                  {loading ? 'Denying...' : 'Confirm Deny'}
                </button>
              </>
            )}
            
            {transaction.status === 'completed' && (
              <div className="flex-1 px-6 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg font-semibold text-center">
                ✓ Transaction Completed
              </div>
            )}

            {transaction.status === 'failed' && (
              <div className="flex-1 px-6 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg font-semibold text-center">
                ✗ Transaction Failed
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailModal;

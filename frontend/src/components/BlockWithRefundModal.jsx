import React, { useState } from 'react';
import { X, Shield, DollarSign, AlertCircle } from 'lucide-react';
import { agentBlockingService } from '../services/api';

const BlockWithRefundModal = ({ isOpen, onClose, transaction, merchantId, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for this block request');
      return;
    }

    setLoading(true);
    try {
      await agentBlockingService.requestBlockWithRefund(
        merchantId,
        transaction.agent_id,
        transaction.id,
        reason
      );
      alert('Block + refund request submitted! Waiting for admin approval.');
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error('Failed to submit request:', err);
      alert('Failed to submit request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-red-600 to-pink-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Request Block + Refund</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-orange-900 dark:text-orange-200">Requires Admin Approval</p>
                <p className="text-sm text-orange-800 dark:text-orange-300 mt-1">
                  This request will be reviewed by an admin. If approved, the transaction will be refunded and the agent will be permanently blacklisted.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transaction ID</p>
              <p className="font-mono text-xs font-bold text-gray-900 dark:text-white">{transaction.id}</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Agent</p>
              <p className="font-semibold text-gray-900 dark:text-white">{transaction.agent_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">{transaction.agent_id}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-3 mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Refund Amount</p>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">${transaction.amount.toFixed(2)}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Security Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              rows="4"
              placeholder="Explain the security reason for blocking and refunding this transaction..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              This will be reviewed by an admin. Be specific about the security concern.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !reason.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-bold hover:from-red-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockWithRefundModal;

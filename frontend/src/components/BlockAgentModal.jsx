import React, { useState } from 'react';
import { X, Shield, AlertTriangle } from 'lucide-react';
import { agentBlockingService } from '../services/api';

const BlockAgentModal = ({ isOpen, onClose, agent, merchantId, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !agent) return null;

  const handleBlock = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for blocking this agent');
      return;
    }

    setLoading(true);
    try {
      await agentBlockingService.blockAgent(merchantId, agent.agent_id, reason);
      alert('Agent blocked successfully');
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      console.error('Failed to block agent:', err);
      alert('Failed to block agent: ' + err.message);
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
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Block Agent</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-yellow-900 dark:text-yellow-200">Simple Block</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                  This will prevent the agent from making future transactions with your store. No refund will be issued.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Agent ID</p>
              <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">{agent.agent_id}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-1">Agent Name</p>
              <p className="font-semibold text-gray-900 dark:text-white">{agent.agent_name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-1">Owner</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{agent.owner_email}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Reason for Blocking *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              rows="4"
              placeholder="Explain why you're blocking this agent..."
            />
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
              onClick={handleBlock}
              disabled={loading || !reason.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl font-bold hover:from-red-700 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Blocking...' : 'Block Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockAgentModal;

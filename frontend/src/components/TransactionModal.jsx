import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, DollarSign, Store, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { agentService, merchantService } from '../services/api';

const TransactionModal = ({ isOpen, onClose, agent, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [loadingMerchants, setLoadingMerchants] = useState(true);
  const [formData, setFormData] = useState({
    merchant_id: '',
    amount: '',
    description: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadMerchants();
    }
  }, [isOpen]);

  const loadMerchants = async () => {
    try {
      const data = await merchantService.getAllMerchants();
      // Filter only approved merchants
      const approvedMerchants = data.filter(m => m.status === 'approved');
      setMerchants(approvedMerchants);
    } catch (err) {
      console.error('Failed to load merchants:', err);
    } finally {
      setLoadingMerchants(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const data = await agentService.createTransaction(agent.id, {
        merchant_id: formData.merchant_id,
        amount: parseFloat(formData.amount),
        description: formData.description || null,
      });
      
      setResult(data);
      
      // If successful, refresh after 2 seconds
      if (data.approved) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err) {
      setResult({
        approved: false,
        status: 'error',
        reason: err.response?.data?.message || 'Transaction failed',
        risk_score: 100,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleClose = () => {
    setFormData({
      merchant_id: '',
      amount: '',
      description: '',
    });
    setResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-6 w-6 text-white" />
            <h2 className="text-xl font-bold text-white">Test Transaction</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          {result && (
            <div className={`mb-6 rounded-xl p-4 ${
              result.approved 
                ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start space-x-3">
                {result.approved ? (
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-bold ${
                    result.approved 
                      ? 'text-green-900 dark:text-green-200' 
                      : 'text-red-900 dark:text-red-200'
                  }`}>
                    {result.approved ? 'Transaction Approved ✓' : 'Transaction Declined'}
                  </p>
                  <p className={`text-sm mt-1 ${
                    result.approved 
                      ? 'text-green-700 dark:text-green-300' 
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {result.reason || (result.approved ? 'Transaction created successfully' : 'Transaction failed')}
                  </p>
                  <div className="mt-3 flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                      Risk Score: {result.risk_score.toFixed(1)}/100
                    </span>
                  </div>
                  {result.approved && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      Transaction visible in merchant dashboard...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Merchant Store
              </label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  name="merchant_id"
                  required
                  value={formData.merchant_id}
                  onChange={handleChange}
                  disabled={loading || result?.approved || loadingMerchants}
                  className="block w-full pl-12 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all disabled:opacity-50"
                >
                  <option value="">
                    {loadingMerchants ? 'Loading merchants...' : 'Select a merchant store'}
                  </option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.merchant_name} ({merchant.domain}) - ⭐{merchant.trust_score}
                    </option>
                  ))}
                </select>
              </div>
              {merchants.length === 0 && !loadingMerchants && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  No approved merchants available. Ask an admin to approve merchants first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Amount (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.amount}
                  onChange={handleChange}
                  disabled={loading || result?.approved}
                  className="block w-full pl-12 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all disabled:opacity-50"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                disabled={loading || result?.approved}
                className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all disabled:opacity-50"
                placeholder="What are you buying?"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || result?.approved || merchants.length === 0}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : result?.approved ? (
                  '✓ Success'
                ) : (
                  'Create Transaction'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;

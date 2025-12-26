import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Shield, DollarSign, Calendar, ArrowLeft, CheckCircle, TrendingUp, Zap } from 'lucide-react';
import { agentService } from '../services/api';

const RegisterAgent = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    tier: 'bronze',
    spending_limit_daily: 1000,
    spending_limit_monthly: 30000,
    spending_limit_per_tx: 100,
    balance: 10000,
    protocol: 'ACP',
    foundational_model: 'Claude',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [registeredAgent, setRegisteredAgent] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const agentData = {
        agent_name: formData.name,
        tier: formData.tier,
        spending_limit_daily: parseFloat(formData.spending_limit_daily),
        spending_limit_monthly: parseFloat(formData.spending_limit_monthly),
        spending_limit_per_tx: parseFloat(formData.spending_limit_per_tx),
        balance: parseFloat(formData.balance),
        protocol: formData.protocol,
        foundational_model: formData.foundational_model,
      };

      console.log('📤 Sending agent registration request:', agentData);
      const response = await agentService.registerAgent(agentData);
      console.log('✅ Registration successful:', response);
      
      setRegisteredAgent(response);
      setSuccess(true);
    } catch (err) {
      console.error('❌ Registration error:', err);
      console.error('Error response:', err.response);
      
      // Extract detailed error message
      let errorMessage = 'Failed to register agent';
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else {
          errorMessage = JSON.stringify(err.response.data);
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
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

  const getTierColor = (tier) => {
    const colors = {
      bronze: 'from-orange-500 to-amber-600',
      silver: 'from-gray-400 to-gray-600',
      gold: 'from-yellow-400 to-yellow-600',
      platinum: 'from-purple-500 to-indigo-600',
      diamond: 'from-blue-400 to-cyan-600',
    };
    return colors[tier] || colors.bronze;
  };

  const getTierBadgeColor = (tier) => {
    const colors = {
      bronze: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      silver: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      diamond: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return colors[tier] || colors.bronze;
  };

  if (success && registeredAgent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center py-12 px-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="text-center mb-8">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-2xl inline-block mb-4">
                <CheckCircle className="h-16 w-16 text-white" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                Agent Registered! 🎉
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Your AI agent has been successfully registered
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6 mb-6 border border-blue-200 dark:border-blue-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Agent Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{registeredAgent.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Agent ID:</span>
                  <span className="font-mono text-sm text-gray-900 dark:text-white">{registeredAgent.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tier:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTierBadgeColor(registeredAgent.tier || formData.tier)}`}>
                    {(registeredAgent.tier || formData.tier).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Initial Balance:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    ${parseFloat(registeredAgent.balance || formData.balance).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                View All Agents
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  setRegisteredAgent(null);
                  setFormData({
                    name: '',
                    tier: 'bronze',
                    spending_limit_daily: 1000,
                    spending_limit_monthly: 30000,
                    spending_limit_per_tx: 100,
                    balance: 10000,
                    protocol: 'ACP',
                    foundational_model: 'Claude',
                  });
                }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Register Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="text-center">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-4 rounded-2xl inline-block mb-4">
              <Bot className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Register New Agent
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configure your AI agent's identity, spending limits, and capabilities
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-red-800 dark:text-red-200 text-sm font-semibold whitespace-pre-wrap">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information Section */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Bot className="h-5 w-5 mr-2 text-blue-600" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                autoComplete="off"
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                    placeholder="My Shopping Agent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Protocol *
                  </label>
                  <select
                    name="protocol"
                    required
                    value={formData.protocol}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  >
                    <option value="ACP">ACP (Agent Commerce Protocol)</option>
                    <option value="MCP">MCP (Model Context Protocol)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Foundational Model *
                  </label>
                  <select
                    name="foundational_model"
                    required
                    value={formData.foundational_model}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  >
                    <option value="Claude">Claude</option>
                    <option value="GPT-4">GPT-4</option>
                    <option value="Gemini">Gemini</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tier Selection */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-purple-600" />
                Agent Tier
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['bronze', 'silver', 'gold', 'platinum', 'diamond'].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setFormData({ ...formData, tier })}
                    className={`p-4 rounded-xl font-bold transition-all ${
                      formData.tier === tier
                        ? `bg-gradient-to-r ${getTierColor(tier)} text-white shadow-lg transform scale-105`
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial Configuration */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                Financial Configuration
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Initial Balance (USD) *
                </label>
                <input
                  type="number"
                  name="balance"
                  required
                  min="0"
                  step="0.01"
                  value={formData.balance}
                  onChange={handleChange}
                autoComplete="off"
                  className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all text-lg font-semibold"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  The starting balance for this agent's wallet
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Daily Spending Limit *
                  </label>
                  <input
                    type="number"
                    name="spending_limit_daily"
                    required
                    min="0"
                    step="0.01"
                    value={formData.spending_limit_daily}
                    onChange={handleChange}
                autoComplete="off"
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum spend per day</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Monthly Spending Limit *
                  </label>
                  <input
                    type="number"
                    name="spending_limit_monthly"
                    required
                    min="0"
                    step="0.01"
                    value={formData.spending_limit_monthly}
                    onChange={handleChange}
                autoComplete="off"
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum spend per month</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Per Transaction Limit *
                  </label>
                  <input
                    type="number"
                    name="spending_limit_per_tx"
                    required
                    min="0"
                    step="0.01"
                    value={formData.spending_limit_per_tx}
                    onChange={handleChange}
                autoComplete="off"
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum per transaction</p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Registering Agent...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    <span>Register Agent</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterAgent;

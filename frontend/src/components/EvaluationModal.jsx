import React, { useState } from 'react';
import { X, ShoppingCart, TrendingDown, Shield, Store, CheckCircle, Loader, Users, Bot } from 'lucide-react';
import { networkService, agentService, teamService } from '../services/api';

const EvaluationModal = ({ isOpen, onClose, agents, teams, preSelectedTeam, onExecute }) => {
  const [itemDescription, setItemDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluations, setEvaluations] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [selectedScope, setSelectedScope] = useState(preSelectedTeam || 'all'); // 'all', 'team-{id}', 'unassigned'

  if (!isOpen) return null;

  const handleEvaluate = async () => {
    if (!itemDescription.trim()) {
      alert('Please enter what you want to buy');
      return;
    }

    setLoading(true);
    try {
      let agentIds = null;
      let teamId = null;
      
      if (selectedScope.startsWith('team-')) {
        teamId = selectedScope.replace('team-', '');
        // Get team details with members
        try {
          const teamDetails = await teamService.getTeamDetails(teamId);
          if (teamDetails && teamDetails.members) {
            agentIds = teamDetails.members.map(m => m.agent_id);
          }
        } catch (err) {
          console.error('Failed to get team details:', err);
          alert('Failed to load team members');
          setLoading(false);
          return;
        }
      } else if (selectedScope === 'unassigned') {
        // Get unassigned agents (agents not in any team)
        // This would need a backend endpoint, for now we'll use all
        agentIds = null;
      }
      
      const result = await networkService.evaluateAgents(itemDescription, agentIds, teamId);
      setEvaluations(result);
    } catch (err) {
      console.error('Evaluation failed:', err);
      alert('Failed to evaluate agents: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (evaluation) => {
    setExecuting(true);
    try {
      const result = await agentService.createTransaction(evaluation.agent_id, {
        merchant_id: evaluation.predicted_merchant_id,
        amount: evaluation.predicted_price,
        description: itemDescription,
      });

      // Mark this evaluation as selected in the backend
      try {
        await fetch(`/api/v1/evaluations/${evaluations.session_id}/select/${evaluation.agent_id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
      } catch (e) {
        console.error('Failed to mark evaluation as selected:', e);
      }

      alert(`✅ Transaction executed! ${evaluation.agent_name} won with $${evaluation.predicted_price.toFixed(2)}`);
      onExecute(result);
      handleClose();
    } catch (err) {
      console.error('Transaction failed:', err);
      alert('Failed to execute transaction: ' + err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleClose = () => {
    setItemDescription('');
    setEvaluations(null);
    setSelectedScope(preSelectedTeam || 'all');
    onClose();
  };

  const getModelColor = (model) => {
    const colors = {
      'gpt-4': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'claude-sonnet-4': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'gemini-pro': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[model] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  const getScopeLabel = () => {
    if (selectedScope === 'all') return 'All Agents';
    if (selectedScope === 'unassigned') return 'Unassigned Agents';
    const team = teams.find(t => t.id === selectedScope.replace('team-', ''));
    return team ? team.team_name : 'Unknown Team';
  };

  const getScopeCount = () => {
    if (selectedScope === 'all') return agents?.length || 'All';
    if (selectedScope === 'unassigned') return '?';
    const team = teams.find(t => t.id === selectedScope.replace('team-', ''));
    return team?.member_count || 0;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border-2 border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-5 flex items-center justify-between rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <ShoppingCart className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Agent Evaluation</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Input Section */}
          {!evaluations && (
            <div className="space-y-4">
              {/* Scope Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Evaluate With
                </label>
                <select
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-lg"
                  disabled={loading}
                >
                  <option value="all">🤖 All Agents ({agents?.length || 'All'})</option>
                  {teams && teams.length > 0 && (
                    <optgroup label="Teams">
                      {teams.map(team => (
                        <option key={team.id} value={`team-${team.id}`}>
                          👥 {team.team_name} ({team.member_count} agents)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="unassigned">⭕ Unassigned Agents</option>
                </select>
              </div>

              {/* Item Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  What are you buying?
                </label>
                <input
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="e.g., iPhone 15 Pro, Gaming Laptop, etc."
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-lg"
                  disabled={loading}
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 <strong>{getScopeCount()} agents</strong> from <strong>{getScopeLabel()}</strong> will evaluate this purchase and predict the best price, merchant, and risk.
                </p>
              </div>

              <button
                onClick={handleEvaluate}
                disabled={loading || !itemDescription.trim()}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    <span>Evaluating Agents...</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5" />
                    <span>Run Evaluation</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results Section */}
          {evaluations && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Evaluation Results
                </h3>
                <button
                  onClick={() => setEvaluations(null)}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                >
                  ← New Evaluation
                </button>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Item: <span className="text-green-700 dark:text-green-400">{itemDescription}</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Session ID: {evaluations.session_id}
                </p>
              </div>

              {/* Evaluation Cards */}
              <div className="space-y-3">
                {evaluations.evaluations.map((evaluation, index) => (
                  <div
                    key={evaluation.agent_id}
                    className={`rounded-xl p-5 border-2 transition-all ${
                      evaluation.is_recommended
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-400 dark:border-green-600 shadow-lg'
                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          {evaluation.is_recommended && (
                            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>WINNER</span>
                            </div>
                          )}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getModelColor(evaluation.foundational_model)}`}>
                            {evaluation.foundational_model}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            #{index + 1}
                          </span>
                        </div>

                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                          {evaluation.agent_name}
                        </h4>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Predicted Price</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                              ${evaluation.predicted_price.toFixed(2)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                              <Store className="h-3 w-3 mr-1" />
                              Merchant
                            </p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {evaluation.predicted_merchant_name}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center">
                              <Shield className="h-3 w-3 mr-1" />
                              Risk Score
                            </p>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {evaluation.predicted_risk_score}/100
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleExecute(evaluation)}
                        disabled={executing}
                        className={`ml-4 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${
                          evaluation.is_recommended
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                        }`}
                      >
                        {executing ? 'Executing...' : 'Execute'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvaluationModal;

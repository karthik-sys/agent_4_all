import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Trophy, TrendingDown, Shield, Store } from 'lucide-react';
import { teamService } from '../services/api';

const TeamHistoryView = () => {
  const navigate = useNavigate();
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      // Load team details
      const teamData = await teamService.getTeamDetails(teamId);
      setTeam(teamData);

      // Load evaluation history for this team
      const response = await fetch(`/api/v1/teams/${teamId}/evaluation-history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      console.log('Evaluation history data:', data);
      setEvaluations(data);
    } catch (err) {
      console.error('Failed to load history:', err);
      alert('Failed to load evaluation history');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const getModelColor = (model) => {
    const colors = {
      'gpt-4': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'claude-sonnet-4': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'gemini-pro': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return colors[model] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/network/teams')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center space-x-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Teams</span>
            </button>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: team?.team_color }}
            ></div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              {team?.team_name} - Evaluation History
            </h1>
          </div>
        </div>

        {/* Evaluation Sessions */}
        {evaluations.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              No evaluation history yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Run evaluations with this team to see history here
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {evaluations.map((session) => (
              <div
                key={session.session_id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Session Header */}
                <div
                  className="p-6"
                  style={{ backgroundColor: team?.team_color + '20' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {session.item_description}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(session.evaluated_at).toLocaleString()}
                      </p>
                    </div>
                    {session.winner && (
                      <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold flex items-center space-x-2">
                        <Trophy className="h-5 w-5" />
                        <span>Winner: {session.winner.agent_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent Evaluations */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {session.agents.map((agent) => (
                      <div
                        key={agent.agent_id}
                        className={`rounded-xl p-4 border-2 transition-all ${
                          agent.was_selected
                            ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-500 dark:border-green-500 shadow-lg'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-bold text-gray-900 dark:text-white">
                            {agent.agent_name}
                          </h4>
                          {agent.was_selected && (
                            <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
                              <Trophy className="h-4 w-4" />
                              <span>WINNER</span>
                            </div>
                          )}
                        </div>

                        <div className={`text-xs px-2 py-1 rounded-full font-bold inline-block mb-3 ${getModelColor(agent.foundational_model)}`}>
                          {agent.foundational_model}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400 flex items-center">
                              <TrendingDown className="h-4 w-4 mr-1" />
                              Predicted:
                            </span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              ${agent.predicted_price.toFixed(2)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400 flex items-center">
                              <Store className="h-4 w-4 mr-1" />
                              Merchant:
                            </span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={agent.predicted_merchant_name}>
                              {agent.predicted_merchant_name}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400 flex items-center">
                              <Shield className="h-4 w-4 mr-1" />
                              Risk:
                            </span>
                            <span className="font-bold text-orange-600">
                              {agent.predicted_risk_score}/100
                            </span>
                          </div>

                          {agent.was_selected && session.transaction && (
                            <div className="mt-3 pt-3 border-t-2 border-green-300 dark:border-green-700">
                              <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2 uppercase">
                                ✅ Purchase Made
                              </p>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-600 dark:text-gray-400">Paid:</span>
                                <span className="font-bold text-green-700 dark:text-green-400 text-lg">
                                  ${session.transaction.amount.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600 dark:text-gray-400">At:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {session.transaction.merchant_name}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Transaction Info if winner exists */}
                  {session.winner && session.transaction && (
                    <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                        <Trophy className="h-5 w-5 mr-2 text-yellow-600" />
                        Transaction Executed
                      </h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1">Amount Paid</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${session.transaction.amount.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1">Merchant</p>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {session.transaction.merchant_name}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 dark:text-gray-400 mb-1">Status</p>
                          <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold">
                            {session.transaction.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamHistoryView;

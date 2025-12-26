import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamService, networkService } from '../services/api';
import { ArrowLeft, TrendingUp, Users, Award, History, Eye, Settings, Trash2 } from 'lucide-react';

const MultiGraphDashboard = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unassignedCount, setUnassignedCount] = useState(0);

  useEffect(() => {
    console.log('MultiGraphDashboard mounted');
    loadTeams();
  }, []);

  const loadTeams = async () => {
    console.log('Loading teams...');
    try {
      const teamsData = await teamService.listTeams();
      console.log('Teams loaded:', teamsData);
      
      // Get detailed stats for each team
      const teamsWithStats = await Promise.all(
        teamsData.map(async (team) => {
          const details = await teamService.getTeamDetails(team.id);
          return {
            ...team,
            members: details.members || [],
          };
        })
      );
      
      setTeams(teamsWithStats);
      
      // TODO: Calculate unassigned agents
      setUnassignedCount(0);
    } catch (err) {
      console.error('Failed to load teams:', err);
      alert('Error loading teams: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"? Agents will not be deleted, only the team.`)) {
      return;
    }

    try {
      await teamService.deleteTeam(teamId);
      alert(`Team "${teamName}" deleted successfully`);
      loadTeams();
    } catch (err) {
      console.error('Failed to delete team:', err);
      alert('Failed to delete team: ' + err.message);
    }
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
              onClick={() => navigate('/network')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center space-x-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Network</span>
            </button>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Team Graphs</h1>
          </div>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all"
            >
              {/* Team Header */}
              <div
                className="p-6"
                style={{ backgroundColor: team.team_color + '20' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: team.team_color }}
                  ></div>
                  <button
                    onClick={() => handleDeleteTeam(team.id, team.team_name)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete Team"
                  >
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {team.team_name}
                </h3>
              </div>

              {/* Team Stats */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Agents</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {team.members.length}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <Award className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">Wins</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {team.members.reduce((sum, m) => sum + (m.win_count || 0), 0)}
                    </p>
                  </div>
                </div>

                {/* Agent Previews */}
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Members:</p>
                  <div className="flex flex-wrap gap-2">
                    {team.members.slice(0, 5).map((member) => (
                      <div
                        key={member.agent_id}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300"
                        title={member.agent_name}
                      >
                        {member.agent_name}
                      </div>
                    ))}
                    {team.members.length > 5 && (
                      <div className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-400">
                        +{team.members.length - 5}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => navigate(`/network/team/${team.id}`)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center space-x-2"
                  >
                    <Eye className="h-5 w-5" />
                    <span>View Graph</span>
                  </button>
                  <button
                    onClick={() => navigate(`/network/team/${team.id}/manage`)}
                    className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center justify-center space-x-2"
                  >
                    <Settings className="h-5 w-5" />
                    <span>Manage Team</span>
                  </button>
                  <button
                    onClick={() => navigate(`/network/team/${team.id}/history`)}
                    className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center justify-center space-x-2"
                  >
                    <History className="h-5 w-5" />
                    <span>View History</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Unassigned Agents Card */}
          {unassignedCount > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all">
              <div className="p-6 bg-gray-100 dark:bg-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Unassigned Agents
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <Users className="h-4 w-4 text-gray-600" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">Agents</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {unassignedCount}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/network/unassigned')}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center space-x-2"
                >
                  <Eye className="h-5 w-5" />
                  <span>View Graph</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {teams.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-20 w-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              No teams yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first team from the Network view
            </p>
            <button
              onClick={() => navigate('/network')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Go to Network View
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiGraphDashboard;

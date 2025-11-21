import React, { useState } from 'react';
import { X, Users, Palette } from 'lucide-react';
import { teamService } from '../services/api';

const TeamCreationModal = ({ isOpen, onClose, selectedAgents, onSuccess }) => {
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(false);

  const colors = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Orange', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Cyan', value: '#06B6D4' },
  ];

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!teamName.trim()) {
      alert('Please enter a team name');
      return;
    }

    setLoading(true);
    try {
      // Create team
      const team = await teamService.createTeam({
        team_name: teamName,
        team_color: teamColor,
      });

      // Add all selected agents to the team
      for (const agentId of selectedAgents) {
        await teamService.addMember(team.id, agentId);
      }

      alert(`Team "${teamName}" created successfully with ${selectedAgents.length} agents!`);
      onSuccess();
    } catch (err) {
      console.error('Failed to create team:', err);
      alert('Failed to create team: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full border-2 border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Create Team</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              Team Name
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g., Alpha Squad, Price Hunters, etc."
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-lg"
              disabled={loading}
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              <Palette className="inline h-4 w-4 mr-1" />
              Team Color
            </label>
            <div className="grid grid-cols-8 gap-3">
              {colors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setTeamColor(color.value)}
                  className={`w-12 h-12 rounded-xl transition-all ${
                    teamColor === color.value
                      ? 'ring-4 ring-offset-2 ring-purple-500 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Selected Agents Preview */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
              Selected Agents ({selectedAgents.length})
            </label>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 max-h-40 overflow-y-auto">
              <div className="space-y-2">
                {selectedAgents.map((agentId, index) => (
                  <div
                    key={agentId}
                    className="flex items-center space-x-3 bg-white dark:bg-gray-600 px-3 py-2 rounded-lg"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: teamColor }}
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Agent #{index + 1}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      {agentId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Team members will be connected</strong> in a cyclic graph and can compete together in evaluations.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !teamName.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Team →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCreationModal;

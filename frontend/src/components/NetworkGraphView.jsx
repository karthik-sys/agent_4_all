import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { networkService, teamService } from '../services/api';
import { Bot, Store, Users, TrendingUp, Award, Target, Plus, Check, ArrowLeft, Home } from 'lucide-react';
import EvaluationModal from './EvaluationModal';
import TeamCreationModal from './TeamCreationModal';

const NetworkGraphView = () => {
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [teams, setTeams] = useState([]);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState([]);

  useEffect(() => {
    loadNetworkData();
    loadTeams();
  }, []);

  const loadNetworkData = async () => {
    try {
      const data = await networkService.getNetworkGraph();
      
      // Convert backend nodes to React Flow nodes
      const flowNodes = data.nodes.map((node, index) => ({
        id: node.id,
        type: node.node_type === 'agent' ? 'agentNode' : 'merchantNode',
        position: calculatePosition(index, data.nodes.length),
        data: {
          label: node.label,
          foundational_model: node.foundational_model,
          tier: node.tier,
          team_color: node.team_color,
          team_ids: node.team_ids || [],
          team_names: node.team_names || [],
          team_colors: node.team_colors || [],
          stats: node.stats,
          node_type: node.node_type,
          selected: false,
        },
      }));

      // Convert backend edges to React Flow edges
      const flowEdges = data.edges.map((edge) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: edge.edge_type === 'team' ? 'default' : 'smoothstep',
        animated: edge.edge_type === 'transaction',
        style: {
          stroke: edge.edge_type === 'team' ? '#8B5CF6' : '#3B82F6',
          strokeWidth: Math.min(edge.weight / 10 + 2, 6),
        },
        markerEnd: edge.edge_type === 'transaction' ? {
          type: MarkerType.ArrowClosed,
        } : undefined,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load network data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      const data = await teamService.listTeams();
      setTeams(data);
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  };

  const calculatePosition = (index, total) => {
    const radius = 300;
    const angle = (index / total) * 2 * Math.PI;
    return {
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle),
    };
  };

  const onNodeClick = useCallback((event, node) => {
    console.log('Node clicked!', { 
      selectionMode, 
      nodeType: node.data.node_type, 
      nodeId: node.id,
      stats: node.data.stats 
    });
    if (selectionMode && node.data.node_type === 'agent') {
      // Toggle selection
      const isSelected = selectedAgents.includes(node.id);
      if (isSelected) {
        setSelectedAgents(selectedAgents.filter(id => id !== node.id));
      } else {
        setSelectedAgents([...selectedAgents, node.id]);
      }
      
      // Update node visual
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: { ...n.data, selected: !isSelected },
            };
          }
          return n;
        })
      );
    } else {
      setSelectedNode(node);
    }
  }, [selectionMode, selectedAgents, setNodes]);

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedAgents([]);
    // Reset all selections
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, selected: false },
      }))
    );
  };

  const handleCreateTeam = () => {
    if (selectedAgents.length < 2) {
      alert('Please select at least 2 agents to create a team');
      return;
    }
    setShowTeamModal(true);
  };

  const handleTeamCreated = () => {
    setShowTeamModal(false);
    setSelectionMode(false);
    setSelectedAgents([]);
    loadNetworkData();
    loadTeams();
  };

  const getModelColor = (model) => {
    const colors = {
      'gpt-4': '#3B82F6',
      'claude-sonnet-4': '#8B5CF6',
      'gemini-pro': '#10B981',
    };
    return colors[model] || '#6B7280';
  };

  // Custom Agent Node Component
  const AgentNode = ({ data }) => {
    const modelColor = getModelColor(data.foundational_model);
    const tierShape = data.tier === 'premium' ? '⬡' : data.tier === 'enterprise' ? '◆' : '●';
    const isWinner = data.stats.win_count > 0;

    return (
      <div
        className={`px-4 py-3 rounded-xl shadow-lg border-2 bg-white dark:bg-gray-800 min-w-[200px] transition-all cursor-pointer hover:scale-105 ${
          data.selected ? 'ring-4 ring-blue-400 scale-110' : ''
        } ${isWinner ? 'border-yellow-400 shadow-yellow-200' : ''}`}
        style={{ 
          borderColor: data.selected ? '#60A5FA' : (data.team_color || modelColor),
        }}
      >
        {isWinner && (
          <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-bold flex items-center space-x-1">
            <Award className="h-3 w-3" />
            <span>WINNER</span>
          </div>
        )}
        
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-2xl">{tierShape}</span>
          <Bot className="h-5 w-5" style={{ color: modelColor }} />
          {data.selected && <Check className="h-5 w-5 text-blue-500" />}
        </div>
        
        <p className="font-bold text-sm text-gray-900 dark:text-white mb-1">
          {data.label}
        </p>
        
        <div className="flex items-center space-x-2 text-xs mb-2">
          <span className="px-2 py-1 rounded-full font-semibold" style={{ 
            backgroundColor: `${modelColor}20`, 
            color: modelColor 
          }}>
            {data.foundational_model}
          </span>
        </div>
        
        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>🏆 Wins:</span>
            <span className="font-bold text-yellow-600">{data.stats.win_count}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>💰 Avg:</span>
            <span className="font-bold">${data.stats.avg_price.toFixed(2)}</span>
          </div>
          {data.stats.last_item && (
            <div className="flex items-center justify-between">
              <span>📦 Last:</span>
              <span className="font-bold text-green-600 truncate max-w-[100px]" title={data.stats.last_item}>
                {data.stats.last_item}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>📊 Txs:</span>
            <span className="font-bold">{data.stats.transaction_count}</span>
          </div>
        </div>
      </div>
    );
  };

  // Custom Merchant Node Component
  const MerchantNode = ({ data }) => {
    return (
      <div className="px-4 py-3 rounded-xl shadow-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 min-w-[150px]">
        <div className="flex items-center space-x-2 mb-2">
          <Store className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
        <p className="font-bold text-sm text-gray-900 dark:text-white mb-1">
          {data.label}
        </p>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center justify-between">
            <span>Transactions:</span>
            <span className="font-bold">{data.stats.transaction_count}</span>
          </div>
        </div>
      </div>
    );
  };

  // Memoize nodeTypes to prevent recreation on every render
  const nodeTypes = React.useMemo(() => ({
    agentNode: AgentNode,
    merchantNode: MerchantNode,
  }), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      {/* Top Stats Bar */}
      <div className="bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center space-x-2"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </button>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {stats?.total_agents || 0} Agents
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {stats?.total_teams || 0} Teams
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {stats?.total_transactions || 0} Transactions
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-600" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {stats?.total_evaluations || 0} Evaluations
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSelectionMode}
              className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center space-x-2 ${
                selectionMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
              }`}
            >
              <Check className="h-5 w-5" />
              <span>{selectionMode ? 'Exit Select Mode' : 'Select Agents'}</span>
            </button>

            {selectionMode && selectedAgents.length >= 2 && (
              <button
                onClick={handleCreateTeam}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center space-x-2 animate-pulse"
              >
                <Plus className="h-5 w-5" />
                <span>Create Team ({selectedAgents.length})</span>
              </button>
            )}

            <button
              onClick={() => setShowEvaluationModal(true)}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all flex items-center space-x-2"
            >
              <Target className="h-5 w-5" />
              <span>Run Evaluation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 flex">
        {/* Main Graph */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800"
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>

        {/* Side Panel */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l-2 border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
          {selectedNode ? (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {selectedNode.data.node_type === 'agent' ? '🤖 Agent Details' : '🏪 Merchant Details'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Name</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {selectedNode.data.label}
                  </p>
                </div>

                {selectedNode.data.foundational_model && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Model</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {selectedNode.data.foundational_model}
                    </p>
                  </div>
                )}

                {selectedNode.data.team_names && selectedNode.data.team_names.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Teams ({selectedNode.data.team_names.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedNode.data.team_names.map((teamName, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: selectedNode.data.team_colors[idx] }}
                        >
                          {teamName}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedNode.data.stats.transaction_count}
                    </p>
                  </div>
                  {selectedNode.data.node_type === 'agent' && (
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Wins</p>
                      <p className="text-2xl font-bold text-green-600">
                        {selectedNode.data.stats.win_count}
                      </p>
                    </div>
                  )}
                </div>

                {selectedNode.data.node_type === 'agent' && (
                  <>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Avg Price</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${selectedNode.data.stats.avg_price.toFixed(2)}
                      </p>
                    </div>

                    {selectedNode.data.stats.last_item && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Last Purchase</p>
                        <p className="text-lg font-semibold text-green-600">
                          {selectedNode.data.stats.last_item}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Risk Score</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {selectedNode.data.stats.risk_score}/100
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
              <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
              {selectionMode ? (
                <p className="text-sm">Click agents to select them for a team</p>
              ) : (
                <p className="text-sm">Click any node to see details</p>
              )}
              
              <div className="mt-8 space-y-3">
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Legend:</p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-xs">GPT-4</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span className="text-xs">Claude</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs">Gemini</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">●</span>
                      <span className="text-xs">Basic Tier</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">⬡</span>
                      <span className="text-xs">Premium Tier</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">◆</span>
                      <span className="text-xs">Enterprise Tier</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Modal */}
      <EvaluationModal
        isOpen={showEvaluationModal}
        onClose={() => setShowEvaluationModal(false)}
        agents={null}
        teams={teams}
        onExecute={() => {
          loadNetworkData();
          setShowEvaluationModal(false);
        }}
      />

      {/* Team Creation Modal */}
      {showTeamModal && (
        <TeamCreationModal
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          selectedAgents={selectedAgents}
          onSuccess={handleTeamCreated}
        />
      )}
    </div>
  );
};

export default NetworkGraphView;

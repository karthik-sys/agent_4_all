import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Bot, Store, ArrowLeft, Target, TrendingUp, Award, Shield, Clock, DollarSign, Package, ChevronDown, ChevronUp } from 'lucide-react';
import EvaluationModal from './EvaluationModal';

const TeamGraphView = () => {
  const navigate = useNavigate();
  const { teamId } = useParams();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showEvaluationModal, setShowEvaluationModal] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  const loadTeamGraph = useCallback(async () => {
    try {
      console.log('🔍 Loading team graph for:', teamId);
      
      // Load team details
      const teamData = await teamService.getTeamDetails(teamId);
      setTeam(teamData);
      console.log('✅ Team loaded:', teamData);

      // Load full network
      const networkData = await networkService.getNetworkGraph();
      console.log('✅ Network data loaded');
      
      // Filter to only show agents in this team
      const teamAgentIds = teamData.members.map(m => m.agent_id);
      console.log('👥 Team agent IDs:', teamAgentIds);
      
      // Get agent nodes
      const agentNodes = networkData.nodes.filter(
        node => node.node_type === 'agent' && teamAgentIds.includes(node.id)
      );
      console.log('🤖 Agent nodes:', agentNodes.length);
      
      // Get merchants that these agents have transacted with
      const merchantIds = new Set();
      networkData.edges.forEach(edge => {
        if (teamAgentIds.includes(edge.source) && edge.edge_type === 'transaction') {
          merchantIds.add(edge.target);
        }
      });
      
      const merchantNodes = networkData.nodes.filter(
        node => node.node_type === 'merchant' && merchantIds.has(node.id)
      );
      console.log('🏪 Merchant nodes:', merchantNodes.length);
      
      const allNodes = [...agentNodes, ...merchantNodes];
      
      // Convert to React Flow nodes
      const flowNodes = allNodes.map((node, index) => ({
        id: node.id,
        type: node.node_type === 'agent' ? 'agentNode' : 'merchantNode',
        position: calculatePosition(index, allNodes.length),
        data: {
          label: node.label,
          foundational_model: node.foundational_model,
          tier: node.tier,
          team_color: teamData.team_color,
          stats: node.stats,
          node_type: node.node_type,
        },
      }));

      // Get valid node IDs
      const validNodeIds = new Set(flowNodes.map(n => n.id));
      
      // Filter edges to only include those between valid nodes
      const validEdges = networkData.edges.filter(
        edge => validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
      );
      console.log('🔗 Valid edges:', validEdges.length);
      
      // Convert to React Flow edges
      const flowEdges = validEdges.map((edge) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: edge.edge_type === 'team' ? 'default' : 'smoothstep',
        animated: edge.edge_type === 'transaction',
        style: {
          stroke: edge.edge_type === 'transaction' ? '#3B82F6' : teamData.team_color,
          strokeWidth: edge.edge_type === 'transaction' ? 2 : 3,
        },
        markerEnd: edge.edge_type === 'transaction' ? {
          type: MarkerType.ArrowClosed,
          color: '#3B82F6',
        } : undefined,
      }));

      // Add team member connections (cyclic)
      const agentNodeIds = flowNodes
        .filter(n => n.type === 'agentNode')
        .map(n => n.id);
      
      if (agentNodeIds.length > 1) {
        for (let i = 0; i < agentNodeIds.length; i++) {
          const nextIndex = (i + 1) % agentNodeIds.length;
          flowEdges.push({
            id: `team-link-${i}`,
            source: agentNodeIds[i],
            target: agentNodeIds[nextIndex],
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: teamData.team_color || '#8B5CF6',
              strokeWidth: 3,
              strokeDasharray: '5,5',
            },
          });
        }
      }

      console.log('✅ Setting nodes:', flowNodes.length);
      console.log('✅ Setting edges:', flowEdges.length);
      
      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (err) {
      console.error('❌ Failed to load team graph:', err);
      alert('Failed to load team graph: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [teamId, setNodes, setEdges]);

  useEffect(() => {
    loadTeamGraph();
  }, [loadTeamGraph]);

  const calculatePosition = (index, total) => {
    const radius = 300;
    const angle = (index / total) * 2 * Math.PI;
    return {
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle),
    };
  };

  const onNodeClick = useCallback((event, node) => {
    console.log('🖱️ Node clicked:', node);
    setSelectedNode(node);
    setShowTransactions(false);
    setTransactions([]);
  }, []);

  const loadTransactions = async (agentId) => {
    setLoadingTransactions(true);
    try {
      const response = await fetch(`/api/v1/agents/${agentId}/transactions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      console.log('📜 Transactions loaded:', data);
      setTransactions(data);
      setShowTransactions(true);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      alert('Failed to load transaction history');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const getModelColor = (model) => {
    const colors = {
      'gpt-4': '#3B82F6',
      'claude-sonnet-4': '#8B5CF6',
      'gemini-pro': '#10B981',
      'llama-3': '#F59E0B',
    };
    return colors[model] || '#6B7280';
  };

  // Agent Node Component
  const AgentNode = ({ data }) => {
    const modelColor = getModelColor(data.foundational_model);
    const tierShape = data.tier === 'premium' ? '⬡' : data.tier === 'enterprise' ? '◆' : '●';

    return (
      <motion.div
        whileHover={{ scale: 1.05, y: -5 }}
        className="px-4 py-3 rounded-2xl shadow-xl border-2 bg-white dark:bg-gray-800 min-w-[200px] cursor-pointer"
        style={{ borderColor: data.team_color || modelColor }}
      >
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-2xl">{tierShape}</span>
          <Bot className="h-5 w-5" style={{ color: modelColor }} />
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
            <span>📊 Txs:</span>
            <span className="font-bold">{data.stats.transaction_count}</span>
          </div>
          {data.stats.last_transaction_amount && (
            <>
              <div className="flex items-center justify-between">
                <span>💰 Last:</span>
                <span className="font-bold text-green-600">${data.stats.last_transaction_amount.toFixed(2)}</span>
              </div>
              {data.stats.last_transaction_item && (
                <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500">📦 {data.stats.last_transaction_item}</span>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    );
  };

  // Merchant Node Component
  const MerchantNode = ({ data }) => {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="px-4 py-3 rounded-2xl shadow-xl border-2 border-gray-300 dark:border-gray-600 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 min-w-[150px] cursor-pointer"
      >
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
      </motion.div>
    );
  };

  const nodeTypes = React.useMemo(() => ({
    agentNode: AgentNode,
    merchantNode: MerchantNode,
  }), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="rounded-full h-16 w-16 border-b-4 border-purple-600"
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b-2 border-gray-200 dark:border-gray-700 px-6 py-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/network/teams')}
              className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center space-x-2 border border-gray-200 dark:border-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back</span>
            </motion.button>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-6 rounded-full shadow-lg"
              style={{ backgroundColor: team?.team_color }}
            ></motion.div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {team?.team_name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {team?.members?.length || 0} agents in team
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEvaluationModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center space-x-2"
          >
            <Target className="h-5 w-5" />
            <span>Run Evaluation</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Graph Canvas */}
      <div className="flex-1 flex">
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'agentNode') return team?.team_color || '#8B5CF6';
                return '#9CA3AF';
              }}
            />
            <Background variant="dots" gap={12} size={1} />
          </ReactFlow>
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            className="w-80 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-l-2 border-gray-200 dark:border-gray-700 p-6 overflow-y-auto shadow-2xl"
          >
            {selectedNode ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center space-x-3 mb-6">
                  {selectedNode.data.node_type === 'agent' ? (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: team?.team_color }}
                    >
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-300 dark:bg-gray-600 flex items-center justify-center shadow-lg">
                      <Store className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedNode.data.label}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedNode.data.node_type === 'agent' ? 'AI Agent' : 'Merchant'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedNode.data.foundational_model && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Model</p>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {selectedNode.data.foundational_model}
                      </p>
                    </div>
                  )}

                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Total Transactions
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {selectedNode.data.stats.transaction_count}
                    </p>
                  </div>

                  {selectedNode.data.stats.last_transaction_amount && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center">
                        <DollarSign className="h-4 w-4 mr-2" />
                        Last Transaction
                      </p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400 mb-1">
                        ${selectedNode.data.stats.last_transaction_amount.toFixed(2)}
                      </p>
                      {selectedNode.data.stats.last_transaction_item && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                          <Package className="h-4 w-4 mr-1" />
                          {selectedNode.data.stats.last_transaction_item}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedNode.data.node_type === 'agent' && selectedNode.data.stats.transaction_count > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => showTransactions ? setShowTransactions(false) : loadTransactions(selectedNode.id)}
                      disabled={loadingTransactions}
                      className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2"
                    >
                      <Clock className="h-5 w-5" />
                      <span>{loadingTransactions ? 'Loading...' : (showTransactions ? 'Hide History' : 'View History')}</span>
                      {!loadingTransactions && (showTransactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </motion.button>
                  )}

                  {showTransactions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        Transaction History
                      </p>
                      {transactions.map((tx, idx) => (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 space-y-2 border border-gray-200 dark:border-gray-600"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              #{transactions.length - idx}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                              tx.status === 'completed' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Amount</span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              ${tx.amount.toFixed(2)}
                            </span>
                          </div>
                          {tx.description && (
                            <div>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Item</p>
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {tx.description}
                              </p>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Bot className="h-20 w-20 mx-auto mb-4" />
                </motion.div>
                <p className="text-sm">Click any node to see details</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Evaluation Modal */}
      {team && (
        <EvaluationModal
          isOpen={showEvaluationModal}
          onClose={() => setShowEvaluationModal(false)}
          agents={team.members}
          teams={[team]}
          preSelectedTeam={`team-${team.id}`}
          onExecute={() => {
            loadTeamGraph();
            setShowEvaluationModal(false);
          }}
        />
      )}
    </div>
  );
};

export default TeamGraphView;

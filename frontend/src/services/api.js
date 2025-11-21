import axios from 'axios';

const API_BASE_URL = 'http://localhost:8081/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const agentService = {
  registerAgent: async (agentData) => {
    const userStr = localStorage.getItem('user');
    let ownerEmail = '';
    let ownerCompany = '';
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        ownerEmail = user.email || '';
        ownerCompany = user.company || user.full_name || 'Personal';
      } catch (e) {
        console.error('Failed to parse user:', e);
      }
    }

    const payload = {
      agent_name: agentData.agent_name,
      tier: agentData.tier,
      spending_limits: {
        daily: agentData.spending_limit_daily,
        monthly: agentData.spending_limit_monthly,
        per_transaction: agentData.spending_limit_per_tx,
      },
      balance: agentData.balance,
      protocol: agentData.protocol,
      foundational_model: agentData.foundational_model,
      owner_email: ownerEmail,
      owner_company: ownerCompany,
    };

    const response = await api.post('/agents/register', payload);
    return response.data;
  },

  // For regular users - ONLY their own agents
  listAgents: async () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      throw new Error('No user logged in');
    }
    
    const user = JSON.parse(userStr);
    const userEmail = user.email;
    
    console.log('🔍 Fetching agents for user:', userEmail);
    
    // Call the user-specific endpoint
    const response = await api.get(`/agents/by-email/${encodeURIComponent(userEmail)}`);
    console.log('✅ Received agents:', response.data.length);
    return response.data;
  },

  // For ADMIN ONLY - all agents
  getAllAgents: async () => {
    console.log('🔍 [ADMIN] Fetching ALL agents');
    const response = await api.get('/agents');
    console.log('✅ [ADMIN] Received agents:', response.data.length);
    return response.data;
  },

  getAgent: async (agentId) => {
    const response = await api.get(`/agents/${agentId}`);
    return response.data;
  },

  deleteAgent: async (agentId) => {
    const response = await api.delete(`/agents/${agentId}`);
    return response.data;
  },

  getAgentTransactions: async (agentId) => {
    return [];
  },

  getTransactions: async (agentId) => {
    const response = await api.get(`/agents/${agentId}/transactions`);
    return response.data;
  },

  createTransaction: async (agentId, transactionData) => {
    const response = await api.post('/transactions', {
      agent_id: agentId,
      merchant_id: transactionData.merchant_id,
      amount: transactionData.amount,
      checkout_url: transactionData.checkout_url || `https://example.com/checkout/${Date.now()}`,
      items: transactionData.items || (transactionData.description ? [transactionData.description] : null),
    });
    
    const transaction = response.data;
    return {
      approved: transaction.status === 'pending' || transaction.status === 'completed',
      status: transaction.status,
      reason: transaction.status === 'pending' ? 'Transaction created successfully' : null,
      risk_score: 0,
      transaction_id: transaction.id,
      ...transaction
    };
  },

  updateAgentLimits: async (agentId, limits) => {
    const response = await api.put(`/agents/${agentId}/limits`, limits);
    return response.data;
  },
};

export const merchantService = {
  getAllMerchants: async () => {
    const response = await api.get('/merchants');
    return response.data;
  },

  approveMerchant: async (merchantId, trustScore) => {
    const response = await api.post(`/merchants/${merchantId}/approve`, {
      trust_score: trustScore,
    });
    return response.data;
  },
};

export const merchantTransactionService = {
  getMerchantTransactions: async (merchantId) => {
    const token = localStorage.getItem('merchantToken');
    const response = await axios.get(`${API_BASE_URL}/merchants/${merchantId}/transactions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  getTransactionStats: async (merchantId) => {
    const transactions = await merchantTransactionService.getMerchantTransactions(merchantId);
    
    const stats = {
      totalTransactions: transactions.length,
      totalRevenue: transactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0),
      activeAgents: new Set(transactions.map(t => t.agent_id)).size,
      pendingTransactions: transactions.filter(t => t.status === 'pending').length,
      completedTransactions: transactions.filter(t => t.status === 'completed').length,
      blockedAgents: new Set(transactions.filter(t => t.is_blocked).map(t => t.agent_id)).size,
    };
    
    return { stats, transactions };
  },

  completeTransaction: async (transactionId) => {
    const token = localStorage.getItem('merchantToken');
    const response = await axios.post(
      `${API_BASE_URL}/transactions/${transactionId}/complete`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  denyTransaction: async (transactionId, reason) => {
    const token = localStorage.getItem('merchantToken');
    const response = await axios.post(
      `${API_BASE_URL}/transactions/${transactionId}/deny`,
      { reason },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },
};

export const agentBlockingService = {
  blockAgent: async (merchantId, agentId, reason) => {
    const token = localStorage.getItem('merchantToken');
    const response = await axios.post(
      `${API_BASE_URL}/merchants/${merchantId}/agents/${agentId}/block`,
      { reason },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  requestBlockWithRefund: async (merchantId, agentId, transactionId, reason) => {
    const token = localStorage.getItem('merchantToken');
    const response = await axios.post(
      `${API_BASE_URL}/merchants/${merchantId}/agents/${agentId}/block-refund`,
      { transaction_id: transactionId, reason },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },
};

export const adminBlockingService = {
  listBlockRequests: async () => {
    const response = await api.get('/admin/block-requests');
    return response.data;
  },

  approveBlockRequest: async (requestId, adminNotes) => {
    const response = await api.post(`/admin/block-requests/${requestId}/approve`, {
      admin_notes: adminNotes,
    });
    return response.data;
  },

  denyBlockRequest: async (requestId, adminNotes) => {
    const response = await api.post(`/admin/block-requests/${requestId}/deny`, {
      admin_notes: adminNotes,
    });
    return response.data;
  },
};

export const adminLedgerService = {
  getAllBlocksLedger: async () => {
    const response = await api.get('/admin/blocks-ledger');
    return response.data;
  },
};

// Team Management
export const teamService = {
  createTeam: async (teamData) => {
    const response = await api.post('/teams', teamData);
    return response.data;
  },

  listTeams: async () => {
    const response = await api.get('/teams');
    return response.data;
  },

  getTeamDetails: async (teamId) => {
    const response = await api.get(`/teams/${teamId}`);
    return response.data;
  },

  deleteTeam: async (teamId) => {
    const response = await api.delete(`/teams/${teamId}`);
    return response.data;
  },

  addMember: async (teamId, agentId) => {
    const response = await api.post(`/teams/${teamId}/members`, { agent_id: agentId });
    return response.data;
  },

  removeMember: async (teamId, agentId) => {
    const response = await api.delete(`/teams/${teamId}/members/${agentId}`);
    return response.data;
  },
};

// Network & Evaluation
export const networkService = {
  getNetworkGraph: async () => {
    const response = await api.get('/network/graph');
    return response.data;
  },

  evaluateAgents: async (itemDescription, agentIds = null) => {
    const response = await api.post('/evaluate', {
      item_description: itemDescription,
      agent_ids: agentIds,
    });
    return response.data;
  },
};

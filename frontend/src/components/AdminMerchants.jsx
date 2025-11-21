import React, { useState, useEffect } from 'react';
import { merchantService } from '../services/api';
import { Store, CheckCircle, XCircle, Clock, Star, AlertCircle } from 'lucide-react';

const AdminMerchants = () => {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMerchants();
  }, []);

  const loadMerchants = async () => {
    try {
      setLoading(true);
      const data = await merchantService.getAllMerchants();
      setMerchants(data);
      setError(null);
    } catch (err) {
      setError('Failed to load merchants: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (merchantId, trustScore) => {
    try {
      await merchantService.approveMerchant(merchantId, trustScore);
      loadMerchants(); // Reload list
    } catch (err) {
      alert('Failed to approve merchant: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'approved': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'rejected': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const renderTrustStars = (score) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= score
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-purple-600 dark:border-purple-400 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mr-3" />
          <p className="text-red-800 dark:text-red-300 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const pendingMerchants = merchants.filter(m => m.status === 'pending');
  const approvedMerchants = merchants.filter(m => m.status === 'approved');

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Merchant Management
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Review and approve merchant registrations
        </p>
      </div>

      {/* Pending Merchants */}
      {pendingMerchants.length > 0 && (
        <div>
          <div className="flex items-center space-x-3 mb-4">
            <Clock className="h-6 w-6 text-yellow-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Pending Approval ({pendingMerchants.length})
            </h2>
          </div>

          <div className="grid gap-6">
            {pendingMerchants.map((merchant) => (
              <div
                key={merchant.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border-2 border-yellow-200 dark:border-yellow-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-3 rounded-xl">
                      <Store className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {merchant.merchant_name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {merchant.domain}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        {merchant.email}
                      </p>
                      {merchant.business_address && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          📍 {merchant.business_address}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(merchant.status)}`}>
                    {merchant.status.toUpperCase()}
                  </span>
                </div>

                <div className="mt-6 flex items-center space-x-3">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Assign Trust Score:
                  </p>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      onClick={() => handleApprove(merchant.id, score)}
                      className="group flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all transform hover:scale-105 font-semibold"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>{score}</span>
                      <Star className="h-4 w-4 fill-yellow-300" />
                    </button>
                  ))}
                  <button
                    onClick={() => alert('Reject functionality coming soon')}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all font-semibold flex items-center space-x-2"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Merchants */}
      <div>
        <div className="flex items-center space-x-3 mb-4">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Approved Merchants ({approvedMerchants.length})
          </h2>
        </div>

        {approvedMerchants.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
            <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No approved merchants yet</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-xl overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Store
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Domain
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Trust Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Approved
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {approvedMerchants.map((merchant) => (
                  <tr key={merchant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-2 rounded-lg">
                          <Store className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {merchant.merchant_name}
                          </div>
                          <div className="text-xs text-gray-500">{merchant.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {merchant.domain}
                    </td>
                    <td className="px-6 py-5">
                      {renderTrustStars(merchant.trust_score)}
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-600 dark:text-gray-400">
                      {merchant.approved_at ? new Date(merchant.approved_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(merchant.status)}`}>
                        {merchant.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMerchants;

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { merchantAuthService } from '../services/merchantAuthService';

const MerchantProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = merchantAuthService.isAuthenticated();
      setIsAuthenticated(authenticated);
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-purple-600 dark:border-purple-400 rounded-full animate-spin border-t-transparent absolute top-0 left-0"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/merchant/login" replace />;
  }

  return children;
};

export default MerchantProtectedRoute;

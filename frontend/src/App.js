import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './components/Landing';
import Login from './components/Login';
import Register from './components/Register';
import AgentList from './components/AgentList';
import AgentDetail from './components/AgentDetail';
import RegisterAgent from './components/RegisterAgent';
import MerchantLogin from './components/MerchantLogin';
import MerchantRegister from './components/MerchantRegister';
import MerchantDashboard from './components/MerchantDashboard';
import MerchantProtectedRoute from './components/MerchantProtectedRoute';
import AdminDashboard from './components/AdminDashboard';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/merchant/login" element={<MerchantLogin />} />
        <Route path="/merchant/register" element={<MerchantRegister />} />
        <Route 
          path="/merchant/dashboard" 
          element={
            <MerchantProtectedRoute>
              <MerchantDashboard />
            </MerchantProtectedRoute>
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <AgentList />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/agent/:id" 
          element={
            <ProtectedRoute>
              <AgentDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/register-agent" 
          element={
            <ProtectedRoute>
              <RegisterAgent />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

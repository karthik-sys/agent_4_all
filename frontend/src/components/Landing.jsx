import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Shield, Store, ArrowRight, Zap, Lock, TrendingUp, Users, CheckCircle } from 'lucide-react';
import Logo from './Logo';

const Landing = () => {
  const navigate = useNavigate();
  <Logo showToggle={true} />
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-xl">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AgentPay
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Secure Payments for
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> AI Agents</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-8">
            The first payment infrastructure built specifically for autonomous AI agents. 
            Secure, compliant, and ready for the future of commerce.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate('/register')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-2xl flex items-center space-x-2"
            >
              <span>Start for Free</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/merchant/register')}
              className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-xl border-2 border-gray-200 dark:border-gray-700"
            >
              I'm a Merchant
            </button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {/* AI Agent Owners */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border-2 border-blue-200 dark:border-blue-900 hover:scale-105 transition-all">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-2xl inline-block mb-6">
              <Bot className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              AI Agent Owners
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Register and manage your AI agents. Monitor transactions, set spending limits, and control your autonomous commerce agents.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Spending controls & limits</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Real-time monitoring</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Multi-tier pricing</span>
              </li>
            </ul>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/register')}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all"
              >
                Sign Up
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm"
              >
                Already have an account? Sign In
              </button>
            </div>
          </div>

          {/* Merchants */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border-2 border-purple-200 dark:border-purple-900 hover:scale-105 transition-all">
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-2xl inline-block mb-6">
              <Store className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Merchants
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect your store to accept AI agent payments. Monitor agent traffic, block suspicious agents, and track transactions.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Easy integration</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Fraud protection</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Transaction analytics</span>
              </li>
            </ul>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/merchant/register')}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-all"
              >
                Sign Up
              </button>
              <button
                onClick={() => navigate('/merchant/login')}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm"
              >
                Already have an account? Sign In
              </button>
            </div>
          </div>

          {/* Administrators */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 border-2 border-green-200 dark:border-green-900 hover:scale-105 transition-all">
            <div className="bg-gradient-to-br from-green-500 to-teal-600 p-4 rounded-2xl inline-block mb-6">
              <Shield className="h-12 w-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Administrators
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Oversee the entire platform. Approve merchants, monitor system health, and ensure compliance with security protocols.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Merchant approval</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">System monitoring</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-gray-700 dark:text-gray-300">Compliance tools</span>
              </li>
            </ul>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all"
              >
                Admin Sign In
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-12">
            Why AgentPay?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
              <Lock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Bank-Level Security
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enterprise-grade encryption and fraud detection built specifically for AI agents
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
              <Zap className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Lightning Fast
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Process millions of AI transactions per second with minimal latency
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg">
              <TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Built to Scale
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                From single agents to enterprise fleets - we scale with your needs
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-blue-100 text-xl mb-8 max-w-2xl mx-auto">
            Join the future of autonomous commerce. Register your first AI agent or connect your store in minutes.
          </p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate('/register')}
              className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl"
            >
              Register Agent
            </button>
            <button
              onClick={() => navigate('/merchant/register')}
              className="bg-purple-700 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-purple-800 transition-all shadow-xl"
            >
              Register as Merchant
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            © 2024 AgentPay. Secure payments for the AI era.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

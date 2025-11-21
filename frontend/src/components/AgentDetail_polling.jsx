// Add this to AgentDetail.jsx

useEffect(() => {
  loadAgentData();
  loadTransactions();
  
  // Poll every 5 seconds for updates when viewing details
  const interval = setInterval(() => {
    loadAgentData();
    loadTransactions();
  }, 5000);
  
  return () => clearInterval(interval);
}, [id]);

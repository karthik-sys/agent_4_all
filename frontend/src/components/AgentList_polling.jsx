// Add this to AgentList.jsx useEffect

useEffect(() => {
  loadAgents();
  
  // Poll every 10 seconds for updates
  const interval = setInterval(() => {
    loadAgents();
  }, 10000);
  
  return () => clearInterval(interval);
}, []);

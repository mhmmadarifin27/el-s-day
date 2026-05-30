import { useState, useEffect } from 'react';
import { CustomerApp } from './pages/CustomerApp';
import { AdminDashboard } from './pages/AdminDashboard';function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [tableNumber, setTableNumber] = useState('');

  // Detect path changes and query strings
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      setTableNumber(params.get('table') || '');
    };

    // Parse initially
    handleLocationChange();

    // Listen to history state updates
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const isAdmin = currentPath.startsWith('/admin');

  return (
    <>
      {isAdmin ? (
        <AdminDashboard />
      ) : (
        <CustomerApp tableFromUrl={tableNumber} />
      )}
    </>
  );
}

export default App;

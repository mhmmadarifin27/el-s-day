import { useState, useEffect } from 'react';
import { CustomerApp } from './pages/CustomerApp';
import { AdminDashboard } from './pages/AdminDashboard';
import { Layers, Smartphone } from 'lucide-react';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [tableNumber, setTableNumber] = useState('4');

  // Detect path changes and query strings
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      setTableNumber(params.get('table') || '4');
    };

    // Parse initially
    handleLocationChange();

    // Listen to history state updates
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Helper to switch viewports dynamically in mock environment
  const navigateTo = (path: string, search: string = '') => {
    window.history.pushState({}, '', path + search);
    // Dispatch popstate manually so the router state updates
    window.dispatchEvent(new Event('popstate'));
  };

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

const styles: Record<string, React.CSSProperties> = {
  floatingSimController: {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: 99999,
  },
  simPill: {
    backgroundColor: '#5e454b',
    color: '#ffffff',
    border: '1.5px solid #fad2e1',
    borderRadius: '99px',
    padding: '8px 16px',
    fontSize: '0.78rem',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 8px 16px rgba(94, 69, 75, 0.2)',
    transition: 'all 0.2s ease',
  }
};

export default App;

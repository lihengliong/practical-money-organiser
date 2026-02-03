import { createContext, useContext, useState, useEffect } from 'react';

const CurrencyContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  // Initialize with localStorage value or default to SGD
  const [baseCurrency, setBaseCurrency] = useState(() => {
    const saved = localStorage.getItem('baseCurrency');
    return saved || 'SGD';
  });

  // Update localStorage whenever baseCurrency changes
  useEffect(() => {
    localStorage.setItem('baseCurrency', baseCurrency);
  }, [baseCurrency]);

  const updateBaseCurrency = (newCurrency) => {
    setBaseCurrency(newCurrency);
  };

  const value = {
    baseCurrency,
    updateBaseCurrency,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}; 
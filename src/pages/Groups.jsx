import { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import './stylesheets/groups.css';
import { fetchExchangeRates } from '../utils/currency';
import CurrencySelector from '../components/CurrencySelector';

function Groups() {
    const [groups, setGroups] = useState([]);
    const [user] = useAuthState(auth);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [groupBalances, setGroupBalances] = useState({});
    // Add state for base currency and exchange rates
    const [baseCurrency, setBaseCurrency] = useState('SGD'); // Default to SGD
    const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
    const [fetchingRates, setFetchingRates] = useState(false);
    const [loadingRates, setLoadingRates] = useState(true);

    useEffect(() => {
      if (user) {
        fetchGroups();
      }
    }, [user]);

    // Fetch user profile information by email
    const fetchUserProfile = async (email) => {
      try {
        const usersQuery = query(
          collection(db, 'users'),
          where('email', '==', email)
        );
        const userSnapshot = await getDocs(usersQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          return {
            email: email,
            displayName: userData.displayName || userData.name || email.split('@')[0],
          };
        }
        
        // If no user document found, return email with fallback displayName
        return {
          email: email,
          displayName: email.split('@')[0], // Use part before @ as fallback
        };
      } catch (error) {
        console.error('Error fetching user profile:', error);
        return {
          email: email,
          displayName: email.split('@')[0],
        };
      }
    };

    const fetchGroups = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'groups'));
        const groupList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const userGroups = groupList.filter(group => 
          group.members && group.members.includes(user.email)
        );
        
        // Fetch display names for group members and recent expenses for each group
        const enrichedGroups = await Promise.all(
          userGroups.map(async group => {
            const memberProfiles = await Promise.all(
              group.members.map(async email => {
                const profile = await fetchUserProfile(email);
                return { email, displayName: profile.displayName };
              })
            );
            // Fetch up to 3 most recent expenses for this group
            const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', group.id)));
            const expenses = expensesSnapshot.docs
              .map(doc => doc.data())
              .sort((a, b) => {
                const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return db - da;
              })
              .slice(0, 3);
            return {
              ...group,
              memberProfiles,
              recentExpenses: expenses,
            };
          })
        );

        setGroups(enrichedGroups);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setError('Error loading groups');
      } finally {
        setLoading(false);
      }
    };

    // Fetch exchange rates when baseCurrency changes
    useEffect(() => {
      const fetchRates = async () => {
        setFetchingRates(true);
        setLoadingRates(true);
        try {
          const rates = await fetchExchangeRates(baseCurrency);
          setExchangeRates(rates);
          console.log('ExchangeRates in component:', rates);
        } catch (err) {
          console.error('Error fetching exchange rates:', err);
          setExchangeRates({ [baseCurrency]: 1 });
        } finally {
          setFetchingRates(false);
          setLoadingRates(false);
        }
      };
      fetchRates();
    }, [baseCurrency]);

    // Helper function to standardize monetary values to 2 decimal places
    const standardizeAmount = (amount) => {
      return Math.round(amount * 100) / 100;
    };

    // Helper function to check if a balance is effectively zero (within rounding tolerance)
    const isEffectivelyZero = (balance) => {
      return Math.abs(balance) < 0.005; // 0.5 cents tolerance
    };

    // Fetch group balances for the user (with currency conversion)
    useEffect(() => {
      const fetchAllGroupBalances = async () => {
        if (!user || !groups.length) return;
        const balances = {};
        for (const group of groups) {
          // Fetch expenses
          const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', group.id)));
          const expenses = expensesSnapshot.docs.map(doc => doc.data());
          // Fetch payments
          const paymentsSnapshot = await getDocs(query(collection(db, 'payments'), where('groupId', '==', group.id)));
          const payments = paymentsSnapshot.docs.map(doc => doc.data());
          // Calculate balance
          let balance = 0;
          expenses.forEach(expense => {
            // Default to baseCurrency if no currency field
            const expenseCurrency = expense.currency || baseCurrency;
            if (expense.paidBy === user.email) {
              expense.splits.forEach(split => {
                if (split.member !== user.email) {
                  if (expenseCurrency !== baseCurrency && exchangeRates[expenseCurrency]) {
                    balance = standardizeAmount(balance + (split.amountOwed / exchangeRates[expenseCurrency]));
                  } else {
                    balance = standardizeAmount(balance + split.amountOwed);
                  }
                }
              });
            } else if (expense.splits.some(s => s.member === user.email)) {
              const userSplit = expense.splits.find(s => s.member === user.email);
              if (expenseCurrency !== baseCurrency && exchangeRates[expenseCurrency]) {
                balance = standardizeAmount(balance - (userSplit.amountOwed / exchangeRates[expenseCurrency]));
              } else {
                balance = standardizeAmount(balance - userSplit.amountOwed);
              }
            }
          });
          payments.forEach(payment => {
            // Assume payments are always in base currency for now
            // If you want to support payment currency, add similar conversion logic
            if (payment.fromUser === user.email) {
              balance = standardizeAmount(balance + payment.amount);
            } else if (payment.toUser === user.email) {
              balance = standardizeAmount(balance - payment.amount);
            }
          });
          balances[group.id] = balance;
        }
        setGroupBalances(balances);
      };
      fetchAllGroupBalances();
    }, [user, groups, exchangeRates, baseCurrency]);

    const navigate = useNavigate();

    // Navigate to expenses page for a specific group
    const openGroupExpenses = (group) => {
      console.log('Navigating to group:', group.id);
      console.log('Full group object:', group);
      navigate(`/group-expenses/${group.id}`, { state: { group } });
    };

    // (deleteGroup handler removed as it was unused)

    if (!user) {
      return (
        <div className="login-required">
          <div>Please log in to view groups.</div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="loading-container">
          <div>Loading...</div>
        </div>
      );
    }

    return (
      <div className="groups-container">
        {loadingRates && (
          <div style={{ color: '#888', marginBottom: 16 }}>Loading exchange rates...</div>
        )}
        {/* Base currency selector */}
        <CurrencySelector value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} style={{ marginBottom: 20 }} />
        {fetchingRates && <span style={{ marginLeft: 10, color: '#888' }}>Fetching rates...</span>}
        
        {/* Create Group Button - positioned above the heading */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button
            className="create-group-btn"
            onClick={() => navigate('/groups/create')}
            style={{ fontWeight: 600, fontSize: 16, padding: '10px 24px', borderRadius: 8 }}
          >
            + Create Group
          </button>
        </div>
        
        {/* Your Groups heading */}
        <h2 style={{ marginBottom: 24 }}>Your Groups</h2>
        
        {error && <div className="error-message">{error}</div>}
        <div className="groups-list-section">
          {groups.length === 0 ? (
            <p className="no-groups-message">No groups yet. Click "+ Create Group" to start!</p>
          ) : (
            <div className="groups-grid">
              {groups.map(group => (
                <div 
                  key={group.id} 
                  onClick={() => openGroupExpenses(group)}
                  className="group-card"
                >
                  <h3 className="group-name">{group.name}</h3>
                  <p className="group-member-count">
                    <strong>{group.memberProfiles ? group.memberProfiles.length : group.members.length}</strong> members
                  </p>
                  <p className="group-member-list">
                    {group.memberProfiles
                      ? group.memberProfiles
                          .slice(0, 3)
                          .map(m => m.displayName)
                          .join(', ')
                      : group.members.slice(0, 3).join(', ')}
                    {group.memberProfiles
                      ? (group.memberProfiles.length > 3 && ` +${group.memberProfiles.length - 3} more`)
                      : (group.members.length > 3 && ` +${group.members.length - 3} more`)}
                  </p>
                  {/* Recent expenses */}
                  {group.recentExpenses && group.recentExpenses.length > 0 && !loadingRates && (
                    <div className="group-recent-expenses" style={{ margin: '8px 0' }}>
                      <div style={{ fontSize: '0.95em', color: '#666', marginBottom: 2 }}>Recent Expenses:</div>
                      {group.recentExpenses.map((expense, idx) => {
                        const base = baseCurrency.toUpperCase();
                        const expenseCurrency = (expense.currency || base).toUpperCase();
                        const rateBase = exchangeRates[base];
                        const rateExpense = exchangeRates[expenseCurrency];
                        let convertedAmount = expense.amount;
                        if (
                          expenseCurrency !== base &&
                          typeof rateBase === 'number' &&
                          typeof rateExpense === 'number' &&
                          rateExpense !== 0
                        ) {
                          convertedAmount = expense.amount * (rateBase / rateExpense);
                        }
                        return (
                          <div key={idx} style={{ fontSize: '0.98em', marginBottom: 2 }}>
                            <span style={{ fontWeight: 500 }}>{expense.description}</span>: {expense.amount?.toFixed(2)} {expenseCurrency}
                            {expenseCurrency !== base && typeof rateBase === 'number' && typeof rateExpense === 'number' && rateExpense !== 0 ? (
                              <span style={{ color: '#888', fontSize: '0.95em' }}>
                                {' '} (≈ {convertedAmount.toFixed(2)} {base})
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Balance summary line */}
                  <div className="group-balance-summary">
                    {groupBalances[group.id] === undefined ? (
                      <span style={{ color: '#888' }}>Loading balance...</span>
                    ) : (
                      (() => {
                        const base = baseCurrency.toUpperCase();
                        const preferred = 'SGD'; // Change to user's preferred currency if needed
                        const rateBase = exchangeRates[base];
                        const ratePreferred = exchangeRates[preferred];
                        let showConverted = false;
                        let converted = groupBalances[group.id];
                        if (
                          base !== preferred &&
                          typeof rateBase === 'number' &&
                          typeof ratePreferred === 'number' &&
                          rateBase !== 0
                        ) {
                          converted = groupBalances[group.id] * (ratePreferred / rateBase);
                          showConverted = true;
                        }
                        return (
                          <>
                            {groupBalances[group.id] > 0 && !isEffectivelyZero(groupBalances[group.id]) ? (
                              <span style={{ color: 'green', fontWeight: 600 }}>
                                You are owed ${groupBalances[group.id].toFixed(2)} {base}
                                {showConverted && (
                                  <span style={{ color: '#007bff', fontWeight: 500, marginLeft: 8 }}>
                                    (≈ {converted.toFixed(2)} {preferred})
                                  </span>
                                )}
                              </span>
                            ) : groupBalances[group.id] < 0 && !isEffectivelyZero(groupBalances[group.id]) ? (
                              <span style={{ color: 'red', fontWeight: 600 }}>
                                You owe ${Math.abs(groupBalances[group.id]).toFixed(2)} {base}
                                {showConverted && (
                                  <span style={{ color: '#007bff', fontWeight: 500, marginLeft: 8 }}>
                                    (≈ {Math.abs(converted).toFixed(2)} {preferred})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span style={{ color: '#007bff', fontWeight: 600 }}>All settled up!</span>
                            )}
                          </>
                        );
                      })()
                    )}
                  </div>
                  <small className="group-creator">
                    Created by: {group.createdBy}
                  </small>
                  <div className="group-action-text">
                    Click to view expenses →
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
}

export default Groups;
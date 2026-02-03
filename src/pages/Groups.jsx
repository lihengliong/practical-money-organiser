import { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { fetchExchangeRates } from '../utils/currency.js';
import { useCurrency } from '../contexts/CurrencyContext.jsx';

function Groups() {
    const [groups, setGroups] = useState([]);
    const [user] = useAuthState(auth);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [groupBalances, setGroupBalances] = useState({});
    // Use global currency context instead of local state
    const { baseCurrency } = useCurrency();
    const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
    const [fetchingRates, setFetchingRates] = useState(false);
    const [loadingRates, setLoadingRates] = useState(true);

    useEffect(() => {
      if (user) {
        fetchGroups();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
            // Get the original expense currency (default to SGD if not set)
            const expenseCurrency = expense.currency || 'SGD';
            
            // Convert expense amounts to base currency
            const convertToBaseCurrency = (amount) => {
              if (expenseCurrency === baseCurrency || baseCurrency === 'DEFAULT') {
                return amount;
              }
              const rateBase = exchangeRates[baseCurrency];
              const rateExpense = exchangeRates[expenseCurrency];
              if (rateBase && rateExpense && rateExpense !== 0) {
                // Convert: amount in expenseCurrency * (rateBase / rateExpense) = amount in baseCurrency
                return amount * (rateBase / rateExpense);
              }
              return amount; // Fallback to original if rates unavailable
            };

            if (expense.paidBy === user.email) {
              expense.splits.forEach(split => {
                if (split.member !== user.email) {
                  balance = standardizeAmount(balance + convertToBaseCurrency(split.amountOwed));
                }
              });
            } else if (expense.splits.some(s => s.member === user.email)) {
              const userSplit = expense.splits.find(s => s.member === user.email);
              balance = standardizeAmount(balance - convertToBaseCurrency(userSplit.amountOwed));
            }
          });
          payments.forEach(payment => {
            // Convert payments to base currency
            const paymentCurrency = payment.currency || 'SGD';
            const convertPayment = (amount) => {
              if (paymentCurrency === baseCurrency || baseCurrency === 'DEFAULT') {
                return amount;
              }
              const rateBase = exchangeRates[baseCurrency];
              const ratePayment = exchangeRates[paymentCurrency];
              if (rateBase && ratePayment && ratePayment !== 0) {
                return amount * (rateBase / ratePayment);
              }
              return amount;
            };
            
            if (payment.fromUser === user.email) {
              balance = standardizeAmount(balance + convertPayment(payment.amount));
            } else if (payment.toUser === user.email) {
              balance = standardizeAmount(balance - convertPayment(payment.amount));
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
        <div className="text-center py-5 text-lg text-gray-600">
          <div>Please log in to view groups.</div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="text-center py-5 text-lg text-gray-600">
          <div>Loading...</div>
        </div>
      );
    }

    return (
      <div className="page-container">
        {/* Create Group Button - positioned above the heading */}
        <div className="flex justify-end mb-4">
          <button
            className="btn-primary"
            onClick={() => navigate('/groups/create')}
          >
            + Create Group
          </button>
        </div>
        
        {/* Your Groups heading */}
        <h2 className="section-title">Your Groups</h2>
        
        {error && <div className="error-msg">{error}</div>}
        <div className="w-full">
          {groups.length === 0 ? (
            <p className="text-center py-10 text-gray-600 italic">No groups yet. Click "+ Create Group" to start!</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map(group => (
                <div 
                  key={group.id} 
                  onClick={() => openGroupExpenses(group)}
                  className="card-clickable"
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-2 tracking-tight">{group.name}</h3>
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>{group.memberProfiles ? group.memberProfiles.length : group.members.length}</strong> members
                  </p>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">{group.memberProfiles
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
                    <div className="my-2">
                      <div className="text-sm text-gray-600 mb-0.5">Recent Expenses:</div>
                      {group.recentExpenses.map((expense, idx) => {
                        const expenseCurrency = (expense.currency || 'SGD').toUpperCase();
                        
                        if (baseCurrency === 'DEFAULT') {
                          // Show original currency only
                          return (
                            <div key={idx} className="text-sm mb-0.5">
                              <span className="font-medium">{expense.description}</span>: {expense.amount?.toFixed(2)} {expenseCurrency}
                            </div>
                          );
                        }
                        
                        // Convert to base currency
                        const base = baseCurrency.toUpperCase();
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
                          <div key={idx} className="text-sm mb-0.5">
                            <span className="font-medium">{expense.description}</span>: {convertedAmount.toFixed(2)} {base}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Balance summary line */}
                  <div className="text-base mt-3 mb-2">
                    {baseCurrency === 'DEFAULT' ? (
                      <span className="text-gray-500 italic text-sm">Select a currency to calculate balances</span>
                    ) : groupBalances[group.id] === undefined ? (
                      <span className="text-gray-500">Loading balance...</span>
                    ) : (
                      (() => {
                        const balance = groupBalances[group.id];
                        return (
                          <>
                            {balance > 0 && !isEffectivelyZero(balance) ? (
                              <span className="text-emerald-500 font-semibold">
                                You are owed {balance.toFixed(2)} {baseCurrency}
                              </span>
                            ) : balance < 0 && !isEffectivelyZero(balance) ? (
                              <span className="text-red-500 font-semibold">
                                You owe {Math.abs(balance).toFixed(2)} {baseCurrency}
                              </span>
                            ) : (
                              <span className="text-emerald-500 font-semibold">All settled up!</span>
                            )}
                          </>
                        );
                      })()
                    )}
                  </div>
                  <small className="text-xs text-gray-500 block mb-3">
                    Created by: {group.createdBy}
                  </small>
                  <div className="text-sm text-emerald-600 font-medium mt-auto">
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
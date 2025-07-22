import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import Select from 'react-select';
import './stylesheets/activities.css';
import { fetchExchangeRates } from '../utils/currency';
import CurrencySelector from '../components/CurrencySelector';

const SPLIT_TYPES = [ 
  { key: 'equal',   label: 'Equal Splits' },
  { key: 'percent', label: 'Percentage Splits' },
  { key: 'exact',   label: 'Exact Amount Splits' }
]

// Currency options for use in both form and logic
const currencyOptions = [
  { value: 'SGD', label: 'SGD (Singapore Dollar)' },
  { value: 'USD', label: 'USD (US Dollar)' },
  { value: 'EUR', label: 'EUR (Euro)' },
  { value: 'MYR', label: 'MYR (Malaysian Ringgit)' },
  { value: 'IDR', label: 'IDR (Indonesian Rupiah)' },
  { value: 'THB', label: 'THB (Thai Baht)' },
  { value: 'VND', label: 'VND (Vietnamese Dong)' },
  { value: 'PHP', label: 'PHP (Philippine Peso)' },
  { value: 'INR', label: 'INR (Indian Rupee)' },
  { value: 'CNY', label: 'CNY (Chinese Yuan)' },
  { value: 'JPY', label: 'JPY (Japanese Yen)' },
];

// Add category options
const categoryOptions = [
  'Food',
  'Transport',
  'Groceries',
  'Utilities',
  'Rent',
  'Entertainment',
  'Shopping',
  'Health',
  'Travel',
  'Other',
];

const Activities = () => {
  // Local base currency state for this group/activities page
  const [baseCurrency, setBaseCurrency] = useState('SGD');
  const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });

  const location = useLocation();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const group = location.state?.group;

  const memberDisplay = (member, showEmail = true) => {
    const profile = group.memberProfiles?.find(p => p.email === member);
    if (!profile) return member;
    return showEmail ? `${profile.displayName} (${profile.email})` : profile.displayName;
  };
  
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [splitType, setSplitType] = useState('equal');
  const [newExpense, setNewExpense] = useState({
    description:  '',
    amount:       '',
    paidBy:       '',
    participants: [],
    exactSplits:  {},                                                               
    percentSplits:{} ,                                                               
    category:     'Other',
  });

  const members = group?.members || [];
  const participantOptions = [
    {value: 'ALL', label: 'All Members' },
    ...members.map(member => ({
      value: member,
      label: memberDisplay(member)
    }))
  ]

  const involved = newExpense.participants.includes('ALL')
    ? members
    : newExpense.participants;


  useEffect(() => {
    console.log('=== Activities Debug ===');
    console.log('Group from state:', group);
    console.log('User:', user?.email);

    if (!group) {
      console.log('No group - redirecting');
      setLoading(false);
      return;
    }

    if (!user) {
      console.log('Waiting for user...');
      return;
    }

    console.log('Starting data fetch...');
    fetchData();
  }, [group, user]);

  // Fetch exchange rates when baseCurrency changes
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const rates = await fetchExchangeRates(baseCurrency);
        setExchangeRates(rates);
      } catch {
        // fallback: just SGD
        setExchangeRates({ [baseCurrency]: 1 });
      }
    };
    fetchRates();
  }, [baseCurrency]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      console.log('Fetching data for group:', group.name, 'ID:', group.id);

      const expensesQuery = query(
        collection(db, 'expenses'),
        where('groupId', '==', group.id)
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const expensesList = expensesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      console.log('Expenses fetched:', expensesList.length);
      setExpenses(expensesList);

      const paymentsQuery = query(
        collection(db, 'payments'),
        where('groupId', '==', group.id)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsList = paymentsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      console.log('Payments fetched:', paymentsList.length);
      setPayments(paymentsList);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
      console.log('Data fetch complete');
    }
  };

  const addExpense = async () => {
    if (!newExpense.description || !newExpense.amount || !newExpense.paidBy) {
      setError('Please fill in all fields');
      return;
    }

    if (newExpense.participants.length === 0) {
      setError('Select at least one participant');
      return;
    }

    const amount = parseFloat(newExpense.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (splitType === 'percent') {
      const sumPct = involved.reduce((sum, m) =>
        sum + (parseFloat(newExpense.percentSplits[m]) || 0), 0
      );
      if (parseFloat(sumPct.toFixed(2)) !== 100) {
        setError('Ensure percentages keyed amounts to 100%');
        return;
      }
    }
  
    if (splitType === 'exact') {
      const sumExact = involved.reduce((sum, m) =>
        sum + (parseFloat(newExpense.exactSplits[m]) || 0), 0
      );
      if (parseFloat(sumExact.toFixed(2)) !== amount) {
        setError('Ensure Amount keyed into each participants match the total amount of the expense');
        return;
      }
    }
  
    let splits = [];
        if (splitType === 'equal') {
          const each = amount / involved.length;
          splits = involved.map(m => ({
            member:     m,
            amountOwed: parseFloat(each.toFixed(2))
          }));
        } else if (splitType === 'percent') {
          splits = involved.map(m => {
            const pct = parseFloat(newExpense.percentSplits[m]) || 0;
            return {
              member:     m,
              amountOwed: parseFloat(((pct / 100) * amount).toFixed(2))
            };
          });
        } else if (splitType === 'exact') {
          splits = involved.map(m => ({
            member:     m,
            amountOwed: parseFloat((parseFloat(newExpense.exactSplits[m]) || 0).toFixed(2))
          }));
        }


    try {
      await addDoc(collection(db,'expenses'), {
        groupId:      group.id,
        description:  newExpense.description,
        amount:       amount,
        paidBy:       newExpense.paidBy,
        splitType:    splitType,
        participants: involved,
        createdAt:    new Date(),
        splits,
        currency:     newExpense.currency || 'SGD',
        category:     newExpense.category || 'Other',
      });

      // Notify each user who owes money (not the payer)
      await Promise.all(
        splits.filter(split => split.member !== user.email).map(split =>
          addDoc(collection(db, 'notifications'), {
            type: 'expense_request',
            user: split.member,
            groupName: group.name,
            expenseDescription: newExpense.description,
            addedBy: user.email,
            createdAt: new Date(),
            message: `You owe $${split.amountOwed.toFixed(2)} for '${newExpense.description}' in group '${group.name}'.`
          })
        )
      );

      // Push notifications to all involved except the creator (legacy, can be removed if not needed)
      // await Promise.all(
      //   involved.filter(email => email !== user.email).map(email =>
      //     addDoc(collection(db, 'notifications'), {
      //       type: 'expense_add',
      //       user: email,
      //       groupName: group.name,
      //       expenseDescription: newExpense.description,
      //       addedBy: user.email,
      //       createdAt: new Date(),
      //       message: `You were added to an expense ('${newExpense.description}') in group '${group.name}' by ${user.email}`
      //     })
      //   )
      // );

      setNewExpense({ description: '', amount: '', paidBy: '', participants: [], exactSplits: {}, percentSplits: {} });
      setSplitType('equal');
      setError('');
      fetchData();
      alert('Expense added successfully!');
    } catch (error) {
      console.error('Error adding expense:', error);
      setError('Error adding expense. Please try again.');
    }
  };

  const recordPayment = async (fromUser, toUser, amount) => {
    try {
      console.log('🔄 Recording payment:', {fromUser, toUser, amount});
      
      await addDoc(collection(db, 'payments'), {
        fromUser: fromUser,
        toUser: toUser,
        amount: amount,
        groupId: group.id,
        paymentDate: new Date(),
        status: 'completed'
      });

      // Push notifications for both payer and payee
      const notificationData = {
        type: 'payment',
        fromUser,
        toUser,
        amount,
        groupId: group.id,
        groupName: group.name,
        createdAt: new Date(),
        message: `${fromUser} paid ${toUser} $${amount} in group '${group.name}'`
      };
      await Promise.all([
        addDoc(collection(db, 'notifications'), { ...notificationData, user: fromUser }),
        addDoc(collection(db, 'notifications'), { ...notificationData, user: toUser })
      ]);

      console.log('Payment recorded, refreshing data...');
      
      setTimeout(() => {
        fetchData();
      }, 500);
      
      alert('Payment recorded successfully!');
    } catch (error) {
      console.error('Error recording payment:', error);
      setError('Error recording payment');
    }
  };

  const calculateBalances = () => {
    const balances = {};
    group.members.forEach(member => {
      balances[member] = 0;
    });
    // Calculate balances in base currency
    expenses.forEach(expense => {
      const expenseCurrency = (expense.currency || baseCurrency).toUpperCase();
      const base = baseCurrency.toUpperCase();
      const rateBase = exchangeRates[base];
      const rateExpense = exchangeRates[expenseCurrency];
      // Conversion factor: amount in expense currency * (rateBase / rateExpense)
      const convert = (amount) => {
        if (
          expenseCurrency !== base &&
          typeof rateBase === 'number' &&
          typeof rateExpense === 'number' &&
          rateExpense !== 0
        ) {
          return amount * (rateBase / rateExpense);
        }
        return amount;
      };
      if (expense.paidBy && Object.prototype.hasOwnProperty.call(balances, expense.paidBy)) {
        balances[expense.paidBy] += convert(expense.amount);
      }
      if (expense.splits) {
        expense.splits.forEach(split => {
          if (Object.prototype.hasOwnProperty.call(balances, split.member)) {
            balances[split.member] -= convert(split.amountOwed);
          }
        });
      }
    });
    payments.forEach(payment => {
      // Assume payments are always in base currency for now
      if (Object.prototype.hasOwnProperty.call(balances, payment.fromUser)) {
        balances[payment.fromUser] += payment.amount;
      }
      if (Object.prototype.hasOwnProperty.call(balances, payment.toUser)) {
        balances[payment.toUser] -= payment.amount;
      }
    });
    return balances;
  };

  // Delete expense handler
  const deleteExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      fetchData();
    } catch (err) {
      setError('Failed to delete expense');
      console.error('Delete error:', err);
    }
  };

  // Delete group handler
  const deleteGroup = async () => {
    if (!window.confirm(`Are you sure you want to delete the group '${group.name}'? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'groups', group.id));
      navigate('/groups');
    } catch (err) {
      setError('Failed to delete group');
      console.error('Delete group error:', err);
    }
  };

  if (!group) {
    return (
      <div className="no-group-container">
        <h2>No Group Selected</h2>
        <p>Please go back to Groups and click on a group to view its expenses.</p>
        <button onClick={() => navigate('/groups')} className="primary-button">
          ← Back to Groups
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-container">
        <div>Please log in to view expenses.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div>Loading {group.name} expenses...</div>
        <div style={{color: '#666'}}>This should only take a moment</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">{error}</div>
        <button onClick={() => { setError(''); fetchData(); }} className="primary-button">
          Try Again
        </button>
        <button onClick={() => navigate('/groups')} className="secondary-button">
          ← Back to Groups
        </button>
      </div>
    );
  }

  const balances = calculateBalances();
  const hasExpenses = expenses.length > 0;

  return (
    <div className="activities-container">
      {/* Base currency selector */}
      <CurrencySelector value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)} />
      {/* Header */}
      <div className="activities-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>{group.name}</h1>
          <p>{group.memberProfiles?.length || group.members.length} members: {
            group.memberProfiles
              ? group.memberProfiles.map(m => m.displayName).join(', ')
              : group.members.join(', ')
          }</p>
          {user && (
            <button
              className="delete-group-btn"
              style={{ marginTop: 10, color: 'white', background: '#dc3545', border: 'none', borderRadius: 4, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}
              onClick={deleteGroup}
            >
              Delete Group
            </button>
          )}
        </div>
        <button onClick={() => navigate('/groups')} className="back-button" style={{ alignSelf: 'flex-start', marginTop: 0 }}>
          ← Back to Groups
        </button>
      </div>

      {/* Add Expense Form */}
      <div className="add-expense-form">
        <h2>Add New Expense</h2>
        
        {error && <div className="error-message">{error}</div>}

        {/* Split Type Selector */}
        <div className="split-type-selector">                                              
          {SPLIT_TYPES.map(type => (
            <button
              key={type.key}
              className={splitType === type.key ? 'active' : ''}
              onClick={() => setSplitType(type.key)}
            >{type.label}</button>
          ))}
        </div>

        <div className="split-mode-panel">
          {splitType === 'equal' && (
            <p>Split equally amongst selected participants</p>
          )}
          {splitType === 'percent' && (
            <p>Enter a percentage for each participant (must sum to 100%)</p>
          )}
          {splitType === 'exact' && (
            <p>Enter an exact dollar amount for each participant</p>
          )}
        </div>

        <div className="expense-form-grid">
          <input
            type="text"
            placeholder="What was this expense for?"
            value={newExpense.description}
            onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
            className="form-input"
          />
          {/* Currency selector */}
          <select
            value={newExpense.currency}
            onChange={e => setNewExpense({ ...newExpense, currency: e.target.value })}
            className="form-input"
          >
            {currencyOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={newExpense.amount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || parseFloat(val) >= 0) {
                setNewExpense({ ...newExpense, amount: val });
              }
            }}
            className="form-input"
          />
          {/* Category selector */}
          <select
            value={newExpense.category}
            onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
            className="form-input"
          >
            {categoryOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <select
            value={newExpense.paidBy}
            onChange={(e) => setNewExpense({...newExpense, paidBy: e.target.value})}
            className="form-input"
          >
            <option value="">Who paid?</option>
            {group.members.map(member => (
              <option key={member} value={member}>{memberDisplay(member)}</option>
            ))}
          </select>
          <Select
            isMulti                                            
            options={participantOptions}                     
            value={participantOptions.filter(opt => newExpense.participants.includes(opt.value))}
            onChange={selected => {                         
              let values = selected ? selected.map(o => o.value) : [];
              if (values.includes('ALL')) values = ['ALL'];
              setNewExpense({ ...newExpense, participants: values });
            }}
            closeMenuOnSelect={false}
            hideSelectedOptions={false}                      
            isOptionDisabled={opt =>                        
              opt.value === 'ALL'
                ? newExpense.participants.length > 0 && !newExpense.participants.includes('ALL')
                : newExpense.participants.includes('ALL')
            }
            placeholder="Who's involved?"
            className="form-input"
            classNamePrefix="react-select"
          />
        </div>

        {/* Improved Split Table UI */}
        {(splitType === 'percent' || splitType === 'exact' || splitType === 'equal') && involved.length > 0 && (
          <div className="split-table-container">
            <table className="split-table">
              <thead>
                <tr>
                  <th>Member</th>
                  {splitType === 'percent' && <th>Percent</th>}
                  {splitType === 'exact' && <th>Amount</th>}
                  {splitType === 'equal' && <th>Share</th>}
                  <th>Calculated</th>
                </tr>
              </thead>
              <tbody>
                {involved.map(m => {
                  const pct = parseFloat(newExpense.percentSplits[m]) || 0;
                  const exact = parseFloat(newExpense.exactSplits[m]) || 0;
                  const amount = parseFloat(newExpense.amount) || 0;
                  let calculated = 0;
                  let error = false;
                  if (splitType === 'percent') {
                    calculated = ((pct / 100) * amount) || 0;
                    error = pct < 0 || pct > 100;
                  } else if (splitType === 'exact') {
                    calculated = exact;
                    error = exact < 0 || exact > amount;
                  } else if (splitType === 'equal') {
                    calculated = amount / involved.length || 0;
                  }
                  return (
                    <tr key={m} className={error ? 'split-error-row' : ''}>
                      <td>{memberDisplay(m)}</td>
                      {splitType === 'percent' && (
                        <td>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={newExpense.percentSplits[m] || ''}
                            onChange={e => setNewExpense({
                              ...newExpense,
                              percentSplits: { ...newExpense.percentSplits, [m]: e.target.value }
                            })}
                            className="split-slider"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={newExpense.percentSplits[m] || ''}
                            onChange={e => setNewExpense({
                              ...newExpense,
                              percentSplits: { ...newExpense.percentSplits, [m]: e.target.value }
                            })}
                            className="split-input"
                          />%
                        </td>
                      )}
                      {splitType === 'exact' && (
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newExpense.exactSplits[m] || ''}
                            onChange={e => setNewExpense({
                              ...newExpense,
                              exactSplits: { ...newExpense.exactSplits, [m]: e.target.value }
                            })}
                            className="split-input"
                          />
                        </td>
                      )}
                      {splitType === 'equal' && (
                        <td>
                          {amount > 0 ? `$${(amount / involved.length).toFixed(2)}` : '-'}
                        </td>
                      )}
                      <td>${calculated.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary Row */}
              <tfoot>
                <tr className="split-summary-row">
                  <td><strong>Total</strong></td>
                  {splitType === 'percent' && <td>{involved.reduce((sum, m) => sum + (parseFloat(newExpense.percentSplits[m]) || 0), 0)}%</td>}
                  {splitType === 'exact' && <td>${involved.reduce((sum, m) => sum + (parseFloat(newExpense.exactSplits[m]) || 0), 0).toFixed(2)}</td>}
                  {splitType === 'equal' && <td>-</td>}
                  <td>
                    {splitType === 'percent' && `$${involved.reduce((sum, m) => sum + ((parseFloat(newExpense.percentSplits[m]) || 0) / 100 * (parseFloat(newExpense.amount) || 0)), 0).toFixed(2)}`}
                    {splitType === 'exact' && `$${involved.reduce((sum, m) => sum + (parseFloat(newExpense.exactSplits[m]) || 0), 0).toFixed(2)}`}
                    {splitType === 'equal' && `$${(parseFloat(newExpense.amount) || 0).toFixed(2)}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <button onClick={addExpense} className="add-expense-btn">
          Add Expense
        </button>
      </div>

      {!hasExpenses ? (
        <div className="welcome-screen">
          <h2>Ready to track expenses!</h2>
          <p>Add your first expense above to get started with {group.name}.</p>
        </div>
      ) : (
        <div className="main-content-grid">
          {/* Balances */}
          <div className="balances-section">
            <h2>Current Balances</h2>
            <div className="balances-container">
              {Object.entries(balances).map(([member, balance]) => (
                <div 
                  key={member} 
                  className={`balance-item ${balance === 0 ? 'neutral' : balance > 0 ? 'positive' : 'negative'}`}
                >
                  <div className="balance-name">{memberDisplay(member)}</div>
                  <div className="balance-amount">
                    ${Math.abs(balance).toFixed(2)} 
                    <span className="balance-status">
                      {balance > 0 ? '(gets back)' : balance < 0 ? '(owes)' : '(even)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Settle Up */}
            <div className="settle-up-section">
              <h3>Quick Settle Up</h3>
              {Object.entries(balances).filter(([, balance]) => balance < 0).length === 0 ? (
                <div className="all-settled">
                  All settled up! No one owes money.
                </div>
              ) : (
                Object.entries(balances)
                  .filter(([, balance]) => balance < 0)
                  .map(([member, balance]) => {
                    const creditors = Object.entries(balances)
                      .filter(([, bal]) => bal > 0)
                      .sort(([, a], [, b]) => b - a);
                    if (creditors.length === 0) return null;
                    const [creditor] = creditors[0];
                    const amountOwed = Math.abs(balance);
                    return (
                      <div key={member} className="settle-up-item">
                        <span>
                          <strong>{memberDisplay(member, false)}</strong> owes ${amountOwed.toFixed(2)} to <strong>{memberDisplay(creditor, false)}</strong>
                        </span>
                        <button 
                          onClick={() => recordPayment(member, creditor, amountOwed)}
                          className="settle-up-btn"
                        >
                          Mark as Paid
                        </button>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Recent Expenses */}
          <div className="expenses-section">
            <h2>Recent Expenses</h2>
            <div className="expenses-list">
              {expenses.map(expense => {
                // Conversion logic
                const base = baseCurrency.toUpperCase();
                const expenseCurrency = (expense.currency || base).toUpperCase();
                const rateBase = exchangeRates[base];
                const rateExpense = exchangeRates[expenseCurrency];
                let convertedAmount = expense.amount;
                if (
                  typeof rateBase === 'number' &&
                  typeof rateExpense === 'number' &&
                  rateExpense !== 0
                ) {
                  convertedAmount = expense.amount * (rateBase / rateExpense);
                }
                return (
                  <div key={expense.id} className="expense-item">
                    <div className="expense-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '8px 0' }}>
                      {/* Description and payer info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="expense-title" style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{expense.description}</div>
                        <div className="expense-category" style={{ fontSize: '0.97em', color: '#8b5cf6', fontWeight: 500, margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                          {expense.category ? expense.category : 'Other'}
                        </div>
                        <div className="expense-payer" style={{ fontSize: '0.97em', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                          Paid by: {memberDisplay(expense.paidBy)}
                        </div>
                      </div>
                      {/* Amount and delete button as a flex row, no truncation */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                        <div className="expense-amount" style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.35em', color: '#222', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span>{expense.amount.toFixed(2)} {expenseCurrency}</span>
                          <span style={{ color: '#888', fontSize: '0.98em', fontWeight: 500, marginTop: 2 }}>
                            (≈ {convertedAmount.toFixed(2)} {base})
                          </span>
                        </div>
                        {/* Delete button, only for the payer */}
                        {user && expense.paidBy === user.email && (
                          <button
                            className="delete-expense-btn"
                            style={{ color: 'white', background: '#dc3545', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', minWidth: 70 }}
                            onClick={() => deleteExpense(expense.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="payment-history">
          <h2>Payment History</h2>
          <div className="payment-history-container">
            {payments.map(payment => (
              <div key={payment.id} className="payment-item">
                <strong>{memberDisplay(payment.fromUser, false)}</strong> paid <strong>{memberDisplay(payment.toUser, false)}</strong> ${payment.amount}
                <small className="payment-date">
                  {payment.paymentDate.toDate?.().toLocaleDateString() || 'Recently'}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Activities;
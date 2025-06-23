import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import Select from 'react-select';
import './stylesheets/activities.css';

const SPLIT_TYPES = [ 
  { key: 'equal',   label: 'Equal Splits' },
  { key: 'percent', label: 'Percentage Splits' },
  { key: 'exact',   label: 'Exact Amount Splits' }
]

const Activities = () => {
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
    percentSplits:{}                                                               
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
        splits
      });

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

    console.log('💰 Calculating balances...');
    console.log('Expenses:', expenses.length);
    console.log('Payments:', payments.length);

    expenses.forEach(expense => {
      balances[expense.paidBy] += expense.amount;
      expense.splits.forEach(split => {
        balances[split.member] -= split.amountOwed;
      });
    });

    console.log('Balances after expenses:', balances);

    payments.forEach(payment => {
      console.log('Applying payment:', payment);
      balances[payment.fromUser] += payment.amount;
      balances[payment.toUser] -= payment.amount;
    });

    console.log('Final balances:', balances);
    return balances;
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
      {/* Header */}
      <div className="activities-header">
        <div>
          <h1>{group.name}</h1>
          <p>{group.memberProfiles?.length || group.members.length} members: {
            group.memberProfiles
              ? group.memberProfiles.map(m => m.displayName).join(', ')
              : group.members.join(', ')
          }</p>
        </div>
        <button onClick={() => navigate('/groups')} className="back-button">
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
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            value={newExpense.amount}
            onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
            className="form-input"
          />
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
          
          
          {splitType === 'percent' && involved.map(m => {
            const pct = parseFloat(newExpense.percentSplits[m]) || 0;
            const owed = ((pct / 100) * parseFloat(newExpense.amount) || 0).toFixed(2);
            return (
              <div key={m} className="split-row">
                <span>{memberDisplay(m)}</span>
                <input
                  type="number" step="1" min="0" max="100"
                  value={newExpense.percentSplits[m] || ''}
                  onChange={e => setNewExpense({
                    ...newExpense,
                    percentSplits: { ...newExpense.percentSplits, [m]: e.target.value }
                  })}
                />%
                <span>${owed}</span>
              </div>
            );
          })}

          {splitType === 'exact' && involved.map(m => {
            const exact = parseFloat(newExpense.exactSplits[m]) || 0;
            const pct   = ((exact / parseFloat(newExpense.amount)) * 100 || 0).toFixed(1);
            return (
              <div key={m} className="split-row">
                <span>{memberDisplay(m)}</span>
                <input
                  type="number" step="0.01"
                  value={newExpense.exactSplits[m] || ''}
                  onChange={e => setNewExpense({
                    ...newExpense,
                    exactSplits: { ...newExpense.exactSplits, [m]: e.target.value }
                  })}
                />
                <span>({pct}% )</span>
              </div>
            );
          })}


          <button onClick={addExpense} className="add-expense-btn">
            Add Expense
          </button>
        </div>
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
              {Object.entries(balances).filter(([_, balance]) => balance < 0).length === 0 ? (
                <div className="all-settled">
                  All settled up! No one owes money.
                </div>
              ) : (
                Object.entries(balances)
                  .filter(([_, balance]) => balance < 0)
                  .map(([member, balance]) => {
                    const creditors = Object.entries(balances)
                      .filter(([_, bal]) => bal > 0)
                      .sort(([_, a], [__, b]) => b - a);
                    
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
              {expenses.map(expense => (
                <div key={expense.id} className="expense-item">
                  <div className="expense-content">
                    <div>
                      <div className="expense-title">{expense.description}</div>
                      <div className="expense-payer">Paid by: {memberDisplay(expense.paidBy)}</div>
                    </div>
                    <div className="expense-amount">
                      <div className="expense-total">${expense.amount}</div>
                      <div className="expense-split">
                        ${(expense.amount / group.members.length).toFixed(2)} each
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
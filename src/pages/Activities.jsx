import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase.js';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import Select from 'react-select';
import { fetchExchangeRates } from '../utils/currency.js';
import CurrencySelector from '../components/CurrencySelector.jsx';
import { useCurrency } from '../contexts/CurrencyContext.jsx';

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

const GroupExpenses = () => {
  // Use global currency context instead of local state
  const { baseCurrency } = useCurrency();
  const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });

  const location = useLocation();
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const group = location.state?.group;

  // Helper function to fetch user profile
  const fetchUserProfile = async (email) => {
    try {
      const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
      if (!userDoc.empty) {
        return userDoc.docs[0].data();
      }
      return { displayName: email.split('@')[0] };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return { displayName: email.split('@')[0] };
    }
  };

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
      label: memberDisplay(member, false) // Show only display name, not email
    }))
  ]

  const involved = newExpense.participants.includes('ALL')
    ? members
    : newExpense.participants;

  const [nudgeLoading, setNudgeLoading] = useState(false);


  useEffect(() => {
    console.log('=== Group Expenses Debug ===');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Fetch member profiles if not already loaded
      if (!group.memberProfiles) {
        const memberProfiles = await Promise.all(
          group.members.map(async email => {
            const profile = await fetchUserProfile(email);
            return { email, displayName: profile.displayName };
          })
        );
        // Update the group object with member profiles
        group.memberProfiles = memberProfiles;
      }

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

    const amount = standardizeAmount(parseFloat(newExpense.amount));
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
          // Improved equal split: first person takes the burden of remainder division
          const n = involved.length;
          if (n === 1 && involved[0] === newExpense.paidBy) {
            splits = [];
          } else {
            const baseShare = Math.floor((amount / n) * 100) / 100; // round down to 2 decimals
            let splitVals = Array(n).fill(baseShare);
            let totalAssigned = baseShare * n;
            let remainder = Math.round((amount - totalAssigned) * 100); // in cents
            
            // Give the remainder to the first person in the involved list
            if (remainder > 0) {
              splitVals[0] = standardizeAmount(splitVals[0] + (remainder / 100));
            }
            
            splits = involved.map((m, i) => ({
              member: m,
              amountOwed: splitVals[i]
            }));
          }
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

      // Notify payer (the person who paid)
      await addDoc(collection(db, 'notifications'), {
        type: 'expense_created',
        user: newExpense.paidBy,
        groupName: group.name,
        expenseDescription: newExpense.description,
        addedBy: user.email,
        createdAt: new Date(),
        message: `${(newExpense.currency || 'SGD').toUpperCase()} ${amount} for ${newExpense.description} has been logged into ${group.name}`
      });

      // Notify each user who owes money (not the payer)
      await Promise.all(
        splits.filter(split => split.member !== newExpense.paidBy).map(split => {
          const payerName = memberDisplay(newExpense.paidBy, false);
          return addDoc(collection(db, 'notifications'), {
            type: 'expense_request',
            user: split.member,
            groupName: group.name,
            expenseDescription: newExpense.description,
            addedBy: user.email,
            createdAt: new Date(),
            message: `You owe ${payerName} ${(newExpense.currency || 'SGD').toUpperCase()} ${split.amountOwed.toFixed(2)} for ${newExpense.description} in ${group.name}`
          });
        })
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
        currency: baseCurrency, // Store the currency used for this payment
        groupId: group.id,
        paymentDate: new Date(),
        status: 'completed'
      });

      // Push notifications for both payer and payee
      const payerName = memberDisplay(fromUser, false);
      const payeeName = memberDisplay(toUser, false);
      await Promise.all([
        // Payer notification
        addDoc(collection(db, 'notifications'), {
          type: 'payment',
          user: fromUser,
          fromUser,
          toUser,
          amount,
          groupId: group.id,
          groupName: group.name,
          createdAt: new Date(),
          message: `You have settled up with ${payeeName}!`
        }),
        // Payee notification
        addDoc(collection(db, 'notifications'), {
          type: 'payment',
          user: toUser,
          fromUser,
          toUser,
          amount,
          groupId: group.id,
          groupName: group.name,
          createdAt: new Date(),
          message: `${payerName} has paid you ${baseCurrency.toUpperCase()} ${Number(amount).toFixed(2)} in ${group.name}`
        })
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

  // Helper function to standardize monetary values to 2 decimal places
  const standardizeAmount = (amount) => {
    return Math.round(amount * 100) / 100;
  };

  // Helper function to check if a balance is effectively zero (within rounding tolerance)
  const isEffectivelyZero = (balance) => {
    return Math.abs(balance) < 0.005; // 0.5 cents tolerance
  };

  const calculateBalances = () => {
    const balances = {};
    group.members.forEach(member => {
      balances[member] = 0;
    });
    // Calculate balances in base currency
    expenses.forEach(expense => {
      // Ignore single-person expenses (no one owes anyone)
      if (expense.splits && expense.splits.length === 1 && expense.splits[0].member === expense.paidBy) {
        return;
      }
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
          return standardizeAmount(amount * (rateBase / rateExpense));
        }
        return standardizeAmount(amount);
      };
      // Only credit payer if this is not a true solo expense (payer is the only participant)
      if (
        expense.paidBy &&
        Object.prototype.hasOwnProperty.call(balances, expense.paidBy) &&
        expense.splits &&
        !(expense.splits.length === 1 && expense.splits[0].member === expense.paidBy)
      ) {
        balances[expense.paidBy] = standardizeAmount(balances[expense.paidBy] + convert(expense.amount));
      }
      if (expense.splits) {
        expense.splits.forEach(split => {
          if (Object.prototype.hasOwnProperty.call(balances, split.member)) {
            balances[split.member] = standardizeAmount(balances[split.member] - convert(split.amountOwed));
          }
        });
      }
    });
    payments.forEach(payment => {
      // Convert payment to base currency
      const paymentCurrency = (payment.currency || baseCurrency).toUpperCase();
      const base = baseCurrency.toUpperCase();
      const rateBase = exchangeRates[base];
      const ratePayment = exchangeRates[paymentCurrency];
      const convertPayment = (amount) => {
        if (
          paymentCurrency !== base &&
          typeof rateBase === 'number' &&
          typeof ratePayment === 'number' &&
          ratePayment !== 0
        ) {
          return standardizeAmount(amount * (rateBase / ratePayment));
        }
        return standardizeAmount(amount);
      };
      if (Object.prototype.hasOwnProperty.call(balances, payment.fromUser)) {
        balances[payment.fromUser] = standardizeAmount(balances[payment.fromUser] + convertPayment(payment.amount));
      }
      if (Object.prototype.hasOwnProperty.call(balances, payment.toUser)) {
        balances[payment.toUser] = standardizeAmount(balances[payment.toUser] - convertPayment(payment.amount));
      }
    });
    return balances;
  };

  const handleNudgeAll = async () => {
    setNudgeLoading(true);
    try {
      const balances = calculateBalances();
      const nudgePromises = Object.entries(balances)
        .filter(([, balance]) => balance < 0 && !isEffectivelyZero(balance))
        .map(([member, balance]) => {
          // Find the creditor (the person they owe the most to)
          const creditors = Object.entries(balances)
            .filter(([, bal]) => bal > 0 && !isEffectivelyZero(bal))
            .sort(([, a], [, b]) => b - a);
          if (creditors.length === 0) return null;
          const [creditor] = creditors[0];
          return addDoc(collection(db, 'notifications'), {
            type: 'nudge',
            user: member,
            groupName: group.name,
            createdAt: new Date(),
            message: `Please settle up with ${memberDisplay(creditor, false)}! You currently owe him $${Math.abs(standardizeAmount(balance)).toFixed(2)} in ${group.name}`
          });
        });
      await Promise.all(nudgePromises.filter(Boolean));
      alert('Nudge sent to all users who owe money!');
    } catch {
      alert('Failed to send nudge.');
    } finally {
      setNudgeLoading(false);
    }
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

  // Helper to generate minimal transactions for settle up
  function getMinimalSettleUp(balances) {
    // Convert balances to array of { member, balance }
    const entries = Object.entries(balances)
      .map(([member, balance]) => ({ member, balance: standardizeAmount(balance) }))
      .filter(e => !isEffectivelyZero(e.balance));
    const debtors = entries.filter(e => e.balance < 0).map(e => ({ ...e }));
    const creditors = entries.filter(e => e.balance > 0).map(e => ({ ...e }));
    // Sort debtors (most negative first), creditors (most positive first)
    debtors.sort((a, b) => a.balance - b.balance);
    creditors.sort((a, b) => b.balance - a.balance);
    const transactions = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const amount = standardizeAmount(Math.min(-debtor.balance, creditor.balance));
      if (!isEffectivelyZero(amount)) {
        transactions.push({ from: debtor.member, to: creditor.member, amount });
        debtor.balance = standardizeAmount(debtor.balance + amount);
        creditor.balance = standardizeAmount(creditor.balance - amount);
      }
      if (isEffectivelyZero(debtor.balance)) i++;
      if (isEffectivelyZero(creditor.balance)) j++;
    }
    return transactions;
  }

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

  // Find the earliest payment date in the group
  const earliestPaymentDate = payments.length > 0 ? new Date(Math.min(...payments.map(p => (p.paymentDate?.toDate ? p.paymentDate.toDate() : new Date(p.paymentDate)).getTime()))) : null;

  return (
    <div className="page-container">
      {/* Base currency selector */}
              <CurrencySelector />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold max-sm:text-xl">{group.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{group.memberProfiles?.length || group.members.length} members: {
            group.memberProfiles
              ? group.memberProfiles.map(m => m.displayName).join(', ')
              : group.members.join(', ')
          }</p>
          {user && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                onClick={() => navigate('/group-analytics', { state: { group } })}
                className="btn-primary text-sm py-2 px-5"
              >
                View Analytics
              </button>
              <button
                className="btn-danger text-sm py-2 px-5"
                onClick={deleteGroup}
              >
                Delete Group
              </button>
            </div>
          )}
        </div>
        <button onClick={() => navigate('/groups')} className="btn-ghost self-start shrink-0">
          ← Back to Groups
        </button>
      </div>

      {/* Add Expense Form */}
      <div className="card mt-8 mb-7 gap-2">
        <h2 className="section-title">Add New Expense</h2>
        
        {error && <div className="error-msg">{error}</div>}

        {/* Split Type Selector */}
        <div className="flex flex-wrap gap-2 mb-2.5">
          {SPLIT_TYPES.map(type => (
            <button
              key={type.key}
              className={splitType === type.key ? 'bg-gradient-to-r from-green-400 to-cyan-400 text-white border-0 rounded-[22px] px-5 py-2 text-base font-semibold cursor-pointer transition-[background,color,box-shadow] duration-[0.18s] shadow-[0_4px_16px_rgba(183,228,199,0.67)]' : 'bg-gray-100 text-gray-800 border-0 rounded-[22px] px-5 py-2 text-base font-semibold cursor-pointer transition-[background,color,box-shadow] duration-[0.18s] shadow-[0_1px_4px_rgba(183,228,199,0.67)] hover:bg-gray-200 hover:text-gray-900'}
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

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2.5 items-end mb-1.5">
          <input
            type="text"
            placeholder="What was this expense for?"
            value={newExpense.description}
            onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
            className="input-field"
          />
          {/* Currency selector */}
          <select
            value={newExpense.currency}
            onChange={e => setNewExpense({ ...newExpense, currency: e.target.value })}
            className="input-field"
          >
            {currencyOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={newExpense.amount}
            onChange={(e) => {
              const value = e.target.value;
              // Restrict to 2 decimal places
              if (value.includes('.') && value.split('.')[1]?.length > 2) {
                return;
              }
              setNewExpense({...newExpense, amount: value});
            }}
            step="0.01"
            min="0"
            className="input-field"
            required
          />
          {/* Category selector */}
          <select
            value={newExpense.category}
            onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
            className="input-field"
          >
            {categoryOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <select
            value={newExpense.paidBy}
            onChange={(e) => setNewExpense({...newExpense, paidBy: e.target.value})}
            className="input-field"
          >
            <option value="">Who paid?</option>
            {group.members.map(member => (
              <option key={member} value={member}>{memberDisplay(member, false)}</option>
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
            className="input-field"
            classNamePrefix="react-select"
          />
        </div>

        {/* Improved Split Table UI */}
        {(splitType === 'percent' || splitType === 'exact' || splitType === 'equal') && involved.length > 0 && (
          <div className="mt-2.5 bg-white rounded-xl shadow-[0_1px_6px_rgba(183,228,199,0.2)] p-2.5 px-2 pb-1 overflow-x-auto">
            <table className="w-full border-collapse bg-slate-50/60 mb-2.5 min-w-[360px]">
              <thead>
                <tr>
                  <th className="bg-green-100/60 text-green-700 font-bold rounded-lg rounded-b-none p-2.5 px-3 text-lg">Member</th>
                  {splitType === 'percent' && <th className="bg-green-100/60 text-green-700 font-bold rounded-lg rounded-b-none p-2.5 px-3 text-lg">Percent</th>}
                  {splitType === 'exact' && <th className="bg-green-100/60 text-green-700 font-bold rounded-lg rounded-b-none p-2.5 px-3 text-lg">Amount</th>}
                  {splitType === 'equal' && <th className="bg-green-100/60 text-green-700 font-bold rounded-lg rounded-b-none p-2.5 px-3 text-lg">Share</th>}
                  <th className="bg-green-100/60 text-green-700 font-bold rounded-lg rounded-b-none p-2.5 px-3 text-lg">Calculated</th>
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
                    // Calculate the actual split using the same logic as addExpense
                    const n = involved.length;
                    if (n === 1 && involved[0] === newExpense.paidBy) {
                      calculated = 0;
                    } else {
                      const baseShare = Math.floor((amount / n) * 100) / 100;
                      const memberIndex = involved.indexOf(m);
                      
                      if (memberIndex === 0) {
                        // This is the first person - they get the remainder
                        const totalAssigned = baseShare * n;
                        const remainder = Math.round((amount - totalAssigned) * 100);
                        calculated = standardizeAmount(baseShare + (remainder / 100));
                      } else {
                        calculated = baseShare;
                      }
                    }
                  }
                  return (
                    <tr key={m} className={error ? 'bg-red-50' : ''}>
                      <td className="p-2.5 px-3 text-lg">{memberDisplay(m, false)}</td>
                      {splitType === 'percent' && (
                        <td className="p-2.5 px-3 text-lg">
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, 100 - involved.filter(x => x !== m).reduce((s, x) => s + (parseFloat(newExpense.percentSplits[x]) || 0), 0))}
                            step="1"
                            value={newExpense.percentSplits[m] || 0}
                            onChange={e => {
                              const otherSum = involved.filter(x => x !== m).reduce((s, x) => s + (parseFloat(newExpense.percentSplits[x]) || 0), 0);
                              const clamped = Math.min(Math.max(0, parseFloat(e.target.value) || 0), 100 - otherSum);
                              setNewExpense({ ...newExpense, percentSplits: { ...newExpense.percentSplits, [m]: String(clamped) } });
                            }}
                            className="w-20 mr-2 align-middle"
                          />
                          <input
                            type="number"
                            min="0"
                            max={Math.max(0, 100 - involved.filter(x => x !== m).reduce((s, x) => s + (parseFloat(newExpense.percentSplits[x]) || 0), 0))}
                            step="1"
                            value={newExpense.percentSplits[m] || ''}
                            onChange={e => {
                              const otherSum = involved.filter(x => x !== m).reduce((s, x) => s + (parseFloat(newExpense.percentSplits[x]) || 0), 0);
                              const val = parseFloat(e.target.value) || 0;
                              const clamped = Math.min(Math.max(0, val), 100 - otherSum);
                              setNewExpense({ ...newExpense, percentSplits: { ...newExpense.percentSplits, [m]: String(clamped) } });
                            }}
                            className="w-[60px] p-1.5 border border-gray-300 rounded text-base text-right"
                          />%
                        </td>
                      )}
                      {splitType === 'exact' && (
                        <td className="p-2.5 px-3 text-lg">
                          <input
                            type="number"
                            min="0"
                            max={Math.max(0, (parseFloat(newExpense.amount) || 0) - involved.filter(x => x !== m).reduce((s, x) => s + (parseFloat(newExpense.exactSplits[x]) || 0), 0))}
                            step="0.01"
                            value={newExpense.exactSplits[m] || ''}
                            onChange={e => {
                              const value = e.target.value;
                              if (value.includes('.') && value.split('.')[1]?.length > 2) return;
                              const val = parseFloat(value) || 0;
                              const totalAmt = parseFloat(newExpense.amount) || 0;
                              const otherSum = involved.filter(x => x !== m).reduce((s, x) => s + (parseFloat(newExpense.exactSplits[x]) || 0), 0);
                              const clamped = Math.min(Math.max(0, val), totalAmt - otherSum);
                              setNewExpense({ ...newExpense, exactSplits: { ...newExpense.exactSplits, [m]: String(clamped) } });
                            }}
                            className="w-[60px] p-1.5 border border-gray-300 rounded text-base text-right"
                          />
                        </td>
                      )}
                      {splitType === 'equal' && (
                        <td className="p-2.5 px-3 text-lg">
                          {amount > 0 ? `$${calculated.toFixed(2)}` : '-'}
                        </td>
                      )}
                      <td className="p-2.5 px-3 text-lg">${calculated.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Summary Row */}
              <tfoot>
                <tr className="font-bold text-gray-900 bg-slate-50">
                  <td className="p-2.5 px-3 text-lg"><strong>Assigned</strong></td>
                  {splitType === 'percent' && <td className="p-2.5 px-3 text-lg">{involved.reduce((sum, m) => sum + (parseFloat(newExpense.percentSplits[m]) || 0), 0).toFixed(0)}%</td>}
                  {splitType === 'exact' && <td className="p-2.5 px-3 text-lg">${involved.reduce((sum, m) => sum + (parseFloat(newExpense.exactSplits[m]) || 0), 0).toFixed(2)}</td>}
                  {splitType === 'equal' && <td className="p-2.5 px-3 text-lg">-</td>}
                  <td className="p-2.5 px-3 text-lg">
                    {splitType === 'percent' && `$${involved.reduce((sum, m) => sum + ((parseFloat(newExpense.percentSplits[m]) || 0) / 100 * (parseFloat(newExpense.amount) || 0)), 0).toFixed(2)}`}
                    {splitType === 'exact' && `$${involved.reduce((sum, m) => sum + (parseFloat(newExpense.exactSplits[m]) || 0), 0).toFixed(2)}`}
                    {splitType === 'equal' && `$${(parseFloat(newExpense.amount) || 0).toFixed(2)}`}
                  </td>
                </tr>
                {(splitType === 'percent' || splitType === 'exact') && (() => {
                  const totalPct = involved.reduce((sum, m) => sum + (parseFloat(newExpense.percentSplits[m]) || 0), 0);
                  const totalExact = involved.reduce((sum, m) => sum + (parseFloat(newExpense.exactSplits[m]) || 0), 0);
                  const totalAmt = parseFloat(newExpense.amount) || 0;
                  const remainingPct = parseFloat((100 - totalPct).toFixed(2));
                  const remainingExact = parseFloat((totalAmt - totalExact).toFixed(2));
                  const isComplete = splitType === 'percent' ? remainingPct === 0 : remainingExact === 0;
                  return (
                    <tr className={isComplete ? 'text-green-700 bg-green-50 font-bold' : 'text-amber-700 bg-amber-50 font-bold'}>
                      <td className="p-2.5 px-3 text-base">{isComplete ? '✓ Balanced' : 'Remaining'}</td>
                      {splitType === 'percent' && <td className="p-2.5 px-3 text-base">{remainingPct}%</td>}
                      {splitType === 'exact' && <td className="p-2.5 px-3 text-base">${remainingExact.toFixed(2)}</td>}
                      <td className="p-2.5 px-3 text-base">
                        {splitType === 'percent' && `$${(remainingPct / 100 * totalAmt).toFixed(2)}`}
                        {splitType === 'exact' && `$${remainingExact.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </div>
        )}

        {(() => {
          const totalPct = involved.reduce((sum, m) => sum + (parseFloat(newExpense.percentSplits[m]) || 0), 0);
          const totalExact = involved.reduce((sum, m) => sum + (parseFloat(newExpense.exactSplits[m]) || 0), 0);
          const totalAmt = parseFloat(newExpense.amount) || 0;
          const splitValid =
            splitType === 'equal' ||
            (splitType === 'percent' && parseFloat((100 - totalPct).toFixed(2)) === 0) ||
            (splitType === 'exact' && totalAmt > 0 && parseFloat((totalAmt - totalExact).toFixed(2)) === 0);
          return (
            <button
              onClick={addExpense}
              disabled={!splitValid}
              className="btn-primary mt-1.5 self-end w-full lg:w-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
            >
              {!splitValid && splitType !== 'equal'
                ? splitType === 'percent' ? 'Percentages must total 100%' : 'Amounts must match total'
                : 'Add Expense'}
            </button>
          );
        })()}
      </div>

      {!hasExpenses ? (
        <div className="text-center py-[60px] px-5 bg-gray-50 rounded-[10px] border border-gray-200">
          <h2 className="text-gray-500 mb-4">Ready to track expenses!</h2>
          <p className="text-gray-500 text-lg">Add your first expense above to get started with {group.name}.</p>
        </div>
      ) : baseCurrency === 'DEFAULT' ? (
        <div>
          <h2 className="section-title">Recent Expenses (Original Currencies)</h2>
          <p className="text-gray-500 mb-4 italic">Showing expenses in their original input currencies. Select a specific currency to convert and view balances.</p>
          <div className="max-h-[500px] overflow-y-auto">
            {expenses
              .slice()
              .sort((a, b) => {
                const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return bDate - aDate;
              })
              .map(expense => {
              const expenseCurrency = (expense.currency || 'SGD').toUpperCase();
              return (
                <div key={expense.id} className="card-clickable mb-5">
                  <div className="flex items-center justify-between gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{expense.description}</div>
                      <div className="text-sm text-purple-500 font-medium truncate">{expense.category || 'Other'}</div>
                      <div className="text-sm text-slate-500 truncate">Paid by: {memberDisplay(expense.paidBy)}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-bold text-lg text-gray-900 whitespace-nowrap">
                        <span>{expense.amount.toFixed(2)} {expenseCurrency}</span>
                      </div>
                      {user && expense.paidBy === user.email && (() => {
                        const expenseCreatedAt = expense.createdAt?.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt);
                        if (earliestPaymentDate && expenseCreatedAt <= earliestPaymentDate) return null;
                        return (
                          <button
                            className="btn-danger py-1.5 px-4 text-sm min-w-[70px]"
                            onClick={() => deleteExpense(expense.id)}
                          >
                            Delete
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
          {/* Balances */}
          <div>
            <h2 className="section-title">Current Balances</h2>
            <div className="card-clickable overflow-hidden">
              {Object.entries(balances).map(([member, balance]) => (
                <div 
                  key={member} 
                  className={`balance-item ${balance > 0 && !isEffectivelyZero(balance) ? 'positive' : balance < 0 && !isEffectivelyZero(balance) ? 'negative' : 'neutral'}`}
                >
                  <div className="balance-name">{memberDisplay(member)}</div>
                  <div className="balance-amount">
                    {Math.abs(balance).toFixed(2)} {baseCurrency}
                    <span className="balance-status">
                      {balance > 0 && !isEffectivelyZero(balance) ? '(gets back)' : balance < 0 && !isEffectivelyZero(balance) ? '(owes)' : '(even)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Settle Up */}
            <div className="card mt-8 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title m-0">Quick Settle Up</h3>
                <button className="bg-green-600 text-white border-0 rounded-md px-5 py-2 text-lg font-semibold cursor-pointer shadow-[0_1px_4px_rgba(183,228,199,0.67)] transition-[background,box-shadow] duration-[0.18s] disabled:bg-green-200 disabled:text-white disabled:cursor-not-allowed hover:not(:disabled):bg-green-700 hover:not(:disabled):shadow-[0_4px_16px_rgba(183,228,199,0.67)]" onClick={handleNudgeAll} disabled={nudgeLoading}>
                  {nudgeLoading ? 'Nudging...' : 'Nudge All'}
                </button>
              </div>
              {getMinimalSettleUp(balances).length === 0 ? (
                <div className="p-5 bg-green-100 rounded-md text-center border border-green-200">
                  All settled up! No one owes money.
                </div>
              ) : (
                getMinimalSettleUp(balances).map(({ from, to, amount }) => (
                  <div key={from + to} className="bg-white border border-gray-200 rounded-[10px] my-3 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-[0_1px_6px_rgba(60,120,80,0.04)] text-base">
                    <span>
                      <strong>{memberDisplay(from, false)}</strong> owes {amount.toFixed(2)} {baseCurrency} to <strong>{memberDisplay(to, false)}</strong>
                    </span>
                    <button
                      onClick={() => recordPayment(from, to, amount)}
                      className="btn-primary sm:ml-5 w-full sm:w-auto"
                    >
                      Mark as Paid
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Expenses */}
          <div>
            <h2 className="section-title">Recent Expenses</h2>
            <div className="max-h-[500px] overflow-y-auto">
              {expenses
                .slice()
                .sort((a, b) => {
                  const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                  const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                  return bDate - aDate;
                })
                .map(expense => {
                // Conversion logic
                const expenseCurrency = (expense.currency || 'SGD').toUpperCase();
                const showOriginalOnly = baseCurrency === 'DEFAULT';
                
                let displayAmount = expense.amount;
                let displayCurrency = expenseCurrency;
                
                if (!showOriginalOnly) {
                  const base = baseCurrency.toUpperCase();
                  const rateBase = exchangeRates[base];
                  const rateExpense = exchangeRates[expenseCurrency];
                  if (
                    expenseCurrency !== base &&
                    typeof rateBase === 'number' &&
                    typeof rateExpense === 'number' &&
                    rateExpense !== 0
                  ) {
                    displayAmount = expense.amount * (rateBase / rateExpense);
                    displayCurrency = base;
                  }
                }
                
                return (
                  <div key={expense.id} className="card-clickable mb-5">
                    <div className="flex items-center justify-between gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{expense.description}</div>
                        <div className="text-sm text-purple-500 font-medium truncate">{expense.category || 'Other'}</div>
                        <div className="text-sm text-slate-500 truncate">Paid by: {memberDisplay(expense.paidBy)}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-bold text-lg text-gray-900 whitespace-nowrap">
                          <span>{displayAmount.toFixed(2)} {displayCurrency}</span>
                        </div>
                        {user && expense.paidBy === user.email && (() => {
                          const expenseCreatedAt = expense.createdAt?.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt);
                          if (earliestPaymentDate && expenseCreatedAt <= earliestPaymentDate) return null;
                          return (
                            <button
                              className="btn-danger py-1.5 px-4 text-sm min-w-[70px]"
                              onClick={() => deleteExpense(expense.id)}
                            >
                              Delete
                            </button>
                          );
                        })()}
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
        <div className="mt-10">
          <h2 className="section-title">Payment History</h2>
          <div className="bg-gradient-to-br from-slate-50/60 to-green-100/60 border border-gray-200 rounded-2xl py-8 px-7 shadow-[0_4px_24px_rgba(60,120,80,0.07)] relative overflow-visible before:content-[''] before:absolute before:left-[18px] before:top-6 before:bottom-6 before:w-1 before:bg-gradient-to-b before:from-green-200 before:to-green-600 before:rounded-sm before:opacity-[0.18] before:z-0 sm:py-3 sm:px-1">
            {payments
              .slice()
              .sort((a, b) => {
                const aDate = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate);
                const bDate = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate);
                return bDate - aDate;
              })
              .map(payment => {
                const fromName = memberDisplay(payment.fromUser, false);
                const toName = memberDisplay(payment.toUser, false);
                const getInitials = name => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
                
                // Determine display amount and currency
                const paymentCurrency = payment.currency || 'SGD';
                let displayAmount = payment.amount;
                let displayCurrency = paymentCurrency;
                
                if (baseCurrency !== 'DEFAULT') {
                  // Convert to base currency
                  const base = baseCurrency.toUpperCase();
                  const paymentCurr = paymentCurrency.toUpperCase();
                  const rateBase = exchangeRates[base];
                  const ratePayment = exchangeRates[paymentCurr];
                  if (
                    paymentCurr !== base &&
                    typeof rateBase === 'number' &&
                    typeof ratePayment === 'number' &&
                    ratePayment !== 0
                  ) {
                    displayAmount = payment.amount * (rateBase / ratePayment);
                    displayCurrency = base;
                  }
                }
                
                return (
                  <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gradient-to-br from-slate-50/80 to-green-100/60 shadow-[0_6px_32px_rgba(60,120,80,0.10)] border-[1.5px] border-gray-200 rounded-[18px] relative my-4 px-5 py-4 gap-2 transition-[box-shadow,transform] duration-[0.22s,0.18s] hover:shadow-[0_12px_48px_rgba(60,120,80,0.18)] hover:-translate-y-[3px]">
                    <span className="flex items-center gap-2 text-base font-medium flex-wrap">
                      <span className="w-9 h-9 text-base rounded-full flex items-center justify-center font-bold shrink-0" style={{background:'#e3f2fd',color:'#1976d2',border:'2px solid #b7e4c7'}}>{getInitials(fromName)}</span>
                      <strong style={{color:'#1976d2'}}>{fromName}</strong>
                      <span className="text-green-600 font-bold">→</span>
                      <span className="w-9 h-9 text-base rounded-full flex items-center justify-center font-bold shrink-0" style={{background:'#e8f5e9',color:'#388e3c',border:'2px solid #b7e4c7'}}>{getInitials(toName)}</span>
                      <strong style={{color:'#388e3c'}}>{toName}</strong>
                    </span>
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <span className="text-green-900 font-extrabold tracking-wide">{Number(displayAmount).toFixed(2)} {displayCurrency}</span>
                      <span className="text-gray-400 text-sm italic">
                        {payment.paymentDate.toDate?.().toLocaleDateString() || 'Recently'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupExpenses;
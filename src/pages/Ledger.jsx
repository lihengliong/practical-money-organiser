import React, { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

const Ledger = () => {
  const [user] = useAuthState(auth);
  const [friendBalances, setFriendBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      if (!user) return;
      setLoading(true);
      // Fetch all groups the user is in
      const groupsSnapshot = await getDocs(query(collection(db, 'groups'), where('members', 'array-contains', user.email)));
      const groups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Fetch all expenses and payments for these groups
      let allExpenses = [];
      let allPayments = [];
      for (const group of groups) {
        const expensesSnapshot = await getDocs(query(collection(db, 'expenses'), where('groupId', '==', group.id)));
        allExpenses = allExpenses.concat(expensesSnapshot.docs.map(doc => ({ ...doc.data(), group })));
        const paymentsSnapshot = await getDocs(query(collection(db, 'payments'), where('groupId', '==', group.id)));
        allPayments = allPayments.concat(paymentsSnapshot.docs.map(doc => ({ ...doc.data(), group })));
      }
      // Calculate net balance with each friend
      const balances = {};
      groups.forEach(group => {
        group.members.forEach(member => {
          if (member !== user.email) {
            if (!balances[member]) balances[member] = 0;
          }
        });
      });
      // Expenses
      allExpenses.forEach(expense => {
        if (expense.paidBy === user.email) {
          expense.splits.forEach(split => {
            if (split.member !== user.email) {
              balances[split.member] += split.amountOwed;
            }
          });
        } else if (expense.splits.some(s => s.member === user.email)) {
          const userSplit = expense.splits.find(s => s.member === user.email);
          balances[expense.paidBy] -= userSplit.amountOwed;
        }
      });
      // Payments
      allPayments.forEach(payment => {
        if (payment.fromUser === user.email) {
          balances[payment.toUser] += payment.amount;
        } else if (payment.toUser === user.email) {
          balances[payment.fromUser] -= payment.amount;
        }
      });
      // Convert to array for display
      const friendBalancesArr = Object.entries(balances).map(([friend, amount]) => ({ friend, amount }));
      setFriendBalances(friendBalancesArr);
      setLoading(false);
    };
    fetchLedger();
  }, [user]);

  if (!user) return <div>Please log in to view your ledger.</div>;
  if (loading) return <div>Loading ledger...</div>;

  return (
    <div className="ledger-container">
      <h2>Overall Ledger</h2>
      {friendBalances.filter(({ amount }) => amount !== 0).length === 0 ? (
        <div>No outstanding balances.</div>
      ) : (
        <ul className="ledger-list">
          {friendBalances.filter(({ amount }) => amount !== 0).map(({ friend, amount }) => (
            <li key={friend} className="ledger-item">
              {amount > 0 ? (
                <>
                  <span>You are owed <strong style={{ color: 'green' }}>${amount.toFixed(2)}</strong> by <strong>{friend}</strong></span>
                </>
              ) : (
                <>
                  <span>You owe <strong style={{ color: 'red' }}>${Math.abs(amount).toFixed(2)}</strong> to <strong>{friend}</strong></span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Ledger; 
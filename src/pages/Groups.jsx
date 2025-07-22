import { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import './stylesheets/groups.css';
import { fetchExchangeRates } from '../utils/currency';

function Groups() {
    const [groupName, setGroupName] = useState('');
    const [groups, setGroups] = useState([]);
    const [friends, setFriends] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [user] = useAuthState(auth);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [addingEmail, setAddingEmail] = useState(false);
    const navigate = useNavigate();
    const [groupBalances, setGroupBalances] = useState({});
    // Add state for base currency and exchange rates
    const [baseCurrency, setBaseCurrency] = useState('SGD'); // Default to SGD
    const [exchangeRates, setExchangeRates] = useState({ SGD: 1 });
    const [fetchingRates, setFetchingRates] = useState(false);
    const [loadingRates, setLoadingRates] = useState(true);

    useEffect(() => {
      if (user) {
        fetchFriends();
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

    const fetchFriends = async () => {
      try {
        const friendsQuery1 = query(
          collection(db, 'friendships'),
          where('user1', '==', user.email),
          where('status', '==', 'accepted')
        );
        const friendsQuery2 = query(
          collection(db, 'friendships'),
          where('user2', '==', user.email),
          where('status', '==', 'accepted')
        );

        const [friends1, friends2] = await Promise.all([
          getDocs(friendsQuery1),
          getDocs(friendsQuery2)
        ]);

        const allFriends = [];
        friends1.docs.forEach(doc => {
          allFriends.push({ id: doc.id, friendEmail: doc.data().user2, ...doc.data() });
        });
        friends2.docs.forEach(doc => {
          allFriends.push({ id: doc.id, friendEmail: doc.data().user1, ...doc.data() });
        });

        // Fetch profile information for all friends
        const friendsWithProfiles = await Promise.all(
          allFriends.map(async (friend) => {
            const profile = await fetchUserProfile(friend.friendEmail);
            return {
              ...friend,
              friendProfile: profile
            };
          })
        );

        setFriends(friendsWithProfiles);
      } catch (error) {
        console.error('Error fetching friends:', error);
        setError('Error loading friends');
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
                    balance += (split.amountOwed / exchangeRates[expenseCurrency]);
                  } else {
                    balance += split.amountOwed;
                  }
                }
              });
            } else if (expense.splits.some(s => s.member === user.email)) {
              const userSplit = expense.splits.find(s => s.member === user.email);
              if (expenseCurrency !== baseCurrency && exchangeRates[expenseCurrency]) {
                balance -= (userSplit.amountOwed / exchangeRates[expenseCurrency]);
              } else {
                balance -= userSplit.amountOwed;
              }
            }
          });
          payments.forEach(payment => {
            // Assume payments are always in base currency for now
            // If you want to support payment currency, add similar conversion logic
            if (payment.fromUser === user.email) {
              balance += payment.amount;
            } else if (payment.toUser === user.email) {
              balance -= payment.amount;
            }
          });
          balances[group.id] = balance;
        }
        setGroupBalances(balances);
      };
      fetchAllGroupBalances();
    }, [user, groups, exchangeRates, baseCurrency]);

    const toggleFriendSelection = (friendEmail) => {
      setSelectedMembers(prev => {
        if (prev.includes(friendEmail)) {
          return prev.filter(email => email !== friendEmail);
        } else {
          return [...prev, friendEmail];
        }
      });
    };

    const addEmailMember = async () => {
      if (!emailInput.trim()) {
        setError('Please enter an email address');
        return;
      }

      if (emailInput === user.email) {
        setError('You cannot add yourself');
        setEmailInput('');
        return;
      }

      if (selectedMembers.includes(emailInput)) {
        setError('This user is already added to the group');
        setEmailInput('');
        return;
      }

      try {
        setAddingEmail(true);
        setError('');

        const userQuery = query(
          collection(db, 'users'),
          where('email', '==', emailInput.trim())
        );
        const userSnapshot = await getDocs(userQuery);
        
        if (userSnapshot.empty) {
          setError('User with this email does not exist in the app. They need to create an account first.');
          return;
        }

        setSelectedMembers(prev => [...prev, emailInput.trim()]);
        setEmailInput('');
        setError('');

      } catch (error) {
        console.error('Error validating user:', error);
        setError('Error validating user. Please try again.');
      } finally {
        setAddingEmail(false);
      }
    };

    const handleEmailKeyPress = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addEmailMember();
      }
    };

    const removeMember = (email) => {
      setSelectedMembers(prev => prev.filter(member => member !== email));
    };
  
    const createGroup = async () => {
      if (!groupName) {
        setError('Please enter a group name');
        return;
      }

      if (selectedMembers.length === 0) {
        setError('Please add at least one member to the group');
        return;
      }

      try {
        const allMembers = [user.email, ...selectedMembers];

        await addDoc(collection(db, 'groups'), {
          name: groupName,
          members: allMembers,
          createdBy: user.email,
          createdAt: new Date(),
        });

        // Push notifications to all added members except the creator
        await Promise.all(selectedMembers.map(memberEmail =>
          addDoc(collection(db, 'notifications'), {
            type: 'group_add',
            user: memberEmail,
            groupName: groupName,
            createdBy: user.email,
            createdAt: new Date(),
            message: `You were added to the group '${groupName}' by ${user.email}`
          })
        ));

        setGroupName('');
        setSelectedMembers([]);
        setEmailInput('');
        setError('');
        
        fetchGroups();
        alert('Group created successfully!');
      } catch (error) {
        console.error('Error creating group:', error);
        setError('Error creating group. Please try again.');
      }
    };

    // Navigate to expenses page for a specific group
    const openGroupExpenses = (group) => {
      console.log('Navigating to group:', group.id);
      console.log('Full group object:', group);
      navigate(`/activities/${group.id}`, { state: { group } });
    };

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

    const isEmailFriend = (email) => {
      return friends.some(friend => friend.friendEmail === email);
    };
    
    return (
      <div className="groups-container">
        {loadingRates && (
          <div style={{ color: '#888', marginBottom: 16 }}>Loading exchange rates...</div>
        )}
        {/* Base currency selector */}
        <div className="base-currency-section" style={{ marginBottom: 20 }}>
          <label htmlFor="base-currency-select"><strong>Base Currency:</strong> </label>
          <select
            id="base-currency-select"
            value={baseCurrency}
            onChange={e => setBaseCurrency(e.target.value)}
            disabled={fetchingRates}
            style={{ marginLeft: 8, padding: '2px 8px' }}
          >
            {/* Add more currencies as needed */}
            <option value="SGD">SGD (Singapore Dollar)</option>
            <option value="USD">USD (US Dollar)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="MYR">MYR (Malaysian Ringgit)</option>
            <option value="IDR">IDR (Indonesian Rupiah)</option>
            <option value="THB">THB (Thai Baht)</option>
            <option value="VND">VND (Vietnamese Dong)</option>
            <option value="PHP">PHP (Philippine Peso)</option>
            <option value="INR">INR (Indian Rupee)</option>
            <option value="CNY">CNY (Chinese Yuan)</option>
            <option value="JPY">JPY (Japanese Yen)</option>
            {/* ... */}
          </select>
          {fetchingRates && <span style={{ marginLeft: 10, color: '#888' }}>Fetching rates...</span>}
        </div>
        <h2>Create a Group</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="create-group-form">
          <input
            type="text"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="group-name-input"
          />
          
          {friends.length > 0 && (
            <div className="friends-section">
              <h3>Quick Add: Select from Your Friends</h3>
              <p className="friends-description">
                Check boxes to quickly add friends without typing their emails
              </p>
              <div className="friends-list">
                {friends.map(friend => (
                  <label key={friend.id} className="friend-item">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(friend.friendEmail)}
                      onChange={() => toggleFriendSelection(friend.friendEmail)}
                      className="friend-checkbox"
                    />
                    <div className="friend-display">
                      <div className="friend-info">
                        <span className="friend-name">
                          {friend.friendProfile?.displayName || friend.friendEmail.split('@')[0]}
                        </span>
                        <span className="friend-email">
                          {friend.friendEmail}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="email-section">
            <h3>Add Members by Email</h3>
            <p className="email-description">
              Add a non-friend by typing their email
            </p>
            <div className="email-input-container">
              <input
                type="email"
                placeholder="Enter email address and press Enter"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={handleEmailKeyPress}
                className="email-input"
                disabled={addingEmail}
              />
              <button 
                onClick={addEmailMember}
                disabled={addingEmail || !emailInput.trim()}
                className="add-email-btn"
              >
                {addingEmail ? 'Checking...' : 'Add'}
              </button>
            </div>
            <small className="email-help-text">
              Press Enter or click Add. Only registered users can be added.
            </small>
          </div>

          {selectedMembers.length > 0 && (
            <div className="members-preview">
              <strong>Group Members ({selectedMembers.length + 1}):</strong>
              <div className="members-list">
                <span className="member-tag current-user">
                  {user.email} (You)
                </span>
                {selectedMembers.map(email => (
                  <span 
                    key={email}
                    className={`member-tag ${isEmailFriend(email) ? 'friend' : 'other'}`}
                    onClick={() => removeMember(email)}
                    title="Click to remove"
                  >
                    {email} ✕
                  </span>
                ))}
              </div>
              <div className="members-legend">
                <span className="legend-dot friend-dot"></span> Friend
                <span className="legend-dot other-dot"></span> Other
                <span className="legend-dot current-user-dot"></span> You
                <span className="members-help-text" style={{ marginLeft: 10 }}>
                  Click a member to remove
                </span>
              </div>
            </div>
          )}
          
          <button 
            onClick={createGroup}
            className={`create-group-btn${groupName && selectedMembers.length > 0 ? ' ready' : ''}`}
            disabled={loading}
          >
            Create Group
          </button>
        </div>

        <div className="groups-list-section">
          <h2>Your Groups</h2>
          {groups.length === 0 ? (
            <p className="no-groups-message">No groups yet. Create your first group above!</p>
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
                        // Ensure currency codes are uppercase
                        const expenseCurrency = (expense.currency || baseCurrency).toUpperCase();
                        const base = baseCurrency.toUpperCase();
                        let convertedAmount = expense.amount;
                        const rate = exchangeRates && exchangeRates[expenseCurrency];
                        console.log('Expense:', expense.description, 'Expense currency:', expenseCurrency, 'Base:', base, 'Rate:', rate, 'Rates:', exchangeRates);
                        if (
                          expenseCurrency !== base &&
                          typeof rate === 'number' &&
                          rate !== 0
                        ) {
                          convertedAmount = expense.amount / rate;
                        } else if (expenseCurrency !== base) {
                          console.warn('Conversion unavailable:', { expenseCurrency, base, exchangeRates });
                          convertedAmount = null;
                        }
                        return (
                          <div key={idx} style={{ fontSize: '0.98em', marginBottom: 2 }}>
                            <span style={{ fontWeight: 500 }}>{expense.description}</span>: {expense.amount?.toFixed(2)} {expenseCurrency}
                            {convertedAmount === null
                              ? <span style={{ color: 'red' }}> (conversion unavailable)</span>
                              : expenseCurrency !== base && (
                                  <span style={{ color: '#888', fontSize: '0.95em' }}>
                                    {' '} (≈ {convertedAmount.toFixed(2)} {base})
                                  </span>
                                )
                            }
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
                        // Show both base and converted if base is not SGD
                        const base = baseCurrency.toUpperCase();
                        const preferred = 'SGD'; // Change this to user's preferred currency if needed
                        const rate = exchangeRates && exchangeRates[preferred];
                        let converted = groupBalances[group.id];
                        let showConverted = false;
                        if (
                          base !== preferred &&
                          typeof rate === 'number' &&
                          rate !== 0
                        ) {
                          converted = groupBalances[group.id] * rate;
                          showConverted = true;
                        }
                        return (
                          <>
                            {groupBalances[group.id] > 0 ? (
                              <span style={{ color: 'green', fontWeight: 600 }}>
                                You are owed ${groupBalances[group.id].toFixed(2)} {base}
                                {showConverted && (
                                  <span style={{ color: '#007bff', fontWeight: 500, marginLeft: 8 }}>
                                    (≈ {converted.toFixed(2)} {preferred})
                                  </span>
                                )}
                              </span>
                            ) : groupBalances[group.id] < 0 ? (
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
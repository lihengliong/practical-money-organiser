import { useEffect, useState } from 'react';
import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import './stylesheets/groups.css';

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
        
        // Fetch display names for group members
        const enrichedGroups = await Promise.all(
          userGroups.map(async group => {
            const memberProfiles = await Promise.all(
              group.members.map(async email => {
                const profile = await fetchUserProfile(email);
                return { email, displayName: profile.displayName };
              })
            );
            return {
              ...group,
              memberProfiles,
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
              <small className="members-help-text">
                🟢 Green = Friends, ⚫ Gray = Others, Click to remove
              </small>
            </div>
          )}
          
          <button onClick={createGroup} className="create-group-btn">
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
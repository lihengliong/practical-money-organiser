import { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import './stylesheets/group-create.css';

function GroupCreate() {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [user] = useAuthState(auth);
  const [error, setError] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const navigate = useNavigate();

  // Fetch user's friends
  useEffect(() => {
    const fetchFriends = async () => {
      if (!user) return;
      
      try {
        setLoadingFriends(true);
        console.log('Fetching friends for user:', user.email);
        
        // Get accepted friendships (where current user is either user1 or user2)
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

        // Combine friends from both queries
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
            // Get friend's profile information
            const profileQuery = query(
              collection(db, 'users'),
              where('email', '==', friend.friendEmail)
            );
            const profileSnapshot = await getDocs(profileQuery);
            let displayName = friend.friendEmail.split('@')[0];
            
            if (!profileSnapshot.empty) {
              const profile = profileSnapshot.docs[0].data();
              displayName = profile.displayName || profile.name || friend.friendEmail.split('@')[0];
            }
            
            return {
              id: friend.id,
              email: friend.friendEmail,
              displayName: displayName,
              ...friend
            };
          })
        );
        
        console.log('Friends fetched:', friendsWithProfiles);
        setFriends(friendsWithProfiles);
      } catch (error) {
        console.error('Error fetching friends:', error);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [user]);

  // Handle friend selection
  const toggleFriendSelection = (friendEmail) => {
    setSelectedFriends(prev => {
      if (prev.includes(friendEmail)) {
        // Remove friend from selection
        const newSelected = prev.filter(email => email !== friendEmail);
        // Also remove from selectedMembers if they were added
        setSelectedMembers(prevMembers => prevMembers.filter(email => email !== friendEmail));
        return newSelected;
      } else {
        // Add friend to selection
        const newSelected = [...prev, friendEmail];
        // Also add to selectedMembers if not already there
        setSelectedMembers(prevMembers => {
          if (!prevMembers.includes(friendEmail)) {
            return [...prevMembers, friendEmail];
          }
          return prevMembers;
        });
        return newSelected;
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
    setSelectedFriends(prev => prev.filter(friend => friend !== email));
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
      const groupRef = await addDoc(collection(db, 'groups'), {
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
      setSelectedFriends([]);
      setEmailInput('');
      setError('');
      
      // Navigate to the newly created group's expenses page
      const newGroup = {
        id: groupRef.id,
        name: groupName,
        members: allMembers,
        createdBy: user.email,
        createdAt: new Date(),
      };
      navigate(`/group-expenses/${groupRef.id}`, { state: { group: newGroup } });
      alert('Group created successfully!');
    } catch (error) {
      console.error('Error creating group:', error);
      setError('Error creating group. Please try again.');
    }
  };

  if (!user) {
    return <div className="login-required">Please log in to create a group.</div>;
  }

  console.log('Rendering GroupCreate component. Friends count:', friends.length, 'Loading:', loadingFriends);

  return (
    <div className="create-group-form">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/groups')} 
        className="back-to-groups-btn"
      >
        ← Back to Groups
      </button>
      
      <h2>Create a Group</h2>
      {error && <div className="error-message">{error}</div>}
      
      <input
        type="text"
        placeholder="Group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="group-name-input"
      />

      {/* Quick Add Friends Section */}
      {loadingFriends ? (
        <div className="loading-friends">
          <p>Loading your friends...</p>
        </div>
      ) : friends.length > 0 ? (
        <div className="quick-add-friends-section">
          <h3>Quick Add: Select from Your Friends</h3>
          <p className="quick-add-description">
            Check boxes to quickly add friends without typing their emails
          </p>
          <div className="friends-grid">
            {friends.map(friend => (
              <div 
                key={friend.id}
                className="friend-card"
                onClick={() => toggleFriendSelection(friend.email)}
              >
                <input
                  type="checkbox"
                  checked={selectedFriends.includes(friend.email)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleFriendSelection(friend.email);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="friend-checkbox"
                />
                <div className="friend-info">
                  <div className="friend-name">{friend.displayName}</div>
                  <div className="friend-email">{friend.email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-friends-message">
          <p>You don't have any friends yet. Add friends first to use the quick add feature.</p>
        </div>
      )}

      <div className="email-section">
        <h3>Add Members by Email</h3>
        <p className="email-description">Add a non-friend by typing their email</p>
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
          <h3>Group Members ({selectedMembers.length + 1}):</h3>
          <div className="members-list">
            <span className="member-tag current-user">
              {user.email} (You)
            </span>
            {selectedMembers.map(email => (
              <span 
                key={email}
                className={`member-tag ${selectedFriends.includes(email) ? 'friend' : 'other'}`}
                onClick={() => removeMember(email)}
                title="Click to remove"
              >
                {email} ✕
              </span>
            ))}
          </div>
          <div className="member-legend">
            <span className="legend-item">
              <span className="legend-dot current-user-dot"></span>
              You
            </span>
            <span className="legend-item">
              <span className="legend-dot friend-dot"></span>
              Friends
            </span>
            <span className="legend-item">
              <span className="legend-dot other-dot"></span>
              Others
            </span>
            <span className="legend-text">Click to remove</span>
          </div>
        </div>
      )}

      <button 
        onClick={createGroup}
        className={`create-group-btn${groupName && selectedMembers.length > 0 ? ' ready' : ''}`}
      >
        Create Group
      </button>
    </div>
  );
}

export default GroupCreate; 
import { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase.js';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';

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
    <div className="max-w-[1200px] mx-auto my-10 px-5 bg-gradient-to-br from-slate-50 to-slate-200 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] p-10 relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-blue-500 before:via-purple-500 before:to-cyan-500 before:rounded-t-3xl">
      {/* Back Button */}
      <button 
        onClick={() => navigate('/groups')} 
        className="btn-ghost mb-8"
      >
        ← Back to Groups
      </button>
      
      <h2 className="text-left mb-9 text-slate-800 text-4xl font-extrabold bg-gradient-to-br from-slate-800 to-slate-600 bg-clip-text text-transparent pb-2.5 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-[60px] after:h-1 after:bg-gradient-to-r after:from-blue-500 after:to-purple-500 after:rounded-sm">Create a Group</h2>
      {error && <div className="error-msg">{error}</div>}
      
      <input
        type="text"
        placeholder="Group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="input-field mb-9"
      />

      {/* Quick Add Friends Section */}
      {loadingFriends ? (
        <div className="mb-9 text-center p-8 bg-gradient-to-br from-slate-50 to-slate-200 rounded-2xl border-2 border-slate-200 shadow-[0_8px_25px_rgba(0,0,0,0.05)] relative overflow-hidden before:content-[''] before:absolute before:top-0 before:-left-full before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-blue-500/10 before:to-transparent before:animate-[shimmer_2s_infinite]">
          <p className="text-slate-600 text-lg m-0 font-semibold relative z-[1]">Loading your friends...</p>
        </div>
      ) : friends.length > 0 ? (
        <div className="mb-9 bg-white/60 rounded-[20px] p-8 shadow-[0_8px_25px_rgba(0,0,0,0.05)] backdrop-blur-[10px]">
          <h3>Quick Add: Select from Your Friends</h3>
          <p className="quick-add-description">
            Check boxes to quickly add friends without typing their emails
          </p>
          <div className="friends-grid">
            {friends.map(friend => (
              <div 
                key={friend.id}
                className="border-2 border-slate-200 rounded-2xl p-5 bg-gradient-to-br from-white to-slate-50 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex items-center gap-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] relative overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-gradient-to-r before:from-blue-500 before:to-purple-500 before:scale-x-0 before:transition-transform before:duration-300 before:ease-in-out hover:border-blue-500 hover:shadow-[0_12px_40px_rgba(59,130,246,0.15)] hover:-translate-y-1 hover:before:scale-x-100"
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
                  className="w-5 h-5 accent-blue-500 cursor-pointer scale-110 transition-transform duration-200 ease-in-out z-10 relative checked:scale-125"
                />
                <div className="flex-1">
                  <div className="font-bold text-slate-800 mb-1 text-lg tracking-tight">{friend.displayName}</div>
                  <div className="text-sm text-slate-600 font-medium">{friend.email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-9 text-center p-8 bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl border-2 border-amber-200 shadow-[0_8px_25px_rgba(245,158,11,0.1)]">
          <p className="text-amber-900 text-lg m-0 font-semibold">You don't have any friends yet. Add friends first to use the quick add feature.</p>
        </div>
      )}

      <div className="mb-9 bg-white/60 rounded-[20px] p-8 shadow-[0_8px_25px_rgba(0,0,0,0.05)] backdrop-blur-[10px]">
        <h3 className="text-[1.4rem] font-bold mb-3 text-slate-800 flex items-center gap-2.5 before:content-['📧'] before:text-[1.2rem]">Add Members by Email</h3>
        <p className="text-base text-slate-600 mb-5 font-medium">Add a non-friend by typing their email</p>
        <div className="flex gap-4 mb-3">
          <input
            type="email"
            placeholder="Enter email address and press Enter"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyPress={handleEmailKeyPress}
            className="input-field flex-1"
            disabled={addingEmail}
          />
          <button 
            onClick={addEmailMember}
            disabled={addingEmail || !emailInput.trim()}
            className="btn-ghost min-w-[100px] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {addingEmail ? 'Checking...' : 'Add'}
          </button>
        </div>
        <small className="text-sm text-slate-600 font-medium">
          Press Enter or click Add. Only registered users can be added.
        </small>
      </div>

      {selectedMembers.length > 0 && (
        <div className="mb-9 bg-white/60 rounded-[20px] p-8 shadow-[0_8px_25px_rgba(0,0,0,0.05)] backdrop-blur-[10px]">
          <h3 className="text-[1.4rem] font-bold mb-5 text-slate-800 flex items-center gap-2.5 before:content-['👥'] before:text-[1.2rem]">Group Members ({selectedMembers.length + 1}):</h3>
          <div className="flex flex-wrap gap-4 mb-5">
            <span className="px-5 py-3 rounded-[25px] text-[0.95rem] font-semibold flex items-center gap-2.5 cursor-default transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] relative overflow-hidden before:content-[''] before:absolute before:top-0 before:-left-full before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-[left] before:duration-500 bg-gradient-to-br from-blue-500 to-blue-800">
              {user.email} (You)
            </span>
            {selectedMembers.map(email => (
              <span 
                key={email}
                className={`px-5 py-3 rounded-[25px] text-[0.95rem] font-semibold flex items-center gap-2.5 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] relative overflow-hidden before:content-[''] before:absolute before:top-0 before:-left-full before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-[left] before:duration-500 hover:-translate-y-[3px] hover:scale-105 hover:shadow-[0_8px_25px_rgba(0,0,0,0.25)] hover:before:left-full ${selectedFriends.includes(email) ? 'bg-gradient-to-br from-green-500 to-green-700' : 'bg-gradient-to-br from-gray-500 to-gray-700'}`}
                onClick={() => removeMember(email)}
                title="Click to remove"
              >
                {email} ✕
              </span>
            ))}
          </div>
          <div className="text-sm text-slate-600 flex gap-6 flex-wrap items-center font-medium">
            <span className="flex items-center gap-2 px-3 py-2 bg-white/80 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
              <span className="w-3.5 h-3.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-br from-blue-500 to-blue-800"></span>
              You
            </span>
            <span className="flex items-center gap-2 px-3 py-2 bg-white/80 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
              <span className="w-3.5 h-3.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-br from-green-500 to-green-700"></span>
              Friends
            </span>
            <span className="flex items-center gap-2 px-3 py-2 bg-white/80 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
              <span className="w-3.5 h-3.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] bg-gradient-to-br from-gray-500 to-gray-700"></span>
              Others
            </span>
            <span className="text-slate-600 font-semibold px-3 py-2 bg-white/80 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.05)]">Click to remove</span>
          </div>
        </div>
      )}

      <button 
        onClick={createGroup}
        className={groupName && selectedMembers.length > 0 ? 'btn-primary w-full mt-8' : 'w-full py-5 bg-gradient-to-br from-gray-400 to-gray-500 text-white border-0 rounded-2xl text-xl font-bold cursor-not-allowed transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] mt-8 shadow-[0_8px_25px_rgba(156,163,175,0.3)] relative overflow-hidden tracking-wide before:content-[""] before:absolute before:top-0 before:-left-full before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-[left] before:duration-500'}
      >
        Create Group
      </button>
    </div>
  );
}

export default GroupCreate; 
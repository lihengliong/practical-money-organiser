import { useState } from 'react';
import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';

function GroupCreate() {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [emailInput, setEmailInput] = useState('');
  const [user] = useAuthState(auth);
  const [error, setError] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const navigate = useNavigate();

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

  return (
    <div className="create-group-form" style={{ maxWidth: 600, margin: '40px auto' }}>
      <h2>Create a Group</h2>
      {error && <div className="error-message">{error}</div>}
      <input
        type="text"
        placeholder="Group name"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        className="group-name-input"
      />
      <div className="email-section">
        <h3>Add Members by Email</h3>
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
                className="member-tag other"
                onClick={() => removeMember(email)}
                title="Click to remove"
              >
                {email} ✕
              </span>
            ))}
          </div>
        </div>
      )}
      <button 
        onClick={createGroup}
        className={`create-group-btn${groupName && selectedMembers.length > 0 ? ' ready' : ''}`}
        style={{ marginTop: 24 }}
      >
        Create Group
      </button>
    </div>
  );
}

export default GroupCreate; 
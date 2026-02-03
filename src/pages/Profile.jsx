import { useState } from 'react';
import { auth, db } from '../config/firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, setDoc } from 'firebase/firestore';
import './stylesheets/profile.css';

const DEFAULT_DESC = 'Tell us a little about yourself!';

const Profile = () => {
  const [user] = useAuthState(auth);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [savingName, setSavingName] = useState(false);
  const [desc, setDesc] = useState(user?.desc || DEFAULT_DESC);

  const handleChangePassword = async () => {
    setMessage('');
    setError('');
    setChanging(true);
    try {
      if (!newPassword || newPassword.length < 6) {
        setError('Password must be at least 6 characters.');
        setChanging(false);
        return;
      }
      await updatePassword(auth.currentUser, newPassword);
      setMessage('Password changed successfully!');
      setNewPassword('');
    } catch {
      setError('Failed to change password. You may need to re-login.');
    } finally {
      setChanging(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingName(true);
    setMessage('');
    setError('');
    try {
      if (!displayName || displayName.length < 2) {
        setError('Display name must be at least 2 characters.');
        setSavingName(false);
        return;
      }
      await updateProfile(auth.currentUser, { displayName });
      await setDoc(doc(db, 'users', user.uid), { displayName, desc }, { merge: true });
      await auth.currentUser.reload();
      setMessage('Profile updated!');
      setEditing(false);
    } catch (err) {
      setError('Failed to update profile. ' + (err && err.message ? err.message : ''));
      console.error('Profile update error:', err);
    } finally {
      setSavingName(false);
    }
  };

  if (!user) {
    return <div className="profile-container"><div className="profile-message">Please log in to view your profile.</div></div>;
  }

  return (
    <div className="profile-card-redesign">
      <div className="profile-avatar-section">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar placeholder">
            {user.displayName ? user.displayName[0].toUpperCase() : user.email[0].toUpperCase()}
          </div>
        </div>
      </div>
      <div className="profile-main-info">
        {editing ? (
          <input
            className="profile-input profile-input-name profile-big-name"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            disabled={savingName}
            maxLength={32}
            style={{ textAlign: 'center' }}
          />
        ) : (
          <div className="profile-big-name">{user.displayName || <span style={{ color: '#888' }}>[No name set]</span>}</div>
        )}
        <div className="profile-subtitle">{user.email}</div>
        {editing ? (
          <textarea
            className="profile-desc profile-desc-edit"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={120}
            rows={2}
            placeholder={DEFAULT_DESC}
          />
        ) : (
          <div className="profile-desc">{desc || DEFAULT_DESC}</div>
        )}
      </div>
      {editing ? (
        <>
          <div className="profile-edit-btn-row">
            <button className="profile-btn save-btn profile-edit-btn" onClick={handleSaveProfile} disabled={savingName}>
              {savingName ? 'Saving...' : 'Save'}
            </button>
            <button className="profile-btn cancel-btn profile-edit-btn" onClick={() => { setEditing(false); setDisplayName(user.displayName || ''); setDesc(user.desc || DEFAULT_DESC); setNewPassword(''); setError(''); setMessage(''); }} disabled={savingName}>
              Cancel
            </button>
          </div>
          <div className="profile-section-title">Change Password</div>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="profile-input"
          />
          <button onClick={handleChangePassword} disabled={changing} className="profile-btn save-btn profile-edit-btn">
            {changing ? 'Changing...' : 'Change Password'}
          </button>
        </>
      ) : (
        <button className="profile-btn profile-edit-btn" onClick={() => setEditing(true)}>
          Edit Profile
        </button>
      )}
      {message && <div className="profile-message success">{message}</div>}
      {error && <div className="profile-message error">{error}</div>}
    </div>
  );
};

export default Profile; 
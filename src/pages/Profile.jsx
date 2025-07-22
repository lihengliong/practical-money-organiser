import { useState } from 'react';
import { auth } from '../config/firebase';
import { updatePassword } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';

const Profile = () => {
  const [user] = useAuthState(auth);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);

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

  if (!user) {
    return <div style={{ padding: 32 }}>Please log in to view your profile.</div>;
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #eee' }}>
      <h2>Profile</h2>
      <div style={{ marginBottom: 16 }}><strong>Email:</strong> {user.email}</div>
      <div style={{ margin: '24px 0 8px 0', fontWeight: 'bold' }}>Change Password</div>
      <input
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 4, border: '1px solid #ccc' }}
      />
      <button onClick={handleChangePassword} disabled={changing} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: '#28a745', color: '#fff', cursor: 'pointer' }}>
        {changing ? 'Changing...' : 'Change Password'}
      </button>
      {message && <div style={{ color: 'green', marginTop: 16 }}>{message}</div>}
      {error && <div style={{ color: 'red', marginTop: 16 }}>{error}</div>}
    </div>
  );
};

export default Profile; 
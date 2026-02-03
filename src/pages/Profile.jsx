import { useState } from 'react';
import { auth, db } from '../config/firebase';
import { updatePassword, updateProfile } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, setDoc } from 'firebase/firestore';

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
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg flex flex-col items-stretch">
        <div className="mt-4 text-lg text-center text-gray-500">Please log in to view your profile.</div>
      </div>
    );
  }

  return (
    <div className="max-w-[410px] mx-auto mt-14 pb-8 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200
                    rounded-3xl shadow-lg flex flex-col items-center relative">
      {/* Avatar Section */}
      <div className="flex flex-col items-center -mt-14 mb-4">
        <div className="mb-2.5">
          <div className="w-[120px] h-[120px] rounded-full shadow-lg border-[5px] border-white
                          bg-slate-200 flex items-center justify-content text-5xl font-bold text-slate-700">
            <span className="w-full text-center">
              {user.displayName ? user.displayName[0].toUpperCase() : user.email[0].toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Info */}
      <div className="flex flex-col items-center mb-4 px-6 w-full">
        {editing ? (
          <input
            className="text-3xl font-extrabold text-slate-700 mb-0.5 tracking-wide text-center
                       bg-white border-2 border-slate-400 shadow-md py-2.5 px-4 rounded-lg w-full max-w-[260px]
                       focus:border-slate-700 focus:outline-none"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            disabled={savingName}
            maxLength={32}
          />
        ) : (
          <div className="text-3xl font-extrabold text-slate-700 mb-0.5 tracking-wide text-center">
            {user.displayName || <span className="text-gray-400">[No name set]</span>}
          </div>
        )}
        <div className="text-slate-500 text-lg font-semibold mb-1.5 text-center">{user.email}</div>
        {editing ? (
          <textarea
            className="text-slate-500 text-base font-normal mb-4 text-center opacity-85
                       border-[1.5px] border-slate-400 shadow-sm bg-white rounded-lg p-2 w-full
                       focus:border-slate-700 focus:outline-none resize-none"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={120}
            rows={2}
            placeholder={DEFAULT_DESC}
          />
        ) : (
          <div className="text-slate-500 text-base font-normal mb-4 text-center opacity-85">
            {desc || DEFAULT_DESC}
          </div>
        )}
      </div>

      {/* Actions */}
      {editing ? (
        <div className="px-6 w-full flex flex-col items-center">
          <div className="flex justify-center items-center gap-4 mt-3">
            <button
              className="w-[120px] rounded-full py-2.5 text-lg font-bold shadow-md border-none
                         bg-gradient-to-r from-emerald-400 to-teal-400 text-white
                         hover:from-teal-400 hover:to-emerald-400 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.04]
                         transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSaveProfile}
              disabled={savingName}
            >
              {savingName ? 'Saving...' : 'Save'}
            </button>
            <button
              className="w-[120px] rounded-full py-2.5 text-lg font-bold shadow-md
                         bg-slate-100 text-gray-500 border-[1.5px] border-slate-300
                         hover:bg-slate-200 transition-all duration-200
                         disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => {
                setEditing(false);
                setDisplayName(user.displayName || '');
                setDesc(user.desc || DEFAULT_DESC);
                setNewPassword('');
                setError('');
                setMessage('');
              }}
              disabled={savingName}
            >
              Cancel
            </button>
          </div>

          <div className="font-bold text-slate-500 mt-6 mb-2 text-lg text-center">Change Password</div>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full max-w-[260px] py-2 px-3 mb-2 rounded-lg border-[1.5px] border-slate-300
                       text-lg bg-slate-50 focus:border-slate-700 focus:outline-none transition-colors"
          />
          <button
            onClick={handleChangePassword}
            disabled={changing}
            className="w-[120px] rounded-full py-2.5 text-lg font-bold shadow-md border-none mt-2
                       bg-gradient-to-r from-emerald-400 to-teal-400 text-white
                       hover:from-teal-400 hover:to-emerald-400 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.04]
                       transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {changing ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      ) : (
        <button
          className="w-[120px] rounded-full py-2.5 text-lg font-bold shadow-md border-none
                     bg-gradient-to-r from-slate-500 to-slate-400 text-white
                     hover:from-slate-400 hover:to-slate-500 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.04]
                     transition-all duration-200"
          onClick={() => setEditing(true)}
        >
          Edit Profile
        </button>
      )}

      {/* Messages */}
      {message && <div className="mt-4 text-lg text-center text-emerald-500">{message}</div>}
      {error && <div className="mt-4 text-lg text-center text-red-500">{error}</div>}
    </div>
  );
};

export default Profile;

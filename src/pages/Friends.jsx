import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { 
	collection, 
	addDoc, 
	getDocs, 
	query, 
	where, 
	doc, 
	updateDoc,
	deleteDoc 
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import './stylesheets/friends.css';

const Friends = () => {
	const [user] = useAuthState(auth); // Get current user
	const [friends, setFriends] = useState([]);
	const [pendingRequests, setPendingRequests] = useState([]);
	const [sentRequests, setSentRequests] = useState([]);
	const [searchEmail, setSearchEmail] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		if (user) {
			fetchFriendData();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user]);

	// Fetch user profile information by email
	const fetchUserProfile = async (email) => {
		try {
			// Try to find user by email in users collection
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
					profilePicture: userData.profilePicture || null
				};
			}
			
			// If no user document found, return email with fallback displayName
			return {
				email: email,
				displayName: email.split('@')[0], // Use part before @ as fallback
				profilePicture: null
			};
		} catch (error) {
			console.error('Error fetching user profile:', error);
			return {
				email: email,
				displayName: email.split('@')[0],
				profilePicture: null
			};
		}
	};

	// Fetch all friend-related data
	const fetchFriendData = async () => {
		try {
			setLoading(true);
		
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

			// Get pending requests TO current user
			const pendingQuery = query(
				collection(db, 'friendships'),
				where('user2', '==', user.email),
				where('status', '==', 'pending')
			);

			// Get sent requests FROM current user
			const sentQuery = query(
				collection(db, 'friendships'),
				where('user1', '==', user.email),
				where('status', '==', 'pending')
			);

			const [friends1, friends2, pending, sent] = await Promise.all([
				getDocs(friendsQuery1),
				getDocs(friendsQuery2),
				getDocs(pendingQuery),
				getDocs(sentQuery)
			]);

			// Combine friends from both queries and fetch their profiles
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

			// Fetch profile information for pending requests
			const pendingRequestsWithProfiles = await Promise.all(
				pending.docs.map(async (doc) => {
					const requestData = { id: doc.id, ...doc.data() };
					const profile = await fetchUserProfile(requestData.user1);
					return {
						...requestData,
						senderProfile: profile
					};
				})
			);

			setFriends(friendsWithProfiles);
			setPendingRequests(pendingRequestsWithProfiles);
			setSentRequests(sent.docs.map(doc => ({ id: doc.id, ...doc.data() })));

		} catch (error) {
			setError('Error fetching friends: ' + error.message);
		} finally {
			setLoading(false);
		}
	};

	// Send friend request
	const sendFriendRequest = async () => {
		if (!searchEmail || searchEmail === user.email) {
			setError('Please enter a valid email address (that is not yours)');
			return;
		}

		// Check if user exists in users collection
		try {
			const usersQuery = query(
				collection(db, 'users'),
				where('email', '==', searchEmail.trim())
			);
			const userSnapshot = await getDocs(usersQuery);
			if (userSnapshot.empty) {
				setError('User with this email does not exist in the app. They need to create an account first.');
				return;
			}
		} catch {
			setError('Error checking user existence. Please try again.');
			return;
		}

		try {
			// Check if friendship already exists
			const existingQuery1 = query(
				collection(db, 'friendships'),
				where('user1', '==', user.email),
				where('user2', '==', searchEmail)
			);
			const existingQuery2 = query(
				collection(db, 'friendships'),
				where('user1', '==', searchEmail),
				where('user2', '==', user.email)
			);

			const [existing1, existing2] = await Promise.all([
				getDocs(existingQuery1),
				getDocs(existingQuery2)
			]);

			if (!existing1.empty || !existing2.empty) {
				setError('Friendship already exists or request already sent');
				return;
			}

			// Create friend request
			await addDoc(collection(db, 'friendships'), {
				user1: user.email, // Sender
				user2: searchEmail, // Receiver
				status: 'pending',
				createdAt: new Date()
			});

			setSearchEmail('');
			setError('');
			fetchFriendData(); // Refresh data
			alert('Friend request sent!');

		} catch (error) {
			setError('Error sending friend request: ' + error.message);
		}
	};

	// Accept friend request
	const acceptFriendRequest = async (requestId) => {
		try {
			const requestRef = doc(db, 'friendships', requestId);
			await updateDoc(requestRef, {
				status: 'accepted',
				acceptedAt: new Date()
			});

			fetchFriendData(); // Refresh data
		} catch (error) {
			setError('Error accepting friend request: ' + error.message);
		}
	};

	// Reject/Cancel friend request
	const rejectFriendRequest = async (requestId) => {
		try {
			await deleteDoc(doc(db, 'friendships', requestId));
			fetchFriendData(); // Refresh data
		} catch (error) {
			setError('Error rejecting friend request: ' + error.message);
		}
	};

	// Remove friend
	const removeFriend = async (friendshipId) => {
		if (window.confirm('Are you sure you want to remove this friend?')) {
			try {
				await deleteDoc(doc(db, 'friendships', friendshipId));
				fetchFriendData(); // Refresh data
			} catch (error) {
				setError('Error removing friend: ' + error.message);
			}
		}
	};

	if (!user) {
		return <div className="login-message">Please log in to view friends.</div>;
	}

	if (loading) {
		return <div className="loading-message">Loading friends...</div>;
	}

	return (
		<div className="friends-container">
			<h2 className="friends-title">Friends</h2>

			{error && <div className="error-message">{error}</div>}
            
			{/* Add Friend Section */}
			<div className="add-friend-section">
				<h3 className="add-friend-title">Add Friend</h3>
				<input
					type="email"
					placeholder="Enter friend's email"
					value={searchEmail}
					onChange={(e) => setSearchEmail(e.target.value)}
					className="email-input"
				/>
				<button onClick={sendFriendRequest} className="send-request-btn">
					Send Friend Request
				</button>
			</div>

			{/* Pending Requests (TO you) */}
			{pendingRequests.length > 0 && (
				<div className="pending-requests-section">
					<h3 className="pending-requests-title">
						Friend Requests ({pendingRequests.length})
					</h3>
					{pendingRequests.map(request => (
						<div key={request.id} className="pending-request-item">
							<div className="profile-info">
								{request.senderProfile?.profilePicture && (
									<img 
										src={request.senderProfile.profilePicture} 
										alt="Profile" 
										className="profile-picture"
									/>
								)}
								<div className="profile-details">
									<div className="display-name">
										{request.senderProfile?.displayName || request.user1}
									</div>
									{request.senderProfile?.displayName && (
										<div className="email-address">
											{request.user1}
										</div>
									)}
								</div>
							</div>
							<div className="request-actions">
								<button 
									onClick={() => acceptFriendRequest(request.id)}
									className="accept-btn"
								>
									Accept
								</button>
								<button 
									onClick={() => rejectFriendRequest(request.id)}
									className="reject-btn"
								>
									Reject
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Sent Requests (FROM you) */}
			{sentRequests.length > 0 && (
				<div className="sent-requests-section">
					<h3 className="sent-requests-title">
						Sent Requests ({sentRequests.length})
					</h3>
					{sentRequests.map(request => (
						<div key={request.id} className="sent-request-item">
							Request sent to <strong>{request.user2}</strong> (Pending)
							<button 
								onClick={() => rejectFriendRequest(request.id)}
								className="cancel-btn"
							>
								Cancel Request
							</button>
						</div>
					))}
				</div>
			)}

			{/* Friends List */}
			<div className="friends-list-outer">
				<h3 className="friends-list-title">My Friends ({friends.length})</h3>
				<div className="friends-list-section">
					{friends.length === 0 ? (
						<p className="no-friends-message">
							No friends yet. Add some friends to start splitting expenses!
						</p>
					) : (
						friends.map(friend => (
							<div key={friend.id} className="friend-card-redesign">
								<div className="friend-card-avatar-section">
									<div className="friend-card-avatar placeholder">
										{friend.friendProfile?.displayName ? friend.friendProfile.displayName[0].toUpperCase() : friend.friendEmail[0].toUpperCase()}
									</div>
								</div>
								<div className="friend-card-main-info">
									<div className="friend-card-name">{friend.friendProfile?.displayName || friend.friendEmail}</div>
									<div className="friend-card-email">{friend.friendEmail}</div>
									<div className="friend-card-since">Friends since: {friend.acceptedAt?.toDate?.().toLocaleDateString() || 'Recently'}</div>
								</div>
								<button 
									onClick={() => removeFriend(friend.id)}
									className="remove-friend-btn friend-card-remove-btn"
								>
									Remove Friend
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
};

export default Friends;
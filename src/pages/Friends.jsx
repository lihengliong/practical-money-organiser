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
	}, [user]);

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

			// Combine friends from both queries
			const allFriends = [];
			friends1.docs.forEach(doc => {
				allFriends.push({ id: doc.id, friendEmail: doc.data().user2, ...doc.data() });
			});
			friends2.docs.forEach(doc => {
				allFriends.push({ id: doc.id, friendEmail: doc.data().user1, ...doc.data() });
			});

			setFriends(allFriends);
			setPendingRequests(pending.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
		return <div>Please log in to view friends.</div>;
	}

	if (loading) {
		return <div>Loading friends...</div>;
	}

	return (
		<div>

			<h2>Friends</h2>

				{error && <div style={{color: 'red', margin: '10px 0'}}>{error}</div>}
            
				{/* Add Friend Section */}
				<div style={{border: '1px solid #ccc', margin: '20px 0', padding: '20px'}}>
					<h3>Add Friend</h3>
					<input
						type="email"
						placeholder="Enter friend's email"
						value={searchEmail}
						onChange={(e) => setSearchEmail(e.target.value)}
					/>
					<button onClick={sendFriendRequest}>Send Friend Request</button>
				</div>

				{/* Pending Requests (TO you) */}
				{pendingRequests.length > 0 && (
					<div style={{border: '1px solid #orange', margin: '20px 0', padding: '20px'}}>
						<h3>Friend Requests ({pendingRequests.length})</h3>
						{pendingRequests.map(request => (
							<div key={request.id} style={{margin: '10px 0', padding: '10px', background: '#fff3cd'}}>
								<strong>{request.user1}</strong> wants to be your friend
								<br />
								<button 
									onClick={() => acceptFriendRequest(request.id)}
									style={{margin: '5px', background: 'green', color: 'white'}}
								>
									Accept
								</button>
								<button 
									onClick={() => rejectFriendRequest(request.id)}
									style={{margin: '5px', background: 'red', color: 'white'}}
								>
									Reject
								</button>
							</div>
						))}
					</div>
				)}

				{/* Sent Requests (FROM you) */}
				{sentRequests.length > 0 && (
					<div style={{border: '1px solid #blue', margin: '20px 0', padding: '20px'}}>
						<h3>Sent Requests ({sentRequests.length})</h3>
						{sentRequests.map(request => (
							<div key={request.id} style={{margin: '10px 0', padding: '10px', background: '#e7f3ff'}}>
								Request sent to <strong>{request.user2}</strong> (Pending)
								<button 
									onClick={() => rejectFriendRequest(request.id)}
									style={{margin: '5px', background: 'gray', color: 'white'}}
								>
									Cancel Request
								</button>
							</div>
						))}
					</div>
				)}

				{/* Friends List */}
				<div>
					<h3>My Friends ({friends.length})</h3>
					{friends.length === 0 ? (
						<p>No friends yet. Add some friends to start splitting expenses!</p>
					) : (
					friends.map(friend => (
						<div key={friend.id} style={{margin: '10px 0', padding: '15px', background: '#f8f9fa', border: '1px solid #ddd'}}>
							<strong>{friend.friendEmail}</strong>
							<br />
							<small>Friends since: {friend.acceptedAt?.toDate?.().toLocaleDateString() || 'Recently'}</small>
							<br />
							<button 
								onClick={() => removeFriend(friend.id)}
								style={{margin: '5px', background: 'red', color: 'white'}}
							>
								Remove Friend
							</button>
						</div>
						))
					)}
				</div>
		</div>
		);
};

export default Friends;
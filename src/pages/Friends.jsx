import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase.js';
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
		return <div className="text-center py-5 text-lg text-gray-600">Please log in to view friends.</div>;
	}

	if (loading) {
		return <div className="text-center py-5 text-lg text-gray-600">Loading friends...</div>;
	}

	return (
		<div className="page-container">
			<h2 className="section-title">Friends</h2>

			{error && <div className="error-msg">{error}</div>}
            
			{/* Add Friend Section */}
			<div className="border border-gray-300 my-5 p-5 rounded-lg bg-gray-50">
				<h3 className="mb-4 text-gray-800 font-semibold text-lg">Add Friend</h3>
				<div className="flex flex-wrap gap-2">
					<input
						type="email"
						placeholder="Enter friend's email"
						value={searchEmail}
						onChange={(e) => setSearchEmail(e.target.value)}
						className="w-[300px] max-sm:w-full input-field"
					/>
					<button onClick={sendFriendRequest} className="btn-secondary">
						Send Friend Request
					</button>
				</div>
			</div>

			{/* Pending Requests (TO you) */}
			{pendingRequests.length > 0 && (
				<div className="border-2 border-orange-400 my-5 p-5 rounded-lg bg-orange-50">
					<h3 className="mb-4 text-orange-700 font-semibold text-lg">
						Friend Requests ({pendingRequests.length})
					</h3>
					{pendingRequests.map(request => (
						<div key={request.id} className="my-2.5 p-4 bg-amber-50 border border-amber-200 rounded-lg">
							<div className="flex items-center gap-2.5 mb-2.5">
								{request.senderProfile?.profilePicture && (
									<img 
										src={request.senderProfile.profilePicture} 
										alt="Profile" 
										className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
									/>
								)}
								<div className="flex-1">
									<div className="font-bold text-lg text-gray-800 mb-0.5">
										{request.senderProfile?.displayName || request.user1}
									</div>
									{request.senderProfile?.displayName && (
										<div className="text-sm text-gray-600">
											{request.user1}
										</div>
									)}
								</div>
							</div>
							<div className="mt-2.5">
								<button 
									onClick={() => acceptFriendRequest(request.id)}
									className="m-1 px-4 py-2 bg-emerald-500 text-white border-none rounded
									         font-medium transition-colors hover:bg-emerald-600"
								>
									Accept
								</button>
								<button 
									onClick={() => rejectFriendRequest(request.id)}
									className="m-1 px-4 py-2 bg-red-500 text-white border-none rounded
									         font-medium transition-colors hover:bg-red-600"
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
				<div className="border-2 border-blue-500 my-5 p-5 rounded-lg bg-blue-50">
					<h3 className="mb-4 text-blue-700 font-semibold text-lg">
						Sent Requests ({sentRequests.length})
					</h3>
					{sentRequests.map(request => (
						<div key={request.id} className="my-2.5 p-4 bg-sky-100 border border-blue-200 rounded-lg
						                                     flex items-center justify-between flex-wrap gap-2">
							<span>Request sent to <strong>{request.user2}</strong> (Pending)</span>
							<button 
								onClick={() => rejectFriendRequest(request.id)}
								className="m-1 px-4 py-2 bg-gray-500 text-white border-none rounded
								         font-medium transition-colors hover:bg-gray-600"
							>
								Cancel Request
							</button>
						</div>
					))}
				</div>
			)}

			{/* Friends List */}
			<div className="max-w-[1200px] mx-auto my-0 p-0 flex flex-col items-start">
				<h3 className="mb-14 text-gray-800 text-lg font-bold text-left -ml-2.5 mt-4.5 relative left-0 z-[2]">
					My Friends ({friends.length})
				</h3>
				<div className="mt-3 mb-0 grid grid-cols-1 gap-8 justify-items-center items-stretch w-full
				                sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-6">
					{friends.length === 0 ? (
						<p className="text-center py-10 text-gray-600 italic col-span-full">
							No friends yet. Add some friends to start splitting expenses!
						</p>
					) : (
						friends.map(friend => (
							<div key={friend.id} className="card-clickable flex flex-col items-center justify-between min-h-[240px]
							                                  w-full max-w-[260px]">
								<div className="flex flex-col items-center mb-3 w-full">
									<div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600
									              flex items-center justify-center text-white text-3xl font-bold
									              shadow-lg border-4 border-white mb-3 uppercase">
										{friend.friendProfile?.displayName ? friend.friendProfile.displayName[0].toUpperCase() : friend.friendEmail[0].toUpperCase()}
									</div>
								</div>
								<div className="flex-1 flex flex-col items-center justify-center text-center w-full px-2">
									<div className="font-bold text-xl text-gray-800 mb-1 break-words w-full">
										{friend.friendProfile?.displayName || friend.friendEmail}
									</div>
									<div className="text-sm text-gray-600 mb-2 break-all w-full">
										{friend.friendEmail}
									</div>
									<div className="text-xs text-gray-500 mt-1">
										Friends since: {friend.acceptedAt?.toDate?.().toLocaleDateString() || 'Recently'}
									</div>
								</div>
								<button 
									onClick={() => removeFriend(friend.id)}
									className="mt-4 btn-danger text-sm"
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
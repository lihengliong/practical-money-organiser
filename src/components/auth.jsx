import { auth, googleProvider } from "../config/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export const Auth = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [user, setUser] = useState(null);
    const [isLogin, setIsLogin] = useState(true); // Toggle between login/signup
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
  
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          navigate('/groups');
        } else {
          setUser(null);
        }
      });
      return () => unsubscribe();
    }, [navigate]);
  
    // Fixed: Sign in for existing users
    const signIn = async () => {
      try {
        setLoading(true);
        setError("");
        await signInWithEmailAndPassword(auth, email, password); // ✅ Use signInWithEmailAndPassword
        // User already exists in Firestore, no need to create again
        navigate("/groups");
      } catch (err) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Sign up for new users
    const signUp = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await createUserWithEmailAndPassword(auth, email, password); // ✅ Create new user
        await createUserInFirestore(res.user); // ✅ Save to Firestore
        navigate("/groups");
      } catch (err) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
  
    const signInWithGoogle = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await signInWithPopup(auth, googleProvider);
        await createUserInFirestore(res.user); // ✅ Create if doesn't exist
        navigate("/groups");
      } catch (err) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
  
    const logout = async () => {
      try {
        await signOut(auth);
        setUser(null);
        navigate('/'); // Redirect to login page
      } catch (err) {
        console.error(err);
      }
    }

    const createUserInFirestore = async (user) => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
    
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: user.displayName || null,
          createdAt: new Date(),
        });
      }
    };

    // Handle form submission
    const handleSubmit = (e) => {
      e.preventDefault();
      if (isLogin) {
        signIn();
      } else {
        signUp();
      }
    };

    return (
      <div>
        {!user ? (
          <>
            <h2 className="login-prompt">
              {isLogin ? "Please log in to continue" : "Create your account"}
            </h2>
            
            {error && <div style={{color: 'red', margin: '10px 0'}}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <input 
                type="email"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input 
                placeholder="Password..."
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Loading..." : (isLogin ? "Sign In" : "Sign Up")}
              </button>
            </form>

            <div style={{margin: '10px 0'}}>
              <button onClick={signInWithGoogle} disabled={loading}>
                {loading ? "Loading..." : "Sign In With Google"}
              </button>
            </div>

            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                type="button" 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError(""); // Clear any errors when switching
                }}
                style={{background: 'none', border: 'none', color: 'blue', textDecoration: 'underline', cursor: 'pointer'}}
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="welcome-message">Welcome, {user.displayName || user.email}</h2>
            <button onClick={logout}>Log out</button>
          </>
        )}
      </div>
    )
};
import { auth, googleProvider } from "../config/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import './stylesheets/auth.css';

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
          navigate('/friends');
        } else {
          setUser(null);
        }
      });
      return () => unsubscribe();
    }, [navigate]);
  
    // Sign in for existing users
    const signIn = async () => {
      try {
        setLoading(true);
        setError("");
        await signInWithEmailAndPassword(auth, email, password);// Sign in existing user
        // User already exists in Firestore, no need to create again
        navigate("/friends");
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
        const res = await createUserWithEmailAndPassword(auth, email, password); // Create new user
        const displayName = prompt("Enter a display name:");
        if (displayName) {
          await res.user.updateProfile({ displayName });
        }
        await createUserInFirestore(res.user, displayName); // Save to Firestore
        navigate("/friends");
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
        navigate("/friends");
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

    const createUserInFirestore = async (user, displayName = null) => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          displayName: displayName || user.displayName || null,
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
      <div className="auth-page-wrapper">
        <div className="auth-container">
          {!user ? (
            <>
              <h1>Practical Money Organiser</h1>
              <h2 className="login-prompt">
                {isLogin ? "Please log in" : "Create your account"}
              </h2>
              
              {error && <div className="error-message">{error}</div>}
              
              <form onSubmit={handleSubmit} className="auth-form">
                <input 
                  type="email"
                  placeholder="Email..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  required
                />
                <input 
                  placeholder="Password..."
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  required
                />
                <button type="submit" disabled={loading} className="auth-button">
                  {loading ? "Loading..." : (isLogin ? "Sign In" : "Sign Up")}
                </button>
              </form>

              <div className="auth-divider">
                <span>or</span>
              </div>

              <button onClick={signInWithGoogle} disabled={loading} className="google-button">
                {loading ? "Loading..." : "Sign In With Google"}
              </button>

              <p className="toggle-mode">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                  type="button" 
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(""); // Clear any errors when switching
                  }}
                  className="toggle-link"
                >
                  {isLogin ? "Sign Up" : "Sign In"}
                </button>
              </p>
            </>
          ) : (
            <>
              <h2 className="welcome-message">
                Welcome, {user.displayName ? `${user.displayName} (${user.email})` : user.email}
              </h2>
              <button onClick={logout} className="logout-button">Log out</button>
            </>
          )}
        </div>
      </div>
    );
};
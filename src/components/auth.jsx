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
          navigate('/dashboard');
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
        navigate("/dashboard");
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
        navigate("/profile");
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
        navigate("/dashboard");
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
        // Set default display name as email truncated (everything before @)
        const defaultDisplayName = user.displayName || user.email.split('@')[0];
        
        await setDoc(userRef, {
          email: user.email,
          displayName: defaultDisplayName,
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
                {isLogin ? "Please log in to continue" : "Create your account"}
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
                {loading ? "Loading..." : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign In With Google
                  </>
                )}
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
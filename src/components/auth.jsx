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
  const [isLogin, setIsLogin] = useState(true);
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

  const signIn = async () => {
    try {
      setLoading(true);
      setError("");
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await createUserInFirestore(res.user);
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
      await createUserInFirestore(res.user);
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
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const createUserInFirestore = async (user) => {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      const defaultDisplayName = user.displayName || user.email.split('@')[0];
      await setDoc(userRef, {
        email: user.email,
        displayName: defaultDisplayName,
        createdAt: new Date(),
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      signIn();
    } else {
      signUp();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-[420px] w-[90%] mx-5 p-10 bg-white/95 backdrop-blur-md rounded-2xl
                      shadow-[0_8px_32px_rgba(0,0,0,0.1)] text-center border border-white/20
                      max-sm:mx-2.5 max-sm:p-8 max-sm:px-6">
        {!user ? (
          <>
            <h1 className="text-[2.2em] font-bold mb-5 bg-gradient-to-br from-emerald-500 to-teal-500
                           bg-clip-text text-transparent max-sm:text-3xl">
              Practical Money Organiser
            </h1>
            <h2 className="text-slate-600 mb-7 text-xl font-medium max-sm:text-lg">
              {isLogin ? "Please log in to continue" : "Create your account"}
            </h2>

            {error && (
              <div className="text-red-500 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-500
                              py-3 px-4 rounded-xl my-4 text-sm font-medium shadow-sm animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6 animate-fade-in">
              <input
                type="email"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="py-3.5 px-4 border-2 border-slate-200 rounded-xl text-base
                           transition-all duration-300 bg-white/80
                           focus:outline-none focus:border-green-500 focus:shadow-[0_0_0_4px_rgba(39,174,96,0.1)]
                           focus:bg-white focus:-translate-y-px
                           placeholder:text-slate-400"
                required
              />
              <input
                placeholder="Password..."
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="py-3.5 px-4 border-2 border-slate-200 rounded-xl text-base
                           transition-all duration-300 bg-white/80
                           focus:outline-none focus:border-green-500 focus:shadow-[0_0_0_4px_rgba(39,174,96,0.1)]
                           focus:bg-white focus:-translate-y-px
                           placeholder:text-slate-400"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="py-3.5 px-6 bg-gradient-to-br from-emerald-500 to-teal-500 text-white
                           border-none rounded-xl text-base font-semibold cursor-pointer
                           transition-all duration-300 relative overflow-hidden
                           hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_8px_25px_rgba(16,185,129,0.3)]
                           active:enabled:translate-y-0
                           disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
                           focus:outline-2 focus:outline-emerald-500 focus:outline-offset-2">
                {loading ? "Loading..." : (isLogin ? "Sign In" : "Sign Up")}
              </button>
            </form>

            <div className="my-6 relative text-center animate-fade-in">
              <span className="px-5 text-slate-500 text-sm font-medium bg-white/95">or</span>
            </div>

            <button
              onClick={signInWithGoogle}
              disabled={loading}
              className="py-3.5 px-6 bg-[#4285f4] text-white border-none rounded-xl text-base
                         font-semibold cursor-pointer transition-all duration-300 mx-auto mb-6
                         relative overflow-hidden flex items-center justify-center gap-2.5 w-full
                         hover:enabled:bg-[#3367d6] hover:enabled:-translate-y-0.5
                         hover:enabled:shadow-[0_8px_25px_rgba(66,133,244,0.3)]
                         disabled:bg-slate-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
                         focus:outline-2 focus:outline-green-500 focus:outline-offset-2 animate-fade-in"
            >
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

            <p className="text-slate-500 mt-5 text-[15px] animate-fade-in">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="bg-transparent border-none text-emerald-600 no-underline cursor-pointer
                           text-[15px] font-semibold transition-colors duration-300
                           hover:text-emerald-700 hover:underline
                           focus:outline-2 focus:outline-emerald-500 focus:outline-offset-2">
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-emerald-600 mb-6 text-xl font-semibold leading-relaxed">
              Welcome, {user.displayName ? `${user.displayName} (${user.email})` : user.email}
            </h2>
            <button
              onClick={logout}
              className="py-3 px-6 bg-slate-500 text-white border-none rounded-xl text-base
                         font-medium cursor-pointer transition-all duration-300
                         hover:bg-slate-600 hover:-translate-y-px hover:shadow-[0_4px_15px_rgba(108,117,125,0.3)]"
            >
              Log out
            </button>
          </>
        )}
      </div>
    </div>
  );
};

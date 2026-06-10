import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle, CheckCircle, X, Lock as LockIcon, KeyRound } from 'lucide-react'; // আইকন আপডেট

export default function Login() {
  const [identifier, setIdentifier] = useState(''); // Email or ID
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // পাসওয়ার্ড দেখানোর স্টেট
  const navigate = useNavigate();

  // --- FORGOT PASSWORD STATES ---
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = ID Input, 2 = Token Input
  const [forgotId, setForgotId] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [resetMessage, setResetMessage] = useState({ text: '', type: '' });
  const [resetLoading, setResetLoading] = useState(false);

  // --- MAIN LOGIN LOGIC ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Smart Trick: If user enters ID instead of email, append the system domain
    let loginEmail = identifier.trim();
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@cniedu.com`;
    }

    try {
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      const user = userCredential.user;

      // 2. Fetch User Role from Firestore Database
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        // --- FORCE PASSWORD RESET CHECK ---
        if (userData.forceReset === true) {
          if (password === userData.resetToken) {
            navigate('/change-password');
            return;
          } else {
            setError('Invalid token or password. Use your reset token provided by Admin.');
            setLoading(false);
            auth.signOut();
            return;
          }
        }

        const role = userData.role;

        // 3. Smart Redirect based on Role
        if (role === 'systemAdmin') {
          navigate('/admin-dashboard');
        } else if (role === 'teacher') {
          navigate('/teacher-dashboard');
        } else if (role === 'accountant') {
          navigate('/accountant-dashboard');
        } else if (role === 'student') {
          navigate('/student-dashboard');
        } else {
          setError('Unauthorized role detected. Contact administration.');
          auth.signOut();
        }
      } else {
        setError('Database record not found for this user.');
        auth.signOut();
      }
    } catch (err) {
      console.error(err);
      setError('Invalid Credentials! Please check your Email/ID and Password.');
    } finally {
      setLoading(false);
    }
  };

  // --- FORGOT PASSWORD LOGIC (Step 1: Check/Send Request) ---
  const handleForgotNext = async (e) => {
    e.preventDefault();
    setResetMessage({ text: '', type: '' });
    if (!forgotId.trim()) return setResetMessage({ text: "Please enter your User ID.", type: "error" });
    
    setResetLoading(true);
    try {
      const reqRef = doc(db, 'password_reset_requests', forgotId.trim());
      const reqSnap = await getDoc(reqRef);

      if (reqSnap.exists()) {
        const reqData = reqSnap.data();
        if (reqData.status === 'Pending') {
          setResetMessage({ text: "Already requested to the admin, contact to the office.", type: "error" });
          setResetLoading(false);
          return;
        } else if (reqData.status === 'Approved') {
          setForgotStep(2); // Go to token input
          setResetMessage({ text: "Admin has approved. Please enter your token.", type: "success" });
          setResetLoading(false);
          return;
        }
      }

      // No request exists, create a new one using setDoc to prevent duplicates
      await setDoc(reqRef, {
        userIdInput: forgotId.trim(),
        status: 'Pending',
        createdAt: serverTimestamp()
      });
      setResetMessage({ text: "Request sent to Admin successfully. Please wait.", type: "success" });
    } catch (error) {
      console.error(error);
      setResetMessage({ text: "Failed to process request. Check connection.", type: "error" });
    }
    setResetLoading(false);
  };

  // --- FORGOT PASSWORD LOGIC (Step 2: Verify Token) ---
  const handleVerifyToken = async (e) => {
    e.preventDefault();
    setResetMessage({ text: '', type: '' });
    if (!forgotToken.trim()) return setResetMessage({ text: "Please enter the Token.", type: "error" });

    setResetLoading(true);
    try {
      const reqRef = doc(db, 'password_reset_requests', forgotId.trim());
      const reqSnap = await getDoc(reqRef);

      if (reqSnap.exists() && reqSnap.data().generatedToken === forgotToken.trim()) {
        let loginEmail = forgotId.trim();
        if (!loginEmail.includes('@')) loginEmail = `${loginEmail}@cniedu.com`;

        try {
          await signInWithEmailAndPassword(auth, loginEmail, forgotToken.trim());
          closeForgotModal();
          navigate('/change-password');
        } catch(err) {
          setResetMessage({ text: "Token verified, but account is not synced yet. Please wait.", type: "error" });
        }
      } else {
        setResetMessage({ text: "Invalid Token. Please check again.", type: "error" });
      }
    } catch (error) {
      setResetMessage({ text: "Verification failed.", type: "error" });
    }
    setResetLoading(false);
  };

  // --- RESET MODAL FUNCTION ---
  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotId('');
    setForgotToken('');
    setResetMessage({ text: '', type: '' });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 relative">
      
      {/* --- FORGOT PASSWORD MODAL POPUP --- */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-200">
            <button onClick={closeForgotModal} className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 transition-colors bg-slate-100 p-1 rounded-full">
              <X size={20} />
            </button>
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-teal-100">
                {forgotStep === 1 ? <LockIcon size={28} className="text-teal-600" /> : <KeyRound size={28} className="text-teal-600" />}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {forgotStep === 1 ? "Reset Password" : "Verify Token"}
              </h2>
              <p className="text-sm text-gray-500 font-medium px-4">
                {forgotStep === 1 
                  ? "Enter your official ID number. A request will be forwarded to the system admin." 
                  : "Admin has generated a token for you. Enter it below to proceed."}
              </p>
            </div>
            
            {resetMessage.text && (
              <div className={`p-4 rounded-xl mb-6 text-sm font-bold flex items-start ${resetMessage.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-teal-50 text-teal-700 border border-teal-100'}`}>
                {resetMessage.type === 'error' ? <AlertTriangle size={18} className="mr-2 mt-0.5 shrink-0"/> : <CheckCircle size={18} className="mr-2 mt-0.5 shrink-0"/>}
                <span>{resetMessage.text}</span>
              </div>
            )}

            {/* STEP 1: Request Password Reset */}
            {forgotStep === 1 && (
              <form onSubmit={handleForgotNext} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Your ID Number</label>
                  <input 
                    type="text" required value={forgotId} onChange={(e) => setForgotId(e.target.value)}
                    placeholder="e.g. 202301" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-all text-gray-700"
                  />
                </div>
                <button disabled={resetLoading} type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex justify-center items-center disabled:opacity-70">
                  {resetLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : "Send Request to Admin"}
                </button>
              </form>
            )}

            {/* STEP 2: Input Token */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyToken} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Security Token</label>
                  <input 
                    type="text" required value={forgotToken} onChange={(e) => setForgotToken(e.target.value)}
                    placeholder="e.g. 123456" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-all text-center text-xl tracking-widest text-gray-800 font-bold"
                  />
                </div>
                <button disabled={resetLoading} type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex justify-center items-center disabled:opacity-70">
                  {resetLoading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : "Verify and Login"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Main Login Card */}
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Institute Branding */}
        <div className="bg-teal-700 text-white p-8 md:p-12 md:w-1/2 flex flex-col justify-center items-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="w-64 h-64 bg-white rounded-full -mt-20 -ml-20"></div>
            <div className="w-40 h-40 bg-white rounded-full absolute bottom-10 right-10"></div>
          </div>
          
          <a 
            href="https://citynursing.edu.bd/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="z-10 flex flex-col items-center w-full cursor-pointer transition-all hover:opacity-90"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-lg border-4 border-teal-400 p-1">
              <img src="/logo.png" alt="CNI Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">City Nursing Institute</h1>
            <p className="text-teal-100 text-base sm:text-lg font-medium tracking-wide">Rangpur, Bangladesh</p>
            <div className="mt-8 pt-6 border-t border-teal-500/50 w-4/5">
              <p className="text-xs sm:text-sm text-teal-100 uppercase tracking-widest font-semibold">
                Official Web Portal
              </p>
            </div>
          </a>
        </div>

        {/* Right Side - Login Form */}
        <div className="p-8 md:p-12 md:w-1/2 flex flex-col justify-center bg-white">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">System Login</h2>
            <p className="text-gray-500 text-sm">Please enter your login credentials</p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-5 rounded">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">User ID / Email Address</label>
              <input 
                type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. admin@cniedu.com or ID number" 
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-all text-gray-700" 
              />
            </div>
            
            <div>
              {/* --- FORGOT PASSWORD TRIGGER ADDED HERE --- */}
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-bold text-gray-700">Password</label>
                <button type="button" onClick={() => setShowForgotModal(true)} className="text-sm font-bold text-teal-600 hover:text-teal-800 transition-colors">
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-all text-gray-700 pr-12" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3 text-gray-400 hover:text-teal-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 mt-6 disabled:opacity-70"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-500 text-xs sm:text-sm">
        <p>
          &copy; {new Date().getFullYear()} <span className="font-bold text-teal-800">City Nursing Institute, Rangpur</span>. All rights reserved.
        </p>
        <p className="mt-1 text-gray-400">
          Developed by <span className="font-semibold text-gray-600">Jubair Islam</span>
        </p>
      </div>
    </div>
  );
}
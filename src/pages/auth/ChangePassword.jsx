import React, { useState } from 'react';
import { updatePassword, signOut } from 'firebase/auth';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, CheckCircle } from 'lucide-react';

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(''); // সাকসেস মেসেজ দেখানোর জন্য স্টেট
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 6) return setError("Password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("No authenticated user found. Please login again.");

      // ইউজারের ইনফো ফেচ করা (studentId বা staffId বের করার জন্য)
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) throw new Error("User data not found.");
      
      const userData = userDocSnap.data();
      const myCustomId = userData.studentId || userData.staffId; 

      // 1. Update Password in Firebase Auth
      await updatePassword(user, newPassword);

      // 2. Remove forceReset flag and token from Firestore
      await updateDoc(userDocRef, {
        forceReset: false,
        resetToken: null
      });

      // 3. Update Request Ticket to 'Success' in password_reset_requests
      if (myCustomId) {
        const reqQuery = query(
          collection(db, 'password_reset_requests'), 
          where('userIdInput', '==', myCustomId),
          where('status', '==', 'Approved')
        );
        const reqSnap = await getDocs(reqQuery);
        
        // যদি ওই ইউজারের কোনো অ্যাপ্রুভড রিকুয়েস্ট থাকে, সবগুলোর স্ট্যাটাস Success করে দেওয়া
        if (!reqSnap.empty) {
          for (const docSnap of reqSnap.docs) {
            await updateDoc(doc(db, 'password_reset_requests', docSnap.id), {
              status: 'Success'
            });
          }
        }
      }

      // ব্রাউজার অ্যালার্টের বদলে UI তেই সাকসেস মেসেজ দেখাচ্ছি
      setSuccessMsg("Password updated successfully! Redirecting to dashboard...");
      
      // 4. Route to proper dashboard based on role after a short delay (so user can read the success msg)
      const role = userData.role;
      setTimeout(() => {
        if (role === 'systemAdmin') navigate('/admin-dashboard');
        else if (role === 'teacher') navigate('/teacher-dashboard');
        else if (role === 'accountant') navigate('/accountant-dashboard');
        else navigate('/student-dashboard');
      }, 1500); // ১.৫ সেকেন্ড ওয়েট করবে

    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update password. Please try logging out and logging in again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95">
        <div className="bg-teal-700 p-8 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShieldCheck size={32} className="text-teal-600" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Security Update Required</h2>
          <p className="text-teal-100 text-sm mt-2 font-medium">Please set a new permanent password to secure your account.</p>
        </div>

        <div className="p-8">
          {/* Custom In-page Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold mb-4 border border-red-100 text-center animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {/* Custom In-page Success Message */}
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl text-sm font-bold mb-4 border border-emerald-100 text-center flex items-center justify-center animate-in slide-in-from-top-2">
              <CheckCircle size={18} className="mr-2" />
              {successMsg}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-semibold text-slate-800 pr-12" 
                  disabled={successMsg !== ''}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 p-1" disabled={successMsg !== ''}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm New Password</label>
              <input 
                type={showPassword ? "text" : "password"} 
                required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-semibold text-slate-800" 
                disabled={successMsg !== ''}
              />
            </div>

            <div className="pt-2">
              <button disabled={loading || successMsg !== ''} type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md disabled:opacity-70 flex justify-center items-center">
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : "Update & Proceed to Dashboard"}
              </button>
            </div>
            
            <button disabled={loading || successMsg !== ''} type="button" onClick={handleCancel} className="w-full text-sm font-bold text-slate-400 hover:text-rose-500 transition-colors mt-4 disabled:opacity-50">
              Cancel and Logout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
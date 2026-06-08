import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase'; 

export default function SecretAdmin() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setError('');

    // Password Confirmation Logic
    if (password !== confirmPassword) {
      setError("Passwords do not match! Please check again.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save Admin details in Firestore with Server Timestamp
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        phone: phone,
        email: email,
        role: "systemAdmin",
        createdAt: serverTimestamp(), // Professional way to record exact database time
        status: "active"
      });

      alert("System Admin Created Successfully! The account timestamp has been recorded.");
      
      // Clear form
      setName(''); setPhone(''); setEmail(''); setPassword(''); setConfirmPassword('');
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-xl w-full max-w-xl border-t-4 border-teal-600">
        
        {/* Institute Branding & Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full p-1 shadow-md border border-gray-100">
            {/* Automatically fetching the logo from your public folder */}
            <img src="/logo.png" alt="CNI Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">City Nursing Institute</h1>
          <p className="text-sm text-gray-500">Rangpur, Bangladesh</p>
          <div className="mt-4 inline-block bg-teal-100 text-teal-800 text-xs px-3 py-1 rounded-full font-semibold tracking-wide">
            SECURE ADMIN REGISTRATION
          </div>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}
        
        <form onSubmit={handleCreateAdmin} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-1">Full Name</label>
              <input 
                type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. System Admin"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-1">Contact Number</label>
              <input 
                type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-1">Official Email Address</label>
            <input 
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@cniedu.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-1">Password</label>
              <input 
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-1">Confirm Password</label>
              <input 
                type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retype password"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm"
              />
            </div>
          </div>
          
          <button 
            type="submit" disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-lg transition-all duration-200 mt-6 shadow-md hover:shadow-lg disabled:opacity-70"
          >
            {loading ? "Registering to Database..." : "Complete Admin Registration"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Account creation date and time will be automatically securely logged.
        </p>
      </div>
    </div>
  );
}
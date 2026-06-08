import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Path to your firebase.js

export default function ProtectedRoute({ children, allowedRole }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        // Fetch user role from database
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().role);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false); // Stop loading once check is done
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-teal-600"></div>
      </div>
    );
  }

  // Jodi logged in na thake, kick out to Login page
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Jodi role na mile, kick out to Login page (Ba unauthorized page)
  if (allowedRole && userRole !== allowedRole) {
    alert("Security Alert: You do not have permission to access this page.");
    return <Navigate to="/" replace />;
  }

  // Shob thik thakle page-ta dekhabe
  return children;
}
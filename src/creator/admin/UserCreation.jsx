import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, 
  deleteDoc, doc, serverTimestamp, getDoc, updateDoc, setDoc 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, AlertTriangle, Trash2, Edit, ShieldCheck, Layers, 
  ToggleLeft, ToggleRight, Clock, Database, Briefcase
} from 'lucide-react';

export default function ManageStaff() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Layout States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  
  // Universal Action Modal
  const [actionModal, setActionModal] = useState({ 
    isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' 
  });
  
  // Core Data States
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Staff Creation Form States
  const [formData, setFormData] = useState({
    role: 'teacher', 
    name: '', id: '', phone: '', designation: ''
  });

  // Edit Staff States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    uid: '', role: '', name: '', id: '', phone: '', designation: '', newPassword: ''
  });

  useEffect(() => {
    // Fetch Admin Data
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const fullName = docSnap.data().name || 'System Admin';
            setAdminName(fullName);
            const nameParts = fullName.split(' ');
            if (nameParts.length > 1) {
              setAdminInitials((nameParts[0][0] + nameParts[1][0]).toUpperCase());
            } else {
              setAdminInitials(fullName.substring(0, 2).toUpperCase());
            }
          }
        } catch (error) {
          console.error("Error fetching admin data:", error);
        }
      }
    });

    // Fetch Staff (Teachers & Accountants)
    const qStaff = query(
      collection(db, 'users'), 
      where('role', 'in', ['teacher', 'accountant'])
    );
    const unSubStaff = onSnapshot(qStaff, (snapshot) => {
      const staffs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      // Sort by creation date descending
      staffs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setStaffList(staffs);
    });

    return () => {
      unsubscribeAuth();
      unSubStaff();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleCreateInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'role' && value === 'accountant') {
      setFormData(prev => ({ ...prev, [name]: value, designation: 'Accountant' }));
    } else if (name === 'role' && value === 'teacher') {
      setFormData(prev => ({ ...prev, [name]: value, designation: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  // --- Modal Triggers ---
  const requestAddStaff = (e) => {
    e.preventDefault();
    const cleanId = formData.id.trim();
    if (!formData.name || !cleanId || !formData.designation || !formData.phone) return;
    
    if (cleanId.length < 6) {
      alert("Staff ID must be at least 6 characters long!");
      return;
    }

    const roleName = formData.role === 'teacher' ? 'Teacher' : 'Accountant';
    setActionModal({
      isOpen: true,
      type: 'CREATE_STAFF',
      title: `Confirm ${roleName} Account`,
      desc: `Create secure login for ${formData.name} (ID: ${cleanId}). They will be able to log in immediately.`,
      btnText: 'Yes, Create Account',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
    });
  };

  const requestDeleteStaff = (uid, name, role) => {
    setActionModal({
      isOpen: true,
      type: 'DELETE_STAFF',
      data: { uid },
      title: 'Revoke Access?',
      desc: `Delete ${role} "${name}"? This action removes their portal access permanently.`,
      btnText: 'Yes, Delete Account',
      btnColor: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
    });
  };

  const openEditModal = (staff) => {
    setEditData({
      uid: staff.uid,
      role: staff.role,
      name: staff.name,
      id: staff.staffId,
      phone: staff.phone,
      designation: staff.designation,
      newPassword: '' // Blank unless they want to change it
    });
    setIsEditModalOpen(true);
  };

  // --- 🔥 STATUS TOGGLE 🔥 ---
  const handleToggleStatus = async (uid, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'deactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', uid), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // --- 🔥 CORE: SECURE STAFF ACCOUNT CREATOR 🔥 ---
  const createSecureStaffAccount = async (data) => {
    const rawId = String(data.id).trim();
    const email = `${rawId}@cniedu.com`; 
    const password = rawId; 
    
    let secondaryApp;
    try {
      secondaryApp = getApp("SecondaryApp");
    } catch (e) {
      secondaryApp = initializeApp(auth.app.options, "SecondaryApp");
    }
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        name: data.name,
        staffId: rawId,
        phone: data.phone,
        designation: data.role === 'accountant' ? 'Accountant' : data.designation,
        email: email,
        role: data.role,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await signOut(secondaryAuth);
      return { success: true };

    } catch (error) {
      console.error(`Auth Error for ${rawId}:`, error);
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = `Staff ID ${rawId} is already registered!`;
      return { success: false, message: msg };
    }
  };

  // --- 🔥 EXECUTE UPDATES (EDIT) 🔥 ---
  const executeEditStaff = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatePayload = {
        name: editData.name,
        phone: editData.phone,
        designation: editData.role === 'accountant' ? 'Accountant' : editData.designation,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(doc(db, 'users', editData.uid), updatePayload);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating staff:", error);
      alert("Failed to update staff details.");
    }
    setLoading(false);
  };

  // --- MASTER ACTION EXECUTION ---
  const executeModalAction = async () => {
    setLoading(true);
    try {
      if (actionModal.type === 'CREATE_STAFF') {
        const result = await createSecureStaffAccount(formData);
        
        if (result.success) {
          setFormData({ role: 'teacher', name: '', id: '', phone: '', designation: '' });
          setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
        } else {
          alert(`Failed to Create Staff: \n\n${result.message}`);
          setLoading(false);
          setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
          return;
        }
      } 
      else if (actionModal.type === 'DELETE_STAFF') {
        if (actionModal.data && actionModal.data.uid) {
          await deleteDoc(doc(db, 'users', actionModal.data.uid));
        }
        setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
      }
    } catch (error) {
      console.error("Action execution error: ", error);
      setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
    }
    setLoading(false);
  };

  // Filtering for Unified Search List
  const filteredStaff = staffList.filter(staff => {
    const query = searchQuery.toLowerCase();
    return (
      (staff.name?.toLowerCase().includes(query)) ||
      (staff.staffId?.toLowerCase().includes(query)) ||
      (staff.role?.toLowerCase().includes(query)) ||
      (staff.designation?.toLowerCase().includes(query))
    );
  });

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // --- NAVIGATION ARRAY ---
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/admin-dashboard' },
    { id: 'academic', name: 'Academic Setup', icon: <BookOpen size={20} />, path: '/academic-setup' },
    { id: 'staff', name: 'Staff Management', icon: <UserPlus size={20} />, path: '/staff-management' },
    { id: 'students', name: 'Student Details', icon: <Search size={20} />, path: '/student-details' },
    { id: 'assignments', name: 'Course Assignments', icon: <Layers size={20} />, path: '/course-assignments' },
    { id: 'database', name: 'Database Config', icon: <Database size={20} />, path: '/database-config' },
    { id: 'adminTask', name: 'Administrative Task', icon: <Briefcase size={20} />, path: '/administrative-task' },
    { id: 'settings', name: 'System Settings', icon: <Settings size={20} />, path: '/system-settings' }
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 relative">
      
      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !loading && setIsEditModalOpen(false)}></div>
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl z-10 w-[90%] max-w-lg animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Staff Profile</h3>
                <p className="text-xs text-slate-500 font-medium">Update details for ID: {editData.id}</p>
              </div>
              <button onClick={() => !loading && setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={executeEditStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input type="text" name="name" required value={editData.name} onChange={handleEditInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Number</label>
                  <input type="text" name="phone" required value={editData.phone} onChange={handleEditInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                  <input type="text" name="designation" required value={editData.designation} onChange={handleEditInputChange} disabled={editData.role === 'accountant'} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
                <button type="button" disabled={loading} onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-200">
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIVERSAL CONFIRMATION MODAL */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !loading && setActionModal({ ...actionModal, isOpen: false })}></div>
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl z-10 w-[90%] max-w-md animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${actionModal.type === 'DELETE_STAFF' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {actionModal.type === 'DELETE_STAFF' ? <AlertTriangle size={32} /> : <ShieldCheck size={32} />}
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 mb-2">{actionModal.title}</h3>
            <p className="text-center text-slate-500 text-sm mb-8 leading-relaxed px-2">
              {actionModal.desc}
            </p>
            <div className="flex space-x-3">
              <button disabled={loading} onClick={() => setActionModal({ ...actionModal, isOpen: false })} className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold py-3 rounded-xl transition-all">
                Cancel
              </button>
              <button onClick={executeModalAction} disabled={loading} className={`flex-1 text-white font-bold py-3 rounded-xl transition-all shadow-md ${actionModal.btnColor} disabled:opacity-70 flex items-center justify-center`}>
                {loading ? <span className="flex items-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div></span> : actionModal.btnText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR (DESKTOP) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm hidden md:flex shrink-0 z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mr-3 p-1 border border-slate-200">
            <img src="/logo.png" alt="CNI Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">CNIEDU</h2>
            <p className="text-slate-500 text-xs font-medium">Management Portal</p>
          </div>
        </div>

        <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button 
                key={item.id} 
                onClick={() => { if (item.path !== '#') navigate(item.path); }} 
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}
              >
                <div className="shrink-0">{item.icon}</div>
                <span className="whitespace-nowrap">{item.name}</span>
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl transition-all font-medium shadow-sm">
            <LogOut size={18} /><span>Secure Logout</span>
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-64 bg-white h-full flex flex-col p-6 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mr-2 p-1 border border-slate-200">
                  <img src="/logo.png" alt="CNI Logo" className="w-full h-full object-contain" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">CNIEDU</h2>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-800 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <button 
                    key={item.id} 
                    onClick={() => { if(item.path !== '#') { navigate(item.path); setIsMobileMenuOpen(false); } }} 
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-left ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <div className="shrink-0">{item.icon}</div>
                    <span className="whitespace-nowrap">{item.name}</span>
                  </button>
                )
              })}
            </div>
            
            <div className="pt-4 border-t border-slate-100 mt-auto">
              <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-medium">
                <LogOut size={18} /><span>Secure Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl md:hidden transition-all">
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Staff Management</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Provision & Manage Accounts for Teachers & Accountants</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{adminName}</p>
                <div className="flex items-center justify-end space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Admin</p>
                </div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-xl flex items-center justify-center font-bold shadow-lg shadow-indigo-200 uppercase text-sm border border-indigo-400">
                {adminInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* TOP SECTION: Creation Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <form onSubmit={requestAddStaff} className="max-w-3xl mx-auto space-y-6">
                <div className="text-center mb-8">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 border border-indigo-100">
                    <UserPlus size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Provision Staff Account</h2>
                  <p className="text-sm text-slate-500">Create login credentials. ID will serve as the initial password.</p>
                </div>

                {/* Role Selector */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Select System Role</label>
                  <div className="flex space-x-4">
                    <label className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg cursor-pointer transition-all border-2 ${formData.role === 'teacher' ? 'bg-white border-indigo-500 shadow-sm text-indigo-700 font-bold' : 'border-transparent text-slate-600 hover:bg-slate-100 font-medium'}`}>
                      <input type="radio" name="role" value="teacher" checked={formData.role === 'teacher'} onChange={handleCreateInputChange} className="hidden" />
                      <BookOpen size={18} /> <span>Teacher</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg cursor-pointer transition-all border-2 ${formData.role === 'accountant' ? 'bg-white border-indigo-500 shadow-sm text-indigo-700 font-bold' : 'border-transparent text-slate-600 hover:bg-slate-100 font-medium'}`}>
                      <input type="radio" name="role" value="accountant" checked={formData.role === 'accountant'} onChange={handleCreateInputChange} className="hidden" />
                      <Users size={18} /> <span>Accountant</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Name *</label>
                    <input type="text" name="name" required value={formData.name} onChange={handleCreateInputChange} placeholder="e.g. Dr. Sarah Rahman" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Staff ID (Login Credential) *</label>
                    <input 
                      type="text" name="id" required minLength={6} value={formData.id} onChange={handleCreateInputChange} placeholder="e.g. TCH001" 
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 transition-all ${
                        formData.id.length > 0 && formData.id.trim().length < 6 ? 'border-rose-500 focus:ring-rose-500 bg-rose-50/30' : 'border-slate-200 focus:ring-indigo-500'
                      }`} 
                    />
                    {formData.id.length > 0 && formData.id.trim().length < 6 && (
                      <p className="text-xs text-rose-500 mt-1.5 font-bold flex items-center"><AlertTriangle size={14} className="mr-1"/> ID must be at least 6 characters.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Contact Number *</label>
                    <input type="text" name="phone" required value={formData.phone} onChange={handleCreateInputChange} placeholder="e.g. +8801..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Official Designation *</label>
                    <input type="text" name="designation" required disabled={formData.role === 'accountant'} value={formData.designation} onChange={handleCreateInputChange} placeholder="e.g. Senior Lecturer" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed" />
                  </div>
                </div>
                
                <button type="submit" disabled={formData.id.length > 0 && formData.id.trim().length < 6} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-md shadow-indigo-200 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-3.5 rounded-xl transition-all mt-6 text-lg">
                  Generate {formData.role === 'teacher' ? 'Teacher' : 'Accountant'} Login
                </button>
              </form>
            </div>

            {/* BOTTOM SECTION: Unified Staff List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
                
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Registered Staff Directory</h2>
                  <p className="text-xs text-slate-500 mt-1">Manage all active teachers and accountants.</p>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search by Name, ID, Role..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="bg-indigo-100 text-indigo-700 text-sm font-bold px-4 py-2 rounded-xl border border-indigo-200 shrink-0">
                    Total: {filteredStaff.length}
                  </div>
                </div>
              </div>
              
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Profile Info</th>
                      <th className="px-6 py-4">Access Details</th>
                      <th className="px-6 py-4">Timestamps</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff) => (
                      <tr key={staff.uid} className={`border-b border-slate-100 transition-colors ${staff.status === 'deactive' ? 'bg-rose-50/30' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <p className={`font-bold text-base ${staff.status === 'deactive' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{staff.name}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${staff.role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {staff.role}
                            </span>
                            <span className="text-xs font-medium text-slate-500">{staff.designation}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            <div className="inline-flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                              <ShieldCheck size={12} className="text-indigo-500" />
                              <span className="font-mono text-xs font-bold text-slate-700">ID: {staff.staffId}</span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center"><Search size={10} className="mr-1"/> {staff.phone}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <div className="space-y-1 text-slate-500">
                            <p className="flex items-center"><Clock size={12} className="mr-1 text-emerald-500"/> <span className="font-semibold mr-1">Created:</span> {formatDate(staff.createdAt)}</p>
                            <p className="flex items-center"><Clock size={12} className="mr-1 text-amber-500"/> <span className="font-semibold mr-1">Edited:</span> {formatDate(staff.updatedAt)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleToggleStatus(staff.uid, staff.status)}
                            className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-colors ${staff.status === 'active' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-rose-500 hover:bg-rose-50'}`}
                            title={staff.status === 'active' ? 'Click to Deactivate' : 'Click to Activate'}
                          >
                            {staff.status === 'active' ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                          <p className={`text-[10px] font-bold uppercase mt-0.5 ${staff.status === 'active' ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {staff.status}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => openEditModal(staff)} className="text-indigo-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-colors">
                              <Edit size={18}/>
                            </button>
                            <button onClick={() => requestDeleteStaff(staff.uid, staff.name, staff.role)} className="text-slate-400 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors">
                              <Trash2 size={18}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan="5" className="text-center py-16 text-slate-400 font-medium">
                          No staff found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
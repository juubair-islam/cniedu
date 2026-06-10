import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  doc, getDoc, collection, query, onSnapshot, updateDoc, where, getDocs, serverTimestamp, deleteDoc 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, Layers, Database, ShieldAlert, KeyRound, CheckCircle, Briefcase, Filter, Calendar, UserCog, AlertTriangle,  ArrowRightLeft
} from 'lucide-react';

export default function UserManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  const [loading, setLoading] = useState(true);

  // States for Users, Requests, and Filters
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [resetRequests, setResetRequests] = useState([]);

  // Custom Modal State (To avoid browser popups)
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'info', 'confirm', 'success', 'error'
    onConfirm: null
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role === 'systemAdmin') {
            const fullName = docSnap.data().name || 'System Admin';
            setAdminName(fullName);
            setAdminInitials(fullName.split(' ').length > 1 ? (fullName.split(' ')[0][0] + fullName.split(' ')[1][0]).toUpperCase() : fullName.substring(0, 2).toUpperCase());
          } else {
            signOut(auth); navigate('/');
          }
        } catch (error) { console.error(error); }
      } else { navigate('/'); }
      setLoading(false);
    });

    // Fetch All Users
    const unSubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Pending, Approved, and Success Password Requests
    const unSubReqs = onSnapshot(query(collection(db, 'password_reset_requests'), where('status', 'in', ['Pending', 'Approved', 'Success'])), (snap) => {
      setResetRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubscribeAuth(); unSubUsers(); unSubReqs(); };
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth); navigate('/');
  };

  const showModal = (title, message, type = 'info', onConfirm = null) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm });
  };

  const closeModal = () => {
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  // --- UPDATED API DRIVEN PASSWORD RESET FUNCTION ---
  const handleApproveReset = async (requestId, userIdInput) => {
    // Generate a secure 6-digit token automatically
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      showModal('Processing...', 'Please wait while we sync the password with the server...', 'info');

      const q = query(collection(db, 'users'), where('studentId', '==', userIdInput));
      const qSnap = await getDocs(q);
      
      let userDocId = null;

      if (qSnap.empty) {
        // Fallback to check if staffId matches
        const qStaff = query(collection(db, 'users'), where('staffId', '==', userIdInput));
        const qStaffSnap = await getDocs(qStaff);
        if (qStaffSnap.empty) {
          closeModal();
          showModal('Error', 'User ID not found in database!', 'error');
          return;
        }
        userDocId = qStaffSnap.docs[0].id;
      } else {
        userDocId = qSnap.docs[0].id;
      }

      // 1. Call Vercel API to forcefully update Firebase Auth Password
      const apiResponse = await fetch('https://cniedu-backend.vercel.app/api/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: userDocId,  // এটাই ডকুমেন্টের আইডি (যা Auth UID)
          newPassword: token 
        })
      });

      const apiResult = await apiResponse.json();

      if (!apiResponse.ok) {
        // এরর হলে কনসোলে চেক করবো
        console.error("API Error Result:", apiResult);
        throw new Error(apiResult.error || 'Failed to update password via backend API.');
      }

      // 2. Update User Auth Control in Firestore
      await updateDoc(doc(db, 'users', userDocId), {
        forceReset: true,
        resetToken: token
      });

      // 3. Update Request Ticket in Firestore
      await updateDoc(doc(db, 'password_reset_requests', requestId), {
        status: 'Approved',
        generatedToken: token,
        processedAt: serverTimestamp()
      });

      closeModal();
      showModal(
        'Token Generated Successfully', 
        `The password for ${userIdInput} has been securely updated in the backend.\n\nProvide this 6-digit token to the user: ${token}`, 
        'success'
      );
    } catch (error) {
      closeModal();
      showModal('Error', error.message, 'error');
    }
  };

  // --- NEW FUNCTION TO REMOVE SUCCESSFUL REQUESTS ---
  const handleRemoveRequest = async (requestId) => {
    showModal(
      'Confirm Removal',
      'Are you sure you want to remove this logs/request ticket from the panel?',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'password_reset_requests', requestId));
          closeModal();
          showModal('Deleted', 'Request ticket has been cleared successfully.', 'success');
        } catch (error) {
          showModal('Error', 'Failed to delete the request ticket.', 'error');
        }
      }
    );
  };

  const triggerToggleStatus = (userId, currentStatus) => {
    const newStatus = currentStatus === 'Suspended' ? 'Active' : 'Suspended';
    showModal(
      'Confirm Action',
      `Are you sure you want to change this user's status to ${newStatus}?`,
      'confirm',
      async () => {
        try {
          await updateDoc(doc(db, 'users', userId), { status: newStatus });
          closeModal();
        } catch(err) {
          showModal('Error', 'Failed to update user status.', 'error');
        }
      }
    );
  };

  // Filter Logic for Global Directory
  const filteredUsers = users.filter(user => {
    const searchMatch = user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        user.studentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        user.staffId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const roleMatch = roleFilter === 'All' || user.role === roleFilter;
    return searchMatch && roleMatch;
  });

  // Enriching Request Data with User Info by cross-referencing the local users state
  const enrichedRequests = resetRequests.map(req => {
    const targetUser = users.find(u => u.studentId === req.userIdInput || u.staffId === req.userIdInput);
    return {
      ...req,
      userName: targetUser ? targetUser.name : 'Unknown User',
      userRole: targetUser ? targetUser.role : 'Unknown'
    };
  }).sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()); // Sort newest first

const navItems = [
    // Group 1: Core Operations
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/admin-dashboard' },
    { id: 'students', name: 'Student Details', icon: <Search size={20} />, path: '/student-details' },
    { id: 'staff', name: 'Staff Management', icon: <UserPlus size={20} />, path: '/staff-management' },
    { id: 'assignments', name: 'Course Assignments', icon: <Layers size={20} />, path: '/course-assignments' },
    
    // Group 2: Academic & Admin Control
    { id: 'migration', name: 'Academic Migration', icon: <ArrowRightLeft size={20} />, path: '/academic-migration' },
    { id: 'academic', name: 'Academic Setup', icon: <BookOpen size={20} />, path: '/academic-setup' },
    { id: 'adminTask', name: 'Administrative Task', icon: <Briefcase size={20} />, path: '/administrative-task' },
    
    // Group 3: System & Security
    { id: 'userManagement', name: 'User Management', icon: <Users size={20} />, path: '/user-management' },
    { id: 'database', name: 'Database Config', icon: <Database size={20} />, path: '/database-config' },
    { id: 'settings', name: 'System Settings', icon: <Settings size={20} />, path: '/system-settings' }
  ];

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div></div>;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 relative">
      
      {/* CUSTOM IN-APP MODAL (Replaces window.alert & window.confirm) */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in zoom-in-95">
            <div className="flex items-center mb-4">
              {modalConfig.type === 'error' && <AlertTriangle className="text-red-500 mr-3" size={28}/>}
              {modalConfig.type === 'success' && <CheckCircle className="text-emerald-500 mr-3" size={28}/>}
              {modalConfig.type === 'confirm' && <ShieldAlert className="text-amber-500 mr-3" size={28}/>}
              {modalConfig.type === 'info' && <Settings className="text-indigo-500 mr-3" size={28}/>}
              <h3 className="text-xl font-bold text-slate-900">{modalConfig.title}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-wrap">{modalConfig.message}</p>
            <div className="flex justify-end space-x-3">
              {modalConfig.type === 'confirm' ? (
                <>
                  <button onClick={closeModal} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                  <button onClick={modalConfig.onConfirm} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Confirm</button>
                </>
              ) : (
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors">Acknowledge</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR (DESKTOP) */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm hidden md:flex shrink-0 z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mr-3 p-1 border border-slate-200">
            <img src="/logo.png" alt="CNI Logo" className="w-full h-full object-contain" />
          </div>
          <div><h2 className="text-lg font-bold tracking-tight text-slate-900">CNIEDU</h2><p className="text-slate-500 text-xs font-medium">Management Portal</p></div>
        </div>
        <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map(item => (
            <button key={item.id} onClick={() => navigate(item.path)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${location.pathname === item.path ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
              <div className="shrink-0">{item.icon}</div><span className="whitespace-nowrap">{item.name}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl transition-all font-medium shadow-sm">
            <LogOut size={18} /><span>Secure Logout</span>
          </button>
        </div>
      </div>

      {/* MOBILE SIDEBAR DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-64 max-w-xs bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left">
            <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mr-3 p-1 border border-slate-200">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">CNIEDU</h2>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-800 p-1"><X size={20}/></button>
            </div>
            <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-left ${location.pathname === item.path ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <div className="shrink-0">{item.icon}</div><span className="whitespace-nowrap">{item.name}</span>
                </button>
              ))}
            </div>
             <div className="p-4 border-t border-slate-100 mt-auto">
               <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-medium">
                 <LogOut size={18} /><span>Secure Logout</span>
               </button>
             </div>          
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden transition-all"><Menu size={24} /></button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">User Management</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Global access control & password requests</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{adminName}</p>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">System Admin</p>
              </div>
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shadow-md uppercase text-sm border-2 border-indigo-100">{adminInitials}</div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 w-full">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Password Reset Requests Box */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 flex items-center"><KeyRound size={20} className="mr-2 text-amber-500"/> Active Password Reset Requests</h3>
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">{enrichedRequests.length} Active</span>
              </div>
              
              <div className="p-5 overflow-x-auto">
                {enrichedRequests.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-xl text-slate-400 font-medium">No active password reset requests at the moment.</div>
                ) : (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                    <thead className="text-xs text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="pb-3 px-2">User Details</th>
                        <th className="pb-3 px-2">Designation</th>
                        <th className="pb-3 px-2">Timestamp</th>
                        <th className="pb-3 px-2">Reset Token Status</th>
                        <th className="pb-3 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {enrichedRequests.map(req => (
                        <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-2">
                            <p className="font-bold text-slate-900">{req.userName}</p>
                            <p className="text-xs text-slate-500 font-mono">ID: {req.userIdInput}</p>
                          </td>
                          <td className="py-4 px-2">
                            <span className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold px-2 py-1 rounded">{req.userRole}</span>
                          </td>
                          <td className="py-4 px-2">
                            <p className="text-xs font-medium text-slate-600">{req.createdAt?.toDate().toLocaleDateString()}</p>
                            <p className="text-[10px] text-slate-400">{req.createdAt?.toDate().toLocaleTimeString()}</p>
                          </td>
                          <td className="py-4 px-2">
                            {req.status === 'Success' ? (
                              <span className="text-emerald-600 font-extrabold text-xs bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 flex items-center w-max">
                                <CheckCircle size={14} className="mr-1"/> User updated password successfully
                              </span>
                            ) : req.status === 'Approved' ? (
                              <div className="flex flex-col">
                                <span className="text-indigo-600 font-bold text-xs mb-1 flex items-center"><CheckCircle size={12} className="mr-1"/> Token Generated</span>
                                <span className="text-sm font-black tracking-widest text-slate-800 bg-slate-100 px-2 py-1 rounded inline-block w-max">{req.generatedToken}</span>
                              </div>
                            ) : (
                              <span className="text-amber-500 font-bold text-xs flex items-center"><AlertTriangle size={12} className="mr-1"/> Pending Admin Action</span>
                            )}
                          </td>
                          <td className="py-4 px-2 text-right">
                            {req.status === 'Pending' ? (
                              <button onClick={() => handleApproveReset(req.id, req.userIdInput)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-sm">
                                Approve & Generate
                              </button>
                            ) : req.status === 'Success' ? (
                              <button onClick={() => handleRemoveRequest(req.id)} className="bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-sm">
                                Remove Request
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-slate-400 italic">Waiting for User</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Global User Directory */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center"><Users size={20} className="mr-2 text-indigo-600"/> Global Directory</h3>
                
                <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
                  {/* Role Filter */}
                  <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2">
                    <Filter size={16} className="text-slate-400 mr-2 shrink-0"/>
                    <select 
                      value={roleFilter} 
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="bg-transparent text-sm font-medium text-slate-700 outline-none w-full sm:w-32 cursor-pointer"
                    >
                      <option value="All">All Roles</option>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="accountant">Accountant</option>
                      <option value="systemAdmin">System Admin</option>
                    </select>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search name, ID or email..." 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-all" 
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
                  <thead className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 rounded-tl-lg">User Details</th>
                      <th className="px-6 py-4">System Role</th>
                      <th className="px-6 py-4">Created Info</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.studentId || user.staffId || 'N/A'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase ${user.role === 'systemAdmin' ? 'bg-purple-100 text-purple-700' : user.role === 'teacher' ? 'bg-blue-100 text-blue-700' : user.role === 'accountant' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-xs text-slate-600 mb-1">
                            <Calendar size={12} className="mr-1.5 text-slate-400"/> 
                            {user.createdAt ? user.createdAt.toDate().toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="flex items-center text-[10px] font-medium text-slate-500">
                            <UserCog size={12} className="mr-1.5 text-slate-400"/> 
                            By: {user.createdBy || 'System Registration'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {user.status === 'Suspended' ? (
                            <span className="inline-flex items-center text-rose-600 font-bold text-xs bg-rose-50 px-2 py-1 rounded-lg border border-rose-100"><ShieldAlert size={14} className="mr-1"/> Suspended</span>
                          ) : (
                            <span className="inline-flex items-center text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"><CheckCircle size={14} className="mr-1"/> Active</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {/* Protect System Admins from Suspension */}
                          {user.role !== 'systemAdmin' ? (
                            <button onClick={() => triggerToggleStatus(user.id, user.status || 'Active')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${user.status === 'Suspended' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'}`}>
                              {user.status === 'Suspended' ? 'Reactivate' : 'Suspend Access'}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Protected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && <tr><td colSpan="5" className="text-center p-12 text-slate-500 font-medium bg-slate-50/50">No users match your criteria.</td></tr>}
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
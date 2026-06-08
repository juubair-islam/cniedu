import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { 
  doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, deleteDoc, query, where, getDocs, updateDoc 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, Layers, Lock, ShieldAlert, Building2, CheckCircle, AlertTriangle,
  Inbox, Trash2, Mail, Clock, Unlock, Wallet, Check, Ban, Database, Briefcase
} from 'lucide-react';

export default function SystemSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Layout States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  
  // System State
  const [activeTab, setActiveTab] = useState('requests'); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [uiDialog, setUiDialog] = useState({ isOpen: false, title: '', desc: '', type: 'confirm', onConfirm: null });

  // Academic Controls
  const [academicControls, setAcademicControls] = useState({
    midtermOpen: false,
    finalOpen: false
  });

  // Support & Accountant Requests State
  const [requests, setRequests] = useState([]);
  const [accountantRequests, setAccountantRequests] = useState([]);

  // Password Change
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const showCustomDialog = (title, desc, type = 'confirm', onConfirm = null) => {
    setUiDialog({ isOpen: true, title, desc, type, onConfirm });
  };
  const showMessage = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 4000); };

  useEffect(() => {
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
      } else {
        navigate('/');
      }
    });

    // Listen to System Global Settings
    const unSubSettings = onSnapshot(doc(db, 'systemSettings', 'academicControls'), (doc) => {
      if (doc.exists()) {
        setAcademicControls(doc.data());
      }
    });

    // Listen to Faculty Support/Unlock Requests
    const unSubMessages = onSnapshot(collection(db, 'messages'), (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setRequests(msgs);
    });

    // Listen to Accountant Deletion/Approval Requests
    const unSubAccountant = onSnapshot(collection(db, 'deletion_requests'), (snapshot) => {
      const accMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      accMsgs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setAccountantRequests(accMsgs);
    });

    return () => {
      unsubscribeAuth();
      unSubSettings();
      unSubMessages();
      unSubAccountant();
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  // --- Toggle Global Academic Controls ---
  const toggleControl = async (field) => {
    try {
      const newValue = !academicControls[field];
      await setDoc(doc(db, 'systemSettings', 'academicControls'), {
        ...academicControls,
        [field]: newValue,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      showMessage(`Global setting updated successfully!`, 'success');
    } catch (error) {
      showMessage("Failed to update system setting.", 'error');
    }
  };

  // --- Support Request Actions ---
  const handleDeleteRequest = async (id) => {
    showCustomDialog("Dismiss Request", "Are you sure you want to dismiss this message?", "confirm", async () => {
      try {
        await deleteDoc(doc(db, 'messages', id));
        showMessage("Request dismissed successfully.", "success");
      } catch (error) {
        showMessage("Failed to dismiss request.", "error");
      }
    });
  };

  const handleApproveUnlock = async (requestId, courseName, examName) => {
    showCustomDialog("Approve Unlock", `Unlock ${examName} marks for ${courseName}?`, "confirm", async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'courses'), where('name', '==', courseName));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          showMessage(`Error: Course "${courseName}" not found.`, "error");
          setLoading(false);
          return;
        }
        const targetCourseId = snap.docs[0].id;

        let lockKey = '';
        if (examName === 'Class Tests') lockKey = 'ct';
        else if (examName === 'Midterm') lockKey = 'mid';
        else if (examName === 'Final') lockKey = 'final';

        if (lockKey) {
          await setDoc(doc(db, 'marks', targetCourseId), {
            locks: { [lockKey]: false }
          }, { merge: true });
        }

        await deleteDoc(doc(db, 'messages', requestId));
        showMessage(`Success! ${examName} marks unlocked for ${courseName}.`, "success");
      } catch (error) {
        showMessage("Failed to process unlock request.", "error");
      }
      setLoading(false);
    });
  };

  // --- Accountant Approval Actions ---
  const handleApproveAccountantAction = async (request) => {
    showCustomDialog("Authorize Deletion", `Are you sure you want to permanently delete this payment of ৳${request.paymentData.amount}?`, "confirm", async () => {
      setLoading(true);
      try {
        // 1. Fetch Student Financials
        const finRef = doc(db, 'financials', request.studentId);
        const finSnap = await getDoc(finRef);
        
        if (finSnap.exists()) {
          const data = finSnap.data();
          const targetPaymentId = request.paymentData.id;
          const paymentAmount = Number(request.paymentData.amount);
          const paymentType = request.paymentData.type;

          // Remove payment from array
          const updatedPayments = (data.payments || []).filter(p => p.id !== targetPaymentId);
          
          // Reverse calculation
          const updatedData = { ...data, payments: updatedPayments };
          if (paymentType === 'Monthly Course Fee') {
            updatedData.monthlyPaidTotal = Math.max(0, (data.monthlyPaidTotal || 0) - paymentAmount);
          } else if (paymentType === 'Admission Fee') {
            updatedData.admissionFeePaid = Math.max(0, (data.admissionFeePaid || 0) - paymentAmount);
          } else if (paymentType === 'Fine Payment') {
            updatedData.finesPaid = Math.max(0, (data.finesPaid || 0) - paymentAmount);
          }

          // Update Financials
          await setDoc(finRef, updatedData, { merge: true });
        }

        // 2. Delete Request Ticket
        await deleteDoc(doc(db, 'deletion_requests', request.id));
        showMessage(`Payment deletion approved and processed.`, "success");
      } catch (error) {
        showMessage("Failed to process accountant request.", "error");
      }
      setLoading(false);
    });
  };

  const handleRejectAccountantAction = async (id) => {
    showCustomDialog("Reject Request", "Deny this deletion request?", "confirm", async () => {
      try {
        await deleteDoc(doc(db, 'deletion_requests', id));
        showMessage("Accountant request rejected.", "success");
      } catch (error) {
        showMessage("Failed to reject request.", "error");
      }
    });
  };

  // --- Update Admin Password ---
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwords.newPassword.length < 6) return showMessage("Password must be at least 6 characters.", 'error');
    if (passwords.newPassword !== passwords.confirmPassword) return showMessage("Passwords do not match!", 'error');

    showCustomDialog("Change Password", "Update system administrator password?", "confirm", async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (user) {
          await updatePassword(user, passwords.newPassword);
          setPasswords({ newPassword: '', confirmPassword: '' });
          showMessage("Password updated successfully!", 'success');
        }
      } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
          showMessage("Security required: Please log out and log in again to change password.", 'error');
        } else {
          showMessage(error.message, 'error');
        }
      }
      setLoading(false);
    });
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
      
      {/* --- CUSTOM DIALOG UI --- */}
      {uiDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUiDialog({ ...uiDialog, isOpen: false })}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden animate-in zoom-in-95">
            <div className={`p-5 flex items-center space-x-3 border-b border-slate-100 ${uiDialog.type === 'alert' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
              <AlertTriangle size={24}/>
              <h2 className="text-lg font-bold">{uiDialog.title}</h2>
            </div>
            <div className="p-6 text-slate-600 font-medium leading-relaxed">{uiDialog.desc}</div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              {uiDialog.type === 'confirm' && (
                <button onClick={() => setUiDialog({ ...uiDialog, isOpen: false })} className="px-5 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
              )}
              <button onClick={() => { if (uiDialog.onConfirm) uiDialog.onConfirm(); setUiDialog({ ...uiDialog, isOpen: false }); }} className={`px-6 py-2 font-bold text-white rounded-xl shadow-md transition-all ${uiDialog.type === 'alert' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {uiDialog.type === 'alert' ? 'Okay' : 'Confirm'}
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
            
            <div className="flex-1 py-4 space-y-1.5 overflow-y-auto">
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
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl md:hidden"><Menu size={24} /></button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">System Settings</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Master controls and security configurations</p>
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
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Notifications */}
            {message.text && (
              <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 ${message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                {message.type === 'error' ? <AlertTriangle size={18}/> : <CheckCircle size={18}/>}
                <span>{message.text}</span>
              </div>
            )}

            {/* Custom Navigation Tabs - Mobile Optimized Wrapping */}
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm w-full md:w-fit flex-wrap gap-1">
              <button onClick={() => setActiveTab('requests')} className={`flex-1 md:flex-none justify-center items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex ${activeTab === 'requests' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Inbox size={16} /> <span className="whitespace-nowrap">Faculty Requests</span>
                {requests.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{requests.length}</span>}
              </button>
              
              <button onClick={() => setActiveTab('accountant')} className={`flex-1 md:flex-none justify-center items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex ${activeTab === 'accountant' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'text-slate-500 hover:text-slate-700'}`}>
                <Wallet size={16} /> <span className="whitespace-nowrap">Accountant Requests</span>
                {accountantRequests.length > 0 && <span className="bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{accountantRequests.length}</span>}
              </button>

              <button onClick={() => setActiveTab('academic')} className={`flex-1 md:flex-none justify-center items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex ${activeTab === 'academic' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <BookOpen size={16} /> <span className="whitespace-nowrap">Academic Controls</span>
              </button>

              <button onClick={() => setActiveTab('security')} className={`flex-1 md:flex-none justify-center items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex ${activeTab === 'security' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Lock size={16} /> <span>Security</span>
              </button>
            </div>

            {/* --- TAB: SUPPORT REQUESTS (FACULTY) --- */}
            {activeTab === 'requests' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center"><Inbox size={22} className="mr-2 text-indigo-600"/> Faculty Unlock Requests</h2>
                  <p className="text-sm text-slate-500 mt-1">Review requests sent by faculty members. Approve exam unlock requests directly from here.</p>
                </div>

                <div className="space-y-4">
                  {requests.length === 0 ? (
                    <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                      <Mail size={32} className="mx-auto text-slate-300 mb-3"/>
                      <p className="text-slate-500 font-medium">Inbox is empty. No pending faculty requests.</p>
                    </div>
                  ) : (
                    requests.map(request => {
                      const unlockMatch = request.message.match(/REQUEST UNLOCK: Please unlock the (.*?) marks for course: (.*?)\./);

                      return (
                        <div key={request.id} className={`p-5 border rounded-xl hover:shadow-md transition-shadow relative ${unlockMatch ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                          
                          {unlockMatch ? (
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                              <div className="flex-1 w-full">
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                  <span className="bg-indigo-100 text-indigo-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center">
                                    <Unlock size={12} className="mr-1"/> Exam Unlock Request
                                  </span>
                                  <span className="text-xs text-slate-500 flex items-center">
                                    <Clock size={12} className="mr-1"/> 
                                    {request.createdAt?.toDate().toLocaleDateString('en-GB') || 'Recent'}
                                  </span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg">{request.senderName} <span className="text-sm font-normal text-slate-500">requested access.</span></h3>
                                
                                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                  <div className="bg-white px-3 py-2 rounded border border-indigo-100 text-sm flex-1">
                                    <span className="text-xs text-slate-400 block uppercase font-bold">Course Target</span>
                                    <span className="font-bold text-indigo-700">{unlockMatch[2]}</span>
                                  </div>
                                  <div className="bg-white px-3 py-2 rounded border border-indigo-100 text-sm flex-1">
                                    <span className="text-xs text-slate-400 block uppercase font-bold">Exam Target</span>
                                    <span className="font-bold text-rose-600">{unlockMatch[1]}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="shrink-0 flex sm:flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                                <button onClick={() => handleApproveUnlock(request.id, unlockMatch[2], unlockMatch[1])} disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm transition-all">
                                  <Unlock size={16} className="mr-1.5" /> Approve & Unlock
                                </button>
                                <button onClick={() => handleDeleteRequest(request.id)} className="flex-1 flex justify-center items-center px-4 py-2 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 text-sm font-bold rounded-lg transition-all">
                                  Reject / Dismiss
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="bg-slate-200 text-slate-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                                    {request.role}
                                  </span>
                                  <h3 className="font-bold text-slate-800">{request.senderName}</h3>
                                  <span className="text-xs text-slate-400 flex items-center">
                                    <Clock size={12} className="mr-1"/> 
                                    {request.createdAt?.toDate().toLocaleDateString('en-GB') || 'Recent'}
                                  </span>
                                </div>
                                <p className="text-slate-700 text-sm font-medium leading-relaxed bg-white p-3 rounded-lg border border-slate-200 mt-2">
                                  {request.message}
                                </p>
                              </div>
                              
                              <button onClick={() => handleDeleteRequest(request.id)} className="shrink-0 text-slate-400 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 p-2 rounded-lg transition-all" title="Dismiss Request">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* --- NEW TAB: ACCOUNTANT APPROVALS --- */}
            {activeTab === 'accountant' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center">
                    <Wallet size={22} className="mr-2 text-amber-600"/> Financial Action Approvals
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Authorize or reject critical financial modifications (e.g. Deletions) requested by the Accounts Department.
                  </p>
                </div>

                <div className="space-y-4">
                  {accountantRequests.length === 0 ? (
                    <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                      <Wallet size={32} className="mx-auto text-slate-300 mb-3"/>
                      <p className="text-slate-500 font-medium">No pending financial approvals.</p>
                    </div>
                  ) : (
                    accountantRequests.map(accReq => (
                      <div key={accReq.id} className="p-5 border border-rose-200 bg-rose-50/30 rounded-xl hover:shadow-md transition-all">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                          <div className="flex-1 w-full">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className="bg-rose-100 text-rose-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center">
                                <Trash2 size={12} className="mr-1"/> Payment Deletion Request
                              </span>
                              <span className="text-xs text-slate-500 flex items-center">
                                <Clock size={12} className="mr-1"/> 
                                {accReq.createdAt?.toDate().toLocaleDateString('en-GB') || 'Recent'}
                              </span>
                            </div>

                            <h3 className="font-bold text-slate-800 text-base">
                              Requested by: <span className="text-indigo-600">{accReq.accountantName}</span>
                            </h3>

                            {/* Details Grid */}
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="bg-white px-3 py-2 rounded border border-rose-100 text-sm">
                                <span className="text-xs text-slate-400 block uppercase font-bold">Target Student</span>
                                <span className="font-bold text-slate-800">{accReq.studentName} <span className="text-[10px] font-mono text-slate-500">({accReq.studentId})</span></span>
                              </div>
                              <div className="bg-white px-3 py-2 rounded border border-rose-100 text-sm">
                                <span className="text-xs text-slate-400 block uppercase font-bold">Deletion Target Value</span>
                                <span className="font-black text-rose-600 text-base">৳{accReq.paymentData?.amount || 0}</span>
                              </div>
                              <div className="bg-white px-3 py-2 rounded border border-rose-100 text-sm col-span-1 sm:col-span-2">
                                <span className="text-xs text-slate-400 block uppercase font-bold">Transaction Category</span>
                                <span className="font-bold text-indigo-700">{accReq.paymentData?.type}</span>
                                <span className="text-xs text-slate-500 ml-2">Logged on: {accReq.paymentData?.date}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="shrink-0 flex sm:flex-col gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                            <button onClick={() => handleApproveAccountantAction(accReq)} disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all gap-1.5">
                              <Check size={16} /> Authorize Deletion
                            </button>
                            <button onClick={() => handleRejectAccountantAction(accReq.id)} disabled={loading} className="flex-1 flex justify-center items-center px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-sm font-bold rounded-lg transition-all">
                              <Ban size={16} className="mr-1" /> Deny Request
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* --- TAB: ACADEMIC CONTROLS --- */}
            {activeTab === 'academic' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900">Global Exam Marks Access</h2>
                  <p className="text-sm text-slate-500 mt-1">Unlock or lock marks entry modules for all teachers. When globally locked, teachers can only view marks.</p>
                </div>

                <div className="space-y-4">
                  {/* Midterm Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 border border-slate-200 rounded-xl gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">Midterm Exam Marks Entry</h4>
                      <p className="text-xs text-slate-500 mt-1">Allow teachers to submit Midterm & Midterm Viva marks.</p>
                    </div>
                    <button 
                      onClick={() => toggleControl('midtermOpen')}
                      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${academicControls.midtermOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${academicControls.midtermOpen ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* Final Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 border border-slate-200 rounded-xl gap-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">Final Exam Marks Entry</h4>
                      <p className="text-xs text-slate-500 mt-1">Allow teachers to submit Final & Final Viva marks.</p>
                    </div>
                    <button 
                      onClick={() => toggleControl('finalOpen')}
                      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${academicControls.finalOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${academicControls.finalOpen ? 'translate-x-7' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB: SECURITY --- */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center"><ShieldAlert size={22} className="mr-2 text-indigo-600"/> Administrator Security</h2>
                  <p className="text-sm text-slate-500 mt-1">Update your system admin login password.</p>
                </div>

                <form onSubmit={handlePasswordUpdate} className="space-y-5 max-w-md">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
                    <input 
                      type="password" required 
                      value={passwords.newPassword} 
                      onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})} 
                      placeholder="Minimum 6 characters" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Confirm New Password</label>
                    <input 
                      type="password" required 
                      value={passwords.confirmPassword} 
                      onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})} 
                      placeholder="Type password again" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                  <button type="submit" disabled={loading} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all w-full shadow-md">
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
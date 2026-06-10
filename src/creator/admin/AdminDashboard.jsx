import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  doc, getDoc, collection, query, where, onSnapshot, deleteDoc 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, Layers, Bell, CheckCircle, Clock, AlertCircle, 
  Database, ShieldAlert, Unlock, Trash2, Briefcase, ArrowRightLeft
} from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Layout & Auth States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  const [loading, setLoading] = useState(true);
  const [timeGreeting, setTimeGreeting] = useState('Welcome');

  // Dashboard Stats & Requests States
  const [stats, setStats] = useState({ students: 0, teachers: 0, accountants: 0, courses: 0 });
  const [pendingRequests, setPendingRequests] = useState([]);

  useEffect(() => {
    // 1. Set Dynamic Greeting based on Local Time
    const hour = new Date().getHours();
    if (hour < 12) setTimeGreeting('Good Morning');
    else if (hour < 18) setTimeGreeting('Good Afternoon');
    else setTimeGreeting('Good Evening');

    // 2. Fetch Logged-in Admin Data
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role === 'systemAdmin') {
            const fullName = docSnap.data().name || 'System Admin';
            setAdminName(fullName);
            
            const nameParts = fullName.split(' ');
            if (nameParts.length > 1) {
              setAdminInitials((nameParts[0][0] + nameParts[1][0]).toUpperCase());
            } else {
              setAdminInitials(fullName.substring(0, 2).toUpperCase());
            }
          } else {
            signOut(auth); navigate('/');
          }
        } catch (error) {
          console.error("Error fetching admin data:", error);
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    });

    // 3. Real-Time Stats Counters
    const unSubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snap) => setStats(p => ({ ...p, students: snap.size })));
    const unSubTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snap) => setStats(p => ({ ...p, teachers: snap.size })));
    const unSubAccountants = onSnapshot(query(collection(db, 'users'), where('role', '==', 'accountant')), (snap) => setStats(p => ({ ...p, accountants: snap.size })));
    const unSubCourses = onSnapshot(collection(db, 'courses'), (snap) => setStats(p => ({ ...p, courses: snap.size })));

    // 4. Unified Pending Requests Listener
    let teacherReqs = [];
    let accReqs = [];

    const updateCombinedRequests = () => {
      const combined = [...teacherReqs, ...accReqs].sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA; // Newest first
      });
      setPendingRequests(combined);
    };

    const unSubMessages = onSnapshot(collection(db, 'messages'), (snap) => {
      teacherReqs = snap.docs.map(d => ({ id: d.id, source: 'teacher', ...d.data() }));
      updateCombinedRequests();
    });

    const unSubDeletions = onSnapshot(query(collection(db, 'deletion_requests'), where('status', '==', 'Pending')), (snap) => {
      accReqs = snap.docs.map(d => ({ id: d.id, source: 'accountant', ...d.data() }));
      updateCombinedRequests();
    });

    return () => {
      unsubscribeAuth(); unSubStudents(); unSubTeachers(); unSubAccountants(); unSubCourses(); unSubMessages(); unSubDeletions();
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

  // Dismiss a request directly from the dashboard
  const handleDismissRequest = async (id, source) => {
    if(window.confirm("Are you sure you want to dismiss this request?")) {
      try {
        const colName = source === 'accountant' ? 'deletion_requests' : 'messages';
        await deleteDoc(doc(db, colName, id));
      } catch (error) {
        console.error("Error deleting request:", error);
      }
    }
  };

  // --- NAVIGATION ARRAY WITH NEW ITEMS ---
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 relative">
      
      {/* SIDEBAR (DESKTOP MODE) */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm hidden md:flex shrink-0 z-20">
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
            <LogOut size={18} />
            <span>Secure Logout</span>
          </button>
        </div>
      </div>

      {/* MOBILE SIDEBAR DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-64 max-w-xs bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mr-3 p-1 border border-slate-200">
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
            
            {/* FIXED LOGOUT FOR MOBILE */}
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
        
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden transition-all">
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Control Center</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">City Nursing Institute, Rangpur</p>
            </div>
          </div>

          {/* User Profile & Notifications */}
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/system-settings')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all relative">
              <Bell size={20} />
              {pendingRequests.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            
            <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>

            <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{adminName}</p>
                <div className="flex items-center justify-end space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Admin</p>
                </div>
              </div>
              {/* Dynamic Initials Avatar */}
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shadow-md uppercase text-sm border-2 border-indigo-100">
                {adminInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Workspace Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 w-full">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Time Based Banner */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden animate-in fade-in">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50/60 rounded-full -mr-10 -mt-10 pointer-events-none"></div>
              <div className="z-10">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">{timeGreeting}, {adminName}!</h2>
                <p className="text-slate-500 text-sm sm:text-base font-medium">System is fully operational. All databases are synced in real-time.</p>
              </div>
              <div className="bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-slate-200 z-10 whitespace-nowrap shadow-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in">
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 shrink-0"><Users size={24} /></div>
                <div><p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Students</p><h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.students}</h3></div>
              </div>
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0"><UserPlus size={24} /></div>
                <div><p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Active Teachers</p><h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.teachers}</h3></div>
              </div>
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100 shrink-0"><ShieldAlert size={24} /></div>
                <div><p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Accountants</p><h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.accountants}</h3></div>
              </div>
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100 shrink-0"><BookOpen size={24} /></div>
                <div><p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Live Courses</p><h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.courses}</h3></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 animate-in fade-in">
              
              {/* Primary Action Panel */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm h-full">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">System Navigation Hub</h3>
                  <p className="text-slate-500 text-sm mb-6">Quickly navigate to different modules of the ERP system.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div onClick={() => navigate('/academic-setup')} className="border border-slate-100 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/30 p-5 rounded-xl flex flex-col transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3"><BookOpen size={20} /></div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">Academic Setup</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Configure year-wise courses, semesters, and curriculum baselines.</p>
                    </div>
                    
                    <div onClick={() => navigate('/staff-management')} className="border border-slate-100 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/30 p-5 rounded-xl flex flex-col transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3"><UserPlus size={20} /></div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">Staff Management</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Provision institutional profiles for Teachers and Accountants.</p>
                    </div>

                    <div onClick={() => navigate('/student-details')} className="border border-slate-100 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/30 p-5 rounded-xl flex flex-col transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3"><Search size={20} /></div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">Student Details & Entry</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Batch-process students via spreadsheet parsing with automated passwords.</p>
                    </div>

                    <div onClick={() => navigate('/course-assignments')} className="border border-slate-100 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/30 p-5 rounded-xl flex flex-col transition-all cursor-pointer">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3"><Layers size={20} /></div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">Course Assignments</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">Map academic batches to active courses and designated instructors.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* REAL-TIME ACTION REQUESTS (Unified Inbox) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center"><AlertCircle size={20} className="mr-2 text-rose-500"/> Action Center</h3>
                  <span className="bg-rose-100 text-rose-700 text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg">
                    {pendingRequests.length} Pending
                  </span>
                </div>
                <p className="text-slate-500 text-xs mb-4">Requests requiring system admin authorization.</p>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {pendingRequests.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-100 rounded-xl">
                      <CheckCircle size={36} className="text-emerald-400 mb-3" />
                      <p className="text-sm font-bold text-slate-700">Inbox Zero</p>
                      <p className="text-xs text-slate-500 mt-1">No pending requests from faculty or accounts.</p>
                    </div>
                  ) : (
                    pendingRequests.map((request) => (
                      <div key={request.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col relative group transition-all hover:shadow-md">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {request.source === 'accountant' ? (
                              <span className="bg-rose-100 text-rose-700 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center"><ShieldAlert size={10} className="mr-1"/> Delete Req</span>
                            ) : (
                              <span className="bg-indigo-100 text-indigo-700 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center"><Unlock size={10} className="mr-1"/> Unlock Req</span>
                            )}
                          </div>
                          <button onClick={() => handleDismissRequest(request.id, request.source)} className="text-slate-400 hover:text-rose-500 transition-colors p-1" title="Dismiss">
                            <X size={16} />
                          </button>
                        </div>
                        
                        <p className="text-xs font-bold text-slate-800 mb-1">
                          {request.source === 'accountant' ? `Delete payment for ${request.studentName}` : request.senderName}
                        </p>
                        <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                          {request.source === 'accountant' ? `Amount: ৳${request.paymentData?.amount} (${request.paymentData?.type})` : request.message}
                        </p>
                        
                        <button onClick={() => navigate('/system-settings')} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-2 rounded-lg transition-colors flex justify-center items-center">
                          Review in Settings
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
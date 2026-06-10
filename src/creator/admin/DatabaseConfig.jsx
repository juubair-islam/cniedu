import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, limit } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, Layers, Database, Briefcase, Info, Server, Activity, ArrowRight, ArrowRightLeft
} from 'lucide-react';

export default function DatabaseConfig() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Layout States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  
  // Database States
  const [selectedCollection, setSelectedCollection] = useState('users');
  const [collectionData, setCollectionData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // ENHANCED DATABASE SCHEMA MAP
  const COLLECTIONS_META = {
    'users': { 
      desc: "User profiles, roles, and status management.", 
      type: "Core Security Array",
      fields: ["uid", "name", "role", "staffId", "studentId", "phone", "designation", "status"] 
    },
    'batches': { 
      desc: "Academic batch information and routing parameters.", 
      type: "Academic Foundation",
      fields: ["id", "name", "year", "studentCount", "createdAt"] 
    },
    'courses': { 
      desc: "Course syllabus, batch assignments, and teacher mapping.", 
      type: "Academic Foundation",
      fields: ["id", "name", "batchId", "teacherId", "year", "createdAt"] 
    },
    'payments': { 
      desc: "Global financial transaction history and ledgers.", 
      type: "Financial Logs",
      fields: ["id", "studentUid", "amount", "type", "date", "note", "timestamp"] 
    },
    'attendance': { 
      desc: "Daily class attendance records mapped by course and batch.", 
      type: "Academic Tracking",
      fields: ["id", "courseId", "batchId", "date", "records(Map)", "timestamp"] 
    },
    'leaves': { 
      desc: "Student leave applications and admin decisions.", 
      type: "Operational Data",
      fields: ["id", "studentId", "date", "reason", "status", "createdAt"] 
    },
    'financials': { 
      desc: "Master balance sheets containing active dues and fine arrays.", 
      type: "Financial Master",
      fields: ["id", "totalCourseFee", "payments[Array]", "finesTotal", "finesPaid"] 
    },
    'messages': { 
      desc: "Internal support tickets and exam unlock requests.", 
      type: "System Comms",
      fields: ["id", "senderName", "message", "role", "createdAt"] 
    },
    'deletion_requests': { 
      desc: "Secure requests from accountants requiring admin approval.", 
      type: "System Security",
      fields: ["id", "studentId", "paymentData", "status", "createdAt"] 
    },
    'marks': { 
      desc: "Encrypted student academic grades and exam-wise matrix.", 
      type: "Academic Records",
      fields: ["id", "courseId", "studentId", "midterm", "final", "ct", "locks(Map)"] 
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const fullName = docSnap.data().name || 'System Admin';
          setAdminName(fullName);
          setAdminInitials(fullName.split(' ').length > 1 ? (fullName.split(' ')[0][0] + fullName.split(' ')[1][0]).toUpperCase() : fullName.substring(0, 2).toUpperCase());
        }
      } else { navigate('/'); }
    });
    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    if (!selectedCollection) return;
    setLoading(true);
    const unsub = onSnapshot(query(collection(db, selectedCollection), limit(50)), (snapshot) => {
      setCollectionData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [selectedCollection]);

  // --- MISSING LOGOUT FUNCTION ADDED HERE ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return collectionData.filter(doc => JSON.stringify(doc).toLowerCase().includes(q));
  }, [collectionData, searchQuery]);

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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Database Engine</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Core system logs & live data monitoring</p>
            </div>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{adminName}</p>
                <div className="flex items-center justify-end space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Admin</p>
                </div>
              </div>
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shadow-md uppercase text-sm border-2 border-indigo-100">
                {adminInitials}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Workspace Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 w-full">
           <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Top Control Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 
                 {/* Select Collection Card */}
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                      <Database size={14} className="mr-1.5"/> Select Active Core
                    </label>
                    <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer">
                        {Object.keys(COLLECTIONS_META).map(col => <option key={col} value={col}>{col} Data Set</option>)}
                    </select>
                 </div>

                 {/* Schema Context Info Panel */}
                 <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Server size={80}/></div>
                    <div className="flex items-start space-x-4 relative z-10">
                        <div className="p-3 bg-indigo-50 rounded-xl">
                          <Info className="text-indigo-600" size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-slate-900 text-lg capitalize">{selectedCollection} Schema</h4>
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">{COLLECTIONS_META[selectedCollection]?.type}</span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{COLLECTIONS_META[selectedCollection]?.desc}</p>
                          
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {COLLECTIONS_META[selectedCollection]?.fields.map((field, idx) => (
                              <span key={idx} className="bg-slate-50 text-indigo-700 border border-indigo-100 text-xs font-mono px-2 py-1 rounded-md shadow-sm">
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                    </div>
                 </div>
              </div>

              {/* Data Table Container */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                
                {/* Table Toolbar */}
                <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                        <Activity size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg capitalize text-slate-900 leading-tight">Live Records</h3>
                        <span className="text-xs font-bold text-slate-500">Query limit: 50 docs | Found: {collectionData.length}</span>
                      </div>
                    </div>
                    
                    <div className="relative w-full sm:w-72">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm shadow-sm" 
                        placeholder="Search JSON payload..." 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                      />
                    </div>
                </div>
                
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-20">
                      <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-indigo-600 mb-4"></div>
                      <p className="text-slate-500 font-bold text-sm">Syncing Live Data Stream...</p>
                    </div>
                ) : (
                  <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-slate-50 p-4">
                    <table className="w-full text-left text-sm min-w-[700px] border-collapse bg-white shadow-sm border border-slate-200 rounded-lg">
                      <thead className="bg-slate-900 text-white uppercase text-[10px] font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3 w-64 border-r border-slate-700 rounded-tl-lg">Document ID (Key)</th>
                          <th className="px-4 py-3 rounded-tr-lg">JSON Payload Structure</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((doc, idx) => (
                          <tr key={doc.id} className="hover:bg-indigo-50/30 transition-colors group">
                              <td className="px-4 py-4 font-mono text-xs font-bold text-slate-700 border border-slate-200 align-top bg-slate-50">
                                <div className="flex items-start space-x-2">
                                  <ArrowRight size={14} className="text-indigo-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                  <span className="break-all">{doc.id}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 font-mono text-[11px] text-slate-600 border border-slate-200">
                                <pre className="max-w-3xl overflow-x-auto whitespace-pre-wrap p-2 rounded bg-slate-50 border border-slate-100">
                                  {JSON.stringify(doc, null, 2)}
                                </pre>
                              </td>
                          </tr>
                        ))}
                        {filteredData.length === 0 && (
                          <tr>
                            <td colSpan="2" className="px-6 py-16 text-center text-slate-400 bg-white border border-slate-200">
                              <Database size={40} className="mx-auto mb-3 opacity-30"/>
                              <p className="font-bold">No records found matching your query.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

           </div>
        </main>
      </div>
    </div>
  );
}
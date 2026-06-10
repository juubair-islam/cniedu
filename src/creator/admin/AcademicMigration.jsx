import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, updateDoc, writeBatch, increment, query, where, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase'; // Adjust path if needed
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, Layers, Bell, CheckCircle, Clock, AlertCircle, 
  Database, ShieldAlert, Unlock, Trash2, Briefcase, ArrowRightLeft, Calendar, Info, AlertTriangle, Award
} from 'lucide-react';

export default function AcademicMigration() {
  const navigate = useNavigate();
  const location = useLocation();

  // Layout & Auth States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // --- SUB-TABS STATE ---
  const [activeSubTab, setActiveSubTab] = useState('migration'); // 'migration', 'year-update', 'alumni', 'alumni-list'

  // Core Data States
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [financials, setFinancials] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // States for Batch Year Edit
  const [editBatchId, setEditBatchId] = useState('');
  const [newYear, setNewYear] = useState('');

  // States for Migration/Promotion
  const [sourceBatchId, setSourceBatchId] = useState('');
  const [targetBatchId, setTargetBatchId] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);

  // States for Course Complete (Alumni Migration)
  const [alumniBatchId, setAlumniBatchId] = useState('');
  const [selectedAlumniStudents, setSelectedAlumniStudents] = useState([]);

  // State for Viewing Graduated List Filtering
  const [filterAlumniBatchId, setFilterAlumniBatchId] = useState('');

  // Pending Requests (for top nav bell icon)
  const [pendingRequests, setPendingRequests] = useState([]);

  // Modal State
  const [uiDialog, setUiDialog] = useState({ isOpen: false, title: '', desc: '', type: 'info', onConfirm: null });

  const showDialog = (title, desc, type, onConfirm = null) => {
    setUiDialog({ isOpen: true, title, desc, type, onConfirm });
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Fetch Logged-in Admin Data
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
        } catch (error) { console.error("Error fetching admin data:", error); }
      } else { navigate('/'); }
      setLoading(false);
    });

    // 2. Fetch Core Data (Batches, Students, Financials)
    const unSubBatches = onSnapshot(collection(db, 'batches'), (snap) => {
      setBatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unSubStudents = onSnapshot(collection(db, 'users'), (snap) => {
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(allUsers.filter(u => u.role === 'student'));
    });

    const unSubFinancials = onSnapshot(collection(db, 'financials'), (snap) => {
      const finMap = {};
      snap.forEach(doc => { finMap[doc.id] = doc.data(); });
      setFinancials(finMap);
    });

    // 3. Unified Pending Requests Listener (For Bell Icon)
    let teacherReqs = [];
    let accReqs = [];
    const updateCombinedRequests = () => {
      const combined = [...teacherReqs, ...accReqs].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
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

    return () => { unsubscribeAuth(); unSubBatches(); unSubStudents(); unSubFinancials(); unSubMessages(); unSubDeletions(); };
  }, [navigate]);

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/'); } 
    catch (error) { console.error("Logout failed", error); }
  };

  const getBatchName = (id) => batches.find(b => b.id === id)?.name || 'Unknown Batch';

  // --- SMART FILTER & VALIDATION FOR PROMOTION (TAB 1) ---
  const promotionFilteredStudents = useMemo(() => {
    if (!sourceBatchId) return [];
    return students
      .filter(s => s.batchId === sourceBatchId && s.status !== 'Alumni' && (s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.studentId?.includes(searchQuery)))
      .map(s => {
        const fin = financials[s.id] || {};
        const finesTotal = Number(fin.finesTotal) || 0;
        const finesPaid = Number(fin.finesPaid) || 0;
        const fineDue = finesTotal - finesPaid;
        return { ...s, fineDue, isEligible: fineDue <= 0 };
      });
  }, [students, sourceBatchId, financials, searchQuery]);

  // --- SMART FILTER & VALIDATION FOR ALUMNI ACTIVATION (TAB 3) ---
  const alumniFilteredStudents = useMemo(() => {
    if (!alumniBatchId) return [];
    return students
      .filter(s => s.batchId === alumniBatchId && s.status !== 'Alumni' && (s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.studentId?.includes(searchQuery)))
      .map(s => {
        const fin = financials[s.id] || {};
        const finesTotal = Number(fin.finesTotal) || 0;
        const finesPaid = Number(fin.finesPaid) || 0;
        const fineDue = finesTotal - finesPaid;

        const totalCourseFee = Number(fin.totalCourseFee) || 0;
        const admissionFeePaid = Number(fin.admissionFeePaid) || 0;
        const monthlyPaidTotal = Number(fin.monthlyPaidTotal) || 0;
        const feePaid = admissionFeePaid + monthlyPaidTotal;
        const feeDue = Math.max(0, totalCourseFee - feePaid);

        return { ...s, fineDue, feeDue, isEligible: fineDue <= 0 && feeDue <= 0 };
      });
  }, [students, alumniBatchId, financials, searchQuery]);

  // --- SMART FILTER FOR VIEWING COMPLETED GRADUATED LIST (TAB 4) ---
  const graduatedListStudents = useMemo(() => {
    return students.filter(s => 
      s.status === 'Alumni' && 
      (!filterAlumniBatchId || s.batchId === filterAlumniBatchId) &&
      (s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || s.studentId?.includes(searchQuery))
    );
  }, [students, filterAlumniBatchId, searchQuery]);

  // --- ACTION 1: EDIT BATCH YEAR ---
  const handleUpdateBatchYear = async (e) => {
    e.preventDefault();
    if (!editBatchId || !newYear) return;
    
    showDialog("Update Batch Year", `Are you sure you want to update the year to "${newYear}"? The batch name will remain unchanged.`, "confirm", async () => {
      setActionLoading(true);
      try {
        await updateDoc(doc(db, 'batches', editBatchId), { year: newYear });
        showDialog("Success", "Batch year updated successfully!", "success");
        setEditBatchId(''); setNewYear('');
      } catch (err) {
        showDialog("Error", "Failed to update batch year.", "error");
      }
      setActionLoading(false);
    });
  };

  // --- ACTION 2: STUDENT MIGRATION / PROMOTION ---
  const toggleStudentSelection = (studentId, isEligible) => {
    if (!isEligible) {
      showDialog("Migration Blocked", "This student has outstanding fines. They cannot be migrated until accounts are cleared.", "alert");
      return;
    }
    setSelectedStudents(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  const selectAllPromotionEligible = () => {
    const eligibleIds = promotionFilteredStudents.filter(s => s.isEligible).map(s => s.id);
    setSelectedStudents(eligibleIds);
  };

  const handleMigration = async () => {
    if (selectedStudents.length === 0) return showDialog("Error", "Please select at least one eligible student.", "error");
    if (!targetBatchId) return showDialog("Error", "Please select a target batch.", "error");
    if (sourceBatchId === targetBatchId) return showDialog("Error", "Source and Target batch cannot be the same.", "error");

    const targetBatchData = batches.find(b => b.id === targetBatchId);

    showDialog("Confirm Migration", `Moving ${selectedStudents.length} student(s) to ${targetBatchData.name}.\n\nTheir academic data (attendance, marks) will reset for the new batch, but their Financial Ledger will remain intact. Proceed?`, "confirm", async () => {
      setActionLoading(true);
      try {
        const batchWrite = writeBatch(db);
        
        selectedStudents.forEach(studentId => {
          const studentRef = doc(db, 'users', studentId);
          batchWrite.update(studentRef, { batchId: targetBatchId });
        });

        const sourceBatchRef = doc(db, 'batches', sourceBatchId);
        const targetBatchRef = doc(db, 'batches', targetBatchId);
        batchWrite.update(sourceBatchRef, { studentCount: increment(-selectedStudents.length) });
        batchWrite.update(targetBatchRef, { studentCount: increment(selectedStudents.length) });

        await batchWrite.commit();
        
        setSelectedStudents([]);
        showDialog("Migration Successful", "Students safely migrated to the new batch!", "success");
      } catch (error) {
        showDialog("Migration Failed", error.message, "error");
      }
      setActionLoading(false);
    });
  };

  // --- ACTION 3: COURSE COMPLETE (ALUMNI MIGRATION) ---
  const toggleAlumniSelection = (studentId, isEligible) => {
    if (!isEligible) {
      showDialog("Graduation Locked", "This student has outstanding course fees or fine penalties. All dues must be ৳0 to graduate.", "alert");
      return;
    }
    setSelectedAlumniStudents(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  const selectAllAlumniEligible = () => {
    const eligibleIds = alumniFilteredStudents.filter(s => s.isEligible).map(s => s.id);
    setSelectedAlumniStudents(eligibleIds);
  };

  const handleAlumniConversion = async () => {
    if (selectedAlumniStudents.length === 0) return showDialog("Error", "Please select at least one cleared student.", "error");

    showDialog("Confirm Graduation", `Are you sure you want to complete the course for ${selectedAlumniStudents.length} student(s)? Their status will permanently change to "Alumni".`, "confirm", async () => {
      setActionLoading(true);
      try {
        const batchWrite = writeBatch(db);

        selectedAlumniStudents.forEach(studentId => {
          const studentRef = doc(db, 'users', studentId);
          batchWrite.update(studentRef, { status: 'Alumni', updatedAt: serverTimestamp() });
        });

        const currentBatchRef = doc(db, 'batches', alumniBatchId);
        batchWrite.update(currentBatchRef, { studentCount: increment(-selectedAlumniStudents.length) });

        await batchWrite.commit();

        setSelectedAlumniStudents([]);
        showDialog("Graduation Successful", "Students successfully moved to the Alumni database registry!", "success");
      } catch (error) {
        showDialog("Graduation Failed", error.message, "error");
      }
      setActionLoading(false);
    });
  };

  // --- NAVIGATION ARRAY ---
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600"></div></div>;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 relative">
      
      {/* CUSTOM DIALOG */}
      {uiDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUiDialog({ ...uiDialog, isOpen: false })}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden animate-in zoom-in-95">
            <div className={`p-5 flex items-center space-x-3 border-b border-slate-100 ${uiDialog.type === 'alert' || uiDialog.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
              {uiDialog.type === 'alert' || uiDialog.type === 'error' ? <ShieldAlert size={24}/> : <CheckCircle size={24}/>}
              <h2 className="text-lg font-bold">{uiDialog.title}</h2>
            </div>
            <div className="p-6 text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">{uiDialog.desc}</div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              {uiDialog.type === 'confirm' && <button onClick={() => setUiDialog({ ...uiDialog, isOpen: false })} className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-xl">Cancel</button>}
              <button onClick={() => { if (uiDialog.onConfirm) uiDialog.onConfirm(); setUiDialog({ ...uiDialog, isOpen: false }); }} className="px-6 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md">
                {uiDialog.type === 'confirm' ? 'Confirm Action' : 'Acknowledge'}
              </button>
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
            <button key={item.id} onClick={() => { if (item.path !== '#') navigate(item.path); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all text-left ${location.pathname === item.path ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
              <div className="shrink-0">{item.icon}</div><span className="whitespace-nowrap">{item.name}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl transition-all font-medium shadow-sm"><LogOut size={18} /><span>Secure Logout</span></button>
        </div>
      </div>

      {/* MOBILE SIDEBAR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-64 max-w-xs bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mr-3 p-1 border border-slate-200"><img src="/logo.png" alt="CNI Logo" className="w-full h-full object-contain" /></div>
                <h2 className="text-lg font-bold text-slate-900">CNIEDU</h2>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-800 p-1 rounded-lg"><X size={20} /></button>
            </div>
            <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { if(item.path !== '#') { navigate(item.path); setIsMobileMenuOpen(false); } }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-left ${location.pathname === item.path ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <div className="shrink-0">{item.icon}</div><span className="whitespace-nowrap">{item.name}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 mt-auto">
              <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-medium"><LogOut size={18} /><span>Secure Logout</span></button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden transition-all"><Menu size={24} /></button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Academic Migration Control</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Promote classes, manage batch lifecycles, and audit alumni clearance.</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/system-settings')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all relative">
              <Bell size={20} />
              {pendingRequests.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>}
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
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shadow-md uppercase text-sm border-2 border-indigo-100">{adminInitials}</div>
            </div>
          </div>
        </header>

        {/* Dynamic Workspace Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 w-full">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* --- SUB-TAB BUTTONS SYSTEM --- */}
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm max-w-3xl flex-wrap gap-1 animate-in fade-in">
              <button 
                onClick={() => { setActiveSubTab('migration'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'migration' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <ArrowRightLeft size={16}/><span>Student Promotion</span>
              </button>
              <button 
                onClick={() => { setActiveSubTab('year-update'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'year-update' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Calendar size={16}/><span>Update Batch Year</span>
              </button>
              <button 
                onClick={() => { setActiveSubTab('alumni'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'alumni' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Award size={16}/><span>Course Complete</span>
              </button>
              <button 
                onClick={() => { setActiveSubTab('alumni-list'); setSearchQuery(''); }}
                className={`flex-1 min-w-[120px] flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'alumni-list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Users size={16}/><span>Alumni Directory</span>
              </button>
            </div>

            {/* --- SUB-TAB 1: STUDENT PROMOTION / MIGRATION --- */}
            {activeSubTab === 'migration' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Source Batch (Move From)</label>
                    <select value={sourceBatchId} onChange={e => {setSourceBatchId(e.target.value); setSelectedStudents([]);}} className="w-full px-4 py-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 font-bold">
                      <option value="">-- Select Source --</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.year})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Target Batch (Move To)</label>
                    <select value={targetBatchId} onChange={e => setTargetBatchId(e.target.value)} className="w-full px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                      <option value="">-- Select Target --</option>
                      {batches.filter(b => b.id !== sourceBatchId).map(b => <option key={b.id} value={b.id}>{b.name} ({b.year})</option>)}
                    </select>
                  </div>
                </div>

                {sourceBatchId && (
                  <>
                    <div className="flex justify-between items-center gap-4">
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Search by name or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
                      </div>
                      <button onClick={selectAllPromotionEligible} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-all shrink-0">Select All Eligible</button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-4 py-3 w-10">Select</th>
                            <th className="px-4 py-3">Student Details</th>
                            <th className="px-4 py-3 text-right">Fine Validation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {promotionFilteredStudents.length === 0 ? (
                            <tr><td colSpan="3" className="p-8 text-center text-slate-400 font-medium">No active student records found in this batch.</td></tr>
                          ) : (
                            promotionFilteredStudents.map(student => (
                              <tr key={student.id} className={`transition-colors ${!student.isEligible ? 'bg-rose-50/30' : 'hover:bg-slate-50'}`}>
                                <td className="px-4 py-3">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedStudents.includes(student.id)} 
                                    onChange={() => toggleStudentSelection(student.id, student.isEligible)}
                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={!student.isEligible}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <p className={`font-bold ${!student.isEligible ? 'text-slate-500' : 'text-slate-900'}`}>{student.name}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">ID: {student.studentId}</p>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {student.isEligible ? (
                                    <span className="text-emerald-600 font-bold text-[10px] uppercase bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 flex items-center justify-end w-max ml-auto tracking-wider"><CheckCircle size={12} className="mr-1"/> Cleared to Move</span>
                                  ) : (
                                    <span className="text-rose-600 font-bold text-[10px] uppercase bg-rose-50 px-2 py-1 rounded-md border border-rose-100 flex items-center justify-end w-max ml-auto tracking-wider"><AlertTriangle size={12} className="mr-1"/> ৳{student.fineDue} Fine Due</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900 p-4 rounded-xl shadow-lg gap-4">
                      <p className="text-sm font-bold text-white flex items-center"><Users size={18} className="mr-2 text-indigo-400"/> Selected: {selectedStudents.length} Student(s)</p>
                      <button onClick={handleMigration} disabled={actionLoading || selectedStudents.length === 0 || !targetBatchId} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg shadow-sm transition-all flex items-center justify-center">
                        <ArrowRightLeft size={18} className="mr-2"/> Process Migration
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- SUB-TAB 2: UPDATE BATCH YEAR --- */}
            {activeSubTab === 'year-update' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl animate-in fade-in duration-150">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><Calendar size={20} className="mr-2 text-indigo-500"/> Update Batch Year</h2>
                <form onSubmit={handleUpdateBatchYear} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Select Batch</label>
                    <select required value={editBatchId} onChange={e => setEditBatchId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700">
                      <option value="">-- Choose Batch --</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name} (Year: {b.year})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">New Academic Year</label>
                    <input type="text" required value={newYear} onChange={e => setNewYear(e.target.value)} placeholder="e.g. 2nd Year" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800" />
                  </div>
                  <button type="submit" disabled={actionLoading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-sm">
                    Save Year Update
                  </button>
                  <div className="p-3 bg-indigo-50 text-indigo-800 rounded-lg border border-indigo-100 text-xs font-medium mt-2">
                    <Info size={14} className="inline mr-1 mb-0.5"/> Updates the year tag (e.g., 1st Year to 2nd Year). The original Batch Name remains unchanged.
                  </div>
                </form>
              </div>
            )}

            {/* --- SUB-TAB 3: COURSE COMPLETE (ALUMNI MIGRATION) --- */}
            {activeSubTab === 'alumni' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Select Graduating Batch</label>
                  <select value={alumniBatchId} onChange={e => {setAlumniBatchId(e.target.value); setSelectedAlumniStudents([]);}} className="w-full md:w-1/2 px-4 py-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                    <option value="">-- Choose Batch to Graduate --</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.year})</option>)}
                  </select>
                </div>

                {alumniBatchId && (
                  <>
                    <div className="flex justify-between items-center gap-4">
                      <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder="Filter candidates..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
                      </div>
                      <button onClick={selectAllAlumniEligible} className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-all shrink-0">Select All Cleared Candidates</button>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="px-4 py-3 w-10">Select</th>
                            <th className="px-4 py-3">Student Name</th>
                            <th className="px-4 py-3 text-right">Financial Dues Audit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {alumniFilteredStudents.length === 0 ? (
                            <tr><td colSpan="3" className="p-8 text-center text-slate-400 font-medium">No active student records left in this batch.</td></tr>
                          ) : (
                            alumniFilteredStudents.map(student => (
                              <tr key={student.id} className={`transition-colors ${!student.isEligible ? 'bg-rose-50/20' : 'hover:bg-slate-50'}`}>
                                <td className="px-4 py-3">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedAlumniStudents.includes(student.id)} 
                                    onChange={() => toggleAlumniSelection(student.id, student.isEligible)}
                                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                                    disabled={!student.isEligible}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <p className={`font-bold ${!student.isEligible ? 'text-slate-400' : 'text-slate-900'}`}>{student.name}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">ID: {student.studentId}</p>
                                </td>
                                <td className="px-4 py-3 text-right text-xs">
                                  {student.isEligible ? (
                                    <span className="text-emerald-600 font-bold text-[10px] uppercase bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 flex items-center justify-end w-max ml-auto tracking-wider"><CheckCircle size={12} className="mr-1"/> 100% Cleared</span>
                                  ) : (
                                    <div className="flex flex-col items-end gap-0.5">
                                      {student.feeDue > 0 && <span className="text-rose-600 font-bold text-[10px] uppercase bg-rose-50 px-2 py-0.5 rounded border border-rose-100 block w-max"><AlertTriangle size={10} className="inline mr-1 mb-0.5"/> ৳{student.feeDue} Fee Due</span>}
                                      {student.fineDue > 0 && <span className="text-amber-600 font-bold text-[10px] uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-100 block w-max"><AlertCircle size={10} className="inline mr-1 mb-0.5"/> ৳{student.fineDue} Fine Due</span>}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between bg-emerald-950 p-4 rounded-xl shadow-lg gap-4">
                      <p className="text-sm font-bold text-white flex items-center"><Award size={18} className="mr-2 text-emerald-400"/> Graduate Counter: {selectedAlumniStudents.length} Student(s) Selected</p>
                      <button 
                        onClick={handleAlumniConversion} 
                        disabled={actionLoading || selectedAlumniStudents.length === 0} 
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-lg shadow-sm transition-all flex items-center justify-center"
                      >
                        Issue Course Complete Status
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- SUB-TAB 4: ALUMNI DIRECTORY / LIST --- */}
            {activeSubTab === 'alumni-list' && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="w-full sm:w-1/3">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Filter By Cohort/Batch</label>
                    <select value={filterAlumniBatchId} onChange={e => setFilterAlumniBatchId(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-700 text-sm">
                      <option value="">-- All Graduated Batches --</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="relative w-full sm:w-72 self-end">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Search alumni directory..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium" />
                  </div>
                </div>

                {/* মোবাইল স্ক্রিন প্রোটেক্টেড স্ক্রোল কন্টেইনার */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto overflow-x-auto custom-scrollbar w-full">
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[650px]">
                    <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3.5 sm:px-6">Graduated Alumnus</th>
                        <th className="px-4 py-3.5 sm:px-6">Batch</th>
                        <th className="px-4 py-3.5 sm:px-6 text-right">Verification Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {graduatedListStudents.length === 0 ? (
                        <tr><td colSpan="3" className="p-10 text-center text-slate-400 font-medium">No archived alumni profiles match selection filter.</td></tr>
                      ) : (
                        graduatedListStudents.map(alumni => (
                          <tr key={alumni.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 sm:px-6">
                              <p className="font-bold text-slate-900 text-sm sm:text-base">{alumni.name}</p>
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                ID: {alumni.studentId} {alumni.phone ? `| Mobile: ${alumni.phone}` : ''}
                              </p>
                            </td>
                            <td className="px-4 py-3 sm:px-6 font-semibold text-slate-600 text-xs sm:text-sm">
                              {getBatchName(alumni.batchId)}
                            </td>
                            <td className="px-4 py-3 sm:px-6 text-right">
                              <span className="inline-flex items-center text-amber-700 font-bold text-[9px] sm:text-[10px] uppercase bg-amber-50 border border-amber-200 px-2 py-0.5 sm:py-1 rounded tracking-wider shadow-sm">
                                <Award size={11} className="mr-1 sm:mr-1.5 text-amber-500 shrink-0"/> Certified Alumni
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>


                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-500 flex items-center space-x-2">
                  <Info size={14} className="text-indigo-500 shrink-0"/>
                  <span>Total Alumni Archives Fetched: {graduatedListStudents.length} record(s). Financial matrices and old results ledger of these profiles are safe inside logs.</span>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
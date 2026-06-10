import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, addDoc, onSnapshot, query, orderBy, 
  deleteDoc, doc, serverTimestamp, getDoc, updateDoc, setDoc 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, FileText, UploadCloud, AlertTriangle, Trash2, 
  Download, Info, Layers, Database, Briefcase, ArrowRightLeft
} from 'lucide-react';

export default function ManageCourses() {
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
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  // Batch Form States (Bulk vs Individual)
  const [batchEntryType, setBatchEntryType] = useState('bulk'); 
  const [batchName, setBatchName] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [studentFile, setStudentFile] = useState(null);
  
  // Individual Student States
  const [indStudent, setIndStudent] = useState({ name: '', id: '', phone: '', gName: '', gPhone: '', batchId: '' });

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

    // Fetch Batches
    const qBatches = query(collection(db, 'batches'), orderBy('createdAt', 'desc'));
    const unSubBatches = onSnapshot(qBatches, (snapshot) => {
      setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeAuth();
      unSubBatches();
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

  const downloadTemplate = (e) => {
    e.preventDefault();
    const csvContent = "data:text/csv;charset=utf-8,StudentName,StudentID,ContactNumber,GuardianName,GuardianContact\nJubair Islam,2026001,01700000000,Abbu,01800000000";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "CNI_Student_Roster_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Modal Triggers ---
  const requestAddBatchBulk = (e) => {
    e.preventDefault();
    if (!batchName || !batchYear) return;
    setActionModal({
      isOpen: true,
      type: 'CREATE_BATCH',
      title: 'Confirm Batch Creation',
      desc: `Are you sure you want to create "${batchName}"? ${!studentFile ? '(No roster attached).' : 'System will create actual Firebase Login Accounts for each valid student.'}`,
      btnText: 'Yes, Create Batch',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
    });
  };

  const requestAddIndividualStudent = (e) => {
    e.preventDefault();
    const cleanId = indStudent.id.trim();
    if (!indStudent.batchId || !indStudent.name || !cleanId) return;
    
    if (cleanId.length < 6) {
      alert("Student ID must be at least 6 characters long!");
      return;
    }

    const batchInfo = batches.find(b => b.id === indStudent.batchId);
    setActionModal({
      isOpen: true,
      type: 'CREATE_STUDENT',
      title: 'Confirm Student Entry',
      desc: `A Firebase Auth account will be created for ${indStudent.name} (ID: ${cleanId}) in ${batchInfo?.name}. They can log in immediately.`,
      btnText: 'Yes, Create Account',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
    });
  };

  const requestDeleteBatch = (id, name) => {
    setActionModal({
      isOpen: true,
      type: 'DELETE_BATCH',
      data: { id },
      title: 'Are you absolutely sure?',
      desc: `Delete batch "${name}"? This action cannot be undone.`,
      btnText: 'Yes, Delete Batch',
      btnColor: 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
    });
  };

  // --- 🔥 CORE: SECURE STUDENT ACCOUNT CREATOR 🔥 ---
  const createSecureStudentAccount = async (studentData) => {
    const rawId = String(studentData.id).trim();
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
        name: studentData.name,
        studentId: rawId,
        phone: studentData.phone,
        gName: studentData.gName,
        gPhone: studentData.gPhone,
        batchId: studentData.batchId,
        email: email,
        role: 'student',
        createdAt: serverTimestamp()
      });

      await signOut(secondaryAuth);
      return { success: true };

    } catch (error) {
      console.error(`Auth Error for ${rawId}:`, error);
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = `Student ID ${rawId} is already registered in the system!`;
      return { success: false, message: msg };
    }
  };

  // --- CSV PARSING ENGINE ---
  const parseCSVAndCreateAccounts = (file, batchId) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target.result;
          const lines = text.split('\n');
          let successCount = 0;

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
              const columns = line.split(',');
              if (columns.length >= 2) {
                const sName = columns[0]?.trim();
                const sId = columns[1]?.trim();
                
                if (sName && sId && sId.length >= 6) {
                  const result = await createSecureStudentAccount({
                    name: sName,
                    id: sId,
                    phone: columns[2]?.trim() || '',
                    gName: columns[3]?.trim() || '',
                    gPhone: columns[4]?.trim() || '',
                    batchId: batchId
                  });
                  if (result.success) successCount++;
                }
              }
            }
          }
          resolve(successCount);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  };

  // --- MASTER ACTION EXECUTION ---
  const executeModalAction = async () => {
    setLoading(true);
    try {
      if (actionModal.type === 'CREATE_BATCH') {
        const batchDocRef = await addDoc(collection(db, 'batches'), {
          name: batchName,
          year: batchYear,
          fileName: studentFile ? studentFile.name : 'No file uploaded',
          studentCount: "0", 
          createdAt: serverTimestamp()
        });

        if (studentFile) {
          const finalCount = await parseCSVAndCreateAccounts(studentFile, batchDocRef.id);
          await updateDoc(batchDocRef, { studentCount: finalCount.toString() });
        }
        setBatchName(''); setBatchYear(''); setStudentFile(null);
        setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
      } 
      
      else if (actionModal.type === 'CREATE_STUDENT') {
        const result = await createSecureStudentAccount(indStudent);
        
        if (result.success) {
          const batchRef = doc(db, 'batches', indStudent.batchId);
          const batchSnap = await getDoc(batchRef);
          if (batchSnap.exists()) {
            const currentCount = parseInt(batchSnap.data().studentCount || '0', 10);
            await updateDoc(batchRef, { studentCount: (currentCount + 1).toString() });
          }
          setIndStudent({ name: '', id: '', phone: '', gName: '', gPhone: '', batchId: '' });
          setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
        } else {
          alert(`Failed to Create Student: \n\n${result.message}`);
          setLoading(false);
          setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
          return;
        }
      } 
      
      else if (actionModal.type === 'DELETE_BATCH') {
        if (actionModal.data && actionModal.data.id) {
          await deleteDoc(doc(db, 'batches', actionModal.data.id));
        }
        setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
      }
    } catch (error) {
      console.error("Action execution error: ", error);
      alert("An unexpected error occurred. Please check console.");
      setActionModal({ isOpen: false, type: '', data: null, title: '', desc: '', btnText: '', btnColor: '' });
    }
    setLoading(false);
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

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 relative">
      
      {/* UNIVERSAL CONFIRMATION MODAL */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => !loading && setActionModal({ ...actionModal, isOpen: false })}></div>
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl z-10 w-[90%] max-w-md animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${actionModal.type === 'DELETE_BATCH' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {actionModal.type === 'DELETE_BATCH' ? <AlertTriangle size={32} /> : <Info size={32} />}
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
                {loading ? (
                  <span className="flex items-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div> Processing</span>
                ) : actionModal.btnText}
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-64 max-w-xs bg-white h-full flex flex-col p-6 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center mr-2 p-1">
                  <img src="/logo.png" alt="CNI Logo" className="w-full h-full object-contain" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">CNIEDU</h2>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 p-1"><X size={20} /></button>
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
            <div className="pt-4 border-t border-slate-100">
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
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl md:hidden">
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Academic Setup</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Manage Batches & Student Records</p>
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
          
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* TOP SECTION: Creation Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
              
              {/* Toggle Entry Modes */}
              <div className="flex p-1 bg-slate-100 rounded-xl mb-8 max-w-md mx-auto">
                <button 
                  onClick={() => setBatchEntryType('bulk')} 
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${batchEntryType === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Create New Batch
                </button>
                <button 
                  onClick={() => setBatchEntryType('individual')} 
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${batchEntryType === 'individual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Add Individual Student
                </button>
              </div>

              {batchEntryType === 'bulk' ? (
                /* BULK BATCH FORM */
                <form onSubmit={requestAddBatchBulk} className="max-w-2xl mx-auto space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Initialize Batch</h2>
                    <p className="text-sm text-slate-500">Create a batch and optionally upload student roster.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Batch Name *</label>
                      <input type="text" required value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="e.g. Batch 2026 (Nursing)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Academic Year *</label>
                      <input type="text" required value={batchYear} onChange={(e) => setBatchYear(e.target.value)} placeholder="e.g. 1st Year" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bold text-slate-700">Student Roster (Optional)</label>
                      <button type="button" onClick={downloadTemplate} className="text-xs text-indigo-600 font-bold hover:underline flex items-center bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors hover:bg-indigo-100">
                        <Download size={14} className="mr-1.5"/> Download CSV Template
                      </button>
                    </div>
                    
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50 rounded-xl cursor-pointer transition-colors relative">
                      {studentFile ? (
                        <div className="flex flex-col items-center text-indigo-700 text-center p-4">
                          <FileText size={28} className="mb-2" />
                          <span className="text-base font-bold truncate max-w-xs">{studentFile.name}</span>
                          <span className="text-xs text-indigo-500 mt-1">Ready for account creation</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-slate-500">
                          <UploadCloud size={28} className="text-indigo-400 mb-2" />
                          <span className="text-sm font-semibold">Click to upload roster</span>
                          <span className="text-xs mt-1">Accepts .csv format</span>
                        </div>
                      )}
                      <input type="file" className="hidden" accept=".csv" onChange={(e) => setStudentFile(e.target.files[0])} />
                    </label>
                  </div>

                  <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-md shadow-indigo-200 text-white font-bold py-3.5 rounded-xl transition-all mt-4 text-lg">
                    Initialize Batch
                  </button>
                </form>
              ) : (
                /* INDIVIDUAL STUDENT FORM */
                <form onSubmit={requestAddIndividualStudent} className="max-w-3xl mx-auto space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-slate-900">Individual Entry</h2>
                    <p className="text-sm text-slate-500">Manually enroll a student and generate their login.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Select Target Batch *</label>
                    <select required value={indStudent.batchId} onChange={(e) => setIndStudent({...indStudent, batchId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                      <option value="">-- Choose Active Batch --</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.year})</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">Student Info</h4>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Full Name *</label>
                        <input type="text" required value={indStudent.name} onChange={(e) => setIndStudent({...indStudent, name: e.target.value})} placeholder="e.g. John Doe" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      
                      {/* --- SMART VALIDATED ID FIELD --- */}
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Student ID *</label>
                        <input 
                          type="text" 
                          required 
                          minLength={6}
                          value={indStudent.id} 
                          onChange={(e) => setIndStudent({...indStudent, id: e.target.value})} 
                          placeholder="e.g. 2026001" 
                          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 transition-all ${
                            indStudent.id.length > 0 && indStudent.id.trim().length < 6 
                              ? 'border-rose-500 focus:ring-rose-500 bg-rose-50/30' 
                              : 'border-slate-200 focus:ring-indigo-500'
                          }`} 
                        />
                        {/* REAL-TIME WARNING */}
                        {indStudent.id.length > 0 && indStudent.id.trim().length < 6 && (
                          <p className="text-xs text-rose-500 mt-1.5 font-bold flex items-center">
                            <AlertTriangle size={14} className="mr-1"/> ID must be at least 6 characters long.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Contact Number *</label>
                        <input type="text" required value={indStudent.phone} onChange={(e) => setIndStudent({...indStudent, phone: e.target.value})} placeholder="e.g. +8801..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>

                    <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-2">Guardian Info</h4>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Guardian Name *</label>
                        <input type="text" required value={indStudent.gName} onChange={(e) => setIndStudent({...indStudent, gName: e.target.value})} placeholder="Name of Guardian" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Guardian Contact *</label>
                        <input type="text" required value={indStudent.gPhone} onChange={(e) => setIndStudent({...indStudent, gPhone: e.target.value})} placeholder="Emergency Contact" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={batches.length === 0 || (indStudent.id.length > 0 && indStudent.id.trim().length < 6)} 
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-md shadow-indigo-200 disabled:from-slate-400 disabled:to-slate-400 text-white font-bold py-3.5 rounded-xl transition-all mt-4 text-lg"
                  >
                    Add Student Record & Auto-Create Login
                  </button>
                </form>
              )}
            </div>

            {/* BOTTOM SECTION: Batch List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Active Batches</h2>
                  <p className="text-xs text-slate-500 mt-1">Manage batches and view imported rosters.</p>
                </div>
                <div className="bg-indigo-100 text-indigo-700 text-sm font-bold px-4 py-1.5 rounded-full border border-indigo-200">
                  Total Batches: {batches.length}
                </div>
              </div>
              
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Batch Information</th>
                      <th className="px-6 py-4">Student Roster</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-base">{batch.name}</p>
                          <p className="text-xs font-medium text-slate-500 mt-1 bg-slate-200/50 inline-block px-2 py-0.5 rounded">{batch.year}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <Users size={16} className="text-indigo-500" />
                            <span className="font-semibold text-slate-700">{batch.studentCount} Students Active</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 truncate w-48" title={batch.fileName}>Source: {batch.fileName}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => requestDeleteBatch(batch.id, batch.name)} className="text-slate-400 hover:text-rose-500 p-2.5 rounded-lg hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100">
                            <Trash2 size={18}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {batches.length === 0 && <tr><td colSpan="3" className="text-center py-16 text-slate-400 font-medium">No batches created yet. Initialize a batch above.</td></tr>}
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
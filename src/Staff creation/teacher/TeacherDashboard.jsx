import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, doc, getDoc, setDoc, writeBatch, serverTimestamp, addDoc 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, LogOut, Menu, X, BookOpen, CheckSquare, GraduationCap, 
  AlertTriangle, CheckCircle, CalendarDays, Save, Clock, Printer, Percent, ShieldAlert,
  Settings, Send, Lock, Users, PlusCircle, Unlock, FileText, Check, Info
} from 'lucide-react';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  
  // Layout & Auth States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [teacherData, setTeacherData] = useState({ name: 'Loading...', designation: '', uid: '' });
  const [teacherInitials, setTeacherInitials] = useState('TR');
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Custom UI Dialog/Modal State
  const [uiDialog, setUiDialog] = useState({ isOpen: false, title: '', desc: '', type: 'confirm', onConfirm: null });

  // Core Data States
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [systemSettings, setSystemSettings] = useState({ midtermOpen: false, finalOpen: false });
  const [approvedLeaves, setApprovedLeaves] = useState([]); 

  // Operational States
  const [selectedCourseId, setSelectedCourseId] = useState('');
  
  // Attendance States
  const [attendanceRecord, setAttendanceRecord] = useState({});
  const [courseAttendanceHistory, setCourseAttendanceHistory] = useState([]);
  const [attendanceSubmittedToday, setAttendanceSubmittedToday] = useState(false);
  const [showAttReportModal, setShowAttReportModal] = useState(false);
  const todayDate = new Date().toISOString().split('T')[0];

  // Exam States
  const [weightage, setWeightage] = useState({ mid: 30, final: 40, ct: 20, assign: 10 });
  const [marksRecord, setMarksRecord] = useState({}); 
  const [initialMarksRecord, setInitialMarksRecord] = useState({}); // Tracking strictly locked fields
  const [ctCount, setCtCount] = useState(1);
  const [locks, setLocks] = useState({ ct: false, mid: false, final: false });

  // Settings State
  const [newPassword, setNewPassword] = useState('');
  const [issueMsg, setIssueMsg] = useState('');

  // --- HELPER FUNCTIONS ---
  const showCustomDialog = (title, desc, type = 'confirm', onConfirm = null) => {
    setUiDialog({ isOpen: true, title, desc, type, onConfirm });
  };
  const showMessage = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 4000); };
  const getBatchName = (id) => batches.find(b => b.id === id)?.name || 'Unknown';

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role === 'teacher') {
            const data = docSnap.data();
            setTeacherData({ name: data.name, designation: data.designation, uid: user.uid });
            const nameParts = data.name.split(' ');
            setTeacherInitials(nameParts.length > 1 ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() : data.name.substring(0, 2).toUpperCase());
          } else {
            signOut(auth); navigate('/');
          }
        } catch (error) { console.error("Error fetching teacher:", error); }
      } else { navigate('/'); }
    });

    const unSubSettings = onSnapshot(doc(db, 'systemSettings', 'academicControls'), (doc) => {
      if (doc.exists()) setSystemSettings(doc.data());
    });
    const qCourses = query(collection(db, 'courses'), where('teacherId', '==', auth.currentUser?.uid || ''));
    const unSubCourses = onSnapshot(qCourses, (snapshot) => { setAssignedCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    const unSubBatches = onSnapshot(query(collection(db, 'batches')), (snapshot) => { setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
    const unSubStudents = onSnapshot(qStudents, (snapshot) => { setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    const qLeaves = query(collection(db, 'leaves'), where('date', '==', todayDate), where('status', '==', 'Approved'));
    const unSubLeaves = onSnapshot(qLeaves, (snapshot) => { setApprovedLeaves(snapshot.docs.map(doc => doc.data().studentId)); });

    return () => { unsubscribeAuth(); unSubSettings(); unSubCourses(); unSubBatches(); unSubStudents(); unSubLeaves(); };
  }, [navigate, todayDate]);

  const activeCourse = assignedCourses.find(c => c.id === selectedCourseId);
  const courseStudents = useMemo(() => {
    if (!activeCourse) return [];
    return students.filter(s => s.batchId === activeCourse.batchId);
  }, [activeCourse, students]);

  // --- ATTENDANCE LOGIC & HISTORY ---
  useEffect(() => {
    if (activeTab === 'attendance' && selectedCourseId) {
      const qHistory = query(collection(db, 'attendance'), where('courseId', '==', selectedCourseId));
      const unsubHistory = onSnapshot(qHistory, snap => {
        setCourseAttendanceHistory(snap.docs.map(d => d.data()).sort((a,b) => a.date.localeCompare(b.date)));
      });

      const fetchTodayAttendance = async () => {
        const snap = await getDoc(doc(db, 'attendance', `${todayDate}_${selectedCourseId}`));
        if (snap.exists()) {
          setAttendanceRecord(snap.data().records);
          setAttendanceSubmittedToday(true);
        } else {
          setAttendanceSubmittedToday(false);
          const initialRecord = {};
          courseStudents.forEach(student => {
            initialRecord[student.id] = approvedLeaves.includes(student.studentId) ? 'leave' : 'absent'; 
          });
          setAttendanceRecord(initialRecord);
        }
      };
      if(courseStudents.length > 0) fetchTodayAttendance();
      return () => unsubHistory();
    }
  }, [activeTab, selectedCourseId, courseStudents, approvedLeaves, todayDate]);

  const handleAttendanceTick = (studentId, isChecked) => {
    if (attendanceRecord[studentId] === 'leave' || attendanceSubmittedToday) return;
    setAttendanceRecord(prev => ({ ...prev, [studentId]: isChecked ? 'present' : 'absent' }));
  };

  const saveAttendance = async () => {
    showCustomDialog(
      "Confirm Attendance Submission",
      "Are you sure you want to submit today's attendance? You CANNOT edit this later.",
      "confirm",
      async () => {
        setLoading(true);
        try {
          const docId = `${todayDate}_${selectedCourseId}`;
          const batchWrite = writeBatch(db);
          batchWrite.set(doc(db, 'attendance', docId), {
            date: todayDate, courseId: selectedCourseId, batchId: activeCourse.batchId,
            recordedBy: teacherData.uid, records: attendanceRecord, updatedAt: serverTimestamp()
          });
          await batchWrite.commit();
          setAttendanceSubmittedToday(true);
          showMessage("Today's Attendance saved securely!", "success");
        } catch (error) { showMessage("Failed to save attendance.", "error"); }
        setLoading(false);
      }
    );
  };

  const getStudentAttStats = (studentId) => {
    let present = 0, totalClasses = courseAttendanceHistory.length;
    courseAttendanceHistory.forEach(day => {
      if (day.records && day.records[studentId] === 'present') present++;
    });
    const perc = totalClasses === 0 ? 0 : ((present / totalClasses) * 100).toFixed(2);
    return { present, totalClasses, perc };
  };

  // --- EXAM CONTROL LOGIC (AUTO LOCK & ADMIN UNLOCK SYSTEM) ---
  useEffect(() => {
    if (activeTab === 'exams' && selectedCourseId && courseStudents.length > 0) {
      const fetchCourseData = async () => {
        const snap = await getDoc(doc(db, 'courses', selectedCourseId));
        if (snap.exists() && snap.data().weightage) setWeightage(snap.data().weightage);
      };
      fetchCourseData();

      const fetchMarks = async () => {
        const snap = await getDoc(doc(db, 'marks', selectedCourseId));
        if (snap.exists()) {
          const data = snap.data();
          setMarksRecord(data.records || {});
          setInitialMarksRecord(JSON.parse(JSON.stringify(data.records || {}))); // Tracks locked fields
          setLocks(data.locks || { ct: false, mid: false, final: false }); // Database lock state
          setCtCount(data.ctCount || 1);
        } else {
          const initialMarks = {};
          courseStudents.forEach(s => { initialMarks[s.id] = { assign: '', midWritten: '', midViva: '', finalWritten: '', finalViva: '' }; });
          setMarksRecord(initialMarks);
          setInitialMarksRecord({});
          setLocks({ ct: false, mid: false, final: false });
          setCtCount(1);
        }
      };
      fetchMarks();
    }
  }, [activeTab, selectedCourseId, courseStudents]);

  const handleWeightageChange = (field, value) => setWeightage(prev => ({ ...prev, [field]: Number(value) }));
  
  const saveWeightage = async () => {
    const total = weightage.mid + weightage.final + weightage.ct + weightage.assign;
    if (total !== 100) return showCustomDialog("Invalid Weightage", `Total weightage must be exactly 100%! Current is ${total}%`, 'alert');
    
    showCustomDialog(
      "Confirm Weightage Setup", 
      `Are you sure you want to set the weightage total to ${total}%?`, 
      "confirm", 
      async () => {
        setLoading(true);
        try {
          await setDoc(doc(db, 'courses', selectedCourseId), { weightage }, { merge: true });
          showMessage("Weightage saved!", "success");
        } catch (e) { showMessage("Failed to save.", "error"); }
        setLoading(false);
      }
    );
  };

  const addCtColumn = () => { if (!locks.ct) setCtCount(prev => prev + 1); };

  const handleMarkChange = (studentId, field, value) => {
    let cleanValue = (value || '').replace(/^0+(?=\d)/, '');
    setMarksRecord(prev => ({ ...prev, [studentId]: { ...(prev[studentId] || {}), [field]: cleanValue } }));
  };

  // 🔥 100% FIXED LOCK LOGIC (Respects Admin Unlock)
  const isFieldLocked = (studentId, field) => {
    // 1. Identify category
    let isCt = field.startsWith('ct_') || field === 'assign';
    let isMid = field.startsWith('mid');
    let isFinal = field.startsWith('final');

    // 2. If Admin explicitly set the lock to FALSE, override and return false (EDITABLE)
    if (isCt && locks.ct === false) return false;
    if (isMid && locks.mid === false) return false;
    if (isFinal && locks.final === false) return false;

    // 3. Otherwise, check if it was previously saved
    const initVal = initialMarksRecord[studentId]?.[field];
    return initVal !== undefined && initVal !== '';
  };

  const executeMarksSave = async () => {
    showCustomDialog(
      "Lock & Save Marks", 
      "Any marks you entered will be PERMANENTLY locked and cannot be changed without Admin approval. Do you want to proceed?", 
      "confirm", 
      async () => {
        setLoading(true);
        try {
          // Re-lock all categories whenever they save new data
          const newLocks = { ct: true, mid: true, final: true };
          
          await setDoc(doc(db, 'marks', selectedCourseId), {
            courseId: selectedCourseId, batchId: activeCourse.batchId, records: marksRecord,
            ctCount: ctCount, locks: newLocks, updatedAt: serverTimestamp()
          }, { merge: true });
          
          // Update local state to reflect new locks
          setLocks(newLocks);
          setInitialMarksRecord(JSON.parse(JSON.stringify(marksRecord)));
          showMessage("Marks successfully updated and locked in the ledger!", "success");
        } catch (error) { showMessage("Failed to save marks.", "error"); }
        setLoading(false);
      }
    );
  };

  const requestUnlock = (examName) => {
    showCustomDialog("Request Unlock", `Ask System Admin to unlock ${examName} marks for editing?`, "confirm", async () => {
      try {
        await addDoc(collection(db, 'messages'), {
          senderId: auth.currentUser.uid, senderName: teacherData.name, role: 'teacher',
          message: `REQUEST UNLOCK: Please unlock the ${examName} marks for course: ${activeCourse?.name}.`,
          status: 'unread', createdAt: serverTimestamp()
        });
        showCustomDialog("Success", `Unlock request sent to Admin. You will be able to edit once approved.`, "alert");
      } catch (e) { showCustomDialog("Error", "Failed to send request.", "alert"); }
    });
  };

  const calculateScores = (studentId) => {
    const m = marksRecord[studentId];
    if (!m) return { rawTotal: 0, weightedTotal: 0 };
    
    let sumCt = 0;
    for(let i=1; i<=ctCount; i++) sumCt += Number(m[`ct_${i}`]) || 0;
    const avgCt = ctCount > 0 ? (sumCt / ctCount) : 0;
    
    const assign = Number(m.assign) || 0;
    const mw = Number(m.midWritten) || 0; const mv = Number(m.midViva) || 0;
    const fw = Number(m.finalWritten) || 0; const fv = Number(m.finalViva) || 0;

    const rawTotal = Math.round(sumCt + assign + mw + mv + fw + fv);

    const midTotal = ((mw + mv) / 100) * weightage.mid;
    const finalTotal = ((fw + fv) / 100) * weightage.final;
    const ctTotal = (avgCt / 100) * weightage.ct;
    const assignTotal = (assign / 100) * weightage.assign;
    const weightedTotal = Math.round(midTotal + finalTotal + ctTotal + assignTotal);

    return { rawTotal, weightedTotal };
  };

  // --- SETTINGS LOGIC (PASSWORD ERROR FIX) ---
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if(newPassword.length < 6) return showCustomDialog("Error", "Password must be at least 6 characters!", 'alert');
    
    showCustomDialog("Change Password", "Are you sure you want to change your password?", "confirm", async () => {
      setLoading(true);
      try { 
        await updatePassword(auth.currentUser, newPassword); 
        setNewPassword(''); 
        showMessage("Password updated successfully!", 'success'); 
      } catch (e) { 
        if (e.code === 'auth/requires-recent-login') {
          showCustomDialog("Security Alert", "For security reasons, you must log out and log back in to verify your identity before changing the password.", 'alert');
        } else {
          showCustomDialog("Error", e.message, 'alert'); 
        }
      }
      setLoading(false);
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault(); 
    showCustomDialog("Send Message", "Send this ticket to System Admin?", "confirm", async () => {
      setLoading(true);
      try {
        await addDoc(collection(db, 'messages'), { senderId: auth.currentUser.uid, senderName: teacherData.name, role: 'teacher', message: issueMsg, status: 'unread', createdAt: serverTimestamp() });
        setIssueMsg(''); showMessage("Message sent!", 'success');
      } catch (e) { showMessage("Failed to send.", 'error'); }
      setLoading(false);
    });
  };

  const handleLogout = () => {
    showCustomDialog("Logout", "Are you sure you want to logout?", "confirm", async () => {
      await signOut(auth); navigate('/');
    });
  };

  const navItems = [
    { id: 'home', name: 'Dashboard Home', icon: <LayoutDashboard size={20} /> },
    { id: 'attendance', name: 'Daily Attendance', icon: <CheckSquare size={20} /> },
    { id: 'exams', name: 'Exam & Marks', icon: <GraduationCap size={20} /> },
    { id: 'settings', name: 'Settings & Support', icon: <Settings size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 relative">
      
      {/* 🚀 Extreme A4 Print Shrink CSS */}
      <style type="text/css" media="print">
        {`
          @page { size: A4 landscape; margin: 5mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
          ::-webkit-scrollbar { display: none; }
          
          /* Forced layout to squeeze everything horizontally */
          .print-scalable-table {
             width: 100% !important;
             table-layout: fixed !important;
             border-collapse: collapse !important;
          }
          
          .print-scalable-table th, .print-scalable-table td { 
             padding: 2px !important; 
             border: 1px solid #475569 !important; 
             font-size: 8px !important; /* Extremely small text to fit matrix */
             color: #000 !important; 
             white-space: nowrap;
             overflow: hidden;
             text-align: center;
          }

          /* Name column needs a bit more space */
          .print-scalable-table th:first-child, .print-scalable-table td:first-child {
             width: 15% !important;
             text-align: left;
             white-space: normal !important;
          }

          input { border: none !important; background: transparent !important; text-align: center; width: 100% !important; font-size: 8px !important; padding: 0 !important; color: #000 !important; }
          
          .print-hidden { display: none !important; }
          
          /* Modal Print Logic */
          body.printing-modal .print-hide-when-modal { display: none !important; }
          body.printing-modal .print-only-modal { display: block !important; position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
        `}
      </style>

      {/* --- CUSTOM DIALOG UI --- */}
      {uiDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUiDialog({ ...uiDialog, isOpen: false })}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden animate-in zoom-in-95">
            <div className={`p-5 flex items-center space-x-3 border-b border-slate-100 ${uiDialog.type === 'alert' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>
              {uiDialog.type === 'alert' ? <AlertTriangle size={24}/> : <Info size={24}/>}
              <h2 className="text-lg font-bold">{uiDialog.title}</h2>
            </div>
            <div className="p-6 text-slate-600 font-medium leading-relaxed">{uiDialog.desc}</div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              {uiDialog.type === 'confirm' && (
                <button onClick={() => setUiDialog({ ...uiDialog, isOpen: false })} className="px-5 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
              )}
              <button onClick={() => {
                if (uiDialog.onConfirm) uiDialog.onConfirm();
                setUiDialog({ ...uiDialog, isOpen: false });
              }} className={`px-6 py-2 font-bold text-white rounded-xl shadow-md transition-all ${uiDialog.type === 'alert' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {uiDialog.type === 'alert' ? 'Okay' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] flex-col hidden md:flex z-20 shrink-0 shadow-xl border-r border-slate-800 print:hidden text-slate-300">
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-[#020617]">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mr-3 text-white font-bold text-xl">T</div>
          <div><h2 className="text-lg font-bold tracking-tight text-white">Faculty Portal</h2><p className="text-indigo-400 text-xs font-medium">CNIEDU</p></div>
        </div>
        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
              {item.icon} <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800 bg-[#020617]">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white px-4 py-3 rounded-xl transition-all font-bold">
            <LogOut size={18} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="relative w-64 bg-[#0f172a] h-full flex flex-col shadow-2xl animate-in slide-in-from-left text-slate-300">
            <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-6 right-4 text-slate-400"><X size={24}/></button>
            <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-[#020617]">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mr-3 text-white font-bold text-xl">T</div>
              <div><h2 className="text-lg font-bold tracking-tight text-white">Faculty Portal</h2></div>
            </div>
            <div className="flex-1 py-6 px-4 space-y-2">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium ${activeTab === item.id ? 'bg-indigo-600 text-white' : ''}`}>
                  {item.icon} <span>{item.name}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 bg-[#020617] mt-auto">
              <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white px-4 py-3 rounded-xl transition-all font-bold">
                <LogOut size={18} /><span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className={`flex-1 flex flex-col overflow-hidden w-full print:bg-white print:overflow-visible ${showAttReportModal ? 'print-hide-when-modal' : ''}`}>
        
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-sm print:hidden">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 bg-slate-100 rounded-lg md:hidden"><Menu size={20} /></button>
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold text-slate-900 capitalize">{navItems.find(n => n.id === activeTab)?.name}</h1>
              <p className="text-sm text-slate-500 font-medium">Manage your academic responsibilities</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{teacherData.name}</p>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">{teacherData.designation}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-xl flex items-center justify-center font-bold shadow-lg text-sm border border-indigo-400">
              {teacherInitials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 w-full print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto space-y-6">

            {message.text && (
              <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 print:hidden ${message.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {message.type === 'error' ? <AlertTriangle size={18}/> : <CheckCircle size={18}/>}
                <span>{message.text}</span>
              </div>
            )}

            {/* --- TAB 1: HOME DASHBOARD --- */}
            {activeTab === 'home' && (
              <div className="space-y-6 animate-in fade-in print:hidden">
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Welcome back, {teacherData.name}!</h1>
                  <p className="text-slate-500 mt-2 font-medium">Manage your classes, record marks, and view system updates.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {systemSettings.midtermOpen && (
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start space-x-4 shadow-sm">
                      <ShieldAlert className="text-amber-600 mt-1 shrink-0" size={24} />
                      <div><h3 className="font-bold text-amber-900">Midterm Portal Unlocked</h3><p className="text-sm text-amber-700 mt-1">Admin has enabled Midterm marks entry.</p></div>
                    </div>
                  )}
                  {systemSettings.finalOpen && (
                    <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-start space-x-4 shadow-sm">
                      <ShieldAlert className="text-emerald-600 mt-1 shrink-0" size={24} />
                      <div><h3 className="font-bold text-emerald-900">Final Exam Portal Unlocked</h3><p className="text-sm text-emerald-700 mt-1">Admin has enabled Final marks entry.</p></div>
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center"><BookOpen className="mr-2 text-indigo-600"/> My Courses</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedCourses.map(course => (
                      <div key={course.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{course.year}</span>
                          <h3 className="font-bold text-slate-900 mt-3 text-lg leading-tight">{course.name}</h3>
                          <p className="text-xs font-semibold text-slate-500 mt-2 flex items-center"><Users size={12} className="mr-1"/> Batch: {getBatchName(course.batchId)}</p>
                        </div>
                        <div className="flex space-x-2 mt-6">
                          <button onClick={() => { setSelectedCourseId(course.id); setActiveTab('attendance'); }} className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-xl font-bold text-xs">Attendance</button>
                          <button onClick={() => { setSelectedCourseId(course.id); setActiveTab('exams'); }} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 py-2 rounded-xl font-bold text-xs">Marks Entry</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: DAILY ATTENDANCE --- */}
            {activeTab === 'attendance' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between print:hidden">
                  <div className="w-full md:w-1/2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Course</label>
                    <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-700">
                      <option value="">-- Choose a course --</option>
                      {assignedCourses.map(c => <option key={c.id} value={c.id}>{c.name} ({getBatchName(c.batchId)})</option>)}
                    </select>
                  </div>
                  {selectedCourseId && (
                    <button onClick={() => {
                      document.body.classList.add('printing-modal');
                      setShowAttReportModal(true);
                    }} className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-3 rounded-xl font-bold transition-all shadow-sm">
                      <FileText size={18}/> <span>View Full Report</span>
                    </button>
                  )}
                </div>

                {selectedCourseId && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
                    
                    <div className="hidden print:block text-center mb-6 pt-4 border-b-2 border-slate-800 pb-4">
                      <h1 className="text-3xl font-bold uppercase tracking-widest text-slate-900">City Nursing Institute, Rangpur</h1>
                      <h2 className="text-xl font-bold text-slate-700 mt-2">Daily Attendance Roster</h2>
                      <div className="flex justify-between items-end mt-4 text-sm font-semibold text-slate-800 text-left">
                        <div><p>Course: <span className="text-indigo-700">{activeCourse?.name}</span></p><p>Batch: {getBatchName(activeCourse?.batchId)}</p></div>
                        <div className="text-right"><p>Faculty: {teacherData.name}</p><p>Date: {new Date().toLocaleDateString('en-GB')}</p></div>
                      </div>
                    </div>

                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center print:hidden">
                      <h3 className="font-bold text-slate-800 flex items-center">Attendance ({new Date().toLocaleDateString('en-GB')}) {attendanceSubmittedToday && <span className="ml-3 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">Locked</span>}</h3>
                      <div className="flex space-x-4 text-xs font-bold text-slate-600">
                        <span className="flex items-center"><div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center mr-1"><Check size={12} className="text-white"/></div> Present</span>
                        <span className="flex items-center"><div className="w-4 h-4 border-2 border-slate-300 rounded mr-1"></div> Absent</span>
                        <span className="text-amber-600">On Leave</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-sm text-slate-600 print:text-xs">
                        <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold print:bg-slate-200 print:text-slate-900">
                          <tr>
                            <th className="px-6 py-4 print:border-slate-800">Student Name</th>
                            <th className="px-6 py-4 text-center print:border-slate-800">Attendance</th>
                            <th className="px-6 py-4 text-center border-l border-slate-700 print:border-slate-800">Attended / Total</th>
                            <th className="px-6 py-4 text-center border-l border-slate-700 print:border-slate-800">Percentage</th>
                          </tr> 
                        </thead>
                        <tbody>
                          {courseStudents.map(student => {
                            const status = attendanceRecord[student.id];
                            const stats = getStudentAttStats(student.id);
                            return (
                              <tr key={student.id} className={`border-b border-slate-100 print:border-slate-800 ${status === 'leave' ? 'bg-amber-50/20' : 'hover:bg-slate-50'}`}>
                                <td className="px-6 py-4 print:border-slate-800">
                                  <p className="font-bold text-slate-900">{student.name}</p>
                                  <p className="font-mono text-[10px] text-slate-500">ID: {student.studentId}</p>
                                </td>
                                <td className="px-6 py-4 text-center print:border-slate-800">
                                  {status === 'leave' ? (
                                    <span className="inline-flex items-center text-amber-600 font-bold text-xs"><Clock size={14} className="mr-1"/> On Leave</span>
                                  ) : (
                                    <label className="relative inline-flex items-center cursor-pointer print:hidden">
                                      <input type="checkbox" disabled={attendanceSubmittedToday} checked={status === 'present'} onChange={(e) => handleAttendanceTick(student.id, e.target.checked)} className="sr-only peer" />
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${status === 'present' ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-2 border-slate-300 hover:border-indigo-400'} ${attendanceSubmittedToday ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {status === 'present' && <Check size={18} className="text-white"/>}
                                      </div>
                                    </label>
                                  )}
                                  <span className="hidden print:inline-block font-bold text-sm">{status === 'present' ? 'P' : status === 'absent' ? 'A' : 'L'}</span>
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-slate-700 border-l border-slate-100 print:border-slate-800">
                                  {stats.present} / {stats.totalClasses}
                                </td>
                                <td className="px-6 py-4 text-center border-l border-slate-100 print:border-slate-800">
                                  <span className={`px-3 py-1 rounded-lg font-bold text-xs ${stats.perc >= 60 ? 'bg-emerald-100 text-emerald-700 print:bg-transparent print:text-black' : 'bg-rose-100 text-rose-700 print:bg-transparent print:text-black'}`}>
                                    {stats.perc}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {courseStudents.length > 0 && !attendanceSubmittedToday && (
                      <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
                        <button onClick={saveAttendance} disabled={loading} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl shadow-md transition-all">
                          <Save size={18} /><span>Submit Today's Attendance</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 3: EXAM CONTROL & MARKS --- */}
            {activeTab === 'exams' && (
              <div className="space-y-6 animate-in fade-in w-full">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden flex justify-between flex-wrap gap-4">
                  <div className="w-full md:w-1/2">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Select Course</label>
                    <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700">
                      <option value="">-- Choose Course --</option>
                      {assignedCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {selectedCourseId && (
                    <button onClick={() => window.print()} className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all shadow-sm">
                      <Printer size={18}/> <span>Print Ledger</span>
                    </button>
                  )}
                </div>

                {selectedCourseId && courseStudents.length > 0 && (
                  <>
                    <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white print:hidden">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center"><Percent size={20} className="mr-2 text-indigo-400"/> Marks Distribution Setup</h3>
                        <div className={`px-3 py-1 rounded text-xs font-bold ${weightage.mid + weightage.final + weightage.ct + weightage.assign === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>Total: {weightage.mid + weightage.final + weightage.ct + weightage.assign}%</div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><label className="text-xs text-slate-400 block mb-1">Midterm (%)</label><input type="number" value={weightage.mid} onChange={e => handleWeightageChange('mid', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" /></div>
                        <div><label className="text-xs text-slate-400 block mb-1">Final (%)</label><input type="number" value={weightage.final} onChange={e => handleWeightageChange('final', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" /></div>
                        <div><label className="text-xs text-slate-400 block mb-1">Class Tests (%)</label><input type="number" value={weightage.ct} onChange={e => handleWeightageChange('ct', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" /></div>
                        <div><label className="text-xs text-slate-400 block mb-1">Assignments (%)</label><input type="number" value={weightage.assign} onChange={e => handleWeightageChange('assign', e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" /></div>
                      </div>
                      <button onClick={saveWeightage} disabled={loading || (weightage.mid + weightage.final + weightage.ct + weightage.assign !== 100)} className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition-all">Save Marks Distribution Rule</button>
                    </div>

                    {(!systemSettings.midtermOpen || !systemSettings.finalOpen) && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl flex items-start space-x-3 text-sm print:hidden">
                        <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                        <div><p className="font-bold">System Admin Locks Active:</p><p>{!systemSettings.midtermOpen && "• Midterm disabled. "} {!systemSettings.finalOpen && "• Final disabled."}</p></div>
                      </div>
                    )}

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-none">
                      
                      <div className="hidden print:block text-center mb-6 pt-4 border-b-2 border-slate-800 pb-4">
                        <h1 className="text-3xl font-bold uppercase tracking-widest text-slate-900">City Nursing Institute, Rangpur</h1>
                        <h2 className="text-xl font-bold text-slate-700 mt-2">Official Result Ledger</h2>
                        <div className="flex justify-between items-end mt-6 text-sm font-semibold text-slate-800 text-left">
                          <div><p className="text-lg">Course: <span className="text-indigo-700">{activeCourse?.name}</span></p><p>Batch: {getBatchName(activeCourse?.batchId)}</p><p className="mt-1">Faculty: {teacherData.name}</p></div>
                          <div className="text-right">
                            <p>Date: {new Date().toLocaleDateString('en-GB')}</p>
                            <p className="mt-1 bg-slate-100 px-2 py-0.5 border border-slate-300">Weightage: Mid {weightage.mid}% | Fin {weightage.final}% | CT {weightage.ct}% | Asg {weightage.assign}%</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3 print:hidden">
                        <div className="flex space-x-2">
                           <button onClick={() => requestUnlock('Class Tests')} className="flex items-center text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition-all"><Unlock size={14} className="mr-1"/> Request CT Edit</button>
                           <button onClick={() => requestUnlock('Midterm')} className="flex items-center text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition-all"><Unlock size={14} className="mr-1"/> Request Mid Edit</button>
                           <button onClick={() => requestUnlock('Final')} className="flex items-center text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition-all"><Unlock size={14} className="mr-1"/> Request Final Edit</button>
                        </div>
                        <button onClick={addCtColumn} disabled={locks.ct} className="flex items-center space-x-1 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-indigo-200 disabled:opacity-50">
                          <PlusCircle size={16}/> <span>Add New Class Test</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto w-full pb-4">
                        <table className="print-scalable-table">
                          <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider print:bg-slate-200 print:text-slate-900">
                            <tr>
                              <th className="px-4 py-3 sticky left-0 z-10 bg-slate-900 print:bg-transparent print:border-slate-800">Student Name</th>
                              {Array.from({length: ctCount}).map((_, idx) => (
                                <th key={`ct_th_${idx}`} className="px-2 py-3 text-center border-x border-slate-700 bg-slate-800 print:border-slate-800 print:bg-transparent">CT {idx+1}</th>
                              ))}
                              <th className="px-2 py-3 text-center border-x border-slate-700 bg-slate-800 print:border-slate-800 print:bg-transparent">Assign</th>
                              <th className="px-2 py-3 text-center border-x border-slate-700 print:border-slate-800 print:bg-transparent">Mid Writ</th>
                              <th className="px-2 py-3 text-center border-x border-slate-700 print:border-slate-800 print:bg-transparent">Mid Viva</th>
                              <th className="px-2 py-3 text-center border-x border-slate-700 bg-slate-800 print:border-slate-800 print:bg-transparent">Fin Writ</th>
                              <th className="px-2 py-3 text-center border-x border-slate-700 bg-slate-800 print:border-slate-800 print:bg-transparent">Fin Viva</th>
                              <th className="px-3 py-3 text-center bg-slate-700 print:border-slate-800 print:bg-transparent">Total</th>
                              <th className="px-3 py-3 text-center bg-indigo-700 print:border-slate-800 print:bg-transparent">Weigh%</th>
                              <th className="px-3 py-3 text-center bg-indigo-800 print:border-slate-800 print:bg-transparent">Res</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courseStudents.map(student => {
                              const m = marksRecord[student.id] || { assign: '', midWritten: '', midViva: '', finalWritten: '', finalViva: '' };
                              const { rawTotal, weightedTotal } = calculateScores(student.id);
                              const isPass = weightedTotal >= 60;

                              return (
                                <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 print:border-slate-800">
                                  <td className="px-4 py-3 sticky left-0 z-10 bg-white border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none print:border-slate-800">
                                    <p className="font-bold text-slate-900 truncate max-w-[150px] print:max-w-full">{student.name}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">ID: {student.studentId}</p>
                                  </td>
                                  
                                  {Array.from({length: ctCount}).map((_, idx) => (
                                    <td key={`ct_td_${idx}`} className="px-1 py-3 text-center bg-slate-50 print:border-slate-800 print:p-1">
                                      <input type="number" disabled={isFieldLocked(student.id, `ct_${idx+1}`)} value={m[`ct_${idx+1}`] ?? ''} onChange={e => handleMarkChange(student.id, `ct_${idx+1}`, e.target.value)} className="w-12 bg-white border border-slate-200 rounded p-1 text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 print:border-none print:w-auto print:p-0 font-semibold text-slate-700" />
                                    </td>
                                  ))}

                                  <td className="px-1 py-3 text-center bg-slate-50 print:border-slate-800 print:p-1"><input type="number" disabled={isFieldLocked(student.id, 'assign')} value={m.assign ?? ''} onChange={e => handleMarkChange(student.id, 'assign', e.target.value)} className="w-12 bg-white border border-slate-200 rounded p-1 text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 print:border-none print:w-auto font-semibold text-slate-700" /></td>
                                  
                                  <td className="px-1 py-3 text-center border-l border-slate-100 print:border-slate-800 print:p-1"><input type="number" disabled={!systemSettings.midtermOpen || isFieldLocked(student.id, 'midWritten')} value={m.midWritten ?? ''} onChange={e => handleMarkChange(student.id, 'midWritten', e.target.value)} className="w-12 bg-white border border-slate-200 rounded p-1 text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 print:border-none print:w-auto font-semibold text-slate-700" /></td>
                                  <td className="px-1 py-3 text-center print:border-slate-800 print:p-1"><input type="number" disabled={!systemSettings.midtermOpen || isFieldLocked(student.id, 'midViva')} value={m.midViva ?? ''} onChange={e => handleMarkChange(student.id, 'midViva', e.target.value)} className="w-12 bg-white border border-slate-200 rounded p-1 text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 print:border-none print:w-auto font-semibold text-slate-700" /></td>
                                  
                                  <td className="px-1 py-3 text-center bg-slate-50 border-l border-slate-100 print:border-slate-800 print:p-1"><input type="number" disabled={!systemSettings.finalOpen || isFieldLocked(student.id, 'finalWritten')} value={m.finalWritten ?? ''} onChange={e => handleMarkChange(student.id, 'finalWritten', e.target.value)} className="w-12 bg-white border border-slate-200 rounded p-1 text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 print:border-none print:w-auto font-semibold text-slate-700" /></td>
                                  <td className="px-1 py-3 text-center bg-slate-50 print:border-slate-800 print:p-1"><input type="number" disabled={!systemSettings.finalOpen || isFieldLocked(student.id, 'finalViva')} value={m.finalViva ?? ''} onChange={e => handleMarkChange(student.id, 'finalViva', e.target.value)} className="w-12 bg-white border border-slate-200 rounded p-1 text-center outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 print:border-none print:w-auto font-semibold text-slate-700" /></td>
                                  
                                  <td className="px-3 py-3 text-center font-bold text-slate-500 border-l border-slate-200 print:border-slate-800">{rawTotal}</td>
                                  <td className="px-3 py-3 text-center font-bold text-lg text-slate-900 border-l border-slate-200 print:border-slate-800">{weightedTotal}%</td>
                                  <td className="px-4 py-3 text-center print:border-slate-800"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{isPass ? 'Pass' : 'Fail'}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end print:hidden">
                        <button onClick={executeMarksSave} disabled={loading || (weightage.mid + weightage.final + weightage.ct + weightage.assign !== 100)} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-8 py-3 rounded-xl shadow-md transition-all">
                          <Save size={18} /><span>Save Marks</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- TAB 4: SETTINGS & SUPPORT --- */}
            {activeTab === 'settings' && (
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in print:hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 rounded-2xl shadow-lg text-white flex items-center space-x-6">
                   <div className="w-20 h-20 bg-white text-indigo-700 rounded-full flex items-center justify-center text-3xl font-bold shadow-inner">{teacherInitials}</div>
                   <div>
                     <h2 className="text-2xl font-bold">{teacherData.name}</h2>
                     <p className="text-indigo-200 font-medium">{teacherData.designation}</p>
                     <p className="text-xs mt-2 bg-indigo-500/30 inline-block px-3 py-1 rounded-full uppercase tracking-wider">System Access: Faculty Level</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h2 className="text-xl font-bold flex items-center mb-6"><Lock size={20} className="mr-2 text-indigo-600"/> Security Setup</h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password (Min 6 chars)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                      <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all">Update System Password</button>
                    </form>
                  </div>

                  <div className="bg-indigo-50 p-6 md:p-8 rounded-2xl border border-indigo-100 shadow-sm">
                    <h2 className="text-xl font-bold flex items-center mb-6 text-indigo-900"><Send size={20} className="mr-2 text-indigo-600"/> Support Desk</h2>
                    <form onSubmit={handleSendMessage} className="space-y-4">
                      <textarea required value={issueMsg} onChange={e => setIssueMsg(e.target.value)} rows="4" placeholder="Report an issue to System Admin (e.g. Please unlock Midterm marks for Anatomy)..." className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none"></textarea>
                      <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all">Submit Support Ticket</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* --- ATTENDANCE REPORT MODAL (PRINT SPECIFIC) --- */}
      {showAttReportModal && selectedCourseId && (
        <div className="print-only-modal">
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static print:inset-auto print:p-0 print:block">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden" onClick={() => {
              document.body.classList.remove('printing-modal');
              setShowAttReportModal(false);
            }}></div>
            
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl z-10 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 print:shadow-none print:max-h-none print:border-none print:overflow-visible">
              
              <div className="flex justify-between items-center p-6 border-b border-slate-100 print:hidden">
                <h2 className="text-xl font-bold text-slate-900">Attendance History Report</h2>
                <div className="flex space-x-3">
                  <button onClick={() => window.print()} className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold transition-all"><Printer size={16}/> <span>Print Format</span></button>
                  <button onClick={() => {
                    document.body.classList.remove('printing-modal');
                    setShowAttReportModal(false);
                  }} className="text-slate-400 hover:bg-slate-100 p-2 rounded-lg"><X size={20}/></button>
                </div>
              </div>
              
              <div className="p-8 overflow-auto flex-1 bg-white print:p-0 print:overflow-visible">
                
                {/* PRINT HEADER FOR MODAL */}
                <div className="hidden print:block text-center mb-8 border-b-2 border-slate-800 pb-6">
                  <h1 className="text-3xl font-bold uppercase tracking-widest text-slate-900">City Nursing Institute, Rangpur</h1>
                  <h2 className="text-xl font-bold text-slate-700 mt-2">Official Attendance Report</h2>
                  <div className="flex justify-between items-end mt-6 text-sm font-semibold text-slate-800 text-left">
                    <div>
                      <p className="text-lg">Course: <span className="text-indigo-700">{activeCourse?.name}</span></p>
                      <p className="mt-1">Batch: {getBatchName(activeCourse?.batchId)}</p>
                    </div>
                    <div className="text-right">
                      <p>Faculty Name: {teacherData.name}</p>
                      <p className="mt-1">Total Classes Taken: <span className="bg-slate-100 px-2 py-0.5 border border-slate-300">{courseAttendanceHistory.length}</span></p>
                      <p className="mt-1">Date Generated: {new Date().toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                </div>

                <table className="print-scalable-table">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0 print:bg-slate-200 print:text-slate-900 print:static">
                    <tr>
                      <th className="px-4 py-3 bg-slate-50 border border-slate-200 print:border-slate-800">Student Name</th>
                      {courseAttendanceHistory.map(day => (
                        <th key={day.date} className="px-2 py-3 text-center border border-slate-200 bg-slate-50 print:border-slate-800">{day.date}</th>
                      ))}
                      <th className="px-3 py-3 text-center bg-indigo-50 text-indigo-700 border border-slate-200 print:border-slate-800">Attended</th>
                      <th className="px-3 py-3 text-center bg-indigo-50 text-indigo-700 border border-slate-200 print:border-slate-800">Total</th>
                      <th className="px-3 py-3 text-center bg-slate-900 text-white border border-slate-200 print:border-slate-800">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseStudents.map(student => {
                      const stats = getStudentAttStats(student.id);
                      return (
                        <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 print:border-slate-800">
                          <td className="px-4 py-3 font-bold text-slate-900 sticky left-0 bg-white border border-slate-200 print:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none print:static">
                            {student.name} <br/><span className="text-[10px] text-slate-400 font-mono">ID: {student.studentId}</span>
                          </td>
                          {courseAttendanceHistory.map(day => {
                            const status = day.records && day.records[student.id];
                            return (
                              <td key={day.date} className="px-2 py-3 text-center border border-slate-100 print:border-slate-800 print:p-2">
                                {status === 'present' ? <span className="text-emerald-500 font-bold">P</span> : status === 'absent' ? <span className="text-rose-500 font-bold">A</span> : status === 'leave' ? <span className="text-amber-500 font-bold">L</span> : '-'}
                              </td>
                            )
                          })}
                          <td className="px-3 py-3 text-center font-bold border border-slate-100 print:border-slate-800">{stats.present}</td>
                          <td className="px-3 py-3 text-center font-bold text-slate-500 border border-slate-100 print:border-slate-800">{stats.totalClasses}</td>
                          <td className="px-3 py-3 text-center font-bold border border-slate-100 print:border-slate-800">
                            <span className={`px-2 py-1 rounded text-[10px] ${stats.perc >= 60 ? 'bg-emerald-100 text-emerald-700 print:bg-transparent print:text-slate-900' : 'bg-rose-100 text-rose-700 print:bg-transparent print:text-slate-900'}`}>
                              {stats.perc}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {courseStudents.length === 0 && <tr><td colSpan="100%" className="p-8 text-center text-slate-400">No attendance data found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
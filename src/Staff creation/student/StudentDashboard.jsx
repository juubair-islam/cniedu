import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, doc, getDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, LogOut, Menu, X, BookOpen, GraduationCap, 
  AlertTriangle, CheckCircle, Clock, ShieldAlert, Settings, 
  Wallet, FileCheck, CalendarOff, Send, Info, CheckSquare, DollarSign, Bell, CalendarRange, Activity, FileText, HelpCircle, Printer, Lock, Award
} from 'lucide-react';

export default function StudentDashboard() {
  const navigate = useNavigate();
  
  // Layout & Auth States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [studentData, setStudentData] = useState({ name: 'Loading...', studentId: '', batchId: '', uid: '', status: 'Active' });
  const [completionDate, setCompletionDate] = useState('');
  const [studentInitials, setStudentInitials] = useState('ST');
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Notification Banner State
  const [activeBanner, setActiveBanner] = useState(null);

  // Custom UI Dialog
  const [uiDialog, setUiDialog] = useState({ isOpen: false, title: '', desc: '', type: 'confirm', onConfirm: null });

  // Core Data States
  const [batchName, setBatchName] = useState('Loading...');
  const [batchYear, setBatchYear] = useState('');
  const [courses, setCourses] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [marksData, setMarksData] = useState([]);

  // Leave Form State
  const [leaveForm, setLeaveForm] = useState({ fromDate: '', toDate: '', reason: '' });
  const [newPassword, setNewPassword] = useState('');

  const showCustomDialog = (title, desc, type = 'confirm', onConfirm = null) => {
    setUiDialog({ isOpen: true, title, desc, type, onConfirm });
  };
  const showMessage = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 4000); };

  // --- SMART PREVIOUS PAGE NAVIGATION ---
  const tabHistory = useRef(['home']);
  const isBackNavigation = useRef(false);

  useEffect(() => {
    if (isBackNavigation.current) {
      isBackNavigation.current = false;
      return;
    }
    if (tabHistory.current[tabHistory.current.length - 1] !== activeTab) {
      tabHistory.current.push(activeTab);
      window.history.pushState(null, null, window.location.pathname);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleBackButton = () => {
      if (tabHistory.current.length > 1) {
        tabHistory.current.pop(); 
        const prevTab = tabHistory.current[tabHistory.current.length - 1]; 
        isBackNavigation.current = true;
        setActiveTab(prevTab);
      } else {
        window.history.pushState(null, null, window.location.pathname);
        showCustomDialog(
          "Exit Confirmation", 
          "Do you want to log out from the portal securely?", 
          "confirm", 
          async () => {
             await signOut(auth); 
             navigate('/');
          }
        );
      }
    };

    window.history.pushState(null, null, window.location.pathname);
    window.addEventListener('popstate', handleBackButton);
    return () => window.removeEventListener('popstate', handleBackButton);
  }, [navigate]);


  // --- DATA INITIALIZATION ---
  useEffect(() => {
    let unSubCourses = () => {};
    let unSubFinances = () => {};
    let unSubAttendance = () => {};
    let unSubLeaves = () => {};
    let unSubMarks = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
         if (docSnap.exists() && docSnap.data().role === 'student') {
            const data = docSnap.data();
            setStudentData({ 
              name: data.name, 
              studentId: data.studentId, 
              batchId: data.batchId, 
              uid: user.uid, 
              status: data.status || 'Active'
            });

            if (data.status === 'Alumni' && data.updatedAt) {
              const dateObj = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
              setCompletionDate(dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
            } else {
              setCompletionDate(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
            }
            
            const nameParts = data.name.split(' ');
            setStudentInitials(nameParts.length > 1 ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() : data.name.substring(0, 2).toUpperCase());

            if (data.batchId) {
              const batchSnap = await getDoc(doc(db, 'batches', data.batchId));
              if (batchSnap.exists()) {
                setBatchName(batchSnap.data().name);
                setBatchYear(batchSnap.data().year || 'Unknown Year');
              }
            }

            unSubCourses = onSnapshot(query(collection(db, 'courses'), where('batchId', '==', data.batchId)), (snap) => {
              setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });

            unSubFinances = onSnapshot(doc(db, 'financials', user.uid), (snap) => {
              if (snap.exists()) setFinancials(snap.data());
              else setFinancials({ totalCourseFee: 0, admissionFeePaid: 0, monthlyPaidTotal: 0, finesTotal: 0, finesPaid: 0, payments: [] });
            });

            unSubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
              setAttendanceData(snap.docs.map(d => d.data()));
            });

            unSubLeaves = onSnapshot(query(collection(db, 'leaves'), where('studentId', '==', user.uid)), (snap) => {
              setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            });

            unSubMarks = onSnapshot(query(collection(db, 'marks'), where('batchId', '==', data.batchId)), (snap) => {
              setMarksData(snap.docs.map(d => ({ courseId: d.id, ...d.data() })));
            });

          } else {
            signOut(auth); navigate('/');
          }
        } catch (error) { console.error(error); }
      } else { navigate('/'); }
    });

    return () => { 
      unsubscribeAuth(); unSubCourses(); unSubFinances(); unSubAttendance(); unSubLeaves(); unSubMarks(); 
    };
  }, [navigate]);


  // --- COMPUTE EXACT TOTAL APPROVED LEAVES ---
  const totalApprovedLeaves = useMemo(() => {
    return leaveRequests
      .filter(l => l.status === 'Approved')
      .reduce((sum, l) => sum + (l.totalDays || 0), 0);
  }, [leaveRequests]);

  // --- COMPUTE ATTENDANCE PERCENTAGE ---
  const attStats = useMemo(() => {
    if (!studentData.uid || attendanceData.length === 0) return { present: 0, absent: 0, leave: 0, totalDays: 0, perc: 0, effectiveDays: 0, missedDates: [] };
    
    const dailyRecords = {};
    attendanceData.forEach(record => {
      if (record.records && record.records[studentData.uid]) {
        if (!dailyRecords[record.date]) dailyRecords[record.date] = [];
        dailyRecords[record.date].push(record.records[studentData.uid]);
      }
    });

    let present = 0, absent = 0, teacherMarkedLeave = 0;
    let missedDates = [];
    const totalDays = Object.keys(dailyRecords).length;

    Object.keys(dailyRecords).forEach(date => {
      const statuses = dailyRecords[date];
      const totalSessions = statuses.length;
      let pCount = 0, lCount = 0;

      statuses.forEach(s => {
        if (s === 'present') pCount++;
        else if (s === 'leave') lCount++;
      });

      if (lCount > 0) {
        teacherMarkedLeave++; 
      } else if (pCount >= Math.ceil(totalSessions / 2)) {
        present++;
      } else {
        absent++;
        missedDates.push(date);
      }
    });

    const effectiveDays = totalDays - teacherMarkedLeave;
    const perc = effectiveDays === 0 ? 0 : Math.round((present / effectiveDays) * 100);

    return { present, absent, totalDays, perc, effectiveDays, missedDates: missedDates.sort() };
  }, [attendanceData, studentData.uid]);

  const formatMissedDates = (datesArr) => {
    return datesArr.map(d => {
      const [y, m, day] = d.split('-');
      const dateObj = new Date(y, m - 1, day);
      return `${Number(day)} ${dateObj.toLocaleString('en-US', {month: 'short'})}`;
    }).join(', ');
  };

  const getCourseAttendance = (courseId) => {
    let totalSessions = 0;
    let attended = 0;

    attendanceData.forEach(record => {
      if (record.courseId === courseId && record.records && record.records[studentData.uid]) {
        totalSessions++;
        if (record.records[studentData.uid] === 'present') attended++;
      }
    });

    const perc = totalSessions === 0 ? 0 : Math.round((attended / totalSessions) * 100);
    return { attended, totalSessions, perc };
  };

  // --- COMPUTE FINANCES ---
  const fineDue = useMemo(() => {
    if (!financials) return 0;
    return (financials.finesTotal || 0) - (financials.finesPaid || 0);
  }, [financials]);

  const totalCourseFeesPaid = useMemo(() => {
    if (!financials) return 0;
    return (financials.admissionFeePaid || 0) + (financials.monthlyPaidTotal || 0);
  }, [financials]);

  const courseFeeDue = useMemo(() => {
    if (!financials) return 0;
    const due = (financials.totalCourseFee || 0) - totalCourseFeesPaid;
    return due > 0 ? due : 0;
  }, [financials, totalCourseFeesPaid]);

  const isExamCleared = useMemo(() => {
    if (!financials) return false;
    return (attStats.perc >= 80 && fineDue <= 0) || financials.manualClearance === true;
  }, [attStats.perc, fineDue, financials]);

  const pendingLeaveExists = useMemo(() => {
    return leaveRequests.some(l => l.status === 'Pending');
  }, [leaveRequests]);

  // --- STRICT & SMART NOTIFICATIONS ---
  const notifications = useMemo(() => {
    if (studentData.status === 'Alumni') return [];

    let notes = [];
    
    if (fineDue > 0) {
      notes.push({ id: 'fine_alert', type: 'warning', msg: `Attention: You have fine of ৳${fineDue}. You cannot attend exams until this is cleared.`, time: Date.now() });
    }
    
    leaveRequests.filter(l => l.status !== 'Pending').slice(0, 3).forEach(l => {
      const time = l.updatedAt?.toMillis ? l.updatedAt.toMillis() : Date.now();
      if (l.status === 'Approved') notes.push({ id: `leave_${l.id}`, type: 'success', msg: `Leave approved from ${l.fromDate} to ${l.toDate}.`, time });
      if (l.status === 'Rejected') notes.push({ id: `leave_${l.id}`, type: 'error', msg: `Leave request for ${l.fromDate} was rejected.`, time });
    });

    marksData.forEach(m => {
      const c = courses.find(course => course.id === m.courseId);
      if (c && m.locks && (m.locks.ct || m.locks.mid || m.locks.final)) {
         notes.push({ id: `mark_${m.courseId}`, type: 'info', msg: `New exam marks have been officially published for ${c.name}.`, time: m.updatedAt?.toMillis() || Date.now() });
      }
    });

    if (financials?.payments) {
      financials.payments.slice(0, 3).forEach(p => { 
         const pTime = new Date(p.timestamp).getTime() || Date.now();
         notes.push({ id: `pay_${p.id}`, type: 'success', msg: `Payment of ৳${p.amount} received for ${p.type} on ${p.date}.`, time: pTime });
      });
    }

    return notes.sort((a, b) => b.time - a.time);
  }, [fineDue, leaveRequests, marksData, courses, financials, studentData.status]);


  // --- REAL-TIME ONE-TIME BANNER LOGIC ---
  useEffect(() => {
    if (studentData.uid && notifications.length > 0 && studentData.status !== 'Alumni') {
      const latestNote = notifications[0];
      const seenKey = `seen_note_${studentData.uid}_${latestNote.id}`;
      
      if (!sessionStorage.getItem(seenKey)) {
        setActiveBanner(latestNote);
        sessionStorage.setItem(seenKey, 'true');
      }
    }
  }, [notifications, studentData.uid, studentData.status]);


  // --- LEAVE APPLICATION ---
  const calculateDays = (start, end) => {
    if(!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (d2 < d1) return 0;
    return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  };

  const submitLeaveRequest = async (e) => {
    e.preventDefault();
    if (!leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason) return showMessage("Please fill in all fields.", "error");
    const totalDays = calculateDays(leaveForm.fromDate, leaveForm.toDate);
    if (totalDays <= 0) return showMessage("Invalid date range.", "error");

    showCustomDialog("Submit Leave", `Apply for ${totalDays} day(s) leave?`, "confirm", async () => {
      setLoading(true);
      try {
        await addDoc(collection(db, 'leaves'), {
          studentId: studentData.uid,
          studentName: studentData.name,
          batchId: studentData.batchId,
          fromDate: leaveForm.fromDate,
          toDate: leaveForm.toDate,
          totalDays: totalDays,
          reason: leaveForm.reason,
          status: 'Pending',
          createdAt: serverTimestamp()
        });
        setLeaveForm({ fromDate: '', toDate: '', reason: '' });
        showMessage("Leave request submitted successfully. Awaiting approval.", "success");
      } catch (error) { showMessage("Failed to submit request.", "error"); }
      setLoading(false);
    });
  };

  // --- CALCULATE MARKS ---
  const getStudentMarksForCourse = (courseId) => {
    const courseMarkDoc = marksData.find(m => m.courseId === courseId);
    if (!courseMarkDoc || !courseMarkDoc.records || !courseMarkDoc.records[studentData.uid]) return null;

    const courseDetails = courses.find(c => c.id === courseId);
    const weightage = courseDetails?.weightage || { mid: 30, final: 40, ct: 20, assign: 10 };
    const m = courseMarkDoc.records[studentData.uid];
    const ctCount = courseMarkDoc.ctCount || 1;

    let sumCt = 0;
    let individualCTs = [];
    for(let i=1; i<=ctCount; i++) {
        let val = Number(m[`ct_${i}`]) || 0;
        sumCt += val;
        individualCTs.push(val);
    }
    const avgCt = ctCount > 0 ? (sumCt / ctCount) : 0;
    
    const assign = Number(m.assign) || 0;
    const mw = Number(m.midWritten) || 0; const mv = Number(m.midViva) || 0;
    const fw = Number(m.finalWritten) || 0; const fv = Number(m.finalViva) || 0;

    const midTotal = ((mw + mv) / 100) * weightage.mid;
    const finalTotal = ((fw + fv) / 100) * weightage.final;
    const ctTotal = (avgCt / 100) * weightage.ct;
    const assignTotal = (assign / 100) * weightage.assign;
    const weightedTotal = Math.round(midTotal + finalTotal + ctTotal + assignTotal);

    return { 
      raw: { sumCt, avgCt, individualCTs, assign, mw, mv, fw, fv },
      weightedTotal,
      isPass: weightedTotal >= 60,
      locks: courseMarkDoc.locks || { ct: false, mid: false, final: false }
    };
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if(newPassword.length < 6) return showCustomDialog("Error", "Password must be at least 6 characters.", 'alert');
    showCustomDialog("Change Password", "Are you sure you want to change your password?", "confirm", async () => {
      setLoading(true);
      try { 
        await updatePassword(auth.currentUser, newPassword); 
        setNewPassword(''); 
        showMessage("Password updated successfully!", 'success'); 
      } catch (e) { 
        if (e.code === 'auth/requires-recent-login') showCustomDialog("Security Alert", "Please log out and log back in to verify your identity before changing password.", 'alert');
        else showCustomDialog("Error", e.message, 'alert'); 
      }
      setLoading(false);
    });
  };

  const handleLogout = () => { showCustomDialog("Logout", "Are you sure you want to logout?", "confirm", async () => { await signOut(auth); navigate('/'); }); };

  const navItems = [
    { id: 'home', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'academic', name: 'Official Results', icon: <GraduationCap size={20} /> },
    { id: 'attendance', name: 'Attendance Portal', icon: <CheckSquare size={20} /> },
    { id: 'financials', name: 'Financial Ledger', icon: <Wallet size={20} /> },
    { id: 'clearance', name: 'Exam Clearance', icon: <FileCheck size={20} /> },
    { id: 'leaves', name: 'Leave Application', icon: <CalendarOff size={20} /> },
    { id: 'settings', name: 'Security Settings', icon: <Settings size={20} /> },
    { id: 'guide', name: 'Help & Support', icon: <HelpCircle size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 relative">

      <style type="text/css" media="print">
        {`
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
          ::-webkit-scrollbar { display: none; }
        `}
      </style>
      
      {uiDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setUiDialog({ ...uiDialog, isOpen: false })}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 overflow-hidden animate-in zoom-in-95">
            <div className={`p-5 flex items-center space-x-3 border-b border-slate-100 ${uiDialog.type === 'alert' ? 'bg-rose-50 text-rose-700' : 'bg-cyan-50 text-cyan-700'}`}>
              {uiDialog.type === 'alert' ? <AlertTriangle size={24}/> : <Info size={24}/>}
              <h2 className="text-lg font-bold">{uiDialog.title}</h2>
            </div>
            <div className="p-6 text-slate-600 font-medium leading-relaxed">{uiDialog.desc}</div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              {uiDialog.type === 'confirm' && (
                <button onClick={() => setUiDialog({ ...uiDialog, isOpen: false })} className="px-5 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
              )}
              <button onClick={() => { if (uiDialog.onConfirm) uiDialog.onConfirm(); setUiDialog({ ...uiDialog, isOpen: false }); }} className={`px-6 py-2 font-bold text-white rounded-xl shadow-md transition-all ${uiDialog.type === 'alert' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                {uiDialog.type === 'alert' ? 'Okay' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR (DESKTOP) */}
      <aside className="w-64 bg-slate-900 flex-col hidden md:flex z-20 shrink-0 shadow-xl text-slate-300">
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950">
          <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center mr-3 text-white font-bold text-xl">S</div>
          <div><h2 className="text-lg font-bold tracking-tight text-white">Student Portal</h2><p className="text-cyan-400 text-xs font-medium">CNIEDU</p></div>
        </div>
        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === item.id ? 'bg-cyan-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
              {item.icon} <span>{item.name}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-950 mt-auto">
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white px-4 py-3 rounded-xl transition-all font-bold">
            <LogOut size={18} /><span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MOBILE SIDEBAR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <aside className="relative w-64 bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-left text-slate-300">
            <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950 justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center mr-3 text-white font-bold text-sm">S</div>
                <h2 className="text-base font-bold text-white">Student Portal</h2>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white"><X size={24}/></button>
            </div>
            <div className="flex-1 py-4 px-3 space-y-2 overflow-y-auto">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium ${activeTab === item.id ? 'bg-cyan-600 text-white' : ''}`}>
                  {item.icon} <span>{item.name}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950 mt-auto">
              <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 px-4 py-3 rounded-xl transition-all font-bold">
                <LogOut size={18} /><span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Top Header */}
        <header className="min-h-[80px] py-3 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3 shrink-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg md:hidden transition-colors shrink-0">
              <Menu size={20} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900 capitalize">{navItems.find(n => n.id === activeTab)?.name}</h1>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-4 justify-end flex-1 pl-3">
            <div className="text-right flex flex-col items-end justify-center">
              
              <p className="text-sm font-bold text-slate-900 leading-tight mb-1.5 break-words text-right">
                {studentData.name}
              </p>
              
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <p className="text-[10px] sm:text-[11px] font-bold text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded uppercase tracking-wider text-right shadow-sm sm:shadow-none">
                  {batchName}
                </p>
                {studentData.status === 'Alumni' ? (
                  <p className="text-[10px] sm:text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider text-right shadow-sm animate-pulse">
                    Alumni / Graduated
                  </p>
                ) : (
                  <p className="text-[10px] sm:text-[11px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded uppercase tracking-wider text-right shadow-sm sm:shadow-none">
                    {batchYear}
                  </p>
                )}
              </div>

            </div>
            
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-600 to-blue-500 text-white rounded-xl flex items-center justify-center font-bold shadow-md text-sm border border-cyan-400 shrink-0">
              {studentInitials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 w-full">
          <div className="max-w-6xl mx-auto space-y-6">

            {message.text && (
              <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 ${message.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {message.type === 'error' ? <AlertTriangle size={18}/> : <CheckCircle size={18}/>}
                <span>{message.text}</span>
              </div>
            )}

            {/* --- TAB 1: HOME DASHBOARD --- */}
            {activeTab === 'home' && (
              <div className="space-y-6 animate-in fade-in">
                
                {/* 🚨 SMART ONE-TIME BANNER */}
                {studentData.status !== 'Alumni' && activeBanner && (
                  <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border animate-in slide-in-from-top-4 ${
                    activeBanner.type === 'warning' || activeBanner.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 
                    activeBanner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
                    'bg-cyan-50 border-cyan-200 text-cyan-800'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeBanner.type === 'warning' || activeBanner.type === 'error' ? 'bg-rose-400' : activeBanner.type === 'success' ? 'bg-emerald-400' : 'bg-cyan-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${activeBanner.type === 'warning' || activeBanner.type === 'error' ? 'bg-rose-500' : activeBanner.type === 'success' ? 'bg-emerald-500' : 'bg-cyan-500'}`}></span>
                      </span>
                      <p className="text-sm font-bold">{activeBanner.msg}</p>
                    </div>
                    <button onClick={() => setActiveBanner(null)} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors shrink-0">
                      <X size={18} className="opacity-60 hover:opacity-100"/>
                    </button>
                  </div>
                )}
                
                {/* 🎓 ALUMNI CELEBRATION WINDOW */}
                {studentData.status === 'Alumni' ? (
                  <div className="bg-white p-6 sm:p-12 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] text-center relative overflow-hidden border border-slate-200">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-50/60 rounded-full -mr-24 -mt-24 pointer-events-none blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-50/60 rounded-full -ml-24 -mb-24 pointer-events-none blur-3xl"></div>
                    
                    <GraduationCap size={150} strokeWidth={0.8} className="absolute -top-12 -left-12 text-slate-100 rotate-[-15deg] pointer-events-none" />
                    <BookOpen size={130} strokeWidth={0.8} className="absolute bottom-4 -right-12 text-cyan-50 rotate-12 pointer-events-none" />
                    <Award size={90} strokeWidth={0.8} className="absolute top-12 right-12 text-amber-100/70 rotate-[25deg] animate-pulse pointer-events-none hidden sm:block" />

                    <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                      <div className="w-20 h-20 bg-amber-50 border border-amber-200 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <Award size={40} className="animate-pulse" />
                      </div>
                      
                      <div className="space-y-2">
                        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
                          Congratulations!
                        </h1>
                        <p className="text-indigo-700 text-xs sm:text-sm font-black tracking-widest uppercase bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full inline-block">
                          Official Graduation Citation
                        </p>
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-6"></div>

                      <div className="space-y-6 text-slate-700">
                        <p className="text-base sm:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
                          This proudly certifies that <span className="text-slate-900 font-black border-b-2 border-amber-400 pb-0.5 px-0.5">{studentData.name}</span> has successfully fulfilled all academic curriculum baselines, practical assessments, and financial regulations to complete the <span className="font-bold text-indigo-800">Diploma in Nursing Science & Midwifery</span> from <span className="font-bold text-slate-900">City Nursing Institute, Rangpur</span>.
                        </p>
                        
                        <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-200 p-6 sm:p-8 rounded-xl max-w-2xl mx-auto text-left relative overflow-hidden mt-8">
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400"></div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8 text-sm">
                            <div className="space-y-1">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Authorized Institution</span>
                              <span className="font-bold text-slate-800 block">City Nursing Institute, Rangpur</span>
                            </div>
                            <div className="space-y-1 sm:text-right">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Affiliation</span>
                              <span className="font-bold text-slate-800 block">Bangladesh Nursing and Midwifery Council (BNMC)</span>
                            </div>
                            <div className="h-px bg-slate-200/60 sm:col-span-2 my-1"></div>
                            <div className="space-y-1">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Institute Student ID</span>
                              <span className="font-mono font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded border border-slate-200 inline-block mt-0.5">{studentData.studentId}</span>
                            </div>
                            <div className="space-y-1 sm:text-right">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Batch</span>
                              <span className="font-bold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded border border-cyan-100 inline-block mt-0.5">{batchName}</span>
                            </div>
                            <div className="h-px bg-slate-200/60 sm:col-span-2 my-1"></div>
                            <div className="space-y-1">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Year of Course</span>
                              <span className="font-bold text-slate-700 block mt-0.5">3 Years Diploma Program</span>
                            </div>
                            <div className="space-y-1 sm:text-right">
                              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Year of Graduation</span>
                              <span className="font-bold text-amber-600 bg-amber-50 px-3 py-0.5 rounded border border-amber-200 inline-block mt-0.5">
                                {completionDate ? completionDate.split(' ').pop() : new Date().getFullYear()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6">
                        <span className="inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-sm">
                          <CheckCircle size={14} className="text-emerald-500"/> <span>Accounts Verified & Status Closed</span>
                        </span>
                        <p className="text-[11px] text-slate-400 mt-3 font-medium">Your absolute registries, transcripts, and financial logs are securely preserved.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Welcome, {studentData.name}!</h1>
                    <p className="text-slate-500 mt-2 font-medium">Keep track of your classes, financials, and official updates.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-cyan-300 transition-all" onClick={() => setActiveTab('academic')}>
                    <div className="p-4 bg-cyan-50 text-cyan-600 rounded-xl"><BookOpen size={24}/></div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Enrolled Courses</p><h3 className="text-xl font-black text-slate-900">{courses.length}</h3></div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-emerald-300 transition-all" onClick={() => setActiveTab('attendance')}>
                    <div className={`p-4 rounded-xl ${attStats.perc >= 80 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <CheckSquare size={24}/>
                    </div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Overall Attendance</p><h3 className={`text-xl font-black ${attStats.perc >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{attStats.perc}%</h3></div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-amber-300 transition-all" onClick={() => setActiveTab('clearance')}>
                    <div className={`p-4 rounded-xl ${isExamCleared ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <FileCheck size={24}/>
                    </div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Exam Clearance</p><h3 className={`text-sm font-bold mt-1 ${isExamCleared ? 'text-emerald-600' : 'text-rose-600'}`}>{isExamCleared ? 'Eligible' : 'Restricted'}</h3></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* --- Dashboard Course Breakdown --- */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center shrink-0">
                      <BookOpen size={20} className="mr-2 text-cyan-600"/> Enrolled Courses Matrix
                    </h3>
                    <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                      {courses.length === 0 ? (
                        <p className="text-sm text-slate-500 font-medium text-center p-6 border-2 border-dashed border-slate-100 rounded-xl">No enrolled courses found.</p>
                      ) : (
                        courses.map(course => {
                          const cAtt = getCourseAttendance(course.id);
                          return (
                            <div 
                              key={course.id} 
                              onClick={() => setActiveTab('academic')}
                              className="group relative flex justify-between items-center p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-cyan-300 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-50/0 to-cyan-50/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                              <div className="relative z-10 flex-1 pr-4">
                                <h4 className="text-[15px] font-bold text-slate-800 group-hover:text-cyan-700 transition-colors line-clamp-1">{course.name}</h4>
                                <div className="mt-1.5 flex items-center">
                                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 group-hover:bg-white transition-colors">
                                    Sessions Attended: <span className="text-slate-700">{cAtt.attended}/{cAtt.totalSessions}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="relative z-10 flex items-center space-x-3 shrink-0">
                                <span className={`text-sm font-black px-3 py-1.5 rounded-lg border shadow-sm ${cAtt.perc >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                  {cAtt.perc}%
                                </span>
                                <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-cyan-100 group-hover:text-cyan-600 transition-colors shadow-sm border border-slate-200 group-hover:border-cyan-200">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* --- Dashboard Notifications Hub (Hidden for Alumni) --- */}
                  {studentData.status !== 'Alumni' && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center shrink-0">
                        <Activity size={20} className="mr-2 text-cyan-600"/> Notifications & Updates
                      </h3>
                      <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {notifications.length === 0 ? (
                          <div className="text-center p-8 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                             <Bell className="mx-auto text-slate-300 mb-2" size={28}/>
                             <p className="text-sm text-slate-500 font-medium">You have no new notifications.</p>
                          </div>
                        ) : (
                          notifications.map((note, idx) => (
                            <div 
                              key={idx} 
                              className={`p-3.5 border rounded-xl flex items-start gap-3 transition-colors ${
                                note.type === 'warning' || note.type === 'error' ? 'bg-rose-50/40 border-rose-100 text-rose-700' : 
                                note.type === 'success' ? 'bg-emerald-50/40 border-emerald-100 text-emerald-700' : 
                                'bg-cyan-50/40 border-cyan-100 text-cyan-700'
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                note.type === 'warning' || note.type === 'error' ? 'bg-rose-100/50 text-rose-500' : 
                                note.type === 'success' ? 'bg-emerald-100/50 text-emerald-500' : 
                                'bg-cyan-100/50 text-cyan-500'
                              }`}>
                                <Bell size={16} />
                              </div>
                              <p className="text-[13px] font-medium leading-relaxed opacity-90 mt-0.5">{note.msg}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 2: ACADEMIC (COURSES & EXACT MARKS) --- */}
            {activeTab === 'academic' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center"><GraduationCap size={22} className="mr-2 text-cyan-600"/> Enrolled Courses & Official Results</h2>
                  <p className="text-sm text-slate-500 mt-1">View your registered courses and officially published marks breakdown.</p>
                </div>

                {/* ALUMNI OVERRIDE BLOCK FOR RESULTS */}
                {studentData.status === 'Alumni' ? (
                  <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-3xl p-8 sm:p-12 text-center shadow-sm relative overflow-hidden mt-4">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-100/50 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none"></div>
                    <BookOpen size={130} strokeWidth={0.8} className="absolute bottom-5 -left-12 text-indigo-100 rotate-[-15deg] pointer-events-none" />
                    <Award size={80} strokeWidth={0.8} className="absolute top-8 right-12 text-indigo-200/50 rotate-[20deg] animate-pulse pointer-events-none hidden sm:block" />
                    
                    <div className="relative z-10">
                      <div className="w-20 h-20 bg-white border shadow-sm border-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <GraduationCap size={40} className="text-indigo-500 animate-pulse"/>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">Academic Curriculum Finished</h3>
                      <p className="text-slate-600 font-medium max-w-xl mx-auto leading-relaxed">
                        Your final transcripts have been officially authorized and locked by the institute. You are no longer enrolled in any active continuing education courses.
                      </p>
                      
                      <div className="mt-8 inline-flex items-center px-5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                         <CheckCircle size={18} className="text-emerald-500 mr-2.5"/>
                         <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Grades Preserved in Archives</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    {courses.length === 0 ? (
                      <div className="text-center p-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                        <BookOpen size={32} className="mx-auto text-slate-300 mb-3"/>
                        <p className="text-slate-500 font-medium">You are not enrolled in any courses yet.</p>
                      </div>
                    ) : (
                      courses.map(course => {
                        const marks = getStudentMarksForCourse(course.id);
                        
                        return (
                          <div key={course.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                              <div>
                                <h3 className="font-bold text-lg text-slate-900">{course.name}</h3>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded-md mt-1 inline-block">Year: {course.year}</span>
                              </div>
                              {marks ? (
                                <div className={`px-4 py-2 rounded-xl text-center border w-full sm:w-auto ${marks.isPass ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                                  <p className="text-xs font-bold uppercase tracking-widest">Total Grade</p>
                                  <p className="text-xl font-black">{marks.weightedTotal}%</p>
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 w-full sm:w-auto text-center">No Marks Published</span>
                              )}
                            </div>
                            
                            {marks && (
                              <div className="p-5">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {marks.raw.individualCTs.map((ctScore, idx) => (
                                    <div key={`ct_${idx}`} className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class Test {idx+1}</p>
                                      <p className="font-bold text-slate-800">{marks.locks.ct ? `${ctScore} / 100` : 'Pending'}</p>
                                    </div>
                                  ))}
                                  
                                  <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assignment</p>
                                    <p className="font-bold text-slate-800">{marks.locks.ct ? `${marks.raw.assign} / 100` : 'Pending'}</p>
                                  </div>
                                  <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Midterm (W + V)</p>
                                    <p className="font-bold text-slate-800">{marks.locks.mid ? `${marks.raw.mw + marks.raw.mv} / 200` : 'Pending'}</p>
                                  </div>
                                  <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Final Exam (W + V)</p>
                                    <p className="font-bold text-slate-800">{marks.locks.final ? `${marks.raw.fw + marks.raw.fv} / 200` : 'Pending'}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 3: ATTENDANCE PORTAL --- */}
            {activeTab === 'attendance' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center"><CheckSquare size={22} className="mr-2 text-cyan-600"/> Attendance Tracking Portal</h2>
                    <p className="text-sm text-slate-500 mt-1">Review your overall attendance stats, course-wise breakdown, and exact dates missed.</p>
                  </div>
                  <div className="text-center sm:text-right bg-slate-50 px-5 py-3 rounded-xl border border-slate-100 w-full sm:w-auto">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Status</p>
                    <p className={`text-2xl font-black ${attStats.perc >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{attStats.perc}%</p>
                  </div>
                </div>

                {/* ALUMNI OVERRIDE BLOCK FOR ATTENDANCE */}
                {studentData.status === 'Alumni' ? (
                  <div className="bg-gradient-to-b from-slate-50 to-slate-100 border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-sm relative overflow-hidden mt-4">
                    <CheckSquare size={160} strokeWidth={0.8} className="absolute top-5 -right-10 text-slate-200 rotate-12 pointer-events-none" />
                    <Clock size={80} strokeWidth={0.8} className="absolute bottom-8 left-8 text-slate-200/60 -rotate-[20deg] animate-pulse pointer-events-none hidden sm:block" />
                    
                    <div className="relative z-10">
                      <div className="w-20 h-20 bg-white border shadow-sm border-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckSquare size={40} className="text-slate-400"/>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">Attendance Tracking Concluded</h3>
                      <p className="text-slate-600 font-medium max-w-xl mx-auto leading-relaxed">
                        Since you have graduated from the institute, active daily attendance tracking is no longer applicable to your profile.
                      </p>
                      
                      <div className="mt-8 inline-flex items-center px-5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                         <span className="w-2.5 h-2.5 rounded-full bg-slate-400 mr-2.5"></span>
                         <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Status: Log Closed</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Present Days</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{attStats.present}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                        <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Approved Leave Days</p>
                        <p className="text-2xl font-black text-amber-500 mt-1">{totalApprovedLeaves}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm text-center bg-rose-50/40">
                        <p className="text-rose-500 text-xs uppercase font-bold tracking-wider">Missed Classes (Absent)</p>
                        <p className="text-2xl font-black text-rose-600 mt-1">{attStats.absent}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Course-wise Attendance Breakdown</h3>
                        <div className="space-y-3">
                          {courses.map(course => {
                            const cAtt = getCourseAttendance(course.id);
                            return (
                              <div key={`att_${course.id}`} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                <div>
                                  <p className="font-bold text-slate-800 text-sm">{course.name}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">Sessions Attended: {cAtt.attended} / {cAtt.totalSessions}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded border ${cAtt.perc >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{cAtt.perc}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                         <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Exact Dates Marked Absent</h3>
                         {attStats.missedDates.length > 0 ? (
                           <div className="flex flex-wrap gap-2">
                             {formatMissedDates(attStats.missedDates).split(', ').map((dateStr, idx) => (
                               <span key={idx} className="bg-rose-50 text-rose-700 border border-rose-200 text-sm font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                 {dateStr}
                               </span>
                             ))}
                           </div>
                         ) : (
                           <p className="text-sm text-slate-400 font-medium italic">You maintain a perfect attendance record.</p>
                         )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- TAB 4: FINANCIALS & FEES --- */}
            {activeTab === 'financials' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center"><Wallet size={22} className="mr-2 text-emerald-600"/> Financial Status & Dues</h2>
                    <p className="text-sm text-slate-500 mt-1">Track your course fees, fine penalties, and payment history.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">Total Course Fee Target</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">৳{financials?.totalCourseFee || 0}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">Total General Fees Paid</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">৳{totalCourseFeesPaid}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center bg-slate-50">
                    <p className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">Course Fee Remaining</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">৳{courseFeeDue}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><AlertTriangle size={18} className="mr-2 text-rose-500"/> Fines Tracking Ledger</h3>
                    
                    <div className="flex gap-4 mb-6">
                      <div className="flex-1 bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
                        <p className="text-rose-500 text-[10px] uppercase font-bold tracking-wider">Fine Penalties Due</p>
                        <p className="text-2xl font-black text-rose-600 mt-1">৳{fineDue}</p>
                      </div>
                      <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total Fines Assigned</p>
                        <p className="text-2xl font-black text-slate-700 mt-1">৳{financials?.finesTotal || 0}</p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                       <p className="text-emerald-600 text-[10px] uppercase font-bold tracking-wider">Total Fines Paid</p>
                       <p className="text-xl font-bold text-emerald-700 mt-1">৳{financials?.finesPaid || 0}</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><FileText size={18} className="mr-2 text-cyan-600"/> Official Payment History</h3>
                    <div className="overflow-x-auto w-full max-h-[300px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 border-b border-slate-200">Date Logged</th>
                            <th className="px-4 py-3 border-b border-slate-200">Category</th>
                            <th className="px-4 py-3 border-b border-slate-200 text-right">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financials?.payments && financials.payments.length > 0 ? (
                            [...financials.payments].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map((pay, idx) => (
                              <tr key={pay.id || idx} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-600">{pay.date}</td>
                                <td className="px-4 py-3 font-bold text-cyan-700">{pay.type}</td>
                                <td className="px-4 py-3 text-right font-black text-slate-900">৳{pay.amount}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="3" className="p-6 text-center text-slate-400">No payment records found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 5: EXAM CLEARANCES (VIEW ONLY) --- */}
            {activeTab === 'clearance' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center mb-6"><FileCheck size={22} className="mr-2 text-cyan-600"/> Exam Clearance Board</h2>
                  
                  {/* ALUMNI OVERRIDE BLOCK FOR EXAM CLEARANCE */}
                  {studentData.status === 'Alumni' ? (
                    <div className="bg-gradient-to-b from-amber-50 to-white border border-amber-200 rounded-3xl p-8 sm:p-12 text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-amber-100/60 rounded-full -mr-12 -mt-12 blur-3xl pointer-events-none"></div>
                      <FileCheck size={140} strokeWidth={0.8} className="absolute bottom-5 -left-12 text-amber-100 rotate-[-15deg] pointer-events-none" />
                      <Award size={80} strokeWidth={0.8} className="absolute top-12 right-12 text-amber-200/50 rotate-[25deg] animate-pulse pointer-events-none hidden sm:block" />
                      
                      <div className="relative z-10">
                        <div className="w-20 h-20 bg-white border shadow-sm border-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Award size={40} className="text-amber-500 animate-pulse"/>
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">Academic Lifecycle Completed!</h3>
                        <p className="text-slate-600 font-medium max-w-xl mx-auto leading-relaxed">
                          As a certified graduate of <span className="font-bold text-slate-800">City Nursing Institute, Rangpur</span>, you have successfully cleared all final examinations, institutional boards, and curriculum requirements. No further exam clearances are required for your profile.
                        </p>
                        
                        <div className="mt-8 inline-flex items-center px-5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                           <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2.5 animate-pulse"></span>
                           <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Status: Officially Graduated</span>
                        </div>
                      </div>
                    </div>
                  ) : isExamCleared ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 sm:p-10 text-center">
                      <CheckCircle size={56} className="mx-auto text-emerald-500 mb-4"/>
                      <h3 className="text-2xl font-bold text-emerald-800">You are cleared for Examinations!</h3>
                      <p className="text-emerald-600 mt-2 font-medium">Your attendance and financial status meets the required criteria for exam sitting. Please collect your admit card from the administrative office before exams begin.</p>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 sm:p-10 text-center">
                      <AlertTriangle size={56} className="mx-auto text-rose-500 mb-4"/>
                      <h3 className="text-2xl font-bold text-rose-800">Exam Eligibility Restricted</h3>
                      <p className="text-rose-600 mt-2 font-medium">You are currently restricted from sitting for exams. Please review your pending requirements below.</p>
                      
                      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                        <div className={`p-5 rounded-xl border bg-white shadow-sm ${attStats.perc < 80 ? 'border-rose-300' : 'border-emerald-200'}`}>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Attendance Check</p>
                          <p className={`text-2xl font-black mt-1 ${attStats.perc < 80 ? 'text-rose-600' : 'text-emerald-600'}`}>{attStats.perc}% <span className="text-sm font-medium text-slate-400">/ 80% Reqd.</span></p>
                        </div>
                        <div className={`p-5 rounded-xl border bg-white shadow-sm ${fineDue > 0 ? 'border-rose-300' : 'border-emerald-200'}`}>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fine Dues Check</p>
                          <p className={`text-2xl font-black mt-1 ${fineDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{fineDue > 0 ? `৳${fineDue} Due` : 'Cleared'}</p>
                        </div>
                      </div>
                      <p className="text-sm text-rose-500 font-bold mt-8 bg-white p-3 rounded-lg border border-rose-200 inline-block">Contact the Accounts department immediately to resolve your status.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 6: LEAVE APPLICATION --- */}
            {activeTab === 'leaves' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold flex items-center mb-6"><CalendarRange size={22} className="mr-2 text-cyan-600"/> Submit Leave Application</h2>
                  
                  {studentData.status === 'Alumni' ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <Lock size={32} className="mx-auto text-slate-400 mb-3"/>
                      <h3 className="font-bold text-slate-700 text-lg">Leave Application Disabled</h3>
                      <p className="text-slate-500 text-sm mt-1">You are currently registered as an Alumni. Leave registration systems are exclusive to active academic sessions.</p>
                    </div>
                  ) : pendingLeaveExists ? (
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                      <Clock size={32} className="mx-auto text-amber-500 mb-3"/>
                      <h3 className="font-bold text-amber-800 text-lg">Application Under Review</h3>
                      <p className="text-amber-700 text-sm mt-1">You currently have a leave request pending approval by the Accounts department. You cannot submit a new request until it is processed.</p>
                    </div>
                  ) : (
                    <form onSubmit={submitLeaveRequest} className="space-y-4 max-w-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">From Date</label>
                          <input type="date" required value={leaveForm.fromDate} onChange={e => setLeaveForm({...leaveForm, fromDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-slate-700" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">To Date</label>
                          <input type="date" required value={leaveForm.toDate} onChange={e => setLeaveForm({...leaveForm, toDate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-bold text-slate-700" />
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 flex justify-between items-center">
                        <span>Total Days Requested:</span>
                        <span className="text-cyan-700 text-lg">{calculateDays(leaveForm.fromDate, leaveForm.toDate)} Day(s)</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Reason for Leave</label>
                        <textarea required value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} rows="3" placeholder="State your reason clearly..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 resize-none font-medium text-sm"></textarea>
                      </div>
                      
                      <button type="submit" disabled={loading || calculateDays(leaveForm.fromDate, leaveForm.toDate) <= 0} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-xl transition-all shadow-md flex justify-center items-center disabled:opacity-50">
                        <Send size={18} className="mr-2"/> Submit Application
                      </button>
                    </form>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Your Leave History</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {leaveRequests.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-medium">No previous leave requests found.</div>
                    ) : (
                      leaveRequests.map(leave => (
                        <div key={leave.id} className="p-6 hover:bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <p className="text-sm font-bold text-cyan-700 mb-1">Dates: {leave.fromDate} to {leave.toDate} ({leave.totalDays} Days)</p>
                            <p className="text-sm text-slate-700 font-medium">"{leave.reason}"</p>
                          </div>
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : leave.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                            {leave.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 7: SETTINGS --- */}
            {activeTab === 'settings' && (
              <div className="max-w-md bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold flex items-center mb-6"><Settings size={20} className="mr-2 text-cyan-600"/> Security Settings</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Update Account Password</label>
                    <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password (Min 6 chars)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-cyan-500 font-medium" />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-all shadow-md">
                    Update Password
                  </button>
                </form>
              </div>
            )}

{/* --- TAB 8: HELP & SUPPORT (STUDENT MANUAL) --- */}
            {activeTab === 'guide' && (
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-10 print:m-0 print:p-0">
                
                {/* Print Header */}
                <div className="hidden print:block text-center mb-8 border-b-2 border-slate-900 pb-6">
                  <h1 className="text-3xl font-bold uppercase tracking-widest text-slate-900">City Nursing Institute, Rangpur</h1>
                  <h2 className="text-xl font-bold text-slate-700 mt-2">Official Student Handbook & Portal Guide</h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">Comprehensive overview of institutional policies, academic standards, and system features.</p>
                </div>

                {/* Web Header Banner */}
                <div className="bg-gradient-to-r from-cyan-700 to-blue-800 p-8 rounded-3xl shadow-lg text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 print:hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 pointer-events-none blur-2xl"></div>
                  <div className="relative z-10 flex items-center">
                    <HelpCircle size={48} className="mr-5 text-cyan-100" /> 
                    <div>
                      <h2 className="text-3xl font-black mb-1">Help & Support Guide</h2>
                      <p className="text-cyan-100 font-medium text-lg">Detailed breakdown of portal features and institutional policies.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">

                  {/* ==============================================================
                      PART A: INSTITUTIONAL & ACADEMIC POLICIES 
                  ============================================================== */}
                  <h3 className="text-xl font-black text-slate-800 border-b-2 border-slate-200 pb-2 mt-4 flex items-center">
                    <BookOpen className="mr-3 text-cyan-600"/> Part A: Academic & Institutional Policies
                  </h3>

                  {/* 1. Academic & Exam Rules */}
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm print:break-inside-avoid relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-500"></div>
                    <div className="flex items-center mb-5">
                      <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center mr-4"><GraduationCap size={24} /></div>
                      <h3 className="text-xl font-bold text-slate-900">1. BNMC Academic & Examination Guidelines</h3>
                    </div>
                    <div className="space-y-4 text-sm text-slate-700 font-medium sm:ml-16">
                      <p className="leading-relaxed">As a student of the <span className="font-bold text-slate-900">Diploma in Nursing Science & Midwifery</span> program at City Nursing Institute, you are bound by the strict regulations of the <span className="font-bold text-indigo-700">Bangladesh Nursing and Midwifery Council (BNMC)</span>:</p>
                      <ul className="space-y-3">
                        <li className="flex items-start">
                          <CheckCircle size={16} className="text-emerald-500 mr-2 mt-0.5 shrink-0"/>
                          <span><span className="font-bold text-rose-600">Mandatory Attendance:</span> You must maintain a strictly calculated minimum of <b>80% overall attendance</b> to be eligible to sit for any Midterm or Final examinations.</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle size={16} className="text-emerald-500 mr-2 mt-0.5 shrink-0"/>
                          <span><span className="font-bold text-indigo-600">Passing Criteria:</span> The passing threshold for all theoretical, practical, and clinical assessments is strictly set at <b>60%</b>.</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle size={16} className="text-emerald-500 mr-2 mt-0.5 shrink-0"/>
                          <span><span className="font-bold text-slate-800">Clinical Placements:</span> 100% attendance during clinical hospital postings is required. Missed clinical hours must be fully compensated.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* 2. Financial Policies */}
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm print:break-inside-avoid relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                    <div className="flex items-center mb-5">
                      <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mr-4"><ShieldAlert size={24} /></div>
                      <h3 className="text-xl font-bold text-slate-900">2. Financial Policies & Exam Clearances</h3>
                    </div>
                    <div className="space-y-4 text-sm text-slate-700 font-medium sm:ml-16">
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                        <p className="font-bold text-slate-900 text-base mb-2">Automated Exam Clearance System:</p>
                        <p className="mb-3 leading-relaxed">Your admit card eligibility is algorithmically determined by this portal. To secure a <span className="text-emerald-700 font-black tracking-widest uppercase bg-emerald-100 px-2 py-0.5 rounded text-[10px]">Cleared</span> status on your dashboard, you must fulfill these dual conditions:</p>
                        <ul className="list-disc pl-6 space-y-1 mb-4 font-bold text-slate-800">
                          <li>Attendance metric is ≥ 80%.</li>
                          <li>Your total <span className="text-rose-600">Fine Penalties Due</span> is exactly ৳0.</li>
                        </ul>
                        <div className="bg-rose-100/50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs font-bold flex items-center">
                          <AlertTriangle size={16} className="mr-2 shrink-0"/> 
                          Remaining dues will instantly lock your academic profile and flag you as "Restricted" from examinations.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Disciplinary Code */}
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm print:break-inside-avoid relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
                    <div className="flex items-center mb-5">
                      <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center mr-4"><AlertTriangle size={24} /></div>
                      <h3 className="text-xl font-bold text-slate-900">3. Code of Conduct & Disciplinary Rules</h3>
                    </div>
                    <ul className="list-disc pl-5 sm:pl-20 space-y-3 text-sm text-slate-700 font-medium leading-relaxed">
                      <li><b>Official Uniform:</b> Students must wear the officially prescribed, clean, and well-ironed clinical uniform along with the institutional ID card at all times within the campus and hospital premises.</li>
                      <li><b>Professionalism:</b> Utmost respect must be shown towards faculty members, senior staff, and patients. Unprofessional conduct will lead to severe academic penalties.</li>
                      <li><b>Gadget Policy:</b> The use of mobile phones during theoretical classes and clinical ward duties is strictly prohibited.</li>
                    </ul>
                  </div>

                  {/* ==============================================================
                      PART B: PORTAL NAVIGATION 
                  ============================================================== */}
                  <h3 className="text-xl font-black text-slate-800 border-b-2 border-slate-200 pb-2 mt-8 flex items-center">
                    <LayoutDashboard className="mr-3 text-indigo-600"/> Part B: System Features & Navigation
                  </h3>

                  {/* 4. Feature Breakdown */}
                  <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm print:break-inside-avoid">
                    <div className="space-y-6">
                      
                      <div className="flex gap-4 items-start border-b border-slate-100 pb-5">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0"><Activity size={22}/></div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base mb-1.5">Dashboard Hub & Notifications</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">Your main command center. Track your enrolled courses and view real-time smart alerts. Banners appear at the top for urgent updates (new fines, approved leaves, published results, payment receipts) and dismiss once read.</p>
                        </div>
                      </div>

                      <div className="flex gap-4 items-start border-b border-slate-100 pb-5">
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0"><Wallet size={22}/></div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base mb-1.5">Financial Ledger</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">A completely transparent ledger recording your Total Course Fee, Admission Paid, and a meticulous log of every single payment receipt generated by the Accounts Department. Always ensure your fine balance is 0.</p>
                        </div>
                      </div>

                      <div className="flex gap-4 items-start border-b border-slate-100 pb-5">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0"><CalendarOff size={22}/></div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base mb-1.5">Leave Application Matrix</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">Apply for official leaves to prevent absentee penalties. Approved leaves do not affect your 80% attendance metric. <br/><b className="text-rose-600">Note:</b> You cannot submit a secondary request while an existing request is pending review.</p>
                        </div>
                      </div>

                      <div className="flex gap-4 items-start">
                        <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl shrink-0"><Lock size={22}/></div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base mb-1.5">Security & Passwords</h4>
                          <p className="text-sm text-slate-600 leading-relaxed">For database integrity, if you forget your password, you cannot reset it yourself. You must contact the System Admin for a temporary 6-digit access token. For your own safety, always tap <b>Secure Logout</b> after your session.</p>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            )}
      {loading && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"></div>
          <div className="bg-white p-8 rounded-2xl shadow-2xl z-10 flex flex-col items-center animate-in zoom-in-95">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-600 mb-4"></div>
            <h2 className="text-xl font-bold text-slate-900">Submitting...</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Please wait while securely saving to database</p>
          </div>
        </div>
      )}

          </div>
        </main>
      </div>
    </div>
  );
}
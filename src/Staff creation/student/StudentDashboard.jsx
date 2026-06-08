import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, doc, getDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, LogOut, Menu, X, BookOpen, GraduationCap, 
  AlertTriangle, CheckCircle, Clock, ShieldAlert, Settings, 
  Wallet, FileCheck, CalendarOff, Send, Info, CheckSquare, DollarSign, Bell, CalendarRange, Activity, FileText
} from 'lucide-react';

export default function StudentDashboard() {
  const navigate = useNavigate();
  
  // Layout & Auth States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [studentData, setStudentData] = useState({ name: 'Loading...', studentId: '', batchId: '', uid: '' });
  const [studentInitials, setStudentInitials] = useState('ST');
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Custom UI Dialog
  const [uiDialog, setUiDialog] = useState({ isOpen: false, title: '', desc: '', type: 'confirm', onConfirm: null });

  // Core Data States
  const [batchName, setBatchName] = useState('Loading...');
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
            setStudentData({ name: data.name, studentId: data.studentId, batchId: data.batchId, uid: user.uid });
            
            const nameParts = data.name.split(' ');
            setStudentInitials(nameParts.length > 1 ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() : data.name.substring(0, 2).toUpperCase());

            if (data.batchId) {
              const batchSnap = await getDoc(doc(db, 'batches', data.batchId));
              if (batchSnap.exists()) setBatchName(batchSnap.data().name);
            }

            // Stream Only My Batch Courses
            unSubCourses = onSnapshot(query(collection(db, 'courses'), where('batchId', '==', data.batchId)), (snap) => {
              setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });

            // Stream Only My Financials
            unSubFinances = onSnapshot(doc(db, 'financials', user.uid), (snap) => {
              if (snap.exists()) setFinancials(snap.data());
              else setFinancials({ totalCourseFee: 0, admissionFeePaid: 0, monthlyPaidTotal: 0, finesTotal: 0, finesPaid: 0, payments: [] });
            });

            // Stream Overall Attendance
            unSubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
              setAttendanceData(snap.docs.map(d => d.data()));
            });

            // Stream Only My Leaves
            unSubLeaves = onSnapshot(query(collection(db, 'leaves'), where('studentId', '==', user.uid)), (snap) => {
              setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
            });

            // Stream Marks Only for My Batch
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

  // --- COURSE-WISE ATTENDANCE CALCULATION ---
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

  // STRICT CLEARANCE LOGIC: Must have >= 60% Attendance AND 0 Fine Due
  const isExamCleared = useMemo(() => {
    if (!financials) return false;
    return (attStats.perc >= 60 && fineDue <= 0) || financials.manualClearance === true;
  }, [attStats.perc, fineDue, financials]);

  const pendingLeaveExists = useMemo(() => {
    return leaveRequests.some(l => l.status === 'Pending');
  }, [leaveRequests]);

  // --- STRICT & SMART NOTIFICATIONS ---
  const notifications = useMemo(() => {
    let notes = [];
    
    if (fineDue > 0) {
      notes.push({ type: 'warning', msg: `Attention: You have an outstanding fine of ৳${fineDue}. You cannot attend exams until this is cleared.` });
    }
    
    // Only show top 3 recent leave updates
    leaveRequests.filter(l => l.status !== 'Pending').slice(0, 3).forEach(l => {
      if (l.status === 'Approved') notes.push({ type: 'success', msg: `Leave approved from ${l.fromDate} to ${l.toDate}.` });
      if (l.status === 'Rejected') notes.push({ type: 'error', msg: `Leave request for ${l.fromDate} was rejected.` });
    });

    marksData.forEach(m => {
      const c = courses.find(course => course.id === m.courseId);
      if (c && m.locks && (m.locks.ct || m.locks.mid || m.locks.final)) {
         notes.push({ type: 'info', msg: `New exam marks have been officially published for ${c.name}.` });
      }
    });
    return notes;
  }, [fineDue, leaveRequests, marksData, courses]);

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
    { id: 'home', name: 'Dashboard Hub', icon: <LayoutDashboard size={20} /> },
    { id: 'academic', name: 'Official Results', icon: <GraduationCap size={20} /> },
    { id: 'attendance', name: 'Attendance Portal', icon: <CheckSquare size={20} /> },
    { id: 'financials', name: 'Financial Ledger', icon: <Wallet size={20} /> },
    { id: 'clearance', name: 'Exam Clearance', icon: <FileCheck size={20} /> },
    { id: 'leaves', name: 'Leave Application', icon: <CalendarOff size={20} /> },
    { id: 'settings', name: 'Security Settings', icon: <Settings size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 relative">
      
      {/* --- CUSTOM DIALOG UI --- */}
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
        
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 bg-slate-100 rounded-lg md:hidden"><Menu size={20} /></button>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-slate-900 capitalize">{navItems.find(n => n.id === activeTab)?.name}</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{studentData.name}</p>
              <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">{batchName}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-600 to-blue-500 text-white rounded-xl flex items-center justify-center font-bold shadow-lg text-sm border border-cyan-400">
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
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Welcome, {studentData.name}!</h1>
                  <p className="text-slate-500 mt-2 font-medium">Keep track of your classes, financials, and official updates.</p>
                </div>
                
                {/* At a glance widgets */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-cyan-300 transition-all" onClick={() => setActiveTab('academic')}>
                    <div className="p-4 bg-cyan-50 text-cyan-600 rounded-xl"><BookOpen size={24}/></div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Enrolled Courses</p><h3 className="text-xl font-black text-slate-900">{courses.length}</h3></div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-emerald-300 transition-all" onClick={() => setActiveTab('attendance')}>
                    <div className={`p-4 rounded-xl ${attStats.perc >= 60 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <CheckSquare size={24}/>
                    </div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Overall Attendance</p><h3 className={`text-xl font-black ${attStats.perc >= 60 ? 'text-emerald-600' : 'text-rose-600'}`}>{attStats.perc}%</h3></div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-amber-300 transition-all" onClick={() => setActiveTab('clearance')}>
                    <div className={`p-4 rounded-xl ${isExamCleared ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <FileCheck size={24}/>
                    </div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Exam Clearance</p><h3 className={`text-sm font-bold mt-1 ${isExamCleared ? 'text-emerald-600' : 'text-rose-600'}`}>{isExamCleared ? 'Eligible' : 'Restricted'}</h3></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Dashboard Course Breakdown */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center"><BookOpen size={20} className="mr-2 text-cyan-600"/> Enrolled Courses Matrix</h3>
                    <div className="space-y-3">
                      {courses.length === 0 ? (
                        <p className="text-sm text-slate-500 font-medium text-center p-4">No enrolled courses found.</p>
                      ) : (
                        courses.map(course => {
                          const cAtt = getCourseAttendance(course.id);
                          return (
                            <div key={course.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-all cursor-pointer" onClick={() => setActiveTab('academic')}>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{course.name}</p>
                                <p className="text-xs text-slate-500 mt-1">Sessions Attended: {cAtt.attended}/{cAtt.totalSessions}</p>
                              </div>
                              <span className={`text-sm font-black px-3 py-1 rounded-lg ${cAtt.perc >= 60 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{cAtt.perc}%</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Dashboard Notifications Hub */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center"><Activity size={20} className="mr-2 text-cyan-600"/> Notifications & Updates</h3>
                    <div className="space-y-3">
                      {notifications.length === 0 ? (
                        <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl">
                           <Bell className="mx-auto text-slate-300 mb-2" size={24}/>
                           <p className="text-sm text-slate-500 font-medium">You have no new notifications.</p>
                        </div>
                      ) : (
                        notifications.map((note, idx) => (
                          <div key={idx} className={`p-4 border rounded-xl flex items-start gap-3 ${note.type === 'warning' ? 'bg-rose-50 border-rose-200 text-rose-800' : note.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-cyan-50 border-cyan-200 text-cyan-800'}`}>
                            <Bell size={18} className="shrink-0 mt-0.5" />
                            <p className="text-sm font-bold">{note.msg}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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

                <div className="space-y-4">
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
                                {/* Dynamic CT Listing */}
                                {marks.raw.individualCTs.map((ctScore, idx) => (
                                  <div key={`ct_${idx}`} className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class Test {idx+1}</p>
                                    <p className="font-bold text-slate-800">{marks.locks.ct ? `${ctScore} / 100` : 'Pending'}</p>
                                  </div>
                                ))}
                                
                                {/* Assignment */}
                                <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assignment</p>
                                  <p className="font-bold text-slate-800">{marks.locks.ct ? `${marks.raw.assign} / 100` : 'Pending'}</p>
                                </div>
                                {/* Midterm */}
                                <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Midterm (W + V)</p>
                                  <p className="font-bold text-slate-800">{marks.locks.mid ? `${marks.raw.mw + marks.raw.mv} / 200` : 'Pending'}</p>
                                </div>
                                {/* Final */}
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
                    <p className={`text-2xl font-black ${attStats.perc >= 60 ? 'text-emerald-600' : 'text-rose-600'}`}>{attStats.perc}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {/* Course Wise Breakdown */}
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
                            <span className={`text-xs font-bold px-2 py-1 rounded border ${cAtt.perc >= 60 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{cAtt.perc}%</span>
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

                {/* --- TOP ROW: COURSE FEE SUMMARY --- */}
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
                    <p className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">Course Fee Outstanding</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">৳{courseFeeDue}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* --- FINES SUMMARY --- */}
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

                  {/* --- PAYMENT HISTORY --- */}
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
                  <h2 className="text-2xl font-bold text-slate-900 flex items-center mb-6"><FileCheck size={24} className="mr-2 text-cyan-600"/> Exam Clearance Board</h2>
                  
                  {isExamCleared ? (
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
                        <div className={`p-5 rounded-xl border bg-white shadow-sm ${attStats.perc < 60 ? 'border-rose-300' : 'border-emerald-200'}`}>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Attendance Check</p>
                          <p className={`text-2xl font-black mt-1 ${attStats.perc < 60 ? 'text-rose-600' : 'text-emerald-600'}`}>{attStats.perc}% <span className="text-sm font-medium text-slate-400">/ 60% Reqd.</span></p>
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
                  
                  {pendingLeaveExists ? (
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

          </div>
        </main>
      </div>
    </div>
  );
}
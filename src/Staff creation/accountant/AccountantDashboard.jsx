import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { 
  collection, onSnapshot, query, where, doc, getDoc, setDoc, updateDoc, serverTimestamp, writeBatch, addDoc 
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, LogOut, Menu, X, Users, Search, DollarSign, FileCheck, 
  AlertTriangle, CheckCircle, Trash2, Printer, Lock, CalendarOff, Settings, Info, CreditCard, PieChart, Activity, Clock, Briefcase
} from 'lucide-react';

export default function AccountantDashboard() {
  const navigate = useNavigate();
  
  // Layout States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accountantData, setAccountantData] = useState({ name: 'Loading...', uid: '' });
  const [accountantInitials, setAccountantInitials] = useState('AC');
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Custom UI Dialog
  const [uiDialog, setUiDialog] = useState({ isOpen: false, title: '', desc: '', type: 'confirm', onConfirm: null });

  // Core Data States
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [allFinancials, setAllFinancials] = useState({});
  const [adminRequests, setAdminRequests] = useState([]); 

  // Operational States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentFinances, setStudentFinances] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  
  // Monthly Report States
  const [reportType, setReportType] = useState('attendance'); 
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [reportFineRate, setReportFineRate] = useState(100);

  // Faculty Report States
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // Payment Entry State
  const [paymentEntry, setPaymentEntry] = useState({ amount: '', type: 'Monthly Course Fee', note: '' });
  const [additionalFine, setAdditionalFine] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const showCustomDialog = (title, desc, type = 'confirm', onConfirm = null) => {
    setUiDialog({ isOpen: true, title, desc, type, onConfirm });
  };
  const showMessage = (text, type) => { setMessage({ text, type }); setTimeout(() => setMessage({ text: '', type: '' }), 4000); };
  const getBatchName = (id) => batches.find(b => b.id === id)?.name || 'Unknown';
  const getCourseName = (id) => courses.find(c => c.id === id)?.name || 'Unknown Course';

  // Computed Values for Current Selected Student
  const currentCalculatedFineDue = useMemo(() => {
    if (!studentFinances) return 0;
    return (studentFinances.finesTotal || 0) - (studentFinances.finesPaid || 0);
  }, [studentFinances]);

  const totalCourseFeesPaid = useMemo(() => {
    if (!studentFinances) return 0;
    return (studentFinances.admissionFeePaid || 0) + (studentFinances.monthlyPaidTotal || 0);
  }, [studentFinances]);

  const courseFeeDue = useMemo(() => {
    if (!studentFinances) return 0;
    const due = (studentFinances.totalCourseFee || 0) - totalCourseFeesPaid;
    return due > 0 ? due : 0;
  }, [studentFinances, totalCourseFeesPaid]);

  // --- SAFE DATA STREAM INITIALIZATION ---
  useEffect(() => {
    let unSubStudents = () => {};
    let unSubTeachers = () => {};
    let unSubBatches = () => {};
    let unSubCourses = () => {};
    let unSubLeaves = () => {};
    let unSubAttendance = () => {};
    let unSubFinances = () => {};
    let unSubRequests = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role === 'accountant') {
            const data = docSnap.data();
            setAccountantData({ name: data.name, uid: user.uid });
            const nameParts = data.name.split(' ');
            setAccountantInitials(nameParts.length > 1 ? (nameParts[0][0] + nameParts[1][0]).toUpperCase() : data.name.substring(0, 2).toUpperCase());
            
            // Limit snapshot fetching and modularize queries to prevent WebChannel 400 error bursts
            unSubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (snapshot) => {
              setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            unSubTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
              setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            
            unSubBatches = onSnapshot(collection(db, 'batches'), (snapshot) => {
              setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            unSubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
              setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            unSubLeaves = onSnapshot(query(collection(db, 'leaves'), where('status', '==', 'Pending')), (snapshot) => {
              setLeaveRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            unSubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
              setAttendanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            unSubFinances = onSnapshot(collection(db, 'financials'), (snapshot) => {
              const finMap = {};
              snapshot.docs.forEach(doc => { finMap[doc.id] = { id: doc.id, ...doc.data() }; });
              setAllFinancials(finMap);
            });

            unSubRequests = onSnapshot(query(collection(db, 'deletion_requests'), where('accountantUid', '==', user.uid)), (snapshot) => {
              setAdminRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

          } else {
            signOut(auth); navigate('/');
          }
        } catch (error) { console.error(error); }
      } else { navigate('/'); }
    });

    return () => { 
      unsubscribeAuth(); 
      unSubStudents(); 
      unSubTeachers();
      unSubBatches(); 
      unSubCourses();
      unSubLeaves(); 
      unSubAttendance(); 
      unSubFinances(); 
      unSubRequests();
    };
  }, [navigate]);

  useEffect(() => {
    if (selectedStudent && allFinancials[selectedStudent.id]) {
      setStudentFinances(allFinancials[selectedStudent.id]);
    }
  }, [allFinancials, selectedStudent]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  const openStudentProfile = async (student) => {
    setSelectedStudent(student);
    setPaymentEntry({ amount: '', type: 'Monthly Course Fee', note: '' });
    setAdditionalFine('');
    
    const existingFin = allFinancials[student.id];
    if (existingFin) {
      setStudentFinances(existingFin);
    } else {
      setStudentFinances({ 
        totalCourseFee: 0, admissionFeeTotal: 0, admissionFeePaid: 0,
        monthlyPaidTotal: 0, finesTotal: 0, finesPaid: 0, isFeeLocked: false, manualClearance: false,
        payments: [] 
      });
    }
    setActiveTab('profile');
  };

  const handlePaymentCategoryChange = (val) => {
    if (val === 'Fine Payment') {
      setPaymentEntry({ ...paymentEntry, type: val, amount: currentCalculatedFineDue > 0 ? currentCalculatedFineDue.toString() : '' });
    } else {
      setPaymentEntry({ ...paymentEntry, type: val, amount: '' });
    }
  };

  const lockTotalFee = async () => {
    const fee = Number(document.getElementById('courseFee').value);
    const admissionTotal = Number(document.getElementById('admFeeTotal').value);

    if (fee <= 0) return showMessage("Total course fee must be greater than 0.", "error");

    showCustomDialog("Lock Master Fees", "Once you save the Total Course Fee, it cannot be changed. Proceed?", "confirm", async () => {
      setLoading(true);
      try {
        const finData = {
          ...studentFinances,
          totalCourseFee: fee, admissionFeeTotal: admissionTotal,
          isFeeLocked: true, updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, 'financials', selectedStudent.id), finData, { merge: true });
        showMessage("Fees permanently locked for this student.", "success");
      } catch (error) { showMessage("Failed to save fees.", "error"); }
      setLoading(false);
    });
  };

  const processPayment = async () => {
    const inputAmt = Number(paymentEntry.amount);
    
    if (paymentEntry.type === 'Fine Payment') {
      if (currentCalculatedFineDue <= 0) {
        return showCustomDialog("Validation Error", "This student has no outstanding fines.", "alert");
      }
      if (inputAmt !== currentCalculatedFineDue) {
        return showCustomDialog("Validation Error", `You must clear the EXACT outstanding fine amount (৳${currentCalculatedFineDue}). Partial fine payments are not permitted.`, "alert");
      }
    } else {
      if (!paymentEntry.amount || inputAmt <= 0) return showMessage("Enter a valid amount.", "error");
    }

    showCustomDialog("Process Payment", `Confirm ${paymentEntry.type} entry of ৳${inputAmt}?`, "confirm", async () => {
      setLoading(true);
      try {
        const isoDate = new Date().toISOString().split('T')[0];
        const newPayment = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString('en-GB'),
          isoDate: isoDate,
          amount: inputAmt,
          type: paymentEntry.type,
          note: paymentEntry.note || '',
          timestamp: new Date().toISOString()
        };

        const updatedFinances = { ...studentFinances };
        updatedFinances.payments = [...(updatedFinances.payments || []), newPayment];
        
        if (paymentEntry.type === 'Monthly Course Fee') {
          updatedFinances.monthlyPaidTotal = (updatedFinances.monthlyPaidTotal || 0) + newPayment.amount;
        } else if (paymentEntry.type === 'Admission Fee') {
          updatedFinances.admissionFeePaid = (updatedFinances.admissionFeePaid || 0) + newPayment.amount;
        } else if (paymentEntry.type === 'Fine Payment') {
          updatedFinances.finesPaid = (updatedFinances.finesPaid || 0) + newPayment.amount;
        }

        await setDoc(doc(db, 'financials', selectedStudent.id), updatedFinances, { merge: true });
        setPaymentEntry({ amount: '', type: 'Monthly Course Fee', note: '' });
        showMessage("Payment recorded successfully.", "success");
      } catch (error) { showMessage("Failed to record payment.", "error"); }
      setLoading(false);
    });
  };

  const applyAdditionalFine = async () => {
    if (!additionalFine || Number(additionalFine) <= 0) return showMessage("Enter a valid fine amount.", "error");
    
    showCustomDialog("Add Manual Fine", `Apply additional manual fine of ৳${additionalFine}?`, "confirm", async () => {
      setLoading(true);
      try {
        const updatedFinances = { ...studentFinances };
        updatedFinances.finesTotal = (updatedFinances.finesTotal || 0) + Number(additionalFine);

        await setDoc(doc(db, 'financials', selectedStudent.id), updatedFinances, { merge: true });
        setAdditionalFine('');
        showMessage("Fine added successfully.", "success");
      } catch (error) { showMessage("Failed to add fine.", "error"); }
      setLoading(false);
    });
  };

  const requestPaymentDeletion = (paymentItem) => {
    showCustomDialog(
      "Admin Permission Required", 
      `Deleting a payment record requires System Admin approval. Send request?`, 
      "confirm", 
      async () => {
        try {
          const requestRef = doc(db, 'deletion_requests', paymentItem.id);
          await setDoc(requestRef, {
            requestId: paymentItem.id,
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            paymentData: paymentItem,
            accountantName: accountantData.name,
            accountantUid: accountantData.uid,
            status: 'Pending',
            createdAt: serverTimestamp()
          });
          showMessage("Deletion request submitted to Admin portal.", "success");
        } catch (error) { showMessage("Error submitting deletion request.", "error"); }
      }
    );
  };

  // --- ATTENDANCE MAP COMPUTING ENGINE (MAJORITY RULE APPLIED) ---
  const getDailyAttendanceStats = (studentId) => {
    const dailyRecords = {};
    
    // Group all sessions by date
    attendanceData.forEach(record => {
      if (record.records && record.records[studentId]) {
        if (!dailyRecords[record.date]) dailyRecords[record.date] = [];
        dailyRecords[record.date].push(record.records[studentId]);
      }
    });

    let presentDays = 0, absentDays = 0, leaveDays = 0;
    const totalDays = Object.keys(dailyRecords).length;

    Object.keys(dailyRecords).forEach(date => {
      const statuses = dailyRecords[date];
      const totalSessions = statuses.length;
      let pCount = 0, lCount = 0, aCount = 0;

      statuses.forEach(s => {
        if (s === 'present') pCount++;
        else if (s === 'leave') lCount++;
        else aCount++;
      });

      if (lCount > 0) {
        leaveDays++; // Any leave on that day counts the whole day as excused leave
      } else if (pCount >= Math.ceil(totalSessions / 2)) {
        // If present in majority (or equal half) of classes that day, marked present for the day
        presentDays++;
      } else {
        // Failed to attend majority classes
        absentDays++;
      }
    });

    const effectiveDays = totalDays - leaveDays;
    const perc = effectiveDays === 0 ? 0 : Math.round((presentDays / effectiveDays) * 100);

    return { present: presentDays, absent: absentDays, leave: leaveDays, totalDays, perc, effectiveDays };
  };

  const getMonthlyMissedClasses = (studentId, yyyyMm) => {
    const dailyRecords = {};
    
    attendanceData.forEach(record => {
      if (record.date.startsWith(yyyyMm)) {
        if (record.records && record.records[studentId]) {
          if (!dailyRecords[record.date]) dailyRecords[record.date] = [];
          dailyRecords[record.date].push(record.records[studentId]);
        }
      }
    });

    let missedDates = [];
    Object.keys(dailyRecords).forEach(date => {
      const statuses = dailyRecords[date];
      const totalSessions = statuses.length;
      let pCount = 0, lCount = 0;

      statuses.forEach(s => {
        if (s === 'present') pCount++;
        else if (s === 'leave') lCount++;
      });

      // Day is missed if not on leave AND failed to attend majority of classes
      if (lCount === 0 && pCount < Math.ceil(totalSessions / 2)) {
        missedDates.push(date);
      }
    });

    return missedDates.sort();
  };

  const formatMissedDates = (datesArr) => {
    return datesArr.map(d => {
      const [y, m, day] = d.split('-');
      const dateObj = new Date(y, m - 1, day);
      return `${Number(day)} ${dateObj.toLocaleString('en-US', {month: 'short'})}`;
    }).join(', ');
  };

  const applyMonthlyFinesToBatch = async () => {
    if (!reportFineRate || reportFineRate <= 0) return showMessage("Enter a valid fine rate.", "error");
    
    const logRef = doc(db, 'monthly_fine_logs', `${selectedBatchId}_${reportMonth}`);
    const logSnap = await getDoc(logRef);
    if (logSnap.exists()) {
      return showCustomDialog("Action Denied", `Fines for ${reportMonth} have already been applied to this batch. You cannot apply it again.`, "alert");
    }

    showCustomDialog("Apply Monthly Fines", `Calculate and apply fines for all missed classes in ${reportMonth}? This action is performed once per month.`, "confirm", async () => {
      setLoading(true);
      try {
        const batchStudents = students.filter(s => s.batchId === selectedBatchId);
        const batchWrite = writeBatch(db);

        for (const student of batchStudents) {
          const missedDates = getMonthlyMissedClasses(student.id, reportMonth);
          if (missedDates.length > 0) {
            const addedFine = missedDates.length * reportFineRate;
            const finRef = doc(db, 'financials', student.id);
            const existingFin = allFinancials[student.id] || {};
            const newTotalFine = (existingFin.finesTotal || 0) + addedFine;
            
            batchWrite.set(finRef, { finesTotal: newTotalFine }, { merge: true });
          }
        }
        
        batchWrite.set(logRef, { 
          appliedAt: serverTimestamp(), 
          rate: reportFineRate, 
          accountantId: accountantData.uid 
        });

        await batchWrite.commit();
        showMessage(`Fines successfully applied for ${reportMonth}.`, "success");
      } catch (error) { showMessage("Failed to apply fines.", "error"); }
      setLoading(false);
    });
  };

  const grantManualClearance = async (studentId) => {
    showCustomDialog("Grant Clearance", "Override attendance/fine disqualification and clear this student for exams?", "confirm", async () => {
      try {
        await setDoc(doc(db, 'financials', studentId), { manualClearance: true }, { merge: true });
        showMessage("Student cleared for exams.", "success");
      } catch (error) { showMessage("Action failed.", "error"); }
    });
  };

  const payFineFromClearance = async (studentId, fineDueAmount) => {
    showCustomDialog("Pay Fine & Clear", `Process full fine payment of ৳${fineDueAmount} for this student? This will clear them for exams.`, "confirm", async () => {
      setLoading(true);
      try {
        const isoDate = new Date().toISOString().split('T')[0];
        const newPayment = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString('en-GB'),
          isoDate: isoDate,
          amount: Number(fineDueAmount),
          type: 'Fine Payment',
          note: 'Cleared via Exam Board Dashboard',
          timestamp: new Date().toISOString()
        };

        const existingFin = allFinancials[studentId] || {};
        const updatedFinances = { ...existingFin };
        updatedFinances.payments = [...(updatedFinances.payments || []), newPayment];
        updatedFinances.finesPaid = (updatedFinances.finesPaid || 0) + Number(fineDueAmount);

        await setDoc(doc(db, 'financials', studentId), updatedFinances, { merge: true });
        showMessage("Fine Paid and Clearance Granted!", "success");
      } catch (error) { showMessage("Failed to process payment.", "error"); }
      setLoading(false);
    });
  };

  const handleLeaveAction = (leaveId, action) => {
    showCustomDialog(`Confirm ${action}`, `Are you sure you want to ${action.toLowerCase()} this leave request?`, "confirm", async () => {
      try {
        await updateDoc(doc(db, 'leaves', leaveId), { status: action === 'Approve' ? 'Approved' : 'Rejected', updatedAt: serverTimestamp() });
        showMessage(`Leave request ${action.toLowerCase()}d!`, "success");
      } catch (error) { showMessage("Action failed.", "error"); }
    });
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if(newPassword.length < 6) return showCustomDialog("Error", "Password must be at least 6 characters.", 'alert');
    showCustomDialog("Change Password", "Are you sure you want to change your password?", "confirm", async () => {
      setLoading(true);
      try { await updatePassword(auth.currentUser, newPassword); setNewPassword(''); showMessage("Password updated!", 'success'); } 
      catch (e) { showCustomDialog("Error", e.message, 'alert'); }
      setLoading(false);
    });
  };

  const handleLogout = () => { showCustomDialog("Logout", "Are you sure you want to logout?", "confirm", async () => { await signOut(auth); navigate('/'); }); };

  const navItems = [
    { id: 'home', name: 'Dashboard Home', icon: <LayoutDashboard size={20} /> },
    { id: 'students', name: 'Student Financials', icon: <DollarSign size={20} /> },
    { id: 'faculty', name: 'Faculty Reports', icon: <Briefcase size={20} /> },
    { id: 'clearance', name: 'Exam Clearances', icon: <FileCheck size={20} /> },
    { id: 'reports', name: 'Batch Reports', icon: <PieChart size={20} /> },
    { id: 'leaves', name: 'Leave Management', icon: <CalendarOff size={20} /> },
    { id: 'settings', name: 'Security', icon: <Settings size={20} /> }
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 relative">
      
      {/* 🚀 Dynamic Print CSS for Admit Card (1x4 Grid) & Reports */}
      <style type="text/css" media="print">
        {`
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
          ::-webkit-scrollbar { display: none; }
          .print-hidden { display: none !important; }
          .print-block { display: block !important; }
          
          /* Admit Card Grid: 1 Column, 4 Rows (4 Per Page) */
          .admit-card-container { display: flex; flex-direction: column; width: 100%; height: 100%; }
          .admit-card { height: 23vh; border: 2px solid #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 2vh; page-break-inside: avoid; background: #fff; display: flex; flex-direction: column; justify-content: space-between; }
          .admit-card:nth-child(4n) { margin-bottom: 0; page-break-after: always; }
          
          /* Student Profile Report Table Print Styles */
          .print-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .print-table th, .print-table td { border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; text-align: left; }
          .print-table th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
        `}
      </style>

      {/* --- CUSTOM DIALOG UI --- */}
      {uiDialog.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:hidden">
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
      <aside className="w-64 bg-[#0f172a] flex-col hidden md:flex z-20 shrink-0 shadow-xl border-r border-slate-800 print:hidden text-slate-300">
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-[#020617]">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center mr-3 text-white font-bold text-xl">AC</div>
          <div><h2 className="text-lg font-bold tracking-tight text-white">Accounts Portal</h2><p className="text-emerald-400 text-xs font-medium">CNIEDU</p></div>
        </div>
        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setSelectedStudent(null); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === item.id || (activeTab === 'profile' && item.id === 'students') ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
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
            <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-[#020617]">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center mr-3 text-white font-bold text-sm">AC</div>
                <h2 className="text-base font-bold text-white">Accounts Portal</h2>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="flex-1 py-4 px-3 space-y-2 overflow-y-auto custom-scrollbar">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setSelectedStudent(null); setIsMobileMenuOpen(false); }} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium ${activeTab === item.id || (activeTab === 'profile' && item.id === 'students') ? 'bg-emerald-600 text-white' : ''}`}>
                  {item.icon} <span>{item.name}</span>
                </button>
              ))}
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-[#020617] mt-auto">
              <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-rose-600/10 hover:bg-rose-600 text-rose-500 px-4 py-3 rounded-xl transition-all font-bold">
                <LogOut size={18} /><span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden w-full print:bg-white print:overflow-visible">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 shadow-sm print:hidden">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 bg-slate-100 rounded-lg md:hidden"><Menu size={20} /></button>
            <h1 className="text-xl font-bold text-slate-900 sm:block hidden capitalize">{activeTab === 'profile' ? 'Management Window' : navItems.find(n => n.id === activeTab)?.name}</h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{accountantData.name}</p>
              <p className="text-xs font-semibold text-emerald-600 uppercase">Accountant Profile</p>
            </div>
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-bold">{accountantInitials}</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 w-full print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto space-y-6">

            {message.text && (
              <div className={`p-4 rounded-xl flex items-center space-x-3 text-sm font-bold print:hidden ${message.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                <CheckCircle size={18}/>
                <span>{message.text}</span>
              </div>
            )}

            {/* --- TAB 1: HOME --- */}
            {activeTab === 'home' && (
              <div className="space-y-6 print:hidden">
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Welcome, {accountantData.name}!</h1>
                  <p className="text-slate-500 mt-2 font-medium">Manage student financial sheets seamlessly.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-indigo-300 transition-all" onClick={() => setActiveTab('students')}>
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={24}/></div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Students Active</p><h3 className="text-xl font-black text-slate-900">{students.length}</h3></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-emerald-300 transition-all" onClick={() => setActiveTab('reports')}>
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><PieChart size={24}/></div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Batch Matrix</p><h3 className="text-sm font-bold text-emerald-600 mt-1">View Statements</h3></div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 cursor-pointer hover:border-amber-300 transition-all" onClick={() => setActiveTab('leaves')}>
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-xl"><CalendarOff size={24}/></div>
                    <div><p className="text-slate-500 text-xs font-bold uppercase">Pending Leaves</p><h3 className="text-2xl font-black text-slate-900">{leaveRequests.length}</h3></div>
                  </div>
                </div>

                {/* ADMIN ACTION REQUESTS LIST */}
                <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-lg text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center"><Activity size={18} className="mr-2 text-indigo-600"/> Admin Approval Requests Status</h3>
                  <div className="space-y-3">
                    {adminRequests.length === 0 ? (
                      <p className="text-sm text-slate-500">No pending requests sent to System Admin.</p>
                    ) : (
                      adminRequests.map(req => (
                        <div key={req.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                          <div>
                            <p className="text-sm font-bold text-slate-800">Deletion Request: {req.studentName} ({req.paymentData?.type})</p>
                            <p className="text-xs text-slate-500 mt-1">Amount: ৳{req.paymentData?.amount} | Date: {req.paymentData?.date}</p>
                          </div>
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-200 flex items-center">
                            <Clock size={14} className="mr-1.5"/> Pending Admin Action
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- TAB 2: STUDENT FINANCIALS (LIST) --- */}
            {activeTab === 'students' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
                <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="w-full sm:w-auto">
                    <h2 className="text-lg font-bold text-slate-900">Search Students Directory</h2>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Search parameters..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-900 text-white text-[10px] font-bold uppercase">
                      <tr>
                        <th className="px-6 py-4">Student Identity</th>
                        <th className="px-6 py-4">Batch Allocation</th>
                        <th className="px-6 py-4 text-right">Action Loop</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(student => (
                        <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900 text-base">{student.name}</p>
                            <p className="text-xs text-slate-500 font-mono">ID: {student.studentId}</p>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{getBatchName(student.batchId)}</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => openStudentProfile(student)} className="bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white px-4 py-1.5 rounded-lg font-bold text-xs border border-emerald-100 transition-all">
                              Manage Fees
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredStudents.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500">No students found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- TAB 3: INDIVIDUAL PROFILE MANAGEMENT --- */}
            {activeTab === 'profile' && selectedStudent && studentFinances && (
              <div className="space-y-6 print:m-0 print:p-0">
                <div className="flex flex-col sm:flex-row justify-between items-center print:hidden gap-4">
                  <button onClick={() => setActiveTab('students')} className="text-sm font-bold text-emerald-600 hover:text-emerald-800 flex items-center w-full sm:w-auto">
                    ← Back to Student List
                  </button>
                  <button onClick={() => window.print()} className="flex items-center justify-center space-x-2 bg-slate-900 text-white px-5 py-2 rounded-lg font-bold hover:bg-slate-800 transition-all w-full sm:w-auto">
                    <Printer size={16} /><span>Print Official Report</span>
                  </button>
                </div>

                {/* Print Context Banner */}
                <div className="hidden print:block text-center border-b pb-4 mb-6">
                  <h1 className="text-2xl font-black uppercase">City Nursing Institute, Rangpur</h1>
                  <h2 className="text-lg font-bold text-slate-700 mt-2">Official Financial & Academic Report</h2>
                  
                  <div className="mt-8 grid grid-cols-2 gap-4 text-left text-sm border border-slate-800 p-6 rounded-lg bg-slate-50">
                    <div>
                      <p className="mb-2"><span className="font-bold">Student Name:</span> {selectedStudent.name}</p>
                      <p className="mb-2"><span className="font-bold">Student ID:</span> {selectedStudent.studentId}</p>
                      <p className="mb-2"><span className="font-bold">Batch:</span> {getBatchName(selectedStudent.batchId)}</p>
                      <p className="mb-2"><span className="font-bold">Contact:</span> {selectedStudent.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="mb-2"><span className="font-bold">Father's Name:</span> {selectedStudent.fathersName || 'N/A'}</p>
                      <p className="mb-2"><span className="font-bold">Mother's Name:</span> {selectedStudent.mothersName || 'N/A'}</p>
                      <p className="mb-2"><span className="font-bold">Attendance:</span> {getDailyAttendanceStats(selectedStudent.id).perc}%</p>
                      <p className="mb-2"><span className="font-bold">Report Date:</span> {new Date().toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                </div>

                {/* Profile UI Header */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                  <div className="text-center sm:text-left">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                    <p className="text-sm text-slate-500 font-mono mt-1">ID: {selectedStudent.studentId} | Batch: {getBatchName(selectedStudent.batchId)}</p>
                  </div>
                  <div className="text-center sm:text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance</p>
                    <p className="text-2xl font-black text-emerald-600">{getDailyAttendanceStats(selectedStudent.id).perc}%</p>
                  </div>
                </div>

                {/* --- TOP ROW: COURSE FEE SUMMARY --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">Total Course Fee</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">৳{studentFinances.totalCourseFee || 0}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">Total Fees Paid</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">৳{totalCourseFeesPaid}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center bg-slate-50">
                    <p className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">Course Fee Due</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">৳{courseFeeDue}</p>
                  </div>
                </div>

                {/* --- SECOND ROW: FINE SUMMARY --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">Total Fines Assigned</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">৳{studentFinances.finesTotal || 0}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
                    <p className="text-slate-400 text-[11px] uppercase font-bold tracking-wider">Total Fines Paid</p>
                    <p className="text-xl font-bold text-emerald-600 mt-1">৳{studentFinances.finesPaid || 0}</p>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center bg-rose-50/50 border-rose-100">
                    <p className="text-rose-500 text-[11px] uppercase font-bold tracking-wider">Current Fine Dues</p>
                    <p className="text-2xl font-black text-rose-600 mt-1">৳{currentCalculatedFineDue}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1 print:gap-8">
                  
                  {/* FEE LOCK CONTROL SYSTEM */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-full">
                    <h3 className="font-bold text-sm uppercase tracking-wider mb-4 flex items-center text-slate-700"><Lock size={16} className="mr-2 text-indigo-500"/> Master Fee Formulation</h3>
                    <div className="space-y-4 print:hidden w-full">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Total Course Fee (৳)</label>
                        <input type="number" id="courseFee" disabled={studentFinances.isFeeLocked} defaultValue={studentFinances.totalCourseFee || ''} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-bold disabled:bg-slate-100 disabled:text-slate-500" placeholder="e.g. 150000" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Admission Target (৳)</label>
                          <input type="number" id="admFeeTotal" disabled={studentFinances.isFeeLocked} defaultValue={studentFinances.admissionFeeTotal || ''} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-bold disabled:bg-slate-100 disabled:text-slate-500" placeholder="e.g. 30000" />
                        </div>
                      </div>
                      
                      {!studentFinances.isFeeLocked ? (
                        <button onClick={lockTotalFee} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl mt-4 shadow-md transition-all">Lock & Save Master Fees</button>
                      ) : (
                        <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold flex items-center justify-center">
                          <CheckCircle size={16} className="mr-2"/> Master Fees Locked
                        </div>
                      )}
                    </div>

                    {/* Auto Calculations Summary (Visible in Print & UI) */}
                    {studentFinances.isFeeLocked && (
                      <div className="mt-6 p-4 sm:p-5 bg-slate-900 text-white rounded-xl space-y-3 print:bg-white print:text-black print:border print:border-slate-300 w-full">
                        <div className="flex justify-between text-sm"><span className="text-slate-400 print:text-slate-700">Master Course Fee:</span> <span className="font-bold">৳{studentFinances.totalCourseFee}</span></div>
                        
                        <div className="flex justify-between text-sm"><span className="text-slate-400 print:text-slate-700">Total Admission Paid:</span> <span className="font-bold text-emerald-400 print:text-emerald-700">৳{studentFinances.admissionFeePaid || 0}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-400 print:text-slate-700">Total Monthly Paid:</span> <span className="font-bold text-emerald-400 print:text-emerald-700">৳{studentFinances.monthlyPaidTotal || 0}</span></div>
                        
                        <div className="flex justify-between text-sm border-t border-slate-700 pt-3 mt-2"><span className="text-slate-400 print:text-slate-700">Total Course Fee Due:</span> <span className="font-bold text-amber-400 print:text-amber-700">৳{courseFeeDue}</span></div>

                        <div className="flex justify-between text-sm border-t border-slate-700 pt-3"><span className="text-slate-400 print:text-slate-700">Total Fines Assigned:</span> <span className="font-bold text-rose-400 print:text-rose-700">৳{studentFinances.finesTotal || 0}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-400 print:text-slate-700">Total Fines Paid:</span> <span className="font-bold">৳{studentFinances.finesPaid || 0}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-400 print:text-slate-700">Current Fine Dues:</span> <span className="font-bold text-rose-500 print:text-rose-700">৳{currentCalculatedFineDue}</span></div>
                      </div>
                    )}
                  </div>

                  {/* PAYMENT ENTRY UI (Hidden in print) */}
                  <div className="flex flex-col gap-6 print:hidden w-full">
                    
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center"><AlertTriangle size={16} className="mr-2 text-rose-600"/> Add Manual Fine</h3>
                      <div className="flex gap-2">
                        <input type="number" value={additionalFine} onChange={e => setAdditionalFine(e.target.value)} className="flex-1 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-rose-500 font-bold text-rose-700" placeholder="Amount" />
                        <button onClick={applyAdditionalFine} disabled={loading} className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg transition-all disabled:opacity-50">Apply Fine</button>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1">
                      <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><CreditCard size={18} className="mr-2 text-emerald-600"/> Record New Payment</h3>
                      
                      <div className="space-y-4 flex-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Payment Category</label>
                          <select value={paymentEntry.type} onChange={e => handlePaymentCategoryChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none font-bold text-slate-700">
                            <option value="Monthly Course Fee">Monthly Course Fee</option>
                            <option value="Admission Fee">Admission Fee</option>
                            <option value="Hostel Fee">Hostel Fee</option>
                            <option value="Fine Payment">Fine Payment</option>
                            <option value="Additional Fee">Other Additional Fee</option>
                          </select>
                        </div>

                        {paymentEntry.type === 'Fine Payment' && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800">
                            ⚠️ STRICT REQUIREMENT: Total outstanding fine (৳{currentCalculatedFineDue}) must be paid in full to clear the dues.
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Payment Amount (৳)</label>
                          <input type="number" value={paymentEntry.amount} onChange={e => setPaymentEntry({...paymentEntry, amount: e.target.value})} disabled={paymentEntry.type === 'Fine Payment'} className="w-full bg-white border border-emerald-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-lg disabled:bg-slate-100 disabled:text-rose-600 disabled:border-rose-200" placeholder="Enter amount" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Note / Description (Optional)</label>
                          <input type="text" value={paymentEntry.note} onChange={e => setPaymentEntry({...paymentEntry, note: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none font-medium" placeholder="e.g. November Hostel Rent" />
                        </div>
                      </div>
                      
                      <button onClick={processPayment} disabled={loading || !studentFinances.isFeeLocked} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl mt-6 shadow-md transition-all disabled:opacity-50">
                        Record Payment
                      </button>
                    </div>
                  </div>
                </div>

                {/* PAYMENT HISTORY TABLE (Visible in UI and Print) */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mt-8 w-full">
                  <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center">Payment History & Details</h3>
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-sm whitespace-nowrap print-table min-w-[500px]">
                      <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Payment Category</th>
                          <th className="px-4 py-3">Note / Details</th>
                          <th className="px-4 py-3 text-right">Amount (৳)</th>
                          <th className="px-4 py-3 text-center print-hidden">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentFinances.payments && studentFinances.payments.length > 0 ? (
                          [...studentFinances.payments].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map((pay, i) => (
                            <tr key={pay.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-700">{pay.date}</td>
                              <td className="px-4 py-3 font-bold text-indigo-700">{pay.type}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs">{pay.note || '-'}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900">৳{pay.amount}</td>
                              <td className="px-4 py-3 text-center print-hidden">
                                <button onClick={() => requestPaymentDeletion(pay)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all" title="Request Deletion Access">
                                  <Trash2 size={14}/>
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan="5" className="p-8 text-center text-slate-500">No payment records found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="hidden print:flex mt-20 justify-between px-10">
                    <div className="border-t-2 border-slate-800 pt-2 font-bold text-sm">Accountant Signature & Seal</div>
                    <div className="border-t-2 border-slate-800 pt-2 font-bold text-sm">Authority Signature</div>
                  </div>
                </div>

              </div>
            )}

            {/* --- TAB 4: FACULTY REPORTS --- */}
            {activeTab === 'faculty' && (
              <div className="space-y-6 animate-in fade-in print:m-0">
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end justify-between print:hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Select Faculty</label>
                      <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-700">
                        <option value="">-- Choose teacher --</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Target Month</label>
                      <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-700" />
                    </div>
                  </div>
                  {selectedTeacherId && (
                    <button onClick={() => window.print()} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs flex justify-center items-center shadow-md mt-4 md:mt-0"><Printer size={14} className="mr-1.5"/>Print Faculty Report</button>
                  )}
                </div>

                {selectedTeacherId && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
                    <div className="hidden print:block text-center mt-4 border-b-2 border-slate-800 pb-3">
                      <h1 className="text-xl font-black uppercase">City Nursing Institute, Rangpur</h1>
                      <h2 className="text-sm font-bold text-slate-700 tracking-wide mt-1">Faculty Class Performance Ledger</h2>
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 text-left mt-2 px-2">
                        <p>Faculty Name: {teachers.find(t=>t.id === selectedTeacherId)?.name}</p>
                        <p>Period: {reportMonth}</p>
                      </div>
                    </div>

                    <div className="p-5 border-b border-slate-100 bg-slate-50 print:hidden">
                      <h3 className="font-bold text-slate-800">Classes Logged: {new Date(reportMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h3>
                      <p className="text-xs text-slate-500 mt-1">Details of sessions taken by this faculty. Useful for payroll verification.</p>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-xs whitespace-nowrap print-table min-w-[700px]">
                        <thead className="bg-slate-900 text-white font-bold uppercase print:bg-slate-200 print:text-slate-900">
                          <tr>
                            <th className="p-3">Session Date & Time</th>
                            <th className="p-3">Course / Module</th>
                            <th className="p-3">Target Batch</th>
                            <th className="p-3 text-center border-l border-slate-700">Total Students</th>
                            <th className="p-3 text-center">Present Count</th>
                            <th className="p-3 text-center bg-indigo-900 print:bg-indigo-100">Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const facultySessions = attendanceData.filter(d => d.recordedBy === selectedTeacherId && d.date.startsWith(reportMonth)).sort((a,b) => a.timestamp - b.timestamp);
                            if(facultySessions.length === 0) return <tr><td colSpan="6" className="p-6 text-center text-slate-500">No sessions recorded this month.</td></tr>;
                            
                            return facultySessions.map(session => {
                              const d = new Date(session.timestamp);
                              const fDate = `${d.getDate()}/${d.getMonth()+1} - ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
                              
                              let total = 0, p = 0;
                              if(session.records) {
                                total = Object.keys(session.records).length;
                                Object.values(session.records).forEach(val => { if(val === 'present') p++; });
                              }
                              const perc = total === 0 ? 0 : Math.round((p/total)*100);

                              return (
                                <tr key={session.id} className="border-b border-slate-100 hover:bg-slate-50">
                                  <td className="p-3 font-bold text-slate-800">{fDate}</td>
                                  <td className="p-3 font-bold text-indigo-700">{getCourseName(session.courseId)}</td>
                                  <td className="p-3 font-semibold text-slate-600">{getBatchName(session.batchId)}</td>
                                  <td className="p-3 text-center font-bold border-l border-slate-100">{total}</td>
                                  <td className="p-3 text-center font-bold text-emerald-600">{p}</td>
                                  <td className="p-3 text-center font-bold text-indigo-700 bg-indigo-50 print:bg-transparent">{perc}%</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 print:bg-slate-100">
                          <tr>
                            <td colSpan="3" className="p-3 text-right font-bold text-slate-800 uppercase text-xs">Total Valid Sessions Taken:</td>
                            <td className="p-3 text-center font-black text-indigo-700 text-lg border-l border-slate-200">
                              {attendanceData.filter(d => d.recordedBy === selectedTeacherId && d.date.startsWith(reportMonth)).length}
                            </td>
                            <td colSpan="2"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 5: EXAM CLEARANCES & ADMIT CARDS --- */}
            {activeTab === 'clearance' && (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between print:hidden">
                  <div className="w-full md:w-1/2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Batch Filter</label>
                    <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-700">
                      <option value="">-- Select batch allocation --</option>
                      {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                {selectedBatchId && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none print:bg-transparent">
                    <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                      <div className="text-center sm:text-left">
                        <h3 className="font-bold text-xs uppercase text-slate-700 tracking-widest">Exam Eligibility Stream Mapping</h3>
                      </div>
                      <button onClick={() => window.print()} className="bg-slate-900 w-full sm:w-auto text-white px-4 py-1.5 rounded-lg font-bold text-xs flex justify-center items-center"><Printer size={14} className="mr-1.5"/>Print Stack</button>
                    </div>

                    <div className="overflow-x-auto w-full print:hidden">
                      <table className="w-full text-left text-xs whitespace-nowrap min-w-[700px]">
                        <thead className="bg-slate-900 text-white uppercase font-bold">
                          <tr>
                            <th className="px-6 py-3">Student Identity</th>
                            <th className="px-6 py-3 text-center">Fines Outstanding</th>
                            <th className="px-6 py-3 text-right">Exam Clearance Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.filter(s => s.batchId === selectedBatchId).map(student => {
                            const stats = getDailyAttendanceStats(student.id);
                            const fin = allFinancials[student.id] || {};
                            const fineDue = (fin.finesTotal || 0) - (fin.finesPaid || 0);
                            const eligible = (stats.perc >= 60 && fineDue <= 0) || fin.manualClearance;
                            
                            return (
                              <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-6 py-3">
                                  <p className="font-bold text-slate-900">{student.name}</p>
                                  <p className="font-mono text-[10px] text-slate-400">ID: {student.studentId}</p>
                                </td>
                                <td className="px-6 py-3 text-center font-bold text-rose-600">{fineDue > 0 ? `৳${fineDue}` : 'None'}</td>
                                <td className="px-6 py-3 text-right">
                                  {eligible ? (
                                    <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">Cleared {fin.manualClearance ? '(Override)' : ''}</span>
                                  ) : (
                                    <div className="inline-flex flex-wrap justify-end gap-2">
                                      {fineDue > 0 && (
                                        <button onClick={() => payFineFromClearance(student.id, fineDue)} disabled={loading} className="bg-emerald-600 text-white px-3 py-1 rounded font-bold hover:bg-emerald-700 disabled:opacity-50">Pay & Clear</button>
                                      )}
                                      <button onClick={() => grantManualClearance(student.id)} disabled={loading} className="bg-slate-900 text-white px-3 py-1 rounded font-bold hover:bg-slate-800 disabled:opacity-50">Override</button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* --- 1x4 ADMIT CARD TEMPLATE (HIDDEN UNLESS PRINTING) --- */}
                    <div className="hidden print:block w-full h-full">
                       <div className="admit-card-container">
                          {students.filter(s => s.batchId === selectedBatchId).map(student => {
                            const stats = getDailyAttendanceStats(student.id);
                            const fin = allFinancials[student.id] || {};
                            const fineDue = (fin.finesTotal || 0) - (fin.finesPaid || 0);
                            const eligible = (stats.perc >= 60 && fineDue <= 0) || fin.manualClearance;
                            
                            if (!eligible) return null; 

                            return (
                              <div key={`admit-${student.id}`} className="admit-card">
                                <div className="flex flex-row justify-between items-center w-full">
                                  <div className="flex items-center w-1/2 border-r border-slate-300 pr-4">
                                    <div className="w-14 h-14 bg-slate-100 flex items-center justify-center border border-black p-0.5 mr-4 shrink-0">
                                      <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                                    </div>
                                    <div>
                                      <h1 className="text-base font-black uppercase tracking-widest leading-tight">City Nursing Institute</h1>
                                      <h2 className="text-[10px] font-bold text-slate-700 tracking-widest uppercase">Official Examination Admit Document</h2>
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 pl-4 space-y-1 text-xs">
                                    <div className="flex justify-between border-b border-dashed border-slate-400 pb-0.5">
                                      <span className="font-bold">Candidate:</span> <span className="font-bold uppercase">{student.name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-400 pb-0.5">
                                      <span className="font-bold">ID Ref:</span> <span>{student.studentId}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-400 pb-0.5">
                                      <span className="font-bold">Allocation Batch:</span> <span>{getBatchName(selectedBatchId)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-400 pb-0.5">
                                      <span className="font-bold">Session Frame:</span> <span className="font-bold text-[10px] tracking-widest uppercase">Midterm / Final</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex justify-between px-8">
                                  <span className="border-t border-slate-400 pt-0.5 w-24 text-center text-[10px] font-bold">Student Token Sign</span>
                                  <span className="border-t border-slate-400 pt-0.5 w-24 text-center text-[10px] font-bold">Controller Signature</span>
                                </div>
                              </div>
                            )
                          })}
                       </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* --- TAB 6: BATCH MONTHLY REPORTS SYSTEM --- */}
            {activeTab === 'reports' && (
              <div className="space-y-6 animate-in fade-in print:m-0">
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end justify-between print:hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Batch Registry Selection</label>
                      <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-700">
                        <option value="">-- Select target target --</option>
                        {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Accounting Timeline Target</label>
                      <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold text-slate-700" />
                    </div>
                  </div>
                  {selectedBatchId && (
                    <button onClick={() => window.print()} className="w-full md:w-auto flex justify-center items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md mt-4 md:mt-0"><Printer size={14} className="mr-1.5"/>Generate Hardcopy Report</button>
                  )}
                </div>

                {selectedBatchId && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
                    <div className="flex flex-col sm:flex-row p-1 bg-slate-100 border-b print:hidden">
                      <button onClick={() => setReportType('attendance')} className={`flex-1 py-3 text-xs font-bold rounded-lg ${reportType === 'attendance' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Attendance Fine Stream Report</button>
                      <button onClick={() => setReportType('collection')} className={`flex-1 py-3 text-xs font-bold rounded-lg ${reportType === 'collection' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Monthly Collection Ledger Report</button>
                    </div>

                    <div className="hidden print:block text-center mt-4 border-b-2 border-slate-800 pb-3">
                      <h1 className="text-xl font-black uppercase">City Nursing Institute, Rangpur</h1>
                      <h2 className="text-sm font-bold text-slate-700 tracking-wide mt-1">
                        {reportType === 'attendance' ? 'Fine Generation Summary Sheet' : 'Comprehensive Multi-Fee Collection Reconciliation Sheet'}
                      </h2>
                      <div className="flex justify-between text-[10px] font-bold text-slate-500 text-left mt-2 px-2">
                        <p>Batch: {getBatchName(selectedBatchId)} | Period: {reportMonth}</p>
                        <p>Date Printed: {new Date().toLocaleDateString('en-GB')}</p>
                      </div>
                    </div>

                    {reportType === 'attendance' && (
                      <div className="w-full">
                        <div className="p-4 bg-slate-50 border-b flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                          <p className="text-xs font-bold text-slate-500 text-center sm:text-left">Monthly Fine Processing Engine</p>
                          <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <input type="number" value={reportFineRate} onChange={(e) => setReportFineRate(Number(e.target.value))} className="w-full sm:w-20 px-2 py-1 text-center bg-white border font-bold text-rose-600 rounded" />
                            <button onClick={applyMonthlyFinesToBatch} disabled={loading} className="w-full sm:w-auto bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg whitespace-nowrap disabled:opacity-50">Apply Fine System</button>
                          </div>
                        </div>
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left text-xs whitespace-nowrap print-table min-w-[600px]">
                            <thead className="bg-slate-900 text-white font-bold uppercase print:bg-slate-200 print:text-slate-900">
                              <tr>
                                <th className="p-3">Student Identity</th>
                                <th className="p-3 text-center">Missed Days Count</th>
                                <th className="p-3">Dates Missed Context Sequence</th>
                                <th className="p-3 text-right border-l border-slate-700">Potential Month Fine</th>
                              </tr>
                            </thead>
                            <tbody>
                              {students.filter(s => s.batchId === selectedBatchId).map(student => {
                                const missedDates = getMonthlyMissedClasses(student.id, reportMonth);
                                return (
                                  <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-3 font-bold">{student.name} ({student.studentId})</td>
                                    <td className="p-3 text-center font-bold text-rose-600">{missedDates.length}</td>
                                    <td className="p-3 font-semibold text-slate-600 max-w-[220px] break-words whitespace-normal leading-relaxed">{missedDates.length > 0 ? formatMissedDates(missedDates) : '-'}</td>
                                    <td className="p-3 text-right font-bold text-rose-600 border-l border-slate-100 bg-rose-50 print:bg-transparent">৳{missedDates.length * reportFineRate}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200 print:bg-slate-200">
                              <tr>
                                <td colSpan="3" className="p-3 text-right font-bold text-slate-800 uppercase text-xs">Total Batch Fine Gen:</td>
                                <td className="p-3 text-right font-black text-rose-700 text-base border-l border-slate-200">
                                  ৳{students.filter(s => s.batchId === selectedBatchId).reduce((total, student) => {
                                    return total + (getMonthlyMissedClasses(student.id, reportMonth).length * reportFineRate);
                                  }, 0)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {reportType === 'collection' && (
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-xs whitespace-nowrap print-table min-w-[700px]">
                          <thead className="bg-slate-900 text-white font-bold uppercase print:bg-slate-200 print:text-slate-900">
                            <tr>
                              <th className="p-3">Student Context Info</th>
                              <th className="p-3 text-right">Monthly Course Fee Paid</th>
                              <th className="p-3 text-right">Admission Paid</th>
                              <th className="p-3 text-right">Fine Paid</th>
                              <th className="p-3 text-right">Hostel Rent Paid</th>
                              <th className="p-3 text-right">Additional Allocated Fees</th>
                              <th className="p-3 text-right bg-emerald-900 border-l border-slate-700 print:bg-slate-100">Sub Total Collection</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.filter(s => s.batchId === selectedBatchId).map(student => {
                              const fin = allFinancials[student.id] || { payments: [] };
                              const targetedMonthlyPayments = (fin.payments || []).filter(p => p.isoDate?.startsWith(reportMonth));
                              
                              let courseFeeSum = 0, admissionFeeSum = 0, fineFeeSum = 0, hostelFeeSum = 0, additionalFeeSum = 0;
                              
                              targetedMonthlyPayments.forEach(p => {
                                if (p.type === 'Monthly Course Fee') courseFeeSum += p.amount;
                                else if (p.type === 'Admission Fee') admissionFeeSum += p.amount;
                                else if (p.type === 'Fine Payment') fineFeeSum += p.amount;
                                else if (p.type === 'Hostel Fee') hostelFeeSum += p.amount;
                                else additionalFeeSum += p.amount;
                              });

                              const finalCombinedRowSum = courseFeeSum + admissionFeeSum + fineFeeSum + hostelFeeSum + additionalFeeSum;

                              return (
                                <tr key={student.id} className="border-b border-slate-100 font-medium hover:bg-slate-50">
                                  <td className="p-3 font-bold text-slate-900">{student.name}<p className="font-mono text-[9px] text-slate-400 font-normal">ID: {student.studentId}</p></td>
                                  <td className="p-3 text-right text-slate-700">৳{courseFeeSum}</td>
                                  <td className="p-3 text-right text-slate-700">৳{admissionFeeSum}</td>
                                  <td className="p-3 text-right text-rose-600 font-bold">৳{fineFeeSum}</td>
                                  <td className="p-3 text-right text-slate-700">৳{hostelFeeSum}</td>
                                  <td className="p-3 text-right text-slate-700">৳{additionalFeeSum}</td>
                                  <td className="p-3 text-right font-black text-emerald-700 bg-emerald-50/40 border-l border-slate-100 print:bg-transparent">৳{finalCombinedRowSum}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot className="bg-slate-900 text-white font-bold print:bg-slate-100 print:text-black">
                            <tr>
                              <td className="p-3 uppercase tracking-wider text-[10px]">Reconciliation Totals:</td>
                              <td className="p-3 text-right">
                                ৳{students.filter(s => s.batchId === selectedBatchId).reduce((sum, s) => {
                                  const p = (allFinancials[s.id]?.payments || []).filter(x => x.isoDate?.startsWith(reportMonth));
                                  return sum + p.reduce((a, b) => a + (b.type === 'Monthly Course Fee' ? b.amount : 0), 0);
                                }, 0)}
                              </td>
                              <td className="p-3 text-right">
                                ৳{students.filter(s => s.batchId === selectedBatchId).reduce((sum, s) => {
                                  const p = (allFinancials[s.id]?.payments || []).filter(x => x.isoDate?.startsWith(reportMonth));
                                  return sum + p.reduce((a, b) => a + (b.type === 'Admission Fee' ? b.amount : 0), 0);
                                }, 0)}
                              </td>
                              <td className="p-3 text-right text-rose-400 print:text-rose-600">
                                ৳{students.filter(s => s.batchId === selectedBatchId).reduce((sum, s) => {
                                  const p = (allFinancials[s.id]?.payments || []).filter(x => x.isoDate?.startsWith(reportMonth));
                                  return sum + p.reduce((a, b) => a + (b.type === 'Fine Payment' ? b.amount : 0), 0);
                                }, 0)}
                              </td>
                              <td className="p-3 text-right">
                                ৳{students.filter(s => s.batchId === selectedBatchId).reduce((sum, s) => {
                                  const p = (allFinancials[s.id]?.payments || []).filter(x => x.isoDate?.startsWith(reportMonth));
                                  return sum + p.reduce((a, b) => a + (b.type === 'Hostel Fee' ? b.amount : 0), 0);
                                }, 0)}
                              </td>
                              <td className="p-3 text-right">
                                ৳{students.filter(s => s.batchId === selectedBatchId).reduce((sum, s) => {
                                  const p = (allFinancials[s.id]?.payments || []).filter(x => x.isoDate?.startsWith(reportMonth));
                                  return sum + p.reduce((a, b) => a + ((b.type !== 'Monthly Course Fee' && b.type !== 'Admission Fee' && b.type !== 'Fine Payment' && b.type !== 'Hostel Fee') ? b.amount : 0), 0);
                                }, 0)}
                              </td>
                              <td className="p-3 text-right text-emerald-400 print:text-emerald-700 text-sm font-black border-l border-slate-700 print:border-slate-300">
                                ৳{students.filter(s => s.batchId === selectedBatchId).reduce((sum, s) => {
                                  const p = (allFinancials[s.id]?.payments || []).filter(x => x.isoDate?.startsWith(reportMonth));
                                  return sum + p.reduce((a, b) => a + b.amount, 0);
                                }, 0)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* --- TAB 7: LEAVE ROUTING BOARD --- */}
            {activeTab === 'leaves' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
                <div className="p-4 sm:p-6 bg-slate-50 border-b">
                  <h2 className="text-lg font-bold text-slate-900">Intercepted Student Absentee Disqualification Exceptions</h2>
                </div>
                <div className="divide-y">
                  {leaveRequests.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">Clear database tracking ledger. No pending exceptions.</div>
                  ) : (
                    leaveRequests.map(leave => {
                      const student = students.find(s => s.id === leave.studentId);
                      return (
                        <div key={leave.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50">
                          <div>
                            <h4 className="font-bold text-slate-900">{student?.name} ({student?.studentId})</h4>
                            <p className="text-xs font-bold text-indigo-600 mt-1">Timeline Exemption Date: {leave.date}</p>
                            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded border border-slate-200">" {leave.reason} "</p>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={() => handleLeaveAction(leave.id, 'Approve')} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">Approve</button>
                            <button onClick={() => handleLeaveAction(leave.id, 'Reject')} className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">Reject</button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 8: SECURITY INTERFACE --- */}
            {activeTab === 'settings' && (
              <div className="max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:hidden">
                <h3 className="font-bold text-sm uppercase tracking-wider mb-4">Update Terminal Integrity Passwords</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 alpha characters" className="w-full text-sm border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button type="submit" className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-all">Execute Mutation Change</button>
                </form>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
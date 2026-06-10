import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where, getDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, Layers, Database, Briefcase, TrendingUp, 
  Wallet, AlertCircle, CheckCircle, GraduationCap, BarChart3, 
  CreditCard, Printer, CalendarDays, ArrowRightLeft
} from 'lucide-react';

export default function AdministrativeTask() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Layout States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  
  // Active Tab
  const [activeTab, setActiveTab] = useState('financials'); 
  const [loading, setLoading] = useState(true);

  // Raw Data States
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [financials, setFinancials] = useState([]);
  const [attendance, setAttendance] = useState([]);

  // Transaction Filters
  const [revenueSearchQuery, setRevenueSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');

  // Faculty Payment States (Local Calculation)
  const [teacherRates, setTeacherRates] = useState({});

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

    // Fetch All Collections
    const unSubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), (s) => setStudents(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unSubTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (s) => setTeachers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unSubBatches = onSnapshot(collection(db, 'batches'), (s) => setBatches(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unSubCourses = onSnapshot(collection(db, 'courses'), (s) => setCourses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unSubFin = onSnapshot(collection(db, 'financials'), (s) => setFinancials(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unSubAtt = onSnapshot(collection(db, 'attendance'), (s) => setAttendance(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
      unsubscribeAuth(); unSubStudents(); unSubTeachers(); unSubBatches(); unSubCourses(); unSubFin(); unSubAtt(); clearTimeout(timer);
    };
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const handlePrint = () => {
    window.print();
  };

  // --- EXTRACT PAYMENTS FROM NESTED FINANCIALS ARRAY ---
  const allPayments = useMemo(() => {
    let pays = [];
    financials.forEach(fin => {
      if (fin.payments && Array.isArray(fin.payments)) {
        fin.payments.forEach(p => {
          pays.push({
            ...p,
            studentUid: fin.id // Connect payment to student
          });
        });
      }
    });

    // Sort by timestamp (Newest First)
    pays.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return pays;
  }, [financials]);

  // --- DATE HELPER FUNCTION ---
  const getMonthYear = (pay) => {
    if (pay.isoDate) {
      const parts = pay.isoDate.split('-');
      if (parts.length >= 3) return `${parts[1]}/${parts[0]}`; // MM/YYYY
    }
    if (pay.date && pay.date.includes('/')) {
      const parts = pay.date.split('/');
      if(parts.length >= 3) return `${parts[1]}/${parts[2]}`; // MM/YYYY
    }
    return 'Unknown';
  };

  const formatCurrency = (amount) => `৳${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // --- 1. FINANCIAL ANALYTICS (GLOBAL) ---
  const globalFin = useMemo(() => {
    let expected = 0;
    let collected = 0;
    let due = 0;
    let finesAssigned = 0;
    let finesCollected = 0;
    let finesPending = 0;

    financials.forEach(f => {
      // Expected Course Fee
      const courseFee = Number(f.totalCourseFee || 0);
      expected += courseFee;

      // Paid Amounts
      const admissionPaid = Number(f.admissionFeePaid || 0);
      const monthlyPaid = Number(f.monthlyPaidTotal || 0);
      const finePaid = Number(f.finesPaid || 0);
      
      const totalCoursePaid = admissionPaid + monthlyPaid;
      collected += (totalCoursePaid + finePaid);

      // Due Calculation based on Accountant's logic
      let courseDue = courseFee - totalCoursePaid;
      if (courseDue < 0) courseDue = 0;

      const fineTotal = Number(f.finesTotal || 0);
      let fineDue = fineTotal - finePaid;
      if (fineDue < 0) fineDue = 0;

      due += (courseDue + fineDue);

      // Fines Tracking
      finesAssigned += fineTotal;
      finesCollected += finePaid;
      finesPending += fineDue;
    });

    return { expected, collected, due, finesAssigned, finesCollected, finesPending };
  }, [financials]);

    // Extract available months dynamically from payments array
    // availableMonths এর এই অংশটি দিয়ে আগেরটি রিপ্লেস করো
    const availableMonths = useMemo(() => {
    const months = new Set();
    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    
    allPayments.forEach(p => {
        const my = getMonthYear(p); // এটি "06/2026" ফরম্যাটে আছে
        if (my !== 'Unknown') months.add(my);
    });

    return Array.from(months).sort((a, b) => {
        const [mA, yA] = a.split('/');
        const [mB, yB] = b.split('/');
        if (yA !== yB) return yB.localeCompare(yA);
        return mB.localeCompare(mA);
    }).map(m => {
        const [mNum, y] = m.split('/');
        return {
        value: m, // ড্রপডাউনের আসল ভ্যালু (যেমন: 06/2026)
        label: `${monthNames[parseInt(mNum) - 1]} ${y}` // ড্রপডাউনে যা দেখাবে (যেমন: June 2026)
        };
    });
    }, [allPayments]);

  // Filter Payments based on Month and Search Query
  const filteredPayments = useMemo(() => {
    let list = allPayments;
    
    if (selectedMonth !== 'All') {
      list = list.filter(p => getMonthYear(p) === selectedMonth);
    }

    if (revenueSearchQuery) {
      const q = revenueSearchQuery.toLowerCase();
      list = list.filter(p => {
        const student = students.find(s => s.id === p.studentUid);
        const sName = student?.name?.toLowerCase() || '';
        const sId = student?.studentId?.toLowerCase() || '';
        const type = (p.type || '').toLowerCase();
        const note = (p.note || '').toLowerCase();
        return sName.includes(q) || sId.includes(q) || type.includes(q) || note.includes(q);
      });
    }

    return list;
  }, [allPayments, selectedMonth, revenueSearchQuery, students]);

  // Calculate Specific Ledger Totals for the selected view
  const ledgerStats = useMemo(() => {
    let totalRevenue = 0;
    let totalFines = 0;
    filteredPayments.forEach(p => {
      const amount = Number(p.amount || 0);
      totalRevenue += amount;
      if ((p.type || '').toLowerCase().includes('fine') || (p.note || '').toLowerCase().includes('fine')) {
        totalFines += amount;
      }
    });
    return { totalRevenue, totalFines };
  }, [filteredPayments]);


  // --- 2. FACULTY ANALYTICS ---
  const handleRateChange = (teacherId, rate) => {
    setTeacherRates(prev => ({ ...prev, [teacherId]: Number(rate) }));
  };

  const facultyStats = useMemo(() => {
    return teachers.map(teacher => {
      const assignedCourses = courses.filter(c => c.teacherId === teacher.id);
      let totalClassesTaken = 0;
      let totalPresentInClasses = 0;
      let totalExpectedInClasses = 0;
      
      const courseDetails = assignedCourses.map(course => {
        const courseAttendance = attendance.filter(a => a.courseId === course.id);
        const uniqueDates = new Set(courseAttendance.map(a => a.date));
        const classCount = uniqueDates.size;
        
        const presentCount = courseAttendance.filter(a => a.status === 'present').length;
        const totalEntries = courseAttendance.length;
        const courseAvg = totalEntries === 0 ? 0 : Math.round((presentCount / totalEntries) * 100);

        totalClassesTaken += classCount;
        totalPresentInClasses += presentCount;
        totalExpectedInClasses += totalEntries;

        return {
          courseName: course.name,
          classCount,
          avgPresent: courseAvg
        };
      });

      const overallAvgPresent = totalExpectedInClasses === 0 ? 0 : Math.round((totalPresentInClasses / totalExpectedInClasses) * 100);
      const rate = teacherRates[teacher.id] || 0;
      const totalBill = totalClassesTaken * rate;

      return {
        ...teacher,
        assignedCourses: courseDetails,
        totalClassesTaken,
        overallAvgPresent,
        totalBill
      };
    }).sort((a, b) => b.totalClassesTaken - a.totalClassesTaken);
  }, [teachers, courses, attendance, teacherRates]);


  // --- 3. BATCH/ACADEMIC ANALYTICS ---
  const batchStats = useMemo(() => {
    return batches.map(batch => {
      const batchStudents = students.filter(s => s.batchId === batch.id);
      const batchCourses = courses.filter(c => c.batchId === batch.id);
      
      let batchTotalDue = 0;
      batchStudents.forEach(s => {
        const fin = financials.find(f => f.id === s.id) || {};
        
        const courseFee = Number(fin.totalCourseFee || 0);
        const totalCoursePaid = Number(fin.admissionFeePaid || 0) + Number(fin.monthlyPaidTotal || 0);
        let courseDue = courseFee - totalCoursePaid;
        if(courseDue < 0) courseDue = 0;

        const fineTotal = Number(fin.finesTotal || 0);
        const finePaid = Number(fin.finesPaid || 0);
        let fineDue = fineTotal - finePaid;
        if(fineDue < 0) fineDue = 0;

        batchTotalDue += (courseDue + fineDue);
      });

      return {
        ...batch,
        studentCount: batchStudents.length,
        courseCount: batchCourses.length,
        batchTotalDue
      };
    });
  }, [batches, students, courses, financials]);


  // --- Print Header Helper ---
  const PrintHeader = ({ title }) => (
    <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6 pt-4">
      <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-900">City Nursing Institute, Rangpur</h1>
      <p className="text-base font-semibold text-slate-700 mt-1">{title}</p>
      <p className="text-xs text-slate-500 mt-1">Date Generated: {new Date().toLocaleDateString('en-GB')}</p>
    </div>
  );

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 relative">
      {/* Global Print Styles to enforce A4 size and background colors */}
      <style>
        {`
          @media print {
            @page { size: A4 portrait; margin: 15mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
            .print\\:hidden { display: none !important; }
            .print\\:block { display: block !important; }
            .print\\:table-cell { display: table-cell !important; }
          }
        `}
      </style>

      {/* SIDEBAR (DESKTOP) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm hidden md:flex shrink-0 z-20 print:hidden">
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
        <div className="fixed inset-0 z-50 flex md:hidden print:hidden">
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
      <div className="flex-1 flex flex-col overflow-hidden w-full print:bg-white print:overflow-visible">
        
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm print:hidden">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl md:hidden transition-all">
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Administrative Analytics</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Financial Overviews & Faculty Performance</p>
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:m-0 print:overflow-visible block">
          <div className="max-w-7xl mx-auto space-y-6 print:space-y-0">

            {/* Custom Navigation Tabs (Hidden on Print) */}
            <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm w-full md:w-fit flex-wrap gap-1 print:hidden mb-6">
              <button onClick={() => setActiveTab('financials')} className={`flex-1 md:flex-none justify-center items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex ${activeTab === 'financials' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <Wallet size={16} /> <span className="whitespace-nowrap">Financial Report</span>
              </button>
              <button onClick={() => setActiveTab('faculty')} className={`flex-1 md:flex-none justify-center items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex ${activeTab === 'faculty' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <BarChart3 size={16} /> <span className="whitespace-nowrap">Faculty Performance & Billing</span>
              </button>
              <button onClick={() => setActiveTab('academic')} className={`flex-1 md:flex-none justify-center items-center space-x-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-lg transition-all flex ${activeTab === 'academic' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                <GraduationCap size={16} /> <span className="whitespace-nowrap">Batch Summaries</span>
              </button>
            </div>

            {/* =========================================
                TAB 1: FINANCIAL OVERVIEW & LEDGER
                ========================================= */}
            {activeTab === 'financials' && (
              <div className="space-y-8 animate-in fade-in block">
                
                {/* GLOBAL OVERVIEW CARDS (Hidden on Print so only Ledger prints) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 print:hidden">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Expected Value</p>
                    <h3 className="text-2xl font-black text-indigo-600">{formatCurrency(globalFin.expected)}</h3>
                    <p className="text-xs font-medium text-slate-500 mt-2">Overall target course value</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 rounded-2xl shadow-sm text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={64}/></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100 mb-1">Total Collected</p>
                    <h3 className="text-2xl font-black">{formatCurrency(globalFin.collected)}</h3>
                    <p className="text-xs font-medium text-emerald-100 mt-2">All payments captured</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                        <h3 className="text-2xl font-black text-rose-600">{formatCurrency(globalFin.due)}</h3>
                      </div>
                      <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><AlertCircle size={20}/></div>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-2">Fees + Fines awaiting collection</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fines Collected</p>
                        <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(globalFin.finesCollected)}</h3>
                      </div>
                      <div className="p-2 bg-amber-50 text-amber-500 rounded-lg"><CreditCard size={20}/></div>
                    </div>
                    <p className="text-[10px] font-bold text-rose-500 mt-2">Pending Fine Dues: {formatCurrency(globalFin.finesPending)}</p>
                  </div>
                </div>

                {/* DETAILED TRANSACTION LEDGER (This gets printed) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-0 print:shadow-none">
                  
                  <PrintHeader title={`Transaction Ledger: ${selectedMonth === 'All' ? 'All Time Overview' : selectedMonth}`} />
                  
                  <div className="p-6 border-b border-slate-100 bg-slate-50 print:bg-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="print:hidden">
                      <h3 className="font-bold text-slate-900 text-lg">Transaction Ledger</h3>
                      <p className="text-xs text-slate-500 mt-1">Select a month to view and print specific revenue reports.</p>
                    </div>

                    {/* Filter Controls */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto print:hidden">
                      <div className="relative w-full sm:w-auto">
                        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Search transactions..." 
                          value={revenueSearchQuery}
                          onChange={(e) => setRevenueSearchQuery(e.target.value)}
                          className="w-full sm:w-56 pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      
                      <div className="relative w-full sm:w-auto">
                        <CalendarDays size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full sm:w-40 pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 appearance-none font-medium cursor-pointer"
                            >
                            <option value="All">All Months</option>
                            {availableMonths.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                            </select>
                      </div>

                      <button onClick={handlePrint} className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-sm">
                        <Printer size={16} /> <span>Print Ledger</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Cards for Selected Month (Visible in UI & Print) */}
                  <div className="grid grid-cols-2 gap-4 p-6 bg-white border-b border-slate-100">
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 print:bg-white print:border-slate-300">
                      <p className="text-xs font-bold uppercase text-indigo-500 print:text-slate-500">Total Collection ({selectedMonth === 'All' ? 'All Time' : selectedMonth})</p>
                      <h3 className="text-2xl font-black text-indigo-700 print:text-slate-900 mt-1">{formatCurrency(ledgerStats.totalRevenue)}</h3>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 print:bg-white print:border-slate-300">
                      <p className="text-xs font-bold uppercase text-amber-600 print:text-slate-500">Fines Included in Collection</p>
                      <h3 className="text-2xl font-black text-amber-700 print:text-slate-900 mt-1">{formatCurrency(ledgerStats.totalFines)}</h3>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto p-0">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-y border-slate-200 print:bg-slate-100 print:text-black">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Student Details</th>
                          <th className="px-6 py-4">Transaction Purpose</th>
                          <th className="px-6 py-4 text-right">Amount (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPayments.map((pay) => {
                          const student = students.find(s => s.id === pay.studentUid);
                          return (
                            <tr key={pay.id} className="hover:bg-slate-50 transition-colors print:border-b print:border-slate-300">
                              <td className="px-6 py-4 font-medium text-slate-600">{pay.date || 'N/A'}</td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-slate-900">{student?.name || 'Unknown Student'}</p>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded mt-1 inline-block print:border print:bg-transparent">ID: {student?.studentId || 'N/A'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-indigo-700 print:text-slate-800">{pay.type || 'Payment'}</p>
                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]" title={pay.note}>{pay.note || 'System Record'}</p>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="font-black text-emerald-600 print:text-slate-900 text-base">{formatCurrency(pay.amount)}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredPayments.length === 0 && (
                          <tr><td colSpan="4" className="text-center py-12 text-slate-400 font-medium">No transactions found for this selection.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================
                TAB 2: FACULTY PERFORMANCE & BILLING
                ========================================= */}
            {(activeTab === 'faculty' || (window.matchMedia("print").matches && activeTab === 'faculty')) && (
              <div className="space-y-6 animate-in fade-in block">
                
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-0 print:shadow-none">
                  <PrintHeader title="Faculty Performance & Billing Report" />
                  
                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 print:bg-white print:border-b-2 print:border-slate-800">
                    <div className="print:hidden">
                      <h3 className="font-bold text-slate-900 text-lg">Faculty Master Matrix</h3>
                      <p className="text-xs text-slate-500 mt-1">Monitor teacher engagement, attendance ratios, and generate billing.</p>
                    </div>
                    <button onClick={handlePrint} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-sm print:hidden">
                      <Printer size={16} /> <span>Print Bills</span>
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200 print:bg-slate-100 print:text-black">
                        <tr>
                          <th className="px-6 py-4">Faculty Name</th>
                          <th className="px-6 py-4">Assigned Courses & Attendance</th>
                          <th className="px-6 py-4 text-center">Total Classes</th>
                          <th className="px-6 py-4 text-center">Rate / Class (৳)</th>
                          <th className="px-6 py-4 text-right">Total Bill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {facultyStats.map((teacher) => (
                          <tr key={teacher.id} className="hover:bg-slate-50 transition-colors print:border-b print:border-slate-300">
                            <td className="px-6 py-4 align-top">
                              <p className="font-bold text-slate-900">{teacher.name}</p>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded mt-1 inline-block print:border print:bg-transparent">{teacher.designation || 'Teacher'}</span>
                            </td>
                            <td className="px-6 py-4 align-top">
                              {teacher.assignedCourses.length > 0 ? (
                                <ul className="space-y-2">
                                  {teacher.assignedCourses.map((c, i) => (
                                    <li key={i} className="flex justify-between items-center bg-slate-50 print:bg-white print:border-b border border-slate-100 px-3 py-1.5 rounded-lg text-xs">
                                      <span className="font-bold text-slate-700 max-w-[150px] truncate" title={c.courseName}>{c.courseName}</span>
                                      <div className="flex space-x-3">
                                        <span className="text-slate-500">{c.classCount} Classes</span>
                                        <span className={`font-bold ${c.avgPresent >= 70 ? 'text-emerald-600' : 'text-rose-500'}`}>{c.avgPresent}% Att.</span>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No courses assigned</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center align-middle">
                              <span className="font-black text-indigo-600 print:text-slate-900 text-lg">{teacher.totalClassesTaken}</span>
                            </td>
                            <td className="px-6 py-4 text-center align-middle print:hidden">
                              <input 
                                type="number" 
                                min="0" 
                                placeholder="0"
                                value={teacherRates[teacher.id] || ''} 
                                onChange={(e) => handleRateChange(teacher.id, e.target.value)}
                                className="w-20 px-2 py-1.5 text-center bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold"
                              />
                            </td>
                            {/* Static Rate for Print View */}
                            <td className="hidden print:table-cell px-6 py-4 text-center align-middle font-bold text-slate-800">
                              {teacherRates[teacher.id] || 0}
                            </td>
                            <td className="px-6 py-4 text-right align-middle">
                              <span className="font-black text-slate-900 text-lg">{formatCurrency(teacher.totalBill)}</span>
                            </td>
                          </tr>
                        ))}
                        {teachers.length === 0 && (
                          <tr><td colSpan="5" className="text-center py-8 text-slate-400">No faculty members found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================
                TAB 3: BATCH SUMMARIES
                ========================================= */}
            {(activeTab === 'academic' || (window.matchMedia("print").matches && activeTab === 'academic')) && (
              <div className="space-y-6 animate-in fade-in block">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:border-0 print:shadow-none">
                  
                  <PrintHeader title="Batch Performance & Dues Report" />

                  <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 print:bg-white print:border-b-2 print:border-slate-800">
                    <div className="print:hidden">
                      <h3 className="font-bold text-slate-900 text-lg">Batch-wise Analytics</h3>
                      <p className="text-xs text-slate-500 mt-1">Overview of student capacity and pending dues per batch.</p>
                    </div>
                    <button onClick={handlePrint} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg transition-all shadow-sm print:hidden">
                      <Printer size={16} /> <span>Print Summary</span>
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-400 border-b border-slate-200 print:bg-slate-100 print:text-black">
                        <tr>
                          <th className="px-6 py-4">Batch Name</th>
                          <th className="px-6 py-4 text-center">Total Students</th>
                          <th className="px-6 py-4 text-center">Active Courses</th>
                          <th className="px-6 py-4 text-right">Total Pending Dues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batchStats.map((batch) => (
                          <tr key={batch.id} className="hover:bg-slate-50 transition-colors print:border-b print:border-slate-300">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900 text-base">{batch.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{batch.year}</p>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg print:border print:bg-transparent">{batch.studentCount}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg print:border print:bg-transparent print:text-slate-800">{batch.courseCount}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`font-bold ${batch.batchTotalDue > 0 ? 'text-rose-600' : 'text-emerald-600'} print:text-slate-900`}>
                                {formatCurrency(batch.batchTotalDue)}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {batches.length === 0 && (
                          <tr><td colSpan="4" className="text-center py-8 text-slate-400">No batches found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Shared Print Footer */}
            <div className="hidden print:block text-center text-xs font-bold text-slate-400 mt-12 pt-4 border-t border-slate-200">
              -- OFFICIAL RECORD | CNIEDU MANAGEMENT SYSTEM --
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
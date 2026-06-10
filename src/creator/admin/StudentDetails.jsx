import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, doc, getDoc, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { 
  LayoutDashboard, Users, UserPlus, BookOpen, Settings, LogOut, 
  Menu, X, Search, Layers, ChevronLeft, Printer, AlertTriangle, CheckCircle, 
  Wallet, BookCheck, Clock, FileText, BadgePercent, Database, Briefcase,ArrowRightLeft
} from 'lucide-react';

export default function StudentDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Layout States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Loading...');
  const [adminInitials, setAdminInitials] = useState('AD');
  
  // Global Data States
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  
  // Search & View States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('academic'); 

  // --- DYNAMIC REAL-TIME DATA STATES ---
  const [attendanceData, setAttendanceData] = useState([]);
  const [marksData, setMarksData] = useState([]);
  const [financials, setFinancials] = useState({ totalCourseFee: 0, admissionPaid: 0, monthlyDue: 0, totalFineDue: 0 });
  const [payments, setPayments] = useState([]);
  const [leaves, setLeaves] = useState([]);

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
      }
    });

    // --- ALIGNED: Fetch Students from central 'users' collection with role 'student' ---
    const qStudents = query(collection(db, 'users'), where('role', '==', 'student'));
    const unSubStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    });

    const unSubBatches = onSnapshot(query(collection(db, 'batches')), (snapshot) => {
      setBatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unSubCourses = onSnapshot(query(collection(db, 'courses')), (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeAuth();
      unSubStudents();
      unSubBatches();
      unSubCourses();
    };
  }, []);

  // --- FETCH REAL-TIME DATA WHEN A STUDENT IS SELECTED ---
  useEffect(() => {
    if (!selectedStudent) return;
    
    const uid = selectedStudent.uid;
    const studentId = selectedStudent.studentId; // Central mapping uses studentId field

    // 1. Fetch Financials
    const unSubFin = onSnapshot(doc(db, 'financials', uid), (doc) => {
      if (doc.exists()) {
        setFinancials(doc.data());
      } else {
        setFinancials({ totalCourseFee: 0, admissionPaid: 0, monthlyDue: 0, totalFineDue: 0 });
      }
    });

    // 2. Fetch Payment History
    const qPayments = query(collection(db, 'payments'), where('studentId', '==', studentId), orderBy('createdAt', 'desc'));
    const unSubPay = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 3. Fetch Attendance Array
    const qAttendance = query(collection(db, 'attendance'), where('studentId', '==', studentId));
    const unSubAtt = onSnapshot(qAttendance, (snapshot) => {
      setAttendanceData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 4. Fetch Marks Matrix
    const qMarks = query(collection(db, 'marks'), where('studentId', '==', studentId));
    const unSubMarks = onSnapshot(qMarks, (snapshot) => {
      setMarksData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 5. Fetch Leave Applications
    const qLeaves = query(collection(db, 'leaves'), where('studentId', '==', studentId), orderBy('createdAt', 'desc'));
    const unSubLeaves = onSnapshot(qLeaves, (snapshot) => {
      setLeaves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unSubFin();
      unSubPay();
      unSubAtt();
      unSubMarks();
      unSubLeaves();
    };
  }, [selectedStudent]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  // Search filter supporting aligned central fields
  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStudentBatch = (batchId) => batches.find(b => b.id === batchId);
  const getEnrolledCourses = (batchId) => courses.filter(c => c.batchId === batchId);

  // --- DYNAMIC CALCULATIONS ---
  const calculateAttendance = () => {
    const total = attendanceData.length;
    const present = attendanceData.filter(a => a.status === 'present').length;
    const absent = attendanceData.filter(a => a.status === 'absent').length;
    const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
    return { percentage, absent };
  };

  const attStats = calculateAttendance();
  const formatCurrency = (amount) => `৳${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const handlePrint = () => {
    window.print();
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
            
            <div className="pt-4 border-t border-slate-100 mt-auto">
              <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-medium">
                <LogOut size={18} /><span>Secure Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 print:bg-white print:overflow-visible">
        
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 z-10 shrink-0 shadow-sm print:hidden">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl md:hidden transition-all">
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Student Directory</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Global search and detailed profiles</p>
            </div>
          </div>

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
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-0 print:m-0">
          <div className="max-w-6xl mx-auto">

            {/* --- VIEW 1: SEARCH & LIST --- */}
            {!selectedStudent ? (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="relative max-w-2xl mx-auto">
                    <Search size={22} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search student by Name or ID..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 text-base bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Student Profile</th>
                        <th className="px-6 py-4">Batch Details</th>
                        <th className="px-6 py-4">Contact</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => {
                        const batch = getStudentBatch(student.batchId);
                        return (
                          <tr key={student.uid} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-900 text-base">{student.name}</p>
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded mt-1 inline-block">ID: {student.studentId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-slate-700">{batch ? batch.name : 'Unknown Batch'}</span>
                              <p className="text-xs text-slate-500 mt-0.5">{batch ? batch.year : 'Pending Year Mapped'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-medium text-slate-600">{student.phone}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => setSelectedStudent(student)} 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm shadow-indigo-200 transition-all text-xs"
                              >
                                View Detailed Report
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredStudents.length === 0 && (
                        <tr><td colSpan="4" className="text-center py-16 text-slate-400 font-medium">No students found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (

              /* --- VIEW 2: DATABASE CONNECTED STUDENT REPORT --- */
              <div className="space-y-6 print:space-y-4">
                
                {/* Back Button & Print Header */}
                <div className="flex justify-between items-center print:hidden">
                  <button onClick={() => setSelectedStudent(null)} className="flex items-center space-x-2 text-slate-500 hover:text-indigo-600 font-bold bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all">
                    <ChevronLeft size={18} /> <span>Back to Directory</span>
                  </button>
                  <button onClick={handlePrint} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all">
                    <Printer size={18} /> <span>Print Full Report</span>
                  </button>
                </div>

                {/* Print-Only Header */}
                <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-4">
                  <h1 className="text-2xl font-bold uppercase tracking-widest text-slate-900">City Nursing Institute</h1>
                  <p className="text-sm font-semibold text-slate-600 mt-1">Official Student Performance & Financial Ledger</p>
                </div>

                {/* Profile Overview Card */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center space-x-5">
                    <div className="w-20 h-20 bg-gradient-to-tr from-indigo-100 to-indigo-50 border-2 border-indigo-200 rounded-full flex items-center justify-center shrink-0">
                      <Users size={32} className="text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded border border-slate-200">ID: {selectedStudent.studentId}</span>
                        <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded border border-indigo-100">{getStudentBatch(selectedStudent.batchId)?.name || 'Unknown Batch'}</span>
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded border border-emerald-100 flex items-center"><CheckCircle size={12} className="mr-1"/> Active</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Dynamic Admit Card Status Check */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-right min-w-[200px]">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Admit Card Status</p>
                    {Number(financials.totalFineDue || 0) > 0 ? (
                      <div className="flex items-center justify-end space-x-2 text-rose-600 font-bold">
                        <AlertTriangle size={18} />
                        <span>Blocked (Fines Unpaid)</span>
                      </div>
                    ) : attStats.percentage < 60 && attendanceData.length > 0 ? (
                      <div className="flex items-center justify-end space-x-2 text-amber-600 font-bold">
                        <AlertTriangle size={18} />
                        <span>Blocked (Low Attendance)</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end space-x-2 text-emerald-600 font-bold">
                        <CheckCircle size={18} />
                        <span>Eligible (Clear)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs for detailed view */}
                <div className="flex space-x-2 border-b border-slate-200 pb-px print:hidden overflow-x-auto custom-scrollbar">
                  <button onClick={() => setActiveTab('academic')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all whitespace-nowrap ${activeTab === 'academic' ? 'bg-white border-t border-x border-slate-200 text-indigo-600 shadow-sm relative top-px' : 'text-slate-500 hover:bg-slate-100'}`}>Academic Record</button>
                  <button onClick={() => setActiveTab('financial')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all whitespace-nowrap ${activeTab === 'financial' ? 'bg-white border-t border-x border-slate-200 text-indigo-600 shadow-sm relative top-px' : 'text-slate-500 hover:bg-slate-100'}`}>Financial Ledger</button>
                  <button onClick={() => setActiveTab('profile')} className={`px-6 py-3 font-bold text-sm rounded-t-xl transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-white border-t border-x border-slate-200 text-indigo-600 shadow-sm relative top-px' : 'text-slate-500 hover:bg-slate-100'}`}>Basic Info & Leaves</button>
                </div>

                {/* TAB 1: ACADEMIC RECORD */}
                {(activeTab === 'academic' || true) && (
                  <div className={`space-y-6 ${activeTab !== 'academic' ? 'print:block hidden' : ''}`}>
                    <h3 className="hidden print:block font-bold text-lg text-slate-800 border-b border-slate-300 pb-2 mt-8">I. Academic Performance</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><BadgePercent size={24}/></div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Total Attendance</p>
                          <h3 className="text-xl font-bold text-slate-900 mt-0.5">{attStats.percentage}%</h3>
                        </div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle size={24}/></div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Classes Missed</p>
                          <h3 className="text-xl font-bold text-slate-900 mt-0.5">{attStats.absent} Days</h3>
                        </div>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><BookCheck size={24}/></div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase">Enrolled Courses</p>
                          <h3 className="text-xl font-bold text-slate-900 mt-0.5">{getEnrolledCourses(selectedStudent.batchId).length}</h3>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800">Course-wise Marks Matrix</h3></div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                          <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-3">Course Name</th>
                              <th className="px-6 py-3">Midterm (30%)</th>
                              <th className="px-6 py-3">Final (40%)</th>
                              <th className="px-6 py-3">CT/Assign (30%)</th>
                              <th className="px-6 py-3">Total</th>
                              <th className="px-6 py-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getEnrolledCourses(selectedStudent.batchId).map(c => {
                              const markEntry = marksData.find(m => m.courseId === c.id);
                              return (
                                <tr key={c.id} className="border-b border-slate-100">
                                  <td className="px-6 py-3 font-bold text-slate-800">{c.name}</td>
                                  <td className="px-6 py-3">{markEntry?.midterm || 'Pending'}</td>
                                  <td className="px-6 py-3">{markEntry?.final || 'Pending'}</td>
                                  <td className="px-6 py-3">{markEntry?.ct || 'Pending'}</td>
                                  <td className="px-6 py-3 font-bold text-slate-900">{markEntry?.total || '-'}</td>
                                  <td className="px-6 py-3 text-center">
                                    {markEntry?.status ? (
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${markEntry.status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {markEntry.status}
                                      </span>
                                    ) : (
                                      <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold">N/A</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {getEnrolledCourses(selectedStudent.batchId).length === 0 && (
                              <tr><td colSpan="6" className="text-center py-8 text-slate-400">No courses assigned to this batch.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: FINANCIAL LEDGER */}
                {(activeTab === 'financial' || true) && (
                  <div className={`space-y-6 ${activeTab !== 'financial' ? 'print:block hidden' : ''}`}>
                    <h3 className="hidden print:block font-bold text-lg text-slate-800 border-b border-slate-300 pb-2 mt-8">II. Financial Ledger</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Course Fee</p>
                        <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(financials.totalCourseFee)}</h3>
                        <p className="text-xs text-slate-500 mt-1">Assigned by Accountant</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Admission Paid</p>
                        <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(financials.admissionPaid)}</h3>
                        <p className="text-xs text-slate-500 mt-1">Initial Deposit</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monthly Due</p>
                        <h3 className="text-2xl font-bold text-indigo-600">{formatCurrency(financials.monthlyDue)}</h3>
                        <p className="text-xs text-slate-500 mt-1">Current Month Installment</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-rose-500">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Fine Due</p>
                        <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(financials.totalFineDue)}</h3>
                        <p className="text-xs text-rose-500 mt-1 font-medium">Blocks Admit Card</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800">Recent Payment History</h3></div>
                      {payments.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                            <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                              <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Receipt / Particulars</th>
                                <th className="px-6 py-3 text-right">Amount Paid</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payments.map(pay => (
                                <tr key={pay.id} className="border-b border-slate-100">
                                  <td className="px-6 py-3">{pay.date || 'N/A'}</td>
                                  <td className="px-6 py-3 font-medium">{pay.particulars || 'Monthly Fee'}</td>
                                  <td className="px-6 py-3 text-right font-bold text-emerald-600">{formatCurrency(pay.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-sm">
                          <Wallet size={32} className="mx-auto mb-2 text-slate-300" />
                          <p>No financial entries recorded in the database yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: PROFILE & LEAVES */}
                {(activeTab === 'profile' || true) && (
                  <div className={`space-y-6 ${activeTab !== 'profile' ? 'print:block hidden' : ''}`}>
                    <h3 className="hidden print:block font-bold text-lg text-slate-800 border-b border-slate-300 pb-2 mt-8">III. Profile & Demographics</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Student Information</h4>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Full Name</span> <span className="font-bold text-slate-800">{selectedStudent.name}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500">System ID</span> <span className="font-bold text-slate-800">{selectedStudent.studentId}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Contact Number</span> <span className="font-bold text-slate-800">{selectedStudent.phone}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Batch Name</span> <span className="font-bold text-slate-800">{getStudentBatch(selectedStudent.batchId)?.name || 'N/A'}</span></div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Guardian Details</h4>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Guardian Name</span> <span className="font-bold text-slate-800">{selectedStudent.gName || 'N/A'}</span></div>
                        <div className="flex justify-between items-center text-sm"><span className="text-slate-500">Emergency Contact</span> <span className="font-bold text-slate-800">{selectedStudent.gPhone || 'N/A'}</span></div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">Leave Applications</h3>
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded font-bold">Accountant Managed</span>
                      </div>
                      
                      {leaves.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                            <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                              <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Reason</th>
                                <th className="px-6 py-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leaves.map(leave => (
                                <tr key={leave.id} className="border-b border-slate-100">
                                  <td className="px-6 py-3 font-medium">{leave.date}</td>
                                  <td className="px-6 py-3">{leave.reason}</td>
                                  <td className="px-6 py-3 text-right">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : leave.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {leave.status || 'Pending'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-sm">
                          <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                          <p>No leave applications registered in the database for this student.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
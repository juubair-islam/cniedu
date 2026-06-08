import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Auth Pages (Inside pages/auth folder)
import Login from './pages/auth/Login';
import SecretAdmin from './pages/auth/SecretAdmin';

// Admin Dashboard, Academic Setup & Staff Creation (Inside creator/admin folder)
import AdminDashboard from './creator/admin/AdminDashboard';
import ManageCourses from './creator/admin/ManageCourses';
import ManageStaff from './creator/admin/UserCreation'; 
import CourseAssignments from './creator/admin/CourseAssignments';
import SystemSettings from './creator/admin/SystemSettings';
import StudentDetails from './creator/admin/StudentDetails';

// --- NEW IMPORTS ---
import AdministrativeTask from './creator/admin/AdministrativeTask';
import DatabaseConfig from './creator/admin/DatabaseConfig';

// Staff & Student Dashboards (Inside 'Staff creation' folder)
import TeacherDashboard from './Staff creation/teacher/TeacherDashboard';
import AccountantDashboard from './Staff creation/accountant/AccountantDashboard';
import StudentDashboard from './Staff creation/student/StudentDashboard';

// Components
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/secret-cni-admin-99x" element={<SecretAdmin />} />

        {/* --- FULLY SECURED PROTECTED ROUTES --- */}
        
        {/* Admin Dashboard */}
        <Route 
          path="/admin-dashboard" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Academic Setup */}
        <Route 
          path="/academic-setup" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <ManageCourses />
            </ProtectedRoute>
          } 
        />

        {/* Staff Management */}
        <Route 
          path="/staff-management" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <ManageStaff />
            </ProtectedRoute>
          } 
        />

        {/* Course Assignments */}
        <Route 
          path="/course-assignments" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <CourseAssignments />
            </ProtectedRoute>
          } 
        />

        {/* Student Details */}
        <Route 
          path="/student-details" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <StudentDetails />
            </ProtectedRoute>
          } 
        />

        {/* --- NEW: Administrative Task --- */}
        <Route 
          path="/administrative-task" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <AdministrativeTask />
            </ProtectedRoute>
          } 
        />

        {/* --- NEW: Database Config --- */}
        <Route 
          path="/database-config" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <DatabaseConfig />
            </ProtectedRoute>
          } 
        />

        {/* System Settings */}
        <Route 
          path="/system-settings" 
          element={
            <ProtectedRoute allowedRole="systemAdmin">
              <SystemSettings />
            </ProtectedRoute>
          } 
        />

        {/* Teacher Route */}
        <Route 
          path="/teacher-dashboard" 
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Accountant Route */}
        <Route 
          path="/accountant-dashboard" 
          element={
            <ProtectedRoute allowedRole="accountant">
              <AccountantDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Student Route */}
        <Route 
          path="/student-dashboard" 
          element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}
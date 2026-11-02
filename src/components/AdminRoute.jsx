import { Navigate, Outlet } from 'react-router-dom';

// ProtectedRoute refreshes crm_user from the database on every load. This only decides
// what to show: the database policies are what actually keep the data private.
export default function AdminRoute() {
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

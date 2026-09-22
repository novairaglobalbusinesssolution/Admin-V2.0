import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const sessionString = localStorage.getItem('adminSession');
  
  if (!sessionString) {
    // If no session is found, redirect to login page
    return <Navigate to="/login" replace />;
  }

  try {
    const session = JSON.parse(sessionString);
    if (!session || !session.id) {
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
    return <Navigate to="/login" replace />;
  }

  // If session is valid, render the child routes (AdminLayout)
  return <Outlet />;
}

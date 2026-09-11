import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import InputHarian from './pages/InputHarian';
import UploadBon from './pages/UploadBon';
import Tagihan from './pages/Tagihan';
import Laporan from './pages/Laporan';
import Users from './pages/Users';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/input-harian" element={<InputHarian />} />
        <Route path="/upload-bon" element={<UploadBon />} />
        <Route path="/tagihan" element={<Tagihan />} />
        <Route
          path="/laporan"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <Laporan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/input-harian" replace />} />
    </Routes>
  );
}

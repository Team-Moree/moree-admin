import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import FandomCategories from './pages/FandomCategories';
import FandomTargets from './pages/FandomTargets';
import StoreReports from './pages/StoreReports';
import ReviewReports from './pages/ReviewReports';
import Stores from './pages/Stores';
import Users from './pages/Users';
import Morees from './pages/Morees';
import BookmarkIcons from './pages/BookmarkIcons';
import Notifications from './pages/Notifications';

function PrivateRoute({ children }) {
  const token = sessionStorage.getItem('masterToken');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/fandom-categories" element={<FandomCategories />} />
                  <Route path="/fandom-targets" element={<FandomTargets />} />
                  <Route path="/stores" element={<Stores />} />
                  <Route path="/store-reports" element={<StoreReports />} />
                  <Route path="/review-reports" element={<ReviewReports />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/morees" element={<Morees />} />
                  <Route path="/bookmark-icons" element={<BookmarkIcons />} />
                  <Route path="/notifications" element={<Notifications />} />
                </Routes>
              </ErrorBoundary>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

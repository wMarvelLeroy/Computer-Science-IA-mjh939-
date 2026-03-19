import { Routes, Route } from 'react-router-dom';
import DashboardAdmin           from './Admin.jsx';
import Requests                 from './Requests.jsx';
import UsersManagement          from './UsersManagement.jsx';
import ArticlesManagement       from './ArticlesManagement.jsx';
import CategoriesManagement     from './CategoriesManagement.jsx';
import AdminProfile             from './AdminProfile.jsx';
import SignalementsManagement   from './SignalementsManagement.jsx';
import ReexaminationManagement  from './ReexaminationManagement.jsx';
import AdminActivity            from './AdminActivity.jsx';

function AdminRoutes() {
  return (
    <Routes>
      <Route index                    element={<DashboardAdmin />} />
      <Route path="users"             element={<UsersManagement />} />
      <Route path="author-requests"   element={<Requests />} />
      <Route path="category-requests" element={<Requests />} />
      <Route path="requests"          element={<Requests />} />
      <Route path="articles"          element={<ArticlesManagement />} />
      <Route path="categories"        element={<CategoriesManagement />} />
      <Route path="profile"           element={<AdminProfile />} />
      <Route path="signalements"      element={<SignalementsManagement />} />
      <Route path="reexamination"     element={<ReexaminationManagement />} />
      <Route path="activity"          element={<AdminActivity />} />
    </Routes>
  );
}

export default AdminRoutes;

import { Routes, Route } from 'react-router-dom';
import DashboardAuteur from './Auteur.jsx';
import ArticleEditor from './ArticleEditor.jsx';
import ArticlesList from './ArticlesList.jsx';
import CategoryRequests from './CategoryRequests.jsx';

function AuteurRoutes() {
    return (
        <Routes>
            <Route index element={<DashboardAuteur />} />
            <Route path="articles" element={<ArticlesList />} />
            <Route path="new" element={<ArticleEditor />} />
            <Route path="edit/:id" element={<ArticleEditor />} />
            <Route path="categories" element={<CategoryRequests />} />
        </Routes>
    );
}

export default AuteurRoutes;

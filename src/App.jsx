import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeadsHub from './pages/LeadsHub';
import LeadLists from './pages/LeadLists';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout/Layout';

import CSVUpload from './components/Upload/CSVUpload';
import WhatsAppTemplates from './pages/WhatsAppTemplates';
import FollowUps from './pages/FollowUps';
import QueueManager from './pages/QueueManager';
import GrowthPlanner from './pages/GrowthPlanner';
import FinanceDashboard from './pages/FinanceDashboard';
import QuotationsList from './pages/QuotationsList';
import InvoicesList from './pages/InvoicesList';
import Reports from './pages/Reports';
import { EmailOutreach, ClientPortal, BusinessForm, OfferForm, AccessForm } from './pages/Skeletons';

function LeadsRedirect() {
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const viewMode = user?.role === 'admin' ? (localStorage.getItem('crm_view_mode') || 'admin') : 'agent';
  return <Navigate to={viewMode === 'agent' ? '/leads/my-queue' : '/leads/database'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Leads */}
            <Route path="/leads" element={<LeadsRedirect />} />
            <Route path="/leads/my-queue" element={<LeadsHub defaultView="queue" />} />
            <Route path="/leads/pipeline" element={<LeadsHub defaultView="kanban" />} />

            {/* Outreach */}
            <Route path="/outreach/email" element={<EmailOutreach />} />
            <Route path="/outreach/whatsapp" element={<WhatsAppTemplates />} />
            <Route path="/outreach/follow-ups" element={<FollowUps />} />

            {/* Quotations are shared; agents see those on their own leads */}
            <Route path="/finance/quotations" element={<QuotationsList />} />

            {/* Admin only */}
            <Route element={<AdminRoute />}>
              <Route path="/queue" element={<QueueManager />} />
              <Route path="/leads/campaigns" element={<LeadLists />} />
              <Route path="/leads/database" element={<LeadsHub defaultView="table" />} />
              <Route path="/leads/import" element={<CSVUpload />} />
              <Route path="/finance/dashboard" element={<FinanceDashboard />} />
              <Route path="/finance/invoices" element={<InvoicesList />} />
              <Route path="/clients/portal" element={<ClientPortal />} />
              <Route path="/clients/reports" element={<Reports />} />
              <Route path="/forms/business" element={<BusinessForm />} />
              <Route path="/forms/offer" element={<OfferForm />} />
              <Route path="/forms/access" element={<AccessForm />} />
              <Route path="/settings/growth" element={<GrowthPlanner />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { useState, useMemo, createContext, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Layout & Pages
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddApp from './pages/AddApp';
import EditApp from './pages/EditApp';
import AppList from './pages/AppList';
import CommentsManagement from './pages/CommentsManagement';
import AddComment from './pages/AddComment';
import ManageComment from './pages/ManageComment';
import CommentMonitoring from './pages/CommentMonitoring';
import FileManager from './pages/FileManager';
import LiveCheckingMails from './pages/LiveCheckingMails';
import PushNotifications from './pages/PushNotifications';
import UsersManagement from './pages/UsersManagement';
import UserView from './pages/UserView';
import LiveListManagement from './pages/LiveListManagement';
import ScanZone from './pages/ScanZone';
import Settings from './pages/Settings';
import AppReviewsView from './pages/AppReviewsView';
import LiveListView from './pages/LiveListView';
import PaymentDashboard from './pages/PaymentDashboard';
import IndividualWallet from './pages/IndividualWallet';
import SettingsPayments from './pages/SettingsPayments';
import GiftCards from './pages/GiftCards';
import Withdrawals from './pages/Withdrawals';
import ClientInvoicesList from './pages/ClientInvoicesList';
import ClientInvoiceDetails from './pages/ClientInvoiceDetails';
import CreateInvoice from './pages/CreateInvoice';
import PaymentGatewayConfig from './pages/PaymentGatewayConfig';
import ClientPaymentPage from './pages/ClientPaymentPage';
import ViewInvoice from './pages/ViewInvoice';

export const ColorModeContext = createContext({ toggleColorMode: () => {} });

const getInitialMode = () => {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = localStorage.getItem('novaira-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    localStorage.setItem('novaira-theme', mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'light' ? '#2563eb' : '#8ab4ff',
            light: mode === 'light' ? '#dbeafe' : '#1d4ed8',
            dark: mode === 'light' ? '#1d4ed8' : '#bfdbfe',
            contrastText: '#ffffff',
            onPrimary: mode === 'light' ? '#ffffff' : '#081b4b',
            primaryContainer: mode === 'light' ? '#dbeafe' : '#1e3a8a',
          },
          secondary: {
            main: mode === 'light' ? '#0f172a' : '#cbd5e1',
          },
          background: {
            default: mode === 'light' ? '#f3f6fb' : '#0f1117',
            paper: mode === 'light' ? '#ffffff' : '#171b22',
          },
          text: {
            primary: mode === 'light' ? '#111827' : '#f1f5f9',
            secondary: mode === 'light' ? '#475569' : '#cbd5e1',
            disabled: mode === 'light' ? '#94a3b8' : '#64748b',
          },
          divider: mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.13)',
          surfaceVariant: {
            main: mode === 'light' ? '#edf2ff' : '#202734',
          },
        },
        shape: {
          borderRadius: 18,
        },
        typography: {
          fontFamily: ['Inter', 'Roboto', '"Google Sans"', 'sans-serif'].join(','),
          button: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.94rem',
            letterSpacing: '0.1px',
          },
          h5: {
            fontWeight: 600,
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: '999px',
                padding: '10px 22px',
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: mode === 'light' ? '0px 6px 18px rgba(37,99,235,0.18)' : '0px 6px 18px rgba(138,180,255,0.18)',
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: '16px',
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                border: mode === 'light' ? '1px solid rgba(15, 23, 42, 0.06)' : '1px solid rgba(148, 163, 184, 0.08)',
              },
              elevation1: {
                boxShadow: mode === 'light'
                  ? '0px 10px 30px rgba(15, 23, 42, 0.08)'
                  : '0px 18px 35px rgba(2, 6, 23, 0.45)',
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                borderRight: 'none',
                background: mode === 'light'
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(242,246,252,0.98))'
                  : 'linear-gradient(180deg, rgba(17,19,24,0.96), rgba(15,17,23,0.98))',
                backdropFilter: 'blur(18px)',
                boxShadow: mode === 'light' ? '8px 0 30px rgba(15, 23, 42, 0.05)' : 'none',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: mode === 'light' ? '0 10px 22px rgba(15, 23, 42, 0.04)' : 'none',
                background: mode === 'light'
                  ? 'rgba(255, 255, 255, 0.88)'
                  : 'rgba(15, 17, 23, 0.72)',
                color: mode === 'light' ? '#0f172a' : '#f8fafc',
                backdropFilter: 'blur(18px)',
                borderBottom: mode === 'light' ? '1px solid rgba(148,163,184,0.18)' : '1px solid rgba(148,163,184,0.12)',
              },
            },
          },
        },
      }),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/pay/:invoiceId" element={<ClientPaymentPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="user-view/:type/:id" element={<UserView />} />
                <Route path="payments" element={<PaymentDashboard />} />
                <Route path="payments/individuals/wallet" element={<IndividualWallet />} />
                <Route path="payments/individuals/settings-payments" element={<SettingsPayments />} />
                <Route path="payments/individuals/gift-cards" element={<GiftCards />} />
                <Route path="payments/individuals/withdrawals" element={<Withdrawals />} />
                <Route path="payments/clients/invoices" element={<ClientInvoicesList />} />
                <Route path="payments/clients/invoices/:clientId" element={<ClientInvoiceDetails />} />
                <Route path="payments/clients/invoices/:clientId/create" element={<CreateInvoice />} />
                <Route path="payments/clients/invoices/view/:invoiceId" element={<ViewInvoice />} />
                <Route path="payments/clients/settings" element={<PaymentGatewayConfig />} />
                <Route path="payments/settings" element={<PaymentGatewayConfig />} />

                <Route path="add-live" element={<LiveListManagement />} />
                <Route path="live-list" element={<LiveListView />} />
                <Route path="settings" element={<Settings />} />
                <Route path="add-app" element={<AddApp />} />
                <Route path="add-comment" element={<AddComment />} />
                <Route path="manage-comment" element={<ManageComment />} />
                <Route path="comment-monitoring" element={<CommentMonitoring />} />
                <Route path="file-manager" element={<FileManager />} />
                <Route path="live-checking-mails" element={<LiveCheckingMails />} />
                <Route path="push-notifications" element={<PushNotifications />} />
                <Route path="scan-zone" element={<ScanZone />} />
                <Route path="edit-app/:id" element={<EditApp />} />
                <Route path="app-list" element={<AppList />} />
                <Route path="comments/:appId" element={<CommentsManagement />} />
                <Route path="app-reviews/:appId" element={<AppReviewsView />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;


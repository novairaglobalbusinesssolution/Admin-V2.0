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
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import AppReviewsView from './pages/AppReviewsView';
import LiveListView from './pages/LiveListView';
import PaymentDashboard from './pages/PaymentDashboard';
import IndividualWallet from './pages/IndividualWallet';
import BulkerWalletList from './pages/BulkerWalletList';
import BulkerWalletDetails from './pages/BulkerWalletDetails';
import BulkerInvoicesList from './pages/BulkerInvoicesList';
import BulkerInvoiceDetails from './pages/BulkerInvoiceDetails';
import SettingsPayments from './pages/SettingsPayments';
import GiftCards from './pages/GiftCards';
import Withdrawals from './pages/Withdrawals';
import ClientInvoicesList from './pages/ClientInvoicesList';
import ClientInvoiceDetails from './pages/ClientInvoiceDetails';
import CreateInvoice from './pages/CreateInvoice';
import PaymentGatewayConfig from './pages/PaymentGatewayConfig';
import ClientPaymentPage from './pages/ClientPaymentPage';
import ViewInvoice from './pages/ViewInvoice';
import PujaFeedAdmin from './pages/PujaFeedAdmin';
import CommunityChatsView from './pages/community-chat/CommunityChatsView';
import CommunityUsersView from './pages/community-chat/CommunityUsersView';
import CommunityAdsView from './pages/community-chat/CommunityAdsView';
import CommunityPinnedView from './pages/community-chat/CommunityPinnedView';
import CommunitySettingsView from './pages/community-chat/CommunitySettingsView';

export const ColorModeContext = createContext({ toggleColorMode: () => {} });

const getInitialMode = () => {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = localStorage.getItem('novaira-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  return 'dark';
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
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff',
            primaryContainer: mode === 'light' ? '#dbeafe' : 'rgba(59, 130, 246, 0.16)',
          },
          secondary: {
            main: mode === 'light' ? '#0f172a' : '#cbd5e1',
          },
          background: {
            default: mode === 'light' ? '#f0f4f9' : '#07090e',
            paper: mode === 'light' ? 'rgba(255, 255, 255, 0.75)' : 'rgba(15, 23, 42, 0.62)',
          },
          text: {
            primary: mode === 'light' ? '#0f172a' : '#f8fafc',
            secondary: mode === 'light' ? '#475569' : '#94a3b8',
            disabled: mode === 'light' ? '#94a3b8' : '#64748b',
          },
          divider: mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
          surfaceVariant: {
            main: mode === 'light' ? '#edf2ff' : 'rgba(30, 41, 59, 0.5)',
          },
        },
        shape: {
          borderRadius: 20,
        },
        typography: {
          fontFamily: ['Inter', 'Roboto', '"Google Sans"', 'sans-serif'].join(','),
          button: {
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.92rem',
            letterSpacing: '0.1px',
          },
          h5: {
            fontWeight: 700,
          },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(15, 23, 42, 0.58)',
                backdropFilter: 'blur(22px) saturate(160%)',
                WebkitBackdropFilter: 'blur(22px) saturate(160%)',
                border: mode === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.09)',
                borderRadius: '22px',
                boxShadow: mode === 'light'
                  ? '0 10px 30px rgba(15, 23, 42, 0.06)'
                  : '0 14px 40px rgba(0, 0, 0, 0.40)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: '14px',
                padding: '9px 20px',
                fontWeight: 700,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              contained: {
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.28)',
                '&:hover': {
                  boxShadow: '0 6px 22px rgba(59, 130, 246, 0.48)',
                  transform: 'translateY(-1px)',
                },
              },
              outlined: {
                borderWidth: '1px',
                borderColor: mode === 'light' ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                '&:hover': {
                  backgroundColor: mode === 'light' ? 'rgba(37, 99, 235, 0.06)' : 'rgba(255, 255, 255, 0.08)',
                  borderColor: mode === 'light' ? '#2563eb' : '#60a5fa',
                  transform: 'translateY(-1px)',
                },
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                borderRadius: '16px',
                backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light' ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.10)',
                  transition: 'all 0.25s ease',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: mode === 'light' ? '#3b82f6' : 'rgba(255, 255, 255, 0.25)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#3b82f6',
                  borderWidth: '1.5px',
                  boxShadow: '0 0 16px rgba(59, 130, 246, 0.25)',
                },
              },
            },
          },
          MuiDrawer: {
            styleOverrides: {
              paper: {
                borderRadius: '0px !important',
                borderRight: mode === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: mode === 'light'
                  ? 'rgba(255, 255, 255, 0.82)'
                  : 'rgba(8, 11, 18, 0.78)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                boxShadow: mode === 'light' ? '6px 0 28px rgba(15, 23, 42, 0.03)' : '6px 0 32px rgba(0, 0, 0, 0.45)',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                borderRadius: '0px !important',
                boxShadow: 'none',
                background: mode === 'light'
                  ? 'rgba(255, 255, 255, 0.82)'
                  : 'rgba(8, 11, 18, 0.78)',
                color: mode === 'light' ? '#0f172a' : '#f8fafc',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                borderBottom: mode === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.80)',
                backdropFilter: 'blur(28px) saturate(180%)',
                WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                border: mode === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '24px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
              },
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.88)' : 'rgba(15, 23, 42, 0.82)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                border: mode === 'light' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid rgba(255, 255, 255, 0.10)',
                borderRadius: '18px',
                boxShadow: '0 16px 45px rgba(0, 0, 0, 0.45)',
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderColor: mode === 'light' ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.06)',
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
                <Route path="puja-feed-2026" element={<PujaFeedAdmin />} />
                <Route path="puja-zone" element={<PujaFeedAdmin />} />
                <Route path="community-chat" element={<CommunityChatsView />} />
                <Route path="community-chat/users" element={<CommunityUsersView />} />
                <Route path="community-chat/ads" element={<CommunityAdsView />} />
                <Route path="community-chat/pinned" element={<CommunityPinnedView />} />
                <Route path="community-chat/settings" element={<CommunitySettingsView />} />
                <Route path="user-view/:type/:id" element={<UserView />} />
                <Route path="payments" element={<PaymentDashboard />} />
                <Route path="payments/individuals/wallet" element={<IndividualWallet />} />
                <Route path="payments/individuals/settings-payments" element={<SettingsPayments />} />
                <Route path="payments/individuals/gift-cards" element={<GiftCards />} />
                <Route path="payments/individuals/withdrawals" element={<Withdrawals />} />
                <Route path="payments/bulkers/wallet" element={<BulkerWalletList />} />
                <Route path="payments/bulkers/wallet/:bulkerId" element={<BulkerWalletDetails />} />
                <Route path="payments/bulkers/invoices" element={<BulkerInvoicesList />} />
                <Route path="payments/bulkers/invoices/:bulkerId" element={<BulkerInvoiceDetails />} />
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
                <Route path="notifications" element={<Notifications />} />
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


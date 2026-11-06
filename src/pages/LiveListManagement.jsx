import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, Chip, IconButton, useTheme, Snackbar, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete,
  Tooltip, Divider, InputAdornment, Collapse
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';
import Swal from 'sweetalert2';

// MUI Icons
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import EditIcon from '@mui/icons-material/Edit';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import VerifiedIcon from '@mui/icons-material/Verified';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LayersIcon from '@mui/icons-material/Layers';
import BusinessIcon from '@mui/icons-material/Business';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ShieldIcon from '@mui/icons-material/Shield';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

export default function LiveListManagement() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [taskIdInput, setTaskIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appDetails, setAppDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Cached Bulker Desks & Acceptances for real-time calculations
  const [bulkerDesksList, setBulkerDesksList] = useState([]);
  const [appAcceptancesList, setAppAcceptancesList] = useState([]);

  // Search input ref for auto-focus & clearing
  const searchInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState(0); // 0: Live List, 1: Live Pending List
  const [pendingApps, setPendingApps] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Date formatter for Asia/Kolkata
  const formatKolkataDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
    } catch {
      return String(dateString);
    }
  };

  const fetchPendingApps = async () => {
    setLoadingPending(true);
    try {
      const { data: appsData, error: appsErr } = await supabase
        .from('apps')
        .select('id, task_id, app_name, app_date, live_checking_date, status, review_submit_data(id, status)')
        .order('created_at', { ascending: false });

      if (appsErr) throw appsErr;

      const processed = (appsData || []).map(app => {
        const submissions = app.review_submit_data || [];
        const total = submissions.length;
        const pending = submissions.filter(r => r.status === 'Under Review').length;
        return {
          ...app,
          totalSubmissions: total,
          pendingSubmissions: pending
        };
      }).filter(app => app.pendingSubmissions > 0);

      setPendingApps(processed);
    } catch (e) {
      setSnack({ open: true, message: 'Failed to fetch pending apps: ' + e.message, severity: 'error' });
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 1) {
      fetchPendingApps();
    }
  }, [activeTab]);

  const handleOpenTask = (taskId) => {
    setTaskIdInput(taskId.toString());
    setActiveTab(0);
    setTimeout(() => {
      fetchAppDetailsById(taskId.toString());
    }, 100);
  };

  const fetchAppDetailsById = async (inputVal, preserveSelected = false, additionalIdToSelect = null) => {
    const targetInput = inputVal || taskIdInput;
    if (!targetInput || !targetInput.trim()) return;
    setLoading(true);
    try {
      const cleanedTaskId = targetInput.replace(/\D/g, '');
      if (!cleanedTaskId) throw new Error("Please enter a valid numeric Task ID");

      // 1. Fetch App details using task_id
      const { data: appData, error: appErr } = await supabase
        .from('apps')
        .select('*')
        .eq('task_id', parseInt(cleanedTaskId, 10))
        .single();

      if (appErr || !appData) throw new Error("App / Task ID not found in database.");

      const assignedBulkers = (appData.assigned_bulkers || []).map(b => b.bulker_id).join(', ') || 'None';

      // Fetch Sponsor Name from clients or providers
      let sponsorName = '';
      if (appData.sponsor_id) {
        const isClient = appData.sponsor_type === 'Clients' || appData.sponsor_type === 'Client';
        const [cRes, pRes] = await Promise.all([
          supabase.from('clients').select('name').eq('client_id', appData.sponsor_id).maybeSingle(),
          supabase.from('providers').select('name').eq('provider_id', appData.sponsor_id).maybeSingle()
        ]);
        if (isClient && cRes.data?.name) {
          sponsorName = cRes.data.name;
        } else if (pRes.data?.name) {
          sponsorName = pRes.data.name;
        } else if (cRes.data?.name) {
          sponsorName = cRes.data.name;
        }
      }

      if (!sponsorName) {
        const shortCode = appData.sponsor_id ? appData.sponsor_id.split('/').pop() : '';
        sponsorName = shortCode ? `${appData.sponsor_type || 'Provider'} (${shortCode})` : (appData.sponsor_type || 'Direct');
      }

      const sponsorTypeLabel = (appData.sponsor_type === 'Clients' || appData.sponsor_type === 'Client') ? 'Client' : 'Provider';

      // Fetch Bulker Desks & Acceptances for this app upfront
      const [bulkersRes, acceptancesRes] = await Promise.all([
        supabase.from('bulker_desks').select('id, bulker_id, full_name, account_type'),
        supabase.from('bulker_app_acceptances').select('app_id, bulker_id, assigned_amount, member_amount, status').eq('app_id', appData.id)
      ]);

      const loadedBulkerDesks = bulkersRes.data || [];
      const loadedAcceptances = acceptancesRes.data || [];
      setBulkerDesksList(loadedBulkerDesks);
      setAppAcceptancesList(loadedAcceptances);

      setAppDetails({
        id: appData.id,
        taskId: appData.task_id,
        name: appData.app_name,
        provider: `${sponsorName} (${appData.sponsor_id || 'N/A'})`,
        sponsorName: sponsorName,
        sponsorId: appData.sponsor_id || 'N/A',
        sponsorType: sponsorTypeLabel,
        memberReward: `Rs. ${appData.members_reward || 0}`,
        rawMemberReward: parseFloat(appData.members_reward) || 0,
        sponsorReward: `Rs. ${appData.sponsor_amount || 0}`,
        rawSponsorAmount: parseFloat(appData.sponsor_amount) || 0,
        taskType: appData.task_type || 'N/A',
        commentLimit: appData.comment_limit || 0,
        appDate: formatKolkataDate(appData.app_date),
        liveCheckingDate: formatKolkataDate(appData.live_checking_date),
        bulkers: assignedBulkers,
        assignedBulkersList: appData.assigned_bulkers || [],
        instructions: appData.instructions || 'None'
      });

      // 2. Fetch submitted reviews for this app
      const { data: revData, error: revErr } = await supabase
        .from('review_submit_data')
        .select('*')
        .eq('app_id', appData.id)
        .order('submitted_at', { ascending: true });

      if (revErr) throw revErr;
      
      let finalMembers = revData || [];

      // 3. Fetch Earner Names from profiles
      if (finalMembers.length > 0) {
        const earnerIds = [...new Set(finalMembers.map(m => m.earner_id))];

        const profilesRes = await supabase
          .from('profiles')
          .select('earner_id, first_name, last_name, bulker_id')
          .in('earner_id', earnerIds);
          
        const nameMap = {};
        if (!profilesRes.error && profilesRes.data) {
          profilesRes.data.forEach(p => {
            nameMap[p.earner_id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          });
        }
        
        finalMembers = finalMembers.map(m => {
          let eName = nameMap[m.earner_id];
          if (!eName) {
            if (m.earner_id && !m.earner_id.startsWith('NOVAIRA/')) {
              eName = m.earner_id;
            } else if (m.submitted_username) {
              eName = m.submitted_username;
            } else {
              eName = m.earner_id || 'Earner';
            }
          }
          const eShortId = m.earner_id ? m.earner_id.split('/').pop() : '';
          
          const mShortBulker = m.bulker_id ? m.bulker_id.split('/').pop() : '';
          let bName = 'Unknown';
          let bAccountType = 'Manual';
          if (loadedBulkerDesks.length > 0) {
            const bMatch = loadedBulkerDesks.find(b => {
               const dbShort = b.bulker_id ? b.bulker_id.split('/').pop() : '';
               return dbShort.toUpperCase() === mShortBulker.toUpperCase() || b.bulker_id === m.bulker_id;
            });
            if (bMatch) {
              bName = bMatch.full_name;
              bAccountType = bMatch.account_type || 'Manual';
            }
          }

          return {
            ...m,
            bulker_account_type: bAccountType,
            bulker_full_name: bName,
            formatted_earner: `${eName} (${eShortId})`,
            formatted_bulker: `${bName} (${mShortBulker})`
          };
        });
      }

      setMembers(finalMembers);
      
      if (preserveSelected) {
        setSelectedIds(prev => {
          const combined = [...prev];
          if (additionalIdToSelect) {
            combined.push(additionalIdToSelect);
          }
          const validIds = combined.filter(id => finalMembers.some(m => m.id === id));
          return [...new Set(validIds)];
        });
      } else {
        setSelectedIds(finalMembers.filter(r => r.status === 'Live').map(r => r.id));
      }

      setSnack({ open: true, message: `Loaded task #${appData.task_id} with ${finalMembers.length} submissions.`, severity: 'success' });

      // Focus search box automatically once task is loaded
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);

    } catch (error) {
      setAppDetails(null);
      setMembers([]);
      setSnack({ open: true, message: error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAppDetails = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    fetchAppDetailsById(taskIdInput);
  };

  // Filtered members by search query
  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => 
      (m.submitted_username && m.submitted_username.toLowerCase().includes(q)) ||
      (m.formatted_earner && m.formatted_earner.toLowerCase().includes(q)) ||
      (m.formatted_bulker && m.formatted_bulker.toLowerCase().includes(q)) ||
      (m.earner_id && m.earner_id.toLowerCase().includes(q))
    );
  }, [members, searchQuery]);

  // Helper to calculate payout & bulker profit according to the exact rules:
  // 1. Pratik Bulker (PRATIK1) members -> ₹8.00 each, bulker gets (assignedAmount - 8)
  // 2. Other Bulker members -> bulker's assigned amount
  const calculateMemberEconomics = (m, details = appDetails, desks = bulkerDesksList, acceptances = appAcceptancesList) => {
    if (!details) return { userReward: 0, bulkerProfit: 0, shouldCreditUserWallet: false, shouldCreditBulkerWallet: false, bulkerCode: 'DIRECT', bulkerName: 'Direct' };

    const normalizeId = (val) => String(val ?? '').trim();
    const getShortBulkerCode = (id) => normalizeId(id).replace(/^NOVAIRA\/BULKER\//i, '').toUpperCase();

    const isPratik1 = (id) => {
      const short = getShortBulkerCode(id);
      return short === 'PRATIK1' || normalizeId(id).toUpperCase().includes('PRATIK1');
    };

    const rawBulkerId = m.bulker_id;
    const shortCode = getShortBulkerCode(rawBulkerId);

    const bulkerDesk = (desks || []).find(b => {
      const dbShort = getShortBulkerCode(b.bulker_id);
      return dbShort === shortCode || normalizeId(b.bulker_id).toLowerCase() === normalizeId(rawBulkerId).toLowerCase();
    });

    const fullBulkerId = bulkerDesk?.bulker_id || (rawBulkerId ? (rawBulkerId.includes('NOVAIRA/BULKER/') ? rawBulkerId : `NOVAIRA/BULKER/${rawBulkerId}`) : null);
    const bulkerCode = getShortBulkerCode(fullBulkerId || rawBulkerId) || 'DIRECT';
    const bulkerName = bulkerDesk?.full_name || m.bulker_full_name || bulkerCode;

    const isPratik = isPratik1(rawBulkerId) || isPratik1(fullBulkerId);

    // Look up acceptance and bulker assignment for this bulker
    const acceptance = (acceptances || []).find(a => {
      const aShort = getShortBulkerCode(a.bulker_id);
      return aShort === shortCode || normalizeId(a.bulker_id).toLowerCase() === normalizeId(rawBulkerId).toLowerCase();
    });

    const assignedList = details.assignedBulkersList || [];
    const bulkerAssignment = assignedList.find(b => getShortBulkerCode(b.bulker_id) === shortCode);

    let bulkerAssignedAmount = 0;
    if (acceptance && acceptance.assigned_amount && !isNaN(parseFloat(acceptance.assigned_amount))) {
      bulkerAssignedAmount = parseFloat(acceptance.assigned_amount);
    } else if (bulkerAssignment && bulkerAssignment.amount && !isNaN(parseFloat(bulkerAssignment.amount))) {
      bulkerAssignedAmount = parseFloat(bulkerAssignment.amount);
    } else {
      bulkerAssignedAmount = details.rawMemberReward || 0;
    }

    let userReward = 0;
    let bulkerProfit = 0;
    let shouldCreditUserWallet = true;
    let shouldCreditBulkerWallet = false;

    if (isPratik) {
      // Rule 1: Pratik bulker members get fixed ₹8.00
      userReward = 8.00;
      shouldCreditUserWallet = true;
      bulkerProfit = bulkerAssignedAmount > 8.00 ? (bulkerAssignedAmount - 8.00) : 0;
      shouldCreditBulkerWallet = bulkerProfit > 0;
    } else {
      // Rule 2: Other bulker members get their bulker's assigned amount
      userReward = bulkerAssignedAmount > 0 ? bulkerAssignedAmount : (details.rawMemberReward || 0);
      shouldCreditUserWallet = userReward > 0;
      bulkerProfit = 0;
      shouldCreditBulkerWallet = false;
    }

    return {
      userReward,
      bulkerProfit,
      shouldCreditUserWallet,
      shouldCreditBulkerWallet,
      bulkerCode,
      bulkerName,
      fullBulkerId,
      bulkerAssignedAmount
    };
  };

  // =========================================================================
  // REAL-TIME FINANCIAL & BULKER-WISE TELEMETRY CALCULATION AS PER SELECTION
  // =========================================================================
  const liveEconomics = useMemo(() => {
    if (!appDetails || members.length === 0) {
      return {
        selectedCount: 0,
        totalSponsorBilling: 0,
        totalMemberPayout: 0,
        totalBulkerProfit: 0,
        netPlatformProfit: 0,
        bulkerBreakdown: []
      };
    }

    let totalSponsorBilling = 0;
    let totalMemberPayout = 0;
    let totalBulkerProfit = 0;

    const bulkerMap = {};

    const selectedMembersList = members.filter(m => selectedIds.includes(m.id));

    selectedMembersList.forEach(m => {
      totalSponsorBilling += appDetails.rawSponsorAmount;

      const eco = calculateMemberEconomics(m, appDetails, bulkerDesksList, appAcceptancesList);

      totalMemberPayout += eco.userReward;
      totalBulkerProfit += eco.bulkerProfit;

      if (!bulkerMap[eco.bulkerCode]) {
        bulkerMap[eco.bulkerCode] = {
          code: eco.bulkerCode,
          name: eco.bulkerName,
          count: 0,
          memberAmount: 0,
          bulkerProfit: 0,
          totalCost: 0
        };
      }
      bulkerMap[eco.bulkerCode].count += 1;
      bulkerMap[eco.bulkerCode].memberAmount += eco.userReward;
      bulkerMap[eco.bulkerCode].bulkerProfit += eco.bulkerProfit;
      bulkerMap[eco.bulkerCode].totalCost += (eco.userReward + eco.bulkerProfit);
    });

    const netPlatformProfit = totalSponsorBilling - totalMemberPayout - totalBulkerProfit;

    return {
      selectedCount: selectedMembersList.length,
      totalSponsorBilling,
      totalMemberPayout,
      totalBulkerProfit,
      netPlatformProfit,
      bulkerBreakdown: Object.values(bulkerMap)
    };
  }, [appDetails, members, selectedIds, bulkerDesksList, appAcceptancesList]);

  // =========================================================================
  // SMART SELECTION WITH AUTO-CLEAR & AUTO-FOCUS SEARCH BOX
  // =========================================================================
  const handleSelectAndResetSearch = (id) => {
    // 1. Toggle selection
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      } else {
        return [...prev, id];
      }
    });

    // 2. Clear search query immediately
    setSearchQuery('');

    // 3. Keep cursor ready in search box for instant next typing
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredMembers.length > 0) {
        // Toggle the first matched member from search
        const firstMatchId = filteredMembers[0].id;
        handleSelectAndResetSearch(firstMatchId);
      }
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const filteredIds = filteredMembers.map(m => m.id);
      setSelectedIds(prev => [...new Set([...prev, ...filteredIds])]);
    } else {
      const filteredIds = filteredMembers.map(m => m.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleZeroLive = async () => {
    const result = await Swal.fire({
      title: 'Apply Zero Live?',
      text: "Mark all pending submissions for this task as Not Live/Rejected? This will also revert all credited wallet transactions.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Apply Zero Live',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      background: isDark ? '#0f172a' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a'
    });

    if (!result.isConfirmed) return;
    
    try {
      setSaving(true);
      const { error: updateErr } = await supabase
        .from('review_submit_data')
        .update({ status: 'Not Live' })
        .eq('app_id', appDetails.id);

      if (updateErr) throw updateErr;

      const { error: delErr } = await supabase
        .from('individual_wallet_transactions')
        .delete()
        .eq('app_id', appDetails.id);

      if (delErr) console.warn("Failed to delete wallet transactions on Zero Live", delErr);

      setSnack({ open: true, message: 'Zero Live applied. All members marked as Not Live and wallet rewards reverted.', severity: 'success' });
      
      setAppDetails(null);
      setMembers([]);
      setSelectedIds([]);
      setTaskIdInput('');
    } catch (err) {
      setSnack({ open: true, message: 'Error applying Zero Live: ' + err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLiveList = async () => {
    if (!appDetails) return;

    setSaving(true);
    try {
      const toMarkLive = members.filter(m => selectedIds.includes(m.id) && m.status !== 'Live');
      const toMarkNotLive = members.filter(m => !selectedIds.includes(m.id) && m.status !== 'Not Live');

      if (toMarkLive.length === 0 && toMarkNotLive.length === 0) {
        setSnack({ open: true, message: 'No live status changes to commit.', severity: 'info' });
        setSaving(false);
        return;
      }

      // 1. Process members newly marked as Live
      if (toMarkLive.length > 0) {
        const { error: updateErr } = await supabase
          .from('review_submit_data')
          .update({ status: 'Live' })
          .in('id', toMarkLive.map(m => m.id));

        if (updateErr) throw updateErr;

        const generateTrxId = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const normalizeId = (value) => String(value ?? '').trim();

        const allSelectedEarnersArr = members
          .filter(m => selectedIds.includes(m.id))
          .map(m => normalizeId(m.earner_id))
          .filter(Boolean);
          
        const allSelectedEarners = new Set(allSelectedEarnersArr);

        const { data: liveProfiles = [], error: profileErr } = await supabase
          .from('profiles')
          .select('earner_id, referral_code, bulker_id, fcm_token')
          .in('earner_id', allSelectedEarnersArr);

        if (profileErr) console.warn('Failed to fetch referral references.', profileErr);

        const getShortBulkerCode = (id) => normalizeId(id).replace(/^NOVAIRA\/BULKER\//i, '').toUpperCase();

        const isPratik1 = (id) => {
          const short = getShortBulkerCode(id);
          return short === 'PRATIK1' || normalizeId(id).toUpperCase().includes('PRATIK1');
        };

        const findBulkerDesk = (bId) => {
          if (!bId) return null;
          const short = getShortBulkerCode(bId);
          return (bulkerDesksList || []).find(b => {
            const dbShort = getShortBulkerCode(b.bulker_id);
            return dbShort === short || normalizeId(b.bulker_id).toLowerCase() === normalizeId(bId).toLowerCase();
          });
        };

        const findBulkerAcceptance = (bId) => {
          if (!bId) return null;
          const short = getShortBulkerCode(bId);
          return (appAcceptancesList || []).find(a => {
            const aShort = getShortBulkerCode(a.bulker_id);
            return aShort === short || normalizeId(a.bulker_id).toLowerCase() === normalizeId(bId).toLowerCase();
          });
        };

        const { data: existingTxns } = await supabase
          .from('individual_wallet_transactions')
          .select('earner_id, description')
          .eq('app_id', appDetails.id);

        const existingDescriptions = new Set((existingTxns || []).map(t => t.description));
        const existingEarnersReward = new Set((existingTxns || [])
            .filter(t => t.description && t.description.startsWith('Reward for Task ID'))
            .map(t => t.earner_id)
        );

        const profileByEarner = Object.fromEntries((liveProfiles || []).map(profile => [normalizeId(profile.earner_id), profile]));
        const walletTransactions = [];
        const primaryNotifications = [];

        // Rewards for newly marked Live earners
        toMarkLive.forEach(m => {
          const normalizedEarnerId = normalizeId(m.earner_id);
          const earnerProfile = profileByEarner[normalizedEarnerId];
          
          const eco = calculateMemberEconomics(m);
          const userReward = eco.userReward;
          const bulkerProfit = eco.bulkerProfit;
          const fullBulkerId = eco.fullBulkerId;
          const shouldCreditUserWallet = eco.shouldCreditUserWallet;
          const shouldCreditBulkerWallet = eco.shouldCreditBulkerWallet;

          if (shouldCreditUserWallet && userReward > 0) {
            if (!existingEarnersReward.has(normalizedEarnerId)) {
              walletTransactions.push({
                transaction_id: generateTrxId(),
                earner_id: normalizedEarnerId,
                app_id: appDetails.id,
                amount: userReward,
                transaction_type: 'Credit',
                description: `Reward for Task ID ${appDetails.taskId}: ${appDetails.name}`,
                status: 'Completed'
              });

              primaryNotifications.push({
                earner_id: normalizedEarnerId,
                fcm_token: earnerProfile?.fcm_token || null,
                title: 'Wallet Credited',
                body: `You received Rs. ${userReward} for completing ${appDetails.name}.`,
                type: 'wallet'
              });
            }
          }

          if (shouldCreditBulkerWallet && fullBulkerId && bulkerProfit > 0) {
            const bulkerDesc = `Bulker Reward for Task ID ${appDetails.taskId}: ${appDetails.name} (${normalizedEarnerId})`;
            if (!existingDescriptions.has(bulkerDesc)) {
              walletTransactions.push({
                transaction_id: generateTrxId(),
                earner_id: fullBulkerId,
                app_id: appDetails.id,
                amount: bulkerProfit,
                transaction_type: 'Credit',
                description: bulkerDesc,
                status: 'Completed'
              });
              existingDescriptions.add(bulkerDesc);
            }
          }
        });

        // Referral Bonuses
        allSelectedEarners.forEach(normalizedEarnerId => {
          const profile = profileByEarner[normalizedEarnerId];
          const referrerId = normalizeId(profile?.referral_code);

          const isReferralEligible = (
            referrerId &&
            referrerId !== '' &&
            referrerId !== normalizedEarnerId &&
            allSelectedEarners.has(normalizedEarnerId) &&
            allSelectedEarners.has(referrerId)
          );

          if (isReferralEligible) {
            const earnerBulkerId = profile?.bulker_id || (members.find(m => normalizeId(m.earner_id) === normalizedEarnerId)?.bulker_id);
            const isPratik = isPratik1(earnerBulkerId);
            const bulkerDesk = findBulkerDesk(earnerBulkerId);
            const isWalletSystem = String(bulkerDesk?.account_type || '').trim().toLowerCase() === 'wallet system';

            if (!isPratik && !isWalletSystem) return;

            const referrerProfile = profileByEarner[referrerId];
            if (referrerProfile) {
              const refDesc = `Referral bonus for inviting ${normalizedEarnerId}`;
              if (!existingDescriptions.has(refDesc)) {
                walletTransactions.push({
                  transaction_id: generateTrxId(),
                  earner_id: referrerId,
                  app_id: appDetails.id,
                  amount: 0.60,
                  transaction_type: 'Credit',
                  description: refDesc,
                  status: 'Completed'
                });
                existingDescriptions.add(refDesc);
              }
            }
          }
        });

        if (walletTransactions.length > 0) {
          const { error: walletErr } = await supabase.from('individual_wallet_transactions').insert(walletTransactions);
          if (walletErr) throw walletErr;
            
          if (primaryNotifications.length > 0) {
            const baseUrl = getApiBaseUrl();
            Promise.all(primaryNotifications.map(notif => 
              fetch(`${baseUrl}/api/send-notification`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify(notif)
              }).catch(e => console.warn(e))
            )).catch(err => console.error('Push Notification Error:', err));
          }
        }
      }

      // 2. Process members marked as Not Live (unchecked)
      if (toMarkNotLive.length > 0) {
        const { error: revertErr } = await supabase
          .from('review_submit_data')
          .update({ status: 'Not Live' })
          .in('id', toMarkNotLive.map(m => m.id));

        if (revertErr) throw revertErr;

        const revertEarnerIds = toMarkNotLive.map(m => m.earner_id);
        const revertDescriptions = revertEarnerIds.map(id => `Referral bonus for inviting ${id}`);

        await supabase
          .from('individual_wallet_transactions')
          .delete()
          .eq('app_id', appDetails.id)
          .in('earner_id', revertEarnerIds);

        await supabase
          .from('individual_wallet_transactions')
          .delete()
          .eq('app_id', appDetails.id)
          .in('description', revertDescriptions);

        const revertBulkerDescriptions = revertEarnerIds.map(id => `Bulker Reward for Task ID ${appDetails.taskId}: ${appDetails.name} (${id})`);
        await supabase
          .from('individual_wallet_transactions')
          .delete()
          .eq('app_id', appDetails.id)
          .in('description', revertBulkerDescriptions);
      }

      Swal.fire({
        title: 'Live List Synchronized!',
        text: `Successfully verified: ${toMarkLive.length} confirmed Live, ${toMarkNotLive.length} marked Not Live.`,
        icon: 'success',
        confirmButtonColor: '#10b981',
        background: isDark ? '#0f172a' : '#fff',
        color: isDark ? '#f8fafc' : '#0f172a'
      });

      // Reset
      setAppDetails(null);
      setMembers([]);
      setSelectedIds([]);
      setTaskIdInput('');

    } catch (error) {
      console.error(error);
      setSnack({ open: true, message: 'Error syncing Live List: ' + error.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Add Missing Member Dialog State
  const [addMissingOpen, setAddMissingOpen] = useState(false);
  const [missingData, setMissingData] = useState({ username: '', earnerId: '', bulkerId: '' });
  const [addingMissing, setAddingMissing] = useState(false);
  const [allEarners, setAllEarners] = useState([]);
  const [allBulkers, setAllBulkers] = useState([]);
  const [fetchingOptions, setFetchingOptions] = useState(false);

  useEffect(() => {
    if (addMissingOpen) {
      const fetchOptions = async () => {
        setFetchingOptions(true);
        try {
          const [profRes, bulkRes] = await Promise.all([
            supabase.from('profiles').select('earner_id, first_name, last_name'),
            supabase.from('bulker_desks').select('bulker_id, full_name')
          ]);
          if (!profRes.error) setAllEarners(profRes.data || []);
          if (!bulkRes.error) setAllBulkers(bulkRes.data || []);
        } catch (error) {
          console.error("Error fetching dropdown options", error);
        } finally {
          setFetchingOptions(false);
        }
      };
      fetchOptions();
    }
  }, [addMissingOpen]);

  const submitAddMissing = async () => {
    if (!missingData.username || !missingData.earnerId || !missingData.bulkerId) {
      setSnack({ open: true, message: 'Please fill all fields', severity: 'warning' });
      return;
    }
    setAddingMissing(true);
    try {
      let commentIdToUse = null;
      const { data: existingComments } = await supabase
        .from('app_comments')
        .select('id')
        .eq('app_id', appDetails.id)
        .limit(1);

      if (existingComments && existingComments.length > 0) {
        commentIdToUse = existingComments[0].id;
      } else {
        const { data: newComment, error: dummyErr } = await supabase
          .from('app_comments')
          .insert({
            app_id: appDetails.id,
            content: 'Manual Entry Dummy Comment',
            rating: 5,
            status: 'completed'
          })
          .select('id')
          .single();

        if (dummyErr) throw new Error("Failed to create dummy comment: " + dummyErr.message);
        commentIdToUse = newComment.id;
      }

      const { data: insertedData, error: insertErr } = await supabase
        .from('review_submit_data')
        .insert({
          app_id: appDetails.id,
          comment_id: commentIdToUse,
          earner_id: missingData.earnerId,
          bulker_id: missingData.bulkerId,
          submitted_username: missingData.username,
          screenshot_url: 'MANUAL_ENTRY',
          status: 'Under Review'
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      setSnack({ open: true, message: 'Missing member added successfully!', severity: 'success' });
      setAddMissingOpen(false);
      setMissingData({ username: '', earnerId: '', bulkerId: '' });
      
      const newMemberId = insertedData?.id;
      await fetchAppDetailsById(taskIdInput, true, newMemberId);
    } catch (error) {
      setSnack({ open: true, message: error.message, severity: 'error' });
    } finally {
      setAddingMissing(false);
    }
  };

  // Edit Username Dialog State
  const [editUsernameDialog, setEditUsernameDialog] = useState({
    open: false,
    member: null,
    newUsername: '',
    saving: false
  });

  const handleOpenEditUsername = (member) => {
    setEditUsernameDialog({
      open: true,
      member: member,
      newUsername: member.submitted_username || '',
      saving: false
    });
  };

  const handleSaveUsername = async () => {
    if (!editUsernameDialog.member || !editUsernameDialog.newUsername.trim()) {
      setSnack({ open: true, message: 'Please enter a valid username', severity: 'warning' });
      return;
    }

    const updatedName = editUsernameDialog.newUsername.trim();
    const targetId = editUsernameDialog.member.id;

    setEditUsernameDialog(prev => ({ ...prev, saving: true }));

    try {
      const { error } = await supabase
        .from('review_submit_data')
        .update({ submitted_username: updatedName })
        .eq('id', targetId);

      if (error) throw error;

      setMembers(prev => prev.map(m => m.id === targetId ? { ...m, submitted_username: updatedName } : m));
      setSnack({ open: true, message: `Username updated to "${updatedName}"`, severity: 'success' });
      setEditUsernameDialog({ open: false, member: null, newUsername: '', saving: false });
    } catch (err) {
      console.error('Error updating username:', err);
      setSnack({ open: true, message: 'Failed to update username: ' + err.message, severity: 'error' });
      setEditUsernameDialog(prev => ({ ...prev, saving: false }));
    }
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, pb: 8 }}>
      
      {/* 1. Header Pod: Glassmorphic Executive Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '24px',
          border: '1px solid',
          borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)',
          background: isDark
            ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,23,42,0.85) 100%)'
            : 'linear-gradient(135deg, rgba(238,242,255,0.8) 0%, rgba(255,255,255,0.95) 100%)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          width: '100%'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 8px 24px rgba(16,185,129,0.35)'
            }}
          >
            <FactCheckIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Live List Verification & Wallet Dispatch Engine
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cross-examine published app store reviews, authenticate earner live submissions, and trigger instant wallet payouts.
            </Typography>
          </Box>
        </Box>

        {/* Tab Controls: Modern Glass Segmented Pills */}
        <Box
          sx={{
            display: 'flex',
            p: 0.6,
            borderRadius: '14px',
            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            gap: 0.5
          }}
        >
          <Button
            size="small"
            onClick={() => setActiveTab(0)}
            startIcon={<VerifiedIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.84rem',
              px: 2,
              py: 0.8,
              textTransform: 'none',
              bgcolor: activeTab === 0 ? '#10b981' : 'transparent',
              color: activeTab === 0 ? '#fff' : 'text.secondary',
              boxShadow: activeTab === 0 ? '0 4px 14px rgba(16,185,129,0.3)' : 'none',
              '&:hover': {
                bgcolor: activeTab === 0 ? '#059669' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
              }
            }}
          >
            Live Verification Hub
          </Button>
          <Button
            size="small"
            onClick={() => setActiveTab(1)}
            startIcon={<PendingActionsIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.84rem',
              px: 2,
              py: 0.8,
              textTransform: 'none',
              bgcolor: activeTab === 1 ? '#6366f1' : 'transparent',
              color: activeTab === 1 ? '#fff' : 'text.secondary',
              boxShadow: activeTab === 1 ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
              '&:hover': {
                bgcolor: activeTab === 1 ? '#4f46e5' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
              }
            }}
          >
            Pending Checking Queue
          </Button>
        </Box>
      </Paper>

      {/* ============================================================== */}
      {/* TAB 0: LIVE LIST VERIFICATION HUB                               */}
      {/* ============================================================== */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
          
          {/* Section A: Task ID Query Card (Full Width) */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: '24px',
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
                1. Task & Application Identification
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter numeric Task ID (e.g. 1024 or #1024) to retrieve submissions and live economics.
              </Typography>
            </Box>

            <form onSubmit={fetchAppDetails} style={{ width: '100%' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr auto' },
                  gap: 1.5,
                  width: '100%',
                  alignItems: 'center'
                }}
              >
                <TextField
                  fullWidth
                  id="task-id-input"
                  placeholder="Enter numeric Task / App ID (e.g. 1024)..."
                  value={taskIdInput}
                  onChange={e => setTaskIdInput(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                    )
                  }}
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !taskIdInput.trim()}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <VerifiedIcon />}
                  sx={{
                    px: 3.5,
                    py: 1.3,
                    borderRadius: '14px',
                    fontWeight: 800,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {loading ? 'Validating...' : 'Check Submissions'}
                </Button>
              </Box>
            </form>
          </Paper>

          {/* Section B: App Telemetry & Unit Economics (When Task Loaded) */}
          {appDetails && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: '24px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5
              }}
            >
              {/* App Identity Row */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    label={`TASK #${appDetails.taskId}`}
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      bgcolor: 'rgba(99,102,241,0.15)',
                      color: '#6366f1',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: '8px'
                    }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {appDetails.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={appDetails.taskType}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderRadius: '6px'
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    Release: <span style={{ color: isDark ? '#fff' : '#000' }}>{appDetails.appDate}</span>
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>•</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#10b981' }}>
                    Live Check: <span>{appDetails.liveCheckingDate}</span>
                  </Typography>
                </Box>
              </Box>

              {/* 4 Financial & Bulker KPI Cards Grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                  gap: 2,
                  width: '100%'
                }}
              >
                {/* 1. Sponsor Entity */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.04em' }}>
                    {appDetails.sponsorType.toUpperCase()}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                    {appDetails.sponsorName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontFamily: 'monospace' }} noWrap>
                    {appDetails.sponsorId}
                  </Typography>
                </Paper>

                {/* 2. Member Reward */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: 'rgba(16,185,129,0.3)',
                    bgcolor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981', letterSpacing: '0.04em' }}>
                    DEFAULT EARNER RATE
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#10b981' }}>
                    {appDetails.memberReward}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                    Base rate before bulker quota
                  </Typography>
                </Paper>

                {/* 3. Sponsor Billing */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.04em' }}>
                    SPONSOR RATE
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#6366f1' }}>
                    {appDetails.sponsorReward}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                    Client invoice billing rate
                  </Typography>
                </Paper>

                {/* 4. Bulkers & Limit */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.04em' }}>
                    ASSIGNED BULKERS
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                    {appDetails.bulkers}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem' }}>
                    Limit: {appDetails.commentLimit} tasks/earner
                  </Typography>
                </Paper>
              </Box>

              {/* Instructions Callout */}
              {appDetails.instructions && appDetails.instructions !== 'None' && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    TASK INSTRUCTIONS & VERIFICATION HINT
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {appDetails.instructions}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}

          {/* Section C: Real-time Live Selection Financial Telemetry Pods (Calculated LIVE as per selection) */}
          {appDetails && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: '24px',
                border: '1.5px solid',
                borderColor: liveEconomics.selectedCount > 0 ? 'rgba(16,185,129,0.35)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                background: liveEconomics.selectedCount > 0
                  ? isDark
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(15,23,42,0.85) 100%)'
                    : 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.95) 100%)'
                  : isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <TrendingUpIcon sx={{ color: '#10b981', fontSize: 24 }} />
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Live Selection Economics & Profit Audit
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Calculated automatically as per selected live earners, bulker desk agreements, and member payouts.
                    </Typography>
                  </Box>
                </Box>

                <Chip
                  icon={<VerifiedIcon sx={{ fontSize: '1rem !important' }} />}
                  label={`${liveEconomics.selectedCount} of ${members.length} Selected Live`}
                  sx={{
                    fontWeight: 800,
                    bgcolor: liveEconomics.selectedCount > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                    color: liveEconomics.selectedCount > 0 ? '#10b981' : 'text.secondary',
                    border: '1px solid',
                    borderColor: liveEconomics.selectedCount > 0 ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '10px'
                  }}
                />
              </Box>

              {/* 4 Financial Metric Pods */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                  gap: 2,
                  width: '100%'
                }}
              >
                {/* 1. Sponsor Billing */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.2)',
                    bgcolor: isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#6366f1' }}>
                    TOTAL CLIENT BILLING
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#6366f1' }}>
                    ₹{liveEconomics.totalSponsorBilling.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    {liveEconomics.selectedCount} × ₹{appDetails.rawSponsorAmount.toFixed(2)}
                  </Typography>
                </Paper>

                {/* 2. Earner Payout */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: 'rgba(16,185,129,0.3)',
                    bgcolor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981' }}>
                    TOTAL EARNER PAYOUT
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#10b981' }}>
                    ₹{liveEconomics.totalMemberPayout.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    Direct earner wallet credit
                  </Typography>
                </Paper>

                {/* 3. Bulker Profit */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1px solid',
                    borderColor: 'rgba(245,158,11,0.3)',
                    bgcolor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                    TOTAL BULKER PROFIT
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                    ₹{liveEconomics.totalBulkerProfit.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    Commission across bulkers
                  </Typography>
                </Paper>

                {/* 4. Net Platform Profit */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    border: '1.5px solid',
                    borderColor: liveEconomics.netPlatformProfit >= 0 ? '#10b981' : '#ef4444',
                    bgcolor: liveEconomics.netPlatformProfit >= 0
                      ? isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)'
                      : isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: liveEconomics.netPlatformProfit >= 0 ? '#10b981' : '#ef4444' }}>
                    NET PLATFORM PROFIT
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: liveEconomics.netPlatformProfit >= 0 ? '#10b981' : '#ef4444' }}>
                    {liveEconomics.netPlatformProfit >= 0 ? '+' : ''}₹{liveEconomics.netPlatformProfit.toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    {liveEconomics.totalSponsorBilling > 0
                      ? `${((liveEconomics.netPlatformProfit / liveEconomics.totalSponsorBilling) * 100).toFixed(1)}% Platform Margin`
                      : 'Gross Margin'}
                  </Typography>
                </Paper>
              </Box>

              {/* Bulker-wise Breakdown Bar */}
              {liveEconomics.bulkerBreakdown.length > 0 && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.04em' }}>
                    BULKER-WISE LIVE DISTRIBUTION BREAKDOWN:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2 }}>
                    {liveEconomics.bulkerBreakdown.map((b) => (
                      <Paper
                        key={b.code}
                        elevation={0}
                        sx={{
                          px: 1.5,
                          py: 0.8,
                          borderRadius: '10px',
                          border: '1px solid',
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <BusinessIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary' }}>
                            {b.name} ({b.code}):
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={`${b.count} Live`}
                          sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, bgcolor: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                          Earners: <b style={{ color: '#10b981' }}>₹{b.memberAmount.toFixed(2)}</b>
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                          Bulker Profit: <b style={{ color: '#f59e0b' }}>₹{b.bulkerProfit.toFixed(2)}</b>
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem' }}>
                          Total Cost: <b style={{ color: isDark ? '#fff' : '#000' }}>₹{b.totalCost.toFixed(2)}</b>
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          )}

          {/* Section D: Submitted Members Verification Grid (With Lightning Auto-Search & Auto-Clear) */}
          {appDetails && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: '24px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(16px)',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5
              }}
            >
              {/* Header & Search Toolbar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 2,
                  width: '100%'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Submitted Members ({filteredMembers.length})
                  </Typography>
                  <Chip
                    size="small"
                    label={`${selectedIds.length} Verified Live`}
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      bgcolor: 'rgba(16,185,129,0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16,185,129,0.3)',
                      borderRadius: '8px'
                    }}
                  />

                  {filteredMembers.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.5,
                        py: 0.4,
                        borderRadius: '10px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        border: '1px solid',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                      }}
                    >
                      <Checkbox 
                        size="small"
                        checked={filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.includes(m.id))}
                        indeterminate={filteredMembers.some(m => selectedIds.includes(m.id)) && !filteredMembers.every(m => selectedIds.includes(m.id))}
                        onChange={handleSelectAll}
                        sx={{ p: 0.2 }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => handleSelectAll({ target: { checked: !filteredMembers.every(m => selectedIds.includes(m.id)) } })}>
                        Select All Filtered
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  {/* AUTO-CLEAR & AUTO-FOCUS SEARCH BOX */}
                  <TextField 
                    size="small"
                    inputRef={searchInputRef}
                    placeholder="Search earner, bulker, username (Press Enter to toggle)..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />,
                      endAdornment: searchQuery ? (
                        <InputAdornment position="end">
                          <Tooltip title="Clear & refocus">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSearchQuery('');
                                searchInputRef.current?.focus();
                              }}
                            >
                              <ClearIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ) : null
                    }}
                    sx={{
                      minWidth: { xs: '100%', sm: 320 },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setAddMissingOpen(true)}
                    sx={{
                      borderRadius: '12px',
                      fontWeight: 700,
                      textTransform: 'none',
                      borderColor: 'rgba(99,102,241,0.3)',
                      color: '#6366f1',
                      '&:hover': {
                        borderColor: '#6366f1',
                        bgcolor: 'rgba(99,102,241,0.08)'
                      }
                    }}
                  >
                    Add Missing Member
                  </Button>
                </Box>
              </Box>

              {/* Members Interactive Grid: Select triggers auto-clear & auto-focus */}
              <Box
                sx={{
                  maxHeight: 580,
                  overflowY: 'auto',
                  pr: 0.5,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                  gap: 1.5,
                  width: '100%'
                }}
              >
                {filteredMembers.length === 0 ? (
                  <Box sx={{ gridColumn: '1 / -1', py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">No submissions match your search query.</Typography>
                  </Box>
                ) : (
                  filteredMembers.map(u => {
                    const isSelected = selectedIds.includes(u.id);
                    return (
                      <Paper 
                        key={u.id}
                        elevation={0}
                        onClick={() => handleSelectAndResetSearch(u.id)}
                        sx={{ 
                          p: 1.5, 
                          borderRadius: '14px', 
                          cursor: 'pointer',
                          border: '1.5px solid',
                          borderColor: isSelected ? '#10b981' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          bgcolor: isSelected
                            ? isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)'
                            : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
                          boxShadow: isSelected ? '0 4px 14px rgba(16,185,129,0.2)' : 'none',
                          transition: 'all 0.15s ease-in-out',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          '&:hover': {
                            borderColor: isSelected ? '#10b981' : '#6366f1',
                            transform: 'translateY(-1px)'
                          }
                        }}
                      >
                        {/* Top: Checkbox, Username, Edit Icon, Status */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0, flex: 1 }}>
                            <Checkbox 
                              checked={isSelected} 
                              onChange={(e) => { e.stopPropagation(); handleSelectAndResetSearch(u.id); }} 
                              sx={{
                                p: 0,
                                color: isSelected ? '#10b981' : 'text.disabled',
                                '&.Mui-checked': { color: '#10b981' }
                              }}
                            />
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 800, 
                                fontSize: '0.82rem',
                                color: 'text.primary', 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={u.submitted_username}
                            >
                              {(u.submitted_username || 'UNKNOWN').toUpperCase()}
                            </Typography>
                            <Tooltip title="Edit Submitted Username">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditUsername(u);
                                }}
                                sx={{
                                  p: 0.2,
                                  color: 'text.secondary',
                                  '&:hover': { color: '#6366f1', bgcolor: 'rgba(99,102,241,0.1)' }
                                }}
                              >
                                <EditIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>

                          <Chip 
                            size="small" 
                            label={u.status} 
                            sx={{
                              borderRadius: '6px',
                              fontWeight: 800,
                              height: 20,
                              fontSize: '0.62rem',
                              bgcolor: u.status === 'Live' ? 'rgba(16,185,129,0.15)' : u.status === 'Under Review' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                              color: u.status === 'Live' ? '#10b981' : u.status === 'Under Review' ? '#f59e0b' : '#ef4444'
                            }} 
                          />
                        </Box>
                        
                        {/* Bottom: Earner & Bulker Info */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, pl: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <PersonIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '0.72rem' }} noWrap>
                              {u.formatted_earner}
                            </Typography>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <AssignmentIndIcon sx={{ fontSize: 13, color: '#6366f1' }} />
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#6366f1', fontSize: '0.72rem' }} noWrap>
                              {u.formatted_bulker}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })
                )}
              </Box>

              <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

              {/* Bottom Actions Bar */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, width: '100%' }}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleZeroLive}
                  disabled={saving}
                  startIcon={<WarningAmberIcon />}
                  sx={{
                    borderRadius: '12px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderColor: 'rgba(239,68,68,0.3)',
                    color: '#ef4444',
                    '&:hover': {
                      borderColor: '#ef4444',
                      bgcolor: 'rgba(239,68,68,0.08)'
                    }
                  }}
                >
                  Apply Zero Live
                </Button>

                <Button 
                  variant="contained"
                  onClick={handleSaveLiveList}
                  disabled={saving}
                  startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
                  sx={{
                    px: 3.5,
                    py: 1.2,
                    borderRadius: '14px',
                    fontWeight: 800,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                      boxShadow: '0 10px 28px rgba(16,185,129,0.45)'
                    }
                  }}
                >
                  {saving ? 'Synchronizing & Crediting Wallets...' : `Commit Live List (${selectedIds.length} Verified)`}
                </Button>
              </Box>
            </Paper>
          )}

        </Box>
      )}

      {/* ============================================================== */}
      {/* TAB 1: PENDING LIVE APPS QUEUE                                  */}
      {/* ============================================================== */}
      {activeTab === 1 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: '24px',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            bgcolor: isDark ? 'rgba(15,23,42,0.65)' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(16px)',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, width: '100%' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Pending Live Applications Queue ({pendingApps.length})
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Applications with earner submissions awaiting live store cross-checking and payout approval.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TextField 
                size="small" 
                placeholder="Search pending apps..." 
                value={pendingSearch} 
                onChange={(e) => setPendingSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
                }}
                sx={{
                  width: { xs: '100%', sm: 260 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)'
                  }
                }}
              />
              <Button
                size="small"
                onClick={fetchPendingApps}
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  textTransform: 'none',
                  color: 'text.primary',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>
          
          {loadingPending ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, gap: 2 }}>
              <CircularProgress size={36} sx={{ color: '#6366f1' }} />
              <Typography variant="body2" color="text.secondary">Loading pending application queue...</Typography>
            </Box>
          ) : (
            <TableContainer
              component={Paper}
              elevation={0}
              sx={{
                borderRadius: '16px',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(15,23,42,0.4)' : '#ffffff',
                width: '100%'
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,0.95)', backdropFilter: 'blur(10px)', fontWeight: 800, fontSize: '0.75rem', py: 1.5, color: 'text.secondary', letterSpacing: '0.04em' } }}>
                    <TableCell width="120">TASK ID</TableCell>
                    <TableCell>APPLICATION NAME</TableCell>
                    <TableCell width="120">STATUS</TableCell>
                    <TableCell width="160">LIVE CHECK DATE</TableCell>
                    <TableCell align="center" width="180">PENDING AUDIT</TableCell>
                    <TableCell align="right" width="180">ACTION</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingApps
                    .filter(a => a.app_name.toLowerCase().includes(pendingSearch.toLowerCase()) || a.task_id.toString().includes(pendingSearch))
                    .map(app => (
                      <TableRow
                        key={app.id}
                        hover
                        sx={{
                          transition: 'background-color 0.15s ease',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.03) !important' : 'rgba(0,0,0,0.02) !important'
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 800, color: '#6366f1', fontSize: '0.82rem' }}>
                          #{app.task_id}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {app.app_name}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={app.status}
                            sx={{
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              bgcolor: app.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                              color: app.status === 'active' ? '#10b981' : 'text.secondary',
                              textTransform: 'capitalize'
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 600 }}>
                          {formatKolkataDate(app.live_checking_date)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={`${app.pendingSubmissions} Pending / ${app.totalSubmissions} Total`}
                            sx={{
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '0.72rem',
                              bgcolor: 'rgba(245,158,11,0.15)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245,158,11,0.3)'
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleOpenTask(app.task_id)}
                            endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              borderRadius: '10px',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              textTransform: 'none',
                              bgcolor: '#10b981',
                              boxShadow: '0 4px 14px rgba(16,185,129,0.25)',
                              '&:hover': { bgcolor: '#059669' }
                            }}
                          >
                            Audit Live List
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  {pendingApps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">No pending live applications found.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Snackbar Alert */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack({ ...snack, open: false })}
          severity={snack.severity}
          sx={{ width: '100%', borderRadius: '14px', fontWeight: 700 }}
        >
          {snack.message}
        </Alert>
      </Snackbar>

      {/* Dialog: Add Missing Member */}
      <Dialog
        open={addMissingOpen}
        onClose={() => setAddMissingOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1.5,
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon sx={{ color: '#6366f1' }} /> Add Missing Member to Live List
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Manually add an earner submission for this task. It will automatically bind to an available slot.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField 
              fullWidth
              label="Submitted Username *"
              placeholder="e.g. JohnDoe99"
              size="small"
              value={missingData.username}
              onChange={e => setMissingData({ ...missingData, username: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
            <Autocomplete
              options={allEarners}
              getOptionLabel={(option) => {
                const name = `${option.first_name || ''} ${option.last_name || ''}`.trim();
                const shortId = option.earner_id ? option.earner_id.split('/').pop() : '';
                return `${name} (${shortId}) - ${option.earner_id}`;
              }}
              loading={fetchingOptions}
              onChange={(e, val) => setMissingData({ ...missingData, earnerId: val ? val.earner_id : '' })}
              renderInput={(params) => (
                <TextField 
                  {...params}
                  label="Select Earner Profile *"
                  size="small" 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              )}
            />
            
            <Autocomplete
              options={allBulkers}
              getOptionLabel={(option) => {
                const shortId = option.bulker_id ? option.bulker_id.split('/').pop() : '';
                return `${option.full_name} (${shortId}) - ${option.bulker_id}`;
              }}
              loading={fetchingOptions}
              onChange={(e, val) => setMissingData({ ...missingData, bulkerId: val ? val.bulker_id : '' })}
              renderInput={(params) => (
                <TextField 
                  {...params}
                  label="Select Bulker Desk *"
                  size="small" 
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            onClick={() => setAddMissingOpen(false)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={submitAddMissing}
            variant="contained"
            disabled={addingMissing}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' }
            }}
          >
            {addingMissing ? 'Adding...' : 'Add Member to Review'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Edit Submitted Username */}
      <Dialog
        open={editUsernameDialog.open}
        onClose={() => !editUsernameDialog.saving && setEditUsernameDialog(prev => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1.5,
            bgcolor: isDark ? 'rgba(15,23,42,0.95)' : '#ffffff',
            backdropFilter: 'blur(20px)',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon sx={{ color: '#6366f1' }} fontSize="small" /> Edit Submitted Username
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
          {editUsernameDialog.member && (
            <Box sx={{ mb: 2, p: 1.5, borderRadius: '12px', bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                <b>Earner:</b> {editUsernameDialog.member.formatted_earner}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                <b>Bulker:</b> {editUsernameDialog.member.formatted_bulker}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            autoFocus
            label="Submitted Username"
            size="small"
            value={editUsernameDialog.newUsername}
            onChange={(e) => setEditUsernameDialog(prev => ({ ...prev, newUsername: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveUsername();
              }
            }}
            placeholder="Enter corrected username..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' }, mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setEditUsernameDialog(prev => ({ ...prev, open: false }))}
            disabled={editUsernameDialog.saving}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveUsername}
            variant="contained"
            disabled={editUsernameDialog.saving || !editUsernameDialog.newUsername.trim()}
            sx={{
              borderRadius: '10px',
              px: 2.5,
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#6366f1',
              '&:hover': { bgcolor: '#4f46e5' }
            }}
          >
            {editUsernameDialog.saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

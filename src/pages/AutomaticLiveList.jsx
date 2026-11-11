import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox, Chip, IconButton, useTheme, Snackbar, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Autocomplete,
  Tooltip, Divider, InputAdornment, Tabs, Tab, Card, CardContent, Grid,
  LinearProgress, Stack
} from '@mui/material';
import { supabase } from '../supabaseClient';
import { getApiBaseUrl, getApiHeaders } from '../utils/apiConfig';
import Swal from 'sweetalert2';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TableChartIcon from '@mui/icons-material/TableChart';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ClearIcon from '@mui/icons-material/Clear';
import StarIcon from '@mui/icons-material/Star';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RemoveDoneIcon from '@mui/icons-material/RemoveDone';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

/**
 * Fuzzy Name Matcher: Computes similarity percentage between 0% and 100%
 */
function calculateNameMatch(submittedName, playStoreName) {
  if (!submittedName || !playStoreName) return 0;
  
  // Clean strings
  const s1 = submittedName.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const s2 = playStoreName.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;

  // Substring or contain match
  if (s1.length > 2 && s2.length > 2) {
    if (s1 === s2) return 100;
    if (s1.includes(s2) || s2.includes(s1)) {
      const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
      return Math.round(85 + (ratio * 15));
    }
  }

  // Token matching (first name, last name order variations)
  const words1 = s1.split(' ').filter(w => w.length > 1);
  const words2 = s2.split(' ').filter(w => w.length > 1);
  if (words1.length > 0 && words2.length > 0) {
    let matchedWords = 0;
    for (const w1 of words1) {
      if (words2.some(w2 => w2 === w1 || (w1.length > 3 && w2.includes(w1)) || (w2.length > 3 && w1.includes(w2)))) {
        matchedWords++;
      }
    }
    const tokenRatio = matchedWords / Math.max(words1.length, words2.length);
    if (tokenRatio >= 0.8) return Math.round(tokenRatio * 95);
    if (tokenRatio >= 0.5) return Math.round(tokenRatio * 85);
  }

  // Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;
  if (Math.abs(len1 - len2) > 8) return 0;

  const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const dist = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const score = Math.max(0, Math.round((1 - dist / maxLen) * 100));
  return score >= 60 ? score : 0;
}

export default function AutomaticLiveList() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [taskIdInput, setTaskIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [appDetails, setAppDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Google Sheet Data States
  const [sheetData, setSheetData] = useState(null);
  const [viewTab, setViewTab] = useState(0); // 0: Auto Matched, 1: Unmatched / Low Match, 2: All Submissions, 3: Google Sheet Reviews
  const [todayApps, setTodayApps] = useState([]);

  // Cached Bulker Desks & Acceptances
  const [bulkerDesksList, setBulkerDesksList] = useState([]);
  const [appAcceptancesList, setAppAcceptancesList] = useState([]);

  // Search input ref
  const searchInputRef = useRef(null);

  // Missing member dialog state
  const [addMissingOpen, setAddMissingOpen] = useState(false);
  const [missingData, setMissingData] = useState({ username: '', earnerId: '', bulkerId: '' });
  const [addingMissing, setAddingMissing] = useState(false);
  const [allEarners, setAllEarners] = useState([]);
  const [allBulkers, setAllBulkers] = useState([]);
  const [fetchingOptions, setFetchingOptions] = useState(false);

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

  // Fetch today's scheduled apps on mount
  useEffect(() => {
    fetchTodayApps();
  }, []);

  const fetchTodayApps = async () => {
    try {
      const todayIST = new Date(new Date().getTime() + 330 * 60000).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('apps')
        .select('id, task_id, app_name, app_package, app_date, live_checking_date')
        .eq('live_checking_date', todayIST)
        .order('task_id', { ascending: false });
      if (!error && data) {
        setTodayApps(data);
      }
    } catch (e) {
      console.warn('Error fetching today apps:', e.message);
    }
  };

  /**
   * Fetch Extracted Google Sheet info for task
   */
  const fetchLiveSheetInfo = async (taskId) => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/live-sheets/app/${taskId}`, {
        headers: getApiHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setSheetData(json.data);
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Could not fetch cached live sheet info:', err.message);
    }
    setSheetData(null);
    return null;
  };

  /**
   * Trigger Manual Extraction on demand for this app
   */
  const handleExtractNow = async () => {
    if (!appDetails) return;
    setExtracting(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/live-sheets/manual-extract/${appDetails.taskId}`, {
        method: 'POST',
        headers: getApiHeaders()
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        throw new Error(json.error || 'Extraction failed');
      }

      setSheetData(json.data);
      setSnack({ 
        open: true, 
        message: `Extracted ${json.data.total_reviews} Play Store reviews successfully! Google Sheet generated.`, 
        severity: 'success' 
      });

      // Re-run matching with new sheet data
      applyMatchingWithSheet(members, json.data);
    } catch (err) {
      setSnack({ open: true, message: 'Review extraction error: ' + err.message, severity: 'error' });
    } finally {
      setExtracting(false);
    }
  };

  /**
   * Apply Matching Algorithm to members against Google Sheet Reviews
   */
  const applyMatchingWithSheet = (membersList, sheetInfo) => {
    const playStoreReviews = sheetInfo?.reviews || [];
    const autoMatchedIds = [];

    const updated = membersList.map(m => {
      let bestScore = 0;
      let matchedReview = null;

      const subName = (m.submitted_username || '').trim();
      const earnerName = (m.formatted_earner || '').split('(')[0].trim();

      for (const rev of playStoreReviews) {
        const pName = (rev.userName || '').trim();
        const score1 = calculateNameMatch(subName, pName);
        const score2 = calculateNameMatch(earnerName, pName);
        const score = Math.max(score1, score2);

        if (score > bestScore) {
          bestScore = score;
          matchedReview = rev;
        }
      }

      const isLiveAlready = m.status === 'Live';
      const isAutoMatched = bestScore >= 80;

      if (isAutoMatched || isLiveAlready) {
        autoMatchedIds.push(m.id);
      }

      return {
        ...m,
        matchScore: bestScore,
        matchedReview: matchedReview,
        isAutoMatched: isAutoMatched
      };
    });

    setMembers(updated);
    setSelectedIds([...new Set(autoMatchedIds)]);
    if (autoMatchedIds.length > 0) {
      setViewTab(0);
    } else {
      setViewTab(2);
    }
    return updated;
  };

  /**
   * Main App Fetcher
   */
  const fetchAppDetailsById = async (inputVal) => {
    const targetInput = inputVal || taskIdInput;
    if (!targetInput || !targetInput.trim()) return;
    setLoading(true);
    setSheetData(null);
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

      // Fetch Sponsor Name
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

      // Fetch Bulker Desks & Acceptances
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
        package: appData.app_package,
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
        rawAppDate: appData.app_date,
        liveCheckingDate: formatKolkataDate(appData.live_checking_date),
        rawLiveDate: appData.live_checking_date,
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

      // 3. Fetch Earner Names
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
            formatted_bulker: `${bName} (${mShortBulker})`,
            matchScore: 0,
            matchedReview: null,
            isAutoMatched: false
          };
        });
      }

      // 4. Fetch Google Sheet reviews & execute automated fuzzy matching
      const liveSheetInfo = await fetchLiveSheetInfo(appData.task_id);
      applyMatchingWithSheet(finalMembers, liveSheetInfo);

      setSnack({ 
        open: true, 
        message: `Task #${appData.task_id} loaded (${finalMembers.length} submissions). Match completed.`, 
        severity: 'success' 
      });

      setTimeout(() => { searchInputRef.current?.focus(); }, 150);

    } catch (error) {
      setAppDetails(null);
      setMembers([]);
      setSelectedIds([]);
      setSnack({ open: true, message: error.message, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAppDetails = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    fetchAppDetailsById(taskIdInput);
  };

  // Economics calculation (identical to existing LiveListManagement)
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
    let shouldCreditUserWallet = false;
    let shouldCreditBulkerWallet = false;

    if (isPratik) {
      userReward = 8.00;
      bulkerProfit = Math.max(0, bulkerAssignedAmount - 8.00);
      shouldCreditUserWallet = true;
      shouldCreditBulkerWallet = bulkerProfit > 0;
    } else {
      const deskAccountType = String(bulkerDesk?.account_type || '').trim().toLowerCase();
      if (deskAccountType === 'wallet system') {
        userReward = 8.00;
        bulkerProfit = Math.max(0, bulkerAssignedAmount - 8.00);
        shouldCreditUserWallet = true;
        shouldCreditBulkerWallet = bulkerProfit > 0;
      } else {
        userReward = 0;
        bulkerProfit = bulkerAssignedAmount;
        shouldCreditUserWallet = false;
        shouldCreditBulkerWallet = bulkerProfit > 0;
      }
    }

    return {
      userReward,
      bulkerProfit,
      fullBulkerId,
      shouldCreditUserWallet,
      shouldCreditBulkerWallet,
      bulkerCode,
      bulkerName
    };
  };

  // Filtered members by search query and active view tab
  const filteredMembers = useMemo(() => {
    let list = members;

    // View tab filtering
    if (viewTab === 0) {
      // Auto Matched (>=80%)
      list = list.filter(m => (m.matchScore || 0) >= 80);
    } else if (viewTab === 1) {
      // Unmatched or Partial Match (<80%)
      list = list.filter(m => (m.matchScore || 0) < 80);
    }

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(m => 
        (m.submitted_username && m.submitted_username.toLowerCase().includes(q)) ||
        (m.formatted_earner && m.formatted_earner.toLowerCase().includes(q)) ||
        (m.formatted_bulker && m.formatted_bulker.toLowerCase().includes(q)) ||
        (m.earner_id && m.earner_id.toLowerCase().includes(q))
      );
    }

    // Sort by match score descending (100% to 0%)
    return [...list].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }, [members, viewTab, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = members.length;
    const matched = members.filter(m => (m.matchScore || 0) >= 80).length;
    const unmatched = total - matched;
    const selected = selectedIds.length;
    return { total, matched, unmatched, selected };
  }, [members, selectedIds]);

  // Selection handlers
  const handleToggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAllMatched = () => {
    const matchedIds = members.filter(m => (m.matchScore || 0) >= 80).map(m => m.id);
    setSelectedIds(prev => [...new Set([...prev, ...matchedIds])]);
    setSnack({ open: true, message: `Selected ${matchedIds.length} matched users`, severity: 'success' });
  };

  const handleSelectExact100Only = () => {
    const exactIds = members.filter(m => (m.matchScore || 0) === 100).map(m => m.id);
    setSelectedIds(exactIds);
    setSnack({ open: true, message: `Selected ${exactIds.length} 100% exact matched users`, severity: 'success' });
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredMembers.map(m => m.id);
    setSelectedIds(prev => [...new Set([...prev, ...ids])]);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Zero Live Action
  const handleZeroLive = async () => {
    if (!appDetails) return;
    const result = await Swal.fire({
      title: 'Apply Zero Live?',
      text: `Mark ALL submissions for Task #${appDetails.taskId} as Not Live and revert wallet credits?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, Apply Zero Live',
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#ffffff' : '#000000'
    });

    if (!result.isConfirmed) return;
    setSaving(true);
    try {
      await supabase.from('review_submit_data').update({ status: 'Not Live' }).eq('app_id', appDetails.id);
      await supabase.from('individual_wallet_transactions').delete().eq('app_id', appDetails.id);

      setSnack({ open: true, message: 'Zero Live applied successfully!', severity: 'success' });
      setAppDetails(null);
      setMembers([]);
      setSelectedIds([]);
      setTaskIdInput('');
    } catch (err) {
      setSnack({ open: true, message: 'Zero Live error: ' + err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Save Live List Action (with standard wallet & bulker payouts)
  const handleSaveLiveList = async () => {
    if (!appDetails) return;
    setSaving(true);
    try {
      const toMarkLive = members.filter(m => selectedIds.includes(m.id) && m.status !== 'Live');
      const toMarkNotLive = members.filter(m => !selectedIds.includes(m.id) && m.status !== 'Not Live');

      if (toMarkLive.length === 0 && toMarkNotLive.length === 0) {
        setSnack({ open: true, message: 'No status changes to commit.', severity: 'info' });
        setSaving(false);
        return;
      }

      // Mark Live
      if (toMarkLive.length > 0) {
        const { error: updateErr } = await supabase
          .from('review_submit_data')
          .update({ status: 'Live' })
          .in('id', toMarkLive.map(m => m.id));
        if (updateErr) throw updateErr;

        const generateTrxId = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let res = '';
          for (let i = 0; i < 16; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
          return res;
        };

        const normalizeId = (v) => String(v ?? '').trim();
        const allSelectedEarnersArr = members
          .filter(m => selectedIds.includes(m.id))
          .map(m => normalizeId(m.earner_id))
          .filter(Boolean);

        const { data: liveProfiles = [] } = await supabase
          .from('profiles')
          .select('earner_id, referral_code, bulker_id, fcm_token')
          .in('earner_id', allSelectedEarnersArr);

        const { data: existingTxns } = await supabase
          .from('individual_wallet_transactions')
          .select('earner_id, description')
          .eq('app_id', appDetails.id);

        const existingDescriptions = new Set((existingTxns || []).map(t => t.description));
        const existingEarnersReward = new Set((existingTxns || [])
          .filter(t => t.description && t.description.startsWith('Reward for Task ID'))
          .map(t => t.earner_id)
        );

        const profileByEarner = Object.fromEntries((liveProfiles || []).map(p => [normalizeId(p.earner_id), p]));
        const walletTransactions = [];
        const primaryNotifications = [];

        toMarkLive.forEach(m => {
          const normEarnerId = normalizeId(m.earner_id);
          const earnerProfile = profileByEarner[normEarnerId];
          const eco = calculateMemberEconomics(m);

          if (eco.shouldCreditUserWallet && eco.userReward > 0) {
            if (!existingEarnersReward.has(normEarnerId)) {
              walletTransactions.push({
                transaction_id: generateTrxId(),
                earner_id: normEarnerId,
                app_id: appDetails.id,
                amount: eco.userReward,
                transaction_type: 'Credit',
                description: `Reward for Task ID ${appDetails.taskId}: ${appDetails.name}`,
                status: 'Completed'
              });

              primaryNotifications.push({
                earner_id: normEarnerId,
                fcm_token: earnerProfile?.fcm_token || null,
                title: 'Wallet Credited',
                body: `You received Rs. ${eco.userReward} for completing ${appDetails.name}.`,
                type: 'wallet'
              });
            }
          }

          if (eco.shouldCreditBulkerWallet && eco.fullBulkerId && eco.bulkerProfit > 0) {
            const bulkerDesc = `Bulker Reward for Task ID ${appDetails.taskId}: ${appDetails.name} (${normEarnerId})`;
            if (!existingDescriptions.has(bulkerDesc)) {
              walletTransactions.push({
                transaction_id: generateTrxId(),
                earner_id: eco.fullBulkerId,
                app_id: appDetails.id,
                amount: eco.bulkerProfit,
                transaction_type: 'Credit',
                description: bulkerDesc,
                status: 'Completed'
              });
              existingDescriptions.add(bulkerDesc);
            }
          }
        });

        if (walletTransactions.length > 0) {
          const { error: wErr } = await supabase.from('individual_wallet_transactions').insert(walletTransactions);
          if (wErr) throw wErr;

          if (primaryNotifications.length > 0) {
            const baseUrl = getApiBaseUrl();
            Promise.all(primaryNotifications.map(notif => 
              fetch(`${baseUrl}/api/send-notification`, {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify(notif)
              }).catch(e => console.warn(e))
            )).catch(() => {});
          }
        }
      }

      // Mark Not Live
      if (toMarkNotLive.length > 0) {
        await supabase
          .from('review_submit_data')
          .update({ status: 'Not Live' })
          .in('id', toMarkNotLive.map(m => m.id));

        const revertEarnerIds = toMarkNotLive.map(m => m.earner_id);
        await supabase
          .from('individual_wallet_transactions')
          .delete()
          .eq('app_id', appDetails.id)
          .in('earner_id', revertEarnerIds);
      }

      Swal.fire({
        title: 'Live List Synchronized!',
        text: `Successfully updated: ${toMarkLive.length} confirmed Live, ${toMarkNotLive.length} marked Not Live.`,
        icon: 'success',
        confirmButtonColor: '#10b981',
        background: isDark ? '#0f172a' : '#fff',
        color: isDark ? '#f8fafc' : '#0f172a'
      });

      setAppDetails(null);
      setMembers([]);
      setSelectedIds([]);
      setTaskIdInput('');
    } catch (err) {
      setSnack({ open: true, message: 'Sync error: ' + err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1600, margin: '0 auto' }}>
      {/* Page Title & Breadcrumb Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#8b5cf6', fontSize: 28 }} />
            <Typography variant="h5" fontWeight="bold">
              Automatic Live List Verification
            </Typography>
            <Chip 
              label="Google Sheets AI Match" 
              size="small" 
              sx={{ bgcolor: '#8b5cf6', color: '#fff', fontWeight: 'bold' }} 
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Play Store reviews are matched from 100% down to 0% against user submissions with auto-selection.
          </Typography>
        </Box>

        {/* Task ID Input */}
        <Paper 
          component="form" 
          onSubmit={fetchAppDetails} 
          sx={{ 
            p: '2px 4px', 
            display: 'flex', 
            alignItems: 'center', 
            width: { xs: '100%', sm: 380 },
            boxShadow: theme.shadows[2],
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
          }}
        >
          <TextField
            inputRef={searchInputRef}
            size="small"
            fullWidth
            placeholder="Enter Task ID (e.g. 1645)..."
            value={taskIdInput}
            onChange={(e) => setTaskIdInput(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">#</InputAdornment>,
              endAdornment: taskIdInput ? (
                <IconButton size="small" onClick={() => setTaskIdInput('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              ) : null
            }}
            sx={{ '& fieldset': { border: 'none' } }}
          />
          <Button 
            variant="contained" 
            onClick={fetchAppDetails} 
            disabled={loading || !taskIdInput.trim()}
            sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' }, px: 3, borderRadius: 2 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Fetch'}
          </Button>
        </Paper>
      </Box>

      {/* Quick Access Pills for Today's Scheduled Apps */}
      {todayApps.length > 0 && (
        <Paper 
          sx={{ 
            p: 1.5, 
            mb: 3, 
            borderRadius: 2, 
            bgcolor: isDark ? '#111827' : '#f8fafc', 
            border: `1px solid ${isDark ? '#1f293d' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap'
          }}
        >
          <Typography variant="body2" fontWeight="bold" sx={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarMonthIcon fontSize="small" /> Today&apos;s Live Apps ({todayApps.length}):
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {todayApps.map(app => (
              <Chip
                key={app.id}
                label={`#${app.task_id} ${app.app_name}`}
                onClick={() => {
                  setTaskIdInput(String(app.task_id));
                  fetchAppDetailsById(String(app.task_id));
                }}
                clickable
                color={appDetails?.taskId === app.task_id ? 'primary' : 'default'}
                variant={appDetails?.taskId === app.task_id ? 'filled' : 'outlined'}
                size="small"
                sx={{ fontWeight: 600, fontSize: 12 }}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* App Details Header & Google Sheet Status */}
      {appDetails && (
        <Box sx={{ mb: 3 }}>
          {/* Main App Info Card */}
          <Paper sx={{ p: 2.5, mb: 2, borderRadius: 3, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" fontWeight="bold">
                    [Task #{appDetails.taskId}] {appDetails.name}
                  </Typography>
                  <Chip label={appDetails.sponsorType} size="small" color="primary" />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Package: <code style={{ color: '#8b5cf6' }}>{appDetails.package}</code> &bull; Provider: <strong>{appDetails.provider}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Release Date: <strong>{appDetails.appDate}</strong> &bull; Live Date: <strong>{appDetails.liveCheckingDate}</strong>
                </Typography>
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={handleZeroLive}
                  disabled={saving}
                >
                  Zero Live
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSaveLiveList}
                  disabled={saving}
                  sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, px: 3, fontWeight: 'bold' }}
                >
                  {saving ? <CircularProgress size={22} color="inherit" /> : `Save Live List (${selectedIds.length} Selected)`}
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Google Sheet Live Automation Bar */}
            <Paper 
              sx={{ 
                p: 2, 
                bgcolor: isDark ? '#1e1b4b' : '#f5f3ff', 
                border: `1px solid ${isDark ? '#4338ca' : '#ddd6fe'}`,
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 2
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <TableChartIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ color: isDark ? '#c7d2fe' : '#4c1d95' }}>
                      Google Sheet Live Status:
                    </Typography>
                    {sheetData ? (
                      <Chip 
                        label={`Synced (${sheetData.total_reviews} Play Store Reviews)`} 
                        size="small" 
                        color="success" 
                        sx={{ fontWeight: 'bold' }} 
                      />
                    ) : (
                      <Chip 
                        label="No Sheet Linked" 
                        size="small" 
                        color="warning" 
                        sx={{ fontWeight: 'bold' }} 
                      />
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ color: isDark ? '#94a3b8' : '#6b7280' }}>
                    {sheetData?.sheet_url ? (
                      <span>Public Link: <a href={sheetData.sheet_url} target="_blank" rel="noreferrer" style={{ color: '#8b5cf6', fontWeight: 'bold' }}>{sheetData.sheet_url.substring(0, 75)}...</a></span>
                    ) : (
                      <span>Click extract below to scrape Play Store reviews from release date ({appDetails.appDate}) to today.</span>
                    )}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                {sheetData?.sheet_url && (
                  <Button
                    variant="contained"
                    size="small"
                    component="a"
                    href={sheetData.sheet_url}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<OpenInNewIcon />}
                    sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 'bold' }}
                  >
                    Open Google Sheet ↗
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleExtractNow}
                  disabled={extracting}
                  startIcon={extracting ? <CircularProgress size={16} /> : <RefreshIcon />}
                  sx={{ borderColor: '#8b5cf6', color: '#8b5cf6', '&:hover': { borderColor: '#7c3aed' }, fontWeight: 'bold' }}
                >
                  {extracting ? 'Scraping Play Store...' : (sheetData ? 'Re-sync Reviews' : 'Extract Reviews Now')}
                </Button>
              </Box>
            </Paper>
          </Paper>

          {/* Quick Selection & Statistics Toolbar */}
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              {/* Tabs */}
              <Tabs 
                value={viewTab} 
                onChange={(_, v) => setViewTab(v)}
                sx={{ 
                  '& .Mui-selected': { color: '#8b5cf6 !important', fontWeight: 'bold' },
                  '& .MuiTabs-indicator': { bgcolor: '#8b5cf6' }
                }}
              >
                <Tab 
                  label={`Auto-Matched (${stats.matched})`} 
                  icon={<CheckCircleIcon sx={{ color: '#10b981', fontSize: 18 }} />} 
                  iconPosition="start" 
                />
                <Tab 
                  label={`Unmatched / Partial (${stats.unmatched})`} 
                  icon={<WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 18 }} />} 
                  iconPosition="start" 
                />
                <Tab 
                  label={`All Submissions (${stats.total})`} 
                />
                <Tab 
                  label={`Play Store Sheet Reviews (${sheetData?.total_reviews || 0})`} 
                  icon={<TableChartIcon sx={{ color: '#3b82f6', fontSize: 18 }} />} 
                  iconPosition="start" 
                />
              </Tabs>

              {/* Quick Select Actions */}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button 
                  size="small" 
                  variant="outlined" 
                  startIcon={<DoneAllIcon />}
                  onClick={handleSelectAllMatched}
                  sx={{ borderColor: '#10b981', color: '#10b981', fontSize: 12 }}
                >
                  Select All Matched (≥80%)
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  startIcon={<StarIcon />}
                  onClick={handleSelectExact100Only}
                  sx={{ borderColor: '#8b5cf6', color: '#8b5cf6', fontSize: 12 }}
                >
                  Select 100% Only
                </Button>
                <Button 
                  size="small" 
                  variant="outlined" 
                  startIcon={<RemoveDoneIcon />}
                  onClick={handleClearSelection}
                  sx={{ borderColor: '#6b7280', color: '#6b7280', fontSize: 12 }}
                >
                  Clear Selection
                </Button>
              </Stack>
            </Box>

            {/* Search Filter */}
            {viewTab !== 3 && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Filter members by name, earner ID, or bulker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery ? (
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    ) : null
                  }}
                />
              </Box>
            )}
          </Paper>

          {/* Tab 3: Google Sheet Raw Play Store Reviews Viewer */}
          {viewTab === 3 ? (
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 650 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>#</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>Reviewer Name (Play Store)</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Rating</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>Review Content</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>Date & Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(sheetData?.reviews || []).map((rev, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 'bold', color: '#8b5cf6' }}>{rev.userName}</TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Chip label={`★ ${rev.rating}`} size="small" sx={{ bgcolor: '#fbbf24', color: '#000', fontWeight: 'bold' }} />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 450 }}>{rev.content}</TableCell>
                        <TableCell>{rev.at || rev.date}</TableCell>
                      </TableRow>
                    ))}
                    {(!sheetData?.reviews || sheetData.reviews.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                          No reviews loaded yet. Click &quot;Extract Reviews Now&quot; above to scrape.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : (
            /* Submissions Table with AI Matching Engine */
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 700 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9' }}>
                        <Checkbox
                          checked={filteredMembers.length > 0 && filteredMembers.every(m => selectedIds.includes(m.id))}
                          indeterminate={filteredMembers.some(m => selectedIds.includes(m.id)) && !filteredMembers.every(m => selectedIds.includes(m.id))}
                          onChange={handleSelectAllFiltered}
                        />
                      </TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>Submitted Username</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Match Rate</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>Matched Play Store Reviewer</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>Earner Details</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold' }}>Bulker Desk</TableCell>
                      <TableCell sx={{ bgcolor: isDark ? '#1e293b' : '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredMembers.map((m) => {
                      const isSelected = selectedIds.includes(m.id);
                      const score = m.matchScore || 0;
                      
                      let matchColor = '#64748b';
                      let matchBg = '#f1f5f9';
                      if (score === 100) {
                        matchColor = '#059669';
                        matchBg = isDark ? '#064e3b' : '#d1fae5';
                      } else if (score >= 80) {
                        matchColor = '#10b981';
                        matchBg = isDark ? '#065f46' : '#ecfdf5';
                      } else if (score >= 50) {
                        matchColor = '#d97706';
                        matchBg = isDark ? '#78350f' : '#fef3c7';
                      }

                      return (
                        <TableRow 
                          key={m.id} 
                          hover 
                          selected={isSelected}
                          onClick={() => handleToggle(m.id)}
                          sx={{ cursor: 'pointer', bgcolor: isSelected ? (isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.06)') : 'inherit' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox checked={isSelected} />
                          </TableCell>

                          {/* Submitted Username */}
                          <TableCell sx={{ fontWeight: 'bold' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <span>{m.submitted_username || 'Anonymous'}</span>
                              {score === 100 && (
                                <Tooltip title="100% Exact Match with Google Sheet">
                                  <CheckCircleIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>

                          {/* Match Rate Badge (100% to 0%) */}
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Chip 
                              label={`${score}% Match`} 
                              size="small" 
                              sx={{ 
                                bgcolor: matchBg, 
                                color: matchColor, 
                                fontWeight: 'bold',
                                border: `1px solid ${matchColor}`
                              }} 
                            />
                          </TableCell>

                          {/* Matched Play Store Reviewer Snippet */}
                          <TableCell>
                            {m.matchedReview ? (
                              <Box>
                                <Typography variant="body2" fontWeight="bold" sx={{ color: '#8b5cf6' }}>
                                  {m.matchedReview.userName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300, display: 'block' }}>
                                  &quot;{m.matchedReview.content || 'Rating only'}&quot;
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                No match found in sheet
                              </Typography>
                            )}
                          </TableCell>

                          {/* Earner Details */}
                          <TableCell>
                            <Typography variant="body2">{m.formatted_earner}</Typography>
                          </TableCell>

                          {/* Bulker Desk */}
                          <TableCell>
                            <Typography variant="body2">{m.formatted_bulker}</Typography>
                          </TableCell>

                          {/* Status */}
                          <TableCell sx={{ textAlign: 'center' }}>
                            <Chip 
                              label={isSelected ? 'Selected (Live)' : (m.status || 'Under Review')} 
                              size="small" 
                              color={isSelected ? 'success' : (m.status === 'Not Live' ? 'error' : 'default')}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {filteredMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                          No submissions matching the current filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* Snackbar feedback */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snack.severity} sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

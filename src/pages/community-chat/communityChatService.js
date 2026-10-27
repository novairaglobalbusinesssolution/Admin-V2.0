import { chatSupabase } from '../../communityChatClient';
import { supabase as mainSupabase } from '../../supabaseClient';

const MPIN_STORAGE_KEY = 'novaira_chat_admin_mpin';
const SETTINGS_KEY = 'novaira_chat_system_settings';
const DEFAULT_MPIN = '1234';

// Default system settings
const defaultSettings = {
  chatFrozen: false,
  slowModeSeconds: 0,
  bannedKeywords: ['whatsapp', 'call me', 'inbox me', 'contact at', 'phone', 't.me/join', 'cashapp', 'telegram group', 'betting'],
  mutedUsers: [],
  userPermissions: {} // { [earnerId]: { canSendLinks: false, canSendMedia: false } }
};

// ----------------- M-PIN MANAGEMENT -----------------
export const getAdminMpin = () => {
  return localStorage.getItem(MPIN_STORAGE_KEY) || DEFAULT_MPIN;
};

export const setAdminMpin = (newPin) => {
  if (!newPin || newPin.length < 4) throw new Error('M-PIN must be at least 4 digits');
  localStorage.setItem(MPIN_STORAGE_KEY, newPin);
  return true;
};

export const verifyAdminMpin = (inputPin) => {
  const current = getAdminMpin();
  return String(inputPin).trim() === String(current).trim();
};

// ----------------- CHAT SETTINGS -----------------
export const getChatSettings = async () => {
  try {
    // Check if there is a SYS-CONFIG row in community_chat
    const { data } = await chatSupabase
      .from('community_chat')
      .select('*')
      .eq('sender_id', 'SYS-CONFIG')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      try {
        const parsed = JSON.parse(data[0].message);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
        return { ...defaultSettings, ...parsed, configRowId: data[0].id };
      } catch (_) {}
    }
  } catch (_) {}

  // Fallback to local
  const local = localStorage.getItem(SETTINGS_KEY);
  return local ? { ...defaultSettings, ...JSON.parse(local) } : { ...defaultSettings };
};

export const saveChatSettings = async (newSettings) => {
  const merged = { ...defaultSettings, ...newSettings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));

  try {
    // Broadcast config via SYS-CONFIG
    const payload = JSON.stringify(merged);
    const { data: existing } = await chatSupabase
      .from('community_chat')
      .select('id')
      .eq('sender_id', 'SYS-CONFIG')
      .limit(1);

    if (existing && existing.length > 0) {
      await chatSupabase
        .from('community_chat')
        .update({
          message: payload,
          sender_badge: 'System Settings',
          sender_name: 'System Config'
        })
        .eq('id', existing[0].id);
    } else {
      await chatSupabase
        .from('community_chat')
        .insert([{
          sender_name: 'System Config',
          sender_id: 'SYS-CONFIG',
          sender_badge: 'System Settings',
          message: payload
        }]);
    }
  } catch (err) {
    console.error('Failed to sync settings to Supabase:', err);
  }

  return merged;
};

// ----------------- MESSAGES MANAGEMENT -----------------
export const fetchMessages = async (limit = 100) => {
  const { data, error } = await chatSupabase
    .from('community_chat')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  // Return chronological
  return (data || []).reverse();
};

export const subscribeToMessages = (onInsert, onUpdate, onDelete) => {
  return chatSupabase
    .channel('community_chat_realtime_admin')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'community_chat' },
      (payload) => {
        if (onInsert) onInsert(payload.new);
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'community_chat' },
      (payload) => {
        if (onUpdate) onUpdate(payload.new);
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'community_chat' },
      (payload) => {
        if (onDelete) onDelete(payload.old);
      }
    )
    .subscribe();
};

export const sendAdminMessage = async ({ message, badge = '👑 Super Admin', name = 'Novaira Admin', mediaUrl = null }) => {
  let content = message.trim();
  if (mediaUrl && mediaUrl.trim()) {
    content = `${content}\n${mediaUrl.trim()}`.trim();
  }

  const { data, error } = await chatSupabase
    .from('community_chat')
    .insert([{
      sender_name: name,
      sender_id: 'SYS-ADMIN',
      sender_badge: badge,
      message: content
    }])
    .select();

  if (error) throw error;
  return data?.[0];
};

export const deleteMessage = async (id) => {
  const { data, error } = await chatSupabase
    .from('community_chat')
    .delete()
    .eq('id', id)
    .select();

  if (error) throw error;
  return data;
};

// ----------------- PINNED NOTICES -----------------
export const getActivePinnedNotice = async () => {
  const { data, error } = await chatSupabase
    .from('community_chat')
    .select('*')
    .eq('sender_id', 'SYS-PINNED')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) return null;
  if (!data || data.length === 0) return null;

  try {
    const parsed = JSON.parse(data[0].message);
    return { ...parsed, rowId: data[0].id, createdAt: data[0].created_at };
  } catch (_) {
    return { title: 'Announcement', message: data[0].message, rowId: data[0].id, createdAt: data[0].created_at };
  }
};

export const pinNotice = async ({ title, message, level = 'info' }) => {
  const payload = JSON.stringify({
    title: title || 'Official Announcement',
    message: message || '',
    level: level || 'info',
    pinnedAt: new Date().toISOString()
  });

  // Remove previous pins first to keep single active sticky pin
  await chatSupabase
    .from('community_chat')
    .delete()
    .eq('sender_id', 'SYS-PINNED');

  const { data, error } = await chatSupabase
    .from('community_chat')
    .insert([{
      sender_name: 'Official Notice',
      sender_id: 'SYS-PINNED',
      sender_badge: '📌 Pinned Notice',
      message: payload
    }])
    .select();

  if (error) throw error;
  return data?.[0];
};

export const unpinNotice = async (rowId) => {
  if (rowId) {
    await chatSupabase.from('community_chat').delete().eq('id', rowId);
  } else {
    await chatSupabase.from('community_chat').delete().eq('sender_id', 'SYS-PINNED');
  }
  return true;
};

// ----------------- ADS & CAMPAIGNS -----------------
export const broadcastAd = async ({ title, description, imageUrl, ctaText, ctaUrl, badge = '📢 Sponsored Promo' }) => {
  const payload = JSON.stringify({
    type: 'ad_banner',
    title: title || 'Featured Promotion',
    description: description || '',
    imageUrl: imageUrl || '',
    ctaText: ctaText || 'Learn More',
    ctaUrl: ctaUrl || '',
    postedAt: new Date().toISOString()
  });

  const { data, error } = await chatSupabase
    .from('community_chat')
    .insert([{
      sender_name: 'Novaira Sponsored',
      sender_id: 'SYS-AD',
      sender_badge: badge,
      message: payload
    }])
    .select();

  if (error) throw error;
  return data?.[0];
};

export const fetchAdsHistory = async () => {
  const { data, error } = await chatSupabase
    .from('community_chat')
    .select('*')
    .eq('sender_id', 'SYS-AD')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data || []).map((row) => {
    let parsed = {};
    try {
      parsed = JSON.parse(row.message);
    } catch (_) {
      parsed = { title: 'Sponsored Ad', description: row.message };
    }
    return { ...parsed, rowId: row.id, created_at: row.created_at, sender_badge: row.sender_badge };
  });
};

// ----------------- USER MODERATION -----------------
// Fetch ONLY users who have sent at least 1 message in Community Group Chat
export const fetchCommunityChatUsers = async () => {
  const { data: messages, error } = await chatSupabase
    .from('community_chat')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const chattersMap = {};
  (messages || []).forEach((m) => {
    if (!m.sender_id || m.sender_id.startsWith('SYS')) return;
    if (!chattersMap[m.sender_id]) {
      chattersMap[m.sender_id] = {
        earner_id: m.sender_id,
        chat_name: m.sender_name,
        chat_badge: m.sender_badge,
        message_count: 0,
        last_message: m.message,
        last_message_at: m.created_at
      };
    }
    chattersMap[m.sender_id].message_count++;
  });

  const earnerIds = Object.keys(chattersMap);
  let profilesMap = {};
  if (earnerIds.length > 0) {
    const { data: profiles } = await mainSupabase
      .from('profiles')
      .select('id, earner_id, first_name, last_name, email, phone, bulker_id, status, created_at')
      .in('earner_id', earnerIds);
    (profiles || []).forEach((p) => {
      profilesMap[p.earner_id] = p;
    });
  }

  const result = Object.values(chattersMap).map((c) => {
    const p = profilesMap[c.earner_id] || {};
    return {
      ...c,
      id: p.id || c.earner_id,
      first_name: p.first_name || c.chat_name,
      last_name: p.last_name || '',
      email: p.email || '—',
      phone: p.phone || '—',
      bulker_id: p.bulker_id || '—',
      status: p.status || 'Active',
      registered_at: p.created_at || c.last_message_at
    };
  });

  // Sort by last active message descending (most recent first)
  return result.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
};

export const fetchRegisteredEarners = async (search = '', limit = 50) => {
  let query = mainSupabase
    .from('profiles')
    .select('id, earner_id, first_name, last_name, email, phone, bulker_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},phone.ilike.${s},earner_id.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const updateUserAccountStatus = async (earnerIdOrProfileId, newStatus) => {
  // Update status in profiles table
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(earnerIdOrProfileId);
  let query = mainSupabase.from('profiles').update({ status: newStatus });

  if (isUuid) {
    query = query.eq('id', earnerIdOrProfileId);
  } else {
    query = query.eq('earner_id', earnerIdOrProfileId);
  }

  const { data, error } = await query.select();
  if (error) throw error;
  return data;
};

export const purgeOldMessages = async (hours = 24) => {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  // We keep SYS-PINNED and SYS-CONFIG so system stays configured
  const { data, error } = await chatSupabase
    .from('community_chat')
    .delete()
    .lt('created_at', cutoff)
    .neq('sender_id', 'SYS-PINNED')
    .neq('sender_id', 'SYS-CONFIG')
    .select();

  if (error) throw error;
  return data;
};

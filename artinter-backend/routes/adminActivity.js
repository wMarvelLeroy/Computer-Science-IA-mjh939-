import express from 'express';
import { supabase } from '../config/supabase.js';
import { requireAuth, isSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin-activity - Journal d'activité (super_admin uniquement)
router.get('/', requireAuth, async (req, res) => {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Accès réservé aux super_admin' });
    }

    const { action_type, admin_id, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('admin_activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (action_type) query = query.eq('action_type', action_type);
    if (admin_id)    query = query.eq('admin_id', admin_id);

    const { data, error, count } = await query;
    if (error) throw error;

    const adminIds = [...new Set((data || []).map(e => e.admin_id).filter(Boolean))];
    const adminMap = {};
    await Promise.all(adminIds.map(async (uid) => {
      try {
        const [{ data: profil }, { data: { user } }] = await Promise.all([
          supabase.from('profils').select('nom, avatar_url').eq('id', uid).single(),
          supabase.auth.admin.getUserById(uid),
        ]);
        adminMap[uid] = { nom: profil?.nom || null, email: user?.email || null, avatar_url: profil?.avatar_url || null };
      } catch { /* silencieux */ }
    }));

    const enriched = (data || []).map(e => ({
      ...e,
      admin: adminMap[e.admin_id] || null,
    }));

    res.json({ success: true, data: enriched, total: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

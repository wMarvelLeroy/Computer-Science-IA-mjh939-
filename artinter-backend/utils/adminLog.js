import { supabase } from '../config/supabase.js';

/**
 * Log une action administrative dans admin_activity_log.
 * Ne throw pas — les erreurs de log ne doivent pas bloquer la réponse.
 *
 * @param {string} adminId   - UUID de l'admin qui agit
 * @param {string} actionType - Ex: 'signalement_traite', 'demande_auteur_approuvee'
 * @param {string} itemTable  - Table concernée (ex: 'signalements')
 * @param {string} itemId     - UUID de l'élément concerné
 * @param {Object} details    - Infos supplémentaires (note, decision, etc.)
 */
export async function logAdminAction(adminId, actionType, itemTable, itemId, details = {}) {
  try {
    await supabase.from('admin_activity_log').insert([{
      admin_id:    adminId,
      action_type: actionType,
      item_table:  itemTable,
      item_id:     itemId,
      details,
    }]);
  } catch { /* silencieux — le log ne doit pas bloquer */ }
}

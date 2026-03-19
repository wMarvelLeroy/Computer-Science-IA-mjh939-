-- =========================================================
-- Migrations : système de commentaires avancé
-- À exécuter dans le SQL Editor de Supabase
-- =========================================================

-- 1. Colonne parent_id (réponses imbriquées, 1 niveau)
ALTER TABLE commentaires
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES commentaires(id) ON DELETE CASCADE;

-- 2. Colonne modifie (mention "modifié" sur le commentaire)
ALTER TABLE commentaires
  ADD COLUMN IF NOT EXISTS modifie BOOLEAN DEFAULT FALSE;

-- 3. Colonne restreint (masqué par la modération)
ALTER TABLE commentaires
  ADD COLUMN IF NOT EXISTS restreint BOOLEAN DEFAULT FALSE;

-- 4. Colonne peut_commenter sur les profils (restriction globale)
ALTER TABLE profils
  ADD COLUMN IF NOT EXISTS peut_commenter BOOLEAN DEFAULT TRUE;

-- 5. Table des signalements de commentaires
CREATE TABLE IF NOT EXISTS signalements_commentaires (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  commentaire_id UUID        NOT NULL REFERENCES commentaires(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES profils(id) ON DELETE CASCADE,
  raison         TEXT        NOT NULL DEFAULT 'contenu_inapproprie',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(commentaire_id, user_id)
);

-- Index pour les performances
-- 6. Colonne statut sur signalements_commentaires (manquant lors de la première migration)
ALTER TABLE signalements_commentaires
  ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'en_attente'
  CHECK (statut IN ('en_attente', 'traite', 'rejete'));

CREATE INDEX IF NOT EXISTS idx_commentaires_article_id ON commentaires(article_id);
CREATE INDEX IF NOT EXISTS idx_commentaires_parent_id  ON commentaires(parent_id);
CREATE INDEX IF NOT EXISTS idx_sig_comm_commentaire_id ON signalements_commentaires(commentaire_id);

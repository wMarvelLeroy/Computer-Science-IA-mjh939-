-- 1. Activer RLS sur la table articles
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- 2. Politique de lecture (SELECT)
-- Tout le monde peut voir les articles publiés
-- Les auteurs peuvent voir leurs propres brouillons
CREATE POLICY "Lecture articles" ON articles
<<<<<<< SEARCH
FOR SELECT
USING (
  est_publie = true 
  OR 
  (auth.uid() = id_auteur)
);
=======
FOR SELECT
USING (
  est_publie = true 
  OR 
  (auth.uid() = id_auteur)
);
>>>>>>> REPLACE
-- 3. Politique d'insertion (INSERT)
-- Seuls les utilisateurs connectés dont l'ID correspond à id_auteur peuvent créer
CREATE POLICY "Création articles" ON articles
FOR INSERT
WITH CHECK (
  auth.uid() = id_auteur
);

-- 4. Politique de modification (UPDATE)
-- Les auteurs modifient leurs propres articles
-- Les admins modifient tout (via role admin dans profils - nécessite logique avancée ou simple contrainte)
CREATE POLICY "Modification articles" ON articles
FOR UPDATE
USING (
  auth.uid() = id_auteur
  OR 
  EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Politique de suppression (DELETE)
CREATE POLICY "Suppression articles" ON articles
FOR DELETE
USING (
  auth.uid() = id_auteur
  OR 
  EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
);

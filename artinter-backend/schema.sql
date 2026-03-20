-- ArtInter Database Schema
-- Schema: public
-- Exported from Supabase PostgreSQL

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET row_security = off;


-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'lecteur',
    'auteur',
    'admin',
    'super_admin'
);


-- Name: approuver_demande_auteur(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approuver_demande_auteur(demande_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_auteur_id UUID;
  v_result JSON;
BEGIN
  -- 1. Vérifier que c'est un admin
  IF NOT EXISTS (
    SELECT 1 FROM profils 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Non autorisé - vous devez être admin';
  END IF;

  -- 2. Récupérer le user_id de la demande
  SELECT user_id INTO v_user_id
  FROM demandes_auteur
  WHERE id = demande_id AND statut = 'en_attente';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Demande non trouvée ou déjà traitée';
  END IF;

  -- 3. Vérifier que l'user n'est pas déjà auteur
  IF EXISTS (
    SELECT 1 FROM profils 
    WHERE id = v_user_id AND auteur_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cet utilisateur est déjà auteur';
  END IF;

  -- 4. Créer l'entrée dans la table auteurs
  INSERT INTO auteurs (est_valide)
  VALUES (true)
  RETURNING id INTO v_auteur_id;

  RAISE NOTICE 'Auteur créé avec ID: %', v_auteur_id;

  -- 5. Mettre à jour le profil
  UPDATE profils
  SET 
    role = 'auteur', 
    auteur_id = v_auteur_id
  WHERE id = v_user_id;

  RAISE NOTICE 'Profil mis à jour pour user: %', v_user_id;

  -- 6. Mettre à jour la demande
  UPDATE demandes_auteur
  SET statut = 'approuvee', updated_at = NOW()
  WHERE id = demande_id;

  RAISE NOTICE 'Demande approuvée: %', demande_id;

  -- 7. Retourner le résultat
  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'auteur_id', v_auteur_id,
    'message', 'Demande approuvée avec succès'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erreur lors de l''approbation: %', SQLERRM;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profils (id, nom, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nom', NEW.email), 'lecteur');
  RETURN NEW;
END;
$$;


--
-- Name: increment_vues(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_vues(article_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE articles 
  SET vues = vues + 1 
  WHERE id = article_id;
END;
$$;


--
-- Name: refuser_demande_auteur(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refuser_demande_auteur(demande_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Vérifier que l'utilisateur actuel est admin
  IF NOT EXISTS (
    SELECT 1 FROM profils 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE demandes_auteur
  SET statut = 'refusee', updated_at = NOW()
  WHERE id = demande_id;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: update_auteur_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_auteur_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Mettre à jour les stats quand un article est créé/modifié
  UPDATE auteurs
  SET 
    total_articles = (
      SELECT COUNT(*) 
      FROM articles 
      WHERE id_auteur = NEW.id_auteur
    ),
    total_vues = (
      SELECT COALESCE(SUM(vues), 0) 
      FROM articles 
      WHERE id_auteur = NEW.id_auteur
    )
  WHERE id = NEW.id_auteur;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;



-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action_type text NOT NULL,
    item_table text,
    item_id uuid,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(255) NOT NULL,
    titre character varying(500) NOT NULL,
    contenu_html text NOT NULL,
    images jsonb DEFAULT '[]'::jsonb,
    id_auteur uuid,
    categorie uuid,
    date_publication timestamp with time zone DEFAULT now(),
    temps_lecture integer,
    tags text[] DEFAULT '{}'::text[],
    est_publie boolean DEFAULT false,
    vues integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contenu_json jsonb
);


--
-- Name: COLUMN articles.contenu_json; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.articles.contenu_json IS 'Raw JSON output from Editor.js for re-editing';


--
-- Name: commentaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commentaires (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid,
    user_id uuid,
    contenu text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_id uuid,
    modifie boolean DEFAULT false,
    restreint boolean DEFAULT false
);


--
-- Name: likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: article_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.article_stats AS
 SELECT a.id,
    a.titre,
    a.slug,
    a.vues,
    a.est_publie,
    count(DISTINCT l.user_id) AS nombre_likes,
    count(DISTINCT c.id) AS nombre_commentaires
   FROM ((public.articles a
     LEFT JOIN public.likes l ON ((a.id = l.article_id)))
     LEFT JOIN public.commentaires c ON ((a.id = c.article_id)))
  GROUP BY a.id, a.titre, a.slug, a.vues, a.est_publie;


--
-- Name: auteurs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auteurs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    est_valide boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    total_articles integer DEFAULT 0,
    total_vues integer DEFAULT 0,
    total_likes integer DEFAULT 0,
    specialites text[],
    langue_preference character varying(10) DEFAULT 'fr'::character varying,
    notif_commentaires boolean DEFAULT true,
    notif_likes boolean DEFAULT true,
    est_banni boolean DEFAULT false NOT NULL
);


--
-- Name: profils; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profils (
    id uuid NOT NULL,
    nom character varying(255),
    bio text,
    avatar_url text,
    role public.user_role DEFAULT 'lecteur'::public.user_role,
    auteur_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    email_public text,
    twitter text,
    linkedin text,
    github text,
    website text,
    facebook text,
    instagram text,
    youtube text,
    visible_dans_recherche boolean,
    couleur_profil character varying(7) DEFAULT NULL::character varying,
    couleur_avatar character varying(7) DEFAULT NULL::character varying,
    peut_commenter boolean DEFAULT true
);


--
-- Name: auteurs_complets; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.auteurs_complets AS
 SELECT a.id AS auteur_id,
    a.est_valide,
    a.total_articles,
    a.total_vues,
    a.total_likes,
    a.specialites,
    a.langue_preference,
    a.notif_commentaires,
    a.notif_likes,
    a.created_at AS auteur_depuis,
    p.id AS user_id,
    p.nom,
    p.bio,
    p.avatar_url,
    p.email_public,
    p.twitter,
    p.linkedin,
    p.github,
    p.website,
    p.facebook,
    p.instagram,
    p.youtube,
    p.role
   FROM (public.auteurs a
     JOIN public.profils p ON ((p.auteur_id = a.id)))
  WHERE (a.est_valide = true);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: demandes_auteur; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_auteur (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    motivation text NOT NULL,
    statut character varying(20) DEFAULT 'en_attente'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT demandes_auteur_statut_check CHECK (((statut)::text = ANY ((ARRAY['en_attente'::character varying, 'approuvee'::character varying, 'refusee'::character varying])::text[])))
);


--
-- Name: demandes_categorie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_categorie (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nom text NOT NULL,
    slug text NOT NULL,
    description text,
    justification text,
    statut text DEFAULT 'en_attente'::text,
    raison_refus text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT demandes_categorie_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'approuvee'::text, 'refusee'::text])))
);


--
-- Name: demandes_reexamination; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demandes_reexamination (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_id uuid NOT NULL,
    type_sanction character varying(50) NOT NULL,
    motif text NOT NULL,
    statut character varying(20) DEFAULT 'en_attente'::character varying NOT NULL,
    reponse_admin text,
    cooldown_jours integer,
    traitee_par uuid,
    traitee_le timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: moderations_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderations_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    item_id uuid NOT NULL,
    claimed_by uuid NOT NULL,
    claimed_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '00:30:00'::interval)
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    titre text NOT NULL,
    message text,
    lu boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    lien text
);


--
-- Name: restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restrictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    admin_id uuid NOT NULL,
    motif text NOT NULL,
    details text,
    expires_at timestamp with time zone,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: signalements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signalements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    user_id uuid NOT NULL,
    raison text NOT NULL,
    description text,
    statut text DEFAULT 'en_attente'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT signalements_raison_check CHECK ((raison = ANY (ARRAY['contenu_inapproprie'::text, 'spam'::text, 'desinformation'::text, 'droits_auteur'::text, 'autre'::text]))),
    CONSTRAINT signalements_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'traite'::text, 'rejete'::text])))
);


--
-- Name: signalements_commentaires; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signalements_commentaires (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commentaire_id uuid NOT NULL,
    user_id uuid NOT NULL,
    raison text DEFAULT 'contenu_inapproprie'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    statut text DEFAULT 'en_attente'::text,
    CONSTRAINT signalements_commentaires_statut_check CHECK ((statut = ANY (ARRAY['en_attente'::text, 'traite'::text, 'rejete'::text])))
);


--
-- Name: suivis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suivis (
    follower_id uuid NOT NULL,
    suivi_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: articles articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_slug_key UNIQUE (slug);


--
-- Name: auteurs auteurs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auteurs
    ADD CONSTRAINT auteurs_pkey PRIMARY KEY (id);


--
-- Name: categories categories_nom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_nom_key UNIQUE (nom);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: commentaires commentaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentaires
    ADD CONSTRAINT commentaires_pkey PRIMARY KEY (id);


--
-- Name: demandes_auteur demandes_auteur_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_auteur
    ADD CONSTRAINT demandes_auteur_pkey PRIMARY KEY (id);


--
-- Name: demandes_auteur demandes_auteur_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_auteur
    ADD CONSTRAINT demandes_auteur_user_id_key UNIQUE (user_id);


--
-- Name: demandes_categorie demandes_categorie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_categorie
    ADD CONSTRAINT demandes_categorie_pkey PRIMARY KEY (id);


--
-- Name: demandes_reexamination demandes_reexamination_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_reexamination
    ADD CONSTRAINT demandes_reexamination_pkey PRIMARY KEY (id);


--
-- Name: likes likes_article_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_article_id_user_id_key UNIQUE (article_id, user_id);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);


--
-- Name: moderations_claims moderations_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderations_claims
    ADD CONSTRAINT moderations_claims_pkey PRIMARY KEY (id);


--
-- Name: moderations_claims moderations_claims_table_name_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderations_claims
    ADD CONSTRAINT moderations_claims_table_name_item_id_key UNIQUE (table_name, item_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profils profils_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils
    ADD CONSTRAINT profils_pkey PRIMARY KEY (id);


--
-- Name: restrictions restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restrictions
    ADD CONSTRAINT restrictions_pkey PRIMARY KEY (id);


--
-- Name: signalements signalements_article_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements
    ADD CONSTRAINT signalements_article_id_user_id_key UNIQUE (article_id, user_id);


--
-- Name: signalements_commentaires signalements_commentaires_commentaire_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements_commentaires
    ADD CONSTRAINT signalements_commentaires_commentaire_id_user_id_key UNIQUE (commentaire_id, user_id);


--
-- Name: signalements_commentaires signalements_commentaires_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements_commentaires
    ADD CONSTRAINT signalements_commentaires_pkey PRIMARY KEY (id);


--
-- Name: signalements signalements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements
    ADD CONSTRAINT signalements_pkey PRIMARY KEY (id);


--
-- Name: suivis suivis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis
    ADD CONSTRAINT suivis_pkey PRIMARY KEY (follower_id, suivi_id);


-- Name: admin_activity_log admin_activity_log_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: articles articles_categorie_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_categorie_fkey FOREIGN KEY (categorie) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: articles articles_id_auteur_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_id_auteur_fkey FOREIGN KEY (id_auteur) REFERENCES public.auteurs(id) ON DELETE SET NULL;


--
-- Name: commentaires commentaires_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentaires
    ADD CONSTRAINT commentaires_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: commentaires commentaires_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentaires
    ADD CONSTRAINT commentaires_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.commentaires(id) ON DELETE CASCADE;


--
-- Name: commentaires commentaires_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentaires
    ADD CONSTRAINT commentaires_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: demandes_auteur demandes_auteur_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_auteur
    ADD CONSTRAINT demandes_auteur_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: demandes_categorie demandes_categorie_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_categorie
    ADD CONSTRAINT demandes_categorie_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: demandes_categorie demandes_categorie_user_id_profile_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_categorie
    ADD CONSTRAINT demandes_categorie_user_id_profile_fkey FOREIGN KEY (user_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: demandes_reexamination demandes_reexamination_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_reexamination
    ADD CONSTRAINT demandes_reexamination_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: demandes_reexamination demandes_reexamination_traitee_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_reexamination
    ADD CONSTRAINT demandes_reexamination_traitee_par_fkey FOREIGN KEY (traitee_par) REFERENCES public.profils(id);


--
-- Name: demandes_reexamination demandes_reexamination_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demandes_reexamination
    ADD CONSTRAINT demandes_reexamination_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: likes likes_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: likes likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: moderations_claims moderations_claims_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderations_claims
    ADD CONSTRAINT moderations_claims_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: profils profils_auteur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils
    ADD CONSTRAINT profils_auteur_id_fkey FOREIGN KEY (auteur_id) REFERENCES public.auteurs(id);


--
-- Name: profils profils_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profils
    ADD CONSTRAINT profils_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: restrictions restrictions_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restrictions
    ADD CONSTRAINT restrictions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profils(id);


--
-- Name: restrictions restrictions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restrictions
    ADD CONSTRAINT restrictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: signalements signalements_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements
    ADD CONSTRAINT signalements_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: signalements_commentaires signalements_commentaires_commentaire_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements_commentaires
    ADD CONSTRAINT signalements_commentaires_commentaire_id_fkey FOREIGN KEY (commentaire_id) REFERENCES public.commentaires(id) ON DELETE CASCADE;


--
-- Name: signalements_commentaires signalements_commentaires_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements_commentaires
    ADD CONSTRAINT signalements_commentaires_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: signalements signalements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signalements
    ADD CONSTRAINT signalements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: suivis suivis_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis
    ADD CONSTRAINT suivis_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profils(id) ON DELETE CASCADE;


--
-- Name: suivis suivis_suivi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suivis
    ADD CONSTRAINT suivis_suivi_id_fkey FOREIGN KEY (suivi_id) REFERENCES public.profils(id) ON DELETE CASCADE;


-- Name: signalements Admin gère tous les signalements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin gère tous les signalements" ON public.signalements TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::public.user_role)))));


--
-- Name: demandes_categorie Admins can view all category requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all category requests" ON public.demandes_categorie FOR SELECT TO authenticated USING (true);


--
-- Name: signalements Créer un signalement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Créer un signalement" ON public.signalements FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: auteurs Les admins peuvent gérer les auteurs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins peuvent gérer les auteurs" ON public.auteurs TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::public.user_role)))));


--
-- Name: categories Les admins peuvent gérer les catégories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins peuvent gérer les catégories" ON public.categories TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::public.user_role)))));


--
-- Name: demandes_auteur Les admins peuvent modifier les demandes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins peuvent modifier les demandes" ON public.demandes_auteur FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::public.user_role)))));


--
-- Name: profils Les admins peuvent modifier tous les profils; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins peuvent modifier tous les profils" ON public.profils TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils profils_1
  WHERE ((profils_1.id = auth.uid()) AND (profils_1.role = 'admin'::public.user_role)))));


--
-- Name: commentaires Les admins peuvent supprimer tous les commentaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins peuvent supprimer tous les commentaires" ON public.commentaires FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::public.user_role)))));


--
-- Name: demandes_auteur Les admins voient toutes les demandes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les admins voient toutes les demandes" ON public.demandes_auteur FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'admin'::public.user_role)))));


--
-- Name: articles Les auteurs créent des articles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les auteurs créent des articles" ON public.articles FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.profils p
     JOIN public.auteurs a ON ((p.auteur_id = a.id)))
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['auteur'::public.user_role, 'admin'::public.user_role])) AND (articles.id_auteur = p.auteur_id) AND (a.est_banni = false)))));


--
-- Name: auteurs Les auteurs validés sont visibles par tous; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les auteurs validés sont visibles par tous" ON public.auteurs FOR SELECT USING ((est_valide = true));


--
-- Name: categories Les catégories sont visibles par tous; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les catégories sont visibles par tous" ON public.categories FOR SELECT USING (true);


--
-- Name: commentaires Les commentaires sont visibles par tous; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les commentaires sont visibles par tous" ON public.commentaires FOR SELECT USING (true);


--
-- Name: likes Les likes sont visibles par tous; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les likes sont visibles par tous" ON public.likes FOR SELECT USING (true);


--
-- Name: profils Les profils sont visibles par tous; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les profils sont visibles par tous" ON public.profils FOR SELECT USING (true);


--
-- Name: commentaires Les utilisateurs connectés peuvent commenter; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs connectés peuvent commenter" ON public.commentaires FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: likes Les utilisateurs connectés peuvent liker; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs connectés peuvent liker" ON public.likes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: demandes_auteur Les utilisateurs peuvent créer une demande; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs peuvent créer une demande" ON public.demandes_auteur FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: profils Les utilisateurs peuvent modifier leur profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs peuvent modifier leur profil" ON public.profils FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: commentaires Les utilisateurs peuvent modifier leurs commentaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs peuvent modifier leurs commentaires" ON public.commentaires FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: likes Les utilisateurs peuvent retirer leur like; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs peuvent retirer leur like" ON public.likes FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: commentaires Les utilisateurs peuvent supprimer leurs commentaires; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs peuvent supprimer leurs commentaires" ON public.commentaires FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: demandes_auteur Les utilisateurs voient leur demande; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Les utilisateurs voient leur demande" ON public.demandes_auteur FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: articles Modifier ses propres articles uniquement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Modifier ses propres articles uniquement" ON public.articles FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils p
  WHERE ((p.id = auth.uid()) AND (articles.id_auteur = p.auteur_id)))));


--
-- Name: articles Supprimer ses propres articles uniquement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Supprimer ses propres articles uniquement" ON public.articles FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils p
  WHERE ((p.id = auth.uid()) AND (articles.id_auteur = p.auteur_id)))));


--
-- Name: demandes_categorie Users can create category requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create category requests" ON public.demandes_categorie FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: demandes_categorie Users can view own category requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own category requests" ON public.demandes_categorie FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: articles Voir les articles publiés (tous); Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Voir les articles publiés (tous)" ON public.articles FOR SELECT USING ((est_publie = true));


--
-- Name: articles Voir ses propres brouillons uniquement; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Voir ses propres brouillons uniquement" ON public.articles FOR SELECT TO authenticated USING (((est_publie = false) AND (EXISTS ( SELECT 1
   FROM public.profils p
  WHERE ((p.id = auth.uid()) AND (articles.id_auteur = p.auteur_id))))));


--
-- Name: signalements Voir ses signalements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Voir ses signalements" ON public.signalements FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: admin_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: signalements_commentaires admin_signalements_comm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_signalements_comm ON public.signalements_commentaires TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role]))))));


--
-- Name: demandes_reexamination admins_gestion_demandes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_gestion_demandes ON public.demandes_reexamination TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role]))))));


--
-- Name: notifications admins_insert_notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_insert_notifications ON public.notifications FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role]))))));


--
-- Name: restrictions admins_restrictions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admins_restrictions ON public.restrictions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = ANY (ARRAY['admin'::public.user_role, 'super_admin'::public.user_role]))))));


--
-- Name: articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

--
-- Name: auteurs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.auteurs ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: commentaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commentaires ENABLE ROW LEVEL SECURITY;

--
-- Name: demandes_auteur; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandes_auteur ENABLE ROW LEVEL SECURITY;

--
-- Name: demandes_categorie; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandes_categorie ENABLE ROW LEVEL SECURITY;

--
-- Name: demandes_reexamination; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demandes_reexamination ENABLE ROW LEVEL SECURITY;

--
-- Name: likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

--
-- Name: moderations_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moderations_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications own_notifications_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_notifications_read ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: notifications own_notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_notifications_update ON public.notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profils; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;

--
-- Name: restrictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restrictions ENABLE ROW LEVEL SECURITY;

--
-- Name: signalements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signalements ENABLE ROW LEVEL SECURITY;

--
-- Name: signalements_commentaires; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signalements_commentaires ENABLE ROW LEVEL SECURITY;

--
-- Name: signalements_commentaires signaler_commentaire; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signaler_commentaire ON public.signalements_commentaires FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: suivis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.suivis ENABLE ROW LEVEL SECURITY;

--
-- Name: suivis suivis_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suivis_delete ON public.suivis FOR DELETE TO authenticated USING ((follower_id = auth.uid()));


--
-- Name: suivis suivis_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suivis_insert ON public.suivis FOR INSERT TO authenticated WITH CHECK ((follower_id = auth.uid()));


--
-- Name: suivis suivis_lecture; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY suivis_lecture ON public.suivis FOR SELECT USING (true);


--
-- Name: admin_activity_log super_admin_read_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_admin_read_logs ON public.admin_activity_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profils
  WHERE ((profils.id = auth.uid()) AND (profils.role = 'super_admin'::public.user_role)))));


--
-- Name: demandes_reexamination user_insert_demande; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_insert_demande ON public.demandes_reexamination FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: demandes_reexamination user_own_demandes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_own_demandes ON public.demandes_reexamination FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: signalements_commentaires voir_ses_signalements_comm; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY voir_ses_signalements_comm ON public.signalements_commentaires FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: ensure_rls; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
         WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
   EXECUTE FUNCTION public.rls_auto_enable();


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--

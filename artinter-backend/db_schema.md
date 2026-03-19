# Database Configuration

## Table: `profils`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | - | Note: This is a Primary Key.<pk/> |
| `nom` | string | character varying | - | - |
| `bio` | string | text | - | - |
| `avatar_url` | string | text | - | - |
| `role` | string | public.user_role | lecteur | - |
| `auteur_id` | string | uuid | - | Note: This is a Foreign Key to `auteurs.id`.<fk table='auteurs' column='id'/> |
| `created_at` | string | timestamp with time zone | now() | - |
| `email_public` | string | text | - | - |
| `twitter` | string | text | - | - |
| `linkedin` | string | text | - | - |
| `github` | string | text | - | - |
| `website` | string | text | - | - |
| `facebook` | string | text | - | - |
| `instagram` | string | text | - | - |
| `youtube` | string | text | - | - |

## Table: `article_stats`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | - | Note: This is a Primary Key.<pk/> |
| `titre` | string | character varying | - | - |
| `slug` | string | character varying | - | - |
| `vues` | integer | integer | - | - |
| `est_publie` | boolean | boolean | - | - |
| `nombre_likes` | integer | bigint | - | - |
| `nombre_commentaires` | integer | bigint | - | - |

## Table: `commentaires`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | gen_random_uuid() | Note: This is a Primary Key.<pk/> |
| `article_id` | string | uuid | - | Note: This is a Foreign Key to `articles.id`.<fk table='articles' column='id'/> |
| `user_id` | string | uuid | - | - |
| `contenu` | string | text | - | - |
| `created_at` | string | timestamp with time zone | now() | - |
| `updated_at` | string | timestamp with time zone | now() | - |

## Table: `auteurs`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | gen_random_uuid() | Note: This is a Primary Key.<pk/> |
| `est_valide` | boolean | boolean | - | - |
| `created_at` | string | timestamp with time zone | now() | - |
| `total_articles` | integer | integer | - | - |
| `total_vues` | integer | integer | - | - |
| `total_likes` | integer | integer | - | - |
| `specialites` | array | text[] | - | - |
| `langue_preference` | string | character varying | fr | - |
| `notif_commentaires` | boolean | boolean | true | - |
| `notif_likes` | boolean | boolean | true | - |

## Table: `demandes_categorie`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | gen_random_uuid() | Note: This is a Primary Key.<pk/> |
| `user_id` | string | uuid | - | Note: This is a Foreign Key to `profils.id`.<fk table='profils' column='id'/> |
| `nom` | string | text | - | - |
| `slug` | string | text | - | - |
| `description` | string | text | - | - |
| `justification` | string | text | - | - |
| `statut` | string | text | en_attente | - |
| `raison_refus` | string | text | - | - |
| `created_at` | string | timestamp with time zone | now() | - |
| `updated_at` | string | timestamp with time zone | now() | - |

## Table: `articles`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | gen_random_uuid() | Note: This is a Primary Key.<pk/> |
| `slug` | string | character varying | - | - |
| `titre` | string | character varying | - | - |
| `contenu_html` | string | text | - | - |
| `images` | any | jsonb | - | - |
| `id_auteur` | string | uuid | - | Note: This is a Foreign Key to `auteurs.id`.<fk table='auteurs' column='id'/> |
| `categorie` | string | uuid | - | Note: This is a Foreign Key to `categories.id`.<fk table='categories' column='id'/> |
| `date_publication` | string | timestamp with time zone | now() | - |
| `temps_lecture` | integer | integer | - | - |
| `tags` | array | text[] | - | - |
| `est_publie` | boolean | boolean | - | - |
| `vues` | integer | integer | - | - |
| `created_at` | string | timestamp with time zone | now() | - |
| `updated_at` | string | timestamp with time zone | now() | - |
| `contenu_json` | any | jsonb | - | Raw JSON output from Editor.js for re-editing |

## Table: `auteurs_complets`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `auteur_id` | string | uuid | - | Note: This is a Primary Key.<pk/> |
| `est_valide` | boolean | boolean | - | - |
| `total_articles` | integer | integer | - | - |
| `total_vues` | integer | integer | - | - |
| `total_likes` | integer | integer | - | - |
| `specialites` | array | text[] | - | - |
| `langue_preference` | string | character varying | - | - |
| `notif_commentaires` | boolean | boolean | - | - |
| `notif_likes` | boolean | boolean | - | - |
| `auteur_depuis` | string | timestamp with time zone | - | - |
| `user_id` | string | uuid | - | Note: This is a Primary Key.<pk/> |
| `nom` | string | character varying | - | - |
| `bio` | string | text | - | - |
| `avatar_url` | string | text | - | - |
| `email_public` | string | text | - | - |
| `twitter` | string | text | - | - |
| `linkedin` | string | text | - | - |
| `github` | string | text | - | - |
| `website` | string | text | - | - |
| `facebook` | string | text | - | - |
| `instagram` | string | text | - | - |
| `youtube` | string | text | - | - |
| `role` | string | public.user_role | - | - |

## Table: `likes`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | gen_random_uuid() | Note: This is a Primary Key.<pk/> |
| `article_id` | string | uuid | - | Note: This is a Foreign Key to `articles.id`.<fk table='articles' column='id'/> |
| `user_id` | string | uuid | - | - |
| `created_at` | string | timestamp with time zone | now() | - |

## Table: `categories`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | gen_random_uuid() | Note: This is a Primary Key.<pk/> |
| `nom` | string | character varying | - | - |
| `slug` | string | character varying | - | - |
| `description` | string | text | - | - |
| `created_at` | string | timestamp with time zone | now() | - |

## Table: `demandes_auteur`

| Column | Type | Format | Default | Description |
|--------|------|--------|---------|-------------|
| `id` | string | uuid | gen_random_uuid() | Note: This is a Primary Key.<pk/> |
| `user_id` | string | uuid | - | Note: This is a Foreign Key to `profils.id`.<fk table='profils' column='id'/> |
| `motivation` | string | text | - | - |
| `statut` | string | character varying | en_attente | - |
| `created_at` | string | timestamp with time zone | now() | - |
| `updated_at` | string | timestamp with time zone | now() | - |


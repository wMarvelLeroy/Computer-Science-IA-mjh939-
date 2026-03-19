-- Add 'contenu_json' column to 'articles' table to store Editor.js raw data
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS contenu_json JSONB;

-- Comment on column for clarity
COMMENT ON COLUMN public.articles.contenu_json IS 'Raw JSON output from Editor.js for re-editing';

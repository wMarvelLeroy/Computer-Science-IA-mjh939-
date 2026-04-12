import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'ArtInter';
const SITE_URL  = 'https://artinter.fr'; // à adapter
const DEFAULT_DESC = "ArtInter — L'actualité visuelle internationale. Explorez des centaines d'articles sur l'art, la culture et la création.";
const DEFAULT_IMAGE = '/og-default.jpg'; // image par défaut dans /public

const PageMeta = ({
  title,
  description = DEFAULT_DESC,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  author,
  publishedAt,
}) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — L'actualité visuelle internationale`;
  const canonicalUrl = url || (typeof window !== 'undefined' ? window.location.href : SITE_URL);
  const ogImage = image?.startsWith('http') ? image : `${SITE_URL}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type"        content={type} />
      <meta property="og:site_name"   content={SITE_NAME} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image"       content={ogImage} />
      <meta property="og:url"         content={canonicalUrl} />

      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image"       content={ogImage} />

      {author      && <meta property="article:author"         content={author} />}
      {publishedAt && <meta property="article:published_time" content={publishedAt} />}
    </Helmet>
  );
};

export default PageMeta;

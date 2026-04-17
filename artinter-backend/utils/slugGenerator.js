
// Normalise le titre en slug URL-safe en supprimant les accents via décomposition NFD
export const generateSlug = (title) => {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // supprime les diacritiques isolés après NFD
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

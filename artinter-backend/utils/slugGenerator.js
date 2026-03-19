
export const generateSlug = (title) => {
    return title
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués (ex: é -> e + ')
        .replace(/[\u0300-\u036f]/g, '') // Supprime les diacritiques
        .replace(/[^a-z0-9]+/g, '-') // Remplace tout ce qui n'est pas alphanumérique par -
        .replace(/^-+|-+$/g, ''); // Supprime les tirets au début et à la fin
};

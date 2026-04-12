export const generateHTML = (data) => {
    if (!data || !data.blocks) return '';
    
    let html = '';
    data.blocks.forEach(block => {
        switch (block.type) {
            case 'header':
                html += `<h${block.data.level}>${block.data.text}</h${block.data.level}>`;
                break;
            case 'paragraph':
                html += `<p>${block.data.text}</p>`;
                break;
            case 'delimiter':
                html += `<hr />`;
                break;
            case 'list':
                const tag = block.data.style === 'ordered' ? 'ol' : 'ul';
                const listItems = block.data.items.map(item => `<li>${item}</li>`).join('');
                html += `<${tag}>${listItems}</${tag}>`;
                break;
            case 'image':
                const imageUrl = block.data.file?.url || block.data.url || '';
                html += `<figure class="article-image"><img src="${imageUrl}" alt="${block.data.caption || 'Image'}" /><figcaption>${block.data.caption || ''}</figcaption></figure>`;
                break;
            case 'quote':
                html += `<blockquote>${block.data.text}</blockquote><cite>${block.data.caption}</cite>`;
                break;
            case 'gallery':
                if (block.data.images && block.data.images.length > 0) {
                    const imagesHtml = block.data.images.map(img => 
                        `<div class="gallery-item"><img src="${img.url}" alt="" /></div>`
                    ).join('');
                    
                    let captionHtml = '';
                    if (block.data.caption) {
                        captionHtml = `<div class="gallery-caption">${block.data.caption}</div>`;
                    }

                    html += `<figure class="article-gallery-figure"><div class="article-gallery grid-${Math.min(block.data.images.length, 3)}">${imagesHtml}</div>${captionHtml}</figure>`;
                }
                break;
            default:
                break;
        }
    });
    return html;
};

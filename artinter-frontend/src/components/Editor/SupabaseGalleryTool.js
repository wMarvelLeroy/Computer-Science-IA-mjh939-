import { uploadArticleImage } from '../../api/api';
import imageCompression from 'browser-image-compression';

class SupabaseGalleryTool {
  constructor({ data, api, config, readOnly }) {
    this.api = api;
    this.config = config || {};
    this.data = {
        style: data.style || 'grid',
        images: data.images || []
    };
    this.readOnly = readOnly;
    this.wrapper = undefined;
    this.nodes = {};
  }

  static get toolbox() {
    return {
      title: 'Galerie',
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17 3H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM3 5h14v10H3V5zm0 0h14v10H3V5zm2 2h4v4H5V7zm6 0h4v4h-4V7z"/></svg>'
    };
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('cdx-gallery');

    if (this.data.images && this.data.images.length > 0) {
      this._renderGallery();
    } else {
      this._renderUploadButton();
    }

    return this.wrapper;
  }

  _renderUploadButton() {
    this.wrapper.innerHTML = '';
    
    // Placeholder container
    const placeholder = document.createElement('div');
    placeholder.classList.add('cdx-gallery-placeholder');
    
    // Icon
    const icon = document.createElement('div');
    icon.innerHTML = '<svg width="40" height="40" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17 3H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM3 5h14v10H3V5zm0 0h14v10H3V5zm2 2h4v4H5V7zm6 0h4v4h-4V7z"/></svg>';
    icon.style.marginBottom = '10px';
    icon.style.color = '#707684';
    
    // Text
    const text = document.createElement('div');
    text.innerText = 'Sélectionner des images pour la galerie';
    text.style.fontWeight = '500';
    
    placeholder.appendChild(icon);
    placeholder.appendChild(text);

    // Input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true; // Allow multiple files!
    input.style.display = 'none';
    
    input.addEventListener('change', (event) => {
      this._uploadImages(event.target.files);
    });

    placeholder.addEventListener('click', () => input.click());

    this.wrapper.appendChild(placeholder);
    this.wrapper.appendChild(input);
  }

  _renderGallery() {
    this.wrapper.innerHTML = '';
    const grid = document.createElement('div');
    grid.classList.add('cdx-gallery-grid');

    this.data.images.forEach(imgData => {
        const item = document.createElement('div');
        item.classList.add('cdx-gallery-item');
        
        const img = document.createElement('img');
        img.src = imgData.url;
        
        // Lightbox click
        item.addEventListener('click', () => {
             this._openLightbox(imgData.url);
        });

        item.appendChild(img);
        grid.appendChild(item);
    });

    // Add "Add more" button small
    if (!this.readOnly) {
        const addMore = document.createElement('div');
        addMore.classList.add('cdx-gallery-item', 'cdx-gallery-add');
        addMore.innerHTML = '+';
        addMore.title = "Ajouter d'autres images";
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.style.display = 'none';
        
        input.addEventListener('change', (event) => {
             this._uploadImages(event.target.files);
        });
        
        addMore.addEventListener('click', () => input.click());
        addMore.appendChild(input);
        
        grid.appendChild(addMore);
    }

    this.wrapper.appendChild(grid);

    // Caption
    const caption = document.createElement('div');
    caption.classList.add('cdx-gallery-caption');
    caption.contentEditable = !this.readOnly;
    caption.innerHTML = this.data.caption || '';
    caption.placeholder = 'Légende de la galerie...';
    
    this.wrapper.appendChild(caption);
    this.nodes.caption = caption;
  }

  async _uploadImages(files) {
    if (!files || files.length === 0) return;

    // Show loading state if wanted?
    // For now simple alert on error
    
    // Compression options
    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
    };

    const uploads = Array.from(files).map(async (file) => {
        try {
            const compressed = await imageCompression(file, options);
            return await uploadArticleImage(compressed);
        } catch (e) {
            console.error(e);
            return { success: false, error: e.message };
        }
    });

    const results = await Promise.all(uploads);
    const newImages = results
        .filter(r => r.success && r.url)
        .map(r => ({ url: r.url, caption: '' }));

    if (newImages.length > 0) {
        this.data.images = [...this.data.images, ...newImages];
        this._renderGallery();
    } else {
        this.api.notifier.show({
            message: 'Aucune image n\'a pu être uploadée.',
            style: 'error'
        });
    }
  }

  _openLightbox(url) {
      const lightbox = document.createElement('div');
      lightbox.classList.add('cdx-gallery-lightbox');
      lightbox.style.cssText = `
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.9);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: zoom-out;
          opacity: 0;
          transition: opacity 0.3s ease;
      `;

      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = `
          max-width: 90%;
          max-height: 90%;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          transform: scale(0.95);
          transition: transform 0.3s ease;
      `;
      
      lightbox.appendChild(img);
      document.body.appendChild(lightbox);
      
      // Animate in
      requestAnimationFrame(() => {
          lightbox.style.opacity = '1';
          img.style.transform = 'scale(1)';
      });

      const close = () => {
          lightbox.style.opacity = '0';
          img.style.transform = 'scale(0.95)';
          setTimeout(() => lightbox.remove(), 300);
      };

      lightbox.addEventListener('click', close);
  }

  save(blockContent) {
    return Object.assign(this.data, {
        caption: this.nodes.caption ? this.nodes.caption.innerHTML : ''
    });
  }
}

export default SupabaseGalleryTool;

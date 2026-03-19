
import { uploadArticleImage } from '../../api/api';
import imageCompression from 'browser-image-compression';

/**
 * Image Tool for Editor.js using Frontend API Wrapper
 * Features:
 * - Supabase Upload
 * - Client-side Compression
 * - Layout Tuning (Portrait, Landscape, Square)
 */
class SupabaseImageTool {
  constructor({ data, api, config, readOnly }) {
    this.api = api;
    this.config = config || {};
    this.data = {
        url: data.url || '',
        caption: data.caption || '',
        withBorder: data.withBorder !== undefined ? data.withBorder : false,
        withBackground: data.withBackground !== undefined ? data.withBackground : false,
        stretched: data.stretched !== undefined ? data.stretched : false,
        style: data.style || 'original' // original, landscape, portrait, square
    };
    this.readOnly = readOnly;

    this.wrapper = undefined;
    this.nodes = {
      image: undefined,
      caption: undefined
    };
  }

  static get toolbox() {
    return {
      title: 'Image',
      icon: '<svg width="17" height="15" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29 42 30zm0 52l-43-30-56 30-81-67-66 39v23c0 19 15 34 34 34h178c17 0 31-13 34-29zM79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79C0 35 35 0 79 0z"/></svg>'
    };
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('cdx-simple-image');

    if (this.data && this.data.url) {
      this._createImage(this.data.url, this.data.caption);
      return this.wrapper;
    }

    // Placeholder UI (Consistent with Gallery)
    const placeholder = document.createElement('div');
    placeholder.classList.add('cdx-gallery-placeholder'); // Reusing Gallery CSS for consistency
    placeholder.innerHTML = `
        <div style="margin-bottom: 10px; color: #707684;">
            <svg width="40" height="40" viewBox="0 0 336 276" xmlns="http://www.w3.org/2000/svg"><path d="M291 150V79c0-19-15-34-34-34H79c-19 0-34 15-34 34v42l67-44 81 72 56-29 42 30zm0 52l-43-30-56 30-81-67-66 39v23c0 19 15 34 34 34h178c17 0 31-13 34-29zM79 0h178c44 0 79 35 79 79v118c0 44-35 79-79 79H79c-44 0-79-35-79-79V79C0 35 35 0 79 0z"/></svg>
        </div>
        <div style="font-weight: 500;">Sélectionner une image</div>
    `;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.addEventListener('change', (event) => {
      this._uploadImage(event.target.files[0]);
    });

    placeholder.addEventListener('click', () => {
        input.click();
    });

    this.wrapper.appendChild(input);
    this.wrapper.appendChild(placeholder);

    return this.wrapper;
  }

  renderSettings() {
    const wrapper = document.createElement('div');

    const tunes = [
      {
        name: 'withBorder',
        label: 'Avec bordure',
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.8 10.592v2.043h2.35v2.138H15.8v2.232h-2.25v-2.232h-2.4v-2.138h2.4v-2.28h2.25v.237h1.15-1.15zM1.9 8.455v-3.42c0-1.154.985-2.09 2.2-2.09h4.2v2.137H4.15v3.373H1.9zm0 2.137h2.25v3.325H8.3v2.138H4.1c-1.215 0-2.2-.936-2.2-2.09v-3.373zm15.05-2.137H14.7V5.082h-4.15V2.945h4.2c1.215 0 2.2.936 2.2 2.09v3.42z"/></svg>'
      },
      {
        name: 'withBackground',
        label: 'Avec fond',
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.043 8.265l3.183-3.182 9.467 9.464-2.171 2.171-6.398-6.404-3.181 3.182 3.181 3.182-2.172 2.171-6.4-6.4 3.182-3.182zM5.8 4.02L3.628 6.19l-2.17-2.17 6.399-6.4 2.17 2.17-6.4 6.4 2.171 2.171-2.17 2.17-2.171-2.17L5.8 4.02z"/></svg>'
      },
      {
        name: 'stretched',
        label: 'Étirer',
        icon: '<svg width="17" height="10" viewBox="0 0 17 10" xmlns="http://www.w3.org/2000/svg"><path d="M13.568 5.925H4.056l1.703 1.703a1.125 1.125 0 0 1-1.59 1.591L.962 6.014A1.069 1.069 0 0 1 .588 4.26L4.38.469a1.069 1.069 0 0 1 1.595 1.511L4.2 3.517h9.458l-1.669-1.536a1.069 1.069 0 0 1 1.492-1.596l3.38 3.323c.44.432.44 1.134 0 1.566l-3.379 3.323a1.069 1.069 0 0 1-1.492-1.596l1.579-1.517z"/></svg>'
      }
    ];

    const styleSelect = document.createElement('div');
    styleSelect.className = 'cdx-settings-button-select-wrapper';
    
    // Style Selector
    const styles = [
      { value: 'original', label: 'Défaut' },
      { value: 'landscape', label: 'Paysage (16:9)' },
      { value: 'portrait', label: 'Portrait (3:4)' },
      { value: 'square', label: 'Carré (1:1)' }
    ];

    const label = document.createElement('div');
    label.innerText = 'Format de l\'image';
    label.style.padding = '10px';
    label.style.fontSize = '12px';
    label.style.fontWeight = 'bold';
    label.style.color = '#707684';
    wrapper.appendChild(label);

    styles.forEach(style => {
      const button = document.createElement('div');
      button.classList.add('cdx-settings-button');
      button.innerText = style.label;
      button.setAttribute('data-style', style.value);
      
      if (this.data.style === style.value) {
        button.classList.add('cdx-settings-button--active');
      }

      button.addEventListener('click', () => {
         // Reset other active buttons
         wrapper.querySelectorAll('[data-style]').forEach(b => b.classList.remove('cdx-settings-button--active'));
         button.classList.add('cdx-settings-button--active');
         
         this.data.style = style.value;
         this._updateImageClasses();
      });

      wrapper.appendChild(button);
    });

    const separator = document.createElement('div');
    separator.style.height = '1px';
    separator.style.backgroundColor = '#eff2f5';
    separator.style.margin = '5px 0';
    wrapper.appendChild(separator);

    tunes.forEach(tune => {
      const button = document.createElement('div');
      button.classList.add('cdx-settings-button');
      button.innerHTML = tune.icon;
      button.title = tune.label;
      
      if (this.data[tune.name]) {
        button.classList.add('cdx-settings-button--active');
      }

      button.addEventListener('click', () => {
        this.data[tune.name] = !this.data[tune.name];
        button.classList.toggle('cdx-settings-button--active');
        this._updateImageClasses();
      });

      wrapper.appendChild(button);
    });

    return wrapper;
  }

  _createImage(url, captionText) {
    const image = document.createElement('img');
    const caption = document.createElement('div');

    image.src = url;
    image.alt = captionText || 'Image sans description';
    caption.contentEditable = !this.readOnly;
    caption.innerHTML = captionText || '';
    caption.placeholder = 'Entrez une légende...';
    
    // Lightbox on click
    image.style.cursor = 'pointer';
    image.addEventListener('click', () => {
        this._openLightbox(url);
    });

    this.wrapper.innerHTML = '';
    this.wrapper.appendChild(image);
    this.wrapper.appendChild(caption);

    this.nodes.image = image;
    this.nodes.caption = caption;

    this._updateImageClasses();
  }

  _updateImageClasses() {
     if (!this.wrapper) return;

     // Reset specific classes
     const classesToRemove = [
         this.api.styles.imageBorder,
         this.api.styles.imageBackground,
         this.api.styles.imageStreched,
         'image-tool--landscape',
         'image-tool--portrait',
         'image-tool--square'
     ];
     
     this.wrapper.classList.remove(...classesToRemove);

     // Apply active classes
     if (this.data.withBorder) this.wrapper.classList.add(this.api.styles.imageBorder);
     if (this.data.withBackground) this.wrapper.classList.add(this.api.styles.imageBackground);
     if (this.data.stretched) this.wrapper.classList.add(this.api.styles.imageStreched);
     
     // Apply style class
     if (this.data.style && this.data.style !== 'original') {
         this.wrapper.classList.add(`image-tool--${this.data.style}`);
     }
  }

  async _uploadImage(file) {
    try {
        // Compression
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
        };

        const compressedFile = await imageCompression(file, options);
        // Use our API wrapper which calls backend
        const response = await uploadArticleImage(compressedFile);
        
        if (response.success && response.url) {
            this.data = {
                url: response.url,
                caption: '',
                withBorder: false,
                withBackground: false,
                stretched: false,
                style: 'original'
            };
            this._createImage(response.url);
        } else {
            throw new Error(response.error || 'Upload failed');
        }

    } catch (error) {
      console.error('Upload failed:', error);
      this.api.notifier.show({
        message: 'Erreur lors de l\'upload de l\'image (Trop volumineux ?)',
        style: 'error'
      });
    }
  }
  
  _openLightbox(url) {
      const lightbox = document.createElement('div');
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

export default SupabaseImageTool;

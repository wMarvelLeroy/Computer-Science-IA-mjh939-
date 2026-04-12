import ImageTool from '@editorjs/image';
import imageCompression from 'browser-image-compression';
import { uploadArticleImage } from '../../api/api';

class SupabaseImageTool extends ImageTool {
  constructor({ data = {}, api, config = {}, readOnly, block }) {
    if (data.url && !data.file) {
      data = { ...data, file: { url: data.url } };
    }

    super({
      data,
      api,
      config: {
        ...config,
        uploader: {
          uploadByFile: async (file) => {
            const compressed = await imageCompression(file, {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true
            });
            const res = await uploadArticleImage(compressed);
            return res.success && res.url
              ? { success: 1, file: { url: res.url } }
              : { success: 0 };
          }
        }
      },
      readOnly,
      block
    });
  }

  render() {
    const wrapper = super.render();
    wrapper.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (img?.src) this._openLightbox(img.src);
    });
    return wrapper;
  }

  _openLightbox(url) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'max-width:90%;max-height:90%;border-radius:4px;';
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', () => overlay.remove());
  }
}

export default SupabaseImageTool;

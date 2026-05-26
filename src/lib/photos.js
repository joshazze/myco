const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

export async function pickAndResizePhoto(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Arquivo precisa ser imagem.');
  }
  const dataUrl = await fileToDataURL(file);
  const img = await loadImage(dataUrl);
  const { canvas } = drawResized(img, MAX_DIMENSION);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('Falha ao ler arquivo.'));
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem.'));
    img.src = src;
  });
}

function drawResized(img, maxDim) {
  const { naturalWidth: w, naturalHeight: h } = img;
  let nw = w, nh = h;
  if (w > maxDim || h > maxDim) {
    if (w >= h) { nw = maxDim; nh = Math.round(h * (maxDim / w)); }
    else { nh = maxDim; nw = Math.round(w * (maxDim / h)); }
  }
  const canvas = document.createElement('canvas');
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, nw, nh);
  return { canvas, width: nw, height: nh };
}

export function approximateSizeFromDataURL(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  const idx = dataUrl.indexOf(',');
  if (idx < 0) return 0;
  return Math.floor(((dataUrl.length - idx - 1) * 3) / 4);
}

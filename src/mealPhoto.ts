// Shrinks a meal photo on the phone before it is saved: about 640 px wide, JPEG, roughly 40-70 KB.
// Small photos keep storage free (Firestore free plan) and make the nutritionist's screen load fast.
export async function compressMealPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read this photo'));
      i.src = url;
    });
    const draw = (maxSide: number, quality: number) => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process this photo');
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', quality);
    };
    let out = draw(640, 0.6);
    if (out.length > 90000) out = draw(560, 0.5);
    if (out.length > 90000) out = draw(480, 0.45);
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

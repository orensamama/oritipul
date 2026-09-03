// Phone-camera photos are routinely 5-10MB; downscaling + re-compressing
// client-side keeps the request well under serverless payload limits and
// speeds up the round-trip, without touching accuracy for a document scan.
export async function compressImageToBase64(file: File, maxDim = 1600, quality = 0.82): Promise<{ base64: string; mime: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("file read failed"));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("image decode failed"));
    im.src = dataUrl;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { base64: dataUrl.split(",")[1], mime: file.type || "image/jpeg" };
  ctx.drawImage(img, 0, 0, width, height);
  const outDataUrl = canvas.toDataURL("image/jpeg", quality);
  return { base64: outDataUrl.split(",")[1], mime: "image/jpeg" };
}

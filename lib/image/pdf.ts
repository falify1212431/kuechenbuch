/**
 * Zerlegt ein Prospekt-PDF im Browser in Seitenbilder (JPEG). Das passiert komplett auf dem
 * Handy – das PDF wird nirgends hochgeladen, nur die ausgewählten Seiten gehen später zur KI.
 * pdf.js wird erst geladen, wenn wirklich ein PDF gewählt wird (spart Ladezeit).
 */
export const MAX_PDF_PAGES = 60;

export async function pdfToImages(
  file: File,
  onProgress: (done: number, total: number) => void,
  maxSide = 1800,
): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  // Den Worker kopiert scripts/copy-pdf-worker.mjs nach public/
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const total = Math.min(doc.numPages, MAX_PDF_PAGES);
  const images: File[] = [];

  for (let number = 1; number <= total; number++) {
    const page = await doc.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maxSide / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Seite konnte nicht umgewandelt werden"))), "image/jpeg", 0.8),
    );
    images.push(new File([blob], `seite-${number}.jpg`, { type: "image/jpeg" }));
    page.cleanup();
    onProgress(number, total);
  }

  // Speicher freigeben (Ladeauftrag samt Dokument beenden)
  await task.destroy();
  return images;
}

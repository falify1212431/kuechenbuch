/**
 * Verkleinert ein Foto im Browser, bevor es hochgeladen wird (längste Seite höchstens
 * 1600 Pixel, JPEG). Aus 5 MB werden so meist 200–500 KB – schneller und spart Kontingent.
 */
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht verkleinert werden"))), "image/jpeg", quality),
  );
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

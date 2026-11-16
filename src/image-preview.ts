/** Decode a native PNG response and explicitly own its temporary URL. */
export async function decodePngPreview(bytes: number[]) {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: "image/png" }),
  );
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { image, url };
}

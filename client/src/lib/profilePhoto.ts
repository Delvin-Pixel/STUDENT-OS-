// Source files may be any size; only the optimized upload is bounded.
export const PROFILE_PHOTO_OUTPUT_MAX_BYTES = 4 * 1024 * 1024;
export const PROFILE_PHOTO_MAX_DIMENSION = 1024;

const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const QUALITY_STEPS = [0.86, 0.72, 0.58, 0.44, 0.32];
const SCALE_STEPS = [1, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25];

export type ProfilePhotoCandidate = Pick<File, "type" | "size">;

export interface PreparedProfilePhoto {
  dataUrl: string;
  byteSize: number;
}

export function validateProfilePhotoFile(
  file: ProfilePhotoCandidate
): string | null {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  if (file.size <= 0) {
    return "That image file is empty. Please choose another one.";
  }
  return null;
}

export function profilePhotoDimensions(
  width: number,
  height: number,
  maximum = PROFILE_PHOTO_MAX_DIMENSION
) {
  if (width <= 0 || height <= 0)
    throw new Error("That image could not be read. Please choose another one.");
  const longestSide = Math.max(width, height);
  if (longestSide <= maximum) return { width, height };
  const scale = maximum / longestSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function isSafeProfilePhotoOutput(byteSize: number) {
  return byteSize > 0 && byteSize <= PROFILE_PHOTO_OUTPUT_MAX_BYTES;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read image."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error("Unable to optimize image."));
      },
      "image/webp",
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Unable to prepare image."));
    reader.onerror = () => reject(new Error("Unable to prepare image."));
    reader.readAsDataURL(blob);
  });
}

/** Converts any accepted source photo into a compact, consistent WebP avatar. */
export async function prepareProfilePhoto(
  file: File
): Promise<PreparedProfilePhoto> {
  const validationError = validateProfilePhotoFile(file);
  if (validationError) throw new Error(validationError);

  const image = await loadImage(file);
  const dimensions = profilePhotoDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height
  );
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(
      "Your browser could not optimize this image. Please choose another one."
    );

  for (const scale of SCALE_STEPS) {
    canvas.width = Math.max(1, Math.round(dimensions.width * scale));
    canvas.height = Math.max(1, Math.round(dimensions.height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      if (isSafeProfilePhotoOutput(blob.size)) {
        return { dataUrl: await blobToDataUrl(blob), byteSize: blob.size };
      }
    }
  }

  throw new Error(
    "That image could not be optimized for a profile photo. Please choose another image format."
  );
}

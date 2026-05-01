// Allowed upload formats per external API support.
// Update this single source if API support changes.

export const ALLOWED_UPLOAD_EXTENSIONS = ['pdf', 'docx', 'txt', 'rtf'] as const;

export const ALLOWED_UPLOAD_ACCEPT = ALLOWED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(',');

export const ALLOWED_UPLOAD_LABEL = ALLOWED_UPLOAD_EXTENSIONS.map((e) => `.${e}`).join(', ');

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx < 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export function isAllowedUploadFile(name: string): boolean {
  return (ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(getFileExtension(name));
}

export function getUnsupportedFormatMessage(name: string): string {
  const ext = getFileExtension(name);
  const shown = ext ? `.${ext}` : 'this';
  return `${shown} files are not supported. Allowed formats: ${ALLOWED_UPLOAD_LABEL}.`;
}

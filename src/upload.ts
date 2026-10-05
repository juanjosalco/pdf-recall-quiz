export function selectPdf(files: ArrayLike<File>): File {
  if (files.length !== 1) throw new Error('Choose one PDF at a time.');
  const file = files[0];
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('This file is not a PDF. Choose a PDF file.');
  }
  return file;
}

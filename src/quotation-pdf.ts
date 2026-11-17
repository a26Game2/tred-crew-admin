export async function downloadQuotationPdf(element: HTMLElement, requestCode: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  await document.fonts?.ready;
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: 1000,
    onclone: (clonedDocument) => {
      const clonedReview = clonedDocument.querySelector<HTMLElement>('.quotation-review');
      if (!clonedReview) return;
      clonedReview.style.width = '900px';
      clonedReview.style.maxWidth = 'none';
      clonedReview.style.background = '#ffffff';
    },
  });
  if (!canvas.width || !canvas.height) throw new Error('Nội dung báo giá chưa sẵn sàng');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const margin = 10;
  const imageWidth = 210 - margin * 2;
  const pageHeight = 297 - margin * 2;
  const pixelsPerMm = canvas.width / imageWidth;
  const pageHeightPx = Math.floor(pageHeight * pixelsPerMm);

  for (let offset = 0, page = 0; offset < canvas.height; offset += pageHeightPx, page += 1) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const context = pageCanvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ tạo file PDF');
    context.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    if (page > 0) pdf.addPage();
    pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.94), 'JPEG', margin, margin, imageWidth, sliceHeight / pixelsPerMm, undefined, 'FAST');
  }

  const filename = `bao-gia-${requestCode.toLowerCase()}.pdf`;
  const url = URL.createObjectURL(pdf.output('blob'));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return filename;
}

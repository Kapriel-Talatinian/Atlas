import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceData {
  id: string;
  invoice_number: string;
  month: number;
  year: number;
  subtotal: number;
  tax_amount?: number | null;
  tax_rate?: number | null;
  total?: number | null;
  status?: string | null;
  due_date: string;
  client?: { 
    company_name: string;
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
    siret?: string | null;
    billing_email?: string | null;
  } | null;
  timesheets?: Array<{
    days_worked: number;
    expert_name: string;
    daily_rate: number;
  }>;
}

const COMPANY_INFO = {
  name: "STEF SAS",
  address: "123 Avenue des Champs-Élysées",
  city: "75008 Paris",
  country: "France",
  siret: "123 456 789 00012",
  tva: "FR 12 345678901",
  email: "facturation@steftalent.fr",
  phone: "+33 1 23 45 67 89",
  iban: "FR76 XXXX XXXX XXXX XXXX XXXX XXX",
  bic: "XXXXXXXXX",
  bank: "Nom de la banque",
};

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export const generateProfessionalInvoicePDF = (invoice: InvoiceData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const darkColor: [number, number, number] = [30, 41, 59];
  const grayColor: [number, number, number] = [100, 116, 139];

  // Header with company logo area
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name, 20, 25);

  // Invoice badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageWidth - 70, 10, 55, 20, 3, 3, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', pageWidth - 55, 23);

  // Invoice number and date
  doc.setTextColor(...darkColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let yPos = 55;
  
  // Invoice details box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(pageWidth - 90, yPos - 5, 75, 35, 2, 2, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.text('N° Facture:', pageWidth - 85, yPos + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, pageWidth - 85, yPos + 12);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', pageWidth - 85, yPos + 22);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('fr-FR'), pageWidth - 85, yPos + 29);

  // Company info (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ÉMETTEUR', 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text(COMPANY_INFO.name, 20, yPos + 8);
  doc.text(COMPANY_INFO.address, 20, yPos + 14);
  doc.text(COMPANY_INFO.city, 20, yPos + 20);
  doc.text(`SIRET: ${COMPANY_INFO.siret}`, 20, yPos + 26);
  doc.text(`TVA: ${COMPANY_INFO.tva}`, 20, yPos + 32);

  // Client info
  yPos = 100;
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESTINATAIRE', 20, yPos);
  
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, yPos + 3, 90, 35, 2, 2, 'F');
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.client?.company_name || 'N/A', 20, yPos + 12);
  
  if (invoice.client?.address) {
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text(invoice.client.address, 20, yPos + 19);
    if (invoice.client.postal_code && invoice.client.city) {
      doc.text(`${invoice.client.postal_code} ${invoice.client.city}`, 20, yPos + 25);
    }
    if (invoice.client.siret) {
      doc.text(`SIRET: ${invoice.client.siret}`, 20, yPos + 31);
    }
  }

  // Period
  doc.setTextColor(...primaryColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Période: ${MONTH_NAMES_FR[invoice.month - 1]} ${invoice.year}`, pageWidth - 85, yPos + 15);

  // Table header
  yPos = 150;

  // Prepare table data
  const tableData = invoice.timesheets && invoice.timesheets.length > 0
    ? invoice.timesheets.map((ts, index) => [
        (index + 1).toString(),
        ts.expert_name || 'Expert',
        `${ts.days_worked} jours`,
        `${ts.daily_rate.toFixed(2)} €`,
        `${(ts.days_worked * ts.daily_rate).toFixed(2)} €`
      ])
    : [['1', 'Prestation de services', '-', '-', `${invoice.subtotal.toFixed(2)} €`]];

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Description', 'Quantité', 'Prix unitaire', 'Total HT']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: darkColor,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  });

  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals box
  const totalsX = pageWidth - 95;
  const taxRate = invoice.tax_rate || 20;
  const taxAmount = invoice.tax_amount || (invoice.subtotal * taxRate / 100);
  const total = invoice.total || (invoice.subtotal + taxAmount);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX - 5, finalY, 85, 50, 2, 2, 'F');

  doc.setTextColor(...grayColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Sous-total HT:', totalsX, finalY + 12);
  doc.text(`${invoice.subtotal.toFixed(2)} €`, pageWidth - 20, finalY + 12, { align: 'right' });
  
  doc.text(`TVA (${taxRate}%):`, totalsX, finalY + 24);
  doc.text(`${taxAmount.toFixed(2)} €`, pageWidth - 20, finalY + 24, { align: 'right' });

  // Total line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(totalsX, finalY + 32, pageWidth - 15, finalY + 32);

  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total TTC:', totalsX, finalY + 44);
  doc.text(`${total.toFixed(2)} €`, pageWidth - 20, finalY + 44, { align: 'right' });

  // Payment info — Bank transfer
  const paymentY = finalY + 70;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, paymentY, pageWidth - 30, 58, 2, 2, 'F');

  doc.setTextColor(...darkColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Mode de paiement : Virement bancaire', 20, paymentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text(`Bénéficiaire : ${COMPANY_INFO.name}`, 20, paymentY + 20);
  doc.text(`IBAN : ${COMPANY_INFO.iban}`, 20, paymentY + 27);
  doc.text(`BIC : ${COMPANY_INFO.bic}`, 20, paymentY + 34);
  doc.text(`Banque : ${COMPANY_INFO.bank || 'N/A'}`, 20, paymentY + 41);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(`Référence obligatoire : ${invoice.invoice_number}`, 20, paymentY + 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text(`Date d'échéance : ${new Date(invoice.due_date).toLocaleDateString('fr-FR')} — Délai de paiement : 7 jours`, 20, paymentY + 57);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 25;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(15, footerY, pageWidth - 15, footerY);

  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.text(
    `${COMPANY_INFO.name} - ${COMPANY_INFO.address}, ${COMPANY_INFO.city}`,
    pageWidth / 2,
    footerY + 8,
    { align: 'center' }
  );
  doc.text(
    `Email: ${COMPANY_INFO.email} | Tél: ${COMPANY_INFO.phone}`,
    pageWidth / 2,
    footerY + 14,
    { align: 'center' }
  );

  // Save
  doc.save(`facture-${invoice.invoice_number}.pdf`);
};

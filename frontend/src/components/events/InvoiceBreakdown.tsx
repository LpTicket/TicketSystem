'use client';

interface InvoiceItem {
  seatId?: string;
  sectionName: string;
  rowLabel: string;
  seatNumber: number;
  price: number;
}

export interface InvoiceData {
  baseTotal: number;
  lpFee: number;
  processingFee: number;
  total: number;
  seatsInfo: InvoiceItem[];
  currency?: string;
}

interface InvoiceBreakdownProps {
  invoice: InvoiceData;
  eventTitle?: string;
}

const fmt = (n: number, currency = 'USD') =>
  `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export default function InvoiceBreakdown({ invoice, eventTitle }: InvoiceBreakdownProps) {
  const cur = invoice.currency || 'USD';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider">Resumen de Pago</h3>
          {eventTitle && <p className="text-xs text-gray-400 font-medium truncate max-w-[200px]">{eventTitle}</p>}
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md uppercase tracking-tighter">FACTURA DIGITAL</span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Ticket list */}
        <div className="space-y-2">
          {invoice.seatsInfo.map((item, i) => (
            <div key={i} className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                <span className="text-gray-600 font-medium">
                  {(() => {
                    const row = item.rowLabel;
                    const num = item.seatNumber;
                    if (row === 'GA') return `Entrada General (${item.sectionName})`;
                    if (row === 'Mesa') return `Mesa ${num} (${item.sectionName})`;
                    if (row.length > 2) {
                      // If seatNumber is 1 or not generic, avoid double suffixing if they don't want it, e.g. "Asiento 12-1" -> "Asiento 12"
                      if (num === 1) return `${row} (${item.sectionName})`;
                      return `${row} - Silla ${num} (${item.sectionName})`;
                    }
                    if (row.length === 1) {
                      return `Fila ${row}, Asiento ${num} (${item.sectionName})`;
                    }
                    return `${row}-${num} (${item.sectionName})`;
                  })()}
                </span>
              </div>
              <span className="font-bold text-gray-900">{fmt(item.price, cur)}</span>
            </div>
          ))}
        </div>

        <div className="h-px bg-dashed-gray bg-gradient-to-r from-transparent via-gray-200 to-transparent my-4" />

        {/* Calculations */}
        <div className="space-y-2.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 font-medium">Subtotal</span>
            <span className="text-gray-700 font-bold">{fmt(invoice.baseTotal, cur)}</span>
          </div>
          
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 font-medium">Cargo por servicio</span>
            <span className="text-gray-700 font-bold">{fmt(invoice.lpFee, cur)}</span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-gray-400 font-medium">Tarifa de procesamiento</span>
            <span className="text-gray-700 font-bold">{fmt(invoice.processingFee, cur)}</span>
          </div>
        </div>

        {/* Total Box */}
        <div className="mt-6 bg-primary-50 rounded-2xl p-5 border border-primary-100 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-0.5">Total a Pagar</p>
            <p className="text-xs text-primary-400 font-medium">Incluye impuestos y cargos</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-primary-700 tracking-tighter leading-none">
              {fmt(invoice.total, cur)}
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="bg-gray-50/30 px-6 py-3 border-t border-gray-100 flex items-center gap-2 justify-center">
        <div className="w-1 h-1 rounded-full bg-green-500" />
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Transacción Protegida por Stripe</span>
      </div>
    </div>
  );
}

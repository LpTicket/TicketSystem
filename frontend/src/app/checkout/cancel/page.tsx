'use client';

import Link from 'next/link';
import { HiOutlineXCircle } from 'react-icons/hi';

export default function CheckoutCancelPage() {
  return (
    <div className="page-dark-shell min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <HiOutlineXCircle className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="font-bold text-2xl text-gray-900 mb-3">Pago cancelado</h1>
        <p className="text-gray-600 mb-8">Tu pago ha sido cancelado. Los asientos seleccionados serán liberados automáticamente.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/events" className="btn-primary">Volver a eventos</Link>
          <Link href="/" className="btn-secondary">Ir al inicio</Link>
        </div>
      </div>
    </div>
  );
}

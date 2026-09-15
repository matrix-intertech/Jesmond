import { CheckCircle, ShoppingBag, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  // Normally we would fetch order details from the backend securely here.
  // For the scope of this frontend phase, we render the success state.

  return (
    <div className="flex-1 flex items-center justify-center py-20 px-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 border border-slate-200 shadow-xl shadow-slate-200/50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-brand-orange"></div>

        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <CheckCircle size={48} strokeWidth={2} />
        </div>

        <h1 className="text-3xl font-extrabold text-brand-navy mb-2 tracking-tight">Order Confirmed!</h1>
        <p className="text-slate-500 mb-8">
          Thank you for your purchase. We've received your order and are processing it now.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-8 flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Order Reference</span>
          <span className="text-xl font-bold text-brand-navy font-mono tracking-widest">{orderId}</span>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/retail"
            className="w-full py-3.5 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-500/20"
          >
            <ShoppingBag size={18} /> Continue Shopping
          </Link>
          <Link
            href="/student"
            className="w-full py-3.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-brand-navy font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            Go to Dashboard <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}

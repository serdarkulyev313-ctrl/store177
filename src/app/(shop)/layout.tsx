import { BottomNav } from "./_components/BottomNav";
import { CartProvider } from "./_state/cart";
import { FavoritesProvider } from "./_state/favorites";
import { ToastProvider } from "./_state/toast";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <ToastProvider>
        <CartProvider>
          <FavoritesProvider>{children}</FavoritesProvider>
        </CartProvider>
      </ToastProvider>
      <BottomNav />
    </div>
  );
}

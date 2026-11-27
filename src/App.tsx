import React, {useEffect} from 'react';
import {BrowserRouter, Navigate, Route, Routes, useLocation} from 'react-router-dom';
import {ErrorBoundary} from './components/ErrorBoundary';
import {Layout} from './components/Layout';
import {StoreProvider} from './context/StoreContext';
import {AdminDashboardPage} from './pages/AdminDashboardPage';
import {LoginPage} from './pages/AuthPages';
import {CartPage} from './pages/CartPage';
import {CategoriesPage} from './pages/CategoriesPage';
import {CheckoutPage} from './pages/CheckoutPage';
import {HomePage} from './pages/HomePage';
import {
  AboutPage,
  ContactPage,
  FaqPage,
  OfflinePage,
  PrivacyPolicyPage,
  ReturnPolicyPage,
  TermsPage,
} from './pages/InfoPages';
import {NotificationsPage} from './pages/NotificationsPage';
import {OrderDetailPage} from './pages/OrderDetailPage';
import {OrdersPage} from './pages/OrdersPage';
import {ProductDetailsPage} from './pages/ProductDetailsPage';
import {ProductsPage} from './pages/ProductsPage';
import {ProfilePage} from './pages/ProfilePage';
import {WishlistPage} from './pages/WishlistPage';

const ScrollToTop: React.FC = () => {
  const {pathname} = useLocation();
  useEffect(() => {
    window.scrollTo({top: 0, behavior: 'auto'});
  }, [pathname]);
  return null;
};

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage mode="all" />} />
              <Route path="/products/:slug" element={<ProductDetailsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/categories/:slug" element={<ProductsPage mode="category" />} />
              <Route path="/search" element={<ProductsPage mode="search" />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/track-order" element={<OrdersPage />} />
              <Route path="/track-order/:orderId" element={<OrderDetailPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/return-policy" element={<ReturnPolicyPage />} />
              <Route path="/offline" element={<OfflinePage />} />
              <Route path="/admin/*" element={<AdminDashboardPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </StoreProvider>
    </ErrorBoundary>
  );
}

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  BarChart3,
  Bell,
  Box,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FolderTree,
  Globe,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {ImageWithFallback} from '../components/ImageWithFallback';
import {formatBDT, formatDhakaDateTime} from '../lib/bd-locations';
import {BOOTSTRAPPED_ADMIN_EMAIL} from '../lib/firebase';
import {
  deleteAdminBanner,
  deleteAdminBrand,
  deleteAdminCategory,
  deleteAdminCoupon,
  deleteAdminProduct,
  fetchAdminWorkspaceData,
  moderateReviewAdmin,
  processReturnAndRefundAdmin,
  saveAdminBanner,
  saveAdminBrand,
  saveAdminCategory,
  saveAdminCoupon,
  saveAdminProduct,
  saveAdminSetting,
  seedInitialCatalogIfEmpty,
  sendAdminNotification,
  updateAdminOrder,
  uploadProductImage,
} from '../services/firestoreService';
import type {
  AdminLog,
  Banner,
  Brand,
  Category,
  Coupon,
  NotificationItem,
  Order,
  OrderStatus,
  PaymentSettings,
  PaymentStatus,
  Product,
  RefundRecord,
  ReturnRequest,
  Review,
  ShippingSettings,
  UserProfile,
  WebsiteSettings,
} from '../types/ecommerce';

type AdminTab =
  | 'overview'
  | 'products'
  | 'categories'
  | 'brands'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'coupons'
  | 'banners'
  | 'flash_sales'
  | 'reviews'
  | 'returns'
  | 'notifications'
  | 'shipping'
  | 'payments'
  | 'website'
  | 'reports_logs';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Return Requested',
  'Returned',
  'Refunded',
];

const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'paid', 'refunded', 'failed'];

const NAV_ITEMS: {id: AdminTab; label: string; icon: React.ComponentType<{className?: string}>}[] = [
  {id: 'overview', label: 'Overview', icon: BarChart3},
  {id: 'orders', label: 'Orders', icon: ShoppingBag},
  {id: 'products', label: 'Products', icon: Package},
  {id: 'inventory', label: 'Inventory', icon: Layers},
  {id: 'categories', label: 'Categories', icon: FolderTree},
  {id: 'brands', label: 'Brands', icon: Tag},
  {id: 'customers', label: 'Customers', icon: Users},
  {id: 'coupons', label: 'Coupons', icon: BadgePercent},
  {id: 'banners', label: 'Banners', icon: ImageIcon},
  {id: 'flash_sales', label: 'Flash Sales', icon: Zap},
  {id: 'reviews', label: 'Reviews', icon: MessageSquare},
  {id: 'returns', label: 'Returns & Refunds', icon: RotateCcw},
  {id: 'notifications', label: 'Notifications', icon: Bell},
  {id: 'shipping', label: 'Shipping', icon: Truck},
  {id: 'payments', label: 'Payments', icon: CreditCard},
  {id: 'website', label: 'Website Settings', icon: Globe},
  {id: 'reports_logs', label: 'Reports & Logs', icon: ClipboardList},
];

export const AdminDashboardPage: React.FC = () => {
  const {
    user,
    authReady,
    isAdmin,
    products,
    categories,
    brands,
    banners,
    shippingSettings,
    paymentSettings,
    websiteSettings,
    catalogLoadedFromDb,
    refreshCatalog,
    showToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<NotificationItem[]>([]);

  // Search / filters
  const [productSearch, setProductSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Product editor state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [prodForm, setProdForm] = useState({
    name: '',
    nameBn: '',
    slug: '',
    sku: '',
    shortDescription: '',
    description: '',
    categoryId: categories[0]?.id || 'cat-audio',
    brandId: brands[0]?.id || 'brand-shikder',
    regularPrice: 1990,
    discountedPrice: 1490,
    stockQuantity: 25,
    imageUrl: '',
    videoUrl: '',
    shippingInfo: 'Same-day dispatch in Dhaka; 48-72 hours nationwide.',
    seoTitle: '',
    seoDescription: '',
    isFeatured: true,
    isTrending: false,
    isFlashSale: false,
    isActive: true,
    variantColor: 'Emerald',
    variantSize: 'Standard',
  });

  // Category & Brand forms
  const [catForm, setCatForm] = useState({id: '', name: '', nameBn: '', slug: '', sortOrder: 1, isActive: true});
  const [brandForm, setBrandForm] = useState({id: '', name: '', slug: '', isActive: true});

  // Coupon form
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'fixed' as 'fixed' | 'percentage',
    value: 200,
    minPurchase: 1500,
    maxDiscount: 500,
    usageLimit: 200,
    expiresAt: '2027-12-31T23:59:59Z',
    isActive: true,
  });

  // Banner form
  const [bannerForm, setBannerForm] = useState({
    id: '',
    title: '',
    titleBn: '',
    subtitle: '',
    badgeText: 'FEATURED',
    imageUrl: '',
    linkUrl: '/products',
    placement: 'hero' as 'hero' | 'promo' | 'flash_sale',
    sortOrder: 1,
    isActive: true,
  });

  // Order edits cache
  const [orderDrafts, setOrderDrafts] = useState<
    Record<string, {orderStatus: OrderStatus; paymentStatus: PaymentStatus; trackingCode: string}>
  >({});

  // Return refund inputs
  const [refundDrafts, setRefundDrafts] = useState<Record<string, number>>({});

  // Notification composer
  const [notifTarget, setNotifTarget] = useState<string>('ALL');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');

  // Settings drafts
  const [shipDraft, setShipDraft] = useState<ShippingSettings>(shippingSettings);
  const [payDraft, setPayDraft] = useState<PaymentSettings>(paymentSettings);
  const [webDraft, setWebDraft] = useState<WebsiteSettings>(websiteSettings);

  useEffect(() => {
    setShipDraft(shippingSettings);
  }, [shippingSettings]);
  useEffect(() => {
    setPayDraft(paymentSettings);
  }, [paymentSettings]);
  useEffect(() => {
    setWebDraft(websiteSettings);
  }, [websiteSettings]);

  const loadWorkspace = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoadingWorkspace(true);
    try {
      const data = await fetchAdminWorkspaceData();
      setOrders(data.orders);
      setCustomers(data.customers);
      setCoupons(data.coupons);
      setReviews(data.reviews);
      setReturnsList(data.returns);
      setRefunds(data.refunds);
      setLogs(data.logs);
      setAdminNotifications(data.notifications);

      const drafts: Record<string, {orderStatus: OrderStatus; paymentStatus: PaymentStatus; trackingCode: string}> = {};
      data.orders.forEach((o) => {
        drafts[o.id] = {
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          trackingCode: o.trackingCode || '',
        };
      });
      setOrderDrafts(drafts);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load admin workspace');
    } finally {
      setLoadingWorkspace(false);
    }
  }, [user, isAdmin, showToast]);

  useEffect(() => {
    if (authReady && user && isAdmin) {
      loadWorkspace();
    }
  }, [authReady, user, isAdmin, loadWorkspace]);

  // Metrics
  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Refunded');
    const totalSales = validOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingCount = orders.filter((o) => o.orderStatus === 'Pending').length;
    const deliveredCount = orders.filter((o) => o.orderStatus === 'Delivered').length;
    const cancelledCount = orders.filter((o) => o.orderStatus === 'Cancelled').length;
    const lowStockProducts = products.filter((p) => p.stockQuantity < 10);

    // Build last 7 days bar chart data
    const days: {label: string; total: number}[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-BD', {weekday: 'short'});
      const daySum = validOrders
        .filter((o) => {
          const ts = o.createdAt as {toDate?: () => Date} | string | undefined;
          const iso =
            ts && typeof ts === 'object' && typeof ts.toDate === 'function'
              ? ts.toDate().toISOString()
              : typeof ts === 'string'
              ? ts
              : '';
          return iso.slice(0, 10) === dayKey;
        })
        .reduce((s, o) => s + (o.totalAmount || 0), 0);
      days.push({label, total: daySum});
    }

    return {
      totalSales,
      totalOrders: orders.length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      pendingCount,
      deliveredCount,
      cancelledCount,
      lowStockProducts,
      chartDays: days,
    };
  }, [orders, customers.length, products]);

  const maxChartVal = Math.max(1000, ...metrics.chartDays.map((d) => d.total));

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm font-medium text-light-on-surface-variant dark:text-dark-on-surface-variant">
          Verifying administrator session...
        </p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-light-error-container text-light-on-error-container flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="font-headline text-2xl font-bold">Admin Access Restricted</h1>
          <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Only the verified single-vendor store owner (<span className="font-mono">{BOOTSTRAPPED_ADMIN_EMAIL}</span>) or
            authorized admins may access the SHIKDER SHOP control panel.
          </p>
          <div className="flex gap-3 pt-2">
            <Link
              to="/"
              className="px-5 py-2.5 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-sm font-semibold"
            >
              Return to Storefront
            </Link>
            <Link
              to="/login?redirect=/admin"
              className="px-5 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold"
            >
              Admin Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSeedCatalog = async () => {
    setBusyAction(true);
    try {
      const created = await seedInitialCatalogIfEmpty(user);
      await refreshCatalog();
      await loadWorkspace();
      showToast(created ? 'Starter Bangladesh catalog seeded to Firestore!' : 'Catalog already populated in Firestore.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to seed catalog');
    } finally {
      setBusyAction(false);
    }
  };

  const openNewProduct = () => {
    setEditingProductId(null);
    setProdForm({
      name: '',
      nameBn: '',
      slug: '',
      sku: `SHK-${Math.floor(100 + Math.random() * 900)}`,
      shortDescription: '',
      description: '',
      categoryId: categories[0]?.id || 'cat-audio',
      brandId: brands[0]?.id || 'brand-shikder',
      regularPrice: 1990,
      discountedPrice: 1490,
      stockQuantity: 25,
      imageUrl: '',
      videoUrl: '',
      shippingInfo: 'Same-day dispatch inside Dhaka; 48–72h nationwide.',
      seoTitle: '',
      seoDescription: '',
      isFeatured: true,
      isTrending: false,
      isFlashSale: false,
      isActive: true,
      variantColor: 'Default',
      variantSize: 'Standard',
    });
    setShowProductForm(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProdForm({
      name: p.name,
      nameBn: p.nameBn || '',
      slug: p.slug,
      sku: p.sku,
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      categoryId: p.categoryId,
      brandId: p.brandId,
      regularPrice: p.regularPrice,
      discountedPrice: p.discountedPrice || 0,
      stockQuantity: p.stockQuantity,
      imageUrl: p.images?.[0] || '',
      videoUrl: p.videoUrl || '',
      shippingInfo: p.shippingInfo || '',
      seoTitle: p.seoTitle || '',
      seoDescription: p.seoDescription || '',
      isFeatured: p.isFeatured,
      isTrending: p.isTrending,
      isFlashSale: p.isFlashSale,
      isActive: p.isActive,
      variantColor: p.variants?.[0]?.color || 'Default',
      variantSize: p.variants?.[0]?.size || 'Standard',
    });
    setShowProductForm(true);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyAction(true);
    try {
      const url = await uploadProductImage(file);
      setProdForm((prev) => ({...prev, imageUrl: url}));
      showToast('Product image uploaded to Firebase Storage');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setBusyAction(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name.trim() || !prodForm.sku.trim()) {
      showToast('Product name and SKU are required.');
      return;
    }
    const cleanSlug =
      prodForm.slug.trim() ||
      prodForm.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    setBusyAction(true);
    try {
      const existing = editingProductId ? products.find((p) => p.id === editingProductId) : undefined;
      await saveAdminProduct(user, editingProductId, {
        name: prodForm.name.trim(),
        nameBn: prodForm.nameBn.trim(),
        slug: cleanSlug,
        sku: prodForm.sku.trim().toUpperCase(),
        shortDescription: prodForm.shortDescription.trim(),
        description: prodForm.description.trim(),
        categoryId: prodForm.categoryId,
        brandId: prodForm.brandId,
        regularPrice: Number(prodForm.regularPrice),
        discountedPrice: Number(prodForm.discountedPrice) || 0,
        images: prodForm.imageUrl.trim() ? [prodForm.imageUrl.trim()] : [],
        videoUrl: prodForm.videoUrl.trim(),
        variants: [
          {
            id: existing?.variants?.[0]?.id || `var-${Date.now()}`,
            color: prodForm.variantColor || 'Standard',
            size: prodForm.variantSize || 'Standard',
            sku: prodForm.sku.trim().toUpperCase(),
            stock: Number(prodForm.stockQuantity),
          },
        ],
        stockQuantity: Number(prodForm.stockQuantity),
        specifications: existing?.specifications || [],
        shippingInfo: prodForm.shippingInfo.trim(),
        seoTitle: prodForm.seoTitle.trim(),
        seoDescription: prodForm.seoDescription.trim(),
        isFeatured: prodForm.isFeatured,
        isTrending: prodForm.isTrending,
        isFlashSale: prodForm.isFlashSale,
        isActive: prodForm.isActive,
        ratingAvg: existing?.ratingAvg ?? 5,
        ratingCount: existing?.ratingCount ?? 0,
        soldCount: existing?.soldCount ?? 0,
      });
      await refreshCatalog();
      await loadWorkspace();
      setShowProductForm(false);
      showToast(editingProductId ? 'Product updated' : 'Product published');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save product');
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleProductField = async (p: Product, field: 'isActive' | 'isFlashSale' | 'isFeatured') => {
    setBusyAction(true);
    try {
      const {id, createdAt: _c, updatedAt: _u, ...rest} = p;
      await saveAdminProduct(user, id, {
        ...rest,
        [field]: !p[field],
      });
      await refreshCatalog();
      showToast(`Updated ${p.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyAction(false);
    }
  };

  const handleQuickStockChange = async (p: Product, newStock: number) => {
    if (Number.isNaN(newStock) || newStock < 0) return;
    setBusyAction(true);
    try {
      const {id, createdAt: _c, updatedAt: _u, ...rest} = p;
      await saveAdminProduct(user, id, {
        ...rest,
        stockQuantity: Math.floor(newStock),
      });
      await refreshCatalog();
      showToast(`Stock updated for ${p.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Stock update failed');
    } finally {
      setBusyAction(false);
    }
  };

  const handleExportOrdersCsv = () => {
    const headers = ['OrderNumber', 'Date', 'Customer', 'Phone', 'District', 'TotalBDT', 'PaymentMethod', 'PaymentStatus', 'OrderStatus'];
    const rows = orders.map((o) => [
      o.orderNumber,
      formatDhakaDateTime(o.createdAt).replace(/,/g, ' '),
      `"${o.customerInfo.fullName.replace(/"/g, '""')}"`,
      o.customerInfo.phone,
      o.customerInfo.district,
      String(o.totalAmount),
      o.paymentMethod,
      o.paymentStatus,
      o.orderStatus,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shikder-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Orders CSV exported');
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !productSearch.trim() ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase());
    const matchesStock = !lowStockOnly || p.stockQuantity < 10;
    return matchesSearch && matchesStock;
  });

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderStatusFilter === 'ALL' || o.orderStatus === orderStatusFilter;
    const q = orderSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerInfo.fullName.toLowerCase().includes(q) ||
      o.customerInfo.phone.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-light-surface dark:bg-dark-surface text-light-on-surface dark:text-dark-on-surface">
      {/* Desktop Sidebar */}
      <aside className="lg:w-64 shrink-0 bg-light-surface-bright dark:bg-dark-surface-container-low border-b lg:border-b-0 lg:border-r border-light-outline-variant dark:border-dark-outline-variant flex flex-col">
        <div className="p-4 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/aistudio/file_00000000c1e88211b6f9ba18d88de282_18b6663a.png"
              alt="SHIKDER SHOP logo"
              className="w-9 h-9 rounded-full object-cover border border-light-outline-variant dark:border-dark-outline-variant shrink-0"
            />
            <div>
              <p className="font-headline font-extrabold text-sm leading-tight">SHIKDER ADMIN</p>
              <p className="text-[11px] text-light-on-surface-variant dark:text-dark-on-surface-variant truncate max-w-[140px]">
                {user.email}
              </p>
            </div>
          </div>
          <Link
            to="/"
            title="Return to Storefront"
            className="w-8 h-8 rounded-full border border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>

        {/* Navigation List */}
        <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 p-2.5 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                    : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block p-3 border-t border-light-outline-variant dark:border-dark-outline-variant text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
          <div className="flex items-center gap-1.5 font-semibold text-light-primary dark:text-dark-primary">
            <ShieldCheck className="w-4 h-4" /> Single-Vendor Mode
          </div>
          <p className="mt-1 text-[11px]">Bootstrapped owner RBAC active</p>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
        {/* Top Action Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-light-outline-variant dark:border-dark-outline-variant">
          <div>
            <h1 className="font-headline text-2xl font-bold">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Admin Dashboard'}
            </h1>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Firestore Catalog: {catalogLoadedFromDb ? 'Live Synchronized' : 'Starter Seed Ready'} · Currency BDT (৳)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!catalogLoadedFromDb && (
              <button
                type="button"
                disabled={busyAction}
                onClick={handleSeedCatalog}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary text-xs font-semibold"
              >
                <Sparkles className="w-4 h-4" />
                Initialize Starter Catalog
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                refreshCatalog();
                loadWorkspace();
              }}
              disabled={loadingWorkspace}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-light-outline-variant dark:border-dark-outline-variant text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingWorkspace ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6">
            {/* Primary 4 KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                {label: 'Total Net Sales', value: formatBDT(metrics.totalSales), sub: `${metrics.deliveredCount} delivered`},
                {label: 'Total Orders', value: String(metrics.totalOrders), sub: `${metrics.pendingCount} pending dispatch`},
                {label: 'Registered Customers', value: String(metrics.totalCustomers), sub: 'All 64 BD districts'},
                {
                  label: 'Catalog Products',
                  value: String(metrics.totalProducts),
                  sub: `${metrics.lowStockProducts.length} low stock (<10)`,
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-1"
                >
                  <span className="text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    {kpi.label}
                  </span>
                  <span className="font-headline text-2xl font-extrabold tabular-nums">{kpi.value}</span>
                  <span className="text-xs text-light-primary dark:text-dark-primary font-medium">{kpi.sub}</span>
                </div>
              ))}
            </div>

            {/* Order Status Strip */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container p-4 flex items-center justify-between">
                <span className="text-xs font-semibold">Pending</span>
                <span className="font-headline text-lg font-bold tabular-nums">{metrics.pendingCount}</span>
              </div>
              <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container p-4 flex items-center justify-between">
                <span className="text-xs font-semibold">Delivered</span>
                <span className="font-headline text-lg font-bold text-success tabular-nums">{metrics.deliveredCount}</span>
              </div>
              <div className="rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container p-4 flex items-center justify-between">
                <span className="text-xs font-semibold">Cancelled</span>
                <span className="font-headline text-lg font-bold text-light-error tabular-nums">{metrics.cancelledCount}</span>
              </div>
            </div>

            {/* Revenue Bar Chart & Low Stock Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-base font-bold">7-Day Revenue Trend (BDT)</h2>
                  <button
                    type="button"
                    onClick={handleExportOrdersCsv}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-light-primary dark:text-dark-primary"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>
                <div className="h-44 flex items-end justify-between gap-2 pt-4">
                  {metrics.chartDays.map((day) => {
                    const pct = Math.max(6, Math.round((day.total / maxChartVal) * 100));
                    return (
                      <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[10px] font-mono tabular-nums text-light-on-surface-variant dark:text-dark-on-surface-variant">
                          {day.total > 0 ? formatBDT(day.total) : '৳0'}
                        </span>
                        <div
                          className="w-full max-w-[38px] rounded-t-lg bg-light-primary dark:bg-dark-primary transition-all"
                          style={{height: `${pct}%`}}
                        />
                        <span className="text-xs font-semibold">{day.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-base font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-light-secondary" />
                    Low Stock Alerts (&lt;10 units)
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setLowStockOnly(true);
                      setActiveTab('inventory');
                    }}
                    className="text-xs font-semibold text-light-primary dark:text-dark-primary"
                  >
                    Manage Stock
                  </button>
                </div>
                {metrics.lowStockProducts.length === 0 ? (
                  <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant py-6">
                    All active products have healthy inventory levels.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {metrics.lowStockProducts.slice(0, 5).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container text-sm"
                      >
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="font-mono text-xs font-bold text-light-error shrink-0">
                          {p.stockQuantity} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Orders & Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-base font-bold">Recent Orders</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-semibold text-light-primary dark:text-dark-primary"
                  >
                    View All
                  </button>
                </div>
                {orders.length === 0 ? (
                  <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    No customer orders recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
                    {orders.slice(0, 5).map((o) => (
                      <div key={o.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-mono font-bold text-xs">{o.orderNumber}</p>
                          <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                            {o.customerInfo.fullName} · {o.customerInfo.district}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatBDT(o.totalAmount)}</p>
                          <p className="text-[11px] font-semibold text-light-primary dark:text-dark-primary">
                            {o.orderStatus}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
                <h2 className="font-headline text-base font-bold">Top Selling Products</h2>
                <div className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
                  {[...products]
                    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
                    .slice(0, 5)
                    .map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                            <ImageWithFallback src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                              {p.soldCount || 0} sold · {p.stockQuantity} in stock
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">
                          {formatBDT(p.discountedPrice || p.regularPrice)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS */}
        {activeTab === 'products' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-light-outline" />
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product name or SKU..."
                  className="w-full rounded-full pl-9 pr-4 py-2 text-sm bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
                />
              </div>
              <button
                type="button"
                onClick={openNewProduct}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </div>

            {showProductForm && (
              <form
                onSubmit={handleSaveProduct}
                className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-headline text-lg font-bold">
                    {editingProductId ? 'Edit Product' : 'Create Single-Vendor Product'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowProductForm(false)}
                    className="text-xs font-semibold text-light-on-surface-variant"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Product Name (EN)
                    <input
                      required
                      value={prodForm.name}
                      onChange={(e) => setProdForm({...prodForm, name: e.target.value})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Product Name (বাংলা)
                    <input
                      value={prodForm.nameBn}
                      onChange={(e) => setProdForm({...prodForm, nameBn: e.target.value})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    SKU
                    <input
                      required
                      value={prodForm.sku}
                      onChange={(e) => setProdForm({...prodForm, sku: e.target.value})}
                      className="rounded-lg px-3 py-2 text-sm font-mono font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Slug
                    <input
                      value={prodForm.slug}
                      onChange={(e) => setProdForm({...prodForm, slug: e.target.value})}
                      placeholder="auto-generated-from-name"
                      className="rounded-lg px-3 py-2 text-sm font-mono font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Category
                    <select
                      value={prodForm.categoryId}
                      onChange={(e) => setProdForm({...prodForm, categoryId: e.target.value})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Brand
                    <select
                      value={prodForm.brandId}
                      onChange={(e) => setProdForm({...prodForm, brandId: e.target.value})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Regular Price (BDT ৳)
                    <input
                      type="number"
                      min={0}
                      required
                      value={prodForm.regularPrice}
                      onChange={(e) => setProdForm({...prodForm, regularPrice: Number(e.target.value)})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Discounted Price (BDT ৳)
                    <input
                      type="number"
                      min={0}
                      value={prodForm.discountedPrice}
                      onChange={(e) => setProdForm({...prodForm, discountedPrice: Number(e.target.value)})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Stock Quantity
                    <input
                      type="number"
                      min={0}
                      required
                      value={prodForm.stockQuantity}
                      onChange={(e) => setProdForm({...prodForm, stockQuantity: Number(e.target.value)})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Default Color Variant
                    <input
                      value={prodForm.variantColor}
                      onChange={(e) => setProdForm({...prodForm, variantColor: e.target.value})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Default Size Variant
                    <input
                      value={prodForm.variantSize}
                      onChange={(e) => setProdForm({...prodForm, variantSize: e.target.value})}
                      className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                    />
                  </label>
                  <div className="flex flex-col gap-1 text-xs font-semibold">
                    <span>Product Image URL or Upload (JPEG/PNG/WebP &le;5MB)</span>
                    <div className="flex gap-2">
                      <input
                        value={prodForm.imageUrl}
                        onChange={(e) => setProdForm({...prodForm, imageUrl: e.target.value})}
                        placeholder="https://..."
                        className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                      />
                      <label className="px-3 py-2 rounded-lg border border-light-outline-variant dark:border-dark-outline-variant cursor-pointer inline-flex items-center gap-1 text-xs font-semibold shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleProductImageUpload} />
                      </label>
                    </div>
                  </div>
                </div>

                <label className="flex flex-col gap-1 text-xs font-semibold">
                  Short Description
                  <input
                    value={prodForm.shortDescription}
                    onChange={(e) => setProdForm({...prodForm, shortDescription: e.target.value})}
                    className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold">
                  Full Description
                  <textarea
                    rows={3}
                    value={prodForm.description}
                    onChange={(e) => setProdForm({...prodForm, description: e.target.value})}
                    className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                  />
                </label>

                <div className="flex flex-wrap gap-4 text-xs font-semibold">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={prodForm.isActive} onChange={(e) => setProdForm({...prodForm, isActive: e.target.checked})} />
                    Published (Active)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={prodForm.isFeatured} onChange={(e) => setProdForm({...prodForm, isFeatured: e.target.checked})} />
                    Featured
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={prodForm.isTrending} onChange={(e) => setProdForm({...prodForm, isTrending: e.target.checked})} />
                    Trending
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={prodForm.isFlashSale} onChange={(e) => setProdForm({...prodForm, isFlashSale: e.target.checked})} />
                    Flash Sale
                  </label>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={busyAction}
                    className="px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold"
                  >
                    {busyAction ? 'Saving...' : editingProductId ? 'Update Product' : 'Publish Product'}
                  </button>
                </div>
              </form>
            )}

            <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-light-outline-variant dark:border-dark-outline-variant text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  <tr>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5">SKU</th>
                    <th className="p-3.5">Price</th>
                    <th className="p-3.5">Stock</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
                  {filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                            <ImageWithFallback src={p.images?.[0]} alt={p.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                              {p.isFlashSale ? 'Flash Sale · ' : ''}
                              {p.isFeatured ? 'Featured' : 'Standard'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-xs">{p.sku}</td>
                      <td className="p-3.5 tabular-nums font-semibold">
                        {formatBDT(p.discountedPrice && p.discountedPrice > 0 ? p.discountedPrice : p.regularPrice)}
                      </td>
                      <td className="p-3.5 tabular-nums">{p.stockQuantity}</td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleProductField(p, 'isActive')}
                          className={`inline-flex items-center gap-1 text-xs font-semibold ${
                            p.isActive ? 'text-success' : 'text-light-on-surface-variant'
                          }`}
                        >
                          {p.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {p.isActive ? 'Published' : 'Hidden'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditProduct(p)}
                            className="p-1.5 rounded-lg border border-light-outline-variant dark:border-dark-outline-variant"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setBusyAction(true);
                              try {
                                await deleteAdminProduct(user, p.id, p.name);
                                await refreshCatalog();
                                showToast(`Deleted ${p.name}`);
                              } finally {
                                setBusyAction(false);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-light-outline-variant dark:border-dark-outline-variant text-light-error"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!catForm.name.trim()) return;
                setBusyAction(true);
                try {
                  const slug = catForm.slug.trim() || catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  await saveAdminCategory(user, catForm.id || null, {
                    name: catForm.name.trim(),
                    nameBn: catForm.nameBn.trim(),
                    slug,
                    sortOrder: Number(catForm.sortOrder),
                    isActive: catForm.isActive,
                    icon: 'tag',
                  });
                  await refreshCatalog();
                  setCatForm({id: '', name: '', nameBn: '', slug: '', sortOrder: categories.length + 1, isActive: true});
                  showToast('Category saved');
                } finally {
                  setBusyAction(false);
                }
              }}
              className="lg:col-span-4 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3"
            >
              <h2 className="font-headline text-base font-bold">{catForm.id ? 'Edit Category' : 'Add Category'}</h2>
              <input
                required
                placeholder="Category Name (EN)"
                value={catForm.name}
                onChange={(e) => setCatForm({...catForm, name: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <input
                placeholder="Category Name (বাংলা)"
                value={catForm.nameBn}
                onChange={(e) => setCatForm({...catForm, nameBn: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <input
                placeholder="slug (e.g. smartwatches)"
                value={catForm.slug}
                onChange={(e) => setCatForm({...catForm, slug: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm font-mono bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <label className="inline-flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={catForm.isActive} onChange={(e) => setCatForm({...catForm, isActive: e.target.checked})} />
                Active
              </label>
              <button type="submit" disabled={busyAction} className="py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
                Save Category
              </button>
            </form>

            <div className="lg:col-span-8 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
              {categories.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{c.name} {c.nameBn ? `(${c.nameBn})` : ''}</p>
                    <p className="font-mono text-xs text-light-on-surface-variant">/{c.slug} · {c.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCatForm({
                          id: c.id,
                          name: c.name,
                          nameBn: c.nameBn || '',
                          slug: c.slug,
                          sortOrder: c.sortOrder,
                          isActive: c.isActive,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg border border-light-outline-variant text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteAdminCategory(user, c.id);
                        await refreshCatalog();
                        showToast('Category deleted');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-light-outline-variant text-xs font-semibold text-light-error"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: BRANDS */}
        {activeTab === 'brands' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!brandForm.name.trim()) return;
                setBusyAction(true);
                try {
                  const slug = brandForm.slug.trim() || brandForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  await saveAdminBrand(user, brandForm.id || null, {
                    name: brandForm.name.trim(),
                    slug,
                    isActive: brandForm.isActive,
                  });
                  await refreshCatalog();
                  setBrandForm({id: '', name: '', slug: '', isActive: true});
                  showToast('Brand saved');
                } finally {
                  setBusyAction(false);
                }
              }}
              className="lg:col-span-4 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3"
            >
              <h2 className="font-headline text-base font-bold">{brandForm.id ? 'Edit Brand' : 'Add Brand'}</h2>
              <input
                required
                placeholder="Brand Name"
                value={brandForm.name}
                onChange={(e) => setBrandForm({...brandForm, name: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <input
                placeholder="slug"
                value={brandForm.slug}
                onChange={(e) => setBrandForm({...brandForm, slug: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm font-mono bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <label className="inline-flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={brandForm.isActive} onChange={(e) => setBrandForm({...brandForm, isActive: e.target.checked})} />
                Active
              </label>
              <button type="submit" disabled={busyAction} className="py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
                Save Brand
              </button>
            </form>

            <div className="lg:col-span-8 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
              {brands.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{b.name}</p>
                    <p className="font-mono text-xs text-light-on-surface-variant">{b.slug} · {b.isActive ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBrandForm({id: b.id, name: b.name, slug: b.slug, isActive: b.isActive})}
                      className="px-3 py-1.5 rounded-lg border border-light-outline-variant text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteAdminBrand(user, b.id);
                        await refreshCatalog();
                        showToast('Brand deleted');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-light-outline-variant text-xs font-semibold text-light-error"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: ORDERS */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-light-outline" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Order # / customer / phone..."
                  className="w-full rounded-full pl-9 pr-4 py-2 text-sm bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="rounded-full px-4 py-2 text-xs font-semibold bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant"
              >
                <option value="ALL">All Statuses</option>
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-8 text-center text-sm text-light-on-surface-variant">
                No orders match your filter.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredOrders.map((order) => {
                  const draft = orderDrafts[order.id] || {
                    orderStatus: order.orderStatus,
                    paymentStatus: order.paymentStatus,
                    trackingCode: order.trackingCode || '',
                  };
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono font-bold text-sm">{order.orderNumber}</p>
                          <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                            {order.customerInfo.fullName} · {order.customerInfo.phone} · {order.customerInfo.district} ·{' '}
                            {formatDhakaDateTime(order.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-headline text-lg font-extrabold tabular-nums">{formatBDT(order.totalAmount)}</p>
                          <p className="text-xs uppercase font-semibold text-light-on-surface-variant">
                            {order.paymentMethod} ({order.items.length} items)
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-2 border-t border-light-outline-variant dark:border-dark-outline-variant">
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Order Status
                          <select
                            value={draft.orderStatus}
                            onChange={(e) =>
                              setOrderDrafts({
                                ...orderDrafts,
                                [order.id]: {...draft, orderStatus: e.target.value as OrderStatus},
                              })
                            }
                            className="rounded-lg px-3 py-2 text-xs font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                          >
                            {ORDER_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Payment Status
                          <select
                            value={draft.paymentStatus}
                            onChange={(e) =>
                              setOrderDrafts({
                                ...orderDrafts,
                                [order.id]: {...draft, paymentStatus: e.target.value as PaymentStatus},
                              })
                            }
                            className="rounded-lg px-3 py-2 text-xs font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                          >
                            {PAYMENT_STATUSES.map((ps) => (
                              <option key={ps} value={ps}>
                                {ps}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Courier Tracking Code
                          <input
                            value={draft.trackingCode}
                            onChange={(e) =>
                              setOrderDrafts({
                                ...orderDrafts,
                                [order.id]: {...draft, trackingCode: e.target.value},
                              })
                            }
                            placeholder="e.g. STD-BD-84920"
                            className="rounded-lg px-3 py-2 text-xs font-mono font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={busyAction}
                          onClick={async () => {
                            setBusyAction(true);
                            try {
                              await updateAdminOrder(user, order, draft);
                              await loadWorkspace();
                              showToast(`Updated ${order.orderNumber}`);
                            } catch (err) {
                              showToast(err instanceof Error ? err.message : 'Order update failed');
                            } finally {
                              setBusyAction(false);
                            }
                          }}
                          className="py-2 px-4 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold"
                        >
                          Save Order Update
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CUSTOMERS */}
        {activeTab === 'customers' && (
          <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-light-outline-variant dark:border-dark-outline-variant text-xs text-light-on-surface-variant">
                <tr>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
                {customers.map((c) => (
                  <tr key={c.uid}>
                    <td className="p-3.5 font-semibold">{c.name}</td>
                    <td className="p-3.5 text-xs">{c.email}</td>
                    <td className="p-3.5 font-mono text-xs">{c.phone || '—'}</td>
                    <td className="p-3.5 text-xs">
                      {c.district ? `${c.district}, ${c.division || ''}` : 'Not set'}
                    </td>
                    <td className="p-3.5 text-xs font-semibold uppercase">{c.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 7: INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
                Show Low Stock Only (&lt; 10 units)
              </label>
            </div>
            <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
              {filteredProducts.map((p) => (
                <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="font-mono text-xs text-light-on-surface-variant">
                      SKU: {p.sku} · Sold: {p.soldCount || 0}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${p.stockQuantity < 10 ? 'text-light-error' : 'text-success'}`}>
                      {p.stockQuantity} units
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuickStockChange(p, p.stockQuantity + 10)}
                      className="px-3 py-1 rounded-full border border-light-outline-variant text-xs font-semibold"
                    >
                      +10 Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickStockChange(p, Math.max(0, p.stockQuantity - 1))}
                      className="px-3 py-1 rounded-full border border-light-outline-variant text-xs font-semibold"
                    >
                      -1
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: COUPONS */}
        {activeTab === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!couponForm.code.trim()) return;
                setBusyAction(true);
                try {
                  await saveAdminCoupon(user, {
                    code: couponForm.code.trim().toUpperCase(),
                    type: couponForm.type,
                    value: Number(couponForm.value),
                    minPurchase: Number(couponForm.minPurchase),
                    maxDiscount: Number(couponForm.maxDiscount),
                    usageLimit: Number(couponForm.usageLimit),
                    usedCount: 0,
                    perCustomerLimit: 5,
                    expiresAt: couponForm.expiresAt,
                    isActive: couponForm.isActive,
                  });
                  await loadWorkspace();
                  setCouponForm({...couponForm, code: ''});
                  showToast('Coupon saved');
                } finally {
                  setBusyAction(false);
                }
              }}
              className="lg:col-span-4 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3"
            >
              <h2 className="font-headline text-base font-bold">Create / Update Coupon</h2>
              <input
                required
                placeholder="CODE (e.g. EID20)"
                value={couponForm.code}
                onChange={(e) => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})}
                className="rounded-lg px-3 py-2 text-sm font-mono uppercase bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={couponForm.type}
                  onChange={(e) => setCouponForm({...couponForm, type: e.target.value as 'fixed' | 'percentage'})}
                  className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                >
                  <option value="fixed">Fixed (৳)</option>
                  <option value="percentage">Percent (%)</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={couponForm.value}
                  onChange={(e) => setCouponForm({...couponForm, value: Number(e.target.value)})}
                  placeholder="Value"
                  className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold flex flex-col gap-1">
                  Min Spend (৳)
                  <input
                    type="number"
                    min={0}
                    value={couponForm.minPurchase}
                    onChange={(e) => setCouponForm({...couponForm, minPurchase: Number(e.target.value)})}
                    className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                  />
                </label>
                <label className="text-xs font-semibold flex flex-col gap-1">
                  Max Discount (৳)
                  <input
                    type="number"
                    min={0}
                    value={couponForm.maxDiscount}
                    onChange={(e) => setCouponForm({...couponForm, maxDiscount: Number(e.target.value)})}
                    className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                  />
                </label>
              </div>
              <button type="submit" disabled={busyAction} className="py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
                Save Coupon
              </button>
            </form>

            <div className="lg:col-span-8 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
              {coupons.map((cp) => (
                <div key={cp.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono font-bold text-sm">{cp.code}</p>
                    <p className="text-xs text-light-on-surface-variant">
                      {cp.type === 'percentage' ? `${cp.value}% off` : `${formatBDT(cp.value)} off`} · Min{' '}
                      {formatBDT(cp.minPurchase)} · Used {cp.usedCount || 0}/{cp.usageLimit || '∞'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const {id: _id, ...rest} = cp;
                          await saveAdminCoupon(user, {...rest, isActive: !cp.isActive});
                          await loadWorkspace();
                          showToast(`Coupon ${cp.code} ${!cp.isActive ? 'activated' : 'paused'}`);
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : 'Unable to update coupon');
                        }
                      }}
                      className="px-3 py-1 rounded-lg border border-light-outline-variant text-xs font-semibold"
                    >
                      {cp.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteAdminCoupon(user, cp.code);
                        await loadWorkspace();
                        showToast(`Deleted ${cp.code}`);
                      }}
                      className="px-3 py-1 rounded-lg border border-light-outline-variant text-xs font-semibold text-light-error"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 9: BANNERS */}
        {activeTab === 'banners' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!bannerForm.title.trim() || !bannerForm.imageUrl.trim()) return;
                setBusyAction(true);
                try {
                  await saveAdminBanner(user, bannerForm.id || null, {
                    title: bannerForm.title.trim(),
                    titleBn: bannerForm.titleBn.trim(),
                    subtitle: bannerForm.subtitle.trim(),
                    badgeText: bannerForm.badgeText.trim(),
                    imageUrl: bannerForm.imageUrl.trim(),
                    linkUrl: bannerForm.linkUrl.trim() || '/products',
                    placement: bannerForm.placement,
                    sortOrder: Number(bannerForm.sortOrder),
                    isActive: bannerForm.isActive,
                  });
                  await refreshCatalog();
                  setBannerForm({
                    id: '',
                    title: '',
                    titleBn: '',
                    subtitle: '',
                    badgeText: 'FEATURED',
                    imageUrl: '',
                    linkUrl: '/products',
                    placement: 'hero',
                    sortOrder: banners.length + 1,
                    isActive: true,
                  });
                  showToast('Banner saved');
                } finally {
                  setBusyAction(false);
                }
              }}
              className="lg:col-span-5 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3"
            >
              <h2 className="font-headline text-base font-bold">{bannerForm.id ? 'Edit Banner' : 'Add Promotional Banner'}</h2>
              <input
                required
                placeholder="Banner Title"
                value={bannerForm.title}
                onChange={(e) => setBannerForm({...bannerForm, title: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <input
                placeholder="Subtitle"
                value={bannerForm.subtitle}
                onChange={(e) => setBannerForm({...bannerForm, subtitle: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <input
                required
                placeholder="Image URL (https://...)"
                value={bannerForm.imageUrl}
                onChange={(e) => setBannerForm({...bannerForm, imageUrl: e.target.value})}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={bannerForm.placement}
                  onChange={(e) => setBannerForm({...bannerForm, placement: e.target.value as 'hero' | 'promo' | 'flash_sale'})}
                  className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                >
                  <option value="hero">Hero Slider</option>
                  <option value="promo">Promo Strip</option>
                  <option value="flash_sale">Flash Sale</option>
                </select>
                <input
                  placeholder="Badge Text"
                  value={bannerForm.badgeText}
                  onChange={(e) => setBannerForm({...bannerForm, badgeText: e.target.value})}
                  className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
                />
              </div>
              <button type="submit" disabled={busyAction} className="py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
                Save Banner
              </button>
            </form>

            <div className="lg:col-span-7 flex flex-col gap-3">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0">
                      <ImageWithFallback src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{b.title}</p>
                      <p className="text-xs text-light-on-surface-variant uppercase">
                        {b.placement} · {b.isActive ? 'Active' : 'Hidden'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteAdminBanner(user, b.id);
                      await refreshCatalog();
                      showToast('Banner deleted');
                    }}
                    className="px-3 py-1 rounded-lg border border-light-outline-variant text-xs font-semibold text-light-error"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 10: FLASH SALES */}
        {activeTab === 'flash_sales' && (
          <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
            {products.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-light-on-surface-variant tabular-nums">
                    Regular: {formatBDT(p.regularPrice)} · Discounted: {formatBDT(p.discountedPrice || p.regularPrice)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleProductField(p, 'isFlashSale')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                    p.isFlashSale
                      ? 'bg-light-secondary dark:bg-dark-secondary text-light-on-secondary dark:text-dark-on-secondary'
                      : 'border border-light-outline-variant'
                  }`}
                >
                  {p.isFlashSale ? 'Active in Flash Sale' : 'Add to Flash Sale'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 11: REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
            {reviews.length === 0 ? (
              <p className="p-6 text-sm text-light-on-surface-variant">No customer reviews submitted yet.</p>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="max-w-xl">
                    <p className="text-sm font-semibold">
                      {rev.userName} · {rev.rating}/5 Stars
                    </p>
                    <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">{rev.comment}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await moderateReviewAdmin(user, rev.id, !rev.isApproved);
                      await loadWorkspace();
                      showToast(rev.isApproved ? 'Review hidden' : 'Review approved');
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold ${
                      rev.isApproved
                        ? 'bg-success/15 text-success'
                        : 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                    }`}
                  >
                    {rev.isApproved ? 'Approved (Click to Hide)' : 'Approve Review'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 12: RETURNS & REFUNDS */}
        {activeTab === 'returns' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
              {returnsList.length === 0 ? (
                <p className="p-6 text-sm text-light-on-surface-variant">No return requests submitted.</p>
              ) : (
                returnsList.map((ret) => {
                  const linkedOrder = orders.find((o) => o.id === ret.orderId);
                  const defaultAmt = refundDrafts[ret.id] ?? linkedOrder?.totalAmount ?? 0;
                  return (
                    <div key={ret.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono font-bold text-sm">{ret.orderNumber}</p>
                        <p className="text-xs text-light-on-surface-variant">
                          Status: <span className="uppercase font-semibold">{ret.status}</span> · Reason: {ret.reason}
                        </p>
                      </div>
                      {ret.status === 'requested' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={defaultAmt}
                            onChange={(e) => setRefundDrafts({...refundDrafts, [ret.id]: Number(e.target.value)})}
                            className="w-28 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await processReturnAndRefundAdmin(user, ret, 'approved', defaultAmt);
                              await loadWorkspace();
                              showToast('Return approved & refund recorded');
                            }}
                            className="px-3.5 py-1.5 rounded-full bg-light-primary text-light-on-primary text-xs font-semibold"
                          >
                            Approve & Refund
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await processReturnAndRefundAdmin(user, ret, 'rejected');
                              await loadWorkspace();
                              showToast('Return rejected');
                            }}
                            className="px-3.5 py-1.5 rounded-full border border-light-outline-variant text-xs font-semibold text-light-error"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {refunds.length > 0 && (
              <div className="rounded-2xl bg-light-surface-container-low dark:bg-dark-surface-container p-5">
                <h3 className="font-headline text-base font-bold mb-2">Processed Refunds ({refunds.length})</h3>
                <div className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant text-xs">
                  {refunds.map((rf) => (
                    <div key={rf.id} className="py-2 flex justify-between">
                      <span className="font-mono">{rf.orderId} · {rf.method}</span>
                      <span className="font-bold tabular-nums">{formatBDT(rf.amount)} ({rf.status})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 13: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!notifTitle.trim() || !notifBody.trim()) return;
                setBusyAction(true);
                try {
                  if (notifTarget === 'ALL') {
                    for (const c of customers) {
                      await sendAdminNotification(user, c.uid, notifTitle.trim(), notifBody.trim());
                    }
                  } else {
                    await sendAdminNotification(user, notifTarget, notifTitle.trim(), notifBody.trim());
                  }
                  setNotifTitle('');
                  setNotifBody('');
                  await loadWorkspace();
                  showToast('Notification dispatched');
                } finally {
                  setBusyAction(false);
                }
              }}
              className="lg:col-span-5 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3"
            >
              <h2 className="font-headline text-base font-bold">Send Customer Notification</h2>
              <select
                value={notifTarget}
                onChange={(e) => setNotifTarget(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              >
                <option value="ALL">Broadcast to All Customers ({customers.length})</option>
                {customers.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
              <input
                required
                placeholder="Notification Title"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <textarea
                required
                rows={3}
                placeholder="Message body..."
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                className="rounded-lg px-3 py-2 text-sm bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant"
              />
              <button type="submit" disabled={busyAction} className="py-2 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
                Send Notification
              </button>
            </form>

            <div className="lg:col-span-7 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
              {adminNotifications.slice(0, 12).map((n) => (
                <div key={n.id} className="p-4 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-xs text-light-on-surface-variant">{n.body}</p>
                  </div>
                  <span className="text-[11px] font-mono shrink-0">{n.type || 'alert'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 14: SHIPPING SETTINGS */}
        {activeTab === 'shipping' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction(true);
              try {
                await saveAdminSetting(user, 'shipping', shipDraft);
                await refreshCatalog();
                showToast('Shipping settings saved');
              } finally {
                setBusyAction(false);
              }
            }}
            className="max-w-2xl rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4"
          >
            <h2 className="font-headline text-lg font-bold">Bangladesh Delivery Charges & SLAs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Inside Dhaka Fee (৳)
                <input
                  type="number"
                  min={0}
                  value={shipDraft.dhakaFee}
                  onChange={(e) => setShipDraft({...shipDraft, dhakaFee: Number(e.target.value)})}
                  className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Outside Dhaka Fee (৳)
                <input
                  type="number"
                  min={0}
                  value={shipDraft.outsideDhakaFee}
                  onChange={(e) => setShipDraft({...shipDraft, outsideDhakaFee: Number(e.target.value)})}
                  className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Free Dhaka Delivery Threshold (৳)
                <input
                  type="number"
                  min={0}
                  value={shipDraft.freeDhakaThreshold}
                  onChange={(e) => setShipDraft({...shipDraft, freeDhakaThreshold: Number(e.target.value)})}
                  className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Dhaka Delivery Estimate
                <input
                  value={shipDraft.estimatedDhakaDays}
                  onChange={(e) => setShipDraft({...shipDraft, estimatedDhakaDays: e.target.value})}
                  className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
            </div>
            <button type="submit" disabled={busyAction} className="self-start px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
              Save Shipping Configuration
            </button>
          </form>
        )}

        {/* TAB 15: PAYMENT SETTINGS */}
        {activeTab === 'payments' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction(true);
              try {
                await saveAdminSetting(user, 'payments', payDraft);
                await refreshCatalog();
                showToast('Payment gateway preferences saved');
              } finally {
                setBusyAction(false);
              }
            }}
            className="max-w-2xl rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4"
          >
            <h2 className="font-headline text-lg font-bold">Payment Method</h2>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Only Cash on Delivery (COD) is active for SHIKDER SHOP orders across all 64 districts of Bangladesh.
            </p>
            <div className="flex flex-col gap-3 text-sm">
              <label className="flex items-center justify-between p-3.5 rounded-xl bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant">
                <span className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Cash on Delivery (COD)
                </span>
                <input
                  type="checkbox"
                  checked={payDraft.codEnabled}
                  onChange={(e) => setPayDraft({...payDraft, codEnabled: e.target.checked})}
                />
              </label>
            </div>
            <button type="submit" disabled={busyAction} className="self-start px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
              Save Payment Settings
            </button>
          </form>
        )}

        {/* TAB 16: WEBSITE & HOMEPAGE SETTINGS */}
        {activeTab === 'website' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction(true);
              try {
                await saveAdminSetting(user, 'website', webDraft);
                await refreshCatalog();
                showToast('Website & homepage sections saved');
              } finally {
                setBusyAction(false);
              }
            }}
            className="max-w-3xl rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4"
          >
            <h2 className="font-headline text-lg font-bold">Storefront & Homepage Section Controls</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Brand Name
                <input
                  value={webDraft.brandName}
                  onChange={(e) => setWebDraft({...webDraft, brandName: e.target.value})}
                  className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Support Phone
                <input
                  value={webDraft.supportPhone}
                  onChange={(e) => setWebDraft({...webDraft, supportPhone: e.target.value})}
                  className="rounded-lg px-3 py-2 text-sm font-mono font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
                Announcement Bar (English)
                <input
                  value={webDraft.announcementText}
                  onChange={(e) => setWebDraft({...webDraft, announcementText: e.target.value})}
                  className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
                Announcement Bar (বাংলা)
                <input
                  value={webDraft.announcementTextBn}
                  onChange={(e) => setWebDraft({...webDraft, announcementTextBn: e.target.value})}
                  className="rounded-lg px-3 py-2 text-sm font-normal bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-semibold pt-2">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={webDraft.showFlashSale} onChange={(e) => setWebDraft({...webDraft, showFlashSale: e.target.checked})} />
                Show Flash Sale
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={webDraft.showTrending} onChange={(e) => setWebDraft({...webDraft, showTrending: e.target.checked})} />
                Show Trending
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={webDraft.showBestSelling} onChange={(e) => setWebDraft({...webDraft, showBestSelling: e.target.checked})} />
                Show Best Selling
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={webDraft.showNewArrivals} onChange={(e) => setWebDraft({...webDraft, showNewArrivals: e.target.checked})} />
                Show New Arrivals
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={webDraft.showReviews} onChange={(e) => setWebDraft({...webDraft, showReviews: e.target.checked})} />
                Show Reviews
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={webDraft.showNewsletter} onChange={(e) => setWebDraft({...webDraft, showNewsletter: e.target.checked})} />
                Show Newsletter
              </label>
            </div>

            <button type="submit" disabled={busyAction} className="self-start px-6 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold">
              Save Website Settings
            </button>
          </form>
        )}

        {/* TAB 17: REPORTS & ADMIN AUDIT LOGS */}
        {activeTab === 'reports_logs' && (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-headline text-base font-bold">Storefront Reports & Export</h2>
                <p className="text-xs text-light-on-surface-variant">
                  Download live BDT revenue and fulfillment CSV records for accounting.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportOrdersCsv}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-xs font-semibold"
              >
                <Download className="w-4 h-4" /> Download Orders Report (CSV)
              </button>
            </div>

            <div className="rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3">
              <h2 className="font-headline text-base font-bold flex items-center gap-2">
                <Box className="w-4 h-4 text-light-primary" /> Immutable Admin Activity Logs ({logs.length})
              </h2>
              <div className="divide-y divide-light-outline-variant dark:divide-dark-outline-variant text-xs">
                {logs.length === 0 ? (
                  <p className="py-4 text-light-on-surface-variant">No admin activity logs recorded yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-light-primary dark:text-dark-primary">{log.action}</span>
                        <span className="mx-2 text-light-outline">·</span>
                        <span>{log.summary || `${log.targetCollection}/${log.targetId}`}</span>
                      </div>
                      <span className="text-light-on-surface-variant font-mono">
                        {log.adminEmail || log.adminUid} · {formatDhakaDateTime(log.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

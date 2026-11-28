import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {Loader2, MessageSquare, RotateCcw, Send, X} from 'lucide-react';
import {useStore} from '../context/StoreContext';
import {subscribeToUserOrders} from '../services/firestoreService';
import type {Order} from '../types/ecommerce';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hello! I can help you check product prices, stock, delivery charges, or the live status of your SHIKDER SHOP orders.',
};

const STARTER_PROMPTS = [
  'Check my latest order status',
  'Which products are in stock right now?',
  'What are Dhaka & outside Dhaka delivery charges?',
];

export const SupportChatWidget: React.FC = () => {
  const {user, authReady, products, categories, shippingSettings, websiteSettings, language} = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [userOrders, setUserOrders] = useState<Order[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!authReady || !user) {
      setUserOrders([]);
      return;
    }

    const unsub = subscribeToUserOrders(
      user.uid,
      (orders) => {
        setUserOrders(orders);
      },
      () => {
        setUserOrders([]);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
      inputRef.current?.focus();
    }
  }, [open, messages, sending]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const buildStoreContext = () => ({
    brandName: websiteSettings.brandName,
    supportEmail: websiteSettings.supportEmail,
    supportPhone: websiteSettings.supportPhone,
    whatsappNumber: websiteSettings.whatsappNumber,
    address: websiteSettings.address,
    language,
    shipping: {
      dhakaFee: shippingSettings.dhakaFee,
      outsideDhakaFee: shippingSettings.outsideDhakaFee,
      freeDhakaThreshold: shippingSettings.freeDhakaThreshold,
      estimatedDhakaDays: shippingSettings.estimatedDhakaDays,
      estimatedOutsideDays: shippingSettings.estimatedOutsideDays,
    },
    products: products
      .filter((p) => p.isActive)
      .slice(0, 50)
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        categoryName: categoryNameMap.get(p.categoryId) || 'General',
        regularPrice: p.regularPrice,
        discountedPrice: p.discountedPrice,
        stockQuantity: p.stockQuantity,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        shortDescription: p.shortDescription?.slice(0, 200),
      })),
    isAuthenticated: Boolean(user),
    orders: userOrders.slice(0, 15).map((o) => ({
      orderNumber: o.orderNumber,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      trackingCode: o.trackingCode,
      itemsSummary: o.items.map((i) => `${i.name} x${i.quantity}`).join(', ').slice(0, 280),
      updatedAt: String(o.updatedAt || o.createdAt || ''),
    })),
  });

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    setChatError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInput('');
    setSending(true);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome')
        .slice(-16)
        .map((m) => ({role: m.role, text: m.text}));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: apiMessages,
          storeContext: buildStoreContext(),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {reply?: string; error?: string};
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Unable to get an answer from the store assistant.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to reach assistant right now.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleReset = () => {
    setMessages([WELCOME_MESSAGE]);
    setChatError(null);
    setInput('');
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="SHIKDER SHOP Customer Support Chat"
          className="fixed bottom-32 md:bottom-22 right-4 left-4 sm:left-auto sm:w-96 max-h-[min(520px,calc(100vh-10rem))] z-50 rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant shadow-xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-between gap-2 bg-light-surface-container-low dark:bg-dark-surface-container">
            <div className="min-w-0">
              <h2 className="font-headline text-sm font-bold text-light-on-surface dark:text-dark-on-surface truncate">
                {websiteSettings.brandName} Support
              </h2>
              <p className="text-[11px] text-light-on-surface-variant dark:text-dark-on-surface-variant truncate">
                {user
                  ? `Products & live orders (${userOrders.length})`
                  : 'Products, delivery & order help'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset chat conversation"
                title="Clear conversation"
                className="p-2 rounded-lg text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container dark:hover:bg-dark-surface-container-high transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close support chat"
                className="p-2 rounded-lg text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container dark:hover:bg-dark-surface-container-high transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sign-in helper notice for guest order inquiries */}
          {!user && (
            <div className="px-4 py-2 bg-light-surface-container-low/70 dark:bg-dark-surface-container/70 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-between gap-2 text-[11px] text-light-on-surface-variant dark:text-dark-on-surface-variant">
              <span>Sign in to ask about your orders</span>
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="font-semibold text-light-primary dark:text-dark-primary hover:underline shrink-0"
              >
                Sign In
              </Link>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary'
                      : 'bg-light-surface-container-low dark:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface border border-light-outline-variant/60 dark:border-dark-outline-variant/60'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Quick questions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={sending}
                      onClick={() => sendMessage(prompt)}
                      className="text-left px-3 py-1.5 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container hover:bg-light-surface-container dark:hover:bg-dark-surface-container-high border border-light-outline-variant dark:border-dark-outline-variant text-[11px] font-medium text-light-on-surface dark:text-dark-on-surface transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2.5 bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant/60 dark:border-dark-outline-variant/60 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant inline-flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Checking store info...</span>
                </div>
              </div>
            )}

            {chatError && (
              <div
                role="alert"
                className="rounded-xl p-3 bg-light-error-container text-light-on-error-container text-xs flex flex-col gap-1.5"
              >
                <span>{chatError}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Composer */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-lowest dark:bg-dark-surface-container-low flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products or order status..."
              aria-label="Ask about products or order status"
              maxLength={1000}
              disabled={sending}
              className="flex-1 min-w-0 rounded-full px-3.5 py-2 text-xs bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="w-9 h-9 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary flex items-center justify-center shrink-0 disabled:opacity-50 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {/* Floating Launcher Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close store support chat' : 'Open store support chat'}
        aria-expanded={open}
        className="fixed bottom-16 md:bottom-6 right-4 z-40 h-12 px-4 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary shadow-lg hover:opacity-95 transition-opacity inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap"
      >
        {open ? <X className="w-4 h-4 shrink-0" /> : <MessageSquare className="w-4 h-4 shrink-0" />}
        <span>{open ? 'Close' : 'Ask Shop'}</span>
      </button>
    </>
  );
};

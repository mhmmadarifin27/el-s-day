import React, { useState, useEffect } from 'react';
import { 
  Coffee, Utensils, Cookie, IceCream, ShoppingCart, 
  ArrowLeft, Plus, Minus, FileText, CheckCircle2, 
  Clock, CreditCard, Sparkles, Upload, Trash2, Edit3, QrCode
} from 'lucide-react';
import { db } from '../services/db';
import type { MenuItem, Order } from '../services/db';

interface CustomerAppProps {
  tableFromUrl: string;
}

export const CustomerApp: React.FC<CustomerAppProps> = ({ tableFromUrl }) => {
  // Navigation State: 'welcome' | 'menu' | 'cart' | 'upload_proof' | 'status'
  const [view, setView] = useState<'welcome' | 'menu' | 'cart' | 'upload_proof' | 'status'>('welcome');
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState(tableFromUrl || '');
  
  // E-Menu State
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<'makanan' | 'minuman' | 'snack' | 'dessert'>('makanan');
  
  // Cart State: menuId -> quantity & notes
  const [cart, setCart] = useState<Record<string, { quantity: number; notes: string }>>({});
  
  // Checkout Details
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentProof, setPaymentProof] = useState<string>('');
  
  // Current Live Order
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  
  // Modal for editing Item Notes
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch menus initially and setup real-time sync
  useEffect(() => {
    db.getMenus().then(setMenus);
    
    // Listen for menu changes from Admin
    const unsubMenu = db.onMenuChange(() => {
      db.getMenus().then(setMenus);
    });

    // Listen for order status changes from Admin in real-time
    const unsubOrder = db.onOrderChange((event) => {
      if (currentOrder && event.type === 'ORDER_STATUS_CHANGED' && event.orderId === currentOrder.id) {
        // Fetch fresh orders list to update current order status
        db.getOrders().then(freshOrders => {
          const updated = freshOrders.find(o => o.id === currentOrder.id);
          if (updated) {
            setCurrentOrder(updated);
          
          // Confetti or Sound on completion
          if (event.status === 'completed') {
            import('canvas-confetti').then((confetti) => {
              confetti.default({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
              });
            });
            // Try playing a pleasant sound
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav');
              audio.volume = 0.3;
              audio.play();
            } catch (e) {
              console.log('Audio autoplay blocked', e);
            }
          }
        }
      });
    }
  });

    // Parse existing active order if stored in localStorage
    const savedActiveOrderId = localStorage.getItem('els_active_order_id');
    if (savedActiveOrderId) {
      db.getOrders().then(freshOrders => {
        const active = freshOrders.find(o => o.id === savedActiveOrderId);
        if (active && active.status !== 'completed' && active.status !== 'cancelled') {
          setCurrentOrder(active);
          setCustomerName(active.customer_name);
          setTableNumber(active.table_number);
          setView('status');
        }
      });
    }

    return () => {
      unsubMenu();
      unsubOrder();
    };
  }, [currentOrder?.id]);

  // E-Menu Category filter
  const filteredMenus = menus.filter(m => m.category === activeCategory);

  // Cart operations
  const addToCart = (menuId: string) => {
    setCart(prev => ({
      ...prev,
      [menuId]: {
        quantity: (prev[menuId]?.quantity || 0) + 1,
        notes: prev[menuId]?.notes || ''
      }
    }));
  };

  const removeFromCart = (menuId: string) => {
    if (!cart[menuId]) return;
    setCart(prev => {
      const updated = { ...prev };
      if (updated[menuId].quantity <= 1) {
        delete updated[menuId];
      } else {
        updated[menuId] = {
          ...updated[menuId],
          quantity: updated[menuId].quantity - 1
        };
      }
      return updated;
    });
  };

  const handleOpenNoteEditor = (menuId: string) => {
    setEditingNoteId(menuId);
    setTempNoteText(cart[menuId]?.notes || '');
  };

  const handleSaveNote = () => {
    if (editingNoteId) {
      setCart(prev => ({
        ...prev,
        [editingNoteId]: {
          ...prev[editingNoteId],
          notes: tempNoteText
        }
      }));
      setEditingNoteId(null);
    }
  };

  // Calculate pricing
  const getCartSummary = () => {
    let itemCount = 0;
    let subtotal = 0;
    Object.entries(cart).forEach(([menuId, item]) => {
      const menu = menus.find(m => m.id === menuId);
      if (menu) {
        itemCount += item.quantity;
        subtotal += menu.price * item.quantity;
      }
    });
    const tax = Math.round(subtotal * 0.1);
    const total = subtotal + tax;
    return { itemCount, subtotal, tax, total };
  };

  const { itemCount, subtotal, tax, total } = getCartSummary();

  // Create Order Action
  const handlePlaceOrder = async () => {
    if (paymentMethod === 'transfer') {
      setView('upload_proof');
    } else {
      // Cash Order
      setIsSubmitting(true);
      const cartItems = Object.entries(cart).map(([menuId, item]) => ({
        menuId,
        quantity: item.quantity,
        notes: item.notes
      }));
      
      const order = await db.createOrder(tableNumber, customerName, cartItems, 'cash');
      if (order) {
        setCurrentOrder(order);
        localStorage.setItem('els_active_order_id', order.id);
        setCart({});
        setView('status');
      }
      setIsSubmitting(false);
    }
  };

  // Upload proof simulation
  const handleUploadProofAndSubmit = async (mockSelect: boolean = false) => {
    setIsSubmitting(true);
    let proofBase64 = paymentProof;
    if (mockSelect || !proofBase64) {
      // Simulate receipt image
      proofBase64 = 'https://images.unsplash.com/photo-1616077168079-7e09a677fb2c?w=600&auto=format&fit=crop&q=80';
    }

    const cartItems = Object.entries(cart).map(([menuId, item]) => ({
      menuId,
      quantity: item.quantity,
      notes: item.notes
    }));
    
    const order = await db.createOrder(tableNumber, customerName, cartItems, 'transfer', proofBase64);
    if (order) {
      setCurrentOrder(order);
      localStorage.setItem('els_active_order_id', order.id);
      setCart({});
      setView('status');
    }
    setIsSubmitting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentProof(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear current active session (for demonstration or new orders)
  const handleStartNewOrder = () => {
    localStorage.removeItem('els_active_order_id');
    setCurrentOrder(null);
    setView('welcome');
  };

  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  return (
    <div className="mobile-container animate-fade">
      
      {/* 1. WELCOME / TABLE FORM PORTAL */}
      {view === 'welcome' && (
        <div style={styles.welcomePage}>
          <div style={styles.heroCenter}>
            <div style={styles.coffeeIconCircle}>
              {tableNumber ? <Coffee size={42} color="#5e454b" /> : <QrCode size={42} color="#5e454b" />}
            </div>
            <h1 style={styles.welcomeTitle}>{tableNumber ? 'Selamat Datang!' : 'Scan QR Code Meja'}</h1>
            <p style={styles.welcomeSubtitle}>
              {tableNumber ? "El's Day Café siap menemani hari Anda." : 'Silakan pindai QR Code di meja Anda untuk memulai pemesanan E-Menu.'}
            </p>
          </div>

          {!tableNumber ? (
            <div style={styles.welcomeCard} className="animate-slide-up">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
                <span style={{ fontSize: '3rem' }}>📸</span>
                <p style={{ fontSize: '0.9rem', color: '#5e454b', fontWeight: '700', textAlign: 'center', margin: 0 }}>
                  Fitur Pemesanan Terkunci
                </p>
                <p style={{ fontSize: '0.82rem', color: '#6b7280', textAlign: 'center', lineHeight: '1.5', margin: 0 }}>
                  Untuk memesan hidangan, silakan arahkan kamera HP Anda dan pindai stiker QR Code yang tertera di meja fisik Anda.
                </p>
              </div>
            </div>
          ) : (
            <div style={styles.welcomeCard} className="animate-slide-up">
              <div style={styles.tableBadge}>
                <Sparkles size={14} color="#5e454b" style={{ marginRight: '6px' }} />
                Meja {tableNumber}
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label" htmlFor="customer-name">Nama Pelanggan</label>
                <div className="input-icon-wrapper">
                  <input 
                    id="customer-name"
                    type="text" 
                    className="input-field input-field-with-icon" 
                    placeholder="Masukkan nama Anda..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <span className="input-icon">👤</span>
                </div>
              </div>

              <button 
                className={`btn btn-primary ${!customerName.trim() ? 'btn-disabled' : ''}`}
                style={{ width: '100%', marginTop: '8px' }}
                disabled={!customerName.trim()}
                onClick={() => setView('menu')}
              >
                Buka Menu
                <span style={{ fontSize: '1.2rem', marginLeft: '4px' }}>→</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. E-MENU INTERACTIVE PORTAL */}
      {view === 'menu' && (
        <div style={styles.flexColumn}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <h2 
                style={{ ...styles.brandTitle, cursor: 'pointer' }} 
                onClick={() => window.location.href = '/admin'}
                title="Buka Kasir/Admin Portal"
              >
                El's Day Café
              </h2>
              <span style={styles.welcomeGreeting}>Halo, {customerName}! (Meja {tableNumber})</span>
            </div>
            <div style={{ position: 'relative' }} onClick={() => itemCount > 0 && setView('cart')}>
              <div style={styles.cartIconCircle}>
                <ShoppingCart size={20} color="#5e454b" />
                {itemCount > 0 && <span style={styles.cartBadge}>{itemCount}</span>}
              </div>
            </div>
          </div>

          {/* Morning Promo Special Banner */}
          <div style={styles.promoBanner}>
            <div style={styles.promoOverlay}></div>
            <img 
              src="https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&auto=format&fit=crop&q=80" 
              alt="Morning special banner" 
              style={styles.promoImage} 
            />
            <div style={styles.promoContent}>
              <span style={styles.promoTag}>Pilihan Terbaik</span>
              <h3 style={styles.promoHeading}>Morning Special</h3>
              <p style={styles.promoText}>Nikmati diskon 10% untuk kopi & pastry segar setiap jam 8-11 Pagi!</p>
            </div>
          </div>

          {/* Category Section Header */}
          <div style={styles.sectionHeader}>
            <h3 style={{ textTransform: 'capitalize', fontWeight: '800', color: '#5e454b', fontSize: '1.4rem' }}>
              {activeCategory}
            </h3>
          </div>

          {/* Menu Card Feed Grid */}
          <div style={styles.menuScrollContainer}>
            <div style={styles.menuGrid}>
              {filteredMenus.map((menu) => {
                const cartQty = cart[menu.id]?.quantity || 0;
                return (
                  <div key={menu.id} style={styles.menuCard} className="animate-scale">
                    <div style={styles.imageWrapper}>
                      <img 
                        src={menu.image_url} 
                        alt={menu.name} 
                        style={{
                          ...styles.menuImg,
                          filter: !menu.is_available ? 'grayscale(0.8) blur(1.5px)' : 'none'
                        }} 
                      />
                      {!menu.is_available && (
                        <div style={styles.outOfStockBadge}>
                          Habis
                        </div>
                      )}
                    </div>
                    
                    <div style={styles.menuDetails}>
                      <h4 style={styles.menuName}>{menu.name}</h4>
                      <div style={styles.menuFooter}>
                        <span style={{ 
                          ...styles.menuPrice,
                          color: !menu.is_available ? '#9ca3af' : '#5e454b',
                          textDecoration: !menu.is_available ? 'line-through' : 'none'
                        }}>
                          {formatRupiah(menu.price)}
                        </span>
                        
                        {/* Interactive Plus/Minus controls */}
                        {menu.is_available ? (
                          <div style={styles.controlButtons}>
                            {cartQty > 0 ? (
                              <>
                                <button style={styles.qtyBtn} onClick={() => removeFromCart(menu.id)}>
                                  <Minus size={14} color="#5e454b" />
                                </button>
                                <span style={styles.qtyText}>{cartQty}</span>
                                <button style={styles.qtyBtn} onClick={() => addToCart(menu.id)}>
                                  <Plus size={14} color="#5e454b" />
                                </button>
                              </>
                            ) : (
                              <button style={styles.addCartBtn} onClick={() => addToCart(menu.id)}>
                                <Plus size={16} color="#ffffff" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button style={styles.disabledAddBtn} disabled>
                            <Plus size={16} color="#9ca3af" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Margin buffer for bottom menu bar */}
            <div style={{ height: '140px' }} />
          </div>

          {/* Sticky Bottom View Cart Bar */}
          {itemCount > 0 && (
            <div style={styles.stickyViewCartBar} className="animate-slide-up" onClick={() => setView('cart')}>
              <div style={styles.viewCartInfo}>
                <div style={styles.viewCartBadge}>{itemCount}</div>
                <span style={styles.viewCartText}>Tinjau Pesanan</span>
              </div>
              <span style={styles.viewCartTotal}>{formatRupiah(total)}</span>
            </div>
          )}

          {/* Bottom Tabs Navigation */}
          <div style={styles.bottomTabs}>
            <button 
              style={{ ...styles.tabButton, ...(activeCategory === 'makanan' ? styles.activeTab : {}) }} 
              onClick={() => setActiveCategory('makanan')}
            >
              <Utensils size={18} />
              <span style={styles.tabText}>Makanan</span>
            </button>
            <button 
              style={{ ...styles.tabButton, ...(activeCategory === 'minuman' ? styles.activeTab : {}) }} 
              onClick={() => setActiveCategory('minuman')}
            >
              <Coffee size={18} />
              <span style={styles.tabText}>Minuman</span>
            </button>
            <button 
              style={{ ...styles.tabButton, ...(activeCategory === 'snack' ? styles.activeTab : {}) }} 
              onClick={() => setActiveCategory('snack')}
            >
              <Cookie size={18} />
              <span style={styles.tabText}>Snack</span>
            </button>
            <button 
              style={{ ...styles.tabButton, ...(activeCategory === 'dessert' ? styles.activeTab : {}) }} 
              onClick={() => setActiveCategory('dessert')}
            >
              <IceCream size={18} />
              <span style={styles.tabText}>Dessert</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. CART & CHECKOUT PORTAL */}
      {view === 'cart' && (
        <div style={styles.flexColumn}>
          {/* Header */}
          <div style={styles.header}>
            <button style={styles.backBtn} onClick={() => setView('menu')}>
              <ArrowLeft size={20} color="#5e454b" />
            </button>
            <h2 style={styles.pageTitle}>Ringkasan Pesanan</h2>
            <div style={{ width: '20px' }}></div>
          </div>

          <div style={styles.cartContentScroll}>
            {/* Order Items list */}
            <div style={styles.cartSection}>
              <h3 style={styles.cartSectionTitle}>Detail Item</h3>
              
              {Object.entries(cart).map(([menuId, cartItem]) => {
                const menu = menus.find(m => m.id === menuId);
                if (!menu) return null;
                return (
                  <div key={menuId} style={styles.cartItemCard}>
                    <img src={menu.image_url} alt={menu.name} style={styles.cartItemImg} />
                    <div style={styles.cartItemDetails}>
                      <h4 style={styles.cartItemName}>{menu.name}</h4>
                      <p style={styles.cartItemPrice}>{formatRupiah(menu.price * cartItem.quantity)}</p>
                      
                      {/* Notes indicator */}
                      <div 
                        style={styles.cartItemNotesRow} 
                        onClick={() => handleOpenNoteEditor(menuId)}
                      >
                        <Edit3 size={12} style={{ marginRight: '4px' }} />
                        <span style={styles.cartItemNotesText}>
                          {cartItem.notes ? `"${cartItem.notes}"` : 'Tambah catatan khusus...'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Cart counter */}
                    <div style={styles.cartItemCountControls}>
                      <button style={styles.qtyBtnMini} onClick={() => removeFromCart(menuId)}>
                        <Minus size={12} color="#5e454b" />
                      </button>
                      <span style={styles.qtyTextMini}>{cartItem.quantity}</span>
                      <button style={styles.qtyBtnMini} onClick={() => addToCart(menuId)}>
                        <Plus size={12} color="#5e454b" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Price Calculations */}
            <div style={styles.cartSection}>
              <div style={styles.pricingCard}>
                <div style={styles.pricingRow}>
                  <span>Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                <div style={styles.pricingRow}>
                  <span>Pajak (10%)</span>
                  <span>{formatRupiah(tax)}</span>
                </div>
                <hr style={styles.divider} />
                <div style={{ ...styles.pricingRow, fontWeight: '800', fontSize: '1.2rem', color: '#5e454b' }}>
                  <span>Total Tagihan</span>
                  <span>{formatRupiah(total)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={styles.cartSection}>
              <h3 style={styles.cartSectionTitle}>Metode Pembayaran</h3>
              <div style={styles.paymentSelectionGrid}>
                <button 
                  style={{
                    ...styles.paymentOptionCard,
                    ...(paymentMethod === 'cash' ? styles.paymentOptionActive : {})
                  }}
                  onClick={() => setPaymentMethod('cash')}
                >
                  <CreditCard size={20} color={paymentMethod === 'cash' ? '#5e454b' : '#6b7280'} />
                  <span style={styles.paymentOptionText}>Tunai di Kasir</span>
                </button>

                <button 
                  style={{
                    ...styles.paymentOptionCard,
                    ...(paymentMethod === 'transfer' ? styles.paymentOptionActive : {})
                  }}
                  onClick={() => setPaymentMethod('transfer')}
                >
                  <FileText size={20} color={paymentMethod === 'transfer' ? '#5e454b' : '#6b7280'} />
                  <span style={styles.paymentOptionText}>Transfer Bank</span>
                </button>
              </div>

              {paymentMethod === 'cash' && (
                <div style={styles.paymentHelpAlert}>
                  💡 <strong>Instruksi Tunai:</strong> Setelah memesan, silakan tunjukkan nomor meja/nama Anda ke kasir untuk melakukan pembayaran sebelum pesanan diproses dapur.
                </div>
              )}
            </div>

            <div style={{ height: '120px' }} />
          </div>

          {/* Bottom Sticky CTA Button */}
          <div style={styles.stickyBottomCheckoutBar}>
            <button 
              style={{ ...styles.btn, ...styles.btnPrimary, width: '100%', opacity: isSubmitting ? 0.7 : 1 }} 
              disabled={isSubmitting} 
              onClick={handlePlaceOrder}
            >
              {isSubmitting ? 'Memproses...' : 'Pesan Sekarang'}
            </button>
          </div>
        </div>
      )}

      {/* 4. MANUAL TRANSFER RECEIPT PORTAL */}
      {view === 'upload_proof' && (
        <div style={styles.flexColumn}>
          {/* Header */}
          <div style={styles.header}>
            <button style={styles.backBtn} onClick={() => setView('cart')}>
              <ArrowLeft size={20} color="#5e454b" />
            </button>
            <h2 style={styles.pageTitle}>Bukti Transfer</h2>
            <div style={{ width: '20px' }}></div>
          </div>

          <div style={styles.cartContentScroll}>
            <div style={styles.uploadCard} className="animate-scale">
              <h3 style={styles.uploadCardTitle}>Transfer Bank Mandiri</h3>
              <p style={styles.bankDetailNumber}>142-00-1234567-8</p>
              <p style={styles.bankDetailHolder}>a.n. El's Day Café</p>
              
              <div style={styles.uploadSummaryBox}>
                <span>Total Bayar:</span>
                <strong style={{ fontSize: '1.25rem' }}>{formatRupiah(total)}</strong>
              </div>
            </div>

            <div style={styles.cartSection}>
              <h3 style={styles.cartSectionTitle}>Unggah Resi Bukti Bayar</h3>
              
              <div style={styles.uploaderBox}>
                <Upload size={32} color="#fad2e1" style={{ marginBottom: '12px' }} />
                
                {paymentProof ? (
                  <div style={styles.uploadedImagePreviewContainer}>
                    <img src={paymentProof} alt="Uploaded Proof Preview" style={styles.receiptPreviewImg} />
                    <button 
                      style={styles.deleteProofBtn} 
                      onClick={() => setPaymentProof('')}
                    >
                      <Trash2 size={14} color="#ffffff" />
                      Hapus
                    </button>
                  </div>
                ) : (
                  <>
                    <p style={styles.uploaderPlaceholderText}>Ketuk untuk memilih foto atau ambil gambar</p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={styles.hiddenFileInput} 
                      onChange={handleFileChange}
                    />
                  </>
                )}
              </div>

              {/* Simulation Helper */}
              <div style={styles.simulationHelperCard}>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>✨ Mode Demonstrasi / Simulasi</div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '8px' }}>
                  Tidak punya foto struk transfer sekarang? Klik tombol di bawah untuk membuat bukti simulasi otomatis.
                </p>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '8px' }}
                  onClick={() => handleUploadProofAndSubmit(true)}
                >
                  Gunakan Struk Simulasi
                </button>
              </div>
            </div>

            <div style={{ height: '120px' }} />
          </div>

          <div style={styles.stickyBottomCheckoutBar}>
            <button 
              className={`btn btn-primary ${(!paymentProof || isSubmitting) ? 'btn-disabled' : ''}`}
              style={{ width: '100%', opacity: isSubmitting ? 0.7 : 1 }}
              disabled={!paymentProof || isSubmitting}
              onClick={() => handleUploadProofAndSubmit(false)}
            >
              {isSubmitting ? 'Mengunggah...' : 'Kirim Bukti Transfer'}
            </button>
          </div>
        </div>
      )}

      {/* 5. ORDER STATUS PORTAL (REAL-TIME PROGRESS STEPPER) */}
      {view === 'status' && currentOrder && (
        <div style={styles.flexColumn}>
          {/* Header */}
          <div style={styles.header}>
            <h2 
              style={{ ...styles.brandTitle, cursor: 'pointer' }} 
              onClick={() => window.location.href = '/admin'}
              title="Buka Kasir/Admin Portal"
            >
              El's Day Café
            </h2>
            <button style={styles.newOrderBtn} onClick={handleStartNewOrder}>
              Pesan Baru
            </button>
          </div>

          <div style={styles.statusMainScroll}>
            <div style={styles.statusIntroCard} className="animate-scale">
              <h3 style={styles.statusIntroHeading}>Status Pesanan</h3>
              <p style={styles.statusIntroCustomer}>Halo, <strong>{currentOrder.customer_name}</strong>!</p>
              
              <div style={styles.statusFlexDetails}>
                <div style={styles.statusDetailBadge}>Meja {currentOrder.table_number}</div>
                <div style={styles.statusDetailBadge}>ID: {currentOrder.id}</div>
              </div>
            </div>

            {/* Progress Stepper Visualizer */}
            <div style={styles.stepperContainer}>
              {/* STEP 1: Pembayaran */}
              <div style={styles.stepItem}>
                <div style={{
                  ...styles.stepIndicator,
                  ...(currentOrder.status !== 'waiting_payment' && currentOrder.status !== 'checking_payment' 
                      ? styles.stepCompleted 
                      : styles.stepActive)
                }}>
                  {currentOrder.status !== 'waiting_payment' && currentOrder.status !== 'checking_payment' ? (
                    <CheckCircle2 size={20} color="#ffffff" />
                  ) : (
                    <Clock size={20} color="#5e454b" className="animate-pulse-soft" />
                  )}
                </div>
                
                <div style={styles.stepTextContainer}>
                  <h4 style={styles.stepTitle}>
                    {currentOrder.payment_method === 'cash' ? 'Menunggu Pembayaran' : 'Verifikasi Bukti'}
                  </h4>
                  <p style={styles.stepDesc}>
                    {currentOrder.status === 'waiting_payment' && 'Harap selesaikan pembayaran di meja kasir.'}
                    {currentOrder.status === 'checking_payment' && 'Kasir sedang memverifikasi struk transfer Anda.'}
                    {currentOrder.status !== 'waiting_payment' && currentOrder.status !== 'checking_payment' && 'Pembayaran Berhasil Dikonfirmasi.'}
                  </p>
                </div>
              </div>

              {/* Line Connector 1 */}
              <div style={{
                ...styles.stepConnector,
                ...(currentOrder.status === 'paid' || currentOrder.status === 'completed' ? styles.stepConnectorCompleted : {})
              }}></div>

              {/* STEP 2: Dimasak */}
              <div style={styles.stepItem}>
                <div style={{
                  ...styles.stepIndicator,
                  ...(currentOrder.status === 'completed' 
                      ? styles.stepCompleted 
                      : (currentOrder.status === 'paid' ? styles.stepActive : styles.stepInactive))
                }}>
                  {currentOrder.status === 'completed' ? (
                    <CheckCircle2 size={20} color="#ffffff" />
                  ) : (
                    <Utensils size={20} color={currentOrder.status === 'paid' ? '#5e454b' : '#9ca3af'} 
                      className={currentOrder.status === 'paid' ? 'animate-pulse-soft' : ''} 
                    />
                  )}
                </div>
                
                <div style={styles.stepTextContainer}>
                  <h4 style={{ 
                    ...styles.stepTitle, 
                    color: currentOrder.status === 'paid' || currentOrder.status === 'completed' ? '#5e454b' : '#9ca3af' 
                  }}>
                    Sedang Dimasak
                  </h4>
                  <p style={styles.stepDesc}>
                    {currentOrder.status === 'paid' && 'Pesanan telah dikirim ke dapur. Sedang disiapkan dengan cinta.'}
                    {currentOrder.status === 'completed' && 'Pesanan selesai dimasak dan disajikan.'}
                    {currentOrder.status !== 'paid' && currentOrder.status !== 'completed' && 'Menunggu konfirmasi pembayaran selesai.'}
                  </p>
                </div>
              </div>

              {/* Line Connector 2 */}
              <div style={{
                ...styles.stepConnector,
                ...(currentOrder.status === 'completed' ? styles.stepConnectorCompleted : {})
              }}></div>

              {/* STEP 3: Selesai */}
              <div style={styles.stepItem}>
                <div style={{
                  ...styles.stepIndicator,
                  ...(currentOrder.status === 'completed' ? styles.stepCompleted : styles.stepInactive)
                }}>
                  <Sparkles size={20} color={currentOrder.status === 'completed' ? '#ffffff' : '#9ca3af'} />
                </div>
                
                <div style={styles.stepTextContainer}>
                  <h4 style={{ 
                    ...styles.stepTitle, 
                    color: currentOrder.status === 'completed' ? '#5e454b' : '#9ca3af' 
                  }}>
                    Pesanan Selesai
                  </h4>
                  <p style={styles.stepDesc}>
                    {currentOrder.status === 'completed' && 'Pesanan telah disajikan di meja Anda! Selamat menikmati hidangan.'}
                    {currentOrder.status !== 'completed' && 'Makanan akan diantar setelah dimasak.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Cancelled State indicator */}
            {currentOrder.status === 'cancelled' && (
              <div style={styles.cancelledNotification} className="animate-scale">
                ❌ <strong>Pesanan Dibatalkan:</strong> Maaf, pesanan Anda dibatalkan oleh kasir (Kemungkinan karena bahan baku habis atau bukti transfer tidak valid). Silakan hubungi kasir.
              </div>
            )}

            {/* Order Items summary dropdown */}
            <div style={styles.statusItemsSummaryCard}>
              <h4 style={styles.statusItemsSummaryHeading}>Ringkasan Hidangan</h4>
              {currentOrder.items?.map((item) => (
                <div key={item.id} style={styles.statusItemRow}>
                  <span>{item.quantity}x {item.menu_name}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {item.notes ? `(${item.notes})` : ''}
                  </span>
                </div>
              ))}
              <hr style={{ border: 'none', borderBottom: '1px dashed #e5e7eb', margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                <span>Total Harga:</span>
                <span>{formatRupiah(currentOrder.total_price)}</span>
              </div>
            </div>
          </div>
          
          <div style={styles.stickyBottomCheckoutBar}>
            <button 
              className="btn btn-outline" 
              style={{ width: '100%', border: '1.5px solid #5e454b' }}
              onClick={() => {
                // Refresh status manual
                db.getOrders().then(freshOrders => {
                  const fresh = freshOrders.find(o => o.id === currentOrder.id);
                  if (fresh) setCurrentOrder(fresh);
                });
              }}
            >
              Perbarui Status
            </button>
          </div>
        </div>
      )}

      {/* 6. EDITING NOTE OVERLAY POPUP */}
      {editingNoteId && (
        <div style={styles.notesModalBackdrop} onClick={() => setEditingNoteId(null)}>
          <div style={styles.notesModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.notesModalHeader}>
              <h3 style={{ fontWeight: '700', color: '#5e454b' }}>Catatan Khusus</h3>
              <button style={styles.closeNotesBtn} onClick={() => setEditingNoteId(null)}>×</button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '10px' }}>
                Masukkan catatan khusus untuk menu ini (contoh: "Es batu dikit aja", "Minta sendok 2", dll.)
              </p>
              <textarea 
                className="input-field" 
                rows={3}
                style={{ resize: 'none', borderRadius: '12px' }}
                placeholder="Minta es dikit aja..."
                value={tempNoteText}
                onChange={(e) => setTempNoteText(e.target.value)}
              />
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '16px', borderRadius: '12px' }}
                onClick={handleSaveNote}
              >
                Simpan Catatan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Premium Styles representing high fidelity mobile screen mockups
const styles: Record<string, React.CSSProperties> = {
  flexColumn: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100%'
  },
  welcomePage: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '30px',
    height: '100vh',
    backgroundColor: '#fffcfb',
    background: 'radial-gradient(circle at top right, #ffeef2 0%, #fffcfb 100%)',
    textAlign: 'center'
  },
  heroCenter: {
    marginBottom: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  coffeeIconCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '28px',
    backgroundColor: '#fad2e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(250, 210, 225, 0.5)',
    marginBottom: '24px'
  },
  welcomeTitle: {
    fontSize: '2.25rem',
    fontWeight: '800',
    color: '#5e454b',
    letterSpacing: '-0.75px',
    marginBottom: '8px'
  },
  welcomeSubtitle: {
    color: '#6b7280',
    fontSize: '1rem',
    fontWeight: '500'
  },
  welcomeCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 10px 30px rgba(94, 69, 75, 0.04)',
    border: '1px solid rgba(250, 210, 225, 0.2)'
  },
  tableBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#ffeef2',
    color: '#5e454b',
    padding: '8px 16px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: '700',
    border: '1px solid #fad2e1'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    backgroundColor: 'rgba(252, 248, 247, 0.8)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    borderBottom: '1px solid #f3e9e7'
  },
  brandTitle: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#5e454b',
    letterSpacing: '-0.5px'
  },
  welcomeGreeting: {
    fontSize: '0.8rem',
    color: '#6b7280',
    fontWeight: '500'
  },
  cartIconCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(94, 69, 75, 0.04)',
    border: '1.5px solid #f3f4f6',
    cursor: 'pointer'
  },
  cartBadge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '0.7rem',
    fontWeight: '700',
    borderRadius: '999px',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)'
  },
  promoBanner: {
    margin: '0 24px 20px',
    height: '160px',
    borderRadius: '20px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: '0 8px 20px rgba(94, 69, 75, 0.08)'
  },
  promoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to top, rgba(94, 69, 75, 0.85) 0%, rgba(94, 69, 75, 0.2) 100%)',
    zIndex: 1
  },
  promoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  promoContent: {
    position: 'absolute',
    bottom: '16px',
    left: '16px',
    right: '16px',
    zIndex: 2,
    color: '#ffffff'
  },
  promoTag: {
    display: 'inline-block',
    backgroundColor: '#fad2e1',
    color: '#5e454b',
    fontSize: '0.65rem',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '6px',
    marginBottom: '6px',
    textTransform: 'uppercase'
  },
  promoHeading: {
    fontSize: '1.25rem',
    fontWeight: '800',
    marginBottom: '2px',
    textShadow: '0 1px 3px rgba(0,0,0,0.2)'
  },
  promoText: {
    fontSize: '0.75rem',
    opacity: 0.9,
    lineHeight: '1.2'
  },
  sectionHeader: {
    padding: '0 24px',
    marginBottom: '14px'
  },
  menuScrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 24px'
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px'
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(94, 69, 75, 0.03)',
    border: '1.5px solid #fcf8f7',
    display: 'flex',
    flexDirection: 'column',
    height: '240px'
  },
  imageWrapper: {
    position: 'relative',
    height: '130px',
    width: '100%',
    backgroundColor: '#f3f4f6',
    overflow: 'hidden'
  },
  menuImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.3s ease'
  },
  outOfStockBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#ffeef2',
    color: '#ef4444',
    padding: '4px 12px',
    borderRadius: '8px',
    fontSize: '0.75rem',
    fontWeight: '800',
    boxShadow: '0 4px 10px rgba(239, 68, 68, 0.1)',
    border: '1px solid #fad2e1',
    zIndex: 5
  },
  menuDetails: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flex: 1
  },
  menuName: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#5e454b',
    lineHeight: '1.2',
    height: '2.4em',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  menuFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '6px'
  },
  menuPrice: {
    fontSize: '0.85rem',
    fontWeight: '800'
  },
  controlButtons: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffeef2',
    borderRadius: '10px',
    padding: '2px',
    border: '1px solid #fad2e1'
  },
  qtyBtn: {
    background: 'none',
    border: 'none',
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  qtyText: {
    fontSize: '0.8rem',
    fontWeight: '700',
    width: '16px',
    textAlign: 'center',
    color: '#5e454b'
  },
  addCartBtn: {
    backgroundColor: '#fad2e1',
    border: 'none',
    width: '28px',
    height: '28px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(250, 210, 225, 0.4)',
    transition: 'all 0.15s ease'
  },
  disabledAddBtn: {
    backgroundColor: '#e5e7eb',
    border: 'none',
    width: '28px',
    height: '28px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'not-allowed'
  },
  stickyViewCartBar: {
    position: 'absolute',
    bottom: '90px',
    left: '24px',
    right: '24px',
    backgroundColor: '#5e454b',
    color: '#ffffff',
    borderRadius: '18px',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 8px 24px rgba(94, 69, 75, 0.3)',
    cursor: 'pointer',
    zIndex: 90
  },
  viewCartInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  viewCartBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.85rem'
  },
  viewCartText: {
    fontWeight: '700',
    fontSize: '0.95rem'
  },
  viewCartTotal: {
    fontWeight: '800',
    fontSize: '1rem',
    color: '#fad2e1'
  },
  bottomTabs: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '76px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #f3e9e7',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: '8px',
    zIndex: 99
  },
  tabButton: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '6px 12px',
    borderRadius: '16px',
    transition: 'all 0.15s ease'
  },
  activeTab: {
    backgroundColor: '#ffeef2',
    color: '#5e454b'
  },
  tabText: {
    fontSize: '0.7rem',
    fontWeight: '700'
  },
  // Cart styles
  backBtn: {
    background: 'none',
    cursor: 'pointer',
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(94, 69, 75, 0.03)',
    border: '1.5px solid #f3f4f6'
  },
  pageTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#5e454b'
  },
  cartContentScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px'
  },
  cartSection: {
    marginBottom: '24px'
  },
  cartSectionTitle: {
    fontSize: '1.05rem',
    fontWeight: '800',
    color: '#5e454b',
    marginBottom: '12px'
  },
  cartItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: '18px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 4px 12px rgba(94, 69, 75, 0.02)',
    border: '1px solid #fcf8f7',
    marginBottom: '12px'
  },
  cartItemImg: {
    width: '64px',
    height: '64px',
    objectFit: 'cover',
    borderRadius: '12px'
  },
  cartItemDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  cartItemName: {
    fontSize: '0.9rem',
    fontWeight: '700',
    color: '#5e454b',
    marginBottom: '2px'
  },
  cartItemPrice: {
    fontSize: '0.85rem',
    fontWeight: '800',
    color: '#5e454b'
  },
  cartItemNotesRow: {
    display: 'inline-flex',
    alignItems: 'center',
    color: '#9ca3af',
    fontSize: '0.72rem',
    marginTop: '4px',
    cursor: 'pointer',
    maxWidth: '180px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  cartItemNotesText: {
    textDecoration: 'underline'
  },
  cartItemCountControls: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: '10px',
    padding: '2px',
    border: '1.5px solid #e5e7eb'
  },
  qtyBtnMini: {
    background: 'none',
    border: 'none',
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  qtyTextMini: {
    fontSize: '0.75rem',
    fontWeight: '700',
    width: '14px',
    textAlign: 'center',
    color: '#5e454b'
  },
  pricingCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(94, 69, 75, 0.02)',
    border: '1px solid #fcf8f7'
  },
  pricingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '8px'
  },
  divider: {
    border: 'none',
    borderBottom: '1px solid #f3f4f6',
    margin: '12px 0'
  },
  paymentSelectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  paymentOptionCard: {
    backgroundColor: '#ffffff',
    border: '1.5px solid #e5e7eb',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  paymentOptionActive: {
    borderColor: '#fad2e1',
    backgroundColor: '#ffeef2',
    boxShadow: '0 4px 12px rgba(250, 210, 225, 0.3)'
  },
  paymentOptionText: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#5e454b'
  },
  paymentHelpAlert: {
    backgroundColor: '#fffdf5',
    border: '1px solid #fef3c7',
    color: '#b45309',
    borderRadius: '12px',
    padding: '12px',
    fontSize: '0.78rem',
    marginTop: '12px',
    lineHeight: '1.4'
  },
  stickyBottomCheckoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: '16px 24px 24px',
    borderTop: '1px solid #f3e9e7',
    boxShadow: '0 -4px 16px rgba(94, 69, 75, 0.02)',
    zIndex: 99
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px 28px',
    borderRadius: '999px',
    fontWeight: '800',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    border: 'none',
    textAlign: 'center'
  },
  btnPrimary: {
    backgroundColor: '#fad2e1',
    color: '#5e454b',
    boxShadow: '0 4px 12px rgba(250, 210, 225, 0.4)'
  },
  // Receipt upload page
  uploadCard: {
    backgroundColor: '#5e454b',
    color: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(94, 69, 75, 0.15)',
    marginBottom: '20px'
  },
  uploadCardTitle: {
    fontSize: '0.8rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#fad2e1',
    letterSpacing: '1px',
    marginBottom: '8px'
  },
  bankDetailNumber: {
    fontSize: '1.6rem',
    fontWeight: '800',
    marginBottom: '2px'
  },
  bankDetailHolder: {
    fontSize: '0.9rem',
    opacity: 0.8
  },
  uploadSummaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '16px',
    fontSize: '0.85rem'
  },
  uploaderBox: {
    border: '2px dashed #fad2e1',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '30px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '160px'
  },
  hiddenFileInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer'
  },
  uploaderPlaceholderText: {
    fontSize: '0.8rem',
    fontWeight: '700',
    color: '#9ca3af',
    maxWidth: '200px'
  },
  uploadedImagePreviewContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '160px',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  receiptPreviewImg: {
    width: '100%',
    height: '140px',
    objectFit: 'cover'
  },
  deleteProofBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    border: 'none',
    color: '#ffffff',
    padding: '4px',
    fontSize: '0.7rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer'
  },
  simulationHelperCard: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#fdfbf7',
    border: '1px solid #fef3c7',
    borderRadius: '16px',
    fontSize: '0.8rem'
  },
  // Status page
  newOrderBtn: {
    background: 'none',
    border: '1.5px solid #5e454b',
    borderRadius: '12px',
    color: '#5e454b',
    fontWeight: '700',
    padding: '6px 14px',
    fontSize: '0.8rem',
    cursor: 'pointer'
  },
  statusMainScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px'
  },
  statusIntroCard: {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '20px',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(94, 69, 75, 0.02)',
    border: '1px solid #fcf8f7',
    marginBottom: '24px'
  },
  statusIntroHeading: {
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    color: '#9ca3af',
    letterSpacing: '1px',
    marginBottom: '4px'
  },
  statusIntroCustomer: {
    fontSize: '1.25rem',
    color: '#5e454b',
    marginBottom: '10px'
  },
  statusFlexDetails: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px'
  },
  statusDetailBadge: {
    backgroundColor: '#ffeef2',
    color: '#5e454b',
    padding: '4px 12px',
    borderRadius: '8px',
    fontSize: '0.75rem',
    fontWeight: '700',
    border: '1px solid #fad2e1'
  },
  stepperContainer: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    paddingLeft: '10px',
    marginBottom: '24px'
  },
  stepItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    position: 'relative',
    zIndex: 2
  },
  stepIndicator: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
    backgroundColor: '#ffffff',
    border: '2px solid #e5e7eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
  },
  stepActive: {
    backgroundColor: '#ffeef2',
    borderColor: '#fad2e1',
    boxShadow: '0 0 0 4px rgba(250, 210, 225, 0.4)'
  },
  stepCompleted: {
    backgroundColor: '#5e454b',
    borderColor: '#5e454b',
    boxShadow: '0 2px 8px rgba(94, 69, 75, 0.2)'
  },
  stepInactive: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb'
  },
  stepTextContainer: {
    flex: 1,
    paddingTop: '6px'
  },
  stepTitle: {
    fontSize: '0.95rem',
    fontWeight: '800',
    color: '#5e454b',
    marginBottom: '2px'
  },
  stepDesc: {
    fontSize: '0.76rem',
    color: '#6b7280',
    lineHeight: '1.3'
  },
  stepConnector: {
    width: '2px',
    height: '32px',
    backgroundColor: '#e5e7eb',
    marginLeft: '20px',
    zIndex: 1,
    transition: 'all 0.3s ease'
  },
  stepConnectorCompleted: {
    backgroundColor: '#5e454b'
  },
  cancelledNotification: {
    backgroundColor: '#ffeeeb',
    border: '1.5px solid #fad2e1',
    color: '#ef4444',
    padding: '16px',
    borderRadius: '16px',
    fontSize: '0.8rem',
    marginBottom: '20px',
    lineHeight: '1.4'
  },
  statusItemsSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(94, 69, 75, 0.02)',
    border: '1px solid #fcf8f7'
  },
  statusItemsSummaryHeading: {
    fontSize: '0.9rem',
    fontWeight: '800',
    color: '#5e454b',
    marginBottom: '10px'
  },
  statusItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.82rem',
    color: '#5e454b',
    marginBottom: '6px'
  },
  // Notes Modal styles
  notesModalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(94, 69, 75, 0.4)',
    backdropFilter: 'blur(4px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  notesModalContent: {
    width: '100%',
    maxWidth: '340px',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  notesModalHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeNotesBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.6rem',
    color: '#9ca3af',
    cursor: 'pointer',
    lineHeight: 1
  }
};

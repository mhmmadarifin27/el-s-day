import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, ShoppingBag, Coffee, 
  Plus, Edit2, Trash2, Check, X, 
  Eye, Bell, RefreshCw, Layers, QrCode
} from 'lucide-react';
import { db } from '../services/db';
import type { MenuItem, Order, OrderStatus, MenuCategory } from '../services/db';
import { Modal } from '../components/Modal';

export const AdminDashboard: React.FC = () => {
  // Navigation active tab: 'dashboard' | 'orders' | 'menus' | 'qr'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'menus' | 'qr'>('orders');
  
  // Real-time states
  const [orders, setOrders] = useState<Order[]>([]);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  
  // Audio notification state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  // Modals state
  const [receiptModalOrder, setReceiptModalOrder] = useState<Order | null>(null);
  
  // Menu form modal states
  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);
  const [menuFormName, setMenuFormName] = useState('');
  const [menuFormPrice, setMenuFormPrice] = useState(0);
  const [menuFormCategory, setMenuFormCategory] = useState<MenuCategory>('makanan');
  const [menuFormImage, setMenuFormImage] = useState('');

  // Initial load and real-time synchronization
  useEffect(() => {
    db.getOrders().then(setOrders);
    db.getMenus().then(setMenus);

    // Setup listener for order changes (real-time websocket simulation)
    const unsubOrder = db.onOrderChange((event) => {
      db.getOrders().then(setOrders);
      
      // Play a ringing chime when a new order arrives
      if (event.type === 'ORDERS_CHANGED') {
        setNewOrderAlert(true);
        if (soundEnabled) {
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-44.wav');
            audio.volume = 0.4;
            audio.play();
          } catch (e) {
            console.log('Audio notification blocked', e);
          }
        }
      }
    });

    // Setup listener for menu changes
    const unsubMenu = db.onMenuChange(() => {
      db.getMenus().then(setMenus);
    });

    return () => {
      unsubOrder();
      unsubMenu();
    };
  }, [soundEnabled]);

  const handleToggleMenuAvailability = async (menuId: string, currentVal: boolean) => {
    await db.updateMenuAvailability(menuId, !currentVal);
    db.getMenus().then(setMenus);
  };

  // Status transitions based on standard finite state machines
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    await db.updateOrderStatus(orderId, nextStatus);
    db.getOrders().then(setOrders);
  };

  // Calculate high level metrics
  const getMetrics = () => {
    // Revenue from completed or paid orders
    const totalRevenue = orders
      .filter(o => o.status === 'completed' || o.status === 'paid')
      .reduce((sum, o) => sum + o.total_price, 0);

    // Count active occupied tables
    const occupiedTables = new Set(
      orders
        .filter(o => o.status !== 'completed' && o.status !== 'cancelled')
        .map(o => o.table_number)
    ).size;

    // Active order queues
    const activeQueue = orders.filter(o => o.status === 'waiting_payment' || o.status === 'checking_payment' || o.status === 'paid').length;

    return { totalRevenue, occupiedTables, activeQueue };
  };

  const { totalRevenue, occupiedTables, activeQueue } = getMetrics();

  // Menu CRUD actions
  const handleOpenAddMenu = () => {
    setEditingMenu(null);
    setMenuFormName('');
    setMenuFormPrice(0);
    setMenuFormCategory('makanan');
    setMenuFormImage('');
    setMenuModalOpen(true);
  };

  const handleOpenEditMenu = (menu: MenuItem) => {
    setEditingMenu(menu);
    setMenuFormName(menu.name);
    setMenuFormPrice(menu.price);
    setMenuFormCategory(menu.category);
    setMenuFormImage(menu.image_url);
    setMenuModalOpen(true);
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuFormName.trim() || menuFormPrice <= 0) return;

    if (editingMenu) {
      await db.updateMenu(
        editingMenu.id,
        menuFormName,
        menuFormPrice,
        menuFormCategory,
        menuFormImage,
        editingMenu.is_available
      );
    } else {
      await db.addMenu(menuFormName, menuFormPrice, menuFormCategory, menuFormImage);
    }
    db.getMenus().then(setMenus);
    setMenuModalOpen(false);
  };

  const handleDeleteMenu = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus menu ini?')) {
      await db.deleteMenu(id);
      db.getMenus().then(setMenus);
    }
  };

  const formatRupiah = (num: number) => {
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  return (
    <div className="admin-layout animate-fade">
      {/* Sidebar Panel */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarBrand}>
          <div style={styles.sidebarBrandLogo}>☕</div>
          <div>
            <h2 style={styles.sidebarBrandName}>El's Admin</h2>
            <span style={styles.sidebarBrandRole}>Café Manager</span>
          </div>
        </div>

        <nav style={styles.navMenu}>
          <button 
            style={{ ...styles.navItem, ...(activeTab === 'dashboard' ? styles.navItemActive : {}) }}
            onClick={() => setActiveTab('dashboard')}
          >
            <TrendingUp size={18} />
            Dashboard
          </button>
          <button 
            style={{ 
              ...styles.navItem, 
              ...(activeTab === 'orders' ? styles.navItemActive : {}),
              position: 'relative'
            }}
            onClick={() => {
              setActiveTab('orders');
              setNewOrderAlert(false);
            }}
          >
            <Layers size={18} />
            Live Orders
            {newOrderAlert && <span style={styles.bellBadge}>•</span>}
          </button>
          <button 
            style={{ ...styles.navItem, ...(activeTab === 'menus' ? styles.navItemActive : {}) }}
            onClick={() => setActiveTab('menus')}
          >
            <Coffee size={18} />
            Menu Katalog
          </button>
          <button 
            style={{ ...styles.navItem, ...(activeTab === 'qr' ? styles.navItemActive : {}) }}
            onClick={() => setActiveTab('qr')}
          >
            <QrCode size={18} />
            Meja & QR Code
          </button>
        </nav>

        {/* Real-time Connection status indicator */}
        <div style={styles.connectionStatusCard}>
          <div style={styles.pulsingGreenDot}></div>
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>Koneksi Aktif</div>
            <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Sinkronisasi Real-Time</div>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main style={styles.mainContent}>
        
        {/* Header toolbar */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.headerTitle}>
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'orders' && 'Live Orders'}
              {activeTab === 'menus' && 'Menu Management'}
              {activeTab === 'qr' && 'Meja & QR Code Simulator'}
            </h1>
            <p style={styles.headerSub}>Selamat bertugas hari ini! Kelola dengan efisien.</p>
          </div>
          
          <div style={styles.headerToolbar}>
            <button 
              className="btn btn-outline"
              style={styles.soundToggleBtn}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <Bell size={16} color={soundEnabled ? '#10b981' : '#6b7280'} />
              {soundEnabled ? 'Notifikasi Bunyi ON' : 'Notifikasi Bunyi OFF'}
            </button>
          </div>
        </header>

        {/* --- VIEW 1: DASHBOARD PORTAL --- */}
        {activeTab === 'dashboard' && (
          <div style={styles.dashboardContainer} className="animate-fade">
            {/* Summary Metrics cards */}
            <div className="metrics-grid" style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <div style={{ ...styles.metricIconBox, backgroundColor: '#ecfdf5' }}>
                  <TrendingUp color="#10b981" size={24} />
                </div>
                <div>
                  <span style={styles.metricLabel}>Pendapatan Hari Ini</span>
                  <h3 style={styles.metricValue}>{formatRupiah(totalRevenue)}</h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={{ ...styles.metricIconBox, backgroundColor: '#ffeef2' }}>
                  <Users color="#5e454b" size={24} />
                </div>
                <div>
                  <span style={styles.metricLabel}>Meja Terisi</span>
                  <h3 style={styles.metricValue}>{occupiedTables} Meja</h3>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={{ ...styles.metricIconBox, backgroundColor: '#fef3c7' }}>
                  <ShoppingBag color="#f59e0b" size={24} />
                </div>
                <div>
                  <span style={styles.metricLabel}>Antrean Aktif</span>
                  <h3 style={styles.metricValue}>{activeQueue} Pesanan</h3>
                </div>
              </div>
            </div>

            {/* Sales Activity list table */}
            <div style={styles.tableSection}>
              <div style={styles.tableSectionHeader}>
                <h3 style={styles.tableSectionTitle}>Aktivitas Transaksi Terbaru</h3>
                <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => db.getOrders().then(setOrders)}>
                  <RefreshCw size={12} style={{ marginRight: '6px' }} /> Refres
                </button>
              </div>
              
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>ID Pesanan</th>
                      <th style={styles.th}>Waktu</th>
                      <th style={styles.th}>Meja</th>
                      <th style={styles.th}>Nama Pelanggan</th>
                      <th style={styles.th}>Total Harga</th>
                      <th style={styles.th}>Metode Bayar</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 10).map((order) => (
                      <tr key={order.id} style={styles.tableBodyRow}>
                        <td style={{ ...styles.td, fontWeight: '700' }}>{order.id}</td>
                        <td style={styles.td}>{new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={styles.td}>Meja {order.table_number}</td>
                        <td style={{ ...styles.td, fontWeight: '600' }}>{order.customer_name}</td>
                        <td style={styles.td}>{formatRupiah(order.total_price)}</td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.smallBadge,
                            backgroundColor: order.payment_method === 'cash' ? '#f3f4f6' : '#ffeef2',
                            color: '#5e454b'
                          }}>
                            {order.payment_method === 'cash' ? 'Cash' : 'Transfer'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.smallBadge,
                            ...(order.status === 'completed' ? { backgroundColor: '#ecfdf5', color: '#10b981' } : {}),
                            ...(order.status === 'paid' ? { backgroundColor: '#f0fdf4', color: '#15803d' } : {}),
                            ...(order.status === 'waiting_payment' ? { backgroundColor: '#fef3c7', color: '#d97706' } : {}),
                            ...(order.status === 'checking_payment' ? { backgroundColor: '#fff1f2', color: '#e11d48' } : {}),
                            ...(order.status === 'cancelled' ? { backgroundColor: '#f3f4f6', color: '#6b7280' } : {})
                          }}>
                            {order.status === 'completed' && 'Selesai'}
                            {order.status === 'paid' && 'Siap Dimasak'}
                            {order.status === 'waiting_payment' && 'Belum Bayar'}
                            {order.status === 'checking_payment' && 'Verifikasi Bukti'}
                            {order.status === 'cancelled' && 'Batal'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                          Belum ada transaksi hari ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 2: LIVE ORDERS PORTAL --- */}
        {activeTab === 'orders' && (
          <div style={styles.liveOrdersContainer} className="animate-fade">
            
            {/* Columns structure representing Kanban Lanes */}
            <div className="kanban-layout-grid" style={styles.kanbanLayoutGrid}>
              
              {/* Lane 1: Waiting Payment / Verify (Antrean Pembayaran) */}
              <div className="kanban-column" style={styles.kanbanColumn}>
                <div style={{ ...styles.kanbanColumnHeader, borderTop: '4px solid #ef4444' }}>
                  <h3 style={styles.kanbanColumnTitle}>Verifikasi Bayar</h3>
                  <span style={styles.kanbanColumnBadge}>
                    {orders.filter(o => o.status === 'waiting_payment' || o.status === 'checking_payment').length}
                  </span>
                </div>
                
                <div style={styles.kanbanCardList}>
                  {orders
                    .filter(o => o.status === 'waiting_payment' || o.status === 'checking_payment')
                    .map((order) => (
                      <div key={order.id} style={styles.orderCard} className="animate-slide-up">
                        <div style={styles.orderCardHeader}>
                          <span style={styles.orderCardTable}>MEJA {order.table_number}</span>
                          <span style={{
                            ...styles.smallBadge,
                            ...(order.status === 'checking_payment' 
                                ? { backgroundColor: '#ffeef2', color: '#e11d48' } 
                                : { backgroundColor: '#fef3c7', color: '#d97706' })
                          }}>
                            {order.status === 'checking_payment' ? 'Checking Proof' : 'Waiting Cash'}
                          </span>
                        </div>
                        
                        <h4 style={styles.orderCardCustomer}>{order.customer_name}</h4>
                        
                        <div style={styles.orderCardItemsList}>
                          {order.items?.map((item) => (
                            <div key={item.id} style={styles.orderCardItemRow}>
                              <span>{item.quantity}x {item.menu_name}</span>
                              {item.notes && <span style={styles.orderCardItemNote}>*{item.notes}</span>}
                            </div>
                          ))}
                        </div>

                        <hr style={styles.cardDivider} />

                        <div style={styles.orderCardFooter}>
                          <span>Total:</span>
                          <strong style={{ color: '#5e454b' }}>{formatRupiah(order.total_price)}</strong>
                        </div>

                        {/* Order specific CTAs */}
                        <div style={styles.orderCardActionsGrid}>
                          {order.status === 'checking_payment' ? (
                            <>
                              <button 
                                className="btn btn-espresso" 
                                style={{ ...styles.actionBtnCard, flex: 1 }}
                                onClick={() => setReceiptModalOrder(order)}
                              >
                                <Eye size={12} />
                                Lihat Bukti
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                className="btn btn-espresso" 
                                style={{ ...styles.actionBtnCard, flex: 1 }}
                                onClick={() => handleUpdateStatus(order.id, 'paid')}
                              >
                                <Check size={12} />
                                Konfirmasi Cash
                              </button>
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '8px', borderRadius: '10px' }}
                                onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                                title="Batalkan"
                              >
                                <X size={12} color="#ef4444" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  {orders.filter(o => o.status === 'waiting_payment' || o.status === 'checking_payment').length === 0 && (
                    <div style={styles.kanbanColumnEmptyState}>Tidak ada antrean pembayaran</div>
                  )}
                </div>
              </div>

              {/* Lane 2: Cooking Queue (Sedang Dimasak) */}
              <div className="kanban-column" style={styles.kanbanColumn}>
                <div style={{ ...styles.kanbanColumnHeader, borderTop: '4px solid #f59e0b' }}>
                  <h3 style={styles.kanbanColumnTitle}>Sedang Dimasak</h3>
                  <span style={styles.kanbanColumnBadge}>
                    {orders.filter(o => o.status === 'paid').length}
                  </span>
                </div>
                
                <div style={styles.kanbanCardList}>
                  {orders
                    .filter(o => o.status === 'paid')
                    .map((order) => (
                      <div key={order.id} style={styles.orderCard} className="animate-slide-up">
                        <div style={styles.orderCardHeader}>
                          <span style={styles.orderCardTable}>MEJA {order.table_number}</span>
                          <span style={{ ...styles.smallBadge, backgroundColor: '#f0fdf4', color: '#15803d' }}>
                            Siap Dimasak
                          </span>
                        </div>
                        
                        <h4 style={styles.orderCardCustomer}>{order.customer_name}</h4>
                        
                        <div style={styles.orderCardItemsList}>
                          {order.items?.map((item) => (
                            <div key={item.id} style={styles.orderCardItemRow}>
                              <span>{item.quantity}x {item.menu_name}</span>
                              {item.notes && <span style={styles.orderCardItemNote}>*{item.notes}</span>}
                            </div>
                          ))}
                        </div>

                        <hr style={styles.cardDivider} />

                        <div style={styles.orderCardFooter}>
                          <span>Total:</span>
                          <strong>{formatRupiah(order.total_price)}</strong>
                        </div>

                        <div style={styles.orderCardActionsGrid}>
                          <button 
                            className="btn btn-espresso" 
                            style={{ ...styles.actionBtnCard, flex: 1, backgroundColor: '#5e454b' }}
                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                          >
                            <Check size={12} />
                            Sajikan / Selesai
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '8px', borderRadius: '10px' }}
                            onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                            title="Batalkan"
                          >
                            <X size={12} color="#ef4444" />
                          </button>
                        </div>
                      </div>
                    ))}
                  {orders.filter(o => o.status === 'paid').length === 0 && (
                    <div style={styles.kanbanColumnEmptyState}>Tidak ada antrean dapur</div>
                  )}
                </div>
              </div>

              {/* Lane 3: History (Selesai/Arsip hari ini) */}
              <div className="kanban-column" style={styles.kanbanColumn}>
                <div style={{ ...styles.kanbanColumnHeader, borderTop: '4px solid #10b981' }}>
                  <h3 style={styles.kanbanColumnTitle}>Selesai Disajikan</h3>
                  <span style={styles.kanbanColumnBadge}>
                    {orders.filter(o => o.status === 'completed' || o.status === 'cancelled').length}
                  </span>
                </div>
                
                <div style={styles.kanbanCardList}>
                  {orders
                    .filter(o => o.status === 'completed' || o.status === 'cancelled')
                    .map((order) => (
                      <div key={order.id} style={{ ...styles.orderCard, opacity: 0.85 }} className="animate-slide-up">
                        <div style={styles.orderCardHeader}>
                          <span style={{ ...styles.orderCardTable, color: '#9ca3af' }}>MEJA {order.table_number}</span>
                          <span style={{
                            ...styles.smallBadge,
                            ...(order.status === 'completed' 
                                ? { backgroundColor: '#ecfdf5', color: '#10b981' } 
                                : { backgroundColor: '#f3f4f6', color: '#6b7280' })
                          }}>
                            {order.status === 'completed' ? 'Selesai' : 'Batal'}
                          </span>
                        </div>
                        
                        <h4 style={{ ...styles.orderCardCustomer, color: '#6b7280' }}>{order.customer_name}</h4>
                        
                        <div style={styles.orderCardItemsList}>
                          {order.items?.map((item) => (
                            <div key={item.id} style={{ ...styles.orderCardItemRow, color: '#9ca3af' }}>
                              <span>{item.quantity}x {item.menu_name}</span>
                            </div>
                          ))}
                        </div>

                        <hr style={styles.cardDivider} />

                        <div style={{ ...styles.orderCardFooter, color: '#6b7280' }}>
                          <span>Total:</span>
                          <span>{formatRupiah(order.total_price)}</span>
                        </div>
                      </div>
                    ))}
                  {orders.filter(o => o.status === 'completed' || o.status === 'cancelled').length === 0 && (
                    <div style={styles.kanbanColumnEmptyState}>Belum ada riwayat transaksi</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- VIEW 3: MENU MANAGEMENT PORTAL --- */}
        {activeTab === 'menus' && (
          <div style={styles.menusContainer} className="animate-fade">
            <div style={styles.tableSection}>
              <div style={styles.tableSectionHeader}>
                <h3 style={styles.tableSectionTitle}>Katalog Hidangan El's Day</h3>
                <button className="btn btn-espresso" style={{ padding: '10px 20px', borderRadius: '12px' }} onClick={handleOpenAddMenu}>
                  <Plus size={16} />
                  Tambah Menu Baru
                </button>
              </div>

              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Foto</th>
                      <th style={styles.th}>Nama Hidangan</th>
                      <th style={styles.th}>Kategori</th>
                      <th style={styles.th}>Harga Satuan</th>
                      <th style={styles.th}>Ketersediaan (Ready/Habis)</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menus.map((menu) => (
                      <tr key={menu.id} style={styles.tableBodyRow}>
                        <td style={styles.td}>
                          <img src={menu.image_url} alt={menu.name} style={styles.menuTableImg} />
                        </td>
                        <td style={{ ...styles.td, fontWeight: '700' }}>{menu.name}</td>
                        <td style={{ ...styles.td, textTransform: 'capitalize' }}>{menu.category}</td>
                        <td style={{ ...styles.td, fontWeight: '600' }}>{formatRupiah(menu.price)}</td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <label className="switch">
                              <input 
                                type="checkbox" 
                                checked={menu.is_available} 
                                onChange={() => handleToggleMenuAvailability(menu.id, menu.is_available)}
                              />
                              <span className="slider"></span>
                            </label>
                            <span style={{ 
                              fontSize: '0.85rem', 
                              fontWeight: '600',
                              color: menu.is_available ? '#10b981' : '#ef4444' 
                            }}>
                              {menu.is_available ? 'Ready' : 'Habis'}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button 
                              className="btn btn-outline"
                              style={styles.iconBtnTable}
                              onClick={() => handleOpenEditMenu(menu)}
                              title="Edit Menu"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              className="btn btn-outline"
                              style={{ ...styles.iconBtnTable, borderColor: '#ef4444', color: '#ef4444' }}
                              onClick={() => handleDeleteMenu(menu.id)}
                              title="Hapus Menu"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW 4: QR CODE GENERATOR SIMULATOR --- */}
        {activeTab === 'qr' && (
          <div style={styles.qrContainer} className="animate-fade">
            <div style={styles.qrGrid}>
              {[1, 2, 3, 4, 5, 6].map((tableNum) => {
                const customerUrl = `${window.location.origin}/?table=${tableNum}`;
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(customerUrl)}`;
                return (
                  <div key={tableNum} style={styles.qrCard} className="animate-slide-up">
                    <span style={styles.qrCardTitle}>Meja {tableNum}</span>
                    <div style={styles.qrImageContainer}>
                      <img src={qrImageUrl} alt={`QR Code Meja ${tableNum}`} style={styles.qrImage} />
                    </div>
                    <p style={styles.qrInstructions}>
                      Scan QR Code ini menggunakan HP Anda untuk mensimulasikan pemesanan di Meja {tableNum}.
                    </p>
                    <a 
                      href={customerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={styles.qrLinkBtn}
                    >
                      Buka Simulasi Menu
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* --- MODAL 1: PREVIEW BUKTI TRANSFER POPUP --- */}
      <Modal 
        isOpen={!!receiptModalOrder}
        onClose={() => setReceiptModalOrder(null)}
        title={`Bukti Transfer - ${receiptModalOrder?.customer_name}`}
        maxWidth="440px"
      >
        {receiptModalOrder && (
          <div style={styles.modalContentWrapper}>
            <div style={styles.receiptSummaryHeader}>
              <span>Meja: <strong>Meja {receiptModalOrder.table_number}</strong></span>
              <span>Total Tagihan: <strong style={{ color: '#5e454b' }}>{formatRupiah(receiptModalOrder.total_price)}</strong></span>
            </div>
            
            <div style={styles.modalReceiptImgBox}>
              <img 
                src={receiptModalOrder.payment_proof} 
                alt="Bukti Transfer Struk" 
                style={styles.modalReceiptImg}
              />
            </div>

            <p style={styles.modalReceiptVerificationNote}>
              ⚠️ <strong>Verifikasi Kasir:</strong> Harap pastikan dana transfer sudah masuk ke e-banking Anda sebelum melakukan konfirmasi lunas.
            </p>

            <div style={styles.modalActionsGrid}>
              <button 
                className="btn btn-outline" 
                style={{ borderColor: '#ef4444', color: '#ef4444', flex: 1, borderRadius: '12px' }}
                onClick={() => {
                  handleUpdateStatus(receiptModalOrder.id, 'cancelled');
                  setReceiptModalOrder(null);
                }}
              >
                Batalkan / Tolak
              </button>
              <button 
                className="btn btn-espresso" 
                style={{ flex: 1, borderRadius: '12px' }}
                onClick={() => {
                  handleUpdateStatus(receiptModalOrder.id, 'paid');
                  setReceiptModalOrder(null);
                }}
              >
                <Check size={16} />
                Konfirmasi Lunas
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* --- MODAL 2: ADD/EDIT MENU CRUD DIALOG --- */}
      <Modal
        isOpen={menuModalOpen}
        onClose={() => setMenuModalOpen(false)}
        title={editingMenu ? 'Edit Menu Hidangan' : 'Tambah Menu Baru'}
        maxWidth="480px"
      >
        <form onSubmit={handleSaveMenu} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nama Menu</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Contoh: El's Signature Latte"
              value={menuFormName}
              onChange={(e) => setMenuFormName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Harga Menu (Rupiah)</label>
            <input 
              type="number" 
              className="input-field" 
              placeholder="Contoh: 35000"
              value={menuFormPrice || ''}
              onChange={(e) => setMenuFormPrice(parseInt(e.target.value) || 0)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Kategori</label>
            <select 
              className="input-field"
              value={menuFormCategory}
              onChange={(e) => setMenuFormCategory(e.target.value as MenuCategory)}
              style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235e454b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 20px center', backgroundSize: '16px' }}
            >
              <option value="makanan">Makanan</option>
              <option value="minuman">Minuman</option>
              <option value="snack">Snack</option>
              <option value="dessert">Dessert</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">URL Link Foto Menu</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Masukkan link gambar (e.g. Unsplash URL)"
              value={menuFormImage}
              onChange={(e) => setMenuFormImage(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-espresso" 
            style={{ width: '100%', marginTop: '12px', borderRadius: '12px' }}
          >
            {editingMenu ? 'Simpan Perubahan' : 'Tambahkan Menu'}
          </button>
        </form>
      </Modal>

    </div>
  );
};

// High-fidelity Admin portal styles optimized for tablet and desktop viewports
const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    backgroundColor: '#ffffff',
    borderRight: '1px solid #f3e9e7',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    position: 'sticky',
    top: 0
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '36px'
  },
  sidebarBrandLogo: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    backgroundColor: '#ffeef2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.4rem'
  },
  sidebarBrandName: {
    fontSize: '1.1rem',
    fontWeight: '800',
    color: '#5e454b',
    lineHeight: '1.2'
  },
  sidebarBrandRole: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    fontWeight: '600'
  },
  navMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1
  },
  navItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '14px 18px',
    borderRadius: '16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '0.92rem',
    fontWeight: '700',
    color: '#6b7280',
    transition: 'all 0.15s ease'
  },
  navItemActive: {
    backgroundColor: '#ffeef2',
    color: '#5e454b'
  },
  bellBadge: {
    position: 'absolute',
    right: '18px',
    backgroundColor: '#ef4444',
    color: '#ef4444',
    borderRadius: '50%',
    width: '8px',
    height: '8px'
  },
  connectionStatusCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '16px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '1.5px solid #f3f4f6'
  },
  pulsingGreenDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)'
  },
  mainContent: {
    padding: '40px',
    overflowY: 'auto',
    maxHeight: '100vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px'
  },
  headerTitle: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#5e454b',
    letterSpacing: '-0.75px'
  },
  headerSub: {
    fontSize: '0.9rem',
    color: '#6b7280',
    fontWeight: '500'
  },
  headerToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  soundToggleBtn: {
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '0.85rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  },
  dashboardContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px'
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(94, 69, 75, 0.02)',
    border: '1.5px solid #fcf8f7',
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  metricIconBox: {
    width: '56px',
    height: '56px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  metricLabel: {
    fontSize: '0.82rem',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  metricValue: {
    fontSize: '1.6rem',
    fontWeight: '800',
    color: '#5e454b',
    marginTop: '2px'
  },
  tableSection: {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(94, 69, 75, 0.02)',
    border: '1.5px solid #fcf8f7'
  },
  tableSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  tableSectionTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#5e454b'
  },
  tableWrapper: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  tableHeaderRow: {
    borderBottom: '1.5px solid #f3f4f6'
  },
  th: {
    padding: '16px',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#6b7280'
  },
  tableBodyRow: {
    borderBottom: '1px solid #f9fafb',
    transition: 'background-color 0.15s ease'
  },
  td: {
    padding: '16px',
    fontSize: '0.9rem',
    color: '#5e454b',
    verticalAlign: 'middle'
  },
  smallBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '0.72rem',
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  // Live orders kanban
  liveOrdersContainer: {
    flex: 1,
    minHeight: 0
  },
  kanbanLayoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    alignItems: 'start'
  },
  kanbanColumn: {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '20px',
    boxShadow: '0 4px 20px rgba(94, 69, 75, 0.02)',
    border: '1.5px solid #fcf8f7',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 'calc(100vh - 190px)'
  },
  kanbanColumnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '14px',
    marginBottom: '16px',
    borderBottom: '1.5px solid #f3f4f6',
    paddingTop: '8px'
  },
  kanbanColumnTitle: {
    fontSize: '1rem',
    fontWeight: '800',
    color: '#5e454b'
  },
  kanbanColumnBadge: {
    backgroundColor: '#ffeef2',
    color: '#5e454b',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '800',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  kanbanCardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    flex: 1,
    paddingRight: '4px'
  },
  kanbanColumnEmptyState: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: '0.82rem',
    padding: '30px 10px',
    border: '1.5px dashed #e5e7eb',
    borderRadius: '16px'
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: '18px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(94, 69, 75, 0.03)',
    border: '1.5px solid #fcf8f7'
  },
  orderCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  orderCardTable: {
    fontSize: '0.8rem',
    fontWeight: '800',
    color: '#e8a7c1',
    letterSpacing: '0.5px'
  },
  orderCardCustomer: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#5e454b',
    marginBottom: '12px'
  },
  orderCardItemsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px'
  },
  orderCardItemRow: {
    fontSize: '0.85rem',
    color: '#5e454b',
    display: 'flex',
    flexDirection: 'column'
  },
  orderCardItemNote: {
    fontSize: '0.75rem',
    color: '#ef4444',
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: '2px',
    paddingLeft: '14px'
  },
  cardDivider: {
    border: 'none',
    borderBottom: '1px solid #f3f4f6',
    margin: '12px 0'
  },
  orderCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
    fontWeight: '700',
    marginBottom: '16px'
  },
  orderCardActionsGrid: {
    display: 'flex',
    gap: '8px'
  },
  actionBtnCard: {
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '0.78rem',
    fontWeight: '700'
  },
  // Menu Catalog Styles
  menusContainer: {
    display: 'flex',
    flexDirection: 'column'
  },
  menuTableImg: {
    width: '48px',
    height: '48px',
    objectFit: 'cover',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
  },
  iconBtnTable: {
    padding: '8px',
    borderRadius: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  // Modal transfer receipts styles
  modalContentWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  receiptSummaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    color: '#5e454b',
    backgroundColor: '#ffeef2',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '1px solid #fad2e1'
  },
  modalReceiptImgBox: {
    width: '100%',
    maxHeight: '300px',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1.5px solid #e5e7eb'
  },
  modalReceiptImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  modalReceiptVerificationNote: {
    fontSize: '0.8rem',
    color: '#b45309',
    backgroundColor: '#fffdf5',
    border: '1.5px solid #fef3c7',
    borderRadius: '12px',
    padding: '12px',
    lineHeight: '1.4'
  },
  modalActionsGrid: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px'
  },
  qrContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px'
  },
  qrCard: {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: '0 4px 20px rgba(94, 69, 75, 0.02)',
    border: '1.5px solid #fcf8f7',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '16px'
  },
  qrCardTitle: {
    fontSize: '1.2rem',
    fontWeight: '800',
    color: '#5e454b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  qrImageContainer: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '16px',
    border: '1.5px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrImage: {
    width: '160px',
    height: '160px',
    display: 'block'
  },
  qrInstructions: {
    fontSize: '0.82rem',
    color: '#6b7280',
    lineHeight: '1.4',
    margin: 0
  },
  qrLinkBtn: {
    display: 'inline-block',
    width: '100%',
    padding: '12px',
    backgroundColor: '#ffeef2',
    color: '#5e454b',
    borderRadius: '12px',
    fontWeight: '700',
    fontSize: '0.85rem',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    border: '1px solid #fad2e1'
  }
};

// El's Day Cafe - Local Database & Broadcast Sync Service (Supabase Simulation)

export type MenuCategory = 'makanan' | 'minuman' | 'snack' | 'dessert';
export type OrderStatus = 'waiting_payment' | 'checking_payment' | 'paid' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  image_url: string;
  is_available: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id: string;
  quantity: number;
  notes?: string;
  // Join properties
  menu_name?: string;
  menu_price?: number;
  menu_image?: string;
}

export interface Order {
  id: string;
  table_number: string;
  customer_name: string;
  total_price: number;
  payment_method: PaymentMethod;
  payment_proof?: string; // Base64 or mock URL string
  status: OrderStatus;
  created_at: string;
  items?: OrderItem[];
}

// Initial Menu Seed Data
const INITIAL_MENUS: MenuItem[] = [
  {
    id: 'menu-1',
    name: 'Nasi Goreng Spesial',
    price: 35000,
    category: 'makanan',
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80',
    is_available: true
  },
  {
    id: 'menu-2',
    name: 'Mie Goreng Jawa',
    price: 30000,
    category: 'makanan',
    image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
    is_available: false // Out of stock as per design
  },
  {
    id: 'menu-3',
    name: 'Ayam Bakar Madu',
    price: 40000,
    category: 'makanan',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3e73ae83b?w=600&auto=format&fit=crop&q=80',
    is_available: true
  },
  {
    id: 'menu-4',
    name: 'Spaghetti Carbonara',
    price: 45000,
    category: 'makanan',
    image_url: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80',
    is_available: true
  },
  {
    id: 'menu-5',
    name: 'Iced Caramel Macchiato',
    price: 35000,
    category: 'minuman',
    image_url: 'https://images.unsplash.com/photo-1595434061149-865751f215a7?w=600&auto=format&fit=crop&q=80',
    is_available: true
  },
  {
    id: 'menu-6',
    name: 'Matcha Latte',
    price: 32000,
    category: 'minuman',
    image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    is_available: true
  },
  {
    id: 'menu-7',
    name: 'Butter Croissant',
    price: 25000,
    category: 'snack',
    image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
    is_available: true
  },
  {
    id: 'menu-8',
    name: 'Waffle Sweet Strawberry',
    price: 28000,
    category: 'dessert',
    image_url: 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&auto=format&fit=crop&q=80',
    is_available: true
  }
];

// Initial Order seeds (for demonstration purposes on admin dashboard)
const INITIAL_ORDERS: Order[] = [
  {
    id: 'order-101',
    table_number: '4',
    customer_name: 'Budi S.',
    total_price: 85000,
    payment_method: 'transfer',
    payment_proof: 'https://images.unsplash.com/photo-1616077168079-7e09a677fb2c?w=600&auto=format&fit=crop&q=80',
    status: 'checking_payment',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-101-1', order_id: 'order-101', menu_id: 'menu-5', quantity: 2, notes: 'Es batu dikit aja' },
      { id: 'item-101-2', order_id: 'order-101', menu_id: 'menu-7', quantity: 1, notes: 'Hangatkan croissant' }
    ]
  },
  {
    id: 'order-102',
    table_number: 'Bawa Pulang',
    customer_name: 'Siska',
    total_price: 67000,
    payment_method: 'cash',
    status: 'paid',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-102-1', order_id: 'order-102', menu_id: 'menu-5', quantity: 1, notes: 'Less sugar untuk latte' },
      { id: 'item-102-2', order_id: 'order-102', menu_id: 'menu-6', quantity: 1 }
    ]
  },
  {
    id: 'order-103',
    table_number: '12',
    customer_name: 'Anton',
    total_price: 125000,
    payment_method: 'cash',
    status: 'completed',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    items: [
      { id: 'item-103-1', order_id: 'order-103', menu_id: 'menu-1', quantity: 3 },
      { id: 'item-103-2', order_id: 'order-103', menu_id: 'menu-6', quantity: 1 }
    ]
  }
];

// Initialize Broadcast Channel
const syncChannel = new BroadcastChannel('els_day_sync_channel');

// Listeners Registry
type SyncEvent = { type: 'ORDERS_CHANGED' } | { type: 'MENUS_CHANGED' } | { type: 'ORDER_STATUS_CHANGED'; orderId: string; status: OrderStatus };
const menuListeners: (() => void)[] = [];
const orderListeners: ((event: SyncEvent) => void)[] = [];

syncChannel.onmessage = (event: MessageEvent<SyncEvent>) => {
  const syncEvent = event.data;
  if (syncEvent.type === 'MENUS_CHANGED') {
    menuListeners.forEach(listener => listener());
  } else {
    orderListeners.forEach(listener => listener(syncEvent));
  }
};

const notifyChange = (event: SyncEvent) => {
  syncChannel.postMessage(event);
  if (event.type === 'MENUS_CHANGED') {
    menuListeners.forEach(listener => listener());
  } else {
    orderListeners.forEach(listener => listener(event));
  }
};

// Database Access helpers
export const db = {
  // --- MENU OPERATIONS ---
  getMenus(): MenuItem[] {
    const menusJson = localStorage.getItem('els_menus');
    if (!menusJson) {
      localStorage.setItem('els_menus', JSON.stringify(INITIAL_MENUS));
      return INITIAL_MENUS;
    }
    return JSON.parse(menusJson);
  },

  saveMenus(menus: MenuItem[]) {
    localStorage.setItem('els_menus', JSON.stringify(menus));
    notifyChange({ type: 'MENUS_CHANGED' });
  },

  updateMenuAvailability(menuId: string, isAvailable: boolean) {
    const menus = this.getMenus();
    const updated = menus.map(m => m.id === menuId ? { ...m, is_available: isAvailable } : m);
    this.saveMenus(updated);
  },

  addMenu(name: string, price: number, category: MenuCategory, imageUrl: string) {
    const menus = this.getMenus();
    const newMenu: MenuItem = {
      id: 'menu-' + Math.random().toString(36).substr(2, 9),
      name,
      price,
      category,
      image_url: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      is_available: true
    };
    menus.push(newMenu);
    this.saveMenus(menus);
    return newMenu;
  },

  updateMenu(id: string, name: string, price: number, category: MenuCategory, imageUrl: string, isAvailable: boolean) {
    const menus = this.getMenus();
    const updated = menus.map(m => m.id === id ? { ...m, name, price, category, image_url: imageUrl, is_available: isAvailable } : m);
    this.saveMenus(updated);
  },

  deleteMenu(id: string) {
    const menus = this.getMenus();
    const filtered = menus.filter(m => m.id !== id);
    this.saveMenus(filtered);
  },

  // --- ORDER OPERATIONS ---
  getOrders(): Order[] {
    const ordersJson = localStorage.getItem('els_orders');
    if (!ordersJson) {
      // In order to link correctly, seed fully populated items
      localStorage.setItem('els_orders', JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    const orders: Order[] = JSON.parse(ordersJson);
    
    // Inject menu info into items for convenience
    const menus = this.getMenus();
    return orders.map(order => {
      const items = (order.items || []).map(item => {
        const menu = menus.find(m => m.id === item.menu_id);
        return {
          ...item,
          menu_name: menu?.name || 'Item Terhapus',
          menu_price: menu?.price || 0,
          menu_image: menu?.image_url
        };
      });
      return { ...order, items };
    });
  },

  saveOrders(orders: Order[]) {
    localStorage.setItem('els_orders', JSON.stringify(orders));
  },

  createOrder(
    tableNumber: string,
    customerName: string,
    cartItems: { menuId: string; quantity: number; notes?: string }[],
    paymentMethod: PaymentMethod,
    paymentProof?: string
  ): Order {
    const orders = this.getOrders();
    const menus = this.getMenus();
    const orderId = 'ELS-' + Math.floor(1000 + Math.random() * 9000);
    
    let totalPrice = 0;
    const items: OrderItem[] = cartItems.map((cartItem, idx) => {
      const menu = menus.find(m => m.id === cartItem.menuId);
      const itemPrice = menu ? menu.price : 0;
      totalPrice += itemPrice * cartItem.quantity;
      
      return {
        id: `item-${orderId}-${idx}`,
        order_id: orderId,
        menu_id: cartItem.menuId,
        quantity: cartItem.quantity,
        notes: cartItem.notes,
        menu_name: menu?.name,
        menu_price: itemPrice,
        menu_image: menu?.image_url
      };
    });

    const newOrder: Order = {
      id: orderId,
      table_number: tableNumber,
      customer_name: customerName,
      total_price: totalPrice,
      payment_method: paymentMethod,
      payment_proof: paymentProof,
      status: paymentMethod === 'transfer' ? 'checking_payment' : 'waiting_payment',
      created_at: new Date().toISOString(),
      items: items
    };

    orders.unshift(newOrder); // Add to the top of list
    this.saveOrders(orders);
    notifyChange({ type: 'ORDERS_CHANGED' });
    return newOrder;
  },

  updateOrderStatus(orderId: string, status: OrderStatus) {
    const orders = this.getOrders();
    const updated = orders.map(o => o.id === orderId ? { ...o, status } : o);
    this.saveOrders(updated);
    notifyChange({ type: 'ORDER_STATUS_CHANGED', orderId, status });
  },

  // --- SYNC EVENT LISTENERS ---
  onMenuChange(callback: () => void) {
    menuListeners.push(callback);
    return () => {
      const idx = menuListeners.indexOf(callback);
      if (idx > -1) menuListeners.splice(idx, 1);
    };
  },

  onOrderChange(callback: (event: SyncEvent) => void) {
    orderListeners.push(callback);
    return () => {
      const idx = orderListeners.indexOf(callback);
      if (idx > -1) orderListeners.splice(idx, 1);
    };
  }
};

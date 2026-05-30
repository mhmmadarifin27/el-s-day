import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  // Join properties appended dynamically by UI mapping
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
  payment_proof?: string;
  status: OrderStatus;
  created_at: string;
  items?: OrderItem[];
}

export type SyncEvent = { type: 'ORDERS_CHANGED' } | { type: 'MENUS_CHANGED' } | { type: 'ORDER_STATUS_CHANGED'; orderId: string; status: OrderStatus };

// Database Access helpers (Now Asynchronous for Supabase)
export const db = {
  // --- MENU OPERATIONS ---
  async getMenus(): Promise<MenuItem[]> {
    const { data, error } = await supabase.from('menus').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching menus:', error);
      return [];
    }
    return data || [];
  },

  async updateMenuAvailability(menuId: string, isAvailable: boolean) {
    const { error } = await supabase.from('menus').update({ is_available: isAvailable }).eq('id', menuId);
    if (error) console.error('Error updating menu availability:', error);
  },

  async addMenu(name: string, price: number, category: MenuCategory, imageUrl: string) {
    const { data, error } = await supabase.from('menus').insert([{
      name, 
      price, 
      category, 
      image_url: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80', 
      is_available: true
    }]).select();
    if (error) console.error('Error adding menu:', error);
    return data ? data[0] : null;
  },

  async updateMenu(id: string, name: string, price: number, category: MenuCategory, imageUrl: string, isAvailable: boolean) {
    const { error } = await supabase.from('menus').update({
      name, price, category, image_url: imageUrl, is_available: isAvailable
    }).eq('id', id);
    if (error) console.error('Error updating menu:', error);
  },

  async deleteMenu(id: string) {
    const { error } = await supabase.from('menus').delete().eq('id', id);
    if (error) console.error('Error deleting menu:', error);
  },

  // --- ORDER OPERATIONS ---
  async getOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, menus(name, price, image_url))')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
    
    // Map Supabase nested relational structure to our UI structure
    return (data || []).map((order: any) => ({
      ...order,
      items: order.order_items?.map((item: any) => ({
        ...item,
        menu_name: item.menus?.name || 'Item Terhapus',
        menu_price: item.menus?.price || 0,
        menu_image: item.menus?.image_url
      }))
    }));
  },

  async createOrder(
    tableNumber: string,
    customerName: string,
    cartItems: { menuId: string; quantity: number; notes?: string }[],
    paymentMethod: PaymentMethod,
    paymentProof?: string
  ): Promise<Order | null> {
    
    // 1. Calculate total price server-side safely via menu lookup
    const { data: menus } = await supabase.from('menus').select('id, price');
    let totalPrice = 0;
    cartItems.forEach(item => {
      const menu = menus?.find(m => m.id === item.menuId);
      if (menu) totalPrice += menu.price * item.quantity;
    });

    // 2. Insert Order Header
    const status = paymentMethod === 'transfer' ? 'checking_payment' : 'waiting_payment';
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        table_number: tableNumber,
        customer_name: customerName,
        total_price: totalPrice,
        payment_method: paymentMethod,
        payment_proof: paymentProof,
        status: status
      }])
      .select()
      .single();

    if (orderError || !orderData) {
      console.error('Error creating order:', orderError);
      return null;
    }

    // 3. Insert Order Items Junctions
    const itemsToInsert = cartItems.map(item => ({
      order_id: orderData.id,
      menu_id: item.menuId,
      quantity: item.quantity,
      notes: item.notes
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) console.error('Error inserting order items:', itemsError);
    
    return orderData;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) console.error('Error updating order status:', error);
  },

  // --- SYNC EVENT LISTENERS (Supabase Realtime) ---
  onMenuChange(callback: () => void) {
    const subscription = supabase
      .channel('public:menus')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, () => {
        callback();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  },

  onOrderChange(callback: (event: SyncEvent) => void) {
    const subscription = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          callback({ type: 'ORDERS_CHANGED' });
        } else if (payload.eventType === 'UPDATE') {
          callback({ 
            type: 'ORDER_STATUS_CHANGED', 
            orderId: payload.new.id, 
            status: payload.new.status 
          });
        } else if (payload.eventType === 'DELETE') {
           callback({ type: 'ORDERS_CHANGED' });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }
};

-- El's Day Café Supabase Relational Database Schema Blueprints

-- 1. ENUMS CREATION
-- Drop existing types if they exist to allow clean setups
DROP TYPE IF EXISTS menu_category_enum CASCADE;
DROP TYPE IF EXISTS order_status_enum CASCADE;
DROP TYPE IF EXISTS payment_method_enum CASCADE;

CREATE TYPE menu_category_enum AS ENUM ('makanan', 'minuman', 'snack', 'dessert');
CREATE TYPE order_status_enum AS ENUM ('waiting_payment', 'checking_payment', 'paid', 'completed', 'cancelled');
CREATE TYPE payment_method_enum AS ENUM ('cash', 'transfer');

-- 2. TABLE: menus
CREATE TABLE IF NOT EXISTS menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    category menu_category_enum NOT NULL,
    image_url TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. TABLE: orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    total_price INTEGER NOT NULL CHECK (total_price >= 0),
    payment_method payment_method_enum NOT NULL,
    payment_proof TEXT, -- Nullable, filled when bank transfer receipt is uploaded
    status order_status_enum NOT NULL DEFAULT 'waiting_payment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. TABLE: order_items (Pivot/Junction Table)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    notes TEXT, -- Nullable customer customization (e.g. "Es batu dikit aja")
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. REAL-TIME PUBLISHING ENABLER
-- Instructs Supabase's Realtime Engine to stream changes for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE menus;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- 6. MOCK INITIAL SEED DATA (To get started instantly)
INSERT INTO menus (id, name, price, category, image_url, is_available) VALUES
('b1a03e1b-430c-4fa6-8488-825d0c86e0c0', 'Nasi Goreng Spesial', 35000, 'makanan', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80', true),
('c2b04f2c-541d-5fb7-9599-936e1d97f1d1', 'Mie Goreng Jawa', 30000, 'makanan', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80', false), -- Out of Stock
('d3c05g3d-652e-6fc8-9600-047f2e08g2e2', 'Ayam Bakar Madu', 40000, 'makanan', 'https://images.unsplash.com/photo-1598515214211-89d3e73ae83b?w=600&auto=format&fit=crop&q=80', true),
('e4d06h4e-763f-7gd9-9701-158h3f19h3f3', 'Spaghetti Carbonara', 45000, 'makanan', 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80', true),
('f5e07i5f-874g-8he0-9802-269i4g20i4g4', 'Iced Caramel Macchiato', 35000, 'minuman', 'https://images.unsplash.com/photo-1595434061149-865751f215a7?w=600&auto=format&fit=crop&q=80', true),
('g6f08j6g-985h-9if1-9903-370j5h31j5h5', 'Matcha Latte', 32000, 'minuman', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80', true),
('h7g09k7h-096i-0jg2-0004-481k6i42k6h6', 'Butter Croissant', 25000, 'snack', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80', true),
('i8h10l8i-107j-1kh3-1105-592l7j53l7i7', 'Waffle Sweet Strawberry', 28000, 'dessert', 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&auto=format&fit=crop&q=80', true);

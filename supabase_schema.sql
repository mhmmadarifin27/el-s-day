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
('11111111-1111-4111-8111-111111111111', 'Nasi Goreng Spesial', 35000, 'makanan', 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80', true),
('22222222-2222-4222-8222-222222222222', 'Mie Goreng Jawa', 30000, 'makanan', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80', false),
('33333333-3333-4333-8333-333333333333', 'Ayam Bakar Madu', 40000, 'makanan', 'https://images.unsplash.com/photo-1598515214211-89d3e73ae83b?w=600&auto=format&fit=crop&q=80', true),
('44444444-4444-4444-8444-444444444444', 'Spaghetti Carbonara', 45000, 'makanan', 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&auto=format&fit=crop&q=80', true),
('55555555-5555-4555-8555-555555555555', 'Iced Caramel Macchiato', 35000, 'minuman', 'https://images.unsplash.com/photo-1595434061149-865751f215a7?w=600&auto=format&fit=crop&q=80', true),
('66666666-6666-4666-8666-666666666666', 'Matcha Latte', 32000, 'minuman', 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80', true),
('77777777-7777-4777-8777-777777777777', 'Butter Croissant', 25000, 'snack', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80', true),
('88888888-8888-4888-8888-888888888888', 'Waffle Sweet Strawberry', 28000, 'dessert', 'https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&auto=format&fit=crop&q=80', true);

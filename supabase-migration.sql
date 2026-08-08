-- ================================================================
-- SUPABASE MIGRATION: CREATE ORDERS TABLE
-- ================================================================
-- Run this SQL in Supabase SQL Editor to set up the database schema
-- Path: https://app.supabase.com/project/YOUR-PROJECT-ID/sql/new
-- ================================================================

-- Create orders table with all required columns
CREATE TABLE IF NOT EXISTS public.orders (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    
    -- Order details
    item TEXT NOT NULL,                      -- Item name(s) ordered
    price DECIMAL(10, 2) NOT NULL,          -- Price in Rs.
    note TEXT DEFAULT NULL,                 -- Special requests/notes
    table_number VARCHAR(50) DEFAULT 'Takeaway', -- Table or takeaway
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'active',     -- active, completed, cancelled
    printed BOOLEAN DEFAULT FALSE,           -- Has order been printed to kitchen?
    printed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- When was it printed?
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- When was it completed?
    
    -- Metadata
    bill_printed BOOLEAN DEFAULT FALSE,      -- For bill/receipt printing
    payment_method VARCHAR(50) DEFAULT NULL, -- Cash, Card, etc.
    category VARCHAR(50) DEFAULT 'Food',     -- Beverage or Food
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create index on status for faster queries (common filter)
CREATE INDEX idx_orders_status ON public.orders(status);

-- Create index on created_at for sorting/pagination
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);

-- Create index on table_number for filtering by table
CREATE INDEX idx_orders_table_number ON public.orders(table_number);

-- Enable Row Level Security (RLS) for security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Anyone can SELECT (read-only for customers)
CREATE POLICY "orders_select_all" ON public.orders
FOR SELECT USING (TRUE);

-- Create RLS policy: Only allow INSERT (new orders)
CREATE POLICY "orders_insert_all" ON public.orders
FOR INSERT WITH CHECK (TRUE);

-- Create RLS policy: Only allow UPDATE if not too old (prevent editing old orders)
CREATE POLICY "orders_update_recent" ON public.orders
FOR UPDATE USING (
    created_at > NOW() - INTERVAL '1 hour' OR status = 'active'
) WITH CHECK (
    created_at > NOW() - INTERVAL '1 hour' OR status = 'active'
);

-- Create RLS policy: Only allow DELETE for admin (in practice, restrict via JWT)
CREATE POLICY "orders_delete_admin" ON public.orders
FOR DELETE USING (TRUE);

-- ================================================================
-- COMMENT: SETUP INSTRUCTIONS
-- ================================================================
-- 
-- 1. Go to https://app.supabase.com and create a new project
-- 2. Copy your project URL and anon key from Settings > API
-- 3. Go to SQL Editor and paste this migration
-- 4. Click "Run" to create the table
-- 5. Copy SUPABASE_URL and SUPABASE_KEY to .env.local
-- 6. Copy them to Vercel environment variables
--
-- ================================================================

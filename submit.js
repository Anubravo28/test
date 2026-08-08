// ================================================================
// 📤 VERCEL SERVERLESS FUNCTION: ORDER SUBMISSION & SESSION MGMT
// ================================================================
// This replaces submit.php
// Runs on Vercel Functions with Supabase PostgreSQL backend
// ================================================================

import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────
// 🔐 ENVIRONMENT VARIABLES (set in Vercel dashboard)
// ─────────────────────────────────────────────────────────────
// SUPABASE_URL: Your Supabase project URL
// SUPABASE_KEY: Your Supabase anon key
// SESSION_SECRET: Secret key for signing session tokens

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || 'brewedbook_cafe_qr_session_secret_2026';
const SESSION_MAX_AGE = 600; // 10 minutes in seconds

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────────────────────
// 🔒 SESSION TOKEN UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Generate a new session token (timestamp + HMAC signature)
 * @returns {string} Session token in format: timestamp.signature
 */
function generateSessionToken() {
    const ts = Math.floor(Date.now() / 1000);
    const crypto = require('crypto');
    const sig = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(String(ts))
        .digest('hex');
    return `${ts}.${sig}`;
}

/**
 * Verify if a session token is valid and not expired
 * @param {string} token - Session token to verify
 * @returns {boolean} True if token is valid
 */
function isSessionTokenValid(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return false;
    }
    
    const [tsStr, sig] = token.split('.');
    
    // Check if timestamp is numeric
    if (!/^\d+$/.test(tsStr)) {
        return false;
    }
    
    const ts = parseInt(tsStr, 10);
    const crypto = require('crypto');
    const expectedSig = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(String(ts))
        .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        return false;
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (now - ts > SESSION_MAX_AGE) {
        return false;
    }
    
    return true;
}

// ─────────────────────────────────────────────────────────────
// 🛑 RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Return JSON response with proper headers
 */
function jsonResponse(statusCode, data) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify(data),
    };
}

// ─────────────────────────────────────────────────────────────
// 📤 MAIN HANDLER
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.status(200).end();
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).json({ status: 'error', message: 'Method not allowed' });
        return;
    }

    try {
        // Parse form data
        const action = req.body?.action || '';
        const orderId = req.body?.order_id ? parseInt(req.body.order_id, 10) : 0;
        const sessionToken = req.body?.session_token || '';

        // ───────────────────────────────────────────────────────
        // ACTION 1: Start new session
        // ───────────────────────────────────────────────────────
        if (action === 'start_session') {
            const newToken = generateSessionToken();
            res.status(200).json({
                status: 'success',
                session_token: newToken,
                expires_in: SESSION_MAX_AGE,
            });
            return;
        }

        // ───────────────────────────────────────────────────────
        // 🔐 SESSION CHECK (for all other actions except cancel)
        // ───────────────────────────────────────────────────────
        if (action !== 'cancel_order') {
            if (!isSessionTokenValid(sessionToken)) {
                res.status(401).json({
                    status: 'error',
                    session_expired: true,
                    message: '⏳ Your ordering session has expired. Please rescan the table QR code or refresh the page to continue.',
                });
                return;
            }
        }

        // ───────────────────────────────────────────────────────
        // ACTION 2: Admin hard-delete order
        // ───────────────────────────────────────────────────────
        if (action === 'cancel_order') {
            if (orderId <= 0) {
                res.status(400).json({ status: 'error', message: 'Invalid order ID' });
                return;
            }

            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', orderId);

            if (error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }

            res.status(200).json({ status: 'success' });
            return;
        }

        // ───────────────────────────────────────────────────────
        // ACTION 3: Customer self-cancel
        // ───────────────────────────────────────────────────────
        if (action === 'customer_cancel') {
            if (orderId <= 0) {
                res.status(400).json({ status: 'error', message: 'Invalid order ID' });
                return;
            }

            const { error } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderId);

            if (error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }

            res.status(200).json({ status: 'success' });
            return;
        }

        // ───────────────────────────────────────────────────────
        // ACTION 4: Customer edit note
        // ───────────────────────────────────────────────────────
        if (action === 'customer_edit') {
            if (orderId <= 0) {
                res.status(400).json({ status: 'error', message: 'Invalid order ID' });
                return;
            }

            const newNote = req.body?.note || '';

            const { error } = await supabase
                .from('orders')
                .update({ note: newNote })
                .eq('id', orderId)
                .eq('status', 'active');

            if (error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }

            res.status(200).json({ status: 'success', new_note: newNote });
            return;
        }

        // ───────────────────────────────────────────────────────
        // ACTION 5: New order submission
        // ───────────────────────────────────────────────────────
        const item = req.body?.item || '';
        const price = req.body?.price ? parseFloat(req.body.price) : 0;
        const note = req.body?.note || '';
        const tableNumber = req.body?.table_number || 'Takeaway';

        if (!item || item.trim() === '') {
            res.status(400).json({ status: 'error', message: 'Cart contents cannot be blank' });
            return;
        }

        // Insert order into Supabase
        const { data, error } = await supabase
            .from('orders')
            .insert([
                {
                    item,
                    price,
                    note,
                    table_number: tableNumber,
                    status: 'active',
                    printed: false, // Explicitly set on creation
                    created_at: new Date().toISOString(),
                },
            ])
            .select();

        if (error) {
            res.status(400).json({ status: 'error', message: error.message });
            return;
        }

        const newOrder = data?.[0];
        res.status(200).json({
            status: 'success',
            item,
            order_id: newOrder?.id,
        });

    } catch (err) {
        console.error('Error in submit handler:', err);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error: ' + (err.message || 'Unknown'),
        });
    }
}

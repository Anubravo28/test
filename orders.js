// ================================================================
// 📋 VERCEL SERVERLESS FUNCTION: GET ORDERS FOR ADMIN
// ================================================================
// This API endpoint returns live orders data for the admin dashboard
// Requires JWT authentication
// ================================================================

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────
// 🔐 ENVIRONMENT VARIABLES (set in Vercel dashboard)
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'admin_jwt_secret_2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────────────────────
// 🔐 JWT VERIFICATION
// ─────────────────────────────────────────────────────────────

/**
 * Verify JWT admin token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token or null
 */
function verifyAdminToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// 📤 MAIN HANDLER
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // ─────────────────────────────────────────────────────
        // 🔐 AUTHENTICATE: Check JWT token
        // ─────────────────────────────────────────────────────
        const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.admin_token;

        if (!token || !verifyAdminToken(token)) {
            res.status(401).json({ status: 'error', message: 'Unauthorized' });
            return;
        }

        // ─────────────────────────────────────────────────────
        // GET: Fetch all orders
        // ─────────────────────────────────────────────────────
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                res.status(400).json({ status: 'error', message: error.message });
                return;
            }

            res.status(200).json({
                status: 'success',
                orders: data || [],
            });
            return;
        }

        // ─────────────────────────────────────────────────────
        // POST: Update order status (admin actions)
        // ─────────────────────────────────────────────────────
        if (req.method === 'POST') {
            const action = req.body?.action || '';
            const orderId = req.body?.order_id ? parseInt(req.body.order_id, 10) : 0;

            if (orderId <= 0) {
                res.status(400).json({ status: 'error', message: 'Invalid order ID' });
                return;
            }

            // Mark as printed
            if (action === 'mark_printed') {
                const { error } = await supabase
                    .from('orders')
                    .update({ printed: true, printed_at: new Date().toISOString() })
                    .eq('id', orderId);

                if (error) {
                    res.status(400).json({ status: 'error', message: error.message });
                    return;
                }

                res.status(200).json({ status: 'success' });
                return;
            }

            // Mark as served
            if (action === 'mark_served') {
                const { error } = await supabase
                    .from('orders')
                    .update({ status: 'completed', completed_at: new Date().toISOString() })
                    .eq('id', orderId);

                if (error) {
                    res.status(400).json({ status: 'error', message: error.message });
                    return;
                }

                res.status(200).json({ status: 'success' });
                return;
            }

            // Hard delete (remove order)
            if (action === 'delete') {
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

            res.status(400).json({ status: 'error', message: 'Invalid action' });
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });

    } catch (err) {
        console.error('Error in orders handler:', err);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error: ' + (err.message || 'Unknown'),
        });
    }
}

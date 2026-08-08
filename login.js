// ================================================================
// 🔐 VERCEL SERVERLESS FUNCTION: ADMIN LOGIN
// ================================================================
// This replaces login.php
// Handles password validation and session creation via JWT tokens
// ================================================================

import jwt from 'jsonwebtoken';

// ─────────────────────────────────────────────────────────────
// 🔐 ENVIRONMENT VARIABLES (set in Vercel dashboard)
// ─────────────────────────────────────────────────────────────
// ADMIN_PASSWORD: The master password for admin login
// JWT_SECRET: Secret key for signing JWT tokens

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '6028';
const JWT_SECRET = process.env.JWT_SECRET || 'admin_jwt_secret_2026';

// ─────────────────────────────────────────────────────────────
// 🎫 JWT TOKEN UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Generate JWT admin token
 * Token expires in 12 hours
 */
function generateAdminToken() {
    return jwt.sign(
        { admin_logged_in: true, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
}

/**
 * Verify JWT admin token
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token or null if invalid
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // ───────────────────────────────────────────────────────
    // GET: Check if already logged in (via JWT cookie/header)
    // ───────────────────────────────────────────────────────
    if (req.method === 'GET') {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.admin_token;

        if (token && verifyAdminToken(token)) {
            res.status(200).json({ authenticated: true });
        } else {
            res.status(401).json({ authenticated: false });
        }
        return;
    }

    // ───────────────────────────────────────────────────────
    // POST: Process login
    // ───────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const password = req.body?.password || '';

        // Validate password
        if (password === ADMIN_PASSWORD) {
            const token = generateAdminToken();

            // Set JWT in HttpOnly cookie (secure in production)
            res.setHeader(
                'Set-Cookie',
                `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
            );

            res.status(200).json({
                status: 'success',
                message: 'Login successful',
                token, // Also return token in body for localStorage fallback
            });
        } else {
            res.status(401).json({
                status: 'error',
                message: '❌ Invalid Password. Access Denied.',
            });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
}

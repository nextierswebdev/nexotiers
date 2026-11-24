const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();

// Prefer explicit server-side service-role keys. Never use anon/publishable keys.
const keyCandidates = [
    { name: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { name: 'SUPABASE_SERVICE_KEY', value: process.env.SUPABASE_SERVICE_KEY },
    { name: 'SUPABASE_SECRET_KEY', value: process.env.SUPABASE_SECRET_KEY },
    { name: 'SUPABASE_KEY', value: process.env.SUPABASE_KEY }
];

function isAnonOrPublishable(key) {
    const k = String(key || '').trim().toLowerCase();
    if (!k) return false;
    if (k.startsWith('sb_publishable_')) return true;
    if (k.startsWith('sb_anon_')) return true;
    // JWT keys: inspect the role claim without logging the key.
    if (k.includes('.')) {
        try {
            const parts = k.split('.');
            if (parts.length >= 2) {
                const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
                const role = String(payload?.role || '').toLowerCase();
                if (role && role !== 'service_role' && role !== 'supabase_admin' && role !== 'postgres') {
                    // Likely an anon/authenticated key.
                    if (role === 'anon' || role === 'authenticated') return true;
                }
            }
        } catch (_) { /* ignore */ }
    }
    return false;
}

function isConfirmedServiceRole(key) {
    const k = String(key || '').trim();
    if (k.startsWith('sb_secret_')) return true;
    if (k.includes('.')) {
        try {
            const parts = k.split('.');
            if (parts.length >= 2) {
                const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
                const role = String(payload?.role || '').toLowerCase();
                return role === 'service_role' || role === 'supabase_admin' || role === 'postgres';
            }
        } catch (_) { /* ignore */ }
    }
    return false;
}

if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL in environment');
}

let selected = null;
for (const candidate of keyCandidates) {
    const value = (candidate.value || '').trim();
    if (!value) continue;
    if (isAnonOrPublishable(value)) continue;
    selected = { name: candidate.name, value };
    break;
}

if (!selected) {
    // Fall back to any provided key (even if unverified) but reject obvious anon keys.
    for (const candidate of keyCandidates) {
        const value = (candidate.value || '').trim();
        if (!value) continue;
        if (isAnonOrPublishable(value)) {
            throw new Error(`Refusing to use anon/publishable key from ${candidate.name}. Set SUPABASE_SERVICE_ROLE_KEY to the server-side service role key.`);
        }
        selected = { name: candidate.name, value };
        break;
    }
}

if (!selected) {
    throw new Error('Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY in the environment.');
}

if (!isConfirmedServiceRole(selected.value)) {
    console.warn(`[Supabase] Key from ${selected.name} could not be confirmed as a service role key. Ensure Railway uses SUPABASE_SERVICE_ROLE_KEY.`);
} else {
    console.log(`[Supabase] Initialized with ${selected.name} (service role).`);
}

// Never log the key itself.
const supabase = createClient(supabaseUrl, selected.value, {
    db: { schema: 'public' },
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

module.exports = supabase;
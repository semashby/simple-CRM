import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function refreshAccessToken(connectionId: string, refreshToken: string) {
    const clientId = process.env.CAL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.CAL_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) throw new Error('Cal.com OAuth misconfigured');

    const response = await fetch('https://api.cal.com/v2/auth/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to refresh Cal.com token');
    }

    const data = await response.json();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

    const supabase = await createClient();
    await supabase
        .from('calendar_connections')
        .update({
            cal_access_token: data.access_token,
            // only update refresh token if provided
            ...(data.refresh_token ? { cal_refresh_token: data.refresh_token } : {}),
            token_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);

    return data.access_token as string;
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data: connection } = await supabase
            .from('calendar_connections')
            .select('*')
            .eq('user_id', user.id)
            .eq('provider', 'calcom')
            .eq('is_active', true)
            .single();

        if (!connection || !connection.cal_access_token) {
            return NextResponse.json({ error: 'No active Cal.com calendar connected' }, { status: 400 });
        }

        let accessToken = connection.cal_access_token;

        // Check if token is expired (or close to expiring, e.g. within 5 mins)
        const expiresAt = new Date(connection.token_expires_at || 0);
        if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
            if (!connection.cal_refresh_token) {
                // Cannot refresh, mark connection invalid
                await supabase
                    .from('calendar_connections')
                    .update({ is_active: false })
                    .eq('id', connection.id);
                return NextResponse.json({ error: 'Token expired, please reconnect your calendar' }, { status: 401 });
            }
            try {
                accessToken = await refreshAccessToken(connection.id, connection.cal_refresh_token);
            } catch (err) {
                console.error('Token refresh failed', err);
                return NextResponse.json({ error: 'Failed to refresh Cal.com access, please reconnect' }, { status: 401 });
            }
        }

        // Fetch bookings from Cal.com
        const response = await fetch(
            `https://api.cal.com/v1/bookings`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch bookings from Cal.com');
        }

        const data = await response.json();
        const bookings = data.bookings || [];

        const now = new Date().toISOString();
        const eventsToUpsert = bookings.map((b: any) => {
            return {
                connection_id: connection.id,
                user_id: user.id,
                external_id: b.id.toString(),
                title: b.title || '(No title)',
                description: b.description || null,
                start_time: b.startTime,
                end_time: b.endTime,
                is_all_day: false,
                location: b.location || null,
                status: b.status === 'CANCELLED' || b.status === 'REJECTED' ? 'free' : 'busy',
                synced_at: now
            };
        });

        if (eventsToUpsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('calendar_events')
                .upsert(eventsToUpsert, {
                    onConflict: 'connection_id, external_id',
                    ignoreDuplicates: false
                });

            if (upsertError) throw upsertError;
        }

        return NextResponse.json({ success: true, count: eventsToUpsert.length });

    } catch (err: any) {
        console.error('Calendar sync error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

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
        const { title, description, startTime, endTime, assignedToUserId, leadName, leadEmail } = await request.json();

        const targetUserId = assignedToUserId || user.id;

        // 1. Get the active Cal.com connection for the target user (cross-user booking)
        const { data: connection } = await supabase
            .from('calendar_connections')
            .select('*')
            .eq('user_id', targetUserId)
            .eq('provider', 'calcom')
            .eq('is_active', true)
            .single();

        if (!connection || !connection.cal_access_token) {
            return NextResponse.json({ error: 'Target user does not have an active Cal.com calendar connected' }, { status: 400 });
        }

        let accessToken = connection.cal_access_token;

        // Refresh token if needed
        const expiresAt = new Date(connection.token_expires_at || 0);
        if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
            if (!connection.cal_refresh_token) {
                return NextResponse.json({ error: 'Target user token expired, they must reconnect' }, { status: 401 });
            }
            try {
                accessToken = await refreshAccessToken(connection.id, connection.cal_refresh_token);
            } catch (err) {
                return NextResponse.json({ error: 'Failed to refresh target user calendar token' }, { status: 401 });
            }
        }

        // 2. We need an Event Type ID to book against. Fetch the user's event types and pick the first one.
        const eventTypesRes = await fetch('https://api.cal.com/v1/event-types', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        let eventTypeId = null;
        if (eventTypesRes.ok) {
            const etData = await eventTypesRes.json();
            if (etData.eventTypes && etData.eventTypes.length > 0) {
                eventTypeId = etData.eventTypes[0].id;
            }
        }

        if (!eventTypeId) {
            return NextResponse.json({ error: 'Target user has no event types configured in Cal.com' }, { status: 400 });
        }

        // 3. Push booking to Cal.com API
        const eventPayload = {
            eventTypeId: eventTypeId,
            start: new Date(startTime).toISOString(),
            end: new Date(endTime).toISOString(),
            responses: {
                name: leadName || 'CRM Lead',
                email: leadEmail || 'no-email@crm.local',
                notes: description || ''
            },
            metadata: {
                source: 'CRM',
                title: title
            },
            timeZone: "UTC",
            language: "en"
        };

        const createRes = await fetch(`https://api.cal.com/v1/bookings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventPayload)
        });

        if (!createRes.ok) {
            const errData = await createRes.json();
            console.error('Cal.com create booking error:', errData);
            throw new Error('Failed to create booking in Cal.com');
        }

        const createdBooking = await createRes.json();

        // 4. Immediately sync this event to our local cache
        const actualBooking = createdBooking.booking || createdBooking;
        await supabase.from('calendar_events').insert({
            connection_id: connection.id,
            user_id: targetUserId,
            external_id: actualBooking.id ? actualBooking.id.toString() : 'temp-' + Date.now(),
            title: title || '(No title)',
            description: description || null,
            start_time: startTime,
            end_time: endTime,
            is_all_day: false,
            location: null,
            status: 'busy',
            synced_at: new Date().toISOString()
        });

        return NextResponse.json({ success: true, eventId: actualBooking.id });

    } catch (err: any) {
        console.error('Create calendar event error:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

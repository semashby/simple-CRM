import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Google connection
    const { data: connection } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .single();

    if (!connection || !connection.access_token) {
        return NextResponse.json({ error: 'No active Google Calendar connection' }, { status: 404 });
    }

    try {
        // Fetch list of calendars
        const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
            headers: {
                Authorization: `Bearer ${connection.access_token}`,
            },
        });

        if (response.status === 401) {
            // Need to handle token refresh in a real app, 
            // but for simplicity we rely on the generic refresh helper or prompt re-auth
            return NextResponse.json({ error: 'Token expired, please reconnect' }, { status: 401 });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to fetch calendars');
        }

        const calendars = data.items.map((cal: any) => ({
            id: cal.id,
            name: cal.summary,
            isPrimary: cal.primary || false,
            accessRole: cal.accessRole, // we need 'writer' or 'owner' to create events
        }));

        return NextResponse.json({ calendars });
    } catch (err: any) {
        console.error('Error fetching calendars:', err);
        return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
    }
}

// Endpoint to select which calendar to sync
export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { calendarId, calendarName } = await request.json();

        if (!calendarId) {
            return NextResponse.json({ error: 'Missing calendarId' }, { status: 400 });
        }

        // Update connection with selected calendar
        const { error } = await supabase
            .from('calendar_connections')
            .update({
                calendar_id: calendarId,
                calendar_name: calendarName || calendarId,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('provider', 'google')
            .eq('is_active', true);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

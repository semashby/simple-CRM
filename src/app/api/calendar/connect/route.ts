import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.CAL_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`;

    if (!clientId) {
        return NextResponse.json({ error: 'Cal.com Client ID not configured' }, { status: 500 });
    }

    // Cal.com OAuth authorization URL
    const authUrl = `https://app.cal.com/api/oauth/authorize?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&state=${user.id}`; // Pass user ID in state to link account on callback

    return NextResponse.redirect(authUrl);
}

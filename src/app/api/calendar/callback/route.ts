import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user.id
    const error = url.searchParams.get('error');

    if (error || !code) {
        return NextResponse.redirect(new URL('/calendar?error=auth_failed', request.url));
    }

    const clientId = process.env.CAL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.CAL_OAUTH_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`;

    if (!clientId || !clientSecret) {
        return NextResponse.redirect(new URL('/calendar?error=config_missing', request.url));
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://api.cal.com/v2/auth/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
            }),
        });

        const tokens = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('Token exchange error:', tokens);
            throw new Error('Failed to exchange token');
        }

        // Fetch the Cal.com user ID using the access token
        const meResponse = await fetch('https://api.cal.com/v1/users/me', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
        });
        const meData = await meResponse.json();
        const calUserId = meData.user?.id?.toString() || null;

        const supabase = await createClient();

        // Ensure the authenticated user matches the state
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.id !== state) {
            return NextResponse.redirect(new URL('/calendar?error=unauthorized', request.url));
        }

        // Calculate expiration time
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

        // Save connection in DB
        const { data: existingConnection } = await supabase
            .from('calendar_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('provider', 'calcom')
            .single();

        if (existingConnection) {
            await supabase
                .from('calendar_connections')
                .update({
                    cal_access_token: tokens.access_token,
                    // Only update refresh token if a new one was provided
                    ...(tokens.refresh_token ? { cal_refresh_token: tokens.refresh_token } : {}),
                    token_expires_at: expiresAt.toISOString(),
                    cal_user_id: calUserId,
                    is_active: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingConnection.id);
        } else {
            await supabase
                .from('calendar_connections')
                .insert({
                    user_id: user.id,
                    provider: 'calcom',
                    cal_access_token: tokens.access_token,
                    cal_refresh_token: tokens.refresh_token,
                    cal_user_id: calUserId,
                    token_expires_at: expiresAt.toISOString(),
                    is_active: true
                });
        }

        return NextResponse.redirect(new URL('/calendar?setup=success', request.url));
    } catch (err) {
        console.error('Cal.com OAuth callback error', err);
        return NextResponse.redirect(new URL('/calendar?error=server_error', request.url));
    }
}

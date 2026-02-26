import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Remove active Google connections
        const { error } = await supabase
            .from('calendar_connections')
            .delete()
            .eq('user_id', user.id)
            .eq('provider', 'google');

        if (error) throw error;

        // Cascade delete on calendar_events handles the event cleanup

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Error disconnecting calendar:', err);
        return NextResponse.json({ error: 'Failed to disconnect calendar' }, { status: 500 });
    }
}

import { Sidebar } from "@/components/sidebar";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="ml-60 flex-1 p-8">{children}</main>
        </div>
    );
}

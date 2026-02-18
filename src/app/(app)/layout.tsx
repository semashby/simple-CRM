import { Sidebar } from "@/components/sidebar";
import { SearchDialog } from "@/components/search-dialog";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <SearchDialog />
            <main className="ml-60 flex-1 p-8">{children}</main>
        </div>
    );
}

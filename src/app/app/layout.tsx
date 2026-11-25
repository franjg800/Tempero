import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">{children}</main>
    </div>
  );
}

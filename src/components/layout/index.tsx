import React from "react";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { Footer } from "./footer";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f071a] text-white flex flex-col">
      <Navbar />
      <Sidebar />
      <main className="pt-16 pb-20 md:pb-0 md:ml-20 flex-1">{children}</main>
      <div className="md:ml-20">
        <Footer />
      </div>
    </div>
  );
}

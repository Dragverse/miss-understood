"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LivePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard where stream creation now happens
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#EB83EA] mx-auto mb-4"></div>
        <p className="text-gray-400">Redirecting to dashboard...</p>
        <p className="text-sm text-gray-500 mt-2">
          Stream creation has moved to your dashboard
        </p>
      </div>
    </div>
  );
}

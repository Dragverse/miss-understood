"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FiUpload, FiLoader, FiCheck, FiAlertCircle } from "react-icons/fi";
import { useUploadProgress } from "@/lib/store/upload";

export function FloatingUploadStatus() {
  const pathname = usePathname();
  const { stage, progress, processingProgress, totalBytes, fileName, reset } = useUploadProgress();

  // Auto-dismiss 5s after completion
  useEffect(() => {
    if (stage === "complete") {
      const t = setTimeout(reset, 5000);
      return () => clearTimeout(t);
    }
  }, [stage, reset]);

  // Don't show while on the upload page (it has its own progress popup)
  if (stage === "idle" || pathname === "/upload") return null;

  return (
    <div className="fixed bottom-6 right-6 w-72 p-4 bg-gradient-to-br from-[#1a0b2e] to-[#0f071a] border border-[#EB83EA]/30 rounded-2xl shadow-2xl shadow-[#EB83EA]/20 z-50 animate-in slide-in-from-bottom-4 duration-300">
      {stage === "uploading" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiUpload className="w-4 h-4 text-[#EB83EA] animate-pulse" />
              <span className="text-sm font-bold text-white">
                {totalBytes === 0 ? "Preparing..." : "Uploading"}
              </span>
            </div>
            <span className="text-sm font-bold text-[#EB83EA]">{progress}%</span>
          </div>
          <div className="w-full bg-[#0f071a] rounded-full h-1.5 overflow-hidden">
            {totalBytes === 0 ? (
              <div className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] h-1.5 rounded-full w-1/3 animate-pulse" />
            ) : (
              <div
                className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
          {fileName && <p className="text-xs text-gray-500 truncate">{fileName}</p>}
        </div>
      )}

      {stage === "processing" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiLoader className="w-4 h-4 text-[#EB83EA] animate-spin" />
              <span className="text-sm font-bold text-white">Processing video</span>
            </div>
            <span className="text-sm font-bold text-[#EB83EA]">{processingProgress}%</span>
          </div>
          <div className="w-full bg-[#0f071a] rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(processingProgress, 5)}%` }}
            />
          </div>
        </div>
      )}

      {stage === "saving" && (
        <div className="flex items-center gap-2">
          <FiLoader className="w-4 h-4 text-[#EB83EA] animate-spin" />
          <span className="text-sm font-bold text-white">Saving...</span>
        </div>
      )}

      {stage === "complete" && (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <FiCheck className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-green-400">Upload Complete!</p>
            <Link href="/dashboard" className="text-xs text-[#EB83EA] hover:underline">
              View in dashboard →
            </Link>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="flex items-center gap-2">
          <FiAlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm font-bold text-red-400">Upload failed</span>
          <button
            onClick={reset}
            className="ml-auto text-xs text-gray-400 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

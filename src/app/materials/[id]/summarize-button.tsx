"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type SummarizeButtonProps = {
  materialId: string;
  className: string;
  idleLabel: string;
  loadingLabel?: string;
};

export function SummarizeButton({
  materialId,
  className,
  idleLabel,
  loadingLabel = "Loading...",
}: SummarizeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const isLoading = isPending;
  const targetPath = `/materials/${materialId}`;

  return (
    <button
      type="button"
      className={className}
      disabled={isLoading}
      aria-busy={isLoading}
      onClick={() => {
        if (isLoading) {
          return;
        }
        startTransition(() => {
          const isSameMaterial = pathname === targetPath;
          const alreadySummarizing = searchParams.get("summarize") === "1";

          if (isSameMaterial && alreadySummarizing) {
            router.refresh();
            return;
          }

          router.push(`${targetPath}?summarize=1`);
        });
      }}
    >
      {isLoading ? loadingLabel : idleLabel}
    </button>
  );
}
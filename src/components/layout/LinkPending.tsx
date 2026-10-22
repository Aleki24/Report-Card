"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * A small spinner on the link being followed, so a tap or click shows at once
 * that it worked while the next page loads. It fades in after a beat, so a
 * page that opens straight away never flashes it. Must sit inside a <Link>.
 */
export function LinkPending({ className }: { className?: string }) {
    const { pending } = useLinkStatus();
    return (
        <span
            aria-hidden
            className={cn(
                "pointer-events-none size-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-0 transition-opacity",
                pending && "animate-spin opacity-100 delay-150",
                className,
            )}
        />
    );
}

"use client";

import { useCallback, useEffect, useRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import NextLink, { type LinkProps } from "next/link";

// Native View Transitions for the App Router. The catch with view transitions +
// async navigation is *when* to capture the "after" snapshot: too early and you
// morph into the old page. We start the transition (captures "before"), push,
// and resolve the transition's promise only once the new route commits — so the
// browser captures the live new page as the end state. A safety timer guarantees
// the transition never hangs if the route doesn't change.
//
// This replaces next-view-transitions, which didn't commit navigations under
// Next 15.5; the native API works directly.

type StartViewTransition = (cb: () => unknown) => { finished: Promise<void> };

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useVTNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const resolveRef = useRef<(() => void) | null>(null);

  // The new route committed — let the in-flight transition capture it.
  useEffect(() => {
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, [pathname]);

  return useCallback(
    (href: string) => {
      const svt = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
      if (typeof svt !== "function" || reducedMotion()) {
        router.push(href);
        return;
      }
      // The View Transition owns the route entrance; the screenin fallback is
      // disabled on VT browsers via @supports in globals.css, so there is
      // nothing to suppress here — no class to toggle.
      svt.call(document, () =>
        new Promise<void>((resolve) => {
          resolveRef.current = resolve;
          router.push(href);
          window.setTimeout(() => {
            if (resolveRef.current) {
              resolveRef.current();
              resolveRef.current = null;
            }
          }, 700);
        })
      );
    },
    [router]
  );
}

type TransitionLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & { children?: ReactNode };

/** Drop-in for next/link that morphs between routes via a View Transition.
 *  Keeps prefetch; respects modifier-clicks, new-tab and external links. */
export function TransitionLink({ href, children, onClick, ...rest }: TransitionLinkProps) {
  const navigate = useVTNavigate();
  const url = typeof href === "string" ? href : href.toString();
  return (
    <NextLink
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === "_blank") return;
        if (url.startsWith("/")) {
          e.preventDefault();
          navigate(url);
        }
      }}
      {...rest}
    >
      {children}
    </NextLink>
  );
}

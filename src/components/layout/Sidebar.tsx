"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid, Search, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/Wordmark";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { findNavItem, getMobileNav, getNavGroups, getPinnedItems, roleBadgeColors, routeMatches, type NavItem } from "./sidebar/navItems";
import { DesktopUserMenu } from "./sidebar/DesktopUserMenu";
import { MobileMoreMenu } from "./sidebar/MobileMoreMenu";

interface SidebarProps {
    collapsed?: boolean;
    setCollapsed?: (val: boolean) => void;
}

/** A label shown beside the collapsed rail, positioned from the hovered link. */
interface RailTooltip { label: string; top: number }

/** Whether a key press came from somewhere the user is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

function SchoolMark({ logo, name, size }: { logo: string | null; name: string; size: number }) {
    return logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- school-uploaded URL, not a local asset
        <img src={logo} alt={name || "School"} width={size} height={size} className="shrink-0 rounded-xl bg-white object-contain p-0.5" style={{ width: size, height: size }} />
    ) : (
        <Image src="/images/logo.png" alt="Skulbase" width={size} height={size} className="shrink-0 rounded-xl object-contain" />
    );
}

interface NavLinkProps {
    item: NavItem;
    collapsed: boolean;
    active: boolean;
    badge?: number;
    onHint?: (hint: RailTooltip | null) => void;
}

function NavLink({ item, collapsed, active, badge, onHint }: NavLinkProps) {
    const showHint = (e: React.SyntheticEvent<HTMLAnchorElement>) => {
        if (!collapsed) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onHint?.({ label: item.label, top: rect.top + rect.height / 2 });
    };
    const hideHint = () => onHint?.(null);

    return (
        <Link
            href={item.href}
            aria-label={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            onMouseEnter={showHint}
            onMouseLeave={hideHint}
            onFocus={showHint}
            onBlur={hideHint}
            className={cn(
                "group relative flex h-10 items-center gap-3 rounded-xl text-sm no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                collapsed ? "mx-auto w-11 justify-center" : "px-3",
                active
                    ? "bg-white/[0.12] font-semibold text-sidebar-foreground"
                    : "font-medium text-sidebar-foreground/65 hover:bg-white/[0.06] hover:text-sidebar-foreground",
            )}
        >
            {/* Accent bar on the page you're on */}
            {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-1 rounded-full bg-sidebar-ring" />}
            <span className={cn("relative flex size-5 shrink-0 items-center justify-center", active ? "text-sidebar-ring" : "")}>
                {item.icon}
                {!!badge && collapsed && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />}
            </span>
            {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
            {!collapsed && !!badge && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                </span>
            )}
        </Link>
    );
}

export function Sidebar({ collapsed = false, setCollapsed }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { profile, role, baseRole, availableRoles, switchRole, schoolName, loading, can, hasModule } = useAuth();
    const viewer = useMemo(() => ({ role, can, hasModule }), [role, can, hasModule]);

    const [searchQuery, setSearchQuery] = useState("");
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [notifCount, setNotifCount] = useState(0);
    const [railHint, setRailHint] = useState<RailTooltip | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/school/data?type=school_profile")
            .then((res) => res.json())
            .then((data) => {
                if (data.data?.logo_url) setSchoolLogo(data.data.logo_url);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (role !== "STUDENT") return;
        fetch("/api/school/student/notifications")
            .then((res) => res.json())
            .then((data) => setNotifCount(data.data?.count ?? 0))
            .catch(() => {});
    }, [role]);

    const badges: Record<string, number> = role === "STUDENT" ? { "/student/dashboard": notifCount } : {};

    const groups = useMemo(() => {
        const base = getNavGroups(viewer);
        const q = searchQuery.trim().toLowerCase();
        if (!q) return base;
        return base
            .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
            .filter((g) => g.items.length > 0);
    }, [viewer, searchQuery]);

    const pinned = useMemo(() => getPinnedItems(viewer), [viewer]);
    const mobileNav = useMemo(() => getMobileNav(viewer), [viewer]);
    const currentPage = findNavItem(pathname, viewer);

    const handleSignOut = () => router.push("/logout");
    const homeHref = role === "STUDENT" ? "/student/dashboard" : "/dashboard";
    const roleLabel = role ? ROLE_LABELS[role] : "";

    const focusSearch = useCallback(() => {
        if (collapsed) setCollapsed?.(false);
        // Wait a frame for the input to exist after expanding.
        requestAnimationFrame(() => searchRef.current?.focus());
    }, [collapsed, setCollapsed]);

    // "/" jumps to the menu search, as in most web apps.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
            if (!window.matchMedia("(min-width: 768px)").matches) return;
            e.preventDefault();
            focusSearch();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [focusSearch]);

    // Enter in the search opens the first match.
    const firstMatch = groups[0]?.items[0];
    const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && firstMatch) {
            router.push(firstMatch.href);
            setSearchQuery("");
            e.currentTarget.blur();
        } else if (e.key === "Escape") {
            setSearchQuery("");
            e.currentTarget.blur();
        }
    };

    const moreActive = showMoreMenu || mobileNav.overflow.some((i) => routeMatches(pathname, i.href));

    return (
        <>
            {/* ── Desktop sidebar ──────────────────────────────── */}
            <aside
                aria-label="Main"
                className={cn(
                    "fixed top-0 left-0 z-50 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out min-[768px]:flex",
                    collapsed ? "w-20" : "w-[260px]",
                )}
            >
                {/* Brand */}
                <div className={cn("flex items-center gap-3 border-b border-sidebar-border/70 py-4", collapsed ? "justify-center px-3" : "px-4")}>
                    <Link href={homeHref} className="flex min-w-0 flex-1 items-center gap-3 text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-xl" aria-label={`${schoolName || "Skulbase"} home`}>
                        <SchoolMark logo={schoolLogo} name={schoolName ?? ""} size={collapsed ? 40 : 42} />
                        {!collapsed && (
                            <span className="min-w-0">
                                <span className="line-clamp-2 font-display text-sm leading-tight font-bold">{schoolName || <Wordmark />}</span>
                                {roleLabel && <span className="mt-0.5 block truncate text-[11px] text-sidebar-foreground/55">{roleLabel} workspace</span>}
                            </span>
                        )}
                    </Link>
                </div>

                {/* Edge toggle: always in the same place, collapsed or not */}
                <button
                    type="button"
                    onClick={() => { setCollapsed?.(!collapsed); setRailHint(null); }}
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className="absolute top-[30px] -right-3 z-10 flex size-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/70 shadow-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                    {collapsed ? <ChevronRight className="size-3.5" aria-hidden /> : <ChevronLeft className="size-3.5" aria-hidden />}
                </button>

                {/* Menu search */}
                <div className={cn("pt-4 pb-2", collapsed ? "px-3" : "px-4")}>
                    {collapsed ? (
                        <button
                            type="button"
                            onClick={focusSearch}
                            aria-label="Search menu"
                            title="Search menu (/)"
                            className="mx-auto flex size-11 items-center justify-center rounded-xl text-sidebar-foreground/65 transition-colors hover:bg-white/[0.06] hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                        >
                            <Search className="size-[18px]" aria-hidden />
                        </button>
                    ) : (
                        <div className="flex h-10 items-center gap-2 rounded-xl border border-sidebar-border bg-white/[0.05] px-3 transition-colors focus-within:border-sidebar-ring/70 focus-within:bg-white/[0.08]">
                            <Search className="size-4 shrink-0 text-sidebar-foreground/55" aria-hidden />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search menu"
                                aria-label="Search menu"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={onSearchKeyDown}
                                className="min-w-0 flex-1 border-none bg-transparent text-sm text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/45"
                            />
                            {searchQuery ? (
                                <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="rounded p-0.5 text-sidebar-foreground/55 hover:text-sidebar-foreground">
                                    <X className="size-3.5" aria-hidden />
                                </button>
                            ) : (
                                <kbd className="rounded-md border border-sidebar-border px-1.5 font-sans text-[10px] text-sidebar-foreground/50" aria-hidden>/</kbd>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav aria-label="Pages" className={cn("flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-2 [scrollbar-width:thin]", collapsed ? "px-3" : "px-4")} onScroll={() => setRailHint(null)}>
                    {groups.map((group) => (
                        <div key={group.title ?? "top"}>
                            {group.title && (collapsed
                                ? <div className="mx-2 mb-2 border-t border-sidebar-border/70" aria-hidden />
                                : <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-sidebar-foreground/45 uppercase">{group.title}</p>)}
                            <div className="flex flex-col gap-1">
                                {group.items.map((item) => (
                                    <NavLink key={item.href} item={item} collapsed={collapsed} active={routeMatches(pathname, item.href)} badge={badges[item.href]} onHint={setRailHint} />
                                ))}
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 && !collapsed && (
                        <p className="px-3 text-xs text-sidebar-foreground/60">No pages match “{searchQuery}”.</p>
                    )}
                </nav>

                {/* Pinned (Users, Settings, My Profile) */}
                {pinned.length > 0 && (
                    <div className={cn("flex flex-col gap-1 border-t border-sidebar-border/70 py-3", collapsed ? "px-3" : "px-4")}>
                        {pinned.map((item) => (
                            <NavLink key={item.href} item={item} collapsed={collapsed} active={routeMatches(pathname, item.href)} onHint={setRailHint} />
                        ))}
                    </div>
                )}

                {!loading && profile && (
                    <DesktopUserMenu
                        profile={profile}
                        role={role}
                        baseRole={baseRole}
                        availableRoles={availableRoles}
                        collapsed={collapsed}
                        showUserMenu={showUserMenu}
                        setShowUserMenu={setShowUserMenu}
                        switchRole={switchRole}
                        onSignOut={handleSignOut}
                    />
                )}
            </aside>

            {/* Labels for the collapsed rail. Rendered outside the scrolling nav,
                which would otherwise clip them. */}
            {collapsed && railHint && (
                <div
                    role="tooltip"
                    className="animate-pop-in pointer-events-none fixed left-[88px] z-[60] hidden -translate-y-1/2 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-background shadow-lg min-[768px]:block"
                    style={{ top: railHint.top }}
                >
                    {railHint.label}
                </div>
            )}

            {/* ── Phone top bar ────────────────────────────────── */}
            <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border/70 bg-[var(--color-surface)]/90 px-4 backdrop-blur-md min-[768px]:hidden">
                <Link href={homeHref} aria-label={`${schoolName || "Skulbase"} home`} className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <SchoolMark logo={schoolLogo} name={schoolName ?? ""} size={34} />
                </Link>
                <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[15px] font-bold text-foreground">{currentPage?.label ?? (schoolName || "Skulbase")}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{currentPage ? (schoolName || "Skulbase") : roleLabel}</p>
                </div>
                {profile && (
                    <button
                        type="button"
                        onClick={() => setShowMoreMenu(true)}
                        aria-label="Account and more"
                        className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Avatar imageUrl={profile.imageUrl} firstName={profile.first_name} lastName={profile.last_name} size={34} fontSize={13} background={roleBadgeColors[profile.role]} />
                    </button>
                )}
            </header>

            {/* ── Phone bottom bar ─────────────────────────────── */}
            <nav
                aria-label="Main"
                className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(64px+env(safe-area-inset-bottom))] items-stretch border-t border-border/70 bg-[var(--color-surface)]/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md min-[768px]:hidden"
            >
                {mobileNav.primary.map((item) => (
                    <BottomTab key={item.href} href={item.href} label={item.shortLabel ?? item.label} fullLabel={item.label} icon={item.icon} active={routeMatches(pathname, item.href)} badge={badges[item.href]} />
                ))}
                {/* Always shown: the More sheet is the only home on a phone for
                    sign out, the theme and the role switch, even for roles whose
                    pages all fit the bar. */}
                <BottomTab
                    label="More"
                    icon={<LayoutGrid size={20} aria-hidden />}
                    active={moreActive}
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    expanded={showMoreMenu}
                />
            </nav>

            <MobileMoreMenu
                showMoreMenu={showMoreMenu}
                setShowMoreMenu={setShowMoreMenu}
                overflowItems={mobileNav.overflow}
                pathname={pathname}
                onSignOut={handleSignOut}
                profile={profile}
                role={role}
                baseRole={baseRole}
                availableRoles={availableRoles}
                switchRole={switchRole}
            />
        </>
    );
}

interface BottomTabProps {
    label: string;
    /** Spoken name when the visible label is shortened. */
    fullLabel?: string;
    icon: React.ReactNode;
    active: boolean;
    href?: string;
    badge?: number;
    onClick?: () => void;
    expanded?: boolean;
}

/** One bottom-bar destination: an icon in a pill that fills when active, and its label. */
function BottomTab({ label, fullLabel, icon, active, href, badge, onClick, expanded }: BottomTabProps) {
    const body = (
        <>
            <span className={cn(
                "relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground",
            )}>
                {icon}
                {!!badge && <span className="absolute top-0.5 right-3 size-2 rounded-full bg-destructive ring-2 ring-[var(--color-surface)]" />}
            </span>
            <span className={cn("max-w-full truncate px-0.5 text-[11px] leading-none", active ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                {label}
            </span>
        </>
    );
    const className = "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring rounded-xl";

    return href ? (
        <Link href={href} aria-current={active ? "page" : undefined} aria-label={fullLabel && fullLabel !== label ? fullLabel : undefined} className={className}>{body}</Link>
    ) : (
        <button type="button" onClick={onClick} aria-expanded={expanded} aria-haspopup="dialog" className={cn(className, "border-none bg-transparent")}>{body}</button>
    );
}

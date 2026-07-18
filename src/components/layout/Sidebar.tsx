"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Search, Sun, Moon, PanelLeftClose, PanelLeft, MoreHorizontal } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import { getNavGroups, getPinnedItems, getMobileNav, type NavItem } from "./sidebar/navItems";
import { DesktopUserMenu } from "./sidebar/DesktopUserMenu";
import { MobileMoreMenu } from "./sidebar/MobileMoreMenu";
import { cn } from "@/lib/utils";

interface SidebarProps {
    collapsed?: boolean;
    setCollapsed?: (val: boolean) => void;
}

const EXACT_MATCH_HREFS = new Set(["/dashboard", "/student/dashboard"]);

function isActivePath(pathname: string, href: string) {
    return pathname === href || (!EXACT_MATCH_HREFS.has(href) && pathname.startsWith(href));
}

function NavLink({ item, collapsed, pathname }: { item: NavItem; collapsed: boolean; pathname: string }) {
    const isActive = isActivePath(pathname, item.href);
    return (
        <Link
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
                "flex items-center gap-3 rounded-lg text-sm no-underline transition-colors",
                collapsed ? "justify-center px-0 py-2" : "px-3 py-2",
                isActive
                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
                    : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
        >
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{item.icon}</span>
            {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        </Link>
    );
}

function ThemeToggleButton({ collapsed }: { collapsed: boolean }) {
    const { theme, toggleTheme } = useTheme();
    return (
        <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            suppressHydrationWarning
            className={cn(
                "mx-3 mb-3 flex cursor-pointer items-center gap-3 rounded-lg border border-sidebar-border bg-white/5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
            )}
        >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            {!collapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
        </button>
    );
}

export function Sidebar({ collapsed = false, setCollapsed }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { profile, role, baseRole, availableRoles, switchRole, schoolName, loading } = useAuth();

    const [searchQuery, setSearchQuery] = useState("");
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    useEffect(() => {
        fetch("/api/school/data?type=school_profile")
            .then((res) => res.json())
            .then((data) => {
                if (data.data?.logo_url) setSchoolLogo(data.data.logo_url);
            })
            .catch(() => {});
    }, []);

    const groups = useMemo(() => {
        const base = getNavGroups(role);
        if (!searchQuery.trim()) return base;
        const q = searchQuery.toLowerCase();
        return base
            .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
            .filter((g) => g.items.length > 0);
    }, [role, searchQuery]);

    const pinned = useMemo(() => getPinnedItems(role), [role]);
    const mobileNav = useMemo(() => getMobileNav(role), [role]);

    const handleSignOut = () => router.push("/logout");
    const homeHref = role === "STUDENT" ? "/student/dashboard" : "/dashboard";

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className={cn(
                    "fixed top-0 left-0 z-50 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-in-out md:flex",
                    collapsed ? "w-20" : "w-[260px] shadow-[4px_0_24px_rgba(0,0,0,0.08)]"
                )}
            >
                {/* Logo + collapse toggle */}
                <div className={cn("flex items-center gap-3 p-4", collapsed && "justify-center")}>
                    <Link href={homeHref} className="flex min-w-0 flex-1 items-center gap-3 no-underline text-inherit">
                        {schoolLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={schoolLogo} alt={schoolName || "School"} className={cn("shrink-0 object-contain", collapsed ? "h-10 w-10" : "h-12 w-12")} />
                        ) : (
                            <Image
                                src="/images/logo.jpg"
                                alt="Matokeo Logo"
                                width={collapsed ? 40 : 48}
                                height={collapsed ? 40 : 48}
                                className="shrink-0 rounded-lg object-contain"
                            />
                        )}
                        {!collapsed && (
                            <span className="min-w-0 break-words font-display text-[13px] font-bold leading-tight">
                                {schoolName || "Matokeo"}
                            </span>
                        )}
                    </Link>
                    {!collapsed && (
                        <button
                            onClick={() => setCollapsed?.(true)}
                            title="Collapse sidebar"
                            className="shrink-0 cursor-pointer rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        >
                            <PanelLeftClose size={16} />
                        </button>
                    )}
                </div>
                {collapsed && (
                    <button
                        onClick={() => setCollapsed?.(false)}
                        title="Expand sidebar"
                        className="mx-auto mb-2 cursor-pointer rounded-md p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    >
                        <PanelLeft size={16} />
                    </button>
                )}

                {/* Menu search */}
                {!collapsed && (
                    <div className="px-4 pb-3">
                        <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-white/5 px-3 py-2 transition-colors focus-within:border-sidebar-foreground/40">
                            <Search size={14} className="shrink-0 text-sidebar-foreground/60" />
                            <input
                                type="text"
                                placeholder="Search menu…"
                                aria-label="Search menu"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full border-none bg-transparent text-[13px] text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/50"
                            />
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4", collapsed ? "px-3" : "px-4")}>
                    {groups.map((group) => (
                        <div key={group.title ?? "top"}>
                            {!collapsed && group.title && (
                                <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                                    {group.title}
                                </div>
                            )}
                            {collapsed && group.title && <div className="mx-2 mb-2 border-t border-sidebar-border" />}
                            <div className="flex flex-col gap-0.5">
                                {group.items.map((item) => (
                                    <NavLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
                                ))}
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 && !collapsed && (
                        <div className="px-2 text-xs italic text-sidebar-foreground/60">No pages match “{searchQuery}”</div>
                    )}
                </nav>

                {/* Pinned bottom items (Settings, Users) */}
                {pinned.length > 0 && (
                    <div className={cn("flex flex-col gap-0.5 border-t border-sidebar-border py-2", collapsed ? "px-3" : "px-4")}>
                        {pinned.map((item) => (
                            <NavLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
                        ))}
                    </div>
                )}

                {/* User Profile */}
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

                <ThemeToggleButton collapsed={collapsed} />
            </aside>

            {/* Mobile Bottom Navigation */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-50 flex items-center border-t border-border/70 bg-[var(--color-surface)] shadow-[0_-4px_24px_rgba(0,0,0,0.15)] md:hidden"
                style={{
                    paddingBottom: "env(safe-area-inset-bottom)",
                    height: "calc(64px + env(safe-area-inset-bottom))",
                }}
            >
                {mobileNav.primary.map((item) => {
                    const isActive = isActivePath(pathname, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setShowMoreMenu(false)}
                            className={cn(
                                "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center no-underline transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            {isActive && (
                                <span className="absolute top-0 left-1/2 h-[3px] w-2/5 -translate-x-1/2 rounded-b-sm bg-primary" />
                            )}
                            <span className={cn("transition-transform", isActive ? "-translate-y-0.5 opacity-100" : "opacity-70")}>
                                {item.icon}
                            </span>
                            <span className={cn("mt-1 max-w-full truncate text-[10px]", isActive ? "font-semibold opacity-100" : "font-medium opacity-70")}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {mobileNav.overflow.length > 0 && (
                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className={cn(
                            "relative flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-center border-none bg-transparent transition-colors",
                            showMoreMenu ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        {showMoreMenu && (
                            <span className="absolute top-0 left-1/2 h-[3px] w-2/5 -translate-x-1/2 rounded-b-sm bg-primary" />
                        )}
                        <span className={cn("transition-transform", showMoreMenu ? "-translate-y-0.5 opacity-100" : "opacity-70")}>
                            <MoreHorizontal size={18} />
                        </span>
                        <span className={cn("mt-1 text-[10px]", showMoreMenu ? "font-semibold opacity-100" : "font-medium opacity-70")}>
                            More
                        </span>
                    </button>
                )}
            </nav>

            <MobileMoreMenu
                showMoreMenu={showMoreMenu}
                setShowMoreMenu={setShowMoreMenu}
                overflowItems={mobileNav.overflow}
                pathname={pathname}
                theme={theme}
                toggleTheme={toggleTheme}
                onSignOut={handleSignOut}
                role={role}
                baseRole={baseRole}
                availableRoles={availableRoles}
                switchRole={switchRole}
            />
        </>
    );
}

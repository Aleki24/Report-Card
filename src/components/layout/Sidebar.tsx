"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/components/AuthProvider";
import { navItems } from "./sidebar/navItems";
import { DesktopUserMenu } from "./sidebar/DesktopUserMenu";
import { MobileMoreMenu } from "./sidebar/MobileMoreMenu";

function ThemeToggleButton({ collapsed }: { collapsed: boolean }) {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className="hidden md:flex items-center justify-center cursor-pointer transition-colors"
            style={{
                padding: "var(--space-3) var(--space-4)",
                marginBottom: "var(--space-2)",
                marginLeft: "var(--space-4)",
                marginRight: "var(--space-4)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-secondary)",
                fontSize: 14,
                fontWeight: 500,
                gap: "var(--space-3)",
            }}
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            suppressHydrationWarning
        >
            {theme === "dark" ? "☀️" : "🌙"}
            {!collapsed && (theme === "dark" ? "Light Mode" : "Dark Mode")}
        </button>
    );
}

interface SidebarProps {
    collapsed?: boolean;
    setCollapsed?: (val: boolean) => void;
}

const sidebarGroups = [
    {
        title: "Main",
        labels: ["Dashboard"],
    },
    {
        title: "School",
        labels: ["People", "Academic Structure"],
    },
    {
        title: "Academics",
        labels: ["Attendance", "Exams & Marks", "Report Cards"],
    },
    {
        title: "Finance",
        labels: ["Fees"],
    },
    {
        title: "Communication",
        labels: ["Announcements"],
    },
    {
        title: "Learning",
        labels: ["Assignments"],
    },
    {
        title: "Administration",
        labels: ["Administration", "Analytics"],
    },
];

function getItemCount(label: string) {
    const counts: Record<string, string> = {
        Students: "542",
        Teachers: "48",
        Classes: "36",
        Parents: "612",
        Payments: "12",
        Messages: "5",
        Announcements: "3",
        Assignments: "7",
    };

    return counts[label];
}

export function Sidebar({ collapsed = false, setCollapsed }: SidebarProps) {
    const pathname = usePathname();

    const {
        profile,
        role,
        availableRoles,
        switchRole,
        schoolName,
        loading,
    } = useAuth();

    const [searchQuery, setSearchQuery] = useState("");
    const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/school/data?type=school_profile")
            .then((res) => res.json())
            .then((data) => {
                if (data.data?.logo_url) setSchoolLogo(data.data.logo_url);
            })
            .catch(() => {});
    }, []);

    const { theme, toggleTheme } = useTheme();

    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const visibleNavItems = useMemo(() => {
        const allowedItems = role
            ? navItems.filter((item) => item.roles.includes(role))
            : navItems.filter((item) => item.roles.includes("ADMIN"));

        const filtered = allowedItems.filter(
            (item) =>
                item.label !== "Homepage" &&
                item.label !== "Home" &&
                item.href !== "/"
        );

        if (!searchQuery.trim()) return filtered;
        const q = searchQuery.toLowerCase();
        return filtered.filter((item) => item.label.toLowerCase().includes(q));
    }, [role, searchQuery]);

    const groupedNavItems = useMemo(() => {
        return sidebarGroups
            .map((group) => {
                const items = group.labels
                    .map((label) => visibleNavItems.find((item) => item.label === label))
                    .filter(Boolean) as typeof visibleNavItems;

                return {
                    title: group.title,
                    items,
                };
            })
            .filter((group) => group.items.length > 0);
    }, [visibleNavItems]);

    const ungroupedItems = useMemo(() => {
        const groupedLabels = new Set(sidebarGroups.flatMap((group) => group.labels));

        return visibleNavItems.filter((item) => !groupedLabels.has(item.label));
    }, [visibleNavItems]);

    const router = useRouter();

    const handleSignOut = () => {
        router.push("/logout");
    };

    const maxBottomItems = 4;
    const mainBottomItems = visibleNavItems.slice(0, maxBottomItems);
    const overflowItems = visibleNavItems.slice(maxBottomItems);

    return (
        <>
            {/* Desktop Sidebar */}
            <aside
                className="hidden md:flex fixed top-0 left-0 z-50 flex-col h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-all duration-300 ease-in-out"
                style={{
                    width: collapsed ? "80px" : "260px",
                    boxShadow: collapsed ? "none" : "4px 0 24px rgba(0,0,0,0.08)",
                }}
                onMouseEnter={() => setCollapsed?.(false)}
                onMouseLeave={() => setCollapsed?.(true)}
            >
                {/* Logo */}
                    <Link
                        href="/"
                        style={{
                            padding: collapsed ? "var(--space-4)" : "var(--space-4) var(--space-4) var(--space-3) var(--space-4)",
                            borderBottom: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: collapsed ? "center" : "flex-start",
                            gap: "var(--space-3)",
                            textDecoration: "none",
                            color: "inherit",
                            transition: "opacity 0.15s ease",
                            overflow: "hidden",
                        }}
                    >
                    {schoolLogo ? (
                        <img
                            src={schoolLogo}
                            alt={schoolName || "School"}
                            style={{
                                width: collapsed ? 44 : 56,
                                height: collapsed ? 44 : 56,
                                borderRadius: 0,
                                objectFit: "contain",
                                flexShrink: 0,
                            }}
                        />
                    ) : (
                        <Image
                            src="/images/logo.jpg"
                            alt="Matokeo Logo"
                            width={collapsed ? 44 : 56}
                            height={collapsed ? 44 : 56}
                            style={{
                                borderRadius: "var(--radius-md)",
                                objectFit: "contain",
                                flexShrink: 0,
                                boxShadow: "0 8px 18px rgba(37, 99, 235, 0.18)",
                            }}
                        />
                    )}

                    {!collapsed && (
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontFamily: "var(--font-display)",
                                    fontWeight: 800,
                                    fontSize: 13,
                                    lineHeight: 1.3,
                                    wordBreak: "break-word",
                                    overflowWrap: "break-word",
                                }}
                            >
                                {schoolName || "Matokeo"}
                            </div>
                        </div>
                    )}
                </Link>

                {/* Search */}
                {!collapsed && (
                    <div style={{ padding: "var(--space-3) var(--space-4) var(--space-4)", marginTop: "var(--space-1)" }}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                                padding: "8px 12px",
                                borderRadius: "var(--radius-md)",
                                border: "1px solid var(--color-border)",
                                background: "var(--color-surface)",
                            }}
                        >
                            <SearchIcon />

                            <input
                                type="text"
                                placeholder="Search menu..."
                                aria-label="Search menu"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: "100%",
                                    border: "none",
                                    outline: "none",
                                    background: "transparent",
                                    color: "var(--color-text)",
                                    fontSize: 13,
                                }}
                            />

                            <span
                                style={{
                                    padding: "2px 6px",
                                    borderRadius: "var(--radius-sm)",
                                    background: "var(--color-surface)",
                                    border: "1px solid var(--color-border)",
                                    color: "var(--color-text-muted)",
                                    fontSize: 10,
                                    fontWeight: 700,
                                }}
                            >
                                ⌘K
                            </span>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav
                    style={{
                        minHeight: 0,
                        overflowY: "auto",
                        padding: collapsed
                            ? "0 var(--space-3)"
                            : "0 var(--space-4)",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {groupedNavItems.map((group, index) => (
                        <div key={group.title} style={{
                            paddingBottom: "var(--space-4)",
                            marginBottom: index < groupedNavItems.length - 1 ? "var(--space-4)" : "0",
                            borderBottom: index < groupedNavItems.length - 1 ? "1px solid var(--color-border)" : "none",
                        }}>
                            {!collapsed && group.title !== "Main" && (
                                <div
                                    style={{
                                        marginBottom: "var(--space-2)",
                                        padding: "0 var(--space-2)",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: "var(--color-text-muted)",
                                        }}
                                    >
                                        {group.title}
                                    </span>
                                </div>
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "4px",
                                }}
                            >
                                {group.items.map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                                    const count = getItemCount(item.label);

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={collapsed ? item.label : undefined}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: collapsed ? "center" : "flex-start",
                                                gap: "var(--space-3)",
                                                minHeight: collapsed ? 34 : 40,
                                                padding: collapsed
                                                    ? "var(--space-1)"
                                                    : "8px 12px",
                                                borderRadius: "var(--radius-md)",
                                                color: isActive ? "var(--primary-foreground)" : "var(--color-text-secondary)",
                                                background: isActive
                                                    ? "var(--primary)"
                                                    : "transparent",
                                                textDecoration: "none",
                                                fontSize: 14,
                                                fontWeight: isActive ? 600 : 500,
                                                transition:
                                                    "background 0.15s ease, color 0.15s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isActive) {
                                                    e.currentTarget.style.background =
                                                        "var(--color-surface-hover)";
                                                    e.currentTarget.style.color = "var(--color-text)";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isActive) {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.color =
                                                        "var(--color-text-secondary)";
                                                }
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                    transform: collapsed ? "scale(0.85)" : "scale(1)",
                                                    transition: "transform 0.2s ease",
                                                }}
                                            >
                                                {item.icon}
                                            </span>

                                            {!collapsed && (
                                                <>
                                                    <span
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                            overflow: "hidden",
                                                            whiteSpace: "nowrap",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {item.label}
                                                    </span>
                                                </>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {ungroupedItems.length > 0 && (
                        <div style={{
                            paddingBottom: "var(--space-4)",
                            marginBottom: "var(--space-4)",
                            borderTop: "1px solid var(--color-border)",
                            paddingTop: "var(--space-4)",
                        }}>
                            {!collapsed && (
                                <div
                                    style={{
                                        marginBottom: "var(--space-2)",
                                        padding: "0 var(--space-2)",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: "var(--color-text-muted)",
                                        }}
                                    >
                                        More
                                    </span>
                                </div>
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "4px",
                                }}
                            >
                                {ungroupedItems.map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={collapsed ? item.label : undefined}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: collapsed ? "center" : "flex-start",
                                                gap: "var(--space-3)",
                                                minHeight: collapsed ? 34 : 40,
                                                padding: collapsed
                                                    ? "var(--space-1)"
                                                    : "8px 12px",
                                                borderRadius: "var(--radius-md)",
                                                color: isActive ? "var(--primary-foreground)" : "var(--color-text-secondary)",
                                                background: isActive
                                                    ? "var(--primary)"
                                                    : "transparent",
                                                textDecoration: "none",
                                                fontSize: 14,
                                                fontWeight: isActive ? 600 : 500,
                                                transition:
                                                    "background 0.15s ease, color 0.15s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isActive) {
                                                    e.currentTarget.style.background = "var(--color-surface-hover)";
                                                    e.currentTarget.style.color = "var(--color-text)";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isActive) {
                                                    e.currentTarget.style.background = "transparent";
                                                    e.currentTarget.style.color = "var(--color-text-secondary)";
                                                }
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 18,
                                                    height: 18,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                    transform: collapsed ? "scale(0.85)" : "scale(1)",
                                                    transition: "transform 0.2s ease",
                                                }}
                                            >
                                                {item.icon}
                                            </span>

                                            {!collapsed && <span>{item.label}</span>}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </nav>

                {/* Settings Link */}
                {(() => {
                    const settingsItem = visibleNavItems.find(item => item.label === 'Administration');
                    if (!settingsItem) return null;
                    const isActive = pathname === settingsItem.href;
                    return (
                        <Link
                            href={settingsItem.href}
                            title={collapsed ? settingsItem.label : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                gap: 'var(--space-3)',
                                minHeight: collapsed ? 34 : 40,
                                padding: collapsed ? 'var(--space-1)' : '8px 12px',
                                margin: '0 var(--space-4)',
                                marginTop: 'auto',
                                borderRadius: 'var(--radius-md)',
                                color: isActive ? 'var(--primary-foreground)' : 'var(--color-text-secondary)',
                                background: isActive ? 'var(--primary)' : 'transparent',
                                textDecoration: 'none',
                                fontSize: 14,
                                fontWeight: isActive ? 600 : 500,
                                transition: 'background 0.15s ease, color 0.15s ease',
                            }}
                            onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.color = 'var(--color-text)'; } }}
                            onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; } }}
                        >
                            <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transform: collapsed ? 'scale(0.85)' : 'scale(1)', transition: 'transform 0.2s ease' }}>
                                {settingsItem.icon}
                            </span>
                            {!collapsed && <span>{settingsItem.label}</span>}
                        </Link>
                    );
                })()}

                {/* User Profile */}
                {!loading && profile && (
                    <DesktopUserMenu
                        profile={profile}
                        role={role}
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
                className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] border-t border-[var(--color-border)] flex items-center overflow-x-auto shadow-[0_-4px_24px_rgba(0,0,0,0.15)]"
                style={{
                    paddingBottom: "env(safe-area-inset-bottom)",
                    height: "calc(64px + env(safe-area-inset-bottom))",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                }}
            >
                <style>{`nav::-webkit-scrollbar { display: none; }`}</style>

                {mainBottomItems.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setShowMoreMenu(false)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                flex: 1,
                                minWidth: "0",
                                height: "100%",
                                position: "relative",
                                color: isActive
                                    ? "var(--primary)"
                                    : "var(--color-text-secondary)",
                                textDecoration: "none",
                            }}
                        >
                            {isActive && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        width: "40%",
                                        height: 3,
                                        background: "var(--primary)",
                                        borderBottomLeftRadius: 3,
                                        borderBottomRightRadius: 3,
                                    }}
                                />
                            )}

                            <div
                                style={{
                                    transform: isActive ? "translateY(-2px)" : "none",
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    opacity: isActive ? 1 : 0.7,
                                }}
                            >
                                {item.icon}
                            </div>

                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: isActive ? 600 : 500,
                                    marginTop: 4,
                                    opacity: isActive ? 1 : 0.7,
                                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: "100%",
                                }}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* More Button */}
                <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: 1,
                        minWidth: "0",
                        height: "100%",
                        position: "relative",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: showMoreMenu
                            ? "var(--primary)"
                            : "var(--color-text-secondary)",
                    }}
                >
                    {showMoreMenu && (
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: "50%",
                                transform: "translateX(-50%)",
                                width: "40%",
                                height: 3,
                                background: "var(--primary)",
                                borderBottomLeftRadius: 3,
                                borderBottomRightRadius: 3,
                            }}
                        />
                    )}

                    <div
                        style={{
                            transform: showMoreMenu ? "translateY(-2px)" : "none",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                            opacity: showMoreMenu ? 1 : 0.7,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 16 16 12 12 8" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                    </div>

                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: showMoreMenu ? 600 : 500,
                            marginTop: 4,
                            opacity: showMoreMenu ? 1 : 0.7,
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    >
                        More
                    </span>
                </button>
            </nav>

            <MobileMoreMenu
                showMoreMenu={showMoreMenu}
                setShowMoreMenu={setShowMoreMenu}
                overflowItems={overflowItems}
                pathname={pathname}
                theme={theme}
                toggleTheme={toggleTheme}
                onSignOut={handleSignOut}
                role={role}
                availableRoles={availableRoles}
                switchRole={switchRole}
            />
        </>
    );
}

function SearchIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
        >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    );
}
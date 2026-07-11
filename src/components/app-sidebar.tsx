import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, ClipboardList, FileText, Truck, ScrollText,
  Receipt, MessageSquare, BarChart3, Settings, Printer, Palette, Factory, LogOut, FilePlus, Shield, Layers, CalendarDays, ListChecks,
  Wallet,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/hooks/use-auth";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[]; // visible to these roles (omit = all)
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Espace de travail",
    items: [
      { title: "Tableau de bord", url: "/tableau-de-bord", icon: LayoutDashboard, roles: ["super_admin", "admin", "marketing", "design", "livraison", "dtf"] },
      { title: "Clients", url: "/clients", icon: Users, roles: ["super_admin", "admin", "marketing", "design", "dtf"] },
      { title: "Commandes", url: "/commandes", icon: ClipboardList, roles: ["super_admin", "admin", "marketing", "design", "production", "dtf"] },
      { title: "Commandes du jour", url: "/commandes/du-jour", icon: CalendarDays, roles: ["super_admin", "admin", "marketing", "design", "livraison"] },
      { title: "Livraison", url: "/livraison", icon: Truck, roles: ["super_admin", "admin", "livraison"] },
    ],
  },
  {
    label: "Documents",
    items: [
      { title: "Devis", url: "/devis", icon: FileText, roles: ["super_admin", "admin", "marketing", "design"] },
      { title: "Création Devis", url: "/creation-devis", icon: FilePlus, roles: ["super_admin", "admin", "marketing", "design"] },
      { title: "Bons de livraison", url: "/bons-livraison", icon: ScrollText, roles: ["super_admin", "admin", "marketing", "design", "livraison"] },
      { title: "Factures", url: "/factures", icon: Receipt, roles: ["super_admin", "admin", "marketing", "design"] },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { title: "Messenger", url: "/messenger", icon: MessageSquare, roles: ["super_admin", "admin", "marketing"] },
      { title: "To Do List", url: "/todo", icon: ListChecks },
      { title: "Revenus libres", url: "/revenus", icon: Wallet, roles: ["super_admin", "admin", "design", "dtf"] },
      { title: "Analytics", url: "/analytics", icon: BarChart3, roles: ["super_admin", "admin"] },
      { title: "Administration", url: "/administration", icon: Settings, roles: ["super_admin"] },
    ],
  },
];

const departmentBadges: Partial<Record<AppRole, { icon: React.ComponentType<{ className?: string }>; label: string }>> = {
  marketing: { icon: MessageSquare, label: "Marketing" },
  design: { icon: Palette, label: "Design" },
  production: { icon: Factory, label: "Production" },
  livraison: { icon: Truck, label: "Livraison" },
  super_admin: { icon: Settings, label: "Super Admin" },
  admin: { icon: Shield, label: "Admin" },
  dtf: { icon: Layers, label: "DTF" },
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { roles, hasAnyRole, signOut } = useAuth();
  const navigate = useNavigate();

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");
  const canSee = (item: NavItem) => !item.roles || hasAnyRole(item.roles);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/tableau-de-bord" className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--gradient-primary)] flex items-center justify-center text-primary-foreground shrink-0">
            <Printer className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">ShapeAndPrint</span>
              <span className="text-xs text-muted-foreground">CRM</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => {
          const visible = group.items.filter(canSee);
          if (!visible.length) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {!collapsed && roles.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Vos rôles</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 flex flex-wrap gap-1">
                {roles.map((r) => {
                  const b = departmentBadges[r];
                  if (!b) return null;
                  return (
                    <span key={r} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      <b.icon className="h-3 w-3" />{b.label}
                    </span>
                  );
                })}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Se déconnecter"
              onClick={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Se déconnecter</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
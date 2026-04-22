import { Link, useLocation } from "wouter";
import { Plane, Activity, AlertTriangle, Gauge, Settings, Cpu, RotateCcw } from "lucide-react";
import { useRunOptimizer, useResetSimulation } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListFlightsQueryKey,
  getListResourcesQueryKey,
  getListAlertsQueryKey,
  getAnalyticsSummaryQueryKey,
} from "@workspace/api-client-react";

const navItems = [
  { title: "Live Ops Board", url: "/", icon: Plane },
  { title: "Resource Tracker", url: "/resources", icon: Activity },
  { title: "Predictive Alerts", url: "/alerts", icon: AlertTriangle },
  { title: "Analytics", url: "/analytics", icon: Gauge },
  { title: "What-If Scheduler", url: "/simulator", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const optimizeMutation = useRunOptimizer({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Optimization Complete",
          description: `Reassigned ${data.reassignments.length} flights. Estimated saving: ${data.totalSavingMin} min.`,
        });
        queryClient.invalidateQueries({ queryKey: getListFlightsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListResourcesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Optimization Failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      },
    },
  });

  const resetMutation = useResetSimulation({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Simulation Reset",
          description: "DB cleared and 6h of simulated ops regenerated.",
        });
        queryClient.invalidateQueries({ queryKey: getListFlightsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListResourcesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getAnalyticsSummaryQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Reset Failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      },
    },
  });

  return (
    <Sidebar className="border-r border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarHeader className="border-b border-border/50 py-4 px-4">
        <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-lg">
          <Plane className="h-6 w-6" />
          <span>SKYWARD OPS</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground uppercase text-xs tracking-wider">
            Command Center
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={`gap-3 transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/50 p-4 gap-2 flex flex-col">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary transition-all"
          onClick={() => optimizeMutation.mutate()}
          disabled={optimizeMutation.isPending}
        >
          <Cpu className="h-4 w-4" />
          {optimizeMutation.isPending ? "Running..." : "Run Optimizer"}
        </Button>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-destructive/20 hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Simulation
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Simulation Data?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will clear the database and regenerate 6 hours of simulated operations. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-transparent border-border hover:bg-white/5 text-foreground">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={() => resetMutation.mutate()}
              >
                Continue Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarFooter>
    </Sidebar>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground font-sans overflow-hidden selection:bg-primary/30">
        <AppSidebar />
        <main className="flex-1 flex flex-col h-[100dvh] overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

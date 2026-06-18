import React, { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";
import IntroScreen from "@/pages/IntroScreen";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import SignalsPage from "@/pages/SignalsPage";
import AssetsPage from "@/pages/AssetsPage";
import PerformancePage from "@/pages/PerformancePage";
import SettingsPage from "@/pages/SettingsPage";
import ProfilePage from "@/pages/ProfilePage";
import UsersPage from "@/pages/UsersPage";
const queryClient = new QueryClient();
function ProtectedRoute({
  component: Component,
  adminOnly = false,
}: {
  component: any;
  adminOnly?: boolean;
}) {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation("/login");
      } else if (adminOnly && !isAdmin) {
        setLocation("/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, adminOnly, setLocation]);
  if (isLoading || !isAuthenticated)
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center text-primary font-mono animate-blink text-2xl tracking-widest">
        INITIALIZING...
      </div>
    );
  if (adminOnly && !isAdmin) return null;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        setLocation("/dashboard");
      } else {
        setLocation("/login");
      }
    }
  }, [isLoading, isAuthenticated, setLocation]);
  return <div className="h-screen w-full bg-background" />;
}
function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/intro" component={IntroScreen} />
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/signals">
        <ProtectedRoute component={SignalsPage} />
      </Route>
      <Route path="/assets">
        <ProtectedRoute component={AssetsPage} />
      </Route>
      <Route path="/performance">
        <ProtectedRoute component={PerformancePage} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={UsersPage} adminOnly />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}
function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const interval = setInterval(() => {
      if (video.paused) video.play().catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <video
          ref={videoRef}
          id="bg-video"
          preload="auto"
          autoPlay
          muted
          loop
          playsInline
          src="/video.mp4"
          onStalled={(e) => {
            const v = e.target as HTMLVideoElement;
            v.play();
          }}
          onSuspend={(e) => {
            const v = e.target as HTMLVideoElement;
            v.play();
          }}
        />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;

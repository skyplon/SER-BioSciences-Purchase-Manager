import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { InvoicesList } from "@/pages/invoices-list";
import { InvoiceNew } from "@/pages/invoice-new";
import { InvoiceDetail } from "@/pages/invoice-detail";
import { SettingsPage } from "@/pages/settings";
import { AuditPage } from "@/pages/audit";
import { SuppliersPage } from "@/pages/suppliers";
import { CalendarPage } from "@/pages/calendar";
import NotFound from "@/pages/not-found";
import { SettingsProvider } from "@/contexts/settings-context";
import { setAuthTokenGetter, setExtraHeadersGetter } from "@workspace/api-client-react";
import { getImpersonateRole, useMyRole } from "@/lib/use-my-role";
import { RolesPage } from "@/pages/admin-roles";

function EditorGuard(Component: React.ComponentType): React.ComponentType {
  return function Guarded() {
    const { isEditor, isLoading } = useMyRole();
    if (isLoading) return null;
    if (!isEditor) return <Redirect to="/" />;
    return <Component />;
  };
}

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

/* SER BioSciences brand colors:
   Teal:       #4d8f9c  (primary — buttons, active states)
   Sage green: #72957a  (secondary — category badges)
   Chartreuse: #aabf42  (accent — highlights)
   Navy:       #1c2937  (foreground/text)
*/
const BRAND = {
  teal:       "#4d8f9c",
  tealDark:   "#3d7a88",
  sage:       "#72957a",
  chartreuse: "#aabf42",
  navy:       "#1c2937",
  navyMid:    "#4e6070",
  bgLight:    "#f5f9fa",
  border:     "#d0dde2",
};

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo-ser.png`,
  },
  variables: {
    colorPrimary: BRAND.teal,
    colorForeground: BRAND.navy,
    colorMutedForeground: BRAND.navyMid,
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: BRAND.bgLight,
    colorInputForeground: BRAND.navy,
    colorNeutral: BRAND.border,
    fontFamily: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-semibold",
    headerSubtitle: "",
    socialButtonsBlockButtonText: "font-medium",
    formFieldLabel: "font-medium",
    footerActionLink: "font-medium",
    footerActionText: "",
    dividerText: "",
    identityPreviewEditButton: "",
    formFieldSuccessText: "",
    alertText: "",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-16 w-auto",
    socialButtonsBlockButton: "border hover:opacity-90",
    formButtonPrimary: "!bg-[#4d8f9c] hover:!bg-[#3d7a88] !text-white !shadow-none",
    formFieldInput: "!bg-[#f5f9fa]",
    footerAction: "!bg-[#f5f9fa]",
    dividerLine: "",
    alert: "",
    otpCodeFieldInput: "",
    formFieldRow: "",
    main: "",
    badge: { display: "none" },
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ClerkAuthSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    setExtraHeadersGetter(() => {
      const r = getImpersonateRole();
      const headers: Record<string, string> = {};
      if (r) headers["X-Impersonate-Role"] = r;
      return headers;
    });
    return () => {
      setAuthTokenGetter(null);
      setExtraHeadersGetter(null);
    };
  }, [getToken]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AuthGuard() {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/invoices" component={InvoicesList} />
            <Route path="/invoices/new" component={EditorGuard(InvoiceNew)} />
            <Route path="/invoices/:id" component={InvoiceDetail} />
            <Route path="/suppliers" component={SuppliersPage} />
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/audit" component={AuditPage} />
            <Route path="/admin/roles" component={RolesPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "SER BioSciences",
            subtitle: "In Search for Sunrise",
          },
        },
        signUp: {
          start: {
            title: "SER BioSciences",
            subtitle: "In Search for Sunrise",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkAuthSync />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={AuthGuard} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <SettingsProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </SettingsProvider>
  );
}

export default App;

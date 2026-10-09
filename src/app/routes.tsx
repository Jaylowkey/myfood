import { createBrowserRouter } from "react-router";
import ProtectedRoute from "../components/ProtectedRoute";
import AccountPage from "../pages/AccountPage";
import AdminPage from "../pages/AdminPage";
import AuthPage from "../pages/AuthPage";
import DriverPage from "../pages/DriverPage";
import Storefront from "../pages/Storefront";
import ConfirmEmailPage from "../pages/ConfirmEmailPage";

export const router = createBrowserRouter([
  { path: "/", Component: Storefront },
  { path: "/login", element: <AuthPage mode="login" /> },
  { path: "/registar", element: <AuthPage mode="register" /> },
  { path: "/recuperar-senha", element: <AuthPage mode="forgot" /> },
  { path: "/confirmar-email", element: <ConfirmEmailPage /> },
  { path: "/reset-password", element: <AuthPage mode="reset" /> },
  {
    path: "/conta",
    element: <ProtectedRoute><AccountPage /></ProtectedRoute>,
  },
  {
    path: "/admin",
    element: <ProtectedRoute admin><AdminPage /></ProtectedRoute>,
  },
  {
    path: "/driver",
    element: <ProtectedRoute driver><DriverPage /></ProtectedRoute>,
  },
  { path: "*", element: <AuthPage mode="login" /> },
]);

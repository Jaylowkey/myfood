import { createBrowserRouter } from "react-router";
import ProtectedRoute from "../components/ProtectedRoute";
import AccountPage from "../pages/AccountPage";
import AdminPage from "../pages/AdminPage";
import AuthPage from "../pages/AuthPage";
import Storefront from "../pages/Storefront";

export const router = createBrowserRouter([
  { path: "/", Component: Storefront },
  { path: "/login", element: <AuthPage mode="login" /> },
  { path: "/registar", element: <AuthPage mode="register" /> },
  { path: "/recuperar-senha", element: <AuthPage mode="forgot" /> },
  { path: "/reset-password", element: <AuthPage mode="reset" /> },
  {
    path: "/conta",
    element: <ProtectedRoute><AccountPage /></ProtectedRoute>,
  },
  {
    path: "/admin",
    element: <ProtectedRoute admin><AdminPage /></ProtectedRoute>,
  },
  { path: "*", element: <AuthPage mode="login" /> },
]);

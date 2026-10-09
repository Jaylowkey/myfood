import { Navigate, useLocation } from "react-router";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({
  children,
  admin = false,
  driver = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
  driver?: boolean;
}) {
  const { session, loading, isAdmin, isDriver } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#fffaf1]">
        <div className="size-10 animate-spin rounded-full border-4 border-[#eadfce] border-t-[#df2b24]" />
      </div>
    );
  }

  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  if (admin && !isAdmin) {
    return <Navigate replace to="/conta?admin=denied" />;
  }

  return children;
}

import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import PostDetail from "./pages/PostDetail.jsx";
import PostEditor from "./pages/PostEditor.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="posts/:slug" element={<PostDetail />} />
        <Route path="login" element={<Login />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/posts/new"
          element={
            <ProtectedRoute>
              <PostEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/posts/:id/edit"
          element={
            <ProtectedRoute>
              <PostEditor />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

import { redirect } from "next/navigation";

export default function RootPage() {
  // Redirects http://localhost:3000 directly to http://localhost:3000/login
  redirect("/login");
}
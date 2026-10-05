import { redirect } from "next/navigation";

// Die Startseite ist der Vorrat
export default function Home() {
  redirect("/vorrat");
}

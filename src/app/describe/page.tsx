import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import DescribeClient from "./DescribeClient";

export const metadata: Metadata = pageMeta({
  title: "AI scroll website generator: two free, no sign-up",
  description:
    "Describe your business and Claude writes a finished scroll site you can edit and export as plain HTML. Two sites free per browser, no account needed.",
  path: "/describe",
});

export default function DescribePage() {
  return <DescribeClient />;
}

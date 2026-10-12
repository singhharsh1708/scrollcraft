import type { Metadata } from "next";
import { pageMeta } from "@/lib/pageMeta";
import DescribeClient from "./DescribeClient";

export const metadata: Metadata = pageMeta({
  title: "Describe your business",
  description:
    "Write a few sentences about what you do, add a photograph or two, and get a finished scroll site to edit and export as plain HTML.",
  path: "/describe",
});

export default function DescribePage() {
  return <DescribeClient />;
}

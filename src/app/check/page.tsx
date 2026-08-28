import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = {
  title: "Check a résumé — ResCheck",
};

export default function CheckPage() {
  return <Workspace />;
}

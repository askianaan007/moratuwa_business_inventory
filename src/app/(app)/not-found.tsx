import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState title="Not found">
      <p>This record does not exist or belongs to another department.</p>
      <Link href="/" className="btn btn-primary btn-sm mt-4">
        Go home
      </Link>
    </EmptyState>
  );
}

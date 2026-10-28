"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="alert alert-error alert-soft flex-col items-start">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm">{error.message}</p>
      <button type="button" className="btn btn-sm" onClick={reset}>
        Try again
      </button>
    </div>
  );
}

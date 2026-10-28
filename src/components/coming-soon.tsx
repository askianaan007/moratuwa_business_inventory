import { PageHeader } from "./ui";

/** Placeholder for screens planned in docs/PLAN.md but not built yet. */
export function ComingSoon({ title, phase, features }: { title: string; phase: string; features: string[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={title} subtitle={phase} />
      <div className="rounded-box border border-base-300 bg-base-100 p-5">
        <p className="mb-3 font-semibold">Planned for this screen</p>
        <ul className="flex flex-col gap-2">
          {features.map((feature) => (
            <li key={feature} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

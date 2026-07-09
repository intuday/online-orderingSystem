import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shimmer rounded-lg", className)} {...props} />;
}

export function MenuItemSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl bg-white p-3 shadow-card">
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-3 w-6 rounded-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center gap-2 pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-28 w-28 flex-shrink-0 rounded-xl" />
    </div>
  );
}

export function CategorySkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <Skeleton className="h-16 w-16 rounded-2xl" />
      <Skeleton className="h-3 w-14" />
    </div>
  );
}

export function OrderSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

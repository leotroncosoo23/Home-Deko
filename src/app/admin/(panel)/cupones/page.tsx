import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpSheet } from "@/components/admin/help-sheet";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { getCoupons } from "./data";
import { CouponsManager } from "./_components/coupons-manager";
import { CouponsSkeleton } from "./_components/coupons-skeleton";
import { EmptyState } from "./_components/empty-state";
import { NewCouponButton } from "./_components/new-coupon-button";

const section = getNavItem("/admin/cupones");

export const metadata: Metadata = { title: "Cupones" };

/**
 * /admin/cupones
 *
 * Encabezado estático (aparece al instante). La lista lee la base (con
 * requireAdmin dentro de getCoupons), así que va dentro de <Suspense>.
 */
export default function CouponsPage() {
  return (
    <>
      <PageHeader
        eyebrow={section.group}
        title={section.title}
        description={section.description}
        actions={
          <>
            <HelpSheet guia="cupones" />
            <NewCouponButton />
          </>
        }
      />
      <div>
        <Suspense fallback={<CouponsSkeleton />}>
          <CouponsList />
        </Suspense>
      </div>
    </>
  );
}

async function CouponsList() {
  const coupons = await getCoupons();
  if (coupons.length === 0) return <EmptyState />;
  return <CouponsManager coupons={coupons} />;
}

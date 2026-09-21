import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PropertySite from '@/app/components/PropertySite';
import { getPropertySite, propertyMetadata } from '@/lib/property-site';

// Paid status and signed photo URLs are read on every request.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return propertyMetadata(await getPropertySite(slug), true);
}

export default async function PropertyWebsite({ params }: Props) {
  const { slug } = await params;
  const site = await getPropertySite(slug);
  if (!site) notFound();
  return <PropertySite site={site} branded />;
}

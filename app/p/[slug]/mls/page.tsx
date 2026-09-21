import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PropertySite from '@/app/components/PropertySite';
import { getPropertySite, propertyMetadata } from '@/lib/property-site';

// The unbranded version, for MLS listings. Same page, no agent or Sala Nera.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return propertyMetadata(await getPropertySite(slug), false);
}

export default async function UnbrandedPropertyWebsite({ params }: Props) {
  const { slug } = await params;
  const site = await getPropertySite(slug);
  if (!site) notFound();
  return <PropertySite site={site} branded={false} />;
}

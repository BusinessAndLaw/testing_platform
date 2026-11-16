import { notFound } from 'next/navigation';
import AdminAccess from '@/components/admin-access';

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const sections = ['specialties', 'groups', 'tests', 'users', 'attempts', 'analytics', 'settings'];
  if (section.length > 1 || (section.length === 1 && !sections.includes(section[0]))) notFound();
  return <AdminAccess/>;
}

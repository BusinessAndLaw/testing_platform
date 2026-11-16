import { notFound } from 'next/navigation';
import AdminAccess from '@/components/admin-access';

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const sections = ['specialties', 'groups', 'tests', 'users', 'attempts', 'analytics', 'settings'];
  if (section.length > 2 || (section.length === 2 && section[0] !== 'tests') ||
      (section.length > 0 && !sections.includes(section[0]))) notFound();
  return <AdminAccess/>;
}

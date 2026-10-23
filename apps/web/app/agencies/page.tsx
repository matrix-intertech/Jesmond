import { Metadata } from 'next';
import AgenciesClientPage from './AgenciesClientPage';

export const metadata: Metadata = {
  title: 'Student Accommodation Agencies',
  description: 'Browse trusted student accommodation agencies on Jesmond. Find agencies managing verified properties near your university.',
  alternates: {
    canonical: '/agencies',
  },
  openGraph: {
    title: 'Student Accommodation Agencies | Jesmond',
    description: 'Browse trusted student accommodation agencies on Jesmond. Find agencies managing verified properties near your university.',
    url: '/agencies',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Student Accommodation Agencies | Jesmond',
    description: 'Browse trusted student accommodation agencies on Jesmond.',
  },
};

export default function AgenciesPage() {
  return <AgenciesClientPage />;
}

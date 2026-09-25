import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Student Accommodation Agencies | Jesmond',
  description: 'Browse trusted student accommodation agencies on Jesmond. Find agencies managing verified properties near your university.',
};

import AgenciesClientPage from './AgenciesClientPage';

export default function AgenciesPage() {
  return <AgenciesClientPage />;
}

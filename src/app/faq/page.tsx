import type { Metadata } from 'next';
import FaqPage from '@/views/public/FaqPage';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about deliverability, mailbox connections, data security and unsubscribes.',
};

export default function Page() {
  return <FaqPage />;
}

import { AuthScreen } from '@/components/auth-screen';
import { NexaChat } from '@/components/nexa-chat';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <AuthScreen />;
  return <NexaChat user={user} />;
}

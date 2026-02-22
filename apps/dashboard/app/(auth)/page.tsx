import { AppProvider } from '../../components/app-context';
import { AuthPageClient } from '../../components/auth/auth-page-client';

export default function AuthPage() {
  return (
    <AppProvider>
      <AuthPageClient />
    </AppProvider>
  );
}

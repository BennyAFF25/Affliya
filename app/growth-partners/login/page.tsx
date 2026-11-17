import LoginForm from './LoginForm';
export default async function GrowthLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return <main className="mx-auto max-w-lg"><section className="gp-card"><h2>Welcome back</h2><p className="mb-6">Enter the email used for your approved Growth Partner application. We will send you a secure sign-in link.</p>{query.error && <p className="gp-error" role="alert">That link could not be used. Please request a fresh sign-in link.</p>}<LoginForm /></section></main>;
}

import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function BackToDashboardButton() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate('/dashboard')}
      aria-label="Back to dashboard"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-white/72 transition hover:bg-white/[0.08] hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

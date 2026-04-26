import { FormEvent, useEffect, useState } from 'react';
import { Loader2, PencilLine, Save, Shield, UserCircle, X } from 'lucide-react';
import { BackToDashboardButton } from '../components/navigation/BackToDashboardButton';
import { getCurrentUser, updateMe } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';

export default function Profile() {
  const user = getCurrentUser();
  const { addNotification } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user?.name, user?.email]);

  const handleCancel = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setIsEditing(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !email.trim()) {
      addNotification({
        type: 'warning',
        title: 'Missing details',
        message: 'Name and email are both required.',
      });
      return;
    }

    setSaving(true);
    try {
      await updateMe({
        name: name.trim(),
        email: email.trim(),
      });

      addNotification({
        type: 'success',
        title: 'Profile updated',
        message: 'Your profile details were saved successfully.',
      });
      setIsEditing(false);
    } catch (error: any) {
      addNotification({
        type: 'critical',
        title: 'Update failed',
        message: error?.response?.data?.message || 'Unable to update your profile right now.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relief-page text-white">
      <div className="relief-orb left-[8%] top-[10%] h-72 w-72 bg-[rgba(255,90,58,0.14)]" />
      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
        <div>
          <BackToDashboardButton />
        </div>

        <section className="relief-panel rounded-[1.75rem] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <UserCircle className="h-8 w-8 text-[var(--color-relief-orange)]" />
              </div>
              <div>
                <div className="relief-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
                  <Shield className="h-3.5 w-3.5" />
                  Operator Profile
                </div>
                <h1 className="relief-title mt-4 text-3xl font-bold tracking-tight text-white">
                  {user?.name || 'ReliefOS Operator'}
                </h1>
                <p className="relief-muted mt-2 text-sm">
                  Update your command identity and account details used across ReliefOS AI.
                </p>
              </div>
            </div>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/8 hover:text-white"
              >
                <PencilLine className="h-4 w-4 text-cyan-200" />
                Edit Profile
              </button>
            ) : null}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <label className="relief-card rounded-[1.5rem] p-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Name</div>
            {isEditing ? (
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-3 w-full bg-transparent text-lg font-semibold text-white outline-none"
                placeholder="Your name"
                disabled={saving}
              />
            ) : (
              <div className="mt-3 text-lg font-semibold text-white">{user?.name || 'Unknown'}</div>
            )}
          </label>

          <label className="relief-card rounded-[1.5rem] p-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Email</div>
            {isEditing ? (
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-3 w-full bg-transparent text-lg font-semibold text-white outline-none"
                placeholder="you@example.com"
                disabled={saving}
              />
            ) : (
              <div className="mt-3 text-lg font-semibold text-white">{user?.email || 'Not signed in'}</div>
            )}
          </label>

          <div className="relief-card rounded-[1.5rem] p-5">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500">Role</div>
            <div className="mt-3 text-lg font-semibold text-white capitalize">{user?.role || 'Guest'}</div>
            <div className="mt-2 text-sm text-gray-400">Role is managed by the system and can’t be edited here.</div>
          </div>

          {isEditing ? (
            <div className="lg:col-span-3 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-70"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/8 hover:text-white disabled:opacity-70"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
